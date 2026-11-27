// Voice memo → proposed changes to the user's lists. The apps send the recording (base64, ≤ 2 min
// at 32 kbps) together with their lists and notes under short refs, and get back a proposal:
// new notes, notes to tick off or untick, due dates, new lists. They show it for review and apply
// what the user keeps locally, so it syncs like any other edit. Nothing is stored here.
//
// Same setup as scan-recipe: signed-in users only, the model reached through OpenRouter with the
// secret OPENROUTER_API_KEY under the account's ZDR settings; VOICE_NOTES_MODEL overrides the
// default model. See supabase/README.md. The pure logic is in core.ts.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildMessages, DEFAULT_MODEL, MAX_BODY_BYTES, parseRequest, RESPONSE_SCHEMA, sanitizeProposal } from './core.ts'

const TIMEOUT_MS = 60_000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'POST only' })

  const authorization = req.headers.get('Authorization') ?? ''
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: { user } } = await sb.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  if (!user) return reply(401, { error: 'not signed in' })

  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return reply(502, { error: 'voice notes are not configured' })

  if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return reply(413, { error: 'recording too long' })
  let request
  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'recording too long' })
    request = parseRequest(JSON.parse(raw))
  } catch {
    return reply(400, { error: 'bad request' })
  }
  if (typeof request === 'string') return reply(400, { error: request })

  const model = Deno.env.get('VOICE_NOTES_MODEL') || DEFAULT_MODEL
  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        // As in scan-recipe: no temperature and no provider.require_parameters, or the ZDR-allowed
        // Vertex endpoints drop out. The schema is best-effort; the prompt asks for JSON too.
        max_tokens: 8000,
        // Matching speech to the right list and note needs a little thought, not much.
        reasoning: { effort: 'low' },
        provider: { data_collection: 'deny' },
        response_format: { type: 'json_schema', json_schema: { name: 'proposal', strict: true, schema: RESPONSE_SCHEMA } },
        messages: buildMessages(request),
      }),
    })
  } catch (e) {
    console.error('voice-notes: upstream unreachable', e instanceof Error ? e.message : e)
    return reply(504, { error: 'the voice service did not answer in time' })
  }

  const body = await res.json().catch(() => null)
  if (!res.ok || !body || body.error) {
    // Metadata only: an upstream error can echo the request back (OpenRouter's `metadata.raw`),
    // so log its status, code and message, never the body.
    const err = body?.error
    console.error('voice-notes: upstream error', res.status, JSON.stringify({
      code: err?.code ?? null,
      message: typeof err?.message === 'string' ? err.message.slice(0, 200) : null,
      provider: err?.metadata?.provider_name ?? null,
    }))
    return reply(502, { error: 'the voice service failed, try again' })
  }

  const content = body.choices?.[0]?.message?.content
  const proposal = typeof content === 'string' ? sanitizeProposal(content, request) : null
  // Metadata only: sizes and counts, never the audio, the transcript or any note.
  console.log('voice-notes', JSON.stringify({
    model: body.model, provider: body.provider, usage: body.usage, format: request.format,
    audioBytes: Math.floor(request.audio.length * 3 / 4), lists: request.lists.length,
    ops: proposal && {
      newLists: proposal.newLists.length, add: proposal.add.length, check: proposal.check.length,
      uncheck: proposal.uncheck.length, schedule: proposal.schedule.length,
    },
  }))
  if (proposal === null) return reply(502, { error: 'could not read the result, try again' })

  return reply(200, { ...proposal, model: body.model, provider: body.provider })
})

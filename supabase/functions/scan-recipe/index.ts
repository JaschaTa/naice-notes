// Reads the ingredient list off a recipe photo. Both apps send a downscaled JPEG (≤1024 px,
// base64 in JSON) and get back { ingredients: string[] }, which they show for review before
// adding the picked lines as items. Nothing is stored here; the items are created client-side
// and sync like any other.
//
// Only signed-in users can call it (sign-up is invite-only), so the shared webhook secret the
// Android app used to carry is gone. The vision model is reached through OpenRouter with the
// secret OPENROUTER_API_KEY; RECIPE_SCAN_MODEL overrides the default model. Privacy is set on
// the OpenRouter account (ZDR-only routing; Google allowed with safety retention so Gemini on
// Vertex stays reachable) — see supabase/README.md.
import { createClient } from 'npm:@supabase/supabase-js@2'

// Must have an endpoint the account's ZDR setting allows: gemini-2.5-flash is AI Studio only on
// OpenRouter and gets refused (404 "ZDR violation"); the 3.x Flash models run on Vertex.
const DEFAULT_MODEL = 'google/gemini-3.5-flash-lite'
const MAX_BODY_BYTES = 3_000_000
const TIMEOUT_MS = 45_000

const PROMPT = `You read photos of recipes (cookbook pages, screenshots, handwritten cards) and extract the ingredient list.

Rules:
- One entry per ingredient, exactly as a shopping/cooking list line: quantity and unit first if the recipe gives them, then the ingredient, e.g. "200 g Mehl", "2 Eier", "1 TL Salz", "Olive oil".
- Keep the recipe's own language and wording; do not translate. Normalise only whitespace.
- Keep short qualifiers that matter when shopping ("weiche Butter", "rote Zwiebel"), drop preparation steps and serving suggestions.
- If the recipe has sub-lists (dough, filling, sauce), include every ingredient once per sub-list in reading order; do not add the sub-list headings.
- No steps, no headings, no notes, no numbering or bullets.
- If the image contains no recipe ingredients, return an empty list.

Answer with JSON only: {"ingredients": ["...", "..."]}`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Models sometimes wrap JSON in a ```json fence even with a schema; accept both.
function parseIngredients(content: string): string[] | null {
  const unfenced = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(unfenced)
    const list = Array.isArray(parsed) ? parsed : parsed?.ingredients
    if (!Array.isArray(list)) return null
    return list
      .map((s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''))
      .filter((s: string) => s.length > 0)
  } catch {
    return null
  }
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
  if (!apiKey) return reply(502, { error: 'recipe scan is not configured' })

  if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return reply(413, { error: 'image too large' })
  let image: string
  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'image too large' })
    image = String(JSON.parse(raw).image ?? '').replace(/^data:image\/\w+;base64,/, '').replace(/\s+/g, '')
  } catch {
    return reply(400, { error: 'bad request' })
  }
  if (!image || !/^[A-Za-z0-9+/]+=*$/.test(image)) return reply(400, { error: 'image (base64 JPEG) is required' })

  const model = Deno.env.get('RECIPE_SCAN_MODEL') || DEFAULT_MODEL
  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        // No temperature, and no provider.require_parameters: Vertex's Gemini 3 endpoints don't
        // take temperature, and requiring every parameter left no endpoint at all once the
        // account's ZDR setting had excluded AI Studio (404 "No endpoints found that can handle
        // the requested parameters"). The schema is best-effort; the prompt asks for JSON too.
        max_tokens: 4000,
        // Reading a list off a photo needs little thinking; low keeps a scan to a few seconds.
        reasoning: { effort: 'low' },
        provider: { data_collection: 'deny' },
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ingredients',
            strict: true,
            schema: {
              type: 'object',
              properties: { ingredients: { type: 'array', items: { type: 'string' } } },
              required: ['ingredients'],
              additionalProperties: false,
            },
          },
        },
        messages: [
          { role: 'system', content: PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the ingredients from this recipe.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
            ],
          },
        ],
      }),
    })
  } catch (e) {
    console.error('scan-recipe: upstream unreachable', e instanceof Error ? e.message : e)
    return reply(504, { error: 'the scan service did not answer in time' })
  }

  const body = await res.json().catch(() => null)
  if (!res.ok || !body || body.error) {
    // Metadata only: an upstream error can echo the request back (OpenRouter's `metadata.raw`),
    // so log its status, code and message, never the body.
    const err = body?.error
    console.error('scan-recipe: upstream error', res.status, JSON.stringify({
      code: err?.code ?? null,
      message: typeof err?.message === 'string' ? err.message.slice(0, 200) : null,
      provider: err?.metadata?.provider_name ?? null,
    }))
    return reply(502, { error: 'the scan service failed, try again' })
  }

  const content = body.choices?.[0]?.message?.content
  const ingredients = typeof content === 'string' ? parseIngredients(content) : null
  // Metadata only — never the image or the extracted text.
  console.log('scan-recipe', JSON.stringify({ model: body.model, provider: body.provider, usage: body.usage, ok: ingredients !== null }))
  if (ingredients === null) return reply(502, { error: 'could not read the scan result, try again' })

  return reply(200, { ingredients, model: body.model, provider: body.provider })
})

// Voice notes: a recording plus every list goes to the voice-notes Edge Function (supabase/
// functions), which asks a model what should change. The answer is a proposal the user reviews;
// Notes.applyVoice writes the part they keep. Online-only like scan; the changes sync like any edit.
//
// The function never sees ids. Lists go out as s1, s2…, notes as i1, i2…, and the model names
// lists it proposes n1, n2…; `refs` maps the first two back. Anything that doesn't resolve to a
// live row when the answer arrives is dropped here, so the review only shows what can be applied.
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { displayText } from './display.ts'
import { bySortKey, type Item, type Section } from './model.ts'
import { BRAND_COLOR } from './notes.ts'
import { dateInputToLocalStartOfDay, nextDueAt, startOfDayIn, toDateInputValue } from './schedule.ts'

// ── The wire format (supabase/functions/voice-notes/core.ts) ──

export interface WireContext {
  today: string
  weekday: string
  current: string | null
  lists: { ref: string; name: string; emoji: string | null; items: { ref: string; text: string; checked: boolean; due: string | null; repeatWeeks: number | null }[] }[]
}

export interface WireProposal {
  transcript: string
  newLists: { ref: string; name: string; emoji: string | null }[]
  add: { list: string; text: string; due: string | null; repeatWeeks: number | null }[]
  check: string[]
  uncheck: string[]
  schedule: { item: string; due: string | null; repeatWeeks: number | null }[]
}

export interface VoiceContext {
  wire: WireContext
  /** s…/i… ref → section or item id. */
  refs: Map<string, string>
}

/**
 * Every live list and note, lists in rail order and notes in list order, so the model reads them
 * the way the user sees them. A link note goes out as its title, which is what the user would say.
 */
export function buildContext(sections: Section[], items: Item[], currentId: string | null, now: number): VoiceContext {
  const refs = new Map<string, string>()
  const bySection = new Map<string, Item[]>()
  for (const i of items) {
    if (i.deletedAt) continue
    bySection.set(i.sectionId, [...(bySection.get(i.sectionId) ?? []), i])
  }
  let s = 0
  let n = 0
  let current: string | null = null
  const lists = sections.filter((x) => !x.deletedAt).sort(bySortKey).map((section) => {
    const ref = `s${++s}`
    refs.set(ref, section.id)
    if (section.id === currentId) current = ref
    return {
      ref, name: section.name, emoji: section.emoji?.trim() || null,
      items: (bySection.get(section.id) ?? []).sort(bySortKey).map((item) => {
        const iref = `i${++n}`
        refs.set(iref, item.id)
        return {
          ref: iref, text: displayText(item), checked: item.isChecked,
          due: item.dueAt == null ? null : toDateInputValue(item.dueAt), repeatWeeks: item.repeatWeeks,
        }
      }),
    }
  })
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now)
  return { wire: { today: toDateInputValue(now), weekday, current, lists }, refs }
}

// ── What the review shows and applyVoice writes ──

/** Where a new note goes: an existing section, or a list from the same proposal. */
export type Target = { sectionId: string } | { newList: string }

export type VoiceChange =
  | { kind: 'newList'; key: string; name: string; emoji: string | null; color: number }
  | { kind: 'add'; target: Target; text: string; dueAt: number | null; repeatWeeks: number | null }
  | { kind: 'check'; item: Item }
  /** "Done" on a repeating note: the cycle restarts from now, like the tooltip's Reset timer. */
  | { kind: 'reset'; item: Item; dueAt: number }
  | { kind: 'uncheck'; item: Item }
  | { kind: 'schedule'; item: Item; dueAt: number | null; repeatWeeks: number | null }

export interface VoiceProposal { transcript: string; changes: VoiceChange[] }

/** "2026-12-04" → local midnight; a repeat without a date is due today, as in ScheduleSheet. */
function toDue(due: string | null, repeatWeeks: number | null, now: number): number | null {
  if (due) return dateInputToLocalStartOfDay(due)
  return repeatWeeks != null ? startOfDayIn(now, 0) : null
}

const weeks = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 52 ? v : null)
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

/**
 * The function's answer against the lists as they are now. The function already dropped unknown
 * refs; this also drops what changed while it was thinking (a list deleted, a note ticked off
 * elsewhere), and checks types again, since the answer comes over the network.
 */
export function resolveProposal(wire: WireProposal, ctx: VoiceContext, sections: Section[], items: Item[], now: number): VoiceProposal {
  const liveSection = new Set(sections.filter((s) => !s.deletedAt).map((s) => s.id))
  const liveItem = new Map(items.filter((i) => !i.deletedAt).map((i) => [i.id, i]))
  const item = (ref: unknown) => {
    const id = typeof ref === 'string' ? ctx.refs.get(ref) : undefined
    return id ? liveItem.get(id) : undefined
  }
  const changes: VoiceChange[] = []
  const touched = new Set<string>()

  const newLists = (wire.newLists ?? []).filter((n) => typeof n?.ref === 'string' && typeof n.name === 'string' && n.name.trim())
  for (const n of newLists) {
    changes.push({
      kind: 'newList', key: n.ref, name: n.name.trim(), emoji: typeof n.emoji === 'string' && n.emoji.trim() ? n.emoji.trim() : null,
      color: BRAND_COLOR,
    })
  }
  const newKeys = new Set(newLists.map((n) => n.ref))

  for (const a of wire.add ?? []) {
    const text = typeof a?.text === 'string' ? a.text.trim() : ''
    if (!text) continue
    const sectionId = ctx.refs.get(a.list)
    const target: Target | null = sectionId && liveSection.has(sectionId) ? { sectionId } : newKeys.has(a.list) ? { newList: a.list } : null
    if (!target) continue
    const repeatWeeks = weeks(a.repeatWeeks)
    changes.push({ kind: 'add', target, text, dueAt: toDue(date(a.due), repeatWeeks, now), repeatWeeks })
  }

  for (const ref of wire.check ?? []) {
    const i = item(ref)
    if (!i || i.isChecked || touched.has(i.id)) continue
    touched.add(i.id)
    changes.push(i.repeatWeeks != null ? { kind: 'reset', item: i, dueAt: nextDueAt(now, i.repeatWeeks) } : { kind: 'check', item: i })
  }
  for (const ref of wire.uncheck ?? []) {
    const i = item(ref)
    if (!i || !i.isChecked || touched.has(i.id)) continue
    touched.add(i.id)
    changes.push({ kind: 'uncheck', item: i })
  }
  for (const s of wire.schedule ?? []) {
    const i = item(s?.item)
    // A reset already sets this note's next date; a second date for it would contradict that.
    if (!i || changes.some((c) => c.kind === 'reset' && c.item.id === i.id)) continue
    const repeatWeeks = weeks(s.repeatWeeks)
    const dueAt = toDue(date(s.due), repeatWeeks, now)
    if (dueAt === i.dueAt && repeatWeeks === i.repeatWeeks) continue
    if (changes.some((c) => c.kind === 'schedule' && c.item.id === i.id)) continue
    changes.push({ kind: 'schedule', item: i, dueAt, repeatWeeks })
  }

  return { transcript: typeof wire.transcript === 'string' ? wire.transcript.trim() : '', changes }
}

// ── The server call ──

/** The server call, kept apart so the demo can stand in for it. */
export interface VoiceRemote {
  analyse(audio: Blob, ctx: WireContext): Promise<WireProposal>
}

/** OpenRouter's input_audio format names for what MediaRecorder hands out. */
export function audioFormat(mimeType: string): string | null {
  const type = mimeType.split(';')[0].trim().toLowerCase()
  return ({
    'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm',
    'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3',
  } as Record<string, string>)[type] ?? null
}

const OFFLINE = 'You\'re offline. Voice notes need a connection.'

export class SupabaseVoice implements VoiceRemote {
  private sb: SupabaseClient
  constructor(sb: SupabaseClient) { this.sb = sb }

  async analyse(audio: Blob, ctx: WireContext): Promise<WireProposal> {
    const format = audioFormat(audio.type)
    if (!format) throw new Error('This browser records audio in a format that can\'t be sent.')
    const body = { audio: await toBase64(audio), format, ...ctx }
    const { data, error } = await this.sb.functions.invoke<WireProposal>('voice-notes', { body })
    if (error) throw new Error(await describe(error))
    if (!data || typeof data !== 'object') throw new Error('Something went wrong. Try again.')
    return data
  }
}

async function toBase64(blob: Blob): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
  return url.slice(url.indexOf(',') + 1)
}

async function describe(error: unknown): Promise<string> {
  if (error instanceof FunctionsFetchError) return OFFLINE
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response
    if (res.status === 401) return 'Your session expired. Sign in again to use voice notes.'
    const body = await res.json().catch(() => null) as { error?: string } | null
    if (body?.error) return capitalize(body.error)
  }
  return error instanceof Error && /fetch|network/i.test(error.message) ? OFFLINE : 'Something went wrong. Try again.'
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.')

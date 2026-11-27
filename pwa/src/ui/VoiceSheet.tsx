import { useEffect, useRef, useState } from 'preact/hooks'
import { displayText } from '../data/display.ts'
import { bySortKey, type Item, type Section } from '../data/model.ts'
import type { Notes, VoiceResult } from '../data/notes.ts'
import { formatDueRelative } from '../data/schedule.ts'
import { buildContext, resolveProposal, type VoiceChange, type VoiceRemote } from '../data/voice.ts'
import { CheckCircle, DateRange, People, RadioUnchecked } from './icons.tsx'
import { LineText } from './LineText.tsx'
import { ScheduleSheet } from './ScheduleSheet.tsx'
import { Sheet } from './Sheet.tsx'
import { Tile } from './Tile.tsx'

/** One proposed change as the review holds it: kept or not, and the user's edits. */
interface Row { change: VoiceChange; include: boolean }
type State =
  | { kind: 'analysing' }
  | { kind: 'review'; transcript: string; rows: Row[] }
  | { kind: 'failed'; message: string }

/** A group in the review: an existing list, or one the proposal creates (by its key). */
type Group = { section: Section; key: string } | { newList: Extract<VoiceChange, { kind: 'newList' }>; key: string; index: number }

/**
 * The voice memo's proposal for review, grouped by list. Mirrors ScanSheet: a waiting state while
 * the model listens, then lines to untick or edit. New notes are editable and carry a date chip
 * that opens the timer sheet; tick-offs, unticks and timer changes on existing notes can only be
 * kept or dropped. Lists shared with others are marked, so nothing lands in one unnoticed.
 */
export function VoiceSheet({ audio, sections, items, currentId, sharedIds, spaceId, voice, notes, onApplied, onClose }: {
  audio: Blob; sections: Section[]; items: Item[]; currentId: string | null; sharedIds: ReadonlySet<string>
  /** Where new lists go (the personal space); null while it isn't known, and then none are made. */
  spaceId: string | null
  voice: VoiceRemote; notes: Notes
  onApplied: (result: VoiceResult, changes: VoiceChange[]) => void; onClose: () => void
}) {
  const [state, setState] = useState<State>({ kind: 'analysing' })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  // The answer is matched against the lists as they are when it arrives, not when it was sent.
  const live = useRef({ sections, items })
  live.current = { sections, items }

  useEffect(() => {
    setState({ kind: 'analysing' })
    let active = true
    void (async () => {
      let next: State
      try {
        const ctx = buildContext(sections, items, currentId, Date.now())
        const wire = await voice.analyse(audio, ctx.wire)
        const p = resolveProposal(wire, ctx, live.current.sections, live.current.items, Date.now())
        next = { kind: 'review', transcript: p.transcript, rows: p.changes.map((change) => ({ change, include: change.kind === 'newList' ? !!spaceId : change.kind !== 'existing' })) }
      } catch (e) {
        next = { kind: 'failed', message: e instanceof Error ? e.message : 'Something went wrong. Try again.' }
      }
      if (active) setState(next)
    })()
    return () => { active = false }
  }, [audio, voice, attempt])

  if (state.kind === 'analysing') {
    return (
      <Sheet onClose={onClose} label="Listening">
        <h2>Listening…</h2>
        <div class="voice-wave" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.09}s` }} />)}</div>
        <p class="sub voice-status-text">Sorting your notes into lists…</p>
        <div class="sheet-actions">
          <button class="btn text" onClick={onClose}>Cancel</button>
        </div>
      </Sheet>
    )
  }

  if (state.kind === 'failed') {
    return (
      <Sheet onClose={onClose} label="Voice note failed">
        <h2>Couldn't sort that</h2>
        <p class="sub" role="alert">{state.message}</p>
        <div class="sheet-actions">
          <button class="btn text" onClick={onClose}>Discard</button>
          <button class="btn text" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      </Sheet>
    )
  }

  const { rows, transcript } = state
  const update = (i: number, change: VoiceChange | null, include?: boolean) =>
    setState({ ...state, rows: rows.map((r, j) => (j === i ? { change: change ?? r.change, include: include ?? r.include } : r)) })
  const listOn = (key: string) => rows.some((r) => r.change.kind === 'newList' && r.change.key === key && r.include)
  const counts = (r: Row) => r.include && (r.change.kind !== 'add' || !('newList' in r.change.target) || listOn(r.change.target.newList))
    && (r.change.kind !== 'add' || r.change.text.trim() !== '')
  const chosen = rows.filter(counts)
  /** Only notes already on their lists: nothing to apply, the sheet just says what was heard. */
  const onlyExisting = rows.length > 0 && rows.every((r) => r.change.kind === 'existing')

  if (rows.length === 0) {
    return (
      <Sheet onClose={onClose} label="Nothing to change">
        <h2>Nothing to change</h2>
        <p class="sub">That didn't sound like a note, a list, or something done.</p>
        {transcript && <blockquote class="voice-transcript">{transcript}</blockquote>}
        <div class="sheet-actions">
          <button class="btn text" onClick={onClose}>Close</button>
        </div>
      </Sheet>
    )
  }

  // Existing lists in rail order, then the new ones in the order proposed.
  const groups: Group[] = [
    ...sections.filter((s) => rows.some((r) => sectionOf(r.change) === s.id)).sort(bySortKey).map((section) => ({ section, key: section.id })),
    ...rows.flatMap((r, index) => (r.change.kind === 'newList' ? [{ newList: r.change, key: r.change.key, index }] : [])),
  ]

  async function apply() {
    if (chosen.length === 0) return
    setBusy(true)
    const changes = chosen.map((r) => (r.change.kind === 'add' ? { ...r.change, text: r.change.text.trim() } : r.change))
    const result = await notes.applyVoice(changes, spaceId)
    onApplied(result, changes)
    onClose()
  }

  const editRow = editing != null ? rows[editing] : null
  const editChange = editRow?.change.kind === 'add' || editRow?.change.kind === 'schedule' ? editRow.change : null

  return (
    <Sheet onClose={onClose} label="Review voice note" scrimCloses={false}>
      <h2>{onlyExisting ? 'Already on your lists' : 'Review changes'}</h2>
      {transcript && (
        <details class="voice-heard">
          <summary>What I heard</summary>
          <blockquote class="voice-transcript">{transcript}</blockquote>
        </details>
      )}
      {groups.map((g) => {
        const isNew = 'newList' in g
        const on = !isNew || rows[g.index].include
        const tile = isNew ? g.newList : g.section
        return (
          <section key={g.key} class={on ? 'voice-group' : 'voice-group off'}>
            <div class="voice-group-head">
              <Tile section={tile} />
              <span class="voice-group-name">{tile.name}</span>
              {isNew && <span class="voice-badge">New list</span>}
              {!isNew && sharedIds.has(g.section.id) && <span class="voice-badge shared"><People /> Shared</span>}
              {isNew && (
                <button class="scan-check" aria-label={on ? 'Don\'t create this list' : 'Create this list'} aria-pressed={on}
                  disabled={!spaceId} onClick={() => update(g.index, null, !on)}>
                  {on ? <CheckCircle /> : <RadioUnchecked />}
                </button>
              )}
            </div>
            <div class="scan-lines">
              {rows.map((r, i) => (isNew ? isInNew(r.change, g.key) : sectionOf(r.change) === g.section.id) && (
                <ChangeLine key={i} row={r} disabled={!on} index={i}
                  onToggle={() => update(i, null, !r.include)}
                  onText={(text) => r.change.kind === 'add' && update(i, { ...r.change, text })}
                  onDate={() => setEditing(i)} />
              ))}
            </div>
          </section>
        )
      })}
      {onlyExisting ? (
        <div class="sheet-actions">
          <button class="btn" onClick={onClose}>Close</button>
        </div>
      ) : (
        <div class="sheet-actions">
          <button class="btn text" onClick={onClose}>Discard</button>
          <span class="grow" />
          <button class="btn" disabled={busy || chosen.length === 0} onClick={() => void apply()}>
            {chosen.length === 0 ? 'Apply' : `Apply ${chosen.length} ${chosen.length === 1 ? 'change' : 'changes'}`}
          </button>
        </div>
      )}
      {editChange && editing != null && (
        <ScheduleSheet initial={editChange} canClear={editChange.dueAt != null || editChange.repeatWeeks != null}
          onClose={() => setEditing(null)}
          onSet={(s) => update(editing, { ...editChange, dueAt: s.dueAt, repeatWeeks: s.repeatWeeks })} />
      )}
    </Sheet>
  )
}

function ChangeLine({ row, index, disabled, onToggle, onText, onDate }: {
  row: Row; index: number; disabled: boolean; onToggle: () => void; onText: (text: string) => void; onDate: () => void
}) {
  const c = row.change
  const on = (row.include || c.kind === 'existing') && !disabled
  // A dated change shows its date as a chip; an undated new note only a quiet calendar to add one.
  const label = (c.kind === 'add' || c.kind === 'schedule') ? scheduleLabel(c.dueAt, c.repeatWeeks) : null
  const date = (c.kind === 'add' || c.kind === 'schedule') && (label || c.kind === 'schedule'
    ? <button class="voice-chip date" disabled={!on} onClick={onDate}>{label ?? 'No timer'}</button>
    : <button class="tool voice-add-date" disabled={!on} aria-label="Add a timer" onClick={onDate}><DateRange /></button>)
  return (
    <div class={on ? 'scan-line voice-line' : 'scan-line voice-line off'}>
      {c.kind === 'existing' ? (
        // Nothing to keep or drop: the note is already there. A quiet mark instead of a toggle.
        <span class="scan-check voice-noop" aria-hidden="true"><span /></span>
      ) : (
        <button class="scan-check" disabled={disabled} aria-label={row.include ? 'Leave out' : 'Include'} aria-pressed={row.include} onClick={onToggle}>
          {row.include ? <CheckCircle /> : <RadioUnchecked />}
        </button>
      )}
      {c.kind === 'add' ? (
        <LineText value={c.text} label={`New note ${index + 1}`} onChange={onText} />
      ) : (
        <span class={c.kind === 'check' ? 'voice-text done' : 'voice-text'}>{c.kind !== 'newList' && displayText(c.item)}</span>
      )}
      {c.kind === 'check' && <span class="voice-chip">Done</span>}
      {c.kind === 'reset' && <span class="voice-chip">Done · next {formatDueRelative(c.dueAt, Date.now())}</span>}
      {c.kind === 'uncheck' && <span class="voice-chip">Needed again</span>}
      {c.kind === 'existing' && <span class="voice-chip">Already on the list</span>}
      {c.kind === 'activate' && <span class="voice-chip date">Not due yet · make active</span>}
      {date}
    </div>
  )
}

/** The section an existing-list change belongs to, or null for new lists and their notes. */
function sectionOf(c: VoiceChange): string | null {
  if (c.kind === 'newList') return null
  if (c.kind === 'add') return 'sectionId' in c.target ? c.target.sectionId : null
  return c.item.sectionId
}

const isInNew = (c: VoiceChange, key: string) => c.kind === 'add' && 'newList' in c.target && c.target.newList === key

/** "Fri, 4 Dec · every 2 weeks", "every week", or null when there's no timer. */
function scheduleLabel(dueAt: number | null, repeatWeeks: number | null): string | null {
  const parts: string[] = []
  if (dueAt != null) parts.push(new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(dueAt))
  if (repeatWeeks != null) parts.push(repeatWeeks === 1 ? 'every week' : `every ${repeatWeeks} weeks`)
  return parts.length ? parts.join(' · ') : null
}

/** For the snackbar: "Added 3 · ticked off 2 · 1 new list". */
export function summarize(changes: VoiceChange[]): string {
  const n = (...kinds: VoiceChange['kind'][]) => changes.filter((c) => kinds.includes(c.kind)).length
  const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
  const parts = [
    n('add') && `added ${n('add')}`,
    n('check', 'reset') && `ticked off ${n('check', 'reset')}`,
    n('uncheck') && `${n('uncheck')} back on the list`,
    n('schedule') && plural(n('schedule'), 'timer changed', 'timers changed'),
    n('activate') && `${n('activate')} made active`,
    n('newList') && plural(n('newList'), 'new list', 'new lists'),
  ].filter(Boolean) as string[]
  const text = parts.join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

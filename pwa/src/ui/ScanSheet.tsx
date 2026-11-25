import { useEffect, useState } from 'preact/hooks'
import { hasEmoji } from '../data/display.ts'
import type { Section } from '../data/model.ts'
import { cssColor, type Notes } from '../data/notes.ts'
import type { ScanRemote } from '../data/scan.ts'
import { downscaleToJpeg } from './image.ts'
import { CheckCircle, RadioUnchecked } from './icons.tsx'
import { Sheet } from './Sheet.tsx'

interface Line { text: string; include: boolean }
type State =
  | { kind: 'scanning' }
  | { kind: 'review'; lines: Line[] }
  | { kind: 'failed'; message: string }

/**
 * Android's ScanRecipeScreen as a sheet: the photo with a scan sweep while the model reads it,
 * then the lines to review (edit, untick) and the section they go to. The photo is picked
 * before the sheet opens — iOS only opens a file picker from the tap itself — so "Pick another
 * photo" hands back to the caller's picker, which reopens this with the new file.
 */
export function ScanSheet({ file, sections, initialSectionId, scanner, notes, onPickAnother, onAdded, onClose }: {
  file: File; sections: Section[]; initialSectionId: string | null; scanner: ScanRemote; notes: Notes
  onPickAnother: () => void; onAdded: (sectionId: string, count: number) => void; onClose: () => void
}) {
  const [state, setState] = useState<State>({ kind: 'scanning' })
  const [preview, setPreview] = useState<string | null>(null)
  const [targetId, setTargetId] = useState(initialSectionId ?? sections[0]?.id ?? null)
  const [busy, setBusy] = useState(false)
  const target = sections.find((s) => s.id === targetId) ?? sections[0] ?? null

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    setState({ kind: 'scanning' })
    let live = true
    void (async () => {
      let next: State
      try {
        const lines = await scanner.scan(await downscaleToJpeg(file))
        next = lines.length === 0
          ? { kind: 'failed', message: 'No ingredients detected. Try a clearer photo.' }
          : { kind: 'review', lines: lines.map((text) => ({ text, include: true })) }
      } catch (e) {
        next = { kind: 'failed', message: e instanceof Error ? e.message : 'Scan failed.' }
      }
      if (live) setState(next)
    })()
    return () => { live = false; URL.revokeObjectURL(url) }
  }, [file, scanner])

  if (state.kind === 'scanning') {
    return (
      <Sheet onClose={onClose} label="Scanning">
        <h2>Scanning…</h2>
        <div class="scan-photo">
          {preview && <img src={preview} alt="" />}
          <div class="scan-sweep" />
        </div>
        <p class="sub scan-status">Extracting ingredients…</p>
        <div class="sheet-actions">
          <button class="btn text" onClick={onClose}>Cancel</button>
        </div>
      </Sheet>
    )
  }

  if (state.kind === 'failed') {
    return (
      <Sheet onClose={onClose} label="Scan failed">
        <h2>Couldn't extract ingredients</h2>
        <p class="sub" role="alert">{state.message}</p>
        <div class="sheet-actions">
          <button class="btn text" onClick={onClose}>Cancel</button>
          <button class="btn text" onClick={onPickAnother}>Pick another photo</button>
        </div>
      </Sheet>
    )
  }

  const { lines } = state
  const chosen = lines.filter((l) => l.include && l.text.trim()).map((l) => l.text.trim())
  const update = (i: number, patch: Partial<Line>) =>
    setState({ kind: 'review', lines: lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })

  async function add() {
    if (!target || chosen.length === 0) return
    setBusy(true)
    await notes.addItems(target.id, chosen)
    onAdded(target.id, chosen.length)
    onClose()
  }

  return (
    <Sheet onClose={onClose} label="Review ingredients" scrimCloses={false}>
      <div style={{ '--accent': target ? cssColor(target.color) : undefined }}>
        <h2>Review ingredients</h2>
        <div class="label">Add to</div>
        <div class="scan-targets">
          {sections.map((s) => (
            <button key={s.id} class={s.id === target?.id ? 'scan-target on' : 'scan-target'}
              style={{ '--section': cssColor(s.color) }} onClick={() => setTargetId(s.id)}>
              {hasEmoji(s) ? `${s.emoji} ${s.name}` : s.name}
            </button>
          ))}
        </div>
        <div class="label">Ingredients</div>
        <div class="scan-lines">
          {lines.map((l, i) => (
            <div key={i} class={l.include ? 'scan-line' : 'scan-line off'}>
              <button class="scan-check" aria-label={l.include ? 'Leave out' : 'Include'} aria-pressed={l.include}
                onClick={() => update(i, { include: !l.include })}>
                {l.include ? <CheckCircle /> : <RadioUnchecked />}
              </button>
              <LineText value={l.text} label={`Ingredient ${i + 1}`} onChange={(text) => update(i, { text })} />
            </div>
          ))}
        </div>
        <div class="sheet-actions">
          <button class="btn text" onClick={onClose}>Cancel</button>
          <span class="grow" />
          <button class="btn" disabled={busy || !target || chosen.length === 0} onClick={() => void add()}>
            {chosen.length === 0 ? 'Add' : `Add ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'}`}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

/**
 * One ingredient as a one-row textarea that grows with its text, so a long line wraps instead of
 * being cut off. The height comes from CSS, not from measuring: an invisible copy of the text in
 * the same grid cell (`.scan-grow::after`) sizes the row. That follows width changes (rotation),
 * and the field never collapses to measure, which made a scrolled sheet jump while typing. Still
 * one line of data: Enter means done (unless it confirms an IME composition), pasted newlines
 * become spaces.
 */
function LineText({ value, label, onChange }: { value: string; label: string; onChange: (text: string) => void }) {
  return (
    <div class="scan-grow" data-value={value}>
      <textarea class="scan-text" rows={1} value={value} aria-label={label} autocomplete="off" enterkeyhint="done"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); e.currentTarget.blur() }
        }}
        onInput={(e) => onChange(e.currentTarget.value.replace(/\s*\n\s*/g, ' '))} />
    </div>
  )
}

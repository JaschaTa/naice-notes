/**
 * One line of a review list (a scanned ingredient, a note from a voice memo) as a one-row
 * textarea that grows with its text, so a long line wraps instead of being cut off. The height comes from CSS, not from measuring: an invisible copy of the text in
 * the same grid cell (`.scan-grow::after`) sizes the row. That follows width changes (rotation),
 * and the field never collapses to measure, which made a scrolled sheet jump while typing. Still
 * one line of data: Enter means done (unless it confirms an IME composition), pasted newlines
 * become spaces.
 */
export function LineText({ value, label, onChange }: { value: string; label: string; onChange: (text: string) => void }) {
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

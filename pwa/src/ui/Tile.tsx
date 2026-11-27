import { glyph, hasEmoji } from '../data/display.ts'
import type { Section } from '../data/model.ts'
import { People } from './icons.tsx'

/**
 * A section's tile: the emoji, or the first letter in coral, on a ~22% wash of the brand coral. One
 * look for both (Android still pairs a letter with white on solid, in each section's own colour).
 */
export function Tile({ section, active, shared, class: extra = '' }: {
  section: Pick<Section, 'name' | 'emoji'>; active?: boolean; shared?: boolean; class?: string
}) {
  const emoji = hasEmoji(section)
  return (
    <span class={`tile ${emoji ? '' : 'letter'} ${active ? 'active' : ''} ${extra}`}>
      {glyph(section)}
      {shared && <span class="tile-shared"><People /></span>}
    </span>
  )
}

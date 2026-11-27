// Every local change the UI can make. Each one writes to the store (marking the row dirty) and
// then asks for a sync; nothing here talks to the network directly, so it all works offline.
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import { bySortKey, type Item, type Section } from './model.ts'
import { nextDueAt } from './schedule.ts'
import type { Store } from './store.ts'
import type { VoiceChange } from './voice.ts'

/** The brand coral as a signed ARGB int, the way Kotlin's toArgb() stores it. The web app has no
 *  per-section colours any more and ignores the column, but it is synced and Android still paints
 *  with it, so new sections are written in the brand colour. */
export const BRAND_COLOR = 0xfff0806a | 0

export class Notes {
  private store: Store
  private requestSync: () => void
  constructor(store: Store, requestSync: () => void = () => {}) {
    this.store = store
    this.requestSync = requestSync
  }

  // ── Reads ──

  async sections(): Promise<Section[]> {
    return (await this.store.all('sections')).filter((s) => !s.deletedAt).sort(bySortKey)
  }

  async items(sectionId: string): Promise<Item[]> {
    return (await this.store.itemsInSection(sectionId)).filter((i) => !i.deletedAt).sort(bySortKey)
  }

  // ── Sections ──

  async addSection(spaceId: string, name: string, emoji: string | null = null, color?: number): Promise<Section> {
    const existing = await this.sections()
    const last = existing[existing.length - 1]
    const section = newSection(spaceId, name, emoji, generateKeyBetween(last?.sortKey ?? null, null), color)
    await this.store.write('sections', section)
    this.requestSync()
    return section
  }

  async updateSection(id: string, patch: Partial<Pick<Section, 'name' | 'emoji'>>): Promise<void> {
    const s = await this.store.get('sections', id)
    if (!s) return
    await this.store.write('sections', { ...s, ...patch })
    this.requestSync()
  }

  /** The server tombstones the section's items itself; locally they just disappear with it. */
  async deleteSection(id: string): Promise<void> {
    const s = await this.store.get('sections', id)
    if (!s) return
    await this.store.write('sections', { ...s, deletedAt: new Date().toISOString() })
    for (const item of await this.store.itemsInSection(id)) await this.store.discard('items', item.id)
    this.requestSync()
  }

  // ── Items ──

  /** New notes land at the top, as on Android. */
  async addItem(sectionId: string, text: string, schedule: { dueAt?: number | null; repeatWeeks?: number | null } = {}): Promise<Item> {
    const first = (await this.items(sectionId))[0]
    const item = newItem(sectionId, text, generateKeyBetween(null, first?.sortKey ?? null), Date.now(), schedule)
    await this.store.write('items', item)
    this.requestSync()
    return item
  }

  /**
   * Several notes at once (a scanned recipe), on top and in the given order — Android's
   * bulkAddItems. One write and one sync, so the list can't show up half-added.
   */
  async addItems(sectionId: string, texts: string[]): Promise<Item[]> {
    if (texts.length === 0) return []
    const first = (await this.items(sectionId))[0]
    const keys = generateNKeysBetween(null, first?.sortKey ?? null, texts.length)
    const now = Date.now()
    const items = texts.map((text, i) => newItem(sectionId, text, keys[i], now))
    await this.store.writeAll(items.map((row) => ({ table: 'items' as const, row })))
    this.requestSync()
    return items
  }

  async updateItem(id: string, patch: Partial<Pick<Item, 'text' | 'isChecked' | 'dueAt' | 'repeatWeeks'>>): Promise<void> {
    const item = await this.store.get('items', id)
    if (!item) return
    const next = { ...item, ...patch }
    if (patch.text !== undefined) {
      // A changed URL needs a new preview; Android fetches it on its next pass.
      next.linkUrl = findUrl(patch.text)
      if (next.linkUrl !== item.linkUrl) Object.assign(next, { linkTitle: null, linkImageUrl: null, linkFetchFailed: false })
    }
    await this.store.write('items', next)
    this.requestSync()
  }

  toggleItem(item: Item) { return this.updateItem(item.id, { isChecked: !item.isChecked }) }

  async deleteItem(id: string): Promise<Item | undefined> {
    const item = await this.store.get('items', id)
    if (!item) return
    await this.store.write('items', { ...item, deletedAt: new Date().toISOString() })
    this.requestSync()
    return item
  }

  /** Undo for deleteItem: same id, so the server revives its tombstone instead of duplicating. */
  async restoreItem(item: Item): Promise<void> {
    await this.store.write('items', { ...item, deletedAt: null })
    this.requestSync()
  }

  /**
   * Moves an item so it sits between two neighbours in the rendered list (either may be null
   * for the ends). Only the moved row is written — that's the point of fractional keys.
   */
  async moveItem(id: string, before: Item | null, after: Item | null): Promise<void> {
    const item = await this.store.get('items', id)
    if (!item) return
    await this.store.write('items', { ...item, sortKey: keyBetween(before?.sortKey ?? null, after?.sortKey ?? null) })
    this.requestSync()
  }

  // ── Voice notes ──

  /**
   * Applies the changes the user kept from a voice proposal in one write and one sync, so the
   * lists never show half of it. New lists go into `spaceId` (the personal space) after the
   * others; new notes go on top of their list in the proposal's order. Notes are patched from
   * their current row, not the proposal's copy, so an edit made meanwhile survives.
   */
  async applyVoice(changes: VoiceChange[], spaceId: string | null): Promise<VoiceResult> {
    const rows: { table: 'sections' | 'items'; row: Section | Item }[] = []
    const result: VoiceResult = { sectionIds: [], itemIds: [], before: [] }
    const now = Date.now()

    const newLists = spaceId ? changes.filter((c) => c.kind === 'newList') : []
    const sections = await this.sections()
    const sectionKeys = generateNKeysBetween(sections[sections.length - 1]?.sortKey ?? null, null, newLists.length)
    const created = new Map<string, string>()
    newLists.forEach((c, i) => {
      const section = newSection(spaceId!, c.name, c.emoji, sectionKeys[i], c.color)
      created.set(c.key, section.id)
      result.sectionIds.push(section.id)
      rows.push({ table: 'sections', row: section })
    })

    const adds = new Map<string, Extract<VoiceChange, { kind: 'add' }>[]>()
    for (const c of changes) {
      if (c.kind !== 'add') continue
      const sectionId = 'sectionId' in c.target ? c.target.sectionId : created.get(c.target.newList)
      if (sectionId) adds.set(sectionId, [...(adds.get(sectionId) ?? []), c])
    }
    for (const [sectionId, list] of adds) {
      const first = created.has(sectionId) ? undefined : (await this.items(sectionId))[0]
      const keys = generateNKeysBetween(null, first?.sortKey ?? null, list.length)
      list.forEach((c, i) => {
        const item = newItem(sectionId, c.text, keys[i], now, c)
        result.itemIds.push(item.id)
        rows.push({ table: 'items', row: item })
      })
    }

    const patches = new Map<string, Partial<Item>>()
    const patch = (id: string, p: Partial<Item>) => patches.set(id, { ...patches.get(id), ...p })
    for (const c of changes) {
      if (c.kind === 'check') patch(c.item.id, { isChecked: true })
      else if (c.kind === 'uncheck') patch(c.item.id, { isChecked: false })
      else if (c.kind === 'reset') patch(c.item.id, { dueAt: c.dueAt })
      else if (c.kind === 'schedule') patch(c.item.id, { dueAt: c.dueAt, repeatWeeks: c.repeatWeeks })
    }
    for (const [id, p] of patches) {
      const current = await this.store.get('items', id)
      if (!current || current.deletedAt) continue
      result.before.push(current)
      rows.push({ table: 'items', row: { ...current, ...p } })
    }

    if (rows.length === 0) return result
    await this.store.writeAll(rows)
    this.requestSync()
    return result
  }

  /**
   * Undo for applyVoice: the new notes and lists go, and every touched note gets back its
   * checked state and timer (only those, so an edit made in between stays).
   */
  async undoVoice(result: VoiceResult): Promise<void> {
    const at = new Date().toISOString()
    const rows: { table: 'sections' | 'items'; row: Section | Item }[] = []
    const createdSections = new Set(result.sectionIds)
    for (const id of result.itemIds) {
      const item = await this.store.get('items', id)
      if (item && !item.deletedAt && !createdSections.has(item.sectionId)) rows.push({ table: 'items', row: { ...item, deletedAt: at } })
    }
    for (const before of result.before) {
      const item = await this.store.get('items', before.id)
      if (item) rows.push({ table: 'items', row: { ...item, isChecked: before.isChecked, dueAt: before.dueAt, repeatWeeks: before.repeatWeeks } })
    }
    for (const id of result.sectionIds) {
      const section = await this.store.get('sections', id)
      if (section && !section.deletedAt) rows.push({ table: 'sections', row: { ...section, deletedAt: at } })
    }
    if (rows.length === 0) return
    await this.store.writeAll(rows)
    // As in deleteSection: the server tombstones a deleted section's notes itself.
    for (const id of result.sectionIds) for (const item of await this.store.itemsInSection(id)) await this.store.discard('items', item.id)
    this.requestSync()
  }

  // ── Schedules (the tooltip's single actions and the timer sheet) ──

  async setSchedule(id: string, dueAt: number | null, repeatWeeks: number | null): Promise<void> {
    await this.updateItem(id, { dueAt, repeatWeeks })
  }

  /**
   * "Make active now": due from `now`, repeat kept. Pass the screen's clock (see useNow) — a
   * fresher Date.now() lands after it, and the note would still count as waiting.
   */
  makeActiveNow(item: Item, now: number) { return this.setSchedule(item.id, now, item.repeatWeeks) }

  /** "Remove due": drops the date and any repeat. */
  removeDue(item: Item) { return this.setSchedule(item.id, null, null) }

  /** "Reset timer": restarts a repeating note's cycle from now. Ticking it off never does this. */
  async resetTimer(item: Item, now: number): Promise<void> {
    if (item.repeatWeeks == null) return
    await this.setSchedule(item.id, nextDueAt(now, item.repeatWeeks), item.repeatWeeks)
  }

  // ── Bulk ──

  /** Tombstones every checked note in a section (waiting ones included — they're stored). */
  async clearChecked(sectionId: string): Promise<void> {
    await this.tombstoneWhere(sectionId, (i) => i.isChecked)
  }

  async clearAll(sectionId: string): Promise<void> {
    await this.tombstoneWhere(sectionId, () => true)
  }

  private async tombstoneWhere(sectionId: string, pick: (i: Item) => boolean): Promise<void> {
    const at = new Date().toISOString()
    const rows = (await this.items(sectionId)).filter(pick).map((i) => ({ table: 'items' as const, row: { ...i, deletedAt: at } }))
    if (rows.length === 0) return
    await this.store.writeAll(rows)
    this.requestSync()
  }

  /** Rail reorder: like moveItem, only the moved section is written. */
  async moveSection(id: string, before: Section | null, after: Section | null): Promise<void> {
    const s = await this.store.get('sections', id)
    if (!s) return
    await this.store.write('sections', { ...s, sortKey: keyBetween(before?.sortKey ?? null, after?.sortKey ?? null) })
    this.requestSync()
  }

  /** To another section in the same space, at its top. */
  async moveItemToSection(id: string, sectionId: string): Promise<void> {
    const item = await this.store.get('items', id)
    if (!item || item.sectionId === sectionId) return
    const first = (await this.items(sectionId))[0]
    await this.store.write('items', { ...item, sectionId, sortKey: generateKeyBetween(null, first?.sortKey ?? null) })
    this.requestSync()
  }
}

/** What applyVoice did, for undoVoice: the rows it created and the notes it changed, as they were. */
export interface VoiceResult { sectionIds: string[]; itemIds: string[]; before: Item[] }

function newSection(spaceId: string, name: string, emoji: string | null, sortKey: string, color?: number): Section {
  return {
    id: crypto.randomUUID(), spaceId, name, emoji,
    color: color ?? BRAND_COLOR,
    sortKey, createdAt: Date.now(), deletedAt: null, rev: null, dirty: 1, version: 0,
  }
}

function newItem(sectionId: string, text: string, sortKey: string, createdAt: number,
  schedule: { dueAt?: number | null; repeatWeeks?: number | null } = {}): Item {
  return {
    id: crypto.randomUUID(), sectionId, text, isChecked: false, sortKey, createdAt, createdBy: null,
    linkUrl: findUrl(text), linkTitle: null, linkImageUrl: null, linkFetchFailed: false,
    dueAt: schedule.dueAt ?? null, repeatWeeks: schedule.repeatWeeks ?? null,
    deletedAt: null, rev: null, dirty: 1, version: 0,
  }
}

/**
 * generateKeyBetween throws if a >= b, which two devices inserting at the same spot can produce
 * (equal keys). Fall back to placing it just after `a`; the id tie-break keeps order stable.
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) return generateKeyBetween(a, null)
  return generateKeyBetween(a, b)
}

const URL_RE = /https?:\/\/[^\s<>"']+/i

/**
 * Port of Android's LinkDetector.findUrl — keep the two identical, or the same note gets a link
 * card on one device and plain text on the other. Trailing punctuation is sentence punctuation.
 */
export function findUrl(text: string): string | null {
  const url = text.match(URL_RE)?.[0]?.replace(/[.,;:!?)\]}"']+$/, '')
  return url && url.length > 'https://'.length ? url : null
}

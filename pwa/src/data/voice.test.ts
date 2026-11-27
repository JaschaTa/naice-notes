import 'fake-indexeddb/auto'
import { generateNKeysBetween } from 'fractional-indexing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item, Section } from './model.ts'
import { Notes } from './notes.ts'
import { nextDueAt, startOfDayIn, toDateInputValue } from './schedule.ts'
import { Store } from './store.ts'
import { audioFormat, buildContext, resolveProposal, type VoiceChange, type WireProposal } from './voice.ts'

const NOW = new Date(2026, 10, 27, 15, 30).getTime() // Friday 27 Nov 2026, local
const keys = generateNKeysBetween(null, null, 5)

const section = (name: string, sortKey: string, extra: Partial<Section> = {}): Section => ({
  id: crypto.randomUUID(), spaceId: 'me', name, emoji: null, color: 0, sortKey, createdAt: 1, deletedAt: null,
  rev: null, dirty: 0, version: 0, ...extra,
})
const item = (sectionId: string, text: string, sortKey: string, extra: Partial<Item> = {}): Item => ({
  id: crypto.randomUUID(), sectionId, text, isChecked: false, sortKey, createdAt: 1, createdBy: null,
  linkUrl: null, linkTitle: null, linkImageUrl: null, linkFetchFailed: false, dueAt: null, repeatWeeks: null,
  deletedAt: null, rev: null, dirty: 0, version: 0, ...extra,
})
const wire = (p: Partial<WireProposal>): WireProposal => ({ transcript: 't', newLists: [], add: [], check: [], uncheck: [], existing: [], schedule: [], ...p })

function fixture() {
  const shop = section('Einkauf', keys[0], { emoji: '🛒' })
  const todo = section('To-do', keys[1])
  const gone = section('Old', keys[2], { deletedAt: '2026-01-01T00:00:00Z' })
  const bread = item(shop.id, 'Brot', keys[1])
  const milk = item(shop.id, 'Milch', keys[0], { isChecked: true })
  const link = item(shop.id, 'https://example.com/x', keys[2], { linkUrl: 'https://example.com/x', linkTitle: 'Mozzarella 125 g' })
  const sheets = item(todo.id, 'Bettwäsche', keys[0], { dueAt: startOfDayIn(NOW, 3), repeatWeeks: 2 })
  const dead = item(todo.id, 'deleted', keys[1], { deletedAt: '2026-01-01T00:00:00Z' })
  return { shop, todo, gone, bread, milk, link, sheets, dead, sections: [todo, gone, shop], items: [bread, milk, link, sheets, dead] }
}

describe('buildContext', () => {
  it('sends lists and notes in screen order under short refs, with state and dates', () => {
    const f = fixture()
    const ctx = buildContext(f.sections, f.items, f.todo.id, NOW)
    expect(ctx.wire).toEqual({
      today: '2026-11-27', weekday: 'Friday', current: 's2',
      lists: [
        { ref: 's1', name: 'Einkauf', emoji: '🛒', items: [
          { ref: 'i1', text: 'Milch', checked: true, due: null, repeatWeeks: null },
          { ref: 'i2', text: 'Brot', checked: false, due: null, repeatWeeks: null },
          { ref: 'i3', text: 'Mozzarella 125 g', checked: false, due: null, repeatWeeks: null },
        ] },
        { ref: 's2', name: 'To-do', emoji: null, items: [
          { ref: 'i4', text: 'Bettwäsche', checked: false, due: toDateInputValue(startOfDayIn(NOW, 3)), repeatWeeks: 2 },
        ] },
      ],
    })
    expect([ctx.refs.get('s1'), ctx.refs.get('i2'), ctx.refs.get('i4')]).toEqual([f.shop.id, f.bread.id, f.sheets.id])
  })
})

describe('resolveProposal', () => {
  it('maps refs back to rows and drops what no longer applies', () => {
    const f = fixture()
    const ctx = buildContext(f.sections, f.items, null, NOW)
    // Meanwhile: To-do was deleted on another device, and Brot ticked off.
    const sections = [{ ...f.todo, deletedAt: 'x' }, f.shop]
    const items = f.items.map((i) => (i.id === f.bread.id ? { ...i, isChecked: true } : i))
    const p = resolveProposal(wire({
      newLists: [{ ref: 'n1', name: ' Urlaub ', emoji: '🏖️' }],
      add: [
        { list: 's1', text: 'Eier', due: null, repeatWeeks: null },
        { list: 's2', text: 'Mama anrufen', due: '2026-12-04', repeatWeeks: null },
        { list: 'n1', text: 'Pass', due: null, repeatWeeks: null },
        { list: 's9', text: 'nowhere', due: null, repeatWeeks: null },
      ],
      check: ['i2', 'i99'],
      uncheck: ['i1'],
    }), ctx, sections, items, NOW)
    expect(p.changes).toEqual([
      { kind: 'newList', key: 'n1', name: 'Urlaub', emoji: '🏖️', color: expect.any(Number) },
      { kind: 'add', target: { sectionId: f.shop.id }, text: 'Eier', dueAt: null, repeatWeeks: null },
      { kind: 'add', target: { newList: 'n1' }, text: 'Pass', dueAt: null, repeatWeeks: null },
      { kind: 'uncheck', item: f.milk },
    ])
  })

  it('turns dates into local midnights, and a repeat without a date into due today', () => {
    const f = fixture()
    const ctx = buildContext(f.sections, f.items, null, NOW)
    const p = resolveProposal(wire({
      add: [
        { list: 's1', text: 'a', due: '2026-12-04', repeatWeeks: null },
        { list: 's1', text: 'b', due: null, repeatWeeks: 3 },
        { list: 's1', text: 'c', due: 'Friday', repeatWeeks: 99 },
      ],
    }), ctx, f.sections, f.items, NOW)
    expect(p.changes.map((c) => c.kind === 'add' && [c.dueAt, c.repeatWeeks])).toEqual([
      [new Date(2026, 11, 4).getTime(), null], [startOfDayIn(NOW, 0), 3], [null, null],
    ])
  })

  it('"done" on a repeating note restarts its cycle instead of ticking it off', () => {
    const f = fixture()
    const ctx = buildContext(f.sections, f.items, null, NOW)
    const p = resolveProposal(wire({ check: ['i4'], schedule: [{ item: 'i4', due: '2026-12-24', repeatWeeks: 2 }] }), ctx, f.sections, f.items, NOW)
    expect(p.changes).toEqual([{ kind: 'reset', item: f.sheets, dueAt: nextDueAt(NOW, 2) }])
  })

  it('shows notes that are already there, and makes a waiting one active now', () => {
    const f = fixture()
    const ctx = buildContext(f.sections, f.items, null, NOW)
    // i2 Brot is open; i4 Bettwäsche is waiting (due in 3 days); i1 Milch is ticked off.
    const p = resolveProposal(wire({ existing: ['i2', 'i4', 'i1', 'i99'] }), ctx, f.sections, f.items, NOW)
    expect(p.changes).toEqual([{ kind: 'existing', item: f.bread }, { kind: 'activate', item: f.sheets, dueAt: NOW }])
  })

  it('keeps a real schedule change and drops one that changes nothing', () => {
    const f = fixture()
    const ctx = buildContext(f.sections, f.items, null, NOW)
    const same = toDateInputValue(f.sheets.dueAt!)
    expect(resolveProposal(wire({ schedule: [{ item: 'i4', due: same, repeatWeeks: 2 }] }), ctx, f.sections, f.items, NOW).changes).toEqual([])
    expect(resolveProposal(wire({ schedule: [{ item: 'i2', due: '2026-12-31', repeatWeeks: null }] }), ctx, f.sections, f.items, NOW).changes)
      .toEqual([{ kind: 'schedule', item: f.bread, dueAt: new Date(2026, 11, 31).getTime(), repeatWeeks: null }])
  })
})

describe('applyVoice', () => {
  let store: Store
  let notes: Notes
  let syncs: number
  beforeEach(async () => {
    store = await Store.open(`voice-${crypto.randomUUID()}`)
    syncs = 0
    notes = new Notes(store, () => { syncs++ })
  })

  async function seed() {
    const f = fixture()
    await store.writeAll([f.shop, f.todo].map((row) => ({ table: 'sections' as const, row })))
    await store.writeAll([f.bread, f.milk, f.sheets].map((row) => ({ table: 'items' as const, row })))
    return f
  }

  it('writes every change in one batch: new list last in the rail, new notes on top in order', async () => {
    const f = await seed()
    const writeAll = vi.spyOn(store, 'writeAll')
    const changes: VoiceChange[] = [
      { kind: 'newList', key: 'n1', name: 'Urlaub', emoji: '🏖️', color: 7 },
      { kind: 'add', target: { sectionId: f.shop.id }, text: 'Eier', dueAt: null, repeatWeeks: null },
      { kind: 'add', target: { sectionId: f.shop.id }, text: 'Hafer', dueAt: null, repeatWeeks: null },
      { kind: 'add', target: { newList: 'n1' }, text: 'Pass', dueAt: 123, repeatWeeks: 2 },
      { kind: 'check', item: f.bread },
      { kind: 'uncheck', item: f.milk },
      { kind: 'reset', item: f.sheets, dueAt: 456 },
    ]
    const result = await notes.applyVoice(changes, 'me')
    expect(writeAll).toHaveBeenCalledTimes(1)
    expect(syncs).toBe(1)

    const sections = await notes.sections()
    expect(sections.map((s) => s.name)).toEqual(['Einkauf', 'To-do', 'Urlaub'])
    expect(sections[2]).toMatchObject({ spaceId: 'me', emoji: '🏖️', color: 7, dirty: 1 })
    expect((await notes.items(f.shop.id)).map((i) => `${i.text}${i.isChecked ? ' ✓' : ''}`)).toEqual(['Eier', 'Hafer', 'Milch', 'Brot ✓'])
    expect(await notes.items(sections[2].id)).toMatchObject([{ text: 'Pass', dueAt: 123, repeatWeeks: 2 }])
    expect(await store.get('items', f.sheets.id)).toMatchObject({ dueAt: 456, repeatWeeks: 2, isChecked: false })
    expect(result.itemIds).toHaveLength(3)
    expect(result.sectionIds).toEqual([sections[2].id])
  })

  it('makes a waiting note active and leaves an existing one alone; undo puts the date back', async () => {
    const f = await seed()
    const result = await notes.applyVoice([
      { kind: 'activate', item: f.sheets, dueAt: NOW },
      { kind: 'existing', item: f.bread },
    ], 'me')
    expect(result.before.map((i) => i.id)).toEqual([f.sheets.id])
    expect(await store.get('items', f.sheets.id)).toMatchObject({ dueAt: NOW, repeatWeeks: 2 })
    await notes.undoVoice(result)
    expect((await store.get('items', f.sheets.id))?.dueAt).toBe(f.sheets.dueAt)
  })

  it('skips new lists without a space to put them in, and notes deleted meanwhile', async () => {
    const f = await seed()
    await notes.deleteItem(f.bread.id)
    await notes.applyVoice([
      { kind: 'newList', key: 'n1', name: 'Urlaub', emoji: null, color: 7 },
      { kind: 'add', target: { newList: 'n1' }, text: 'Pass', dueAt: null, repeatWeeks: null },
      { kind: 'check', item: f.bread },
    ], null)
    expect((await notes.sections()).map((s) => s.name)).toEqual(['Einkauf', 'To-do'])
    expect((await store.get('items', f.bread.id))?.isChecked).toBe(false)
  })

  it('undo removes what it added and puts back state and timers, keeping edits made since', async () => {
    const f = await seed()
    const result = await notes.applyVoice([
      { kind: 'newList', key: 'n1', name: 'Urlaub', emoji: null, color: 7 },
      { kind: 'add', target: { newList: 'n1' }, text: 'Pass', dueAt: null, repeatWeeks: null },
      { kind: 'add', target: { sectionId: f.shop.id }, text: 'Eier', dueAt: null, repeatWeeks: null },
      { kind: 'check', item: f.bread },
      { kind: 'schedule', item: f.sheets, dueAt: null, repeatWeeks: null },
    ], 'me')
    await notes.updateItem(f.bread.id, { text: 'Vollkornbrot' })

    await notes.undoVoice(result)
    expect((await notes.sections()).map((s) => s.name)).toEqual(['Einkauf', 'To-do'])
    expect((await notes.items(f.shop.id)).map((i) => `${i.text}${i.isChecked ? ' ✓' : ''}`)).toEqual(['Milch ✓', 'Vollkornbrot'])
    expect(await store.get('items', f.sheets.id)).toMatchObject({ dueAt: f.sheets.dueAt, repeatWeeks: 2 })
  })
})

it('maps MediaRecorder types to the function\'s format names', () => {
  expect(['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg; codecs=opus', 'audio/wav', 'video/mp4', ''].map(audioFormat))
    .toEqual(['m4a', 'webm', 'ogg', 'wav', null, null])
})

// deno test supabase/functions/  (run by `cd supabase/test && npm test`)
import { parseRequest, renderContext, sanitizeProposal, validDate, validWeeks, type VoiceRequest } from './core.ts'

function eq(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`expected ${e}\n     got ${a}`)
}

const body = () => ({
  audio: 'AAAA', format: 'm4a', today: '2026-11-27', weekday: 'Friday', current: 's2',
  lists: [
    { ref: 's1', name: 'Einkauf', emoji: '🛒', items: [
      { ref: 'i1', text: 'Brot', checked: false }, { ref: 'i2', text: 'Milch', checked: true },
    ] },
    { ref: 's2', name: 'To-do', emoji: null, items: [
      { ref: 'i3', text: 'Versicherung', checked: false, due: '2026-12-01', repeatWeeks: 2 },
    ] },
  ],
})
const req = () => parseRequest(body()) as VoiceRequest
const propose = (p: Record<string, unknown>) => sanitizeProposal(JSON.stringify({
  transcript: 't', newLists: [], add: [], check: [], uncheck: [], schedule: [], ...p,
}), req())!

Deno.test('dates and repeats', () => {
  eq([validDate('2026-02-28'), validDate('2026-02-30'), validDate('2026-13-01'), validDate('27.11.2026'), validDate(null)],
    ['2026-02-28', null, null, null, null])
  eq([validWeeks(1), validWeeks(52), validWeeks(0), validWeeks(53), validWeeks(1.5), validWeeks('2')], [1, 52, null, null, null, null])
})

Deno.test('parseRequest refuses what it can not use', () => {
  eq(parseRequest({ ...body(), audio: 'not base64!' }), 'audio (base64) is required')
  eq(parseRequest({ ...body(), format: 'exe' }), 'unsupported audio format')
  eq(parseRequest({ ...body(), today: 'tomorrow' }), 'today (YYYY-MM-DD) is required')
  eq(parseRequest({ ...body(), lists: [{ ref: 'x1', name: 'a', items: [] }] }), 'bad list')
  const dup = body(); dup.lists[1].items[0].ref = 'i1'
  eq(parseRequest(dup), 'bad item')
  const many = body(); many.lists[0].items = Array.from({ length: 3001 }, (_, i) => ({ ref: `i${i + 10}`, text: 'x', checked: false }))
  eq(parseRequest(many), 'too many notes')
})

Deno.test('parseRequest strips a data URL prefix and flattens text', () => {
  const b = body(); b.audio = 'data:audio/webm;codecs=opus;base64,AAAA'; b.lists[0].items[0].text = 'two\nlines'
  const r = parseRequest(b) as VoiceRequest
  eq([r.audio, r.lists[0].items[0].text], ['AAAA', 'two lines'])
})

Deno.test('context is compact text with state, dates and the open list', () => {
  eq(renderContext(req()).split('\n'), [
    'Today: Friday 2026-11-27', '', '<lists>',
    '[s1] 🛒 Einkauf', '  i1 [ ] Brot', '  i2 [x] Milch',
    '[s2] To-do (open on screen)', '  i3 [ ] Versicherung · due 2026-12-01 · every 2 weeks',
    '</lists>',
  ])
})

Deno.test('unknown refs are dropped, new lists can take notes', () => {
  const p = propose({
    newLists: [{ ref: 'n1', name: 'Urlaub', emoji: '🏖️' }, { ref: 's9', name: 'bad ref', emoji: null }],
    add: [
      { list: 's1', text: 'Eier', due: null, repeatWeeks: null },
      { list: 'n1', text: 'Pass', due: '2026-12-24', repeatWeeks: null },
      { list: 's7', text: 'nowhere', due: null, repeatWeeks: null },
      { list: 's1', text: '  ', due: null, repeatWeeks: null },
    ],
    check: ['i1', 'i99'], uncheck: ['i2', 'i42'], schedule: [{ item: 'i77', due: '2026-12-01', repeatWeeks: null }],
  })
  eq(p.newLists, [{ ref: 'n1', name: 'Urlaub', emoji: '🏖️' }])
  eq(p.add.map((a) => `${a.list}:${a.text}:${a.due}`), ['s1:Eier:null', 'n1:Pass:2026-12-24'])
  eq([p.check, p.uncheck, p.schedule], [['i1'], ['i2'], []])
})

Deno.test('ticking off a ticked note or unticking an open one is a no-op', () => {
  const p = propose({ check: ['i2'], uncheck: ['i1'] })
  eq([p.check, p.uncheck], [[], []])
})

Deno.test('an add that already exists in its list is never a duplicate', () => {
  const p = propose({ add: [
    { list: 's1', text: 'brot', due: null, repeatWeeks: null }, // open: nothing to do
    { list: 's1', text: 'Milch', due: null, repeatWeeks: null }, // ticked off: untick instead
    { list: 's2', text: 'Milch', due: null, repeatWeeks: null }, // other list: a real add
    { list: 's2', text: 'MILCH', due: null, repeatWeeks: null }, // twice in one proposal
  ] })
  eq(p.add.map((a) => `${a.list}:${a.text}`), ['s2:Milch'])
  eq(p.uncheck, ['i2'])
})

Deno.test('bad dates and repeats are dropped, unchanged schedules too', () => {
  const p = propose({
    add: [{ list: 's1', text: 'Eier', due: '2026-02-31', repeatWeeks: 0 }],
    schedule: [
      { item: 'i3', due: '2026-12-01', repeatWeeks: 2 }, // what it already is
      { item: 'i1', due: '2026-12-04', repeatWeeks: 99 },
    ],
  })
  eq(p.add[0], { list: 's1', text: 'Eier', due: null, repeatWeeks: null })
  eq(p.schedule, [{ item: 'i1', due: '2026-12-04', repeatWeeks: null }])
})

Deno.test('a proposed note is capped at 200 characters', () => {
  const p = propose({ add: [{ list: 's1', text: 'x'.repeat(5000), due: null, repeatWeeks: null }] })
  eq(p.add[0].text.length, 200)
})

Deno.test('a fenced answer is read, garbage is null', () => {
  eq(sanitizeProposal('```json\n{"transcript":"hi"}\n```', req())?.transcript, 'hi')
  eq(sanitizeProposal('sorry, I cannot', req()), null)
  eq(sanitizeProposal('[1,2]', req()), null)
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FIELDS, MissingLegalValues, PAGES, buildPage, fill } from './legal.ts'

const docs = join(import.meta.dirname, '../../docs/legal')
const full = Object.fromEntries(Object.values(FIELDS).map((v) => [v, `value-of-${v}`]))

describe('fill', () => {
  it('replaces every placeholder', () => {
    expect(fill('{{name}}, {{street}}, {{postcode}} {{city}}', full, true))
      .toBe('value-of-LEGAL_NAME, value-of-LEGAL_STREET, value-of-LEGAL_POSTCODE value-of-LEGAL_CITY')
  })

  it('escapes HTML in values', () => {
    expect(fill('{{name}}', { ...full, LEGAL_NAME: '<b>Ann & Co</b>' }, true)).toBe('&lt;b&gt;Ann &amp; Co&lt;/b&gt;')
  })

  it('drops a line whose only placeholder is an empty optional one', () => {
    const { LEGAL_PHONE: _, ...noPhone } = full
    expect(fill('E-Mail: {{email}}\nTelefon: {{phone}}\nEnd', noPhone, true)).toBe('E-Mail: value-of-LEGAL_EMAIL\nEnd')
  })

  it('removes a hard line break left dangling by a dropped line', () => {
    const { LEGAL_PHONE: _, ...noPhone } = full
    expect(fill('E-Mail: {{email}}\\\nTelefon: {{phone}}\n\nNext', noPhone, true)).toBe('E-Mail: value-of-LEGAL_EMAIL\n\nNext')
    expect(fill('E-Mail: {{email}}\\\nTelefon: {{phone}}', full, true)).toBe('E-Mail: value-of-LEGAL_EMAIL\\\nTelefon: value-of-LEGAL_PHONE')
  })

  it('strict: throws naming every missing variable', () => {
    const { LEGAL_STREET: _s, LEGAL_CITY: _c, ...partial } = full
    try {
      fill('{{street}} {{city}} {{name}}', partial, true)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(MissingLegalValues)
      expect((e as MissingLegalValues).variables).toEqual(['LEGAL_CITY', 'LEGAL_STREET'])
    }
  })

  it('lenient: marks missing values instead of throwing', () => {
    expect(fill('{{name}}', {}, false)).toBe('<mark class="ph">{{name}}</mark>')
  })

  it('treats a blank value as missing', () => {
    expect(() => fill('{{name}}', { ...full, LEGAL_NAME: '  ' }, true)).toThrow(MissingLegalValues)
  })
})

describe('the real texts in docs/legal', () => {
  it('use no placeholder the build does not know', () => {
    for (const page of PAGES) {
      const keys = [...readFileSync(join(docs, page.file), 'utf8').matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
      expect(keys.filter((k) => !(k in FIELDS)), page.file).toEqual([])
    }
  })

  it('render with no placeholder left once every variable is set', () => {
    for (const page of PAGES) {
      const html = buildPage(docs, page, full, true)
      expect(html).not.toMatch(/\{\{\w+\}\}/)
      expect(html).toContain(`<html lang="${page.lang}">`)
    }
  })
})

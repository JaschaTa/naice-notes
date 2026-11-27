// Builds the legal pages (/impressum/, /privacy/, /privacy/en/) from docs/legal/*.md.
//
// The repo is public, so the texts only hold placeholders like {{name}}; the real values come from
// LEGAL_* build variables (pwa/.env.local locally, Workers Builds → build variables on Cloudflare).
// A production build fails while any placeholder is left, so a missing variable keeps the current
// deploy live instead of publishing "{{street}}". Dev shows the gaps highlighted.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'
import { loadEnv, type Plugin } from 'vite'

/** Placeholder → the build variable it's filled from. */
export const FIELDS: Record<string, string> = {
  name: 'LEGAL_NAME',
  street: 'LEGAL_STREET',
  postcode: 'LEGAL_POSTCODE',
  city: 'LEGAL_CITY',
  email: 'LEGAL_EMAIL',
  phone: 'LEGAL_PHONE',
  date: 'LEGAL_DATE',
  supervisory_authority: 'LEGAL_SUPERVISORY_AUTHORITY',
}
/** May stay empty; a line whose only placeholders are empty optional ones is dropped. */
const OPTIONAL = new Set(['phone'])

export interface LegalPage { file: string; out: string; path: string; lang: 'de' | 'en'; title: string; other?: { href: string; label: string } }

export const PAGES: LegalPage[] = [
  { file: 'impressum.md', out: 'impressum/index.html', path: '/impressum/', lang: 'de', title: 'Impressum' },
  { file: 'privacy.de.md', out: 'privacy/index.html', path: '/privacy/', lang: 'de', title: 'Datenschutzerklärung', other: { href: '/privacy/en/', label: 'English version' } },
  { file: 'privacy.en.md', out: 'privacy/en/index.html', path: '/privacy/en/', lang: 'en', title: 'Privacy policy', other: { href: '/privacy/', label: 'Deutsche Fassung (verbindlich)' } },
]

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export class MissingLegalValues extends Error {
  readonly variables: string[]
  constructor(variables: string[]) {
    super(`Legal pages: set ${variables.join(', ')} (pwa/.env.local, or the Cloudflare build variables).`)
    this.variables = variables
  }
}

/**
 * Replaces {{placeholders}} with values from env. Strict: throws listing every missing variable.
 * Otherwise a missing value stays visible as a highlighted placeholder.
 */
export function fill(md: string, env: Record<string, string | undefined>, strict: boolean): string {
  const value = (key: string) => (FIELDS[key] ? env[FIELDS[key]]?.trim() : undefined) || ''
  const missing = new Set<string>()
  const kept = md.split('\n').filter((line) => {
    const keys = [...line.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
    return !(keys.length > 0 && keys.every((k) => OPTIONAL.has(k) && !value(k)))
  })
  // A hard line break (trailing backslash) that now ends its paragraph, because the line after it
  // was dropped, would print as a literal backslash.
  kept.forEach((line, i) => { if (line.endsWith('\\') && !(kept[i + 1] ?? '').trim()) kept[i] = line.slice(0, -1) })
  const out = kept.join('\n').replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    const v = value(key)
    if (v) return escapeHtml(v)
    missing.add(FIELDS[key] ?? `unknown placeholder ${whole}`)
    return `<mark class="ph">${whole}</mark>`
  })
  if (strict && missing.size) throw new MissingLegalValues([...missing].sort())
  return out
}

/** One standalone page in the landing page's look: paper, Instrument Serif headings, dark footer. */
export function renderPage(page: LegalPage, bodyHtml: string): string {
  const other = page.other ? `<p class="other"><a href="${page.other.href}" hreflang="${page.lang === 'de' ? 'en' : 'de'}">${page.other.label}</a></p>` : ''
  return `<!doctype html>
<html lang="${page.lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(page.title)} · Naice Notes</title>
<link rel="canonical" href="https://naice-notes.com${page.path}" />
<link rel="icon" type="image/png" href="/favicon.png" />
<link rel="stylesheet" href="/fonts/fonts.css" />
<style>
:root { --paper: #F4F1EC; --ink: #141414; --ink-2: #57534E; --line: #E4DED5; --dark: #131209; --coral-ink: #D4503A; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 400 16px/26px 'Manrope', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.wrap { width: min(720px, 100% - 48px); margin: 0 auto; }
header { border-bottom: 1px solid var(--line); }
header .wrap { width: min(1200px, 100% - 48px); display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; }
.brand { display: inline-flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
.brand img { width: 32px; height: 32px; border-radius: 8px; }
.brand span { font-family: 'Instrument Serif', Georgia, serif; font-size: 30px; line-height: 1; }
.home { color: var(--ink-2); font-size: 14px; text-decoration: none; }
.home:hover { color: var(--ink); }
main { padding: 64px 0 96px; }
h1 { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 60px; line-height: 1; margin: 0 0 24px; text-wrap: balance; }
h2 { font-size: 20px; line-height: 28px; font-weight: 600; margin: 40px 0 8px; }
h3 { font-size: 16px; line-height: 24px; font-weight: 600; margin: 24px 0 4px; }
p, li { color: var(--ink-2); }
strong { color: var(--ink); font-weight: 600; }
a { color: var(--coral-ink); }
hr { border: 0; height: 1px; background: var(--line); margin: 64px 0; }
.other { margin: 0 0 32px; font-size: 14px; }
mark.ph { background: #FFE9A8; color: #6B4A00; padding: 0 4px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 13px; }
footer { background: var(--dark); color: #8E897F; padding: 24px 0; font-size: 13px; }
footer .wrap { width: min(1200px, 100% - 48px); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
footer nav { display: flex; gap: 24px; flex-wrap: wrap; }
footer a { color: #D6D1C7; text-decoration: none; }
footer a:hover { color: #fff; }
a:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
footer a:focus-visible { outline-color: var(--paper); }
@media (max-width: 480px) { h1 { font-size: 48px; } }
</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="/"><img src="/icon-192.png" alt="" /><span>Naice Notes</span></a><a class="home" href="/">${page.lang === 'de' ? 'Zur Startseite' : 'Back to the start page'}</a></div></header>
<main class="wrap">
${other}
${bodyHtml}
</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Naice Notes</span><nav aria-label="Legal"><a href="/impressum/">Impressum</a><a href="/privacy/">Datenschutz</a><a href="/privacy/en/">Privacy</a></nav></div></footer>
</body>
</html>
`
}

export function buildPage(docsDir: string, page: LegalPage, env: Record<string, string | undefined>, strict: boolean): string {
  const md = fill(readFileSync(join(docsDir, page.file), 'utf8'), env, strict)
  return renderPage(page, marked.parse(md, { async: false }))
}

/** Vite plugin: serves the pages in dev and emits them into dist on build. */
export function legalPages(docsDir: string): Plugin {
  let env: Record<string, string> = {}
  let strict = false
  return {
    name: 'naice-legal-pages',
    configResolved(config) {
      env = loadEnv(config.mode, config.envDir || config.root, 'LEGAL_')
      strict = config.command === 'build' && config.mode === 'production'
    },
    buildStart() {
      // Fail before bundling, with every missing variable of every page named at once.
      if (!strict) return
      const missing = new Set<string>()
      for (const page of PAGES) {
        try { fill(readFileSync(join(docsDir, page.file), 'utf8'), env, true) } catch (e) {
          if (!(e instanceof MissingLegalValues)) throw e
          e.variables.forEach((v) => missing.add(v))
        }
      }
      if (missing.size) throw new MissingLegalValues([...missing].sort())
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        const page = PAGES.find((p) => p.path === path || p.path === `${path}/`)
        if (!page) return next()
        if (!path.endsWith('/')) { res.statusCode = 301; res.setHeader('Location', page.path); return res.end() }
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(buildPage(docsDir, page, env, false))
      })
    },
    generateBundle() {
      for (const page of PAGES) this.emitFile({ type: 'asset', fileName: page.out, source: buildPage(docsDir, page, env, strict) })
    },
  }
}

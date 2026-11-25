# Naice Notes — web app (PWA)

iPhone/web client (Vite + Preact + TypeScript), live at https://naice-notes.com via Cloudflare Workers (`wrangler.jsonc`, auto-deploys ~60s after a push to `main`). **Paths and commands below are relative to `pwa/`.** The sync contract is in `../supabase/README.md`; repo-wide rules in `../CLAUDE.md`.

```bash
npm run dev                    # http://localhost:5173 — /?demo gives a signed-in session with sample data, no login
npm test                       # vitest, TZ=Europe/Berlin so the DST case is real
npx tsc -b && npm run build    # what Cloudflare runs
```

Layout: `src/data/` is UI-free (store = IndexedDB mirror + outbox, sync engine, `notes.ts` = every local mutation, ports of `Schedule.kt`/`DateFormat.kt`/`Grapheme.kt`/`Section.glyph`/`Item.displayText` with their Android tests), `src/ui/` is the screen. The design mirrors the Android app — values were taken from `HomeScreen.kt` — but dialogs and dropdowns are iOS bottom sheets and the date picker is native.

Gotchas that cost time:

- **Gestures use touch events, not pointer events.** On iOS a vertical pointer move inside a scroller is claimed by the browser (`pointercancel`) unless every `touchmove` is cancelled, and only touch events can be. `useRowGestures.ts` also needs `-webkit-touch-callout: none` on rows, or a long press opens the system magnifier instead of starting a drag.
- **iOS doesn't resize the layout for the keyboard.** `#app` follows `visualViewport` (`ui/viewport.ts`); without it the composer sits behind the keyboard.
- **Headless Chrome's `--virtual-time-budget` stalls IndexedDB** — the page looks stuck on "Loading". Use puppeteer-core with real waits for screenshots.
- **`erasableSyntaxOnly`** is on: no constructor parameter properties (`constructor(private x)`); `tsc -b` fails while vitest still passes.
- **Never apply a realtime payload directly.** A change notification only triggers a pull; one code path decides what a row looks like.
- **Link previews can't be fetched from the browser** (CORS). Links added on the web arrive titleless; Android's `retryMissingLinkPreviews()` fills them in once Android syncs.

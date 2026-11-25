# Naice Notes — development notes

Personal notes app: an Android app sideloaded onto a Samsung Galaxy S24 (SM-S921B), an iPhone/web PWA, and a Supabase sync backend. See [README](./README.md) for what the app is and how to build it from scratch.

## Repository layout

- `android/` — the Android app (Gradle root). Its notes are in `android/CLAUDE.md`.
- `pwa/` — iPhone/web client. Its notes are in `pwa/CLAUDE.md`.
- `supabase/` — sync backend and the sync contract both clients follow.
- `docs/`, `design-mockups/` — screenshots and design explorations.

The repo was `naice-notes-apk` with the Android project at the top level until 2026-11-25; GitHub redirects the old name.

## Working rules

- Single developer, history is linear on `main`, no branches. Commit messages are short neutral summaries, not change logs.
- **The repo is public: no URL or secret may ever be committed.** Keys live in `android/local.properties` and `.env`, both gitignored.
- **New features are built and tested on the PWA first.** Android is not touched (not edited, not built) until the user has tried the PWA version. Then ask whether to bring it to the APK as well, and port only on a yes.
- **Logic shared between the clients is ported key for key, with its tests** — fractional sort keys, `Schedule`, `DateFormat`, `Grapheme`, `Section.glyph`, `Item.displayText`. Until both clients have the change, sync and display drift apart, so when a PWA-first feature changes shared logic, say so when asking about the Android port.
- **The `security-reviewer` runs automatically whenever a change touches sync, sharing, `supabase/migrations`, `supabase/functions` or secrets. `ui-reviewer` and `/code-review` never run without the user's explicit go**; see [docs/review-loop.md](./docs/review-loop.md).

## Sync and sharing

`pwa/` is the iPhone/web client (Vite + Preact + TypeScript), live at https://naice-notes.com via Cloudflare Workers (`pwa/wrangler.jsonc`, auto-deploys ~60s after a push to `main`). `supabase/` is the sync backend; its README holds the setup and the **sync contract** both clients follow. Android syncs too. Sharing is per section (⋮ → Share…): the section moves into its own shared space, owner-only delete, members can leave. Your S24 notes (minus the Claude section) were imported once into the personal space on 2026-11-11 with `pwa/scripts/import-android-snapshot.mjs`; Android's v8 migration derives the same ids, so its first sync adopts those rows.

**Recipe scan** (photo → ingredient lines → items) runs in both clients through the Edge Function `supabase/functions/scan-recipe`, which calls a vision model via OpenRouter with the user's session; nothing is stored server-side, the items are added locally and sync. Setup and the OpenRouter privacy settings are in `supabase/README.md`.

Client-side sync rules: "Android sync" in `android/CLAUDE.md`, gotchas in `pwa/CLAUDE.md`.

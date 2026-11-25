# Naice Notes

A small personal app for sectioned bullet-list note-taking, with an Android home-screen widget and a recipe-photo → ingredient extractor.

The Android app is built for Android 14+ (API 34), targeted at a Samsung S24 sideload. Notes live in Room on the phone and sync through Supabase, which also backs an iPhone/web app and per-section sharing.

## Repository layout

| Folder | What |
|---|---|
| `android/` | Android app (Kotlin, Compose) — the Gradle project |
| `pwa/` | iPhone/web client (Vite, Preact, TypeScript), deployed to Cloudflare Workers |
| `supabase/` | Sync backend and the sync contract both clients follow |
| `docs/`, `design-mockups/` | Screenshots and design explorations |

## Features

- **Sections + checkable items** — a collapsible left rail of section tiles (an emoji you pick, or the name's initial) with open-item badges, swipe to delete (with undo), drag to reorder, tap text to inline-edit, and a per-item menu for timer / move to another section / delete
- **Timed and recurring notes** — give a note a due date, a repeat interval, or both. Until it's due it waits below a divider at the bottom of its section, greyed out and counted towards nothing; once due it rejoins the list with an amber marker. Tapping its glyph shows when it's due and offers the one action that state allows — bring it forward, drop the date, or restart the cycle. Nothing runs in the background: due-ness is worked out when the list is drawn
- **Link previews** — share a URL to the app and it fetches the page's Open Graph title and image in the background, falling back to a readable label derived from the URL when a site blocks metadata fetches
- **Home-screen widget** — mirrors a chosen section, tap to toggle items, "+" for quick-add, tap the logo to open the app at that section, and the same emoji tiles to switch sections. Classic `AppWidgetProvider` + `RemoteCollectionItems` (API 31+) for atomic, flash-free updates
- **Recipe scan** — pick or take a recipe photo (Android and web), it goes to the `scan-recipe` Supabase Edge Function, which asks a vision model through OpenRouter for the ingredient lines; the app shows a review screen before appending them to a section
- **Send to Claude** — a checkbox in the composer POSTs the note to a private n8n webhook that files it as a task, and keeps a receipt in a designated section. Also backed by a webhook I'm not publishing. Note that unlike the scan button, an unconfigured build fails quietly here: the note is still filed locally and the confirmation still appears, but nothing leaves the device

## Recipe-scan backend

Both apps call the Edge Function in `supabase/functions/scan-recipe` with the signed-in user's session, so scanning needs sync configured (`SUPABASE_URL` / `SUPABASE_ANON_KEY` in `android/local.properties`, `VITE_SUPABASE_*` for the PWA). The function holds the OpenRouter key as a Supabase secret; deploying it is described in `supabase/README.md`. Signed out, the scan button says to sign in to sync; the rest of the app works either way.

| Request | Response |
|---|---|
| `POST {"image": "<base64 JPEG, longest side ≤1024 px>"}` with `Authorization: Bearer <user access token>` | `200 {"ingredients": ["200 g Mehl", "2 Eier", ...]}` |

## Building

Requires Android Studio (Hedgehog or later) and JDK 17+.

```bash
cd android
cp local.properties.example local.properties
# edit local.properties — fill in sdk.dir, and (optionally) the Supabase vars for sync and recipe scan
./gradlew :app:assembleDebug
```

The debug APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

To install over wireless ADB:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Stack

| Layer | Choice |
|---|---|
| Language | Kotlin 2.x |
| UI | Jetpack Compose, Material 3 |
| DB | Room (Flow-based observables) |
| Widget | Classic `AppWidgetProvider` + `RemoteViews` + `RemoteCollectionItems` (Glance was tried first but never refreshed on Samsung One UI) |
| Network | OkHttp + kotlinx.serialization |
| Image picker | `ActivityResultContracts.PickVisualMedia` |
| Reorder | [`sh.calvin.reorderable`](https://github.com/Calvin-LL/Reorderable) |

## License

MIT — see [LICENSE](./LICENSE).

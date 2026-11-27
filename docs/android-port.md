# Android port backlog

What the PWA has and the APK doesn't yet, to bring over in one go once the PWA versions have been
tried. Paths are under `android/app/src/main/java/com/jt/naicenotes/`. Delete an entry once it's ported.

None of these touch logic both clients share (sort keys, `Schedule`, `DateFormat`, `Grapheme`,
`Section.glyph`, `Item.displayText`), so the clients only look different until then; sync is unaffected.

## Look (PWA, 2026-11-27)

- **One colour: the brand coral.** The PWA ignores `section.color`: every tile, tick, send/mic button
  and accent is coral `#F0806A`, with `#D4503A` for coral text on light surfaces (dark mode uses
  `#F0806A` for both). New sections and voice-created lists are written with `BRAND_COLOR`
  (`0xFFF0806A`), so the synced column stays filled.
  - `ui/common/SectionDialogs.kt`: drop the "Colour" picker from `SectionDialog`.
  - `ui/util/SectionColors.kt`: `SectionColorPalette` / `randomSectionColor()` go; new sections get the brand colour.
  - `ui/home/HomeScreen.kt`: the accent stops following the section (`RailTile`, `RailToggle`, composer,
    item checks, move picker).
  - `widget/ClassicWidgetRenderer.kt`, `widget/QuickAddActivity.kt`: same, they read `section.color` too.
- **One tile look.** Emoji and letter tiles share a ~22% coral wash; the letter is coral instead of
  white on solid colour.
- **Sidebar.** `RAIL_BACKGROUND` (`HomeScreen.kt`) is no longer fixed near-black: light grey `#F4F3F6`
  in light mode, `#0E0E11` in dark, with a 1px outline-variant line on its right (like the header's
  bottom line). The active tile gets a ring with a gap (`2px rail bg, 3.5px on-surface`) and the
  indicator bar is on-surface; names are outline / on-surface when active; the "+" tile is a
  dashed outline.
- **One counter.** The rail badge shows open items in a single style, no amber variant for due:
  `#D4503A` with white text in light mode, `#F0806A` with near-black text in dark. `BADGE_COLOR`
  goes. Due items still show in the header ("· 2 due") and as amber rows.
- **Composer buttons 40dp instead of 34dp** (timer, camera, send/mic: the `size(34.dp)` calls in
  `HomeScreen.kt`), so the hold-to-record mic is a comfortable target and the three stay aligned.
- **System bars** follow the app surface (white / `#131316`), not the brand colour; check what
  `enableEdgeToEdge()` in `MainActivity.kt` currently gives in both themes.

## Menus

- Section menu: "Edit section" → "Edit section…".
- Item menu: "Add timer" / "Edit timer" → "Add timer…" / "Edit timer…".
- Rule: "…" only on entries that open something needing more input; plain confirmations
  ("Delete section", "Leave section") and info ("Account") don't get one.

## Features

- **Voice notes** (hold the composer mic, review the proposal, apply with Undo): PWA only so far.
  Contract in `supabase/README.md`; PWA side is `pwa/src/data/voice.ts`, `pwa/src/ui/VoiceSheet.tsx`,
  `pwa/src/ui/recorder.ts`, `Notes.applyVoice`/`undoVoice`, with `voice.test.ts` to port alongside.

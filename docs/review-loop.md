# Review loop

How features and bug fixes are reviewed in this repo. It runs until every reviewer that runs says RELEASABLE, then stops for the user's sign-off.

## When reviewers run

- **`security-reviewer`: automatic**, whenever a change touches sync, sharing, `supabase/migrations`, `supabase/functions` or secrets.
- **`ui-reviewer` and `/code-review`: opt-in.** Run them only when the task asks for them ("with UI review", "with review loop") or when the user says go.
- **Suggest them actively, but don't run them.** When the work reaches the gate and a reviewer would be worth it, ask in one line which reviewer and why, e.g. "This changes the composer layout on both clients: run the UI reviewer (PWA + Android)?" or "The sync merge logic changed: run /code-review?". Then wait. If the user says no or moves on without answering, continue without it and note "UI review: skipped" (or "/code-review: skipped") in the gate report.
- **Don't ask for trivial changes** (copy, colours, a single constant). Suggest only when there's a real risk of breaking something.

## 1. Split into steps

Before writing code, split the work into steps and write the list down. A step is something that builds and passes its tests on its own, e.g. "migration + RLS test", "PWA data layer", "PWA sheet". New features are PWA-first: the "Android port" step only starts after the user has tried the PWA and said yes to the APK (see CLAUDE.md).

## 2. Review

**Per step**, the tests are enough: run the touched client's tests, plus the `security-reviewer` where it applies. The UI reviewer and `/code-review` run **once per feature, at the gate**, and only when opted in. When more than one reviewer runs, start them in one turn: the agents first (they run in the background), then `/code-review`.

| Reviewer | When | What |
|---|---|---|
| `security-reviewer` agent | automatic, after each step that touches sync, sharing, `supabase/migrations` or `supabase/functions`, or secrets (`local.properties*`, `.env*`, `buildConfigField`, `wrangler.jsonc`, any key or URL) | RLS, owner-deletes/member-leaves, secret handling. Blocks only with attacker + entry point + damage. |
| `ui-reviewer` agent | opt-in, once per feature at the gate | Phone viewport and touch, only on the client(s) the feature changed; both only when shared logic changed. PWA at iPhone size via chrome-devtools, Android on the emulator. Returns screenshots. |
| `/code-review` (built-in) | opt-in, once per feature at the gate | Functional: correctness bugs in the uncommitted diff, which is the whole feature. |

Tell the security reviewer what the step changed (one sentence plus the files). Hand the UI reviewer:
- the screens and states that changed, and which client(s);
- the URL of the dev server you already have running, and the path of the APK you already built. Build and start them yourself first if needed (`cd pwa && npm run dev -- --port 5173 --strictPort`; `cd android && ./gradlew :app:assembleDebug`), so the reviewer never builds;
- the screenshot directory `.review/<feature>/` (gitignored; the chrome-devtools MCP can only write inside the repo).

`/code-review` has no verdict of its own: a finding you confirm as a real bug in the normal flow makes the step NOT RELEASABLE; findings you judge to be edge cases go to the hardening list.

## 3. Fix until releasable

- Fix the blocking findings, rerun the tests.
- **From round 2, rerun only the reviewers that said NOT RELEASABLE**, and pass them their previous findings. They re-check those and the code the fix touched, nothing new.
- If you think a blocking finding is wrong, don't loop on it: say why and ask the user.

## Edge cases go to the hardening list

Every hardening line a reviewer returns (and `/code-review` findings you judge to be edge cases) is appended to `docs/hardening.md` instead of blocking. That file is gitignored on purpose: it names weak spots, and the repo is public. Skip duplicates. Format: `- [ui|security|functional] <what> (<feature>, YYYY-MM-DD)`.

## Status reporting

- One line per step when it passes: `Step 1 RELEASABLE ✅ — PWA scan sheet`.
- After every 5th fix round on a step, a short summary: what keeps failing, which reviewer, what was tried.

## 4. Gate

After the last step:

1. **Reviewers**: run the opted-in UI reviewer and `/code-review` now, or ask the one-line question from "When reviewers run". Note any that were skipped.
2. **All tests green**, every suite, not just the touched client's:
   - `cd pwa && npm test && npx tsc -b` (tsc fails on things vitest lets through)
   - `cd android && ./gradlew :app:testDebugUnitTest` (with `JAVA_HOME` from `android/CLAUDE.md`)
   - `cd supabase/test && npm test`
3. **Screenshots** of the feature or bug fix, from the UI reviewer's last round, or taken yourself when it was skipped (paths listed). For a change with nothing to see, the test output that proves it.
4. **Stop for the user's sign-off.** Report the steps, the hardening lines added and the gate results, then wait. **Never commit, push or deploy on your own**: a push to `main` deploys the PWA to the live site within a minute.

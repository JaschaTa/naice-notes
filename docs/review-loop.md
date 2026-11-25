# Review loop

Applies to every feature and bug fix in this repo. It runs until every reviewer says RELEASABLE, then stops for the user's sign-off.

## 1. Split into steps

Before writing code, split the work into steps and write the list down. A step is something that builds and passes its tests on its own, e.g. "migration + RLS test", "PWA data layer", "PWA sheet", "Android port". Shared logic is ported to both clients in the same step (see CLAUDE.md).

## 2. Review each step, reviewers in parallel

After each step, run the touched client's tests, then start the reviewers that apply **in one turn**: the agents first (they run in the background), then `/code-review`.

| Reviewer | When | What |
|---|---|---|
| `/code-review` (built-in) | every step | Functional: correctness bugs in the uncommitted diff, which is the feature so far. |
| `ui-reviewer` agent | the step changes something a user sees or touches (`pwa/src/ui/`, `pwa/src/index.css`, `android/…/ui/`, `res/layout`, the widget) | Phone viewport and touch: PWA at iPhone size via chrome-devtools, Android on the emulator. Returns screenshots. |
| `security-reviewer` agent | the step touches sync, sharing, `supabase/migrations` or `supabase/functions`, or secrets (`local.properties*`, `.env*`, `buildConfigField`, `wrangler.jsonc`, any key or URL) | RLS, owner-deletes/member-leaves, secret handling. Blocks only with attacker + entry point + damage. |

Tell each agent what the step changed (one sentence plus the files) and, for the UI reviewer, which client(s) and the screenshot directory `.review/<feature>/` (gitignored; the chrome-devtools MCP can only write inside the repo).

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

1. **All tests green**, every suite, not just the touched client's:
   - `cd pwa && npm test && npx tsc -b` (tsc fails on things vitest lets through)
   - `cd android && ./gradlew :app:testDebugUnitTest` (with `JAVA_HOME` from `android/CLAUDE.md`)
   - `cd supabase/test && npm test`
2. **Screenshots** of the feature or bug fix, from the UI reviewer's last round (paths listed). For a change with nothing to see, the test output that proves it.
3. **Stop for the user's sign-off.** Report the steps, the hardening lines added and the gate results, then wait. **Never commit, push or deploy on your own**: a push to `main` deploys the PWA to the live site within a minute.

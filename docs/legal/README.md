# Legal texts

Drafts for naice-notes.com and the web app, run by a private person in Germany. Not legal advice;
compare against e-recht24 or the Datenschutz-Generator by Dr. Schwenke before going live.

Why any of this applies: the household exemption (Art. 2(2)(c) GDPR) ends where a public landing
page and invite chains reach people outside the family. § 18(1) MStV requires name and address on
any public site that isn't purely private, commercial or not.

**German is the binding language.** Operator, users and the supervisory authority are in Germany,
and an authority works in German (§ 23 VwVfG). The English privacy policy is an optional
convenience translation; drop it if keeping two versions in sync is too much.

| File | Status | Link from |
|---|---|---|
| `impressum.md` | needed, DE only | footer of the landing page and the app |
| `privacy.de.md` | needed, binding | footer, sign in screen, invite email |
| `privacy.en.md` | optional translation | next to the German one |
| `terms.de.md`, `terms.en.md` | parked until something costs money | — |

Placeholders: `{{name}}`, `{{street}}`, `{{postcode}}`, `{{city}}`, `{{email}}`, `{{phone}}`
(optional), `{{date}}`, `{{supervisory_authority}}` (the data protection authority of your
Bundesland). The repo is public: fill them in at build time or keep the filled files out of git.

## Plan

### Must, before the landing page goes live

1. **Impressum** filled in (name, an address where legal papers can be served, email) and linked
   from every page, including the sign in screen of `/app`.
2. **German privacy policy** linked from the landing page and the sign in screen.
3. ~~**Self-host the fonts.**~~ Done 2026-11-26 for the mockups: `design-mockups/landing-assets/fonts/`
   (latin + latin-ext woff2, `fonts.css`, OFL licenses). The real landing page must use these too.
4. **Privacy link in the invite email:** done in `supabase/functions/send-invite` (footer naming the
   inviter, link to `/privacy`), **not deployed**. Deploy once `/privacy` is live, or the notice
   links to the app.
5. **Data processing agreements:**
   - Cloudflare: part of the self-serve terms every account accepts (DPA v6.4, 2026-04-03).
     Nothing to sign; note the version.
   - Supabase: dashboard → Organization → Legal Documents, request the DPA and sign it through
     PandaDoc. Keep the signed PDF.
   - OpenRouter: their terms (§ 10.2) incorporate the DPA only for organizations or commercial,
     for-profit use, which a private free project may not be. Either email OpenRouter and get it
     confirmed in writing for this account, or call Gemini on Google Cloud Vertex AI directly:
     the Google Cloud DPA applies to every Cloud account, an EU region keeps
     photos in the EU, and the OpenRouter hop and its US transfer go away. Decide before voice and
     summaries ship, since they'll use the same path.
6. ~~**Schedule `purge_tombstones()`.**~~ Done 2026-11-26: pg_cron job `purge-tombstones`, nightly
   03:17 UTC (migration `20261126000000`). First real purge around 2026-12-11; follow-ups in
   `docs/hardening.md`.
7. **Record of processing activities** (Art. 30 GDPR), one page, kept privately, not in this repo.
   The small-business exemption doesn't cover processing that happens regularly.

### Should, before invites reach people you don't know

8. **Replace Gmail for outgoing mail** with a provider that signs a DPA, ideally in the EU (e.g.
   Brevo). A private Gmail account has no Art. 28 agreement. Update section 4 of the policy.

### Not now

- **Terms of use:** they only bind if shown and accepted at sign in (§ 305(2) BGB), which the app
  doesn't do. Bring them back with a notice on the sign in screen once anything costs money.
- **In-app account deletion:** deletion on request by email meets Art. 17. App stores require a
  button, the web doesn't.
- **Exact log retention:** the policy says "a few days at most" instead of a number.
- **DSA contact point:** probably not applicable to a free, non-commercial service with no public
  content. Hedge if wanted: one line in the Impressum naming the email as contact point under
  Art. 11/12 DSA, languages German and English.

## Update the texts when

- **voice input and grocery summaries ship:** add a section each, like section 7 (recipe scan).
  Say what is sent and whether audio is stored.
- **the Android app is distributed:** add link previews (the phone fetches the linked page
  directly, so that site sees the user's IP); the Play Store needs the policy URL and an account
  deletion option.
- **anything costs money:** consumer contract rules (§§ 312 ff. BGB) apply, including the right of
  withdrawal; bring back the terms and rewrite the liability clause.
- **a blog or editorial content is added:** name a person responsible under § 18(2) MStV.
- **a new service gets user data** (analytics, error tracking, another AI provider). Analytics
  also means a consent banner (§ 25 TDDDG).

## Why there's no

- **cookie banner:** only storage the app needs to work, no cookies, no tracking (§ 25(2) no. 2
  TDDDG).
- **EU online dispute resolution link:** the ODR platform closed on 20 July 2025.
- **right of withdrawal notice:** the app is free and data is only processed to provide it
  (§ 312(1a) sentence 2 BGB).
- **data protection officer:** not required for one person.

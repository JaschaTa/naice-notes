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
(optional), filled at build time from `LEGAL_*` variables because the repo is public. The date
("Stand") and the supervisory authority (Hamburg) are written into the texts: update the date with
every change to a privacy text. The parked terms still use `{{date}}`.

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
   - Supabase: nothing to sign. ToS § 7(b) incorporates the DPA (Version 1, 2026-08-01), which
     takes effect on acceptance or use; DPA § 12.2: "acceptance of the Agreement shall have the
     same effect as signing the SCCs" (Module 2, Irish law). Contract partner and data importer is
     Supabase Pte. Ltd., Singapore. Note the version.
   - OpenRouter: nothing to sign. ToS § 10.2 incorporates the DPA (2026-08-26) for every account,
     its party is "the individual or entity" accepting the terms, and § 13.2 enters the SCCs
     (Module 2) on acceptance. ZDR is part of it (§ 1.19, § 9). Note the version.
6. ~~**Schedule `purge_tombstones()`.**~~ Done 2026-11-26: pg_cron job `purge-tombstones`, nightly
   03:17 UTC (migration `20261126000000`). First real purge around 2026-12-11; follow-ups in
   `docs/hardening.md`.
7. ~~**Record of processing activities**~~ (Art. 30 GDPR): `verarbeitungsverzeichnis.md`, created
   2026-11-27. Placeholders here; the filled copy is kept privately. Update it and its change log
   whenever a recipient or processing changes.

### Should, before invites reach people you don't know

8. **Replace Gmail for outgoing mail:** live on Brevo since 2026-11-27 (sign-in codes and invites
   tested, SPF/DKIM/DMARC pass). Revoke the Gmail app password "Naice Notes Supabase" and drop the
   commented Gmail lines from `.env`.
   **Open gap:** Brevo puts an open-tracking pixel in every email and offers no way to remove it for
   SMTP (tested: anonymous tracking, per-contact consent with unknown = no, `X-Mailin-Track*`
   headers). That needs consent under § 25 TDDDG, and the privacy policy doesn't mention it (your
   decision, 2026-11-27). Fix before invites reach strangers: ask Brevo support to disable tracking,
   or move to Scaleway Transactional Email (no tracking at all; only the SMTP host and DNS change).

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

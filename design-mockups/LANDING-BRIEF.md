# Landing page brief — 2026-11-26

Strategy and copy for the naice-notes.com landing page. This follows `landing-page-design` from
elayadesign/ai-design-skills (Part A), and is settled before the mockups (Part B) are built.
Visible copy follows the skill's rules: no hyphens, sentence case, no invented facts. Anything not
known yet is a `{{placeholder}}`.

## Positioning

**Naice Notes, your personalAIzed notes app.** It's a list app where AI does the tedious part of
getting things onto a list and making sense of it: you ramble, snap or type. Underneath sit the
parts that already make it different: timed notes that stay out of the way until they're due, and
sharing one list at a time. It's free, invite only for now.

## Release gate

The page presents three AI features as available. Only one exists today:

| Feature | Status |
|---|---|
| Recipe photo → ingredient list | Shipped (Android and PWA, `scan-recipe` Edge Function) |
| Voice input with an AI analyser: ramble, and it's split into notes in the right lists | **Planned before the release** |
| Grocery list summaries | **Planned before the release** |

**The page doesn't go live until both planned features ship, or their blocks are removed.** The
copy for them is a draft and gets rechecked against what is actually built (marked `{{confirm}}`).
Following CLAUDE.md, both are built PWA first.

The Android app isn't published. The page sells the web app, which works on iPhone, Android and
desktop. The Android app and its widget get at most one "on the way" line.

## Intake (A1)

| Question | Answer |
|---|---|
| Primary action | An invited person signs in. |
| Offer | A free notes app for lists you share and lists you don't, which you fill by speaking, snapping or typing. Runs in any browser and installs to the home screen. |
| Conversion | A click on **Sign in with your invite** that ends in a signed-in session. |
| Audience | *Assumption:* friends, family and household members of the owner, plus the people they share lists with. |
| Problem | Shopping lists, chores and "sometime next month" reminders are spread across chats, notes apps and memory, and typing them in is the chore that kills every list app. |
| Objections | 1. "Why should I trust a small app, and its AI, with my data?" 2. "I can't get in, it's invite only." 3. "Is it worth installing yet another app?" |
| Traffic | *Assumption:* invite emails (the button links to the site) and links sent directly. |
| Proof | No testimonials or user counts. True signals: free, invite only, hosted in the EU (Frankfurt), open source (MIT), no ads, AI requests with zero data retention. |
| Risk reversal | Free, no password (sign in with a code), works offline, members can leave a shared list at any time. |
| Pricing | Free. AI features may cost something later, so the page says "free" and doesn't promise "free forever". |
| Voice | Casual and plain, like the README and the invite email, with one wink: "personalAIzed". |
| Mobile priority | High. Most visitors arrive on a phone from an email. |

**Wording:** the page says **lists**, never "sections".

## Layout (A3)

**A. Classic hero plus sections, kept short.** One phone screen explains the product, so the hero
visual carries most of the argument. **No FAQ (your call).** The trust answers it would have carried
are a compact "plain facts" row above the final CTA: four short statements, not questions.

## Page outline (A2)

1. **Nav:** a floating bar with the logo and wordmark, plus **Sign in**.
2. **Hero:** an eyebrow line, headline, subline, primary CTA, proof line, and a phone showing the rail and a list.
3. **AI block: "Say it, snap it, sum it up".** Three cards, each with a product visual.
4. **Tagline reveal (B11):** a large type statement on its own.
5. **Benefits:** the list app itself, four of them, each next to a product visual.
6. **Video slot:** for the brag launch video later, shown as a poster frame for now.
7. **How it works:** three steps.
8. **Plain facts:** four short trust statements.
9. **Final CTA:** the same as the hero's.
10. **Footer:** Impressum, Privacy, GitHub, version.

Social proof and the FAQ are dropped. Proof is the hero's proof line plus the plain facts row.

## Hero

- **Eyebrow:** your personalAIzed notes app
- **Headline:** **Ramble. We'll make it a list.**
- **Subline:** Speak, snap or type. Naice Notes sorts it into lists, shares the ones you pick, and
  holds reminders until they're due.
- **Primary CTA:** Sign in with your invite
- **Proof line:** Free · Invite only · Hosted in the EU

## AI block: "Say it, snap it, sum it up"

1. **Say it.** Talk the way you think: "milk, call the plumber on Friday, and we're out of bin bags". Each
   thing becomes its own note, in the right list. `{{confirm}}`
2. **Snap it.** Take a picture of a recipe, check the ingredients it found, and add them to your
   shopping list in one go.
3. **Sum it up.** One tap gives you a short summary of your grocery list: what it's for, what's
   been sitting there for weeks, what you could skip. `{{confirm}}`

## Tagline reveal (B11)

> You think it.
> It's on the list.
> It's back when it's due.

## Benefits: the list app itself

1. **Every list, one tap away.** Each list is an emoji tile on the side, with a count of what's
   still open.
2. **Reminders that don't nag.** Give a note a date, a repeat, or both. It waits greyed out at the
   bottom until it's due, then moves back up with an amber mark. No notifications.
3. **Share one list, not your whole life.** Share Shopping with your household and keep Work to
   yourself. Everyone sees changes as they happen.
4. **On your home screen.** Add it from Safari or Chrome and it opens like an app, on iPhone and
   Android alike. An Android app with a home screen widget is on the way.

## How it works

1. **Get an invite.** Someone who uses Naice Notes shares a list with your email address.
2. **Sign in with a code.** Enter your email and type the six digit code we send you. No password.
3. **Add it to your home screen.** It opens like an app, works offline and syncs when you're back.

## Plain facts

- **Free.** No ads, no card.
- **Your notes live in the EU.** On your device, synced through Frankfurt.
- **The AI keeps nothing.** Photos, voice and lists go to the model and back, with zero data retention. `{{confirm for voice and summaries}}`
- **Open source.** Every line is on GitHub, MIT licensed. `{{github_url}}`

## Final CTA

**Sign in with your invite**, with the line "Invite only for now. Ask someone who uses it to share
a list with you."

## SEO (A7)

**Index the landing page, and noindex `/app`.**
- Title: `Naice Notes · your personalAIzed notes app`
- Meta description: `Ramble, snap or type, and Naice Notes turns it into tidy lists you can share. Reminders wait until they're due. Free, invite only, hosted in the EU.`

## Where we deviate from the skill

| Rule | Deviation and why |
|---|---|
| A2 social proof, A4 numbers | Left out: there are no real testimonials or stats to use. |
| A2 FAQ | Left out by decision. Its trust content moved into "Plain facts". |
| B10 form validation | Doesn't apply: there's no form on the page. Sign in happens in the app. |
| B6 icons, B1 font | Apply to the page itself. The phone visuals redraw the app as it really is, with its own icons and system font. |
| B2 spacing | Hero top and tagline padding are 160px (96 + 64, two scale steps stacked). Decorative tiles in 03 sit at free offsets. |
| B5 eyebrow, B9 focus (light pages) | On light backgrounds, coral text uses a darker coral (`#C4553F` / `#C2452E`) and focus rings are near-black, so they pass contrast. CTA text is near-black on coral (white on `#F0806A` is only about 2.6:1). |

## Still open

- `{{github_url}}`: may the page link the public repo?
- `{{confirm}}` on voice and summaries, once they're built
- the details for the Impressum and Privacy pages: name and address, which go live on a public page

## Direction 4, cut short (2026-11-26)

`landing-04-editorial.html` ends after the list part. Order:
1. hero
2. shipping ticker
3. "Your head is not a list" (ramble → list)
4. say it / snap it / sum it up
5. tagline
6. the list part
7. a closing block: CTA plus the plain facts as one line
8. footer with the wordmark

How it works, the video slot, the founder note and the long plain facts section are gone:
- the invite email and the sign in screen already explain the steps
- the video slot comes back once the brag film exists
- the founder note can come back with your words

Your edits after the first look (2026-11-26):
- The header is just the app icon, the wordmark and Sign in.
- The hero has one toast (Mara shared Shopping).
- **No "Hosted in the EU" anywhere.** The proof line is now Free · Invite only, and the closing facts are Free, The AI keeps nothing, Open source.
- **The tagline reveal (B11) is removed.** This deviates from the skill, by your decision.
- The list section headline is now "Your notes app. *As unique as you.*". Below it are four bento cards with only a serif title inside each. The visuals are large and run off the card edge: the list rail, a slice of a list, shared versus private lists, and a home screen.
- The AI cards and the list cards are now one section, "Your notes app. *As unique as you.*", with five cards: Say it, Snap it, Sum it up, Share it, Remember it.
- They sit in a plain swipe row: no autoplay, no loop. Cards snap into place, and on desktop the ← → buttons step one card and dim at either end.
- "Every list, one tap away" and the home screen card are removed, along with the line "The boring bit of every list…".
- "Snap it" shows a cookbook page (Spaghetti al pomodoro) under a coral scan frame, turning into a Shopping card with "+6 added".
- The plain facts line under the closing card is removed.
- The footer is dark, with only the app icon and wordmark at 60px, Impressum and Privacy policy, and the copyright. The "The AI part" kicker is removed.

Hero copy (2026-11-26), replacing "Ramble. We'll make it a list.":
- Headline: **The notes app you *always wanted.***
- Subline: only "Even if you didn't know it."
- The personalAIzed pill is removed.
- The headline is 96px on wide screens (72, 60 and 48 below that) in a wider text column, with the subline at 24px.
- The changelog ticker is removed: it was the closest copy of AppDebut, and its link went nowhere.
- The hero toast is removed. Sharing is shown by the avatars in the phone header and the "Share it" card.

## Hand photo for direction 4 (in place, 2026-11-26)

- **Source:** the Gemini JPEG in `landing-assets/`, cropped to `landing-assets/hand.webp` (1280 px wide, the arm cut just below the wrist).
- **Screen position:** the green screen is at `--sx: 35.09%; --sy: 21.78%; --sw: 30.07%; --sh: 59.11%` of the
  crop. The live screen is drawn at 260 × 562 and scaled into that area by JS.
- **Page colour:** changed to `#F4F1EC` to match the photo's background.
- **Edges:** soft masks on the photo's edges hide the image border, and the arm dissolves at the bottom.
- **Wide screens:** the photo runs 64 px into the right margin.

Original notes:

The hero in `landing-04-editorial.html` can hold a photo of a hand with a phone, like AppDebut's. It
must be our own image: theirs is a template asset. The photo supplies only the hand and the phone
frame. The screen stays live HTML on top, so it's sharp and the list can be ticked.

- Save as `design-mockups/landing-assets/hand.webp` (about 1600 px wide). The page picks it up on its
  own, and falls back to the CSS phone while it's missing.
- After it exists, the screen position gets calibrated once with `--sx`, `--sy`, `--sw`, `--sh`,
  `--sr` on `.stage`.
- Requirements: the phone is upright and straight on with no perspective, so a flat rectangle fits
  the screen. The screen is one flat chroma colour. The background is the page colour `#F6F3EE`, so
  no cut-out is needed.
- **Make it clearly different from AppDebut's photo.** A hand with a phone is a common motif, but
  together with the serif headline and the paper background it would read as a copy:
  - a **left** hand coming straight up from the bottom (theirs is a right hand from the bottom right)
  - no ring, short natural nails
  - optionally a flat coral (`#F0806A`) circle behind the phone, so the colour is ours
- Before going live, check the image tool's terms for commercial use.

Prompt (Nano Banana):

> Photorealistic studio photo of a left hand holding an iPhone 16 Pro upright, straight-on frontal
> view, the phone perfectly vertical with no tilt and no perspective. The hand comes straight up from
> the bottom edge of the image, the wrist cropped by the bottom edge, fingers wrapped around the
> lower half of the phone and the thumb resting on the left edge. The screen is one flat solid
> #00FF00 green colour from edge to edge inside the thin black bezel, with the Dynamic Island at the
> top, no reflections, no interface, no logos. Natural titanium frame. Natural skin, short natural
> unpolished nails, no rings or jewellery. Soft diffused daylight, a gentle soft shadow. Background:
> perfectly flat solid #F6F3EE with a large flat solid #F0806A circle centred behind the phone, no
> texture, no gradient, no props. 4:5 portrait, high resolution.

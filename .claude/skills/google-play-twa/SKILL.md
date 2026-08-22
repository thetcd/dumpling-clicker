---
name: google-play-twa
description: Ship דאמפלינג קליקר to Google Play as an Android app. Use for anything about the Play build, the TWA/Bubblewrap wrapper, assetlinks.json, app signing keys, the applicationId, the closed-testing/12-tester rule, the Play Console listing, Families policy for the kids' audience, or "make this into an app". Covers packaging, verification on a real phone, and the release cadence.
---

# Google Play — the TWA app

Ship the game to Play as a **Trusted Web Activity via Bubblewrap**: a thin
signed Android wrapper around the live site at **https://dumplingclicker.com/**.

`docs/GOOGLE-PLAY.md` is the phase-by-phase runbook and stays the source of
truth for status. This skill is the operational knowledge — the decisions that
are settled, the steps, and the traps that cost real time.

## Do not re-litigate: it is a TWA, not Capacitor

Three reasons, each independently sufficient:

- **`git push` stays the only deploy, with no Play review per release.** The
  weekly cap-raise cadence depends on this. A Capacitor build needs a store
  review per release and the cadence dies.
- **A TWA shares Chrome's storage for the origin**, so the browser save and the
  installed-app save are the *same* localStorage. Capacitor's WebView is its own
  origin — installing would create a **third empty save**, on top of the one the
  domain move already wiped.
- **There is nothing for Capacitor to add.** The game is 100% static, zero
  network calls, and the only native API is `navigator.vibrate`.

**Difficulty: technically easy, bureaucratically slow.** ~2–3 days hands-on,
~4–6 weeks calendar. The calendar is dominated by Google's closed-testing rule,
not by any engineering.

## The critical path is the Play account, not the packaging

> **New personal Play developer accounts must run a closed test with 12 testers
> opted in continuously for 14 days** before Google grants production access.

- $25 one-time, plus ID verification that can take days.
- The 14-day clock starts only when a release is **approved** AND **12 testers
  are opted in** — not when you upload.
- Recruit **15–16** for dropout margin (brother, Gal's circle, family WhatsApp).
  Each needs a Google account and must stay opted in for 14 unbroken days. One
  person dropping out at day 10 can reset the requirement.

**Always advise starting the account and tester recruiting before packaging.**
Packaging is a couple of days whenever; this clock runs for weeks and cannot be
compressed. Anyone proposing to do Bubblewrap first has the ordering backwards.

## State (keep current; verify before relying on it)

- **Phase A repo prep — DONE.** Manifest `id: '/'`, real maskable icon,
  privacy/about pages, assetlinks placeholder, SW denylist.
- **Domain — DONE 2026-08-22.** Live, and
  `https://dumplingclicker.com/.well-known/assetlinks.json` already serves the
  placeholder as `application/json` — the exact URL Play's TWA check hits.
- **Play developer account — NOT STARTED. This is the only blocker.**
- Phase C packaging is unblocked and can start any time.
- Nothing is built yet: no `android/`, no `twa-manifest.json`.

## Phase C — packaging

```bash
npx @bubblewrap/cli init --manifest https://dumplingclicker.com/manifest.webmanifest
bubblewrap build     # .aab for Play, .apk for local phone testing
```

`init` reads name, colors and icons from the live manifest, so the manifest must
be correct *before* running it.

Commit `twa-manifest.json` under `android/`. **The keystore never goes in git.**

### applicationId is permanent

Reverse-DNS of the domain — `com.dumplingclicker.twa` or similar. **It can never
change after the first Play upload.** Getting this wrong means a new listing and
starting the 12-tester clock over. Confirm it explicitly before the first build.

### The assetlinks trap — the expensive one

`public/.well-known/assetlinks.json` ships with placeholders:

```
REPLACE_WITH_APPLICATION_ID
REPLACE_WITH_PLAY_APP_SIGNING_KEY_SHA256
REPLACE_WITH_UPLOAD_KEY_SHA256
```

Enroll in Play App Signing, then take the SHA-256 from
**Play Console → Setup → App signing**.

- Use the **Play signing key**, *not* the upload key. They are different, both
  are on that screen, and picking wrong is the classic failure.
- **Wrong key = the app runs but shows a browser address bar.** It does not
  crash and gives no useful error — it just looks unfinished.
- Put the **upload key's** fingerprint in as well, as a second entry, so locally
  installed `.apk`s verify too.
- Deploy after editing. The file is served from the live origin, not bundled
  into the app, so it needs a push.

### Verify on a real phone

Not optional, and not something Playwright can substitute for:

- No address bar (this is the assetlinks check passing)
- Portrait lock
- Works offline after first launch
- **Save is shared with Chrome on the same domain** — open the site in Chrome,
  earn something, open the app, and confirm it is the same save. This is the
  whole reason for choosing a TWA; verify it actually holds.

## Phase D — listing and policy

Store listing, **Hebrew primary**: title, descriptions, 512×512 listing icon,
**1024×500 feature graphic**, ≥2 phone screenshots (a real phone, or the
430×900 Playwright drive this repo already uses).

**Target audience = children → Families policy applies.** The game is marketed
to kids through Gal, so this is not a judgment call.

- Privacy policy URL: `https://dumplingclicker.com/privacy.html` (live).
- Data safety form: **"no data collected"** — truthful. No accounts, no
  analytics, no backend; one `localStorage` key that never leaves the device.
- **Ads: launch with none.** Families apps may only use self-certified ad SDKs,
  and H5 Games Ads is a *web* product that may not be Families-compliant inside
  the app. This is why `docs/DOMAIN-AND-ADS.md` Phase 4 is parked rather than
  next. **Never ship web ads into pages the TWA opens without re-checking
  Families policy first.**
- Content rating questionnaire (IARC) — trivial for this game.

## Phase E — closed test → production

1. Upload the `.aab` to a **closed testing** track, add the tester list, wait for
   Google's release review.
2. Hold 14 unbroken days with ≥12 opted-in testers. Use the window to finally get
   real-phone squish-feel feedback — that is still an open question in
   `docs/PROGRESS.md`.
3. Apply for production access from the Console dashboard, then promote to
   production and pass the final review.

## Repo facts that bite during this work

- **`src/main.ts` is a dispatcher, not the game. The entry point is
  `src/boot.ts`.** A non-`/` base renders the "we moved" screen; `/` imports
  `./boot`.
- **Two deploys run off `main`.** Vercel (canonical, no `VITE_BASE`) serves the
  game; GitHub Pages (`VITE_BASE=/dumpling-clicker/`) serves the moved screen.
  **The TWA points at the Vercel origin only.** Never point it at the Pages URL.
- **`navigateFallbackDenylist` in `vite.config.ts` is load-bearing here.**
  Without it the service worker's SPA fallback swallows navigations to
  `/privacy.html`, `/about.html` and `/.well-known/` and serves the game
  instead — which would break the Play policy links *and* the TWA trust check.
  If assetlinks starts returning HTML, look here first.
- **The maskable icon is its own asset** (`icon-512-maskable.png`, art at 74% in
  a full-bleed field). Never repoint `purpose: 'maskable'` at `icon-512.png` —
  Android's circular crop clips its rounded corners.
- Manifest `id: '/'` is what let installs survive the sub-path → domain-root
  move. Leave it alone.

## Costs and expectations

$25 Play fee once, ~$11/yr domain. **Kids-app rules mean the Play build earns
nothing** — it exists for reach and for the home-screen icon, same as the PWA.
Say so plainly if anyone frames Play as a revenue step.

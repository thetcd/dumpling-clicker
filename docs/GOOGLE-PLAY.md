# Google Play — the runbook

Written 2026-08-22. Goal: דאמפלינג קליקר on Google Play as an Android app.

**The approach is a Trusted Web Activity (TWA) via Bubblewrap** — a thin signed
Android wrapper around the live site. Chosen over Capacitor because:

- Every `git push` keeps updating the app instantly, with **no Play review per
  release** — the weekly cap-raise release model depends on this.
- A TWA shares Chrome's storage for the origin, so the browser save and the
  installed-app save are the **same** localStorage. Capacitor's WebView is its
  own origin — installing would be a third empty save on top of the domain-move
  wipe.
- The game is 100% static, zero network calls, no native APIs beyond
  `navigator.vibrate` — there is nothing for Capacitor to add.

**How hard: technically easy, bureaucratically slow.** ~2–3 days of hands-on
work, ~4–6 weeks calendar, dominated by Google's closed-testing rule (below).

---

## The two hard prerequisites

1. ~~**The custom domain**~~ — **DONE 2026-08-22.** The game is live at
   **https://dumplingclicker.com/**, and
   `https://dumplingclicker.com/.well-known/assetlinks.json` already returns the
   placeholder JSON as `application/json`. That is the exact URL Play's TWA
   check hits in Phase C, so the only thing left there is replacing the
   fingerprints. See `docs/DOMAIN-AND-ADS.md`.
2. **A Play developer account** (Dor has none). Personal account: $25 one-time
   + ID verification (can take days). **New personal accounts must run a closed
   test with 12 testers opted in continuously for 14 days** before Google
   grants production access. Recruit 15–16 for dropout margin (brother, Gal's
   circle, family WhatsApp groups); each needs a Google account and must stay
   opted in for 14 unbroken days. The clock starts only when the release is
   approved AND 12 testers are opted in.

## Phase A — repo prep (DONE 2026-08-22)

- [x] Manifest `id: '/'` — installs survive the sub-path → domain-root move.
- [x] Manifest description refreshed (was the stale dumpling-empire line).
- [x] **Real maskable icon** `public/icons/icon-512-maskable.png` (art at 74%
      inside a full-bleed `#241a28` field; source `icon-maskable.svg`, rendered
      with `qlmanage -t -s 512 -o . icon-maskable.svg`). The old entry reused
      the unpadded `icon-512.png`, which Android's circular crop clips — never
      point `purpose: 'maskable'` back at it.
- [x] `public/privacy.html` + `public/about.html` (Hebrew + English, static,
      relative links only — Pages serves from a sub-path). Required by Play for
      a kids' app, and the same pages AdSense's "thin content" check wants.
- [x] `public/.well-known/assetlinks.json` placeholder — fingerprints land in
      Phase C.
- [x] `navigateFallbackDenylist` in `vite.config.ts` — without it the SPA
      service-worker fallback swallows navigations to privacy/about/.well-known
      and serves the game instead.

## Phase B — Dor, off-repo

- [x] Domain + Vercel move (`docs/DOMAIN-AND-ADS.md`). Done 2026-08-22.
- [ ] Play developer account + start recruiting testers. **This is now the only
      thing blocking the app** — Phase C can start immediately, but nothing
      reaches a phone-installable track without the account, and the 14-day
      12-tester clock is the long pole. Start it first.

## Phase C — package the TWA (the domain is live; this is unblocked)

1. `npx @bubblewrap/cli init --manifest https://dumplingclicker.com/manifest.webmanifest`
   — reads name/colors/icons from the live manifest.
   **Choose the applicationId carefully** — reverse-DNS of the domain, so
   `com.dumplingclicker.twa` or similar. It can never change after the first
   Play upload.
2. `bubblewrap build` → `.aab` for Play, `.apk` for local phone testing. Commit
   `twa-manifest.json` under `android/`; the keystore itself stays out of git.
3. **The assetlinks trap:** enroll in Play App Signing, then copy the SHA-256
   from Play Console → Setup → App signing — **the Play signing key, NOT the
   upload key** — into `public/.well-known/assetlinks.json` and deploy. Wrong
   key = the app runs but shows a browser address bar. Put the upload key's
   fingerprint in too, so locally-installed `.apk`s also verify.
4. Verify on a real phone: no address bar, portrait, offline after first
   launch, save shared with Chrome on the same domain.

## Phase D — Play Console listing + policy forms

- Store listing (Hebrew primary): title, descriptions, 512×512 listing icon,
  **1024×500 feature graphic**, ≥2 phone screenshots (real phone or the
  430×900 Playwright drive).
- **Target audience = children → Families policy applies** (the game is
  marketed to kids via Gal):
  - Privacy policy URL: `https://dumplingclicker.com/privacy.html` (live).
  - **Data safety form: NOT "no data collected" any more.** Analytics shipped
    2026-08-23 (`src/analytics.ts`), so the form must declare, under
    **App activity → Other actions** and **App info and performance**:
    collected, **not** shared, **not** linked to identity, **not** used for
    tracking, purpose **Analytics** only, and *not* optional (there is no
    in-game toggle — see DECISIONS.md for why a toggle would be worse). Nothing
    goes under Personal info, Location (country-level is not "location" on this
    form), or Device or other IDs.
  - **The Families persistent-identifier ban is not tripped.** Google's list is
    AAID, IMEI, MAC, SSID, BSSID, IMSI, SIM/Build serial — the game transmits
    none of them, and no App Set ID either. If that ever changes, App Set ID is
    the only identifier Families permits for analytics, and it may never touch
    ads personalisation or measurement.
  - A wrong Data safety answer is a **policy violation and a takedown risk**,
    not a paperwork slip. Re-check this form against `src/analytics.ts` every
    time that file changes.
  - **Ads: launch with none.** Families apps may only use self-certified ads
    SDKs; H5 Games Ads is a *web* product and may not be Families-compliant
    inside the app. Decide ads separately later — and never ship web ads into
    pages the TWA opens without re-checking Families policy first.
- Content rating questionnaire (IARC) — trivial here.

## Phase E — closed test → production

1. Upload the `.aab` to a **closed testing** track, add the tester list, wait
   for Google's release review.
2. Hold 14 unbroken days with ≥12 opted-in testers. Use the window for
   real-phone squish-feel feedback.
3. Apply for production access from the Console dashboard, then promote to
   production + final review.

## Costs

$25 Play fee (once) + ~$10/yr domain. Kids-app rules mean the Play build earns
nothing — it exists for reach and the home screen, same as the PWA.

# Google Play — the runbook

Written 2026-08-22. Goal: דאמפלינג קליקר on Google Play as an Android app.

> **SUPERSEDED 2026-08-26 — the Play app is now the FLUTTER app, not this TWA.**
> Dor's call, and it was always the migration plan's endgame
> (FLUTTER-MIGRATION.md): the native app at
> `~/ApiScripts/dumpling-clicker-flutter` reached feature parity (visuals,
> findables, rebirth, designer, backdrop, audio) and ships to Play directly.
> Nothing was ever uploaded, so the switch costs nothing. What changes:
> - The TWA package in `android/` here is RETIRED. Do not upload it. Its
>   `upload-keystore.jks` (on Dor's other machine) is retired with it — the
>   Flutter repo generated its OWN upload keystore 2026-08-26
>   (`dumpling-clicker-flutter/android/upload-keystore.jks` + `key.properties`,
>   both gitignored). Never mix the two.
> - `assetlinks.json` and the Play App Signing SHA-256 wiring are NOT needed —
>   they were TWA-only requirements.
> - The applicationId stays `com.dumplingclicker.twa` (already pinned in the
>   Flutter repo; ugly but invisible and unchangeable after first upload).
> - `play-assets/` (listing images), the privacy URL, the Families posture and
>   the whole "two hard prerequisites" section below still apply verbatim —
>   the account + 12-testers-14-days rule dominates the calendar either way.
> - Data safety gets SIMPLER: the Flutter app currently collects nothing at
>   all (no analytics wired), so the form is "no data collected" — re-check it
>   the day an analytics endpoint lands.
> - Release artifact: `flutter build appbundle --release` in the Flutter repo.
>
> **2026-08-26 later: UPLOADED AND LIVE ON A TESTER TRACK.** Dor created the
> Play developer account and uploaded the Flutter AAB himself; a closed-testing
> release is live. What remains is Phase E's clock: **12 testers opted in for
> 14 unbroken days**, then apply for production access. Also still open:
> backing up the Flutter repo's `upload-keystore.jks` (exists only on one Mac),
> and a real-phone audio/squish-feel check — the tester build is the easy way
> to do it now.
>
> The TWA sections below are kept for reference only.

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
- [x] **Play developer account — verified 2026-08-25.** No longer a blocker.
- [ ] **Recruit 15–16 testers. This is now the critical path.** Nothing else in
      this document takes weeks; this does. The 14-day clock starts only once a
      closed-testing release is *approved* AND 12 testers are opted in, and one
      person dropping out at day 10 can reset it. Start it before packaging is
      finished — the two run in parallel.

## Phase C — package the TWA (BUILT 2026-08-25)

The Android project is generated and **builds clean**: a 1.3MB APK and a 1.4MB
AAB, both currently **unsigned**. Local toolchain setup and its three traps are
in `docs/ANDROID-TOOLCHAIN.md` — read that before building on a new machine.

- [x] **applicationId `com.dumplingclicker.twa`** — permanent, chosen 2026-08-25.
- [x] `android/twa-manifest.json` committed; the project is regenerated from it
      with `bubblewrap update --manifest ./twa-manifest.json --skipVersionUpgrade`.
      **`bubblewrap init` was not used** — it is interactive-only, and a
      committed manifest keeps every choice in a reviewable diff.
- [x] Verified in the built APK, not just in the config: package
      `com.dumplingclicker.twa`, versionCode 1 / versionName 1.0.0, targetSdk 36,
      minSdk 21, label `דאמפלינג קליקר`, `portrait`, and an asset statement
      pointing at `https://dumplingclicker.com`.
- [x] `android/store_icon.png` (512×512) generated — this is the Phase D
      listing icon, already done.

### Regenerating the project: two things that silently break it

1. **Every field bubblewrap templates into `app/build.gradle` must exist in
   twa-manifest.json.** A missing one is not defaulted — it emits an empty value
   like `splashScreenFadeOutDuration: ,`, which is invalid Groovy and fails with
   a Groovy *parser stack trace* naming neither the field nor the file. After any
   regeneration, scan for it:

   ```bash
   grep -nE ":\s*,\s*$" app/build.gradle
   ```

2. **Always pass `--skipVersionUpgrade`** unless you mean to ship a new version.
   Without it, `update` prompts for a version name and bumps appVersionCode; on a
   non-interactive shell that prompt reads EOF and writes `versionName ""`.

### Remaining — needs Dor and the Play Console

1. **Create the upload keystore.** It prompts for a password, so it is Dor's to
   run, and that password belongs in a password manager:

   ```bash
   android-tools/jdk/bin/keytool -genkeypair -v -keystore android/upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   `*.jks` is gitignored. Back the file up outside the repo — though with Play
   App Signing enrolled, a lost *upload* key can be reset by Google. The *app
   signing* key, which Google holds, cannot.

2. Build the signed AAB, create the Play Console listing, enroll in **Play App
   Signing**, and upload to a **closed testing** track.

3. **The assetlinks trap — and the live file is currently DEBUG-ONLY.**

   On 2026-08-25 the three placeholders in
   `public/.well-known/assetlinks.json` were replaced with the **local debug
   signing certificate** so the app verifies during local testing and shows no
   browser address bar. That fingerprint is machine-local and useless to Play.

   **Before the closed test, the Play App Signing SHA-256 must be ADDED to that
   array** — from Play Console → Setup → App signing, taking the **Play signing
   key, NOT the upload key**. Keep the upload key as a further entry so locally
   installed `.apk`s keep verifying. There are no placeholder strings left to
   remind you, so this step is easy to forget: wrong or missing key = the app
   runs but shows a browser address bar, with no crash and no useful error.

   Deploying is required either way — the file is served from the live origin,
   not bundled into the app.
4. Verify on a real phone: no address bar, portrait, offline after first launch,
   and **the save is shared with Chrome on the same domain** — earn something in
   the browser, open the app, confirm it is the same save. That shared save is
   the whole reason for choosing a TWA; confirm it actually holds.

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

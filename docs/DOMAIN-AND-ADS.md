# Moving to a real domain (Vercel + Cloudflare), and what ads would need

> **Phases 0–3 are DONE (2026-08-22).** The game is live at
> **https://dumplingclicker.com/** on Vercel, DNS at Cloudflare Registrar,
> GitHub Pages retired to a "we moved" screen. What actually happened, and the
> two places reality differed from the plan below, is recorded in
> **[Phases 0–3: what actually happened](#phases-03-what-actually-happened)**
> at the bottom. Phases 4–5 (AdSense, ad rewards) are still open — and per the
> Play Families decision the game launches with **no ads at all**, so Phase 4 is
> parked rather than next.
>
> **ADS SUPERSEDED 2026-08-27 — the ads plan moved to the Flutter repo:**
> `dumpling-clicker-flutter/docs/ADS.md` (github.com/thetcd/dumpling-clicker-flutter,
> private). The app ships natively via Play, so the product is **AdMob** in
> child-directed mode, not AdSense/H5 Games Ads — everything AdSense-specific
> below is for the retired website path. Still true here: the reward design +
> its two traps (mirrored in ADS.md), and this domain hosts `app-ads.txt`
> (in `public/`, plus a `navigateFallbackDenylist` entry) when ads ship.

> **Superseded in part, 2026-08-26: the domain is being retired as the game.**
> The game is moving to the native Flutter app on Google Play
> (`docs/FLUTTER-MIGRATION.md`), so `dumplingclicker.com` becomes a landing page
> pointing at Play rather than the place anyone plays. Two consequences for this
> document: the assetlinks/TWA reasoning below is dead (that was a TWA-only
> requirement, and the TWA is retired), and the AdSense phases are dead as the
> *plan* — ads, if they happen, are AdMob inside the app, which is the path
> Phase 4 already noted qualifies for child-directed treatment where AdSense
> does not. The domain itself is still worth keeping: it is the link Gal's
> audience gets sent, and it is where they will find the Play listing.
>
> The switch is `PLAY_LIVE` in `src/migration.ts`, and it is **off** until the
> Play listing is public — see the warning in `docs/FLUTTER-MIGRATION.md`.

Written 2026-08-22. The goal is a domain Dor owns, serving the game from
Vercel, because **AdSense can never be served from `thetcd.github.io`** — Google
approves the *parent* domain and lets subdomains inherit, and nobody can get
`github.io` approved. A custom domain is the prerequisite for every ad idea, not
an afterthought.

**Update 2026-08-22: the domain is also a hard prerequisite for Google Play.**
The Android app is a Trusted Web Activity, which verifies trust via
`https://<origin>/.well-known/assetlinks.json` at the origin **root** — a spot
`thetcd.github.io` can never give this game. See `docs/GOOGLE-PLAY.md`. One more
reason to do these phases sooner rather than later.

Do the phases in order. Phase 3 is the one with a cost attached; read it before
you start Phase 1.

---

## Phase 0 — pick the domain

- [x] Choose a name a Hebrew-speaking kid can type from hearing it once.
- [x] Register it at **Cloudflare Registrar** (sells at wholesale cost, no
      markup, and the DNS is already where you want it).
- [x] **`.co.il` is not available through Cloudflare Registrar.** If you want an
      Israeli TLD you need an Israeli registrar and then point the nameservers
      at Cloudflare. A `.com` avoids that whole detour.

## Phase 1 — deploy to Vercel

The repo already builds correctly at a domain root; no code changes needed.

- [x] Vercel → Add New → Project → import `thetcd/dumpling-clicker`.
- [x] Framework preset **Vite**. Build command `npm run build`, output `dist`.
      (Both are Vercel's defaults for Vite — just confirm them.)
- [x] **Do NOT add a `VITE_BASE` environment variable.** Leave it absent.
      GitHub Actions sets it to `/dumpling-clicker/` for Pages; Vercel must not.
      A *blank* value used to break the build (`start_url: ""`, relative
      `./assets/…` paths) — that footgun is fixed in `vite.config.ts`, which now
      treats blank as absent, but the variable still has no business existing
      here.
- [x] Deploy, open the `*.vercel.app` URL, and check: the designer opens, a tap
      pays, the shop lists ten rows, no console errors.

## Phase 2 — point the domain at Vercel

- [x] Vercel → Project → Settings → Domains → add both the apex
      (`example.com`) and `www.example.com`.
- [x] Vercel prints the exact records it wants. **Read them from Vercel rather
      than copying them from anywhere** — the apex A-record IP has changed
      before, and *it had changed again by the time this ran*. The values this
      doc used to guess at (`76.76.21.21`, `cname.vercel-dns.com`) were both
      wrong on the day; what Vercel actually asked for is recorded at the
      bottom. Read the screen, not this list.
- [x] Add those in Cloudflare → DNS → Records.
- [x] **Set the proxy status to "DNS only" — the GREY cloud, not orange.**
      This is the step everyone loses an evening to. With the orange cloud on,
      Cloudflare terminates TLS itself and Vercel can never provision its
      Let's Encrypt certificate, so the domain sits in "Invalid Configuration"
      forever.
- [x] Wait for Vercel to report **Valid Configuration** and the certificate to
      issue (usually minutes).
- [x] Optional: re-enable the Cloudflare proxy afterwards. If you do, set
      Cloudflare SSL/TLS encryption mode to **Full (strict)** or you get a
      redirect loop. Leaving it DNS-only is simpler and costs you nothing here —
      the game is a handful of static files on Vercel's CDN already.
- [x] Don't add an A record for `www`; CNAME is what Vercel wants.

## Phase 3 — the price of moving: every existing save is lost

**Read this before Phase 1.** `localStorage` is scoped per origin. The save key
is `dumpling-save` on `thetcd.github.io`, and on the new domain that is a
different, empty origin. So:

- Every current player — Dor, his brother, Gal — **starts from zero.**
- **Installed PWAs keep pointing at the old URL forever.** Anyone who added the
  game to their home screen will keep launching the Pages build, on the old
  origin, with the old save, indefinitely. They will never see an update.

Three options:

1. **Accept it and move NOW, before Gal promotes it.** Recommended. The player
   base is about three people, and the cost of this migration grows with every
   single player who joins. Every week of delay makes it worse.
2. **Build a one-time import bridge.** Keep the Pages site alive serving a small
   page that reads `dumpling-save` and `postMessage`s it to an iframe on the new
   origin, which writes it and marks the import done. Genuinely works, roughly
   an afternoon, and needs care so it can't be used to inject a forged save.
3. Do nothing and run two games. Don't.

Either way:

- [x] Keep the GitHub Pages deploy alive, serving a "we moved — tap here" screen
      rather than the game, so old installs are not silently abandoned.
      **Done** — `src/main.ts` renders it whenever `base` is not `/`; the game
      itself moved to `src/boot.ts`.
- [x] Make the new domain canonical: it is the only URL that should appear in
      anything Gal posts. **Done** in `README.md` and `CLAUDE.md`.

## Phase 4 — AdSense prerequisites

> ### ⚠️ Play Console changes that ads REQUIRE — do these too
>
> Asked for explicitly on 2026-08-25. Shipping ads is not only a code change;
> the Play listing declarations become **wrong the moment an ad renders**, and
> a false declaration on a child-directed app is a takedown risk.
>
> - [ ] **App content → Ads: flip to "Yes, contains ads".** It is currently
>       declared **"does not contain ads"**, which is accurate today.
> - [ ] **Redo the whole Target audience and content flow.** Play forces this
>       after the ads answer changes — it is 5 steps, not a single toggle.
> - [ ] **Expect a "Contains ads" badge** on the store listing. It measurably
>       costs installs, which is why the flag is not set pre-emptively.
> - [ ] **Self-certify a Families-compliant ad SDK.** Target audience is
>       children, so only self-certified SDKs are allowed and personalised
>       ads are off by policy. AdMob qualifies with child-directed treatment.
> - [ ] **Remove `בלי פרסומות` from the Hebrew store description.** It is in
>       the listing copy today and becomes a false claim.
> - [ ] **Re-check the Data safety form.** An ad SDK usually collects more
>       than the current aggregate analytics do; the answers in
>       `docs/GOOGLE-PLAY.md` Phase D would no longer be true.
>
> **And the architecture note:** Families-compliant ad SDKs are native, not
> web. H5 Games Ads is a *web* product and may not satisfy Families inside the
> app. Realistically ads ship with the **Capacitor migration**, together with
> iOS and Play Billing — one move rather than three. See `docs/GOOGLE-PLAY.md`.

The domain is necessary but nowhere near sufficient. In order:

- [x] **A privacy policy page**, Hebrew and English. AdSense effectively
      requires one, and for a child-directed game it is not optional. It has to
      say what is collected — which today is honestly *nothing*: no accounts, no
      analytics, no backend, one `localStorage` key that never leaves the
      device. **Shipped** as `public/privacy.html`; live at
      https://dumplingclicker.com/privacy.html.
- [x] **Something other than the game itself.** A single-page game is a common
      cause of AdSense "thin content" rejections. An about page describing the
      game, the creator and the credits is cheap insurance. **Shipped** as
      `public/about.html`.
- [ ] Apply for a normal **AdSense** account on the new domain, and get approved.
- [ ] *Then* apply for **H5 Games Ads** separately — it is a by-application
      product on top of an approved AdSense account, and access is not
      guaranteed.
- [ ] **Tag the site for child-directed treatment.** Non-negotiable: the
      audience is kids, which means personalized ads are off by policy.

### Set expectations before spending a weekend on this

Child-directed inventory serves contextual ads only, which is where most of the
money is. Google's own indicative figures for made-for-kids content are roughly
**$1–3 RPM against $5–15** for general audiences (that is YouTube, not H5 games,
so treat it as direction rather than a forecast). For a Hebrew-language kids'
game at one-YouTuber scale, realistic revenue is **tens of dollars a month, not
a business.**

The domain is worth buying regardless — it is a better URL, it makes the PWA
cleaner, and it is the only path to ads ever being possible. Just don't do it
*for* the ad revenue.

## Phase 5 — the two ad rewards, when the time comes

Both of Dor's ideas are client-side state changes. **No backend is needed** —
there is no leaderboard and nothing to purchase, so a faked reward only affects
the faker's own save, which editing `localStorage` already allows. Ad networks
only pay for real impressions, so faked completions cost nothing.

Build them behind a **stubbed ad** (a 5-second "watching…" overlay) so the game
logic, balance and tests all land now and the real SDK is a one-file swap later —
or never, at no loss.

Two traps, one serious:

- **"Extra shekels next run" must NOT touch `runEarned`.** `grant()` deliberately
  moves `dumplings`, `totalEarned` and `runEarned` together, and `runEarned` is
  the rebirth gate. Routing an ad reward through it lets a kid **watch ads to buy
  rebirth progress**, turning the meta-loop into pay-to-skip. This reward needs
  its own path that credits the bank only — deliberately breaking the
  "three counters move together" rule, so write it down loudly where it happens.
- **"Extend the golden frenzy" has a timing problem.** A rewarded video runs
  about 30 seconds and the frenzy *is* 30 seconds, so offering it mid-frenzy
  spends the entire ×7 window watching an ad. Offer it when the frenzy **ends**
  ("watch to run it again") — better UX, and it sidesteps the "never stacks"
  invariant because it is a fresh window rather than an extension.

Both change pacing and must be measured with `tools/simulate.mjs`, not reasoned
about.

## Known stale string to fix while you are in here

~~`vite.config.ts` still describes the game in its install manifest as a
dumpling empire.~~ **Fixed** — the shipped manifest now reads
`מעצבים סקווישי, מועכים אותו, ובונים אימפריה של שקלים`. (`index.html`'s
`<meta name="description">` still says כופתאות; harmless, but free to fix.)

---

## Phases 0–3: what actually happened

Done 2026-08-22. **Live: https://dumplingclicker.com/**

| | |
|---|---|
| Domain | `dumplingclicker.com`, Cloudflare Registrar, ~$11/yr |
| Nameservers | `andronicus.ns.cloudflare.com`, `surina.ns.cloudflare.com` |
| Host | Vercel project `dumpling-clicker`, team "DC's projects" (personal) |
| Linked to | `thetcd/dumpling-clicker`, production branch `main` |
| Framework | Vite, auto-detected. No `VITE_BASE` variable exists — as required |

**Two things differed from the plan above; both matter next time.**

1. **The apex A-record IP is NOT `76.76.21.21`.** It came back as
   **`216.198.79.1` and `64.29.17.1`** (two A records), and `www` as a CNAME to
   a per-project host, `5b0bef074c60248c.vercel-dns-017.com` — not the generic
   `cname.vercel-dns.com`. This is exactly why the instruction is *read the
   records off Vercel*. Anything written down here will rot too; these values
   are a record of what happened, not a thing to copy.
2. **Neither connected MCP could do the DNS work.** The Cloudflare MCP in this
   account is the *Developer Platform* one — D1, KV, R2, Workers, Hyperdrive —
   with **no DNS/zone/registrar tools at all**, and `wrangler` has no DNS-record
   commands either. The Vercel MCP can *buy* domains but cannot add one to a
   project. So the Vercel-domains + Cloudflare-DNS steps were done in the
   browser. Budget for that, or get a scoped Cloudflare API token
   (Zone → DNS → Edit) and drive the REST API instead.

**Verified on the new origin** (curl + a Playwright drive at 430×900):

- Game loads over HTTPS; cert valid; `http://` → 308 → `https://`.
- `www` → 307 → apex.
- Designer opens, a tap pays (0 → 5), the shop lists ten producer rows, zero
  console errors.
- `/privacy.html` and `/about.html` return their own HTML, not the game.
- `/.well-known/assetlinks.json` returns the placeholder JSON as
  `application/json` — the exact URL Play's TWA check hits in
  `docs/GOOGLE-PLAY.md` Phase C.
- Service worker active; **reloading with the network cut still boots the game.**
- Manifest at `/manifest.webmanifest` with `start_url` and `id` both `/`.

**Phase 3, as decided:** the save wipe was accepted and no import bridge was
built. GitHub Pages still deploys off the same `main` but now renders a Hebrew
"we moved" screen linking here — see the Deploy section of `CLAUDE.md` for how
one env var splits the two builds.

**This unblocks `docs/GOOGLE-PLAY.md` Phase C** (Bubblewrap/TWA packaging).

---

## Sources

- [AdSense H5 Games Ads](https://adsense.google.com/start/h5-games-ads/)
- [Get started with H5 Games Ads](https://support.google.com/adsense/answer/9959170?hl=en)
- [Ad protections for children and teens](https://support.google.com/adspolicy/answer/15416897?hl=en)
- [Tag a site for age-restricted treatment](https://support.google.com/adsense/answer/3248194?hl=en)
- [Vercel: setting up a custom domain](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel: migrating from Cloudflare](https://vercel.com/kb/guide/migrate-to-vercel-from-cloudflare)
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)

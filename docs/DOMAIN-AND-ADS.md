# Moving to a real domain (Vercel + Cloudflare), and what ads would need

Written 2026-08-22. The goal is a domain Dor owns, serving the game from
Vercel, because **AdSense can never be served from `thetcd.github.io`** — Google
approves the *parent* domain and lets subdomains inherit, and nobody can get
`github.io` approved. A custom domain is the prerequisite for every ad idea, not
an afterthought.

Do the phases in order. Phase 3 is the one with a cost attached; read it before
you start Phase 1.

---

## Phase 0 — pick the domain

- [ ] Choose a name a Hebrew-speaking kid can type from hearing it once.
- [ ] Register it at **Cloudflare Registrar** (sells at wholesale cost, no
      markup, and the DNS is already where you want it).
- [ ] **`.co.il` is not available through Cloudflare Registrar.** If you want an
      Israeli TLD you need an Israeli registrar and then point the nameservers
      at Cloudflare. A `.com` avoids that whole detour.

## Phase 1 — deploy to Vercel

The repo already builds correctly at a domain root; no code changes needed.

- [ ] Vercel → Add New → Project → import `thetcd/dumpling-clicker`.
- [ ] Framework preset **Vite**. Build command `npm run build`, output `dist`.
      (Both are Vercel's defaults for Vite — just confirm them.)
- [ ] **Do NOT add a `VITE_BASE` environment variable.** Leave it absent.
      GitHub Actions sets it to `/dumpling-clicker/` for Pages; Vercel must not.
      A *blank* value used to break the build (`start_url: ""`, relative
      `./assets/…` paths) — that footgun is fixed in `vite.config.ts`, which now
      treats blank as absent, but the variable still has no business existing
      here.
- [ ] Deploy, open the `*.vercel.app` URL, and check: the designer opens, a tap
      pays, the shop lists ten rows, no console errors.

## Phase 2 — point the domain at Vercel

- [ ] Vercel → Project → Settings → Domains → add both the apex
      (`example.com`) and `www.example.com`.
- [ ] Vercel prints the exact records it wants. **Read them from Vercel rather
      than copying them from anywhere** — the apex A-record IP has changed
      before. At time of writing it is typically:
      - apex `@` → **A** → `76.76.21.21`
      - `www` → **CNAME** → `cname.vercel-dns.com`
- [ ] Add those in Cloudflare → DNS → Records.
- [ ] **Set the proxy status to "DNS only" — the GREY cloud, not orange.**
      This is the step everyone loses an evening to. With the orange cloud on,
      Cloudflare terminates TLS itself and Vercel can never provision its
      Let's Encrypt certificate, so the domain sits in "Invalid Configuration"
      forever.
- [ ] Wait for Vercel to report **Valid Configuration** and the certificate to
      issue (usually minutes).
- [ ] Optional: re-enable the Cloudflare proxy afterwards. If you do, set
      Cloudflare SSL/TLS encryption mode to **Full (strict)** or you get a
      redirect loop. Leaving it DNS-only is simpler and costs you nothing here —
      the game is a handful of static files on Vercel's CDN already.
- [ ] Don't add an A record for `www`; CNAME is what Vercel wants.

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

- [ ] Keep the GitHub Pages deploy alive, serving a "we moved — tap here" screen
      rather than the game, so old installs are not silently abandoned.
- [ ] Make the new domain canonical: it is the only URL that should appear in
      anything Gal posts.

## Phase 4 — AdSense prerequisites

The domain is necessary but nowhere near sufficient. In order:

- [ ] **A privacy policy page**, Hebrew and English. AdSense effectively
      requires one, and for a child-directed game it is not optional. It has to
      say what is collected — which today is honestly *nothing*: no accounts, no
      analytics, no backend, one `localStorage` key that never leaves the
      device.
- [ ] **Something other than the game itself.** A single-page game is a common
      cause of AdSense "thin content" rejections. An about page describing the
      game, the creator and the credits is cheap insurance.
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

`vite.config.ts` still describes the game in its install manifest as
`מעצבים סקווישי, מועכים אותו, ובונים אימפריית כופתאות` — a dumpling empire.
The currency is shekels now.

---

## Sources

- [AdSense H5 Games Ads](https://adsense.google.com/start/h5-games-ads/)
- [Get started with H5 Games Ads](https://support.google.com/adsense/answer/9959170?hl=en)
- [Ad protections for children and teens](https://support.google.com/adspolicy/answer/15416897?hl=en)
- [Tag a site for age-restricted treatment](https://support.google.com/adsense/answer/3248194?hl=en)
- [Vercel: setting up a custom domain](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel: migrating from Cloudflare](https://vercel.com/kb/guide/migrate-to-vercel-from-cloudflare)
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)

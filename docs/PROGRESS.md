# Where the project stands, and what still needs connecting

Last updated **2026-08-22**. This is the handover document: everything you need
to pick the project up on a different machine, without the chat history that
produced it.

Companion docs, all in the repo — a clone is everything you need:
- **`CLAUDE.md`** — the invariants and the traps that are expensive to
  rediscover. Read it before changing game logic; Claude Code loads it
  automatically.
- **`docs/DOMAIN-AND-ADS.md`** — step-by-step runbook for the domain move.
- **`docs/DECISIONS.md`** — why the game is the way it is. Every balance choice
  with the measurement behind it, and the things that were tried and rejected.
- **`docs/superpowers/specs/`** and **`docs/superpowers/plans/`** — the original
  design specs and implementation plans, kept as written including their known
  errors (noted in DECISIONS.md).
- **`DESIGN-NOTES.md`** — real squishy-toy trait research and the v2 backlog.
- **`art-prompts-gemini.txt`** — the prompt playbook for generating real art.

---

## 1 · What the game is

A Hebrew, right-to-left, installable PWA clicker game. On first launch the
player designs their own squishy dumpling toy in a creator; that creation is the
thing they tap. Vanilla TypeScript + Vite. **No framework, no backend, free.**
Marketed through the YouTuber Gal Cohen's network — Gal appears in the game only
as the tier-10 boss, never as the main clickable.

Currency is **shekels (₪)**. The single meta-loop is **rebirth**
(`לידה מחדש`) — the word Israeli kids already know from Roblox.

## 2 · Where it lives

| | |
|---|---|
| Repo | `thetcd/dumpling-clicker` (public) |
| **Live** | **https://dumplingclicker.com/** (Vercel) |
| Deploy | Every push to `main` → Vercel builds and publishes. |
| Old URL | https://thetcd.github.io/dumpling-clicker/ — still deploys, but serves a "we moved" screen, not the game. |
| DNS | Cloudflare Registrar; records **DNS-only / grey cloud** (see below). |
| Identity | `thetcd` is the personal GitHub account, **not** `DorFordefi`. `gh auth switch -u thetcd`. |
| Tests | 320, in 20 files |

```bash
cd dumpling-clicker
npm install
npm run dev          # read the printed port — it drifts
npm run dev:phone    # LAN URL for real-phone testing
npm test             # run from THIS directory, not a parent
npm run build
git push             # this IS the deploy
```

## 3 · What is built and live

Everything below is shipped, tested and deployed.

**Core loop.** Tap the squishy for shekels; a tap is worth
`flat × upgrades + 5% of production`, so tapping stays relevant at every scale.
A free 0.5/sec trickle runs from the first second. Ten producer tiers from an
apprentice at ₪15 to Gal at ₪75B, each unit costing 15% more than the last.
Twelve click upgrades in three tiers (flat → a cut of production → critical
squish), sold **one at a time** cheapest-first.

**Findables.** Three independent lanes: a coin or cracker every 10–25s worth 5s
of production; airdrops every 25–35s worth 20s, with up to ten waiting on screen
for six minutes each; and a golden dumpling every 3–8 minutes that grants ×7 all
income for 30 seconds.

**Rebirth.** Requirement `3,000 × 1.5ⁿ` measured against what the run earned.
Reward is a permanent multiplier on all income — the first five rebirths double
you, the next ten add half each, then a quarter forever, as a *sum* of steps
never a product. **Capped at rank 50.** You keep one squishy per every 4
owned of each tier (1-4 keeps 1, 5-8 keeps 2, ..., capped at 10), the five flat
click upgrades permanently, your squishy, your settings, your lifetime totals,
and an active golden frenzy. The confirm screen
lists what survives before you commit.

**Cosmetics.** 16 body colours, 11 eyes, 11 mouths, 11 accessories — 21,296
combinations. 28 of the 49 parts are gated behind rebirth rank: one per rank for
the first 20, then 22, 24, 26, 28, 30, 33, 36, 40.

**Presentation.** A living background built from the producers you own, a themed
burst on every catch, 17 hand-drawn SVG icons, a two-stage squish spring with
idle breathing and blinking, synthesised sound effects, and a procedural 128bpm
background loop (four-on-the-floor kick, offbeat hats, saw bass, detuned
arpeggio over a four-chord progression).

**No passive income at all.** Nothing accrues unless the window is actually on
screen — not while closed, not while minimized, not in a background tab.

## 4 · Shipped in the last two days

**2026-08-21 — seven playtest notes.** Offline income removed entirely. A
rebirth no longer kills an active golden frenzy. The music was rewritten from a
74bpm ambient pad to the Roblox-style loop. The "384 → 384" dud upgrade fixed on
both counts — share upgrades now carry a flat floor so they can never buy
nothing, and the shop label falls back to a relative multiplier when the
before/after would render identically. The rebirth keep rule changed from floor
to round and the flat upgrades became permanent. `CLICK_DPS_SHARE` raised 0.01 →
0.05. All prices rounded to the figure they print.

**2026-08-22 — four more.** Currency renamed to shekels. The visibility guard
(see below — this was a real leak). The exp meter under the rebirth bar. The
rebirth cap at 50. Plus Hebrew singular/plural fixes and a `VITE_BASE` footgun.

**2026-08-23 — the ambient backdrop.** A dusk landscape now sits behind
everything: parallax hills, a village with lit windows, drifting clouds, stars
and a slow aurora (`src/ui/backdrop.ts`, `src/styles/backdrop.css`). Drawn as
animated SVG (~5KB) rather than the 2.61MB video it was based on. All motion is
CSS transform/opacity, so the single rAF loop is untouched, and it freezes under
`prefers-reduced-motion`.

Shipped twice the same day: the first cut sized tiles as a percentage of the
viewport and **looked wrong on any non-phone screen**. Tiles are now a fixed
pixel size that steps up at 900px and 1600px, so proportions hold from a 430px
phone to a 1920px desktop — checked at four widths, with the loop differing by
zero pixels at each. The reasoning, and the four traps this turned up, are in
`DECISIONS.md` and `CLAUDE.md`.

**2026-08-22, later — the origin move.** The game left
`thetcd.github.io/dumpling-clicker/` for **https://dumplingclicker.com/** on
Vercel. Every save was wiped, as planned. `src/main.ts` became a two-line
dispatcher and the game's real entry point is now **`src/boot.ts`** — the Pages
build renders a "we moved" screen instead of importing it. Details in section
7A.

**The visibility leak is worth understanding**, because it was invisible: a
backgrounded window kept earning the *full* rate. Browsers throttle a background
tab's `requestAnimationFrame` to roughly 1Hz rather than stopping it, so every
throttled frame arrived with `dt ≈ 1000ms`, slipped under the one-second stutter
clamp, and paid out a whole second of production. The clamp was never a
visibility test; it only looked like one.

## 5 · Measured pacing — don't re-derive this

Three headless tools, all reading the shipped constants so they re-measure
themselves after any balance change. **These constants are measured, never
reasoned about** — the first guess at the rebirth curve was wrong by orders of
magnitude.

| tool | answers |
|---|---|
| `tools/simulate.mjs [taps] [base] [growth] [catch]` | how long does each rebirth take |
| `tools/milestones.mjs [taps] [catch]` | when does the player stop being given anything new |
| `tools/release-policy.mjs [taps] [shipped\|repriced]` | does a weekly +5-ranks cadence stay playable |

At 5 taps/sec, catching everything:

| Milestone | Time |
|---|---|
| First rebirth | 2.9m |
| Rank 20 — half the cosmetics | 27m |
| **Rank 40 — every cosmetic unlocked** | **3.4h** |
| All 12 click upgrades | 6.4h |
| Rank 50 — max rank | 10.2h |
| Gal joins your team (still ungated) | 12.1h |

At 2 taps/sec the same run is ~16.6h to rank 50; pure idle is ~29.5h. So tapping
is about 44% faster than not tapping.

**The known problem:** every cosmetic is spent by 3.4h but the cap is at 10.2h,
so **6.8 hours of play hand out nothing new.** Re-measure any time with
`node tools/milestones.mjs 5 1`, which prints that gap explicitly.

(Gal arriving at 12.1h rather than the 16.3h measured before the cap shipped is
a side effect of the cap itself: once you can no longer rebirth, all income goes
into the shop instead of being reset, so the top tier arrives sooner.)

## 6 · Backlog, in the order it should be done

### 1. Gate the boss behind rank 50 and reprice him to ₪1B
Moved to the top on 2026-08-22, because it turns out to be a **prerequisite for
the whole release cadence** and not an independent improvement — see item 2.

Decided and measured, not built. It moves the headline reward off the curve that
stalls (producer costs) onto the ladder that keeps going. With the cap at 50 this
makes reaching max rank and meeting Gal the same moment.

Three findings that shaped it: gating him *without* the price cut is a literal
no-op (you reach ₪75B at 12.1h, already past rank 50 at 10.2h, so the rank never
binds); gating at rank 60 is three times *worse* than doing nothing; and below
₪10B the price stops affecting when he arrives and starts compressing what comes
after.

`ProducerDef` has no rank gate today — only `parts.ts` does — so this needs a new
field, a shop-reveal branch showing the required rank the way locked designer
tiles do, and a mirror in `tools/release-policy.mjs`.

### 2. Flatten the requirement curve past rank 50
**Nothing about a weekly release cadence works until this lands.** The plan is
+5 ranks per release, but `REBIRTH_GROWTH = 1.5` was tuned for a game that ends
at 50, and each release multiplies the requirement by `1.5⁵ ≈ 7.6×`.

Re-measure with `node tools/release-policy.mjs 5 repriced`. Play cost of each
batch of 5 ranks at 5 taps/sec, **with the boss repriced** (item 1 done):

| policy | 41-45 | 46-50 | 51-55 | 56-60 | 61-65 | 66-70 | 71-75 |
|---|---|---|---|---|---|---|---|
| A · cap +5 only | 2.3h | 4.4h | 68m | 5.0h | **26.6h** | **154.5h** | **702.8h** |
| B · + flatten curve to ~1.2 | 2.3h | 4.4h | 48m | 81m | 2.7h | 5.5h | 11.4h |
| C · + one ~6× income source per release | 2.3h | 4.4h | 68m | 3.0h | 6.9h | 14.0h | 27.6h |
| **D · both** | 2.3h | 4.4h | 48m | 57m | **1.6h** | **2.3h** | **3.5h** |

A kid playing ~45 min/day gets ~5h a week. So doing nothing works for four
releases and then asks for 26 hours; doing both holds every batch at 1–4h.

**Why item 1 has to come first:** run the same tool with the boss as *shipped*
(`node tools/release-policy.mjs 5 shipped`) and even policy D drifts to 26.7h by
the last batch. A "new tier per release" costs 15× of ₪75B and up, which nobody
ever reaches, so the new income source does nothing. **The reprice is what makes
the post-cap ladder affordable at all.**

Two conclusions worth keeping: the "one new thing to buy" per release is
**arithmetic, not decoration** — income has to grow ~7.6× per release or every
batch takes longer than the last. And **Gal can stay top of the shop at zero
pacing cost**, because the maths only cares that income grows, not whether it
comes from a new producer tier or a rank-gated permanent multiplier.

### 3. Backfill ranks 41–50 with rewards
The empty stretch above. This is also the only situation where the `🆕` badge
problem bites: it keys on the *exact* current rank, so a part added at rank 43
gives no badge at all to anyone already past 43. Needs either a "highest rank
whose rewards were shown" field (`heal()` defaults it, no save-version bump) or a
policy of only ever shipping ahead of everyone.

Also: `tests/unlocks.test.ts` pins "everything open by rank 40". That has to
become a bound derived from the data or every release breaks the suite.

### 4. A "what's new" surface
`registerType: 'autoUpdate'` delivers new code but silently, and can reload the
page under a player mid-frenzy. Nothing announces that the cap rose from 50 to
55. For a weekly rhythm this is the highest-value missing piece.

### 5. The two ad rewards, behind a stub
See §7 and `docs/DOMAIN-AND-ADS.md`.

---

## 7 · Integrations still to connect

### A · Domain on Vercel + Cloudflare — **DONE 2026-08-22**

The game is live at **https://dumplingclicker.com/**. Full record of what
happened, including the two ways reality differed from the plan, is in
**`docs/DOMAIN-AND-ADS.md` § "Phases 0–3: what actually happened"**. Summary:

- Domain `dumplingclicker.com` at Cloudflare Registrar (~$11/yr).
- Vercel project `dumpling-clicker`, team "DC's projects", linked to the repo,
  production branch `main`, Vite auto-detected, **no `VITE_BASE` variable**.
- Apex + `www` both on Vercel, `www` 307s to the apex. Cloudflare records are
  **DNS-only / grey cloud** — the orange cloud would have blocked the cert.
- Verified on the new origin: game plays, privacy/about render as pages,
  `/.well-known/assetlinks.json` serves the placeholder, service worker active
  and the game still boots with the network cut.

**Two things worth carrying forward:**

1. **The apex IP had drifted again.** Vercel asked for `216.198.79.1` +
   `64.29.17.1` and a *per-project* `www` CNAME, not the `76.76.21.21` /
   `cname.vercel-dns.com` this doc used to name. Always read the live screen.
2. **The connected Cloudflare MCP cannot touch DNS.** It is the Developer
   Platform server (D1/KV/R2/Workers); there are no zone or record tools, and
   `wrangler` has none either. The Vercel MCP can buy a domain but not attach
   one to a project. Both steps were done in the browser.

**The save wipe happened, as decided.** Every player starts from zero and no
import bridge was built. The old Pages URL still deploys but now shows a Hebrew
"we moved" screen linking to the new domain — see the Deploy section of
`CLAUDE.md` for how one env var splits the two builds off the same `main`.

### B · AdSense and H5 Games Ads — slower, parallel track

- [x] **AdSense can never serve from `thetcd.github.io`.** Google approves the
      *parent* domain and lets subdomains inherit; nobody can get `github.io`
      approved. The custom domain is a hard prerequisite — **now satisfied**
      (section A).
- [x] Write a **privacy policy** page, Hebrew and English. Shipped 2026-08-22
      as `public/privacy.html`. It honestly says: no accounts, no analytics, no
      backend, one `localStorage` key that never leaves the device.
- [x] Add an **about page** (`public/about.html`, same date). A single-page
      game is a common cause of AdSense "thin content" rejection.
- [ ] Apply for AdSense on the new domain. Then apply for **H5 Games Ads**
      separately — it is by-application on top of an approved AdSense account
      and access is not guaranteed.
- [ ] **Tag the site for child-directed treatment.** The audience is kids, so
      personalized ads are off by policy.

**Set expectations:** contextual-only inventory is where most of the money
isn't. Google's indicative made-for-kids figures are ~$1–3 RPM against $5–15 for
general audiences (that's YouTube, not H5 games — direction, not a forecast).
For a Hebrew kids' game at one-YouTuber scale this is realistically tens of
dollars a month. **Buy the domain for the URL and the cleaner PWA, not for the
ad revenue.**

### B½ · Google Play (Android app) — planned 2026-08-22

Full runbook in **`docs/GOOGLE-PLAY.md`**. Approach: a **Trusted Web Activity
via Bubblewrap** — a thin signed wrapper over the live site, so `git push`
stays the only deploy and the browser save and app save are the same
localStorage. Repo prep is DONE (manifest `id`, real maskable icon,
privacy/about pages, assetlinks placeholder, SW denylist), and **the domain
prerequisite is now DONE too** — Phase C (Bubblewrap packaging) is unblocked and
can start today.

**The only remaining blocker is a Play developer account** ($25 + ID
verification) and **12 testers opted in for 14 unbroken days** — the
new-personal-account rule, and by far the longest pole. Start that clock before
touching Bubblewrap. Kids app → Families policy → launches with **no ads**.

**No backend.** Both planned ad rewards are client-side state changes. There is
no leaderboard and nothing to purchase, so a faked reward only affects the
faker's own save — which editing `localStorage` already allows — and ad networks
only pay for real impressions, so faked completions cost nothing. A backend
would only be needed for cross-device saves, leaderboards, or in-app purchases.

Build both rewards behind a **stubbed ad** (a 5-second "watching…" overlay) so
the logic, balance and tests land now and a real SDK is a one-file swap later,
or never, at no loss.

**Two traps, one serious:**

- **"Extra shekels next run" must not touch `runEarned`.** `grant()` moves
  `dumplings`, `totalEarned` and `runEarned` together by design, and `runEarned`
  *is* the rebirth gate — so routing an ad reward through it lets a player watch
  ads to buy rebirth progress, turning the meta-loop into pay-to-skip. This
  reward needs its own bank-only path, deliberately breaking the "three counters
  move together" rule.
- **"Extend the golden frenzy" is mistimed by construction.** A rewarded video
  runs about 30 seconds and the frenzy *is* 30 seconds, so a mid-frenzy offer
  spends the whole ×7 window watching an ad. Offer it when the frenzy **ends**
  ("watch to run it again") — better UX, and it sidesteps the never-stacks
  invariant because it is a fresh window rather than an extension.

### D · Analytics — an open question, not a task

There is deliberately no backend, so there is **no signal on where players
actually are.** A weekly release cadence has to match real play time, and right
now the only inputs are Dor, one family member, and whatever Gal reports. Worth
deciding whether that is enough or whether one opt-in ping is worth the
complexity and the child-privacy exposure.

---

## 8 · Waiting on a human, not on code

- **Does the new 128bpm music actually sound good?** The scheduler is verified in
  a real browser — 21 kick voices at exactly 60/128s spacing, 40 detuned lead
  notes, bass 87–175Hz — but nobody has listened and judged it.
- **The squish feel on a real phone.** Never tested on hardware.
- **Does rebirth 18 feel worth tapping at now?** The ratio went from 26% of idle
  income to 112%, but that is a number, not a feeling.
- **Gal's written sign-off and real art.** He is generating via Gemini and the
  images keep coming out too photorealistic; the fix prompts are in
  `art-prompts-gemini.txt`. Until then his tier is a placeholder 👑.
- **Does Gal stay the top of the shop forever?** Now a free choice rather than a
  trade-off (see §6.1) — so it is a story decision, and his to make.

## 9 · One stale string

~~`vite.config.ts` still describes the game in its install manifest as a
dumpling empire.~~ **Fixed** — the live manifest reads
`מעצבים סקווישי, מועכים אותו, ובונים אימפריה של שקלים`.

One left, cosmetic: `index.html`'s `<meta name="description">` still says
`אימפריית כופתאות`. It is not the install manifest, so it only shows in search
and link previews.

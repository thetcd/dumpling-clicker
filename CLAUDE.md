# Dumpling Clicker — context for AI agents

Hebrew-first RTL, installable PWA clicker game. Vanilla TypeScript + Vite, no
framework, no backend, free.

**This file is only the rules that are expensive to rediscover.** For anything
else:
- `docs/PROGRESS.md` — where the project stands, the backlog in order, and the
  integrations still to connect.
- `docs/DECISIONS.md` — **why** the game is the way it is, and what was tried and
  rejected. Read it before "fixing" something that looks wrong; several odd
  choices are odd because the obvious version was measured and failed.
- `docs/DOMAIN-AND-ADS.md` — the domain-move runbook.
- `docs/GOOGLE-PLAY.md` — the Android/Play runbook (TWA via Bubblewrap; the
  domain move is a prerequisite).

## Write it down, in the same commit — Dor's standing rule

**Every change updates the doc that covers it.** There is no separate
documentation pass and no "I'll note it later": the chat that made the change
is gone next session, so anything not written down is lost. Before committing,
ask which of these the change touches, and edit it:

| what changed | where it goes |
|---|---|
| a rule or trap a future agent could trip on | `CLAUDE.md` (this file) |
| status, what shipped, what's next | `docs/PROGRESS.md` |
| a choice, and what was rejected and why | `docs/DECISIONS.md` |
| domain / hosting / ads | `docs/DOMAIN-AND-ADS.md` |
| the Play app | `docs/GOOGLE-PLAY.md` + `.claude/skills/google-play-twa/` |
| the live URL, install steps, commands | `README.md` |

Record the **reasoning and the rejected option**, not just the outcome — that is
what `DECISIONS.md` exists for, and it is the part that stops the same idea
being re-tried in six weeks.

```bash
npm test        # 320 tests. Run from THIS directory — a parent sweeps ~900 unrelated tests
npm run dev     # the port drifts; read the printed URL
npm run dev:phone  # LAN URL for real-phone testing
npm run build   # tsc + vite + service worker
git push        # this IS the deploy: Vercel publishes dumplingclicker.com
```

---

## Concept invariants — Dor has corrected these; do not drift

- **The player designs their own squishy**, and that creation is the main
  clickable, sitting in a bamboo steamer.
- **Gal Cohen appears ONLY as tier 10**, `הבוס של הסקווישים` — never as the main
  clickable. Placeholder 👑 art until his written sign-off.
- **Hebrew UI only, full RTL.** All copy lives in `src/i18n/strings.he.ts`.
  Numbers go through `src/ui/format.ts`.
- **Hebrew takes the singular at one.** `1 שקלים` and `ב־1 מקומות` are wrong the
  way "1 shekels" is. This has shipped to production twice. Any string that
  interpolates a count needs a singular branch.
- **The currency is shekels** (`STR.dumplings`, `STR.currency` = `₪`). The
  `dumplings` state FIELD keeps its name — it is a live save key.
- **Rebirth is the only meta-loop.** There is no prestige system and there will
  not be one. `state.prestige` and `unlockAtPrestige` are misnomers for
  "rebirths completed" — and they are live save keys, so renaming them without a
  real migration wipes every player.
- **Nothing pays unless the window is on screen.** No offline income, no
  catch-up on return, nothing while minimized or backgrounded.
- **Clicking must never become irrelevant.** A tap is
  `flat + CLICK_DPS_SHARE × producerDps`, and the share term is load-bearing —
  the producer cost curve is exponential, so a purely flat click ladder is a
  rounding error within half an hour.
- **A frenzy must never pay for time away.** `incomeMultiplier()` is applied
  only in `click()` and `accrue()`, never folded into `dpsOf()`.

## Traps that have already cost real time

- **`heal()` in `save.ts` defaults every missing field**, so adding a new
  `GameState` field needs **no** `SAVE_VERSION` bump — just a `heal()` line.
  Bumping `SAVE_VERSION` *without* registering `migrations[next]` in the same
  edit makes `deserialize()` return null for every existing save, which the
  loader treats as corrupt and starts the player from zero.
- **Balance constants are MEASURED, never reasoned about.** Three headless
  tools, all reading the shipped constants: `tools/simulate.mjs` (how long each
  rebirth takes), `tools/milestones.mjs` (when the player stops being given
  anything new), `tools/release-policy.mjs` (whether a weekly +5-ranks cadence
  stays playable). The first guess at the rebirth curve was wrong by orders of
  magnitude. If you change a rate, a payout, a cost or the click share, re-run
  it — and check the simulator still mirrors the rebirth keep rule and the kept
  upgrades, or every number it prints is too long.
- **The clamp on frame gaps is a STUTTER guard, not a visibility test.**
  Browsers throttle a background tab's `requestAnimationFrame` to ~1Hz rather
  than stopping it, so a throttled frame looks exactly like a legitimate one.
  `creditableGapMs(dt, visible)` needs both terms.
- **`formatNumber` is lossy on purpose** — it floors below a million and carries
  one decimal above it. Two genuinely different values collide in the *string*
  long before they collide in the maths, which is what made a real upgrade
  preview as "384 ← 384".
- **`runEarned` is the rebirth gate**, written in exactly three places:
  `click()`, `accrue()` and `grant()`. Anything crediting the balance directly
  leaves the rebirth bar frozen. Conversely, anything routed through `grant()`
  advances the gate — which is why an ad reward must NOT use it.
- **UI modules that outlive a rebirth take state GETTERS, not the state object.**
  Rebirth *replaces* the state; a captured reference reads and mutates the dead
  run. `startLoop`, `initShop`, `initSettings` and `initRebirth` all do this.
  After a rebirth, `scene.update()` and `dumpling.setAvatar()` still need an
  explicit repaint — they hold rendered output, not a getter.
- **`vite.config.ts` uses `process.env.VITE_BASE || '/'`, not `??`.** Pages
  serves from a sub-path so nothing may hardcode `/`; and a var that exists but
  is *blank* — one keystroke in a hosting dashboard — used to build
  `start_url: ""` and relative asset paths.
- **Any standalone static page needs two things**: relative links only (Pages
  serves from a sub-path) and an entry in `navigateFallbackDenylist` in
  `vite.config.ts` — otherwise the service worker's SPA fallback serves the
  game instead of the page. `privacy.html`/`about.html` are the pattern.
- **The maskable icon is `icon-512-maskable.png`, a separate asset** (art at
  74% in a full-bleed field, source `icon-maskable.svg`). Never point
  `purpose: 'maskable'` at `icon-512.png` — Android's circular crop clips its
  rounded corners and edge-to-edge art.
- **`[hidden]{display:none!important}` must stay in `main.css`** —
  `.producer-row{display:flex}` overrides the UA hidden rule.
- **`.squish-wrap`'s box is NOT the dumpling.** It spans the whole stage and its
  SVG box is 15% taller than the drawn body, so geometry checks against it are
  meaningless. Derive from viewBox fractions or `getBBox()`.
- **The backdrop loops only while everything stays inside the tile.** Each layer
  in `ui/backdrop.ts` holds two identical tiles and scrolls exactly one tile
  width. Anything drawn past `VB_W` is clipped in the second copy but not the
  first, so the whole background **jumps once per cycle** — a village house at
  x=1070 did exactly that. Tangents must match across the join too (slope out of
  x=0 = slope into x=VB_W) or the ridge corners and leaves a notch repeating the
  length of the scroll. `tests/backdrop.test.ts` pins the bounds; the tangent
  rule is only caught by eye.
- **The backdrop layers render squashed** — `preserveAspectRatio="none"` maps
  2400 units onto ~2 viewport widths but 1200 units onto the full height, so on
  a phone x scales ~0.36 and y ~0.75. A square drawn there arrives as a tall
  narrow tower; the houses are ~3× wider than tall for this reason. A viewBox
  whose aspect is far from the rendered box turns gentle hills into spikes.
- **A CSS animation outranks an inline style**, so `el.style.transform` is
  silently ignored while an animation is running — even a paused one. Any test
  that pokes a transform must set `animation: none` first, or it passes
  vacuously. This burned a seam test that "proved" the loop was fine.

## Adding content

- **A designer part** = two files: an entry in `config/parts.ts` (stable id,
  Hebrew name, optional `unlockAtPrestige`) and a matching `case` in
  `ui/avatar.ts`. `tests/avatar.test.ts` fails loudly if you do one and not the
  other. Check new parts at thumbnail size *and* on a dark body.
- **Producer or findable art** = one entry in `ui/icons.ts` keyed by the id,
  viewBox `0 0 100 100`. Always render a contact sheet and look at it — two
  icons read fine in code and failed at 30px.
- **Producers or upgrades** = config arrays only, never logic. Ids are save keys;
  never rename after ship.
- **New copy** = `strings.he.ts` only.

## Browser verification (no phone needed)

Chromium is cached under `~/Library/Caches/ms-playwright/`, but `playwright-core`
is not installed here — install it into a scratch directory, never into this
project. Context `{viewport:{width:430,height:900}, hasTouch:true, isMobile:true}`.

- **To inject a save, set `localStorage` from a same-origin NON-game URL first**
  (e.g. `/icons/icon.svg`), then navigate to the game. Setting it with the game
  open lets autosave clobber it.
- The squish handler is `pointerdown`, not `click`, and `.modal-backdrop` can
  block it.
- The "+N" floaters are a pre-allocated pool, so a `childList` MutationObserver
  never fires. Read `.floater.float-up` textContent.
- **Don't parse `#hud-num` for large values** — it switches to compact Hebrew
  ("1.4 מיליון") and a digit-stripping parse silently returns nonsense. Keep
  test production low enough to stay in plain digits.
- **Playwright cannot convincingly background a tab** — `visibilityState` stayed
  `'visible'` through `bringToFront()`, headed or not. Override
  `document.visibilityState` with `addInitScript` instead.

## Deploy

Repo `thetcd/dumpling-clicker`. **Live at https://dumplingclicker.com/** —
Vercel, building from `main` on every push. `thetcd` is the personal GitHub
account, not `DorFordefi`.

**There are two deploys off the same `main`, and they build differently:**

- **Vercel** (canonical). No `VITE_BASE`, so `base` is `/` and `src/main.ts`
  boots the game. This is the only URL to give anyone.
- **GitHub Pages** (retired, still deploying). `.github/workflows/deploy.yml`
  sets `VITE_BASE=/dumpling-clicker/`, and `src/main.ts` treats any non-`/`
  base as "this is the old origin" and renders the static "we moved" screen
  instead of importing `./boot`. Kept alive on purpose so old home-screen
  installs get a tap-through rather than an abandoned game. A failing test
  still blocks that deploy.

So `src/main.ts` is a dispatcher, not the game — **the game's entry point is
`src/boot.ts`.** Anything that used to go "at the top of main" goes in `boot`.

The origin move happened 2026-08-22 and **wiped every `localStorage` save**, as
planned — saves are per-origin and the player base was about three people.
Don't build an import bridge; that was decided against.

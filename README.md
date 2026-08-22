# דאמפלינג קליקר 🥟 (Dumpling Clicker)

Cookie-Clicker-style incremental game themed after dumpling squishy toys.
Each player designs their own squishy dumpling and squishes it to earn
dumplings; producers ("הצוות שלך") auto-generate them. The final tier is
**הבוס של הסקווישים** — Gal as a squishy dumpling.

Hebrew-first RTL, installable PWA, fully offline after first load, no backend.

## Play it

**https://dumplingclicker.com/**

Works in any phone browser. On iPhone: Share → "הוסף למסך הבית" to install it as
an app. Progress is saved in the browser, so it survives closing the tab.

Feedback → open an issue: https://github.com/thetcd/dumpling-clicker/issues

## How it plays

- **Squish** the dumpling to earn. A squish is worth `flat + 1% of your
  production`, so tapping stays worth ~25% on top of idle at every scale
  instead of becoming a rounding error once producers take over.
- **Buy producers** (10 tiers, Cookie Clicker's cost curve) and **click
  upgrades** — the cheap ones raise the flat per-tap base, the two expensive
  ones raise the share-of-production cut, so they never go dead.
- **Findables**, two lanes: something shiny every 10–25s worth 5s of
  production, and every 3–8 min either a gold copy of your own squishy —
  tap it for **×7 all income for 30s** — or an airdrop worth 90s of production.
- **Critical squishes**: past 40M the click upgrades buy a chance for a tap to
  pay up to ×12.
- **Rebirth**: spend the run for a permanent bonus and unlock designer parts.
- **Design your squishy** from 16 colours × 11 eyes × 11 mouths × 11
  accessories = 21,296 combinations.
- Away up to 8h earns at 50% rate. A free 0.5/sec trickle means the game is
  alive from the first second.

## Commands

```bash
npm run dev          # dev server (auto-picks a port if 5173 is busy)
npm run dev:phone    # dev server on the LAN — open the printed URL on your phone
npm test             # 214 unit tests: economy, save healing, actions, formatting, avatar art,
                     # spring feel, findables, scene, rebirth, unlocks, icons, notes
npm run build        # typecheck + production build + service worker (dist/)
npm run preview      # serve the production build locally
```

## Deploy

**Vercel, automatic.** Every push to `main` builds and publishes to
**https://dumplingclicker.com/**. Never commit `dist/`; the host builds it.

The old **GitHub Pages** deploy is still running off the same `main`
(`.github/workflows/deploy.yml`: `npm ci` → `npm test` → `npm run build` →
publish `dist/`; a red test turns into a failed deploy, not a broken live site).
It no longer serves the game — it serves a "we moved" screen pointing here, so
anyone who installed the old URL to their home screen gets a way across.

The difference between the two is one env var. Pages serves a project repo from
a sub-path, so that workflow builds with `VITE_BASE=/dumpling-clicker/`;
`vite.config.ts` feeds it to `base`, the manifest `start_url`/`scope`/icon paths
and the service worker's `navigateFallback`. Unset — local `dev`, `build`,
`preview`, or Vercel — it falls back to `/`. `src/main.ts` keys off exactly
that: a non-`/` base renders the moved screen, `/` imports `./boot` and starts
the game.

## Where things live

- `src/game/config/` — **all content and tuning**: producer tiers + Hebrew
  names (`producers.ts`), click upgrades (`upgrades.ts`), designer parts and
  palette (`parts.ts`), economy knobs (`balance.ts`). Renaming/rebalancing
  never touches logic.
- `src/i18n/strings.he.ts` — every UI string.
- `src/game/` — pure logic, no DOM: `economy.ts` (math), `actions.ts` (the only
  state mutators), `save.ts` (versioned localStorage saves + healing),
  `golden.ts` (golden-dumpling / frenzy timing), `loop.ts` (the single rAF loop).
- `src/ui/findables.ts` — one element per lane, driven by a single `tick(now)`
  from the game loop. `__spawnCommon()` / `__spawnGolden()` / `__spawnAirdrop()`
  in the dev console force one to appear (dev builds only).
- `src/ui/dumpling.ts` — the squish and the idle life (breathing, blinking,
  glances), all composed into one transform written by its own private rAF loop.
- `src/ui/spring.ts` — the squish curve as a pure function: an instant dent, a
  fast recovery, then the slow puff-back the real toy is named for.
- `src/ui/avatar.ts` — the layered-SVG squishy renderer (body/eyes/mouth/
  accessory). New parts = a new case here + a `parts.ts` entry.
- `src/audio/sound.ts` — synthesized audio. Rapid squishing climbs a pitch
  ladder (`COMBO_WINDOW_MS` / `COMBO_MAX`) with a sparkle chime at the top.
- `art-prompts-gemini.txt` — the prompt playbook for generating real-squishy
  art in Gemini (master body → color edits → part overlays → Gal boss).
- Gal's boss-tier art is currently the 👑 emoji in `producers.ts` — swap in
  approved art by changing that `icon` field (emoji or image path).

## Gotchas worth knowing before you change things

- **Adding a `GameState` field needs no `SAVE_VERSION` bump.** `heal()` in
  `save.ts` defaults every missing field. Bumping the version *without*
  registering `migrations[next]` makes `deserialize()` return `null` for every
  existing save, and the loader treats that as corrupt — it backs the blob up
  and **starts the player from zero**.
- **`startLoop` takes a getter, not the state object.** "Start over" replaces
  the state; a captured reference meant the `pagehide` handler wrote the dead
  object back over the fresh save, so reset silently did nothing.
- **Producer ids and upgrade ids are save keys** — never rename them after
  ship. Hebrew names and descriptions are free to change.
- **The frenzy multiplier lives only in `click()` and `accrue()`**, never in
  `dpsOf()` — the shop, the click share-term and offline earnings all need the
  raw rate, and a buff must not pay out for time you were away.
- **A designer part is two files**: `parts.ts` + a matching `case` in
  `avatar.ts`. `tests/avatar.test.ts` fails loudly if you do only one.
- Run `npm test` **from this directory** — from `~/ApiScripts` vitest sweeps
  hundreds of unrelated tests in other projects.

## Before public launch (not code)

- Written OK from Gal for the name/likeness in the boss tier.
- OG/social preview image. (Custom domain: done, 2026-08-22.)
- Privacy-friendly analytics (Plausible/GoatCounter) to measure D1 return,
  session length, share taps.

# Dumpling Clicker — implementation order + quick wins

> **STATUS 2026-08-21: all three evenings built, verified and deployed.**
> 214 tests, four green Pages deploys, live site drive-verified. Everything
> Gal asked for is on screen. The next step is his judgment, not more code —
> the mystery steamer and extra producer tiers stay parked behind that
> checkpoint. Two things changed in the doing: the shop needed one-line chips
> plus a `MAX_UPGRADE_CHIPS = 3` cap to survive twelve upgrades (measured at
> 270% of shop height otherwise), and the spring's two-stage handoff had to key
> on position rather than a timer.

## Context

The game shipped to a public URL on 2026-08-20 (whole thing built in one day, 21 commits).
`main` and `juice-pass` are identical and pushed, 181 tests green, working tree clean.
Gal — the YouTuber the game is marketed through — played it and asked for three things:
a more interactive character and background, more frequent click upgrades, and
"kids need dopamine and everything must move". Increment 1 of the response
(findables + living background + drawn art) is built; the rest is not.

Two fable planners designed the sequencing and hunted for cheap wins. Along the way
they found a real defect in the meta-loop, verified independently: **`runEarned` is
written in only two places** (`actions.ts:16` in `click()`, `actions.ts:58` in
`accrue()`). Findable payouts, offline credit and the throttled-tab settle all add to
`dumplings` and `totalEarned` but skip it — so catching an airdrop worth 90 seconds of
production moves the counter and leaves the rebirth bar frozen. Every celebration this
plan adds points at that bar, so it gets fixed first.

Outcome: three evenings that finish everything Gal asked for, then a hard stop for human
judgment before the biggest bet (mystery steamer) is built.

---

## Evening 1 — quick wins

### 1a. Fix `runEarned` (findables only)

**Decision taken:** catches credit the rebirth bar; offline and throttled-tab income stay
excluded. The simulator models neither findables nor offline, so the measured curve
(3.8h at rebirth 30, 14.4h at 40) was tuned without them, and away-time already pays at
50%. Fixing the visible lie is the goal, not re-pacing the game.

- Add `grant(state, amount)` to `src/game/actions.ts`: mutates `dumplings`,
  `totalEarned` and `runEarned` together. This also restores the rule actions.ts claims
  for itself in its header — "the ONLY place game state is mutated" — which `main.ts`
  and `loop.ts` currently violate.
- Route the findable payout (`src/main.ts`, the `rewardFor` branch) through it.
- **Do not** apply `incomeMultiplier` inside `grant` — the raw-dps rule for findables
  must survive (a frenzy must never multiply a catch).
- Leave `main.ts`'s offline credit and `loop.ts:47-49`'s settle path as they are, and
  add a one-line comment at each saying the omission is deliberate, so a future session
  doesn't "fix" it.
- Test in `tests/actions.test.ts`: `grant` advances all three counters; a frenzy does not
  inflate it.

### 1b. Celebrate the first of every producer tier

Nine of the ten tiers currently get no on-screen celebration — only the boss opens a
modal. The hook already exists: `src/main.ts` already computes first-of-tier as
`(state.producers[id] ?? 0) <= 1` to choose the jackpot sound.

- In that same branch, fire `toast()` (already in `ui/settings.ts`) with the tier name,
  plus `playPop()` — which is fully built in `sound.ts:138-151` and called nowhere.
- **Trap:** `toast()`, never `showModal()`. Modals are one-at-a-time and would clobber
  the boss modal on the boss purchase, and interrupt the purchase-mash loop.
- One new string in `src/i18n/strings.he.ts`.

### 1c. Give the golden dumpling its own catch sound

`playGolden()` (`sound.ts:248-264`) is built and unreferenced; `main.ts:95` plays the
generic `playCatch()` for all three findable kinds. Change to
`kind === 'golden' ? playGolden() : playCatch()`.

**Trap:** keep `playCatch()` for coin and airdrop — it owns the catch-streak pitch ladder
(`sound.ts:299-303`); routing golden through it would advance that streak oddly.

### 1d. Rebirth celebration modal

Rebirth is the game's biggest moment and currently gets a 1.8-second toast
(`main.ts:143`), while the boss purchase gets a full `celebration: true` modal.

- Replace the toast with `showModal({celebration: true, …})`: new rank, **how many
  designer parts just unlocked**, and buttons "עצבו עכשיו" (opens the designer),
  "שתפו", "סגירה".
- Count new parts by filtering `unlockAtPrestige === state.prestige` across
  `BODY_COLORS/EYES/MOUTHS/ACCESSORIES` in `game/config/parts.ts`; `game/unlocks.ts`
  already owns the gate logic.
- **Why it matters:** 28 of 49 parts are prestige-gated, so new parts *are* the payoff
  for rebirthing, and nothing currently tells the player it happened. It also puts a
  share surface at peak excitement, where today sharing is buried in settings.
- **Traps:** the confirm modal closes before `onClick` runs, so opening another modal
  there is safe. "Design now" must use the same designer callback wiring as
  `initSettings` (setAvatar + `findables.setAvatar` + save) or the golden findable keeps
  the old look. Some ranks unlock zero parts — the copy must degrade.

**Verification for evening 1:** unit tests for `grant`; browser drive at 430×900 with
touch (playwright-core into the scratchpad, never the game's package.json) — use
`__spawnAirdrop()` and assert `.rb-fill` width changes; buy a first stall and assert the
toast; force a rebirth and check the modal at ranks with and without new parts.

---

## Evening 2 — slow-rise + idle life (spec §1 + §2)

**These must be one session.** Both live inside `frame()` in `src/ui/dumpling.ts`, which
writes `wrap.style.transform` wholesale every frame. Splitting them means re-tuning the
same 15 lines twice.

**Spec correction:** §2 says "no second loop; the golden dumpling's `tick(now)` is the
precedent" — that points at the wrong loop. `dumpling.ts` owns a *private* rAF loop and
that loop owns the transform. Idle life belongs inside it, never in `loop.ts`'s
`tickGolden` hook, or `frame()` clobbers it a frame later.

- **Slow-rise:** track `lastTapAt` in the existing `pointerdown` handler; make the
  release-phase spring params a function of `now - lastTapAt` — today's k=320/c=9 snap
  near zero, interpolating past ~400ms toward a two-stage recovery (fast to ~70%, slow
  crawl to 0 over 1-1.5s). Keeps 5-taps/sec snappy, which is what the game is tuned for.
- **Testability:** extract the spring step into a pure exported
  `springStep(s, vel, target, params, dt)` and unit-test the trajectory. Nothing in
  `ui/dumpling.ts` is currently tested, so without the extraction there is nothing to
  assert.
- **Breathing:** slow sin oscillation (~1-2%) composed into `sx`/`sy` before the single
  transform write, gated by `s < ε` so it never fights an active squish.
- **Blinking — spec correction:** §2 assumes an addressable eyes group; there isn't one
  (anonymous `<g>`, positionally second). Blinking via `setAvatar` would be two full
  innerHTML swaps of ~30 nodes, several times a minute, forever. Instead have
  `avatarSVG` emit `class="eyes"` on the chosen group plus a pre-rendered
  `display:none` `<g class="eyes-blink">` holding the existing `closed` art
  (`avatar.ts:62-65`), and toggle `display` for ~120ms on a random 3-7s timer. Skip when
  the chosen eyes are `closed` or `dizzy`. Verify the golden findable's `fillOverride`
  path still renders.
- **Glances:** small rotation/offset on a longer timer — **cut this first** if the
  session runs long; breathing + blink deliver most of "it's alive".
- `prefers-reduced-motion` (already handled in the CSS) should stop breathing and
  glances but keep the squish.

---

## Evening 3 — upgrade density + crit tier (spec §4)

5 upgrades → 12, per the spec's tables: flat tier at 100/400/1,000/4,000/15,000, share
tier at 60k/200k/800k/5M, crit tier at 40M/400M/4B.

**Keep crit, don't take the fallback.** DESIGN-NOTES names variable reward as the genre's
strongest pull and the golden dumpling already proved it here; the fallback's
×1.15/×1.12/×1.1 chips are precisely the "anticlimactic" reward the spec itself
diagnoses. Crit's blast radius is small because it sits outside `dpsOf()` and offline —
it's a bounded, tunable EV knob.

- Add `critChance?` / `critMult?` to `UpgradeDef`; derive with a small exported
  `critParams(upgradeIds)` in `economy.ts` taking the max of each. Keep it **out** of
  `clickValueFrom`, `dpsOf()` and `offlineEarnings`, same as frenzy.
- Roll inside `click(state, now, rand = Math.random)`.
- **Spec correction — the return type ripples.** `click()`'s return is consumed by
  `main.ts:79` (feeds `spawnFloater`) *and* by `tools/simulate.mjs:76`. Returning
  `{earned, crit}` means fixing both callers and any test reading the return.
- **Two simulator traps, both mandatory:**
  1. **The greedy shopper values crit upgrades at exactly zero.** It prices upgrades as
     `clickValueWith - clickValue` (`simulate.mjs:60`), and crit is deliberately outside
     `clickValue` — so the sweep would never buy the 40M/400M/4B upgrades and would
     silently not measure them. Add an EV term via an exported `critEV(upgradeIds)`
     shared by the simulator and a unit test.
  2. **Determinism.** Pass an injected `rand` (seeded LCG, or `() => 1` plus an EV
     multiplier) so sweeps are reproducible. "MEASURED, never reasoned" only holds if
     runs repeat.
- **Measure before shipping:** with the full crit tier, tap EV is ×2.1 on a ×10.5 share,
  so an active tapper at endgame earns roughly **+110% over idle** versus today's tuned
  25%. The spec calls the increase deliberate but never simulated it. Run
  `node tools/simulate.mjs 2 3000 1.5` and `5 3000 1.5` before and after; if 5-taps/sec
  compresses late rebirths hard, tune `critMult`/`critChance` down, not the share table.
- **Ship the crit's UI in the same session** — bigger gold floater, jackpot shimmer — or
  a 5% roll is invisible and the code is wasted.
- **Shop-space trap:** `UPGRADE_REVEAL_FRACTION` 0.4 must still hold at 12 upgrades. With
  100/400/1,000/4,000 early costs, up to three chips can reveal at once around 1,600
  earned; `#shop` is capped at 44dvh and chips push producers — the exact regression
  measured before. Browser-verify at several bank levels on 430px.
- Tap gates stay ≤300 (already enforced by `tests/economy.test.ts`). Never rename the
  five existing ids — they are save keys. No `SAVE_VERSION` bump: additive ids heal fine.

---

## Checkpoint — deploy and get judgment

Push and let Gal, Dor and ideally a child play. At this point everything Gal asked for is
on screen and nothing of his feedback is outstanding. What comes back aims the next
phase. **Do not start the mystery steamer before this.**

---

## After the checkpoint

**Mystery steamer (spec session + 2-3 build sessions).** The strongest retention idea in
DESIGN-NOTES and the only unspecced item. Spec first — earn mechanism should ride the
existing findables scheduler rather than adding a third timer system; recommend
**finishes-only** drops for v1 (glitter/galaxy/glow/gold), since raiding the
prestige-gated parts pool would cannibalize the rebirth reward structure `parts.ts`
deliberately built. Cut the share prompt and any filter-heavy finish from v1. New
`GameState` field means: `heal()` line, carry-over in **both** `rebirth()` and
`resetGame()`, and — only if a pull ever affects income — `simulate.mjs`'s manual reset
at lines 109-116. Keeping v1 purely cosmetic keeps the simulator untouched. Reuse
`avatarSVG`'s `fillOverride` for the collection board's silhouettes.

**More producer tiers — defer, possibly drop for now.** The wall is at rebirth ~40, past
34 hours of cumulative play; no human has been near it. It also carries an unresolved
narrative problem: tier 10 is Gal, and the celebration modal frames him as the peak —
tiers above him either dethrone the marketing partner's cameo or need a framing decision
that belongs in a conversation with Gal, which the checkpoint provides free. Cheap to
build later (config entries + simulator sweeps to 60 rebirths).

**Parked quick wins**, in impact order: daily streak in the welcome-back modal (best
backend-less retention lever, an evening, and the carry-over enumerations in
`rebirth()`/`resetGame()` are the foot-gun — a streak wiped by rebirth would be exactly
backwards); share the squishy as an image via `navigator.share({files})` rather than text
(the child's own design is the shareable object) plus OG meta tags so links stop
unfurling blank; surface lifetime stats in the settings sheet (`totalClicks`,
`playtimeMs` and `createdAt` are tracked and displayed nowhere — verified); a one-time
"tap me" hint gated on `stats.totalClicks === 0` for the first 60 seconds.

**Housekeeping (20 min, zero risk):** README is stale three ways — "99 unit tests" (181),
"golden dumpling every 5-15 min" (two lanes, rare is 3-8 min), and it documents
`src/ui/golden.ts`, which no longer exists. Move `shop.ts:163`'s hard-coded `0.25`
producer-reveal fraction into `balance.ts` as `PRODUCER_REVEAL_FRACTION` beside
`UPGRADE_REVEAL_FRACTION`.

---

## Verification

- `npm test` from the project dir (never `~/ApiScripts` — vitest there sweeps 900
  unrelated tests). All must pass: a red test blocks the Pages deploy.
- Balance changes: `node tools/simulate.mjs 2 3000 1.5` and `5 3000 1.5` — the defaults
  (2 / 5000 / 2.6) do **not** match shipped constants, so always pass them.
- Feel and UI: browser drive at 430×900 `hasTouch` with playwright-core installed into
  the session scratchpad. Inject saves from a same-origin non-game URL first (the game
  clobbers localStorage on navigation); tap via a real `PointerEvent('pointerdown')`,
  not `page.click`; read `.floater.float-up` textContent rather than diffing `#hud-num`.
- Deploy is `git push`; follow with `gh run watch`.
- Per Dor's cross-skill rule, update `~/.claude/skills/dumpling-clicker/SKILL.md` in the
  same session as any structural change.

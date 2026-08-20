# Juice pass: living character, living background, denser upgrades

Date: 2026-08-20
Branch: `juice-pass`
Status: awaiting review

## Why

Gal reviewed the game and asked for three things: a more interactive character,
a more interactive and more colourful background, and more frequent click
upgrades. His summary was "kids need dopamine and everything should move".

Reading the code confirms all three, specifically:

- The background is two dark purples in a static vertical gradient
  (`--bg-top: #2c2033` to `--bg-bottom: #191219`). No elements, no motion.
- The main dumpling is frozen between taps. The spring in `dumpling.ts` only
  runs while a squish is settling. The *golden* dumpling, a rare visitor, has
  an idle bob and a pop-in, so the incidental character is livelier than the
  hero.
- There are 5 click upgrades. The last costs 5M; the boss producer costs 75B.
  About 20 of a 25-hour run has no click upgrade left to find. The mid-game
  gaps are 15k to 200k with nothing in between, then 25x to 5M.

Everything else in the game already works and is verified. This pass changes
how it feels, not what it does.

## Goals

1. The dumpling is visibly alive when nobody is touching it, and squeezing it
   feels like squeezing the real toy.
2. The background gains colour, motion, and progression, so buying a producer
   changes the world instead of only a number.
3. Click upgrades arrive often enough to keep a player curious, across the
   whole run rather than only the first 0.007% of the cost curve.
4. There is more than one thing worth watching the screen for, and the
   framework to add more without new code.

## Non-goals

- Face reactions to combo, and drag-to-stretch. Both were considered and cut.
- Prestige. Designed separately, parked until this ships.
- Real art. Scene props are placeholder shapes and emoji, swappable through
  config once Gemini output is usable.
- Analytics.

## 1. Slow-rise puff-back

`src/ui/dumpling.ts`

The real toy squishes instantly and re-inflates slowly. DESIGN-NOTES records
the target curve from that research: fast squish, quick recovery to about 70%,
then a slow final puff over 1 to 1.5 seconds.

The spring becomes asymmetric. Compression keeps today's stiffness. Recovery
runs in two stages, the second deliberately slow.

**The constraint that shapes this.** The game is tuned around tapping at about
5 per second, which is a tap every 200ms, far inside a 1.5s puff. A slow tail
that always runs makes fast tapping feel mushy, which is the opposite of what
this pass is for. So recovery rate scales with time since the last tap: under
rapid tapping the response stays snappy, and the full slow puff only expresses
once tapping stops.

Feel knobs stay where they are, in `frame()`, and stay named so they can be
tuned without touching logic.

## 2. Idle life

`src/ui/dumpling.ts`, `src/ui/avatar.ts`

Three behaviours, all driven from the existing rAF loop. No second loop; the
golden dumpling's `tick(now)` is the precedent.

**Breathing.** A slow scale oscillation folded into the spring's per-frame
transform. It cannot be a CSS animation: JS owns `transform` on `.squish-wrap`,
and a CSS animation on the same property would fight it. This is the same trap
that already forced `.squish-wrap` to centre with `inset-inline`/`margin-inline`
instead of transform.

**Blinking.** The eyes group swaps to the existing `closed` eye art for about
120ms on a random 3 to 7 second timer. Reuses shipped art, no new part needed.
Skipped when the player's chosen eyes are `closed` or `dizzy`, where a blink
either reads as nothing or reads as broken.

**Glances.** A small rotation and offset on a longer random timer, so the
character occasionally looks around.

## 3. Living background

**Supersedes the unlockable-scenes idea.** Scenes that changed every few hours
did not answer the actual complaint, which is that the screen is dead right now.
This delivers progression-driven backgrounds out of the same mechanism, so
building both would be duplicated work.

Two layers behind the hero, both inert to pointers, both CSS-animated so nothing
joins the single rAF loop.

**Layer 1, always on: the team you own.** The background fills with the
producers you actually bought, using the emoji already in `producers.ts` (the
config comment there always said icons could become art paths without code
changes). Sprites per tier grow logarithmically with the count — 1 owned shows
1, 4 shows 3, 16 shows 5 — and only the highest `SCENE_TIERS_SHOWN` owned tiers
render, so the world evolves rather than accumulating: stalls give way to
factories, factories to cities.

Positions are a pure hash of (tier, index), never random. With random placement
every purchase re-rolls the crowd and all the workers teleport, which looks fine
in a screenshot and awful in the hand.

The crowd is clamped to the band above the hero. The squishy is ~70% of stage
width and sits at the bottom, so mid-stage sprites are invisible — measured, 3
of 11 showed before the band was clamped.

**Layer 2, on every catch: a themed burst.** The burst reuses the emoji the
player just tapped, so a coin rains coins and a gem rains gems with no per-skin
configuration. A golden catch additionally washes the scene gold, tying the
background to the frenzy that just started. Particles come from a pre-allocated
pool, the way `popups.ts` already handles floaters.

Reactions alone were considered and rejected: a burst only fires on a catch, so
the screen would be alive maybe 10-20% of the time and dead in between, which is
the original complaint with pauses.

## 4. Upgrade density

`src/game/config/upgrades.ts`

From 5 upgrades to 12, spread across the whole cost curve.

The existing rule holds: flat multipliers only matter while dps is near zero,
so nothing above ~15k is priced as a flat multiplier. That rule exists because
`grandma-hands` and `quantum-squish` were flat ×3/×5 traps worth 3 to 7 times
less than simply buying buildings, fixed earlier today.

**Flat tier**, denser early so the first ten minutes hand out something every
minute or two:

| Cost | Effect | Gate (taps) |
|---|---|---|
| 100 | ×2 | 10 (existing `fast-fingers`) |
| 400 | ×2 | 25 (new) |
| 1,000 | ×2 | 50 (existing `silk-gloves`) |
| 4,000 | ×2 | 110 (new) |
| 15,000 | ×3 | 200 (existing `secret-technique`) |

**Share tier**, above 15k:

| Cost | Effect | Gate (taps) |
|---|---|---|
| 60,000 | share ×1.5 | 350 (new) |
| 200,000 | share ×2 | 700 (existing `grandma-hands`) |
| 800,000 | share ×1.4 | 1,200 (new) |
| 5,000,000 | share ×2.5 | 2,000 (existing `quantum-squish`) |

Compounded that is ×10.5 on `CLICK_DPS_SHARE`, so a tap is worth about 10.5%
of one second of production, which at 5 taps per second is roughly 52% on top
of idle. Today's tuned figure is 25%. The increase is deliberate: rewarding
tapping more is exactly what Gal asked for.

**Crit tier**, above 5M. This is the part that needs your decision.

Continuing with share multipliers past 5M would mean multipliers of ×1.1 to
×1.15 to avoid tapping swamping idle play entirely. A reward that reads "×1.12"
is anticlimactic, which defeats the purpose of adding it.

Instead the last three upgrades add a critical squish: a random chance for a
tap to pay several times its value, with a bigger floater and the jackpot sound
that `playPurchase(tier, jackpot)` already has.

| Cost | Effect | Gate (taps) |
|---|---|---|
| 40,000,000 | 5% chance of ×7 | 3,000 |
| 400,000,000 | crit chance 5% to 10% | 4,500 |
| 4,000,000,000 | crit multiplier ×7 to ×12 | 6,500 |

This is variable reward, the lever DESIGN-NOTES already identifies as the
strongest psychological pull in the genre and the reason the golden dumpling
worked. It reads as exciting at every step, and its contribution is a tunable
expected value rather than a compounding multiplier.

Crit is a roll inside `click()`, returning a flag the UI reads. It stays out of
`dpsOf()` and out of offline earnings, same as frenzy.

**Fallback if crit is rejected at review:** three more share upgrades at ×1.15,
×1.12 and ×1.1, landing near the same endgame value with less excitement and
less new code.

All exact numbers above are proposals, pinned by a simulation test rather than
by arithmetic in this document.

## 5. Findables

New: `src/game/config/findables.ts`, `src/game/findables.ts`

Things that appear on screen, wait to be tapped, and pay out. The first is a
dumpling airdrop package. It is written as a config-driven family rather than a
single item, so a mystery box or anything else later is a data entry rather
than new code, matching how `producers.ts` and `parts.ts` already work.

The golden dumpling is not folded into this. It grants a temporary multiplier;
findables grant a payout. Different mechanics, kept separate.

**Airdrop reward.** `max(dps * AIRDROP_SECONDS, floor)` where `AIRDROP_SECONDS`
starts at 90. It scales itself at every stage, needs no per-stage table, and
cannot go stale when the producer curve changes. The floor keeps it from being
worthless in the first minutes and is expressed in click values, not a constant,
so it also self-scales.

The payout derives from `dpsOf()`, which is raw. **A frenzy does not multiply
an airdrop.** Findables are not `click()` or `accrue()`, so they stay outside
`incomeMultiplier` entirely, consistent with the rule that keeps frenzy out of
`dpsOf()` and offline earnings. Findables also never pay offline: they exist on
screen and have to be tapped.

**Two lanes, one slot each.** Kids need something happening every few seconds,
not every few minutes, so findables split into two independent lanes. Each lane
holds at most one thing at a time.

| Lane | Interval | Contents | Payout | Placement |
|---|---|---|---|---|
| common | 10-25s | coin, dollar, gem, star, red envelope, fortune cookie | 5s of production | edge margins only |
| rare | 3-8 min | golden dumpling, airdrop package | frenzy / 90s of production | face-protected centre |

A single shared slot does not work at this frequency: something spawning every
10 to 25 seconds and living 7 would occupy the slot almost permanently and
starve the golden dumpling, turning the rare reward into a thing that never
happens. Separate lanes keep the rare rewards rare and the common ones constant.

The common lane's skins are cosmetic variety over one mechanic, not six
mechanics. Rotating the art is what keeps it feeling fresh; the payout maths is
identical.

**The common lane never covers the character or the tap target.** It spawns in
the margins beside and above the squishy, sized small. At this frequency an
element landing over the face would make the game annoying rather than
exciting, and it must never intercept a squish.

**Income impact is deliberate and unmeasured.** 5 seconds of production every
17.5 on average is roughly +29% if every one is caught; with the rare lane on
top the total lands near +65%, which would pull a 25.5-hour first run toward
15. That is an estimate. Every interval, duration and payout is a named knob in
`balance.ts` so retuning after playtesting never touches logic.

**The scheduler gets extracted.** `ui/golden.ts` currently owns spawn timing,
lifetime and rescheduling as private mutable state with no `tests/` coverage,
which is exactly how the "catching one spawns the next instantly" bug shipped
and stayed hidden. A second spawner makes sharing that logic necessary rather
than optional, so it moves into a pure reducer in `src/game/findables.ts` over
`(state, event, now, rand)`, unit-tested without a DOM. `ui/golden.ts` becomes
a thin element adapter.

The rule that fix established carries over: clearing something from the screen
and scheduling the next spawn are one operation, and no exit path may do one
without the other. That becomes a test rather than a comment.

## Save compatibility

No `SAVE_VERSION` bump. New upgrade ids simply do not appear in existing saves,
and `heal()` defaults every missing field. The current scene is derived from
producers owned, so it is not stored and cannot desync.

Bumping the version without registering a migration would return `null` from
`deserialize()` for every existing save, which the loader treats as corrupt: it
backs the blob up and starts the player from zero. Not needed here, so not done.

## Performance and motion

The single rAF loop stays single. Background motion stays on the compositor.
Budget is 60fps on a mid-range Android, measured rather than assumed, because
"everything moves" is also how a cheap phone becomes a slideshow.

`prefers-reduced-motion` currently silences only the golden dumpling and the
frenzy badge. It gets extended to reduce rather than eliminate: scene colours
and the squish stay, parallax and idle drift stop.

## Testing

Unit tests, following the existing TDD split of pure logic in `tests/`:

- Slow-rise recovery curve: fast tapping keeps the response snappy, a pause
  produces the slow puff.
- Upgrade table: no upgrade is dominated by a more expensive one, extending the
  guard `tests/economy.test.ts` already applies to producers.
- Endgame click share lands on target with every share upgrade owned.
- Crit expected value, and crit excluded from `dpsOf()` and offline earnings.
- Scene selection from producers owned, including the boss flourish.
- The findable scheduler: clearing always reschedules, from every exit path
  including a catch. This is the regression guard for the bug fixed on
  2026-08-20 and the reason the scheduler is being extracted.
- Only one findable is ever on screen at once.
- Airdrop payout scales with dps, respects the floor, is not multiplied by an
  active frenzy, and never pays offline.

Browser verification on a 430x900 touch viewport, per the established pattern:

- Every body colour against every scene, as a contact sheet.
- Idle animation actually runs with no input.
- Scene transition fires on the unlocking purchase.
- Frame rate under tapping with the busiest scene active.

## Rollout

Built on `juice-pass`, deployed as a Vercel preview so the GitHub Pages link
already shared with testers keeps working. `VITE_BASE` defaults to `/`, so
Vercel needs no configuration change. Merge to `main` only after Gal and the
brother have seen the preview.

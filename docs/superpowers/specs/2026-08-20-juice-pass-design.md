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

## 3. Scene backgrounds

New: `src/ui/background.ts`, `src/game/config/scenes.ts`

Five scenes, unlocked by owning the first unit of a producer tier, following
the config-not-logic split the producers and parts already use.

| Scene | Unlocks at | Direction |
|---|---|---|
| מטבח ביתי | start | warm and cosy, lighter than today's purple |
| דוכן ברחוב | first `kindergarten` | daylight, street colour |
| מאפייה | first `bakery` | warm ovens, richer saturation |
| עיר הסקווישים | first `army` | bright city, busiest layer count |
| חלל | first `space` | vivid, high contrast, most motion |

Buying the boss adds a flourish to the final scene rather than a sixth scene.

Each scene is a palette plus three or four parallax prop layers (steam wisps,
drifting lights, floating mini dumplings, scene-specific objects). Props are
CSS and SVG shapes plus emoji as placeholders, defined in config so real art
drops in by editing data.

Motion is CSS transforms on the prop layers, so it runs on the compositor and
costs no per-frame JS.

Palette moves from global constants to per-scene custom properties. `--bg-top`
and `--bg-bottom` stop being fixed. The designer screen keeps a fixed neutral
background so part thumbnails stay judgeable.

**Unlocking is a moment**, not a swap: crossfade plus a celebration beat reusing
the escalating `playPurchase` audio. This is the payoff that makes the feature
worth building rather than repainting.

**Contrast risk.** The avatar has known readability limits on dark bodies, and
the `shekel` eyes carry a cream halo specifically to survive them. Brighter
scenes put all 16 body colours at risk. Verification is a rendered contact
sheet of every body colour against every scene, checked by eye. Not assumed.

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

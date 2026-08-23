# Why the game is the way it is

A decision log. `CLAUDE.md` says what the rules are; this says **why**, and what
was tried and rejected. Written 2026-08-22, mostly reconstructed from the work
itself.

Read this before "fixing" something that looks wrong. Several of the odd-looking
choices here are odd because the obvious version was measured and failed.

---

## The governing rule: balance is measured, never reasoned about

Every constant in `src/game/config/balance.ts` came out of
`tools/simulate.mjs` playing the game headlessly, second by second. This is not
ceremony. The first guess at the rebirth curve used growth 2.6 and predicted a
pleasant ramp; measured, it reached **341 hours** by rebirth 25. Reasoning about
two exponential curves interacting does not work.

Three tools, all reading the shipped constants:

| tool | question |
|---|---|
| `simulate.mjs` | how long does each rebirth take |
| `milestones.mjs` | when does the player stop being given anything new |
| `release-policy.mjs` | does a weekly +5-ranks cadence stay playable |

**If you change a rate, a cost, a payout or the click share, re-run them.** And
check they still mirror the rebirth keep rule and the kept upgrades — a
simulator that models a cold restart the game no longer does reports every run
length too long.

## Clicking

**A tap is `flat × upgrades + CLICK_DPS_SHARE × producerDps`.** The share term
is load-bearing, not a bonus. The producer cost curve is Cookie Clicker's, which
grows exponentially, so a purely flat click ladder becomes a rounding error
within half an hour. Only a term proportional to production holds a ratio steady
at every scale.

- `producerDps`, **not** `dpsOf` — the free `BASE_DPS` trickle must stay out, or
  a starting tap is worth 1.005 instead of a clean 1.
- **`CLICK_DPS_SHARE` is 0.05**, raised from 0.01 on 2026-08-21. At 0.01, Dor at
  rebirth 18 had 1.2k per tap against 23k/sec passive and reported that clicking
  wasn't worth doing. He was right: five taps a second bought 15% of idle income.
  At 0.05 the same five taps are worth ~110% of idle at *any* production level.
- **A flat multiplier can never fix this.** It lifts the ratio at one scale and
  decays to nothing as production grows. `tests/economy.test.ts` pins the ratio
  across four decades of production for exactly that reason.

**Two upgrades were once traps.** `grandma-hands` and `quantum-squish` were flat
×3/×5 at high prices, which measured 3–7× *worse* per dps than simply buying a
building. They became `shareMultiplier` upgrades. Rule that came out of it: never
price a flat multiplier above ~15k **as the only effect**.

**Crit lives outside `clickValue()` on purpose.** A crit is a dice roll on a live
tap, so folding it in would put randomness into the shop's before/after preview,
into `dpsOf()`, and into every rate readout. The cost is that the simulator's
shopper prices crit upgrades at exactly zero unless given `critEV` — without
that term it never buys them and reports a curve for a game nobody plays.

## The "384 → 384" bug — two faults that looked like one

Dor reported buying a click upgrade and watching the number not change. It
reproduced exactly at rebirth 9 with no producers owned, and it was **two
independent bugs**:

1. **A real dud.** A `shareMultiplier` upgrade is worth `share × producerDps`, so
   with nothing owned it bought literally nothing. And since the shop sells one
   upgrade at a time in cost order, the player couldn't route around it. Fixed by
   giving every share upgrade a flat multiplier as a **floor**.
2. **A lying label.** `formatNumber` is lossy by design — it floors below a
   million and carries one decimal above it — so two genuinely different values
   collide in the *string* long before they collide in the maths. Fixed by
   falling back to a relative `×N` whenever before and after would render
   identically.

The invariant that came out of it: `tests/economy.test.ts` asserts every upgrade
gains ≥1.2× at every production level **it can actually be offered at** (zero up
to `cost/60`). The reverse case — a ₪100 upgrade against 100k/sec — is not a real
state, and chasing it is what the share tier exists for.

## Shop copy: say the effect, never the resulting value

The label was once a universal `מעיכה: 2 ← 4`, which reads as *your click becomes
4*. With several ×2 upgrades on the shelf, each doubling from the same current
value, every one of them promised 4 at a different price — and Dor reported them
as **the same upgrade duplicated**. They weren't.

So each tier is phrased differently: a flat multiplier says `×N` (relative, true
in any buy order); a share upgrade keeps before/after (its gain depends on live
production, which nobody can compute in their head); a crit upgrade describes the
roll, because before/after is *wrong* there — crit is outside `clickValue`, so it
rendered "49 ← 49".

**`MAX_UPGRADE_CHIPS = 1`.** Two chips side by side read as one upgrade listed
twice at two prices. Selling them in sequence makes the ladder legible. It also
fixes the layout problem it was first written for: twelve four-line cards
measured at **270% of the shop's height** on a 430px phone, pushing every
producer row — the core purchase loop — off screen.

## Rebirth

**The requirement grows exponentially; the reward grows in flattening steps.**
That combination is what makes rebirth 1 take three minutes and rebirth 40 take
twenty, with the same button. A compounding reward against an exponential
requirement makes late rebirths a formality; a linear requirement makes them all
identical.

The multiplier is a **sum of steps, never a product** — ×2 compounding would be
×2³⁰ by rank 30 and the game would be over. First five rebirths add +100% each,
next ten +50%, then +25% forever.

**The scalar is applied ONCE**, at the outer edge of `dpsOf()` and `clickValue()`
— never inside `producerDps`, which the click share-term reads raw. Doing both
squares it.

**`totalEarned` is lifetime and survives; `runEarned` is the gate and resets.**
`totalEarned` drives which upgrades are revealed, so a rebirthed player doesn't
have to re-earn the right to see a shop they already know.

**The keep rule is one-per-4 owned (capped at 10), and it used to be a fraction.**
Under floor-25%, owning 3 of a tier kept nothing while owning 4 kept one — Dor
reported the kept amounts as "not consistent". Rounding fixed most of it but a
single unit still rounded to zero and vanished, which Dor hit with one kindergarten
and reported as a bug (2026-08-22). Now `ceil(owned / 4)` capped at 10 per tier:
owning anything keeps at least one, stateable in a sentence, and the cap keeps a
huge late-game board from trivialising the next run (measured: cap timing moved
10.1h -> 9.9h at 5 taps/sec, 16.6h -> 16.1h at 2). The five flat click upgrades
are permanent, and **the confirm modal states what survives before you commit** —
half of consistency is the rule, the other half is being able to see it. It reads
from the same functions the reset uses, so the promise can't outrun the outcome.

**An active golden frenzy survives a rebirth.** It's wall-clock and belongs to
the *player*, not the run. Killing it taught players to sit on a rebirth they had
already earned.

**Capped at rank 50** since 2026-08-22. The cap is the **content boundary, not a
balance knob**: 50/50 is finishing the game as it currently exists, and a release
raising it is the reason to come back. It also deleted the worst-paced stretch
for free — rank 60 measured 33.8h and rank 70 308h, and neither is reachable now.
The underlying cause is untouched and structural: only ten producer tiers, so
past the top, extra income costs 1.15× more per unit and growth turns
logarithmic. **That wall returns the moment a release pushes the cap past ~55.**

**"Rebirth" is `לידה מחדש`, and reset must never resemble it.** Reset destroys
the save. It once read `התחלה מחדש` — one word away. It is now `מחיקת הכל`.

**There is no prestige system and there will not be one.** A second meta-layer
(reach the boss, earn "prestiges" worth ×3 each) was designed and then dropped:
`לידה מחדש` is the word kids already know from Roblox, and two ladders with two
names is one too many. `state.prestige` and `unlockAtPrestige` are misnomers for
"rebirths completed" — and they're live save keys, so renaming them without a
real migration wipes every player.

## Findables

**Three lanes, not one slot.** The common lane spawns every 10–25s and lives 7,
so it would occupy a shared slot almost permanently and the golden dumpling would
effectively never appear. Each lane holds one kind; an earlier "rare lane =
golden 45% / airdrop 55%" split was removed when airdrops went to one every 30s,
because leaving them together would either spend the golden's scarcity or starve
the drip.

**Payouts use raw dps.** A findable is neither a tap nor production, so a frenzy
must not multiply it and it never pays offline.

**Clearing a slot and rolling its next spawn are ONE operation.** A natural spawn
fires when `now >= nextAt`, so `nextAt` sits in the past for the whole time a
findable is alive. Any exit path that clears the slot without rescheduling
re-enters `spawn()` on the very next frame, forever. That shipped: catching one
spawned the next instantly and every catch restarted the ×7 frenzy, leaving it
permanently on — **measured at 186 catches in 10 seconds against an expected 4.**

**A forced spawn does not reproduce that class of bug**, because it rolls
`nextAt` into the future. Any spawn-timing regression has to be driven on a
*natural* spawn with the lane temporarily tuned to 2–3s.

**Airdrop payout came down as frequency went up.** At the old 90 seconds of
production every 30s they alone paid 3× idle income and the game became "tap
parcels". At 20s they add roughly +65%. And the lifetime has to exceed
capacity × interval or the cap never binds: at a 3-minute life the lane settles
at six parcels and never reaches ten.

**Catching a findable advances the rebirth gate.** It didn't at first — an
airdrop worth 90 seconds of production moved the counter and not the bar,
teaching the player that the exciting thing doesn't count.

## No passive income, ever

Removed 2026-08-21 at Dor's request, then hardened 2026-08-22 when he added
"not only closing the app, but also minimizing".

**The second half was a real leak, and an invisible one.** A backgrounded window
kept earning the *full* rate. Browsers throttle a background tab's
`requestAnimationFrame` to roughly 1Hz rather than stopping it, so every
throttled frame arrived with `dt ≈ 1000ms`, slipped under the one-second clamp,
and paid out a whole second of production — measured at 1,400/sec on a 1,400/sec
board, i.e. no reduction at all.

The lesson worth keeping: **the dt clamp is a stutter guard and was never a
visibility test.** It only looked like one. `creditableGapMs(dt, visible)` needs
both terms.

## Prices are the figures they print

`roundToDisplay()` in `src/game/quantize.ts`. The shop said an upgrade needed
5.1 מיליארד and charged 5,143,556,201. `formatNumber` is lossy above a million by
design, so the only way for the printed figure to *be* the figure is to quantize
the figure itself.

Safe against the cost curve: a quantization step is at most 10% of the value and
each unit costs 15% more than the last, so prices can never tie or invert.
`tests/quantize.test.ts` pins that across 250 units of every tier.

## Exp is not the currency

The rebirth meter reads `1,200 / 3,000` with **no ₪ and no label**. Dor was
explicit that it's rebirth exp rather than money, and that turns out to be the
more honest name: `runEarned` only ever accumulates, so spending in the shop
never lowers the bar. Marking it in shekels would promise a number that drops
when you buy something.

Two traps it hit: the value is **clamped to the requirement** (a frame can
overshoot, and `4,100 / 3,000` reads like a rebirth the game is refusing), and
the formatted string must be in the bar's update signature — keyed on whole
percent alone, the number froze between ticks, which at a million per percent is
a counter that visibly sticks.

## Hebrew grammar is a recurring bug class

Hebrew takes the singular at one. `1 שקלים` and `ב־1 מקומות` are wrong the way
"1 shekels" is wrong. **This has shipped to production twice** — once in the
rebirth keep-list, once in the HUD, where it was the first sentence a new player
read, one tap in. Any string interpolating a count needs a singular branch.

## Feel

**The squish release is two-stage, and the handoff is by POSITION, not a timer.**
A timer keyed on the last tap depends on how long the press was held, so a 300ms
hold would burn the fast window and the squishy would crawl back from fully
dented.

**The spring lives in a pure module** (`src/ui/spring.ts`) because nothing in
`ui/` was testable before it.

**Idle life composes into the one transform `frame()` already writes** —
breathing ~1%, a 120ms blink every 3–7s, a 2.5° glance. Blink swaps a
pre-rendered hidden group, omitted for eyes that are already closed.

## The backdrop is drawn, not filmed

2026-08-23. Dor supplied a 10-second 720×1280 mp4 of a pastel low-poly
landscape — rolling hills, villages, clouds, a rainbow — to use as the
background, muted, keeping the game's own audio. It shipped as animated SVG
instead (`ui/backdrop.ts` + `styles/backdrop.css`), same composition, ~5KB.

**Why the video lost, all three measured before deciding:**

1. **2.61MB against a 182KB precache.** The whole installable app was 182KB;
   the video was 15× the entire game. Leaving it out of the precache instead
   would mean the background is missing offline, in an app whose selling point
   is that it works offline.
2. **It made the UI unreadable.** The game is light text (`#f5eee6`) on a dark
   ground by design. The footage is bright pastel daylight. Fixing that needs a
   scrim heavy enough that little of the video survives it — at which point you
   are paying 2.61MB for a texture.
3. **Its loop popped.** Frame-checked: the clip opens pink with a strong rainbow
   and ends orange with none, so `loop` jumps hard every 10 seconds. Nothing
   short of re-encoding a crossfade fixes it, and there is no ffmpeg in this
   environment.

The drawn version answers all three: it uses the game's own palette tokens so
contrast is preserved rather than fought, and it loops with **no seam by
construction** — each layer holds two identical tiles and travels exactly one
tile width, so the last frame is the first frame.

**Do not "upgrade" this back to video.** A prettier clip has the same three
problems. If richer art is wanted, add layers to the SVG.

### The tile is fixed pixels, because percentages broke desktop

2026-08-23, same day. The first version made each layer 200% of the viewport
width holding two tiles. That looked right on the phone it was tuned on and
**bad on any wide screen**: with `preserveAspectRatio="none"` the horizontal
scale is a function of window width, so x scaled 0.36 on a 430px phone and 1.2
on a 1440px laptop. The same art at roughly 3x different proportions — cottages
became flat bunkers, stars became blobs, clouds became smears, and the hills
flattened out.

Now each layer is one tile wider than the window and repeats a **fixed-pixel**
tile (`--bd-tile`, stepped up at 900px and 1600px so a desktop isn't a small
pattern stamped across the screen). Horizontal scale no longer depends on window
width at all; only height does, and that varies far less. A widescreen gets more
tiles, not stretched ones. Verified at 430 / 834 / 1440 / 1920: sliding a layer
by exactly one tile differs by **zero pixels**, while a deliberately wrong
offset differs by 47k–217k.

The cost: layers are now `background-image` data URIs, and **an SVG used as a
background image is a static rendering context** — CSS animations inside it do
not run. The flickering windows died there and are baked in at varying opacity
instead; the star twinkle came back as two half-skies cross-fading their own
element opacity, which does animate.

**What the seam work actually taught** — the traps are in `CLAUDE.md`, and the
last two are the general lessons:

- Seamlessness is a property of the geometry. It holds only while every drawn
  element stays inside the tile; one village house at x=1070 spilled past the
  edge, was clipped in the second copy but not the first, and made the entire
  background jump once per cycle. Tangents must match across the join too, or
  the ridge corners and repeats a notch. `tests/backdrop.test.ts` pins the
  bounds.
- **The first seam test passed while proving nothing.** It set
  `el.style.transform` to sample the layer at loop start and loop end — but a
  CSS animation outranks an inline style even when paused, so both samples were
  identical no matter what. It only surfaced because the test also checked that a
  deliberately *wrong* offset differs, and that check failed. **A verification
  that cannot fail is not a verification**; give every such test a control case.
- **Comparing screenshots by hash reported seams that did not exist.** PNG
  encoding is not deterministic, so byte-identical fails on pixel-identical
  images — it claimed a seam at 430px and 1440px that a per-pixel decode showed
  was zero pixels. Decode and count differing pixels with a small tolerance;
  a single antialiased pixel is not a seam either.

## Things that were tried and rejected

- **Growth 2.6 for the rebirth curve** — 341 hours by rebirth 25.
- **Flat ×3/×5 click upgrades at high prices** — 3–7× worse than buying a
  building; strictly trap purchases.
- **`apprentice` at 0.15 dps was 0.1** — at 0.1 it was strictly dominated (150
  per dps against `stall`'s 100), making the first affordable producer the worst
  buy in the game. `tests/economy.test.ts` now guards that no tier is dominated
  by the tier above.
- **90-second airdrop payouts at a 30-second cadence** — 3× idle income; the
  game became tapping parcels.
- **Twelve upgrade chips on the shelf** — 270% of shop height.
- **Tap gates of 700 and 2000 on click upgrades** — the shop teases the next one
  as "unlocks after N more squishes", so those read as "tap 1,700 more times",
  which is homework rather than a reward. Gates are now 10–300 and **cost does
  the staggering** via `UPGRADE_REVEAL_FRACTION`.
- **Lowering the tap gates alone** — regressed the shop badly: all five chips
  appeared at once and pushed the producer list off the bottom.
- **A separate prestige system** — dropped, see Rebirth.
- **Gating the boss at rank 60** — measured three times *worse* than doing
  nothing, because rank 60 is a 34-hour wall.
- **Gating the boss without repricing him** — a literal no-op: you reach ₪75B
  after you reach rank 50, so the gate never binds.
- **A video file as the background** — 2.61MB against a 182KB precache, bright
  daylight footage under light-on-dark UI, and a 10s loop that popped. Redrawn
  as ~5KB of SVG; see above.

## Known errors in the older spec files

`docs/superpowers/specs/2026-08-20-juice-pass-design.md` is kept as written, and
it carries three mistakes the implementation found: §2 points idle life at the
wrong loop, §2's blink assumes an addressable eyes group that didn't exist, and
§4 understates the ripple from changing `click()`'s return type. Treat the specs
as history, not instructions.

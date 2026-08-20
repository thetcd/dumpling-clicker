# Pace, rebirths and monetisation

Date: 2026-08-20
Branch: `juice-pass`
Status: design, not approved

Supersedes two earlier prestige designs from the same day: the first gated
prestige on the boss tier (leaving the boring 25.5h first run intact), the
second proposed six prestiges at ~40 min each with a ×3 compounding multiplier
(which made the last run a 20-minute formality).

Dor's direction, in order:

> "the first run is boring to play for me... games need to be high pace"
> "each prestige will take a few hours, but will not be exponentially easy,
> will get some perks (skins, a small buff next time)"
> "I want the game to have tons of prestiges, like they do in roblox mini
> games — research how roblox minigames work, their sound, their economics"

Those look contradictory and are not. They describe the Roblox rebirth curve.

## What the research says

**Rebirth cost scales exponentially, so early rebirths are minutes and later
ones are hours.** Roblox devs use `cost = base * growth^rebirths` directly.
This is the piece that reconciles "tons of prestiges" with "a few hours each":
the number is not a constant, it is a curve.

**Rebirth is the retention mechanic**, not the power mechanic. It is why
players come back for months. Each one should feel meaningful through visible
change — new appearance, new area, exclusive ability — and **the rebirth count
itself is displayed as a status symbol**.

**Simulators reward time, not skill**, and players accept long grinds when the
visual progression is satisfying and there is something to show off.

**Sound: bright, short, metallic, instant.** The specific technique worth
stealing is from Subway Surfers, and Roblox devs copy it — *consecutive*
pickups raise the pitch, so chaining collections builds momentum. This game
already has that ladder for squishing (`COMBO_WINDOW_MS`/`COMBO_MAX` in
`sound.ts`); it is not yet applied to catching findables, and it should be.

## Why run lengths do NOT explode

An exponential rebirth requirement against this game's exponential production
curve does not multiply the time. Producer costs grow at 1.15 per unit and
roughly ×10 per tier, so income within a run grows exponentially with time
invested — which means doubling the target adds a roughly constant increment of
real time rather than doubling it.

So `requirement = BASE × GROWTH^n` should produce real-world run lengths that
grow gently: rebirth 1 in minutes, rebirth 10 in tens of minutes, rebirth 25+
in the "few hours" range Dor asked for. Every rebirth stays a real game and
none becomes a formality, which is the "not exponentially easy" requirement.

**This is a prediction from the shape of two curves, not a measurement, and it
is the single thing most likely to be wrong.** The first implementation task is
a simulation that plays the game headlessly and reports actual time-to-rebirth
for n = 1, 5, 10, 25, 50. `BASE` and `GROWTH` get tuned until the curve is
right. No constants ship on the strength of this section.

## The model

- **Rebirths are unbounded.** No cap at 4 or 6. The count is displayed
  prominently — the research is unanimous that it functions as the status
  symbol, and it is the cheapest retention feature in the design.
- **Requirement**: `REBIRTH_BASE × REBIRTH_GROWTH^n` of `totalEarned` in the
  current run. Both constants come from simulation.
- **Buff**: small and **linear, never compounding**. Something near +5% per
  rebirth, so multiplier = `1 + 0.05n`. Dor's judgement was that 15% was
  already too much. Linear growth against an exponential requirement is exactly
  what keeps later rebirths from being trivial.
- **Perks are the real reward**, on a ladder rather than every level: a locked
  accessory, a new body colour, a new eye or mouth set, a faster findable lane,
  a higher offline cap. Something visible at 1, 2, 3, 5, 8, 12, 18, 25, 35, 50.
- The **boss tier stays the ending** — a separate milestone reached deep into
  the curve, not the rebirth gate.

The six gated accessories already built fit this unchanged: they simply become
the first six rungs of a longer ladder.

## Sound work this implies

- Apply the existing combo pitch ladder to **findable catches**, so catching
  several in a row climbs. Currently only squishing does this.
- A distinct, brighter rebirth sound — it is the biggest moment in the game and
  currently would share the boss fanfare.

## Monetisation: copy the loop, not the dark patterns

Dor asked earlier about rewarded ads. The research on Roblox's economics is
blunt about what is actually being copied when you copy a simulator.

**Worth taking**: rebirth progression, variable-reward moments, visible status,
collectibles, share-driven growth.

**Not worth taking, and this is not a stylistic objection**: Roblox simulators
run on FOMO (limited-time pets, seasonal exclusives), lootbox pulls, a virtual
currency that obscures real cost, and real-money trading. There is peer-
reviewed CHI research on how children experience these as harm, and active
litigation over how the platform monetises young players. Gal's audience is
children, and this game currently has no backend, no accounts and no purchases.

If acceleration is wanted, the ranked options are:

1. **Share-to-unlock** — post your squishy, get the perk. No SDK, no privacy
   policy, no compliance question, and it feeds the marketing loop Gal exists
   for.
2. **A wait timer** — the perk arrives free, just later.
3. **Rewarded ads** — still blocked on the four constraints: COPPA/GDPR-K
   child-directed treatment, PWA rather than native (the mainstream rewarded
   SDKs are native-only, likely the hard blocker), Gal's sign-off given it is
   his likeness, and turning a free gift into a product with a revenue
   relationship.

## Open questions

- What do `REBIRTH_BASE` and `REBIRTH_GROWTH` actually produce? Simulation
  first, constants second.
- Does +5% linear stay motivating at rebirth 30, or does the perk ladder have
  to carry it entirely?
- Share-to-unlock or ads.

## Sources

- Roblox DevForum, rebirth cost formulas: https://devforum.roblox.com/t/good-formula-to-calculate-amount-needed-to-rebirth/1047686 and https://devforum.roblox.com/t/how-to-make-a-simulator-rebirth-math/2501720
- Simulator design and retention: https://www.kitsblox.com/blog/how-to-make-simulator-roblox
- Simulator economies, eggs and trading: https://game-ace.com/blog/roblox-simulation-games/
- Children and game monetisation harm (CHI 2025): https://dl.acm.org/doi/10.1145/3706598.3713611
- How Roblox monetises young players: https://www.anapolweiss.com/blog/from-fun-to-financial-pressure-how-roblox-monetizes-young-players/
- Rising pitch on consecutive pickups: https://devforum.roblox.com/t/coin-sound-effect-should-get-a-bit-faster-if-you-collect-multiple-in-a-straight-row/2128658

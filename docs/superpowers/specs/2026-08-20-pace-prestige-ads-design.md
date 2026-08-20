# Pace, prestige and rewarded ads

Date: 2026-08-20
Branch: `juice-pass`
Status: design, not approved

Supersedes the prestige design brainstormed earlier the same day (4 prestiges,
boss-tier gate, ×3 each). Dor played the current build and the verdict was:

> "the first run is boring to play for me... we need the game to have more
> resets but the game should be faster... games need to be high pace, we can't
> reach a steady state like that."

## The actual problem

The first run is 25.5 hours. That number came from Cookie Clicker's cost curve,
which is tuned for a game adults play across weeks. This game is aimed at kids
reached through Gal's channel, and it has an ending. A 25-hour first act means
almost nobody sees the second one.

The earlier prestige design made this worse rather than better: it gated the
first prestige on the boss tier, so run 1 stayed 25.5 hours and the whole
prestige system only began after it.

## Move the finish line, don't rebuild the curve

The producer table is Cookie Clicker's exact cost curve and the upgrade ladder
is tuned against it, including the "no tier is dominated by the tier above"
guard in `tests/economy.test.ts`. Compressing costs would put all of that back
in play.

Cheaper and safer: **keep the curve and move the goal**. Prestige unlocks at a
mid-table producer, and the gate climbs one tier per prestige. The permanent
multiplier compounds every reset while the target only moves one step, so each
run stays short and the pace never settles.

| Prestige | Unlocks when you own | Est. run length |
|---|---|---|
| 1 | bakery (tier 5) | ~45 min |
| 2 | factory (tier 6) | ~35 min |
| 3 | army (tier 7) | ~35 min |
| 4 | city (tier 8) | ~30 min |
| 5 | space (tier 9) | ~30 min |
| 6 | boss (tier 10) | ~30 min → ending |

Six resets instead of four, a first run of well under an hour instead of a day,
and the boss stays the climax rather than becoming a toll gate on the way in.

**Every run length above is an estimate, not a measurement.** They come from the
shape of the cost curve, not from a simulation. The first implementation task is
a simulation test that reports actual time-to-gate per prestige, and the
multiplier gets tuned until the table above is true.

Permanent multiplier stays ×3 per prestige, applied as a global scalar inside
`dpsOf()` and both terms of `clickValue()` — never folded into
`incomeMultiplier`, which is the temporary frenzy and is deliberately excluded
from the shop, offline earnings and `dpsOf`.

## Accessories are the reset reward

Dor's call: **run 1 has no accessories at all.** All 11 existing ones plus 4 new
ones unlock across the six prestige levels.

Flagging the cost of this honestly, because it reverses an earlier
recommendation. The designer is the first screen a new player ever sees, and
this removes a whole category from it — first-launch customisation drops from
four choices to three. The upside is that the first reset immediately hands over
something visible and personal, which is exactly the "why would I press reset"
problem that sinks most prestige systems.

Locked accessories render as 🔒 in the designer rather than being hidden, so the
ladder is visible from the first launch. That is the entire motivational point;
hiding them would make run 1 look like the whole game.

Existing saves are the migration risk: anyone already wearing an accessory keeps
it. The unlock check applies to *choosing*, never to *rendering*.

## Rewarded ads

Dor's ask: watch an ad to unlock something faster, or to summon a golden
dumpling.

Both fit the design. A rewarded ad is a variable-reward accelerator, the same
family as the golden dumpling itself, and it never sells power outright — it
sells time, which keeps the game fair for anyone who does not watch.

Proposed placements:

- **Summon a golden dumpling.** Watch, get the ×7 frenzy immediately instead of
  waiting 3-8 minutes. Rate-limited, or it replaces the variable reward with a
  vending machine and the golden dumpling stops being special.
- **Skip a prestige gate's last stretch**, or double the next airdrop.
- **Unlock the next accessory one prestige early.**

**Four things have to be settled before any of this is built, and none are
technical taste.**

1. **The audience is children.** Child-directed apps fall under COPPA in the US
   and GDPR-K in the EU. Ad networks require child-directed treatment: no
   personalised ads, no behavioural targeting, restricted ad content. This is a
   legal question, not a preference.
2. **This is a PWA, not a native app.** The mainstream rewarded-video SDKs
   (AdMob and friends) target native. Web rewarded ads exist but the inventory
   and payout are materially worse. This may be the single biggest constraint.
3. **Gal's involvement.** Ads in a game marketed through his channel and
   carrying his likeness is a conversation to have with him before it ships, not
   after.
4. **It changes what the product is.** Today it is a free gift with no backend.
   Ads add an SDK, a revenue relationship and a privacy policy.

**Cheaper alternatives that deliver the same acceleration with none of the
above**: share-to-unlock (post your squishy, get the reward), or a plain wait
timer. Worth pricing against the ad route before committing, especially given
the PWA constraint.

## High pace, no steady state

Shipped already this session and pulling in this direction: findables every
10-25 seconds, click upgrades reachable in tens of taps instead of thousands,
and a background that reacts to every catch.

What this design adds: a reset every half hour or so, each one handing over a
permanent multiplier and a new accessory. The intent is that the player is never
more than a few minutes from something changing.

Still worth watching after the run lengths are measured: the stretch between
the last upgrade of a run and the prestige gate is where a steady state would
reappear.

## Open questions

- Do the estimated run lengths survive simulation? If prestige 1 is really 3
  hours, the gate tier moves down rather than the curve being rewritten.
- Does the ×3 multiplier still fit when the gate is a mid-tier producer rather
  than the boss? It was chosen against a boss gate.
- Ads or share-to-unlock, given the four constraints above.

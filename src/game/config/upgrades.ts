// Click upgrades. Hidden until unlockAtClicks total squishes.
//
// KEEP THESE GATES SMALL. Cost is already the real gate — nobody affords the
// 5M upgrade in hour one — so the tap count is a SECOND condition on top, and
// the shop teases the next locked one as "unlocks after N more squishes".
// At the old numbers (10/50/200/700/2000) that message read "tap 1,700 more
// times", which turns a reward into homework. Dor flagged it on 2026-08-20;
// the gates exist only so the shop is not full of chips on the first launch.
// ids are stable save keys — NEVER rename after ship.
//
// A click is worth `flat + share * dps` (see economy.ts). The cheap early
// upgrades raise `flat`, which is what carries the game before you own any
// producers. The two expensive ones raise `share`, so they keep paying forever
// instead of becoming dead weight the moment production takes over.
//
// Three tiers, because one effect cannot carry the whole cost curve:
//   flat (<=15k)   raise the per-tap base, the only thing that matters before
//                  producers exist. Never priced above 15k AS THE ONLY EFFECT —
//                  above that a flat multiplier alone is worth a fraction of
//                  just buying a building, which is what made grandma-hands and
//                  quantum-squish traps.
//   share (>15k)   raise the cut of production each tap pays, so they never die.
//                  They ALSO carry a flat multiplier, as a floor. A share
//                  upgrade is worth `share * producerDps`, so bought with no
//                  producers owned it buys literally nothing: Dor hit exactly
//                  that on 2026-08-21 and the shop previewed it as "384 <- 384".
//                  Reproduced at prestige 9 with an empty producer table. The
//                  shelf sells one upgrade at a time in cost order, so a player
//                  cannot route around a dud — it has to not be one.
//   crit (>5M)     a random chance for a tap to pay several times over.
//
// The crit tier exists because continuing with share multipliers past 5M means
// numbers like x1.12 to stop tapping swamping idle play — a reward that reads
// as nothing. Variable reward is the strongest pull in the genre (DESIGN-NOTES;
// it is why the golden dumpling works), and its contribution is a tunable
// expected value rather than another compounding multiplier.
export interface UpgradeDef {
  id: string;
  nameHe: string;
  descHe: string;
  cost: number;
  multiplier?: number; // multiplies the flat per-click base
  shareMultiplier?: number; // multiplies CLICK_DPS_SHARE, the production cut
  critChance?: number; // 0..1 chance a tap pays critMult times over
  critMult?: number; // how much a critical squish pays
  /**
   * The rebirth rank from which this upgrade is yours FOREVER. 0 = always.
   *
   * Replaced a boolean `keepOnRebirth` that was true for the five cheapest.
   * That was arbitrary and it did not scale: Dor at rebirth 8 watched the shop
   * offer him the 60k upgrade he had bought last run, which reads as a
   * demotion. A hardcoded five also silently strips permanence from everything
   * above any upgrade later inserted mid-ladder.
   *
   * The rule behind the numbers: an upgrade becomes permanent at the rank where
   * its price has stopped being a meaningful share of the run —
   *
   *     P(u) = ceil( log1.5( cost(u) / (0.5 * REBIRTH_BASE) ) )
   *
   * i.e. permanent once it costs under half a run's requirement. This is
   * Antimatter Dimensions' Eternity Milestone principle: permanence removes
   * what has become OVERHEAD, never what is still a decision. Below its rank an
   * upgrade is genuinely the run's central purchase; above it, re-buying is a
   * chore. Seven separate "yours forever" moments between rank 10 and 37, which
   * is the reward drip a reset needs to feel like a prize rather than a loss.
   *
   * Safe against the exponential requirement by construction: the total
   * keepable bonus is BOUNDED and one-time (x48 flat, x10.5 share, crit EV
   * ~x1.4), while the requirement is not. Never make this multiply by rank.
   */
  permanentFromRank: number;
  unlockAtClicks: number;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'fast-fingers',
    nameHe: 'אצבעות מזורזות',
    descHe: 'כל מעיכה שווה כפול 2',
    cost: 100,
    multiplier: 2,
    permanentFromRank: 0,
    unlockAtClicks: 10,
  },
  {
    id: 'warm-hands',
    nameHe: 'ידיים חמות',
    descHe: 'הבצק רך יותר ככה. כפול 2.',
    cost: 400,
    multiplier: 2,
    permanentFromRank: 0,
    unlockAtClicks: 20,
  },
  {
    id: 'silk-gloves',
    nameHe: 'כפפות משי',
    descHe: 'הסקווישי נהנה מזה. כפול 2.',
    cost: 1_000,
    multiplier: 2,
    permanentFromRank: 0,
    unlockAtClicks: 25,
  },
  {
    id: 'two-thumbs',
    nameHe: 'שני אגודלים',
    descHe: 'למה למעוך עם אחד? כפול 2.',
    cost: 4_000,
    multiplier: 2,
    permanentFromRank: 0,
    unlockAtClicks: 40,
  },
  {
    id: 'secret-technique',
    nameHe: 'טכניקת מעיכה סודית',
    descHe: 'עברה במשפחה שלוש דורות. כפול 3.',
    cost: 15_000,
    multiplier: 3,
    permanentFromRank: 0,
    unlockAtClicks: 60,
  },
  {
    id: 'team-spirit',
    nameHe: 'רוח צוות',
    descHe: 'כל הצוות מועך איתכם. החלק מהייצור שבכל מעיכה — כפול 1.5.',
    cost: 60_000,
    multiplier: 1.5, // floor: never a dud with no production owned
    shareMultiplier: 1.5,
    permanentFromRank: 10,
    unlockAtClicks: 110,
  },
  {
    id: 'grandma-hands',
    nameHe: 'ידיים של סבתא',
    descHe: 'אין מעיכה כמו של סבתא. החלק מהייצור שבכל מעיכה — כפול 2.',
    cost: 200_000,
    multiplier: 2, // floor: never a dud with no production owned
    shareMultiplier: 2,
    permanentFromRank: 13,
    unlockAtClicks: 120,
  },
  {
    id: 'assembly-line',
    nameHe: 'פס ייצור',
    descHe: 'מעיכה אחת מזיזה את כל הקו. החלק מהייצור — כפול 1.4.',
    cost: 800_000,
    multiplier: 1.5, // floor: never a dud with no production owned
    shareMultiplier: 1.4,
    permanentFromRank: 16,
    unlockAtClicks: 175,
  },
  {
    id: 'quantum-squish',
    nameHe: 'מעיכה קוונטית',
    descHe: 'מועך בכל היקומים במקביל. החלק מהייצור שבכל מעיכה — כפול 2.5.',
    cost: 5_000_000,
    multiplier: 2, // floor: never a dud with no production owned
    shareMultiplier: 2.5,
    permanentFromRank: 20,
    unlockAtClicks: 250,
  },
  {
    id: 'lucky-hands',
    nameHe: 'ידיים של מזל',
    descHe: 'מדי פעם יוצאת מעיכה מושלמת — פי 7!',
    cost: 40_000_000,
    critChance: 0.05,
    permanentFromRank: 26,
    unlockAtClicks: 260,
  },
  {
    id: 'four-leaf-dough',
    nameHe: 'בצק תלתן',
    descHe: 'המזל מגיע כפול. הסיכוי למעיכה מושלמת — 10%.',
    cost: 400_000_000,
    critChance: 0.1,
    permanentFromRank: 31,
    unlockAtClicks: 280,
  },
  {
    id: 'jackpot-squish',
    nameHe: 'מעיכת ג׳קפוט',
    descHe: 'כשזה קורה, זה קורה בגדול. מעיכה מושלמת — פי 12!',
    cost: 4_000_000_000,
    critMult: 12,
    permanentFromRank: 37,
    unlockAtClicks: 300,
  },
];

/** The payoff of a critical squish before any upgrade raises it. */
export const CRIT_BASE_MULT = 7;

// MEASURED 2026-08-21 on an endgame board, not reasoned about:
//   2 taps/sec — tapping adds 21% over idle without crit, 44% with the tier.
//   5 taps/sec — 53% without, 110% with. Crit EV with all three owned is x2.10.
// Rewarding tapping harder is exactly what Gal asked for, and the pacing cost
// is small: `node tools/simulate.mjs 5 3000 1.5` reaches rebirth 30 in 26.3h
// against 32.2h at 2 taps/sec. If that ever needs pulling back, move critChance
// or critMult — NOT the share table, which is what keeps taps alive at all.

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

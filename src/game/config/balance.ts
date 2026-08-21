// All tuning knobs live here — balancing never touches logic.
export const COST_GROWTH = 1.15; // each unit of a producer costs 15% more
// Every squish is also worth this fraction of one second of production, so
// tapping stays relevant at every scale instead of being an early-game-only
// trick. Producers alone are untouched.
//
// RAISED 0.01 -> 0.05 on 2026-08-21. Dor at rebirth 18 reported 1.2k per click
// against 23k/sec passive and said it "makes it not worth it to click" — at
// 0.01 with the two share upgrades a player actually owns mid-run, five taps a
// second bought 15% of idle income, which is not a choice, it is a decoration.
// At 0.05 the same five taps are worth ~75% of idle at ANY production level.
//
// This is the ONLY knob for that ratio: a flat multiplier lifts the click at
// one scale and decays to nothing as production grows, so only the
// share * producerDps term holds a ratio steady. tests/economy.test.ts pins it
// across four decades of production.
//
// MEASURED, not reasoned about (tools/simulate.mjs): at 2 taps/sec it pulls
// rebirth 50 from 26.8h to 17.5h against 31.0h for pure idle — so tapping is
// 44% faster than not tapping, where it used to be 14%.
export const CLICK_DPS_SHARE = 0.05;
// A free trickle so the game is visibly alive from the very first second
// instead of sitting at 0/sec until the first purchase. Deliberately NOT part
// of the click share-term (see clickValue) — a starting squish should be worth
// a clean 1, not 1.005.
export const BASE_DPS = 0.5;
// OFFLINE_CAP_MS / OFFLINE_RATE / WELCOME_BACK_* used to live here. Removed
// 2026-08-21: nothing pays for time away any more, so there is no offline rate,
// no cap, and no haul to announce on return. Dor: "the window must be open."
export const AUTOSAVE_INTERVAL_MS = 10_000;
// An upgrade appears once you have earned this fraction of its price. Cost is
// the real gate (the tap gates are tiny on purpose), but without this ALL
// upgrades appear at once and their chips push the producer list off screen —
// measured: at 260 banked the shop showed five chips up to 5,000,000 and no
// producers at all. Keyed to totalEarned, which only grows, so an upgrade can
// never un-reveal itself after a purchase.
export const UPGRADE_REVEAL_FRACTION = 0.4;

// --- golden dumpling (the variable reward) ---
// A golden copy of the player's own squishy appears on a random timer while the
// app is open, sits for GOLDEN_LIFETIME_MS, then fades. Tapping it multiplies
// ALL income by FRENZY_MULTIPLIER for FRENZY_DURATION_MS. Deliberately does not
// apply to offline earnings — catching it is the reward for being here.
// Caught every time, this is roughly +30% income on the average interval.
// Two lanes, each holding at most one thing at a time. A single shared slot
// does not work: the common lane spawns every 10-25s and lives 7, so it would
// occupy a shared slot almost permanently and the golden dumpling would
// effectively never appear.
//
// The common lane exists because kids disengage when nothing happens for
// minutes at a time. Catching every one is worth roughly +29% income.
//
// These are no longer estimates: tools/simulate.mjs models findable income as
// of 2026-08-21, and takes a catch rate as its 4th argument
// (`node tools/simulate.mjs 2 3000 1.5 1` = a player catching everything).
// It had to — with the airdrop lane at one every 30s, findables are a
// first-class income source and a sweep that ignored them measured a game
// nobody plays.
export const COMMON_SPAWN_MIN_MS = 10_000;
export const COMMON_SPAWN_MAX_MS = 25_000;
export const COMMON_LIFETIME_MS = 7_000;
export const COMMON_SECONDS = 5; // a common findable is worth 5s of production
export const COMMON_FLOOR_CLICKS = 3; // ...but never less than 3 taps' worth

// The golden dumpling keeps its own rare lane and its own slot. It grants the
// frenzy rather than a payout, and it only works as a variable reward if it
// stays scarce — moving it in with the airdrop drip would spend it.
export const RARE_SPAWN_MIN_MS = 3 * 60 * 1000;
export const RARE_SPAWN_MAX_MS = 8 * 60 * 1000;
export const GOLDEN_LIFETIME_MS = 13_000;

// Airdrops: Gal's "keep the phone open" lane. One every 30s, and up to ten may
// wait on screen at once, so coming back to a screen full of parcels is the
// reward for leaving the app up.
//
// The payout had to come down with the frequency. At the old 90 seconds of
// production every 30s, airdrops alone would have paid 3x idle income (+300%)
// and made tapping parcels the entire game. At 20s they add roughly +65%, in
// the same range the two lanes were already tuned to.
//
// The lifetime has to exceed capacity x interval or the cap never binds and
// the pile-up Gal asked for cannot happen: at a 3 minute life and a 30s
// cadence the lane settles at 6 parcels and never reaches ten. Six minutes
// makes CAPACITY the limit, so ten really do wait for a player who steps away.
export const AIRDROP_SPAWN_MIN_MS = 25_000;
export const AIRDROP_SPAWN_MAX_MS = 35_000;
export const AIRDROP_LIFETIME_MS = 360_000;
export const AIRDROP_SECONDS = 20;
export const AIRDROP_FLOOR_CLICKS = 25;
export const AIRDROP_MAX_ON_SCREEN = 10;
export const FRENZY_MULTIPLIER = 7;
export const FRENZY_DURATION_MS = 30_000;
// --- rebirth ---
// Modelled on Roblox simulators, which compute the requirement as
// base * growth^n directly. That single curve is what reconciles "tons of
// prestiges" with "each one takes a few hours": rebirth 1 is minutes and
// rebirth 30 is hours, because the requirement is not a constant.
//
// MEASURED by tools/simulate.mjs, not reasoned about — the first guess (growth
// 2.6) was wrong by orders of magnitude, reaching 341h by rebirth 25. Never
// hand-tune these without re-running the simulation.
//
// At 2 taps/sec: rebirth 1 ~7m, 5 ~13m, 10 ~24m, 20 ~1.3h, 25 ~2.2h, 30 ~3.8h,
// ~34h of play to reach 30. Tapping barely matters (30.7h at 5 taps/sec, 38.7h
// idle-only), so the curve is not grind-gated.
//
// KNOWN WALL: past ~rebirth 40 runs pass 14h and by 50 they are 57h. The cause
// is structural — the producer table has 10 tiers, and once the top one is
// owned, extra income costs 1.15x more per unit for flat dps, so growth turns
// logarithmic. Extending the game past 40 needs more tiers, not a smaller
// growth constant.
export const REBIRTH_BASE = 3_000;
export const REBIRTH_GROWTH = 1.5;
// LINEAR and small, deliberately: multiplier = 1 + BUFF * n, never compounding.
// A compounding buff against an exponential requirement makes late rebirths a
// formality, which is exactly what "not exponentially easy" rules out.
/**
 * What each rebirth adds to the permanent income scalar, in tiers that thin
 * out. Gal's note: the early ones have to feel enormous — a Roblox simulator
 * doubles you and says so — and the tail then flattens so the multiplier is a
 * SUM of steps, never a product. x2 compounding would be x2^30 by rebirth 30.
 *
 * Rebirths 1-5 double you each time (x6 by five), 6-15 add half each (x11 by
 * fifteen), and everything after adds a quarter, forever and unbounded.
 * Replaced a flat +0.05 per rebirth, which reached only x2.45 by rebirth 30.
 */
export const REBIRTH_BUFF_TIERS: { through: number; buff: number }[] = [
  { through: 5, buff: 1 },
  { through: 15, buff: 0.5 },
  { through: Infinity, buff: 0.25 },
];

/**
 * What survives a rebirth, as a fraction of each producer count (floored).
 * Gal: a reset that takes everything is punishing; keeping a quarter means each
 * rebirth visibly starts you further along without skipping the early shop.
 * Click upgrades are NOT kept — they are one-time buys, so keeping them would
 * make that whole ladder one-and-done instead of something to re-climb.
 */
export const REBIRTH_KEEP_FRACTION = 0.25;

export const MAX_TICK_DT_MS = 1_000; // clamp a single accrual step to 1s

// How many click upgrades the shop offers at once, cheapest first.
//
// ONE. Every click upgrade improves the same thing, so two on the shelf
// together read as one upgrade listed twice at two prices — Dor reported
// "ידיים חמות" and "כפפות משי", both x2, side by side. Selling them in
// sequence makes the ladder legible: buy this one, the next appears.
//
// It also fixes the layout problem it was first written for. The chips wrap one
// per row, and twelve of them measured 270% of the shop's height on a 430px
// phone, pushing every producer row — the core purchase loop — out of view.
export const MAX_UPGRADE_CHIPS = 1;

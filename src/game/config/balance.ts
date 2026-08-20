// All tuning knobs live here — balancing never touches logic.
export const COST_GROWTH = 1.15; // each unit of a producer costs 15% more
// Every squish is also worth this fraction of one second of production, so
// tapping stays relevant at every scale instead of being an early-game-only
// trick. At ~5 taps/sec this adds ~5% on top of idle income, rising to ~25%
// once both share-scaling upgrades are owned. Producers alone are untouched.
export const CLICK_DPS_SHARE = 0.01;
// A free trickle so the game is visibly alive from the very first second
// instead of sitting at 0/sec until the first purchase. Deliberately NOT part
// of the click share-term (see clickValue) — a starting squish should be worth
// a clean 1, not 1.005. It does feed offline earnings, so a fresh save left
// overnight banks ~7.2k: generous on purpose, tune here if it skips too much.
export const BASE_DPS = 0.5;
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000; // offline progress accrues up to 8h
export const OFFLINE_RATE = 0.5; // offline earns 50% of live dps
// "Welcome back" is a full-screen interruption, so it needs a real absence and
// a haul worth naming. Anything smaller is credited silently.
export const WELCOME_BACK_MIN_AWAY_MS = 2 * 60 * 1000;
export const WELCOME_BACK_MIN_SECONDS = 60; // at least a minute of production
export const AUTOSAVE_INTERVAL_MS = 10_000;

// --- golden dumpling (the variable reward) ---
// A golden copy of the player's own squishy appears on a random timer while the
// app is open, sits for GOLDEN_LIFETIME_MS, then fades. Tapping it multiplies
// ALL income by FRENZY_MULTIPLIER for FRENZY_DURATION_MS. Deliberately does not
// apply to offline earnings — catching it is the reward for being here.
// Caught every time, this is roughly +30% income on the average interval.
export const GOLDEN_MIN_INTERVAL_MS = 5 * 60 * 1000;
export const GOLDEN_MAX_INTERVAL_MS = 15 * 60 * 1000;
export const GOLDEN_LIFETIME_MS = 13_000;
export const FRENZY_MULTIPLIER = 7;
export const FRENZY_DURATION_MS = 30_000;
export const MAX_TICK_DT_MS = 1_000; // clamp a single accrual step to 1s

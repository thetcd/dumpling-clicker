// The ONLY place game state is mutated. UI calls these; everything else is
// derived via economy.ts. Keeping mutation in one narrow module is also what a
// future leaderboard server would validate against.
import { clickValue, costOf, critParams, dpsOf, incomeMultiplier } from './economy';
import { FRENZY_DURATION_MS, MAX_TICK_DT_MS } from './config/balance';
import { PRODUCER_BY_ID } from './config/producers';
import { UPGRADE_BY_ID } from './config/upgrades';
import { canRebirth, keptProducers, keptUpgrades } from './rebirth';
import { createInitialState, type GameState } from './state';

/**
 * One squish. Returns what it earned and whether it was a critical squish, so
 * the UI can make a crit look like one — a 5% roll nobody can see is wasted.
 *
 * `rand` is injectable because the balance simulator plays thousands of taps
 * headlessly and has to be reproducible; "MEASURED, never reasoned about" only
 * holds if two runs of the same sweep agree.
 */
export function click(
  state: GameState,
  now: number,
  rand: () => number = Math.random,
): { earned: number; crit: boolean } {
  const { chance, mult } = critParams(state.upgrades);
  const crit = chance > 0 && rand() < chance;
  const earned = clickValue(state) * incomeMultiplier(state, now) * (crit ? mult : 1);
  state.dumplings += earned;
  state.totalEarned += earned;
  state.runEarned += earned;
  state.stats.totalClicks += 1;
  return { earned, crit };
}

/**
 * Credit a payout that is neither a squish nor production — today, catching a
 * findable. The three counters move together on purpose: `runEarned` is what
 * the rebirth gate measures, and crediting the balance without it meant
 * catching an airdrop worth 90 seconds of production left the rebirth bar
 * frozen, teaching the player that the exciting thing does not count.
 *
 * No `incomeMultiplier` here, deliberately: a frenzy must never multiply a
 * findable payout (rewards.ts computes it off raw dps for the same reason).
 */
export function grant(state: GameState, amount: number): void {
  state.dumplings += amount;
  state.totalEarned += amount;
  state.runEarned += amount;
}

/**
 * Tap of a golden dumpling. Restarts the frenzy window rather than extending
 * it, so two goldens in quick succession can't stack into a runaway multiplier.
 */
export function startFrenzy(state: GameState, now: number): void {
  state.frenzyUntil = now + FRENZY_DURATION_MS;
}

/** Buy one unit of a producer. Returns false (and changes nothing) if unaffordable. */
export function buyProducer(state: GameState, id: string): boolean {
  const def = PRODUCER_BY_ID[id];
  if (!def) return false;
  const cost = costOf(def, state.producers[id] ?? 0);
  if (state.dumplings < cost) return false;
  state.dumplings -= cost;
  state.producers[id] = (state.producers[id] ?? 0) + 1;
  return true;
}

/** Buy an upgrade once. Returns false if unknown, owned, or unaffordable. */
export function buyUpgrade(state: GameState, id: string): boolean {
  const def = UPGRADE_BY_ID[id];
  if (!def) return false;
  if (state.upgrades.includes(id)) return false;
  if (state.dumplings < def.cost) return false;
  state.dumplings -= def.cost;
  state.upgrades.push(id);
  return true;
}

/** Advance production by dtMs (clamped — long gaps are offline progress's job). */
export function accrue(state: GameState, dtMs: number, now: number): void {
  const clamped = Math.min(dtMs, MAX_TICK_DT_MS);
  const earned =
    dpsOf(state) * (clamped / 1000) * incomeMultiplier(state, now);
  state.dumplings += earned;
  state.totalEarned += earned;
  state.runEarned += earned;
  state.stats.playtimeMs += dtMs;
}

/** Fresh economy; the player's squishy design and settings survive. */
export function resetGame(state: GameState, now: number): GameState {
  const fresh = createInitialState(now);
  fresh.avatar = { ...state.avatar };
  fresh.designed = state.designed;
  fresh.settings = { ...state.settings };
  return fresh;
}

/**
 * Spend the run for a permanent step up. Producers, upgrades, banked dumplings
 * and the run counter all go; the squishy, the settings, the lifetime stats and
 * every perk already earned stay.
 *
 * `totalEarned` is LIFETIME and deliberately survives — it drives which
 * upgrades are revealed, so a rebirthed player does not have to re-earn the
 * right to see the shop they already know.
 */
export function rebirth(state: GameState, now: number): GameState {
  if (!canRebirth(state)) return state;
  const fresh = createInitialState(now);
  fresh.avatar = { ...state.avatar };
  fresh.designed = state.designed;
  fresh.settings = { ...state.settings };
  fresh.stats = { ...state.stats };
  fresh.totalEarned = state.totalEarned;
  fresh.prestige = state.prestige + 1;
  fresh.runEarned = 0;
  // An active frenzy carries across. It is wall-clock and belongs to the
  // PLAYER, not the run: catching a golden dumpling and then hitting the
  // rebirth you had already earned used to throw the reward away, which taught
  // players to sit on a rebirth rather than take it.
  fresh.frenzyUntil = state.frenzyUntil;
  // The keep rule itself lives in rebirth.ts, because the confirm modal states
  // it to the player before they commit and the two must never disagree.
  fresh.producers = keptProducers(state.producers);
  fresh.upgrades = keptUpgrades(state.upgrades);
  return fresh;
}

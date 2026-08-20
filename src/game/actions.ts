// The ONLY place game state is mutated. UI calls these; everything else is
// derived via economy.ts. Keeping mutation in one narrow module is also what a
// future leaderboard server would validate against.
import { clickValue, costOf, dpsOf, incomeMultiplier } from './economy';
import { FRENZY_DURATION_MS, MAX_TICK_DT_MS } from './config/balance';
import { PRODUCER_BY_ID } from './config/producers';
import { UPGRADE_BY_ID } from './config/upgrades';
import { canRebirth } from './rebirth';
import { createInitialState, type GameState } from './state';

/** One squish. Returns the amount earned (for the +N popup). */
export function click(state: GameState, now: number): number {
  const earned = clickValue(state) * incomeMultiplier(state, now);
  state.dumplings += earned;
  state.totalEarned += earned;
  state.runEarned += earned;
  state.stats.totalClicks += 1;
  return earned;
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
  return fresh;
}

// Rebirth: the meta-loop. Pure over (state) so the whole curve is testable and
// simulatable without a clock or a DOM.
//
// Shape borrowed from Roblox simulators: the REQUIREMENT grows exponentially
// while the BUFF grows linearly. That combination is what keeps every rebirth a
// real game — a compounding buff against an exponential requirement makes late
// rebirths a formality, and a linear requirement makes them all identical.
import {
  REBIRTH_BASE,
  REBIRTH_BUFF_TIERS,
  REBIRTH_GROWTH,
  REBIRTH_KEEP_MAX,
  REBIRTH_KEEP_PER,
  REBIRTH_MAX,
} from './config/balance';
import { UPGRADE_BY_ID } from './config/upgrades';
import { roundToDisplay } from './quantize';
import type { GameState } from './state';

/** Prestige as a usable rank: floored, never negative, never NaN. */
function rankOf(prestige: number): number {
  return Number.isFinite(prestige) && prestige > 0 ? Math.floor(prestige) : 0;
}

/**
 * Has the player reached the last rank the game currently offers?
 *
 * The single place the cap is decided — `rebirthProgress`, `canRebirth` and the
 * bar all ask this rather than comparing against REBIRTH_MAX themselves.
 */
export function isRebirthMaxed(prestige: number): boolean {
  return rankOf(prestige) >= REBIRTH_MAX;
}

/**
 * How much this run must earn before rebirth `n + 1` is available, rounded to
 * the figure the rebirth bar prints (see game/quantize.ts) — a goal the player
 * is shown as "5.1 מיליארד" has to actually BE 5.1 מיליארד. Growth is 50% per
 * rank, far wider than any quantization step, so the curve stays strictly
 * rising.
 */
export function rebirthRequirement(prestige: number): number {
  return roundToDisplay(REBIRTH_BASE * REBIRTH_GROWTH ** rankOf(prestige));
}

/**
 * Permanent income scalar: 1 plus the SUM of every rebirth's step, where the
 * steps thin out through REBIRTH_BUFF_TIERS (×2 at rebirth 1, ×6 by 5, ×11 by
 * 15, then +0.25 forever). A sum, never a product — compounding ×2 per rebirth
 * would be ×2^30 by rebirth 30 and the game would be over.
 *
 * Applied once, at the outer edge of `dpsOf` and `clickValue`, never inside
 * `producerDps` — doing both would square it.
 */
export function rebirthMultiplier(prestige: number): number {
  // Clamped to the cap: the ladder stops at REBIRTH_MAX, so the scalar has to
  // as well, or editing localStorage to rank 999 hands out a multiplier the
  // game can never legitimately give.
  const n = Math.min(rankOf(prestige), REBIRTH_MAX);
  let total = 1;
  let counted = 0;
  for (const tier of REBIRTH_BUFF_TIERS) {
    if (counted >= n) break;
    const upto = Number.isFinite(tier.through) ? Math.min(tier.through, n) : n;
    total += (upto - counted) * tier.buff;
    counted = upto;
  }
  return total;
}

/** Progress toward the next rebirth, 0..1, for the button's fill. */
export function rebirthProgress(state: GameState): number {
  // At the cap the bar reads full whatever the run has earned. A full bar with
  // no button is the "MAX" state, the same shape Roblox uses.
  if (isRebirthMaxed(state.prestige)) return 1;
  const need = rebirthRequirement(state.prestige);
  if (!(need > 0)) return 1;
  const have = Number.isFinite(state.runEarned) ? Math.max(0, state.runEarned) : 0;
  return Math.min(1, have / need);
}

export function canRebirth(state: GameState): boolean {
  // isMaxed first: at the cap rebirthProgress is 1 by definition, so asking it
  // alone would report the button as available forever.
  if (isRebirthMaxed(state.prestige)) return false;
  return rebirthProgress(state) >= 1;
}

/**
 * THE KEEP RULE, in one place — `actions.rebirth()` applies exactly this.
 *
 * One squishy per every REBIRTH_KEEP_PER owned of each tier (1-4 keeps 1,
 * 5-8 keeps 2, 9-12 keeps 3, ...), capped at REBIRTH_KEEP_MAX. Dor's rule,
 * 2026-08-22 — it replaced a rounded 25%, under which owning exactly one of a
 * tier kept nothing and read as a bug (his single kindergarten vanished).
 * Owning anything now keeps at least one, so no key is ever stored as zero.
 */
export function keptProducers(producers: Record<string, number>): Record<string, number> {
  const kept: Record<string, number> = {};
  for (const [id, count] of Object.entries(producers)) {
    const owned = Number.isFinite(count) ? Math.floor(count) : 0;
    if (owned >= 1) kept[id] = Math.min(REBIRTH_KEEP_MAX, Math.ceil(owned / REBIRTH_KEEP_PER));
  }
  return kept;
}

/**
 * Which click upgrades survive: the flat tier only. The share and crit tiers
 * are the ladder a run exists to climb. See `UpgradeDef.keepOnRebirth`.
 */
export function keptUpgrades(upgrades: string[]): string[] {
  return upgrades.filter((id) => UPGRADE_BY_ID[id]?.keepOnRebirth);
}

/**
 * What the player is about to keep, for the confirm modal to state before they
 * commit. Half of "make the rules consistent" is the rule; the other half is
 * being able to see it. Derived from the same two functions the reset uses, so
 * the promise and the outcome cannot drift apart.
 */
export function rebirthKeepSummary(state: GameState): {
  units: number;
  tiers: number;
  upgrades: number;
} {
  const producers = keptProducers(state.producers);
  const counts = Object.values(producers);
  return {
    units: counts.reduce((a, b) => a + b, 0),
    tiers: counts.length,
    upgrades: keptUpgrades(state.upgrades).length,
  };
}

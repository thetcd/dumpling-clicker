// Rebirth: the meta-loop. Pure over (state) so the whole curve is testable and
// simulatable without a clock or a DOM.
//
// Shape borrowed from Roblox simulators: the REQUIREMENT grows exponentially
// while the BUFF grows linearly. That combination is what keeps every rebirth a
// real game — a compounding buff against an exponential requirement makes late
// rebirths a formality, and a linear requirement makes them all identical.
import { REBIRTH_BASE, REBIRTH_BUFF, REBIRTH_GROWTH } from './config/balance';
import type { GameState } from './state';

/** How much this run must earn before rebirth `n + 1` is available. */
export function rebirthRequirement(prestige: number): number {
  const n = Number.isFinite(prestige) && prestige > 0 ? Math.floor(prestige) : 0;
  return REBIRTH_BASE * REBIRTH_GROWTH ** n;
}

/**
 * Permanent income scalar. LINEAR on purpose: 1 + 0.05n, so rebirth 20 is
 * ×2, not ×2^20. Applied once, at the outer edge of `dpsOf` and `clickValue`,
 * never inside `producerDps` — doing both would square it.
 */
export function rebirthMultiplier(prestige: number): number {
  const n = Number.isFinite(prestige) && prestige > 0 ? Math.floor(prestige) : 0;
  return 1 + REBIRTH_BUFF * n;
}

/** Progress toward the next rebirth, 0..1, for the button's fill. */
export function rebirthProgress(state: GameState): number {
  const need = rebirthRequirement(state.prestige);
  if (!(need > 0)) return 1;
  const have = Number.isFinite(state.runEarned) ? Math.max(0, state.runEarned) : 0;
  return Math.min(1, have / need);
}

export function canRebirth(state: GameState): boolean {
  return rebirthProgress(state) >= 1;
}

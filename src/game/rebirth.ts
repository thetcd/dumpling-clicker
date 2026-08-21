// Rebirth: the meta-loop. Pure over (state) so the whole curve is testable and
// simulatable without a clock or a DOM.
//
// Shape borrowed from Roblox simulators: the REQUIREMENT grows exponentially
// while the BUFF grows linearly. That combination is what keeps every rebirth a
// real game — a compounding buff against an exponential requirement makes late
// rebirths a formality, and a linear requirement makes them all identical.
import { REBIRTH_BASE, REBIRTH_BUFF_TIERS, REBIRTH_GROWTH } from './config/balance';
import type { GameState } from './state';

/** How much this run must earn before rebirth `n + 1` is available. */
export function rebirthRequirement(prestige: number): number {
  const n = Number.isFinite(prestige) && prestige > 0 ? Math.floor(prestige) : 0;
  return REBIRTH_BASE * REBIRTH_GROWTH ** n;
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
  const n = Number.isFinite(prestige) && prestige > 0 ? Math.floor(prestige) : 0;
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
  const need = rebirthRequirement(state.prestige);
  if (!(need > 0)) return 1;
  const have = Number.isFinite(state.runEarned) ? Math.max(0, state.runEarned) : 0;
  return Math.min(1, have / need);
}

export function canRebirth(state: GameState): boolean {
  return rebirthProgress(state) >= 1;
}

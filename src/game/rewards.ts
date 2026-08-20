// What a findable pays out. Pure, so payouts are testable without a DOM.
//
// Derived from the RAW dps: a findable is neither click() nor accrue(), so an
// active frenzy must not multiply it. Keeping the multiplier out here is the
// same rule that keeps it out of dpsOf() and offline earnings.
import { FINDABLE_BY_ID, type FindableKind } from './config/findables';

/**
 * A payout findable is worth `payoutSeconds` of current production, floored at
 * a number of taps so it is not worthless in the first minutes when dps is ~0.
 * Both terms self-scale, so neither needs a per-stage table. Kinds with no
 * `payoutSeconds` (the golden dumpling, which grants a frenzy) pay nothing.
 */
export function rewardFor(kind: FindableKind, dps: number, clickValue: number): number {
  const def = FINDABLE_BY_ID[kind];
  if (!def?.payoutSeconds) return 0;
  const fromProduction = Number.isFinite(dps) && dps > 0 ? dps * def.payoutSeconds : 0;
  const floor =
    Number.isFinite(clickValue) && clickValue > 0 ? clickValue * (def.floorClicks ?? 0) : 0;
  return Math.max(fromProduction, floor);
}

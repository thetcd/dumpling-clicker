// Pure economy math. No DOM, no state mutation — everything derives from
// (config, state) so it stays trivially testable and deterministic.
import {
  BASE_DPS,
  CLICK_DPS_SHARE,
  COST_GROWTH,
  FRENZY_MULTIPLIER,
  OFFLINE_CAP_MS,
  OFFLINE_RATE,
} from './config/balance';
import { isFrenzyActive } from './golden';
import { PRODUCER_BY_ID, type ProducerDef } from './config/producers';
import { UPGRADE_BY_ID } from './config/upgrades';
import type { GameState } from './state';

/** Cost of buying `count` units when you already own `owned` (geometric series). */
export function costOf(def: ProducerDef, owned: number, count = 1): number {
  const g = COST_GROWTH;
  return def.baseCost * g ** owned * ((g ** count - 1) / (g - 1));
}

/** Dumplings-per-second from producers the player actually bought. */
export function producerDps(state: GameState): number {
  let dps = 0;
  for (const [id, count] of Object.entries(state.producers)) {
    const def = PRODUCER_BY_ID[id];
    if (def) dps += def.baseDps * count;
  }
  return dps;
}

/** Total earning rate: what the player built, plus the free BASE_DPS trickle. */
export function dpsOf(state: GameState): number {
  return producerDps(state) + BASE_DPS;
}

/**
 * Dumplings earned per squish: a flat base times every purchased flat
 * multiplier, plus a cut of current production so a tap is always worth
 * something. Without the production term, clicking would be a rounding error
 * within the first half hour — production grows exponentially, a flat ladder
 * does not.
 */
export function clickValue(state: GameState): number {
  return clickValueFrom(state.upgrades, state);
}

/**
 * What a squish WOULD be worth if `upgradeId` were also owned — so the shop can
 * show "22 → 44" instead of only "x2". With the share-scaling upgrades the real
 * gain depends on current production, which is exactly what a player can't work
 * out in their head. Never mutates state.
 */
export function clickValueWith(state: GameState, upgradeId: string): number {
  if (!UPGRADE_BY_ID[upgradeId] || state.upgrades.includes(upgradeId)) {
    return clickValue(state);
  }
  return clickValueFrom([...state.upgrades, upgradeId], state);
}

function clickValueFrom(upgradeIds: string[], state: GameState): number {
  let flat = 1;
  let share = CLICK_DPS_SHARE;
  for (const id of upgradeIds) {
    const def = UPGRADE_BY_ID[id];
    if (!def) continue;
    if (def.multiplier) flat *= def.multiplier;
    if (def.shareMultiplier) share *= def.shareMultiplier;
  }
  // producerDps, not dpsOf: the free BASE_DPS trickle must not inflate clicks.
  return flat + share * producerDps(state);
}

/**
 * Multiplier on ALL live income (production and taps alike) — 7 during a
 * golden-dumpling frenzy, 1 otherwise. Deliberately NOT folded into dpsOf():
 * the shop, the click share-term and offline earnings all want true production,
 * and only the live earning paths should be boosted.
 */
export function incomeMultiplier(state: GameState, now: number): number {
  return isFrenzyActive(state.frenzyUntil, now) ? FRENZY_MULTIPLIER : 1;
}

/** Dumplings accrued while away: capped elapsed time at a reduced rate. */
export function offlineEarnings(
  dps: number,
  savedAt: number,
  now: number,
): number {
  const elapsedMs = Math.min(Math.max(now - savedAt, 0), OFFLINE_CAP_MS);
  return dps * (elapsedMs / 1000) * OFFLINE_RATE;
}

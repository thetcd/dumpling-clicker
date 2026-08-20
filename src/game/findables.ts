// When findables appear, which kind, and when they leave. Pure over
// (lane, schedule, now, rand) so it is testable without a clock or a DOM —
// the element half lives in src/ui/findables.ts.
//
// ONE SLOT PER LANE: `active` is a single field, not a list. Lanes are
// independent so the common lane's 10-25s drip cannot crowd out the rare one.
import {
  COMMON_SKINS,
  FINDABLE_BY_ID,
  type FindableKind,
  type LaneDef,
} from './config/findables';

export type { FindableKind };

export interface Schedule {
  /** epoch ms of the next spawn; only meaningful while `active` is null */
  nextAt: number;
  active: FindableKind | null;
  /** epoch ms the active one leaves untapped; only meaningful while active */
  despawnAt: number;
}

export type FindableAction =
  | { type: 'none' }
  | { type: 'spawn'; kind: FindableKind }
  | { type: 'despawn' };

/** Epoch ms for this lane's next spawn: uniform in [min, max] after `now`. */
export function rollNextSpawn(
  lane: LaneDef,
  now: number,
  rand: () => number = Math.random,
): number {
  return now + lane.minMs + rand() * (lane.maxMs - lane.minMs);
}

export function createSchedule(
  lane: LaneDef,
  now: number,
  rand: () => number = Math.random,
): Schedule {
  return { nextAt: rollNextSpawn(lane, now, rand), active: null, despawnAt: 0 };
}

/** Weighted pick across the lane's kinds. */
export function pickKind(lane: LaneDef, rand: () => number = Math.random): FindableKind {
  const total = lane.kinds.reduce((sum, k) => sum + k.weight, 0);
  let roll = rand() * total;
  for (const k of lane.kinds) {
    roll -= k.weight;
    if (roll < 0) return k.id;
  }
  return lane.kinds[lane.kinds.length - 1].id;
}

/** Cosmetic only — which emoji a common findable wears this time. */
export function pickSkin(rand: () => number = Math.random): string {
  const i = Math.min(COMMON_SKINS.length - 1, Math.floor(rand() * COMMON_SKINS.length));
  return COMMON_SKINS[i];
}

/**
 * Clearing a slot and rolling its next spawn are ONE operation, on purpose.
 * A natural spawn fires when `now >= nextAt`, which leaves `nextAt` in the past
 * for as long as that findable is alive. Any path that clears `active` without
 * rescheduling re-enters the spawn branch on the very next frame, forever.
 * That shipped on 2026-08-20 via the tap handler and left the x7 frenzy
 * permanently active. Both exit paths below go through here.
 */
export function collect(
  lane: LaneDef,
  now: number,
  rand: () => number = Math.random,
): Schedule {
  return { nextAt: rollNextSpawn(lane, now, rand), active: null, despawnAt: 0 };
}

/** One tick of one lane. */
export function advance(
  lane: LaneDef,
  schedule: Schedule,
  now: number,
  rand: () => number = Math.random,
): { schedule: Schedule; action: FindableAction } {
  if (schedule.active) {
    if (now >= schedule.despawnAt) {
      return { schedule: collect(lane, now, rand), action: { type: 'despawn' } };
    }
    return { schedule, action: { type: 'none' } };
  }
  if (now >= schedule.nextAt) {
    const kind = pickKind(lane, rand);
    return {
      schedule: {
        nextAt: schedule.nextAt,
        active: kind,
        despawnAt: now + FINDABLE_BY_ID[kind].lifetimeMs,
      },
      action: { type: 'spawn', kind },
    };
  }
  return { schedule, action: { type: 'none' } };
}

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

/** One findable currently on screen. `id` is how the UI addresses its element. */
export interface ActiveFindable {
  id: number;
  kind: FindableKind;
  /** epoch ms it leaves untapped */
  despawnAt: number;
}

export interface Schedule {
  /** epoch ms of the next spawn; ignored while the lane is at capacity */
  nextAt: number;
  active: ActiveFindable[];
  /** monotonic, so an id is never reused while its element is still around */
  nextId: number;
}

export type FindableAction =
  | { type: 'spawn'; kind: FindableKind; id: number }
  | { type: 'despawn'; id: number };

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
  return { nextAt: rollNextSpawn(lane, now, rand), active: [], nextId: 1 };
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
 * Horizontal placement that avoids whatever is already on screen.
 *
 * Placement geometry, but pure and therefore tested here rather than in the DOM
 * half. Two lanes place independently, so without this they collide: a 430px
 * stage with a 96px airdrop and a 56px coin both drawing a random x lands them
 * on top of each other often enough to see, and the one underneath becomes
 * untappable. Avoiding overlap horizontally is enough — it guarantees no
 * collision whatever the vertical offsets are.
 *
 * `occupied` is a list of [start, end] horizontal extents in the same
 * coordinate space as the returned x. Falls back to the point furthest from
 * everything when no gap is wide enough, which cannot happen at current sizes
 * but must not throw if someone widens an element later.
 */
/**
 * Two-dimensional placement, for a lane that holds more than one at a time.
 *
 * `pickFreeX` below spreads a handful of findables along a single strip, which
 * is all two one-slot lanes ever needed. Ten airdrops cannot work that way:
 * at 60px each they want 600px of a 430px stage, so they have to stack into
 * rows as well. Overlap is not cosmetic here — a parcel underneath another one
 * cannot be tapped at all.
 *
 * `occupied` takes arbitrary rectangles, not just other findables: the squishy's
 * FACE is passed in as a keep-out box. Measured on a 430x900 phone, the strip
 * above the face is 53px tall — one row — so ten parcels have to be allowed
 * around the hero rather than only above it.
 *
 * Falls back to the point furthest from everything when the field is genuinely
 * too full, so it degrades into a slight overlap rather than looping forever.
 */
export function pickFreeSpot(
  size: number,
  maxX: number,
  maxY: number,
  occupied: Array<{ x: number; y: number; w: number; h: number }>,
  rand: () => number = Math.random,
  gap = 8,
): { x: number; y: number } {
  const clear = (x: number, y: number) =>
    occupied.every(
      (o) =>
        x + size + gap <= o.x ||
        o.x + o.w + gap <= x ||
        y + size + gap <= o.y ||
        o.y + o.h + gap <= y,
    );
  for (let i = 0; i < 24; i++) {
    const x = rand() * maxX;
    const y = rand() * maxY;
    if (clear(x, y)) return { x, y };
  }
  // Random alone is not enough once the field is busy. With ten parcels and the
  // face blocked out there are only about a dozen legal spots on a 430x324
  // stage, so the last few placements kept exhausting their tries and dropping
  // to the fallback — which ignored the keep-out and put parcels on the face.
  // Sweep the grid for anything genuinely clear before giving up.
  const STEPS = 12;
  const candidates: Array<{ x: number; y: number }> = [];
  for (let ix = 0; ix <= STEPS; ix++) {
    for (let iy = 0; iy <= STEPS; iy++) {
      const x = (ix / STEPS) * maxX;
      const y = (iy / STEPS) * maxY;
      if (clear(x, y)) candidates.push({ x, y });
    }
  }
  if (candidates.length) {
    return candidates[Math.min(candidates.length - 1, Math.floor(rand() * candidates.length))];
  }
  // Genuinely nowhere to go: take the point furthest from everything so the
  // overlap is at least as small as it can be, rather than throwing or looping.
  let best = { x: 0, y: 0 };
  let bestDistance = -1;
  for (let ix = 0; ix <= STEPS; ix++) {
    for (let iy = 0; iy <= STEPS; iy++) {
      const x = (ix / STEPS) * maxX;
      const y = (iy / STEPS) * maxY;
      const d = occupied.length
        ? Math.min(...occupied.map((o) => Math.hypot(x - o.x - o.w / 2, y - o.y - o.h / 2)))
        : Number.POSITIVE_INFINITY;
      if (d > bestDistance) {
        bestDistance = d;
        best = { x, y };
      }
    }
  }
  return best;
}

export function pickFreeX(
  size: number,
  maxX: number,
  occupied: Array<[number, number]>,
  rand: () => number = Math.random,
  gap = 8,
): number {
  const clear = (x: number) =>
    occupied.every(([s, e]) => x + size + gap <= s || x >= e + gap);
  for (let i = 0; i < 12; i++) {
    const x = rand() * maxX;
    if (clear(x)) return x;
  }
  // nothing random worked: take the position furthest from every occupied span
  let best = 0;
  let bestDistance = -1;
  for (let i = 0; i <= 20; i++) {
    const x = (i / 20) * maxX;
    const centre = x + size / 2;
    const d = occupied.length
      ? Math.min(...occupied.map(([s, e]) => Math.abs(centre - (s + e) / 2)))
      : Number.POSITIVE_INFINITY;
    if (d > bestDistance) {
      bestDistance = d;
      best = x;
    }
  }
  return best;
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
  schedule: Schedule,
  id: number,
  now: number,
  rand: () => number = Math.random,
): Schedule {
  const active = schedule.active.filter((a) => a.id !== id);
  // Only re-roll when the lane was full: with a spare slot the timer is already
  // running and rolling again would silently delay the next spawn every time
  // the player taps one.
  const wasFull = schedule.active.length >= lane.capacity;
  return {
    nextAt: wasFull ? rollNextSpawn(lane, now, rand) : schedule.nextAt,
    active,
    nextId: schedule.nextId,
  };
}

/**
 * One tick of one lane: retire whatever expired, then spawn at most one.
 *
 * At most ONE per tick on purpose. A backgrounded tab hands the loop a huge
 * jump in `now`, and "spawn until the timer catches up" would fill all ten
 * airdrop slots in a single frame the moment the player returned.
 *
 * While the lane is at capacity, `nextAt` is deliberately left in the past and
 * nothing is rolled — so a freed slot refills on the next frame rather than
 * making the player wait out another full interval for a parcel they just made
 * room for.
 */
export function advance(
  lane: LaneDef,
  schedule: Schedule,
  now: number,
  rand: () => number = Math.random,
): { schedule: Schedule; actions: FindableAction[] } {
  const actions: FindableAction[] = [];
  let active = schedule.active;
  const expired = active.filter((a) => now >= a.despawnAt);
  if (expired.length) {
    for (const a of expired) actions.push({ type: 'despawn', id: a.id });
    active = active.filter((a) => now < a.despawnAt);
  }

  let { nextAt, nextId } = schedule;
  if (active.length < lane.capacity && now >= nextAt) {
    const kind = pickKind(lane, rand);
    const id = nextId++;
    active = [...active, { id, kind, despawnAt: now + FINDABLE_BY_ID[kind].lifetimeMs }];
    nextAt = rollNextSpawn(lane, now, rand);
    actions.push({ type: 'spawn', kind, id });
  } else if (expired.length && now >= nextAt) {
    // a slot just freed by timeout, but the spawn above did not fire (capacity
    // is still full) — leave the timer alone, the next tick will take it
    nextAt = schedule.nextAt;
  }

  return { schedule: { nextAt, active, nextId }, actions };
}

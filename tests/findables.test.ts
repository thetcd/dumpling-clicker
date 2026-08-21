import { describe, expect, test } from 'vitest';
import {
  advance,
  collect,
  createSchedule,
  pickFreeSpot,
  pickFreeX,
  pickKind,
  pickSkin,
  rollNextSpawn,
} from '../src/game/findables';
import { COMMON_SKINS, FINDABLE_BY_ID, LANE_BY_ID } from '../src/game/config/findables';

const COMMON = LANE_BY_ID.common;
const RARE = LANE_BY_ID.rare;
const AIR = LANE_BY_ID.airdrop;

describe('rollNextSpawn', () => {
  test('rand=0 gives the lane its soonest allowed spawn', () => {
    expect(rollNextSpawn(COMMON, 1_000, () => 0)).toBe(1_000 + COMMON.minMs);
  });

  test('each lane uses its own window', () => {
    expect(rollNextSpawn(RARE, 0, () => 0)).toBe(RARE.minMs);
    expect(rollNextSpawn(COMMON, 0, () => 0)).toBe(COMMON.minMs);
    expect(RARE.minMs).toBeGreaterThan(COMMON.maxMs);
  });

  test('always lands inside the lane window', () => {
    for (const lane of [COMMON, RARE]) {
      for (let i = 0; i <= 20; i++) {
        const t = rollNextSpawn(lane, 5_000, () => i / 20);
        expect(t).toBeGreaterThanOrEqual(5_000 + lane.minMs);
        expect(t).toBeLessThanOrEqual(5_000 + lane.maxMs);
      }
    }
  });
});

describe('advance', () => {
  test('does nothing before the spawn time', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    expect(advance(COMMON, s, 10, () => 0).actions).toEqual([]);
  });

  test('spawns once the spawn time arrives', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    const at = COMMON.minMs;
    const { schedule, actions } = advance(COMMON, s, at, () => 0);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'spawn', kind: 'common' });
    expect(schedule.active).toHaveLength(1);
    expect(schedule.active[0].despawnAt).toBe(at + FINDABLE_BY_ID.common.lifetimeMs);
  });

  test('a one-slot lane still holds only one at a time', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    const spawned = advance(COMMON, s, COMMON.minMs, () => 0).schedule;
    expect(advance(COMMON, spawned, COMMON.minMs + 1, () => 0).actions).toEqual([]);
  });

  test('despawns after its lifetime and reschedules into the future', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    const spawned = advance(COMMON, s, COMMON.minMs, () => 0).schedule;
    const at = spawned.active[0].despawnAt;
    const { schedule, actions } = advance(COMMON, spawned, at, () => 0);
    expect(actions.some((a) => a.type === 'despawn')).toBe(true);
    expect(schedule.active).toHaveLength(0);
    // the timer runs spawn-to-spawn, so "one every N seconds" means what it
    // says rather than N seconds after the last one happened to leave
    expect(schedule.nextAt).toBeGreaterThan(at);
  });

  test('lanes are independent — a busy common lane never blocks the rare one', () => {
    const common = advance(COMMON, createSchedule(COMMON, 0, () => 0), COMMON.minMs, () => 0);
    const rare = advance(RARE, createSchedule(RARE, 0, () => 0), RARE.minMs, () => 0);
    expect(common.actions[0].type).toBe('spawn');
    expect(rare.actions[0].type).toBe('spawn');
  });
});

describe('the airdrop lane piles up', () => {
  // Gal: parcels should accumulate while the player is away from the screen,
  // which is the reason to leave the app open.
  const fill = (upTo: number) => {
    let s = createSchedule(AIR, 0, () => 0);
    let now = 0;
    for (let i = 0; i < upTo * 3; i++) {
      now += AIR.minMs;
      s = advance(AIR, s, now, () => 0).schedule;
    }
    return { schedule: s, now };
  };

  test('holds many at once, up to the lane capacity', () => {
    expect(AIR.capacity).toBeGreaterThan(1);
    const { schedule } = fill(AIR.capacity);
    expect(schedule.active).toHaveLength(AIR.capacity);
  });

  test('never exceeds the cap however long nobody collects', () => {
    const { schedule } = fill(AIR.capacity * 2);
    expect(schedule.active.length).toBeLessThanOrEqual(AIR.capacity);
  });

  test('spawns at most one per tick, so ten never appear in one frame', () => {
    let s = createSchedule(AIR, 0, () => 0);
    // jump far past several spawn windows in a single step
    const { actions } = advance(AIR, s, AIR.maxMs * 5, () => 0);
    expect(actions.filter((a) => a.type === 'spawn')).toHaveLength(1);
  });

  test('collecting one frees a slot for the next', () => {
    const { schedule, now } = fill(AIR.capacity);
    const victim = schedule.active[0].id;
    const after = collect(AIR, schedule, victim, now, () => 0);
    expect(after.active).toHaveLength(AIR.capacity - 1);
    expect(after.active.some((a) => a.id === victim)).toBe(false);
  });

  test('every live findable has its own id', () => {
    const { schedule } = fill(AIR.capacity);
    const ids = schedule.active.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('several expiring in one tick all report a despawn', () => {
    const { schedule, now } = fill(3);
    const latest = Math.max(...schedule.active.map((a) => a.despawnAt));
    const { actions, schedule: after } = advance(AIR, schedule, latest, () => 0);
    expect(actions.filter((a) => a.type === 'despawn').length).toBeGreaterThanOrEqual(3);
    expect(after.active.filter((a) => a.despawnAt <= latest)).toHaveLength(0);
    void now;
  });
});

describe('collect — the 2026-08-20 regression', () => {
  // A natural spawn fires when now >= nextAt, so nextAt is in the PAST for as
  // long as that findable is alive. Clearing without rescheduling re-enters
  // the spawn branch on the very next frame, forever. Catching one used to do
  // exactly that, which left the x7 frenzy permanently active.
  test('catching from a one-slot lane reschedules into the future', () => {
    const spawned = advance(RARE, createSchedule(RARE, 0, () => 0), RARE.minMs, () => 0).schedule;
    const caughtAt = RARE.minMs + 500;
    const after = collect(RARE, spawned, spawned.active[0].id, caughtAt, () => 0);
    expect(after.active).toHaveLength(0);
    expect(after.nextAt).toBeGreaterThanOrEqual(caughtAt + RARE.minMs);
  });

  test('the frame after a catch does not spawn', () => {
    const spawned = advance(RARE, createSchedule(RARE, 0, () => 0), RARE.minMs, () => 0).schedule;
    const caughtAt = RARE.minMs + 500;
    const after = collect(RARE, spawned, spawned.active[0].id, caughtAt, () => 0);
    expect(advance(RARE, after, caughtAt + 16, () => 0).actions).toEqual([]);
  });

  test('both exit paths leave a one-slot lane scheduled in the future', () => {
    for (const lane of [COMMON, RARE]) {
      const spawned = advance(lane, createSchedule(lane, 0, () => 0), lane.minMs, () => 0)
        .schedule;
      const at = spawned.active[0].despawnAt;
      const viaTimeout = advance(lane, spawned, at, () => 0).schedule;
      const viaCatch = collect(lane, spawned, spawned.active[0].id, at, () => 0);
      expect(viaTimeout.nextAt).toBeGreaterThan(at);
      expect(viaCatch.nextAt).toBeGreaterThan(at);
    }
  });
});

describe('pickKind', () => {
  test('a single-kind lane always returns that kind', () => {
    expect(pickKind(COMMON, () => 0)).toBe('common');
    expect(pickKind(COMMON, () => 0.999999)).toBe('common');
  });

  test('the rare lane is the golden dumpling and nothing else', () => {
    // it shared the lane with the airdrop at 45/55 until the airdrop moved to
    // its own 30s lane; leaving them together would have spent the frenzy's
    // scarcity, which is the only reason it lands as a reward
    expect(RARE.kinds.map((k) => k.id)).toEqual(['golden']);
    for (let i = 0; i < 100; i++) expect(pickKind(RARE, () => i / 100)).toBe('golden');
  });

  test('the airdrop lane only ever produces airdrops', () => {
    for (let i = 0; i < 100; i++) expect(pickKind(AIR, () => i / 100)).toBe('airdrop');
  });
});

describe('pickFreeSpot', () => {
  // Ten airdrops at 56px cannot fit one row of a 430px stage, so the airdrop
  // lane places in two dimensions. Overlap here means a parcel underneath
  // another one that cannot be tapped at all.
  const hits = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    size: number,
    gap = 8,
  ) =>
    a.x < b.x + size + gap && b.x < a.x + size + gap &&
    a.y < b.y + size + gap && b.y < a.y + size + gap;

  test('stays inside the field', () => {
    for (let i = 0; i < 50; i++) {
      const s = pickFreeSpot(56, 430 - 56, 300 - 56, [], () => i / 50);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(430 - 56);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(300 - 56);
    }
  });

  test('ten parcels placed in turn never land on each other', () => {
    const size = 56;
    const placed: { x: number; y: number }[] = [];
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 10; i++) {
      const spot = pickFreeSpot(
        size,
        430 - size,
        340 - size,
        placed.map((p) => ({ x: p.x, y: p.y, w: size, h: size })),
        rand,
      );
      for (const other of placed) {
        expect(hits(spot, other, size), `parcel ${i} overlaps an earlier one`).toBe(false);
      }
      placed.push(spot);
    }
  });

  test('finds a free cell even when the random search keeps missing', () => {
    // rand() = 0 always proposes the same point; with that point blocked, a
    // purely random search exhausts its tries and used to drop to a fallback
    // that ignored the keep-out entirely and placed parcels on the face
    const blocked = [{ x: 0, y: 0, w: 200, h: 200 }];
    const spot = pickFreeSpot(56, 400, 400, blocked, () => 0);
    const overlapsBlocked =
      spot.x < 200 + 8 && spot.x + 56 + 8 > 0 && spot.y < 200 + 8 && spot.y + 56 + 8 > 0;
    expect(overlapsBlocked).toBe(false);
  });

  test('falls back to the furthest gap rather than throwing when it is packed', () => {
    // deliberately impossible: a field with room for two, asked for a third
    const occupied = [
      { x: 0, y: 0, w: 56, h: 56 },
      { x: 60, y: 0, w: 56, h: 56 },
    ];
    const spot = pickFreeSpot(56, 60, 0, occupied, () => 0.5);
    expect(Number.isFinite(spot.x)).toBe(true);
    expect(Number.isFinite(spot.y)).toBe(true);
  });
});

describe('pickFreeX', () => {
  // Two lanes place independently. Without avoidance a 96px airdrop and a 56px
  // coin on a 430px stage land on top of each other often enough to see, and
  // whichever ends up underneath cannot be tapped.
  const overlaps = (a: [number, number], b: [number, number], gap = 8) =>
    a[0] < b[1] + gap && b[0] < a[1] + gap;

  test('with nothing on screen it stays inside the stage', () => {
    for (let i = 0; i <= 10; i++) {
      const x = pickFreeX(56, 374, [], () => i / 10);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(374);
    }
  });

  test('never overlaps an occupied span', () => {
    const occupied: Array<[number, number]> = [[150, 246]]; // a 96px element mid-stage
    for (let i = 0; i < 40; i++) {
      const x = pickFreeX(56, 374, occupied, () => (i * 0.025) % 1);
      expect(overlaps([x, x + 56], occupied[0])).toBe(false);
    }
  });

  test('falls back to the furthest point when no gap fits', () => {
    // an occupied span covering effectively the whole stage
    const x = pickFreeX(56, 374, [[0, 430]], () => 0.5);
    expect(Number.isFinite(x)).toBe(true);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(374);
  });

  test('avoids several occupied spans at once', () => {
    const occupied: Array<[number, number]> = [
      [0, 60],
      [300, 380],
    ];
    for (let i = 0; i < 40; i++) {
      const x = pickFreeX(56, 374, occupied, () => (i * 0.025) % 1);
      for (const span of occupied) expect(overlaps([x, x + 56], span)).toBe(false);
    }
  });
});

describe('pickSkin', () => {
  test('rand=0 gives the first skin', () => {
    expect(pickSkin(() => 0)).toBe(COMMON_SKINS[0]);
  });

  test('every skin is reachable and none is undefined', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickSkin(() => i / 200));
    expect(seen).toEqual(new Set(COMMON_SKINS));
    expect(seen.has(undefined as unknown as string)).toBe(false);
  });
});

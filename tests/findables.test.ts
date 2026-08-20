import { describe, expect, test } from 'vitest';
import {
  advance,
  collect,
  createSchedule,
  pickKind,
  pickSkin,
  rollNextSpawn,
} from '../src/game/findables';
import { COMMON_SKINS, FINDABLE_BY_ID, LANE_BY_ID } from '../src/game/config/findables';

const COMMON = LANE_BY_ID.common;
const RARE = LANE_BY_ID.rare;

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
    expect(advance(COMMON, s, 10, () => 0).action.type).toBe('none');
  });

  test('spawns once the spawn time arrives', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    const at = COMMON.minMs;
    const { schedule, action } = advance(COMMON, s, at, () => 0);
    expect(action).toEqual({ type: 'spawn', kind: 'common' });
    expect(schedule.active).toBe('common');
    expect(schedule.despawnAt).toBe(at + FINDABLE_BY_ID.common.lifetimeMs);
  });

  test('a lane holds only one findable at a time', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    const spawned = advance(COMMON, s, COMMON.minMs, () => 0).schedule;
    expect(advance(COMMON, spawned, COMMON.minMs + 1, () => 0).action.type).toBe('none');
  });

  test('despawns after its lifetime and reschedules into the future', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    const spawned = advance(COMMON, s, COMMON.minMs, () => 0).schedule;
    const at = spawned.despawnAt;
    const { schedule, action } = advance(COMMON, spawned, at, () => 0);
    expect(action.type).toBe('despawn');
    expect(schedule.active).toBeNull();
    expect(schedule.nextAt).toBeGreaterThanOrEqual(at + COMMON.minMs);
  });

  test('lanes are independent — a busy common lane never blocks the rare one', () => {
    // the whole reason two lanes exist: at 10-25s the common lane would
    // occupy a shared slot almost permanently and starve the golden dumpling
    const common = advance(COMMON, createSchedule(COMMON, 0, () => 0), COMMON.minMs, () => 0);
    const rare = advance(RARE, createSchedule(RARE, 0, () => 0), RARE.minMs, () => 0);
    expect(common.action.type).toBe('spawn');
    expect(rare.action.type).toBe('spawn');
  });
});

describe('collect — the 2026-08-20 regression', () => {
  // A natural spawn fires when now >= nextAt, so nextAt is in the PAST for as
  // long as that findable is alive. Clearing without rescheduling re-enters
  // the spawn branch on the very next frame, forever. Catching one used to do
  // exactly that, which left the x7 frenzy permanently active.
  test('catching reschedules into the future', () => {
    const caughtAt = RARE.minMs + 500;
    const after = collect(RARE, caughtAt, () => 0);
    expect(after.active).toBeNull();
    expect(after.nextAt).toBeGreaterThanOrEqual(caughtAt + RARE.minMs);
  });

  test('the frame after a catch does not spawn', () => {
    const caughtAt = RARE.minMs + 500;
    const after = collect(RARE, caughtAt, () => 0);
    expect(advance(RARE, after, caughtAt + 16, () => 0).action.type).toBe('none');
  });

  test('both exit paths leave nextAt in the future, in every lane', () => {
    for (const lane of [COMMON, RARE]) {
      const spawned = advance(lane, createSchedule(lane, 0, () => 0), lane.minMs, () => 0)
        .schedule;
      const viaTimeout = advance(lane, spawned, spawned.despawnAt, () => 0).schedule;
      const viaCatch = collect(lane, spawned.despawnAt, () => 0);
      expect(viaTimeout.nextAt).toBeGreaterThan(spawned.despawnAt);
      expect(viaCatch.nextAt).toBeGreaterThan(spawned.despawnAt);
    }
  });
});

describe('pickKind', () => {
  test('a single-kind lane always returns that kind', () => {
    expect(pickKind(COMMON, () => 0)).toBe('common');
    expect(pickKind(COMMON, () => 0.999999)).toBe('common');
  });

  test('rand=0 picks the first kind in the rare lane', () => {
    expect(pickKind(RARE, () => 0)).toBe('golden');
  });

  test('rand just under 1 picks the last kind in the rare lane', () => {
    expect(pickKind(RARE, () => 0.999999)).toBe('airdrop');
  });

  test('both rare kinds are reachable across the range', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(pickKind(RARE, () => i / 100));
    expect(seen).toEqual(new Set(['golden', 'airdrop']));
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

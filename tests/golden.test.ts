import { describe, expect, test } from 'vitest';
import { rollNextSpawn, isFrenzyActive, frenzyRemainingMs } from '../src/game/golden';
import {
  GOLDEN_MAX_INTERVAL_MS,
  GOLDEN_MIN_INTERVAL_MS,
  FRENZY_DURATION_MS,
} from '../src/game/config/balance';

describe('rollNextSpawn', () => {
  test('rand=0 schedules the soonest allowed spawn', () => {
    expect(rollNextSpawn(1_000, () => 0)).toBe(1_000 + GOLDEN_MIN_INTERVAL_MS);
  });

  test('rand just under 1 schedules the latest allowed spawn', () => {
    const t = rollNextSpawn(1_000, () => 0.999999);
    expect(t).toBeGreaterThan(1_000 + GOLDEN_MAX_INTERVAL_MS - 100);
    expect(t).toBeLessThanOrEqual(1_000 + GOLDEN_MAX_INTERVAL_MS);
  });

  test('rand=0.5 lands mid-window', () => {
    const mid = (GOLDEN_MIN_INTERVAL_MS + GOLDEN_MAX_INTERVAL_MS) / 2;
    expect(rollNextSpawn(0, () => 0.5)).toBe(mid);
  });

  test('is always in the future and inside the window', () => {
    for (let i = 0; i <= 20; i++) {
      const t = rollNextSpawn(5_000, () => i / 20);
      expect(t).toBeGreaterThanOrEqual(5_000 + GOLDEN_MIN_INTERVAL_MS);
      expect(t).toBeLessThanOrEqual(5_000 + GOLDEN_MAX_INTERVAL_MS);
    }
  });
});

describe('isFrenzyActive', () => {
  test('a fresh game has no frenzy', () => {
    expect(isFrenzyActive(0, 1_000)).toBe(false);
  });

  test('active while now is before frenzyUntil', () => {
    expect(isFrenzyActive(5_000, 4_999)).toBe(true);
  });

  test('the exact expiry instant is already over', () => {
    expect(isFrenzyActive(5_000, 5_000)).toBe(false);
  });

  test('a stale frenzyUntil from a previous session is over', () => {
    expect(isFrenzyActive(1_000, 9_999_999)).toBe(false);
  });
});

describe('frenzyRemainingMs', () => {
  test('counts down toward zero', () => {
    expect(frenzyRemainingMs(10_000, 4_000)).toBe(6_000);
  });

  test('never goes negative', () => {
    expect(frenzyRemainingMs(10_000, 50_000)).toBe(0);
    expect(frenzyRemainingMs(0, 50_000)).toBe(0);
  });

  test('a full-length frenzy reports its full duration', () => {
    const now = 1_000;
    expect(frenzyRemainingMs(now + FRENZY_DURATION_MS, now)).toBe(FRENZY_DURATION_MS);
  });
});

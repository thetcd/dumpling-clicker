import { describe, expect, test } from 'vitest';
import { isFrenzyActive, frenzyRemainingMs } from '../src/game/golden';
import { FRENZY_DURATION_MS } from '../src/game/config/balance';

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

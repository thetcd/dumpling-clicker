import { describe, expect, test } from 'vitest';
import { rewardFor } from '../src/game/rewards';
import {
  AIRDROP_FLOOR_CLICKS,
  AIRDROP_SECONDS,
  COMMON_FLOOR_CLICKS,
  COMMON_SECONDS,
} from '../src/game/config/balance';

describe('rewardFor', () => {
  test('an airdrop pays its configured seconds of production', () => {
    expect(rewardFor('airdrop', 1_000, 1)).toBe(1_000 * AIRDROP_SECONDS);
  });

  test('a common findable pays its much smaller share', () => {
    expect(rewardFor('common', 1_000, 1)).toBe(1_000 * COMMON_SECONDS);
  });

  test('the golden dumpling pays nothing — it grants a frenzy instead', () => {
    expect(rewardFor('golden', 1_000, 1)).toBe(0);
  });

  test('scales with stage without a table', () => {
    expect(rewardFor('common', 10_000_000, 1) / rewardFor('common', 10, 1)).toBe(1_000_000);
  });

  test('falls back to the click floor when production is near zero', () => {
    expect(rewardFor('airdrop', 0.1, 1)).toBe(AIRDROP_FLOOR_CLICKS);
    expect(rewardFor('common', 0.1, 1)).toBe(COMMON_FLOOR_CLICKS);
  });

  test('the floor scales with click value, so it never goes stale', () => {
    expect(rewardFor('common', 0, 8)).toBe(8 * COMMON_FLOOR_CLICKS);
  });

  test('never returns a negative or non-finite payout', () => {
    expect(rewardFor('common', -5, -5)).toBe(0);
    expect(rewardFor('common', Number.NaN, 1)).toBe(COMMON_FLOOR_CLICKS);
    expect(rewardFor('common', Number.POSITIVE_INFINITY, 1)).toBe(COMMON_FLOOR_CLICKS);
  });
});

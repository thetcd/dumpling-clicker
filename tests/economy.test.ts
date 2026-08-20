import { describe, expect, test } from 'vitest';
import {
  isUpgradeRevealed,
  clickValue,
  clickValueWith,
  costOf,
  dpsOf,
  incomeMultiplier,
  offlineEarnings,
  producerDps,
} from '../src/game/economy';
import { createInitialState } from '../src/game/state';
import { PRODUCERS } from '../src/game/config/producers';
import {
  BASE_DPS,
  CLICK_DPS_SHARE,
  FRENZY_MULTIPLIER,
  OFFLINE_CAP_MS,
  OFFLINE_RATE,
} from '../src/game/config/balance';
import { UPGRADES } from '../src/game/config/upgrades';

const apprentice = PRODUCERS[0]; // baseCost 15

describe('costOf', () => {
  test('first unit costs baseCost', () => {
    expect(costOf(apprentice, 0)).toBe(15);
  });

  test('nth unit follows 1.15^owned growth', () => {
    expect(costOf(apprentice, 1)).toBeCloseTo(15 * 1.15, 10);
    expect(costOf(apprentice, 10)).toBeCloseTo(15 * 1.15 ** 10, 8);
  });

  test('bulk buy of 10 equals the sum of the next 10 unit costs', () => {
    let sum = 0;
    for (let i = 3; i < 13; i++) sum += 15 * 1.15 ** i;
    expect(costOf(apprentice, 3, 10)).toBeCloseTo(sum, 6);
  });
});

describe('producer ladder balance', () => {
  test('no tier is strictly dominated by the tier above it', () => {
    // Cost per +1 dps must not get *cheaper* as you climb, or the lower tier
    // is a trap purchase that a player is always wrong to make.
    for (let i = 0; i < PRODUCERS.length - 1; i++) {
      const here = PRODUCERS[i].baseCost / PRODUCERS[i].baseDps;
      const next = PRODUCERS[i + 1].baseCost / PRODUCERS[i + 1].baseDps;
      expect(
        here,
        `${PRODUCERS[i].id} (${here.toFixed(1)}/dps) is worse value than ${PRODUCERS[i + 1].id} (${next.toFixed(1)}/dps)`,
      ).toBeLessThanOrEqual(next);
    }
  });
});

describe('dpsOf', () => {
  test('a brand-new game already trickles BASE_DPS', () => {
    // It used to sit at exactly 0 until the first purchase, so the game looked
    // inert to anyone who did not immediately start tapping.
    expect(dpsOf(createInitialState(0))).toBeCloseTo(BASE_DPS, 10);
  });

  test('sums producer counts times baseDps, on top of the free trickle', () => {
    const s = createInitialState(0);
    s.producers = { apprentice: 3, stall: 2 };
    expect(dpsOf(s)).toBeCloseTo(
      BASE_DPS + 3 * apprentice.baseDps + 2 * PRODUCERS[1].baseDps,
      10,
    );
  });

  test('ignores unknown producer ids from a hacked/old save', () => {
    const s = createInitialState(0);
    s.producers = { ghost: 99, apprentice: 1 };
    expect(dpsOf(s)).toBeCloseTo(BASE_DPS + apprentice.baseDps, 10);
  });
});

describe('producerDps', () => {
  test('counts only what the player actually bought', () => {
    expect(producerDps(createInitialState(0))).toBe(0);
    const s = createInitialState(0);
    s.producers = { stall: 2 };
    expect(producerDps(s)).toBeCloseTo(2, 10);
  });

  test('the free trickle must not feed the click share-term', () => {
    // Otherwise a brand-new game's first squish is worth 1.005, not a clean 1.
    expect(clickValue(createInitialState(0))).toBe(1);
  });
});

describe('clickValueWith', () => {
  test('previewing an already-owned upgrade changes nothing', () => {
    const s = createInitialState(0);
    s.upgrades = ['fast-fingers'];
    expect(clickValueWith(s, 'fast-fingers')).toBe(clickValue(s));
  });

  test('previewing an unknown id changes nothing', () => {
    const s = createInitialState(0);
    expect(clickValueWith(s, 'ghost-upgrade')).toBe(clickValue(s));
  });

  test('previews a flat multiplier without buying it', () => {
    const s = createInitialState(0);
    expect(clickValueWith(s, 'fast-fingers')).toBe(2);
    expect(s.upgrades).toEqual([]); // must not mutate
    expect(clickValue(s)).toBe(1);
  });

  test('previews a share multiplier against current production', () => {
    const s = createInitialState(0);
    s.producers = { stall: 1_000 };
    const after = clickValueWith(s, 'grandma-hands'); // share x2
    expect(after).toBeCloseTo(1 + CLICK_DPS_SHARE * 2 * 1_000, 10);
    expect(after).toBeGreaterThan(clickValue(s));
  });
});

describe('clickValue', () => {
  test('base click is worth 1', () => {
    expect(clickValue(createInitialState(0))).toBe(1);
  });

  test('purchased upgrades multiply together', () => {
    const s = createInitialState(0);
    s.upgrades = ['fast-fingers', 'secret-technique']; // x2 * x3
    expect(clickValue(s)).toBe(6);
  });

  test('ignores unknown upgrade ids', () => {
    const s = createInitialState(0);
    s.upgrades = ['ghost-upgrade', 'fast-fingers'];
    expect(clickValue(s)).toBe(2);
  });

  test('a squish is also worth CLICK_DPS_SHARE of current production', () => {
    const s = createInitialState(0);
    s.producers = { stall: 100 }; // 100 dps
    expect(clickValue(s)).toBeCloseTo(1 + CLICK_DPS_SHARE * 100, 10);
  });

  test('share-scaling upgrades multiply the production share, not the flat base', () => {
    const s = createInitialState(0);
    s.producers = { stall: 1_000 }; // 1000 dps
    s.upgrades = ['grandma-hands']; // shareMultiplier 2
    expect(clickValue(s)).toBeCloseTo(1 + CLICK_DPS_SHARE * 2 * 1_000, 10);
  });

  test('share-scaling upgrades stack multiplicatively with each other', () => {
    const s = createInitialState(0);
    s.producers = { stall: 1_000 };
    s.upgrades = ['grandma-hands', 'quantum-squish']; // x2 * x2.5 on the share
    expect(clickValue(s)).toBeCloseTo(1 + CLICK_DPS_SHARE * 5 * 1_000, 10);
  });

  test('flat multipliers and share multipliers apply to their own term', () => {
    const s = createInitialState(0);
    s.producers = { stall: 1_000 };
    s.upgrades = ['fast-fingers', 'grandma-hands']; // flat x2, share x2
    expect(clickValue(s)).toBeCloseTo(2 + CLICK_DPS_SHARE * 2 * 1_000, 10);
  });

  test('with no producers the production share contributes nothing', () => {
    const s = createInitialState(0);
    s.upgrades = ['grandma-hands', 'quantum-squish'];
    expect(clickValue(s)).toBe(1);
  });
});

describe('incomeMultiplier', () => {
  test('is 1 with no frenzy running', () => {
    const s = createInitialState(0);
    expect(incomeMultiplier(s, 1_000)).toBe(1);
  });

  test('is FRENZY_MULTIPLIER while a frenzy is running', () => {
    const s = createInitialState(0);
    s.frenzyUntil = 10_000;
    expect(incomeMultiplier(s, 9_999)).toBe(FRENZY_MULTIPLIER);
  });

  test('drops back to 1 the instant the frenzy expires', () => {
    const s = createInitialState(0);
    s.frenzyUntil = 10_000;
    expect(incomeMultiplier(s, 10_000)).toBe(1);
    expect(incomeMultiplier(s, 10_001)).toBe(1);
  });

  test('a frenzy left over from a previous session does not apply', () => {
    const s = createInitialState(0);
    s.frenzyUntil = 1_000; // saved days ago
    expect(incomeMultiplier(s, 9_999_999)).toBe(1);
  });
});

describe('offlineEarnings', () => {
  test('earns dps * elapsed * OFFLINE_RATE', () => {
    const oneHour = 3_600_000;
    expect(offlineEarnings(10, 0, oneHour)).toBeCloseTo(
      10 * 3600 * OFFLINE_RATE,
      6,
    );
  });

  test('caps elapsed time at OFFLINE_CAP_MS', () => {
    const tenHours = 10 * 3_600_000;
    expect(offlineEarnings(10, 0, tenHours)).toBeCloseTo(
      10 * (OFFLINE_CAP_MS / 1000) * OFFLINE_RATE,
      6,
    );
  });

  test('clock skew (savedAt in the future) earns 0, never negative', () => {
    expect(offlineEarnings(10, 5_000, 1_000)).toBe(0);
  });

  test('zero dps earns 0', () => {
    expect(offlineEarnings(0, 0, 3_600_000)).toBe(0);
  });
});

describe('click upgrade gates', () => {
  // Dor flagged 2026-08-20: the shop teases the next locked upgrade as
  // "unlocks after N more squishes", so a big gate reads as "tap 1,700 more
  // times" and turns a reward into homework. Cost is the real gate; these
  // exist only so the first launch is not a wall of chips.
  const MAX_GATE = 300;

  test('no upgrade demands an unreasonable number of taps', () => {
    for (const u of UPGRADES) {
      expect(u.unlockAtClicks, `${u.id} gate is too high`).toBeLessThanOrEqual(MAX_GATE);
    }
  });

  test('gates rise with cost, so the cheap ones always arrive first', () => {
    const byCost = [...UPGRADES].sort((a, b) => a.cost - b.cost);
    for (let i = 1; i < byCost.length; i++) {
      expect(byCost[i].unlockAtClicks).toBeGreaterThanOrEqual(byCost[i - 1].unlockAtClicks);
    }
  });

  test('the first upgrade is reachable in the opening seconds', () => {
    const cheapest = [...UPGRADES].sort((a, b) => a.cost - b.cost)[0];
    expect(cheapest.unlockAtClicks).toBeLessThanOrEqual(15);
  });
});

describe('isUpgradeRevealed', () => {
  // Two conditions doing different jobs. Lowering the tap gates alone made
  // every upgrade appear at once, and five chips pushed the producer list —
  // the core purchase loop — off the bottom of the shop.
  const cheap = { cost: 100, unlockAtClicks: 10 };
  const dear = { cost: 5_000_000, unlockAtClicks: 250 };

  test('hidden until the tap gate is met', () => {
    expect(isUpgradeRevealed(cheap, 9, 1e9)).toBe(false);
    expect(isUpgradeRevealed(cheap, 10, 1e9)).toBe(true);
  });

  test('hidden until you have earned a real fraction of the price', () => {
    expect(isUpgradeRevealed(dear, 999, 0)).toBe(false);
    expect(isUpgradeRevealed(dear, 999, 100)).toBe(false);
    expect(isUpgradeRevealed(dear, 999, 5_000_000)).toBe(true);
  });

  test('an early player sees the cheap upgrade but not the expensive one', () => {
    // the exact state that produced the regression: 260 banked, 257 taps
    expect(isUpgradeRevealed(cheap, 257, 260)).toBe(true);
    expect(isUpgradeRevealed(dear, 257, 260)).toBe(false);
  });

  test('reveals never reverse, because they key off totalEarned', () => {
    // totalEarned only grows, so spending everything cannot hide a chip again
    const earnedSoFar = 400;
    expect(isUpgradeRevealed(cheap, 257, earnedSoFar)).toBe(true);
    expect(isUpgradeRevealed(cheap, 257, earnedSoFar + 1)).toBe(true);
  });
});

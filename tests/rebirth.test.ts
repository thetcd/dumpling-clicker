import { describe, expect, test } from 'vitest';
import {
  canRebirth,
  rebirthMultiplier,
  rebirthProgress,
  rebirthRequirement,
} from '../src/game/rebirth';
import { rebirth } from '../src/game/actions';
import { clickValue, dpsOf } from '../src/game/economy';
import { createInitialState } from '../src/game/state';
import {
  REBIRTH_BASE,

  REBIRTH_GROWTH,
} from '../src/game/config/balance';

const at = (prestige: number, runEarned: number) => {
  const s = createInitialState(0);
  s.prestige = prestige;
  s.runEarned = runEarned;
  return s;
};

describe('rebirthRequirement', () => {
  test('the first rebirth costs the base', () => {
    expect(rebirthRequirement(0)).toBe(REBIRTH_BASE);
  });

  test('grows exponentially, which is what makes late rebirths take hours', () => {
    expect(rebirthRequirement(1)).toBeCloseTo(REBIRTH_BASE * REBIRTH_GROWTH);
    expect(rebirthRequirement(3)).toBeCloseTo(REBIRTH_BASE * REBIRTH_GROWTH ** 3);
  });

  test('junk prestige falls back to the first rung', () => {
    expect(rebirthRequirement(Number.NaN)).toBe(REBIRTH_BASE);
    expect(rebirthRequirement(-4)).toBe(REBIRTH_BASE);
  });
});

describe('rebirthMultiplier', () => {
  test('a fresh game has no bonus', () => {
    expect(rebirthMultiplier(0)).toBe(1);
  });

  test('the first rebirths each double you', () => {
    // Gal: the early ones have to feel enormous, like a Roblox simulator
    expect(rebirthMultiplier(1)).toBeCloseTo(2);
    expect(rebirthMultiplier(5)).toBeCloseTo(6);
  });

  test('the step down the tiers, exactly where the ladder says', () => {
    expect(rebirthMultiplier(15)).toBeCloseTo(11); // 6 + 10 x 0.5
    expect(rebirthMultiplier(30)).toBeCloseTo(14.75); // 11 + 15 x 0.25
  });

  test('each rebirth is worth no more than the one before it', () => {
    for (let n = 1; n < 60; n++) {
      const step = rebirthMultiplier(n) - rebirthMultiplier(n - 1);
      const prev = rebirthMultiplier(n - 1) - rebirthMultiplier(Math.max(0, n - 2));
      if (n > 1) expect(step, `rebirth ${n} pays more than ${n - 1}`).toBeLessThanOrEqual(prev + 1e-9);
    }
  });

  test('never compounds — it is a sum of steps, not a product', () => {
    // x2 per rebirth compounding would be x2^30; the tail is deliberately flat
    expect(rebirthMultiplier(30)).toBeLessThan(20);
    expect(rebirthMultiplier(60)).toBeLessThan(30);
  });

  test('keeps growing forever, so there is always a reason to rebirth again', () => {
    expect(rebirthMultiplier(100)).toBeGreaterThan(rebirthMultiplier(60));
  });

  test('grows slower than the requirement, so runs never trivialise', () => {
    // only true from the point the buff tiers flatten — the first few rebirths
    // are deliberately generous enough to outpace it
    const reqGrowth = rebirthRequirement(30) / rebirthRequirement(20);
    const buffGrowth = rebirthMultiplier(30) / rebirthMultiplier(20);
    expect(reqGrowth).toBeGreaterThan(buffGrowth);
  });
});

describe('rebirthProgress and canRebirth', () => {
  test('progress runs 0 to 1 and clamps', () => {
    expect(rebirthProgress(at(0, 0))).toBe(0);
    expect(rebirthProgress(at(0, REBIRTH_BASE / 2))).toBeCloseTo(0.5);
    expect(rebirthProgress(at(0, REBIRTH_BASE * 99))).toBe(1);
  });

  test('you cannot rebirth early', () => {
    expect(canRebirth(at(0, REBIRTH_BASE - 1))).toBe(false);
    expect(canRebirth(at(0, REBIRTH_BASE))).toBe(true);
  });
});

describe('the rebirth action', () => {
  test('refuses when the requirement is not met, leaving the run intact', () => {
    const s = at(0, 10);
    s.producers = { stall: 4 };
    expect(rebirth(s, 0).producers).toEqual({ stall: 4 });
  });

  test('spends the run and banks a permanent level', () => {
    const s = at(0, REBIRTH_BASE);
    s.upgrades = ['fast-fingers'];
    s.dumplings = 9999;
    const after = rebirth(s, 0);
    expect(after.prestige).toBe(1);
    expect(after.upgrades).toEqual([]);
    expect(after.dumplings).toBe(0);
    expect(after.runEarned).toBe(0);
  });

  test('you keep a quarter of every producer', () => {
    // Gal: a reset that takes everything is punishing. Keeping a slice means
    // each rebirth visibly starts you further along than the last one did.
    const s = at(0, REBIRTH_BASE);
    s.producers = { apprentice: 40, stall: 8, factory: 3 };
    const after = rebirth(s, 0);
    expect(after.producers.apprentice).toBe(10);
    expect(after.producers.stall).toBe(2);
    expect(after.producers.factory).toBeUndefined(); // floor(0.75) is nothing kept
  });

  test('a single unit of something is not kept, and leaves no zero behind', () => {
    const s = at(0, REBIRTH_BASE);
    s.producers = { boss: 1 };
    const after = rebirth(s, 0);
    // a 0 count would render a "you own 0" row and feed dpsOf a dead entry
    expect(after.producers.boss).toBeUndefined();
  });

  test('click upgrades are never kept', () => {
    // they are one-time buys: keeping them makes that ladder one-and-done
    const s = at(0, REBIRTH_BASE);
    s.upgrades = ['fast-fingers', 'warm-hands', 'silk-gloves'];
    expect(rebirth(s, 0).upgrades).toEqual([]);
  });

  test('what you keep compounds across rebirths without ever reaching zero-sum', () => {
    let s = at(0, REBIRTH_BASE);
    s.producers = { stall: 100 };
    s = rebirth(s, 0);
    expect(s.producers.stall).toBe(25);
    s.runEarned = rebirthRequirement(s.prestige);
    s = rebirth(s, 0);
    expect(s.producers.stall).toBe(6); // floor(25 * 0.25)
  });

  test('keeps the squishy, the settings and the lifetime record', () => {
    const s = at(0, REBIRTH_BASE);
    s.avatar = { color: 'sky', eyes: 'star', mouth: 'kiss', accessory: 'bow' };
    s.settings = { sound: false, music: false };
    s.totalEarned = 123_456;
    s.stats.totalClicks = 900;
    const after = rebirth(s, 0);
    expect(after.avatar).toEqual(s.avatar);
    expect(after.settings).toEqual(s.settings);
    // lifetime, NOT run-scoped: it drives which upgrades are revealed, so a
    // rebirthed player does not re-earn the right to see the shop they know
    expect(after.totalEarned).toBe(123_456);
    expect(after.stats.totalClicks).toBe(900);
  });

  test('each rebirth stacks another level', () => {
    let s = at(0, REBIRTH_BASE);
    s = rebirth(s, 0);
    s.runEarned = rebirthRequirement(s.prestige);
    s = rebirth(s, 0);
    expect(s.prestige).toBe(2);
  });
});

describe('the buff reaches the economy', () => {
  test('income scales with prestige', () => {
    const plain = createInitialState(0);
    const veteran = at(10, 0);
    expect(dpsOf(veteran) / dpsOf(plain)).toBeCloseTo(rebirthMultiplier(10));
    expect(clickValue(veteran) / clickValue(plain)).toBeCloseTo(rebirthMultiplier(10));
  });

  test('the scalar is applied once, not squared', () => {
    // dpsOf multiplies at the outer edge while the click share-term reads
    // producerDps raw; scaling both would square the bonus
    const s = at(10, 0);
    s.producers = { stall: 10 };
    const raw = 10 * 1 + 0.5; // 10 stalls at 1 dps + BASE_DPS
    expect(dpsOf(s)).toBeCloseTo(raw * rebirthMultiplier(10));
  });
});

import { describe, expect, test } from 'vitest';
import {
  accrue,
  buyProducer,
  buyUpgrade,
  click,
  grant,
  resetGame,
  startFrenzy,
} from '../src/game/actions';
import { createInitialState } from '../src/game/state';
import { clickValue, critParams, dpsOf } from '../src/game/economy';
import {
  FRENZY_DURATION_MS,
  FRENZY_MULTIPLIER,
  MAX_TICK_DT_MS,
} from '../src/game/config/balance';

describe('click', () => {
  test('adds the click value and counts the squish', () => {
    const s = createInitialState(0);
    const { earned } = click(s, 0);
    expect(earned).toBe(1);
    expect(s.dumplings).toBe(1);
    expect(s.totalEarned).toBe(1);
    expect(s.stats.totalClicks).toBe(1);
  });

  test('respects purchased multipliers', () => {
    const s = createInitialState(0);
    s.upgrades = ['fast-fingers']; // x2
    expect(click(s, 0).earned).toBe(2);
    expect(s.dumplings).toBe(2);
  });
});

describe('buyProducer', () => {
  test('deducts cost and increments count when affordable', () => {
    const s = createInitialState(0);
    s.dumplings = 20;
    expect(buyProducer(s, 'apprentice')).toBe(true); // costs 15
    expect(s.producers.apprentice).toBe(1);
    expect(s.dumplings).toBeCloseTo(5, 10);
  });

  test('refuses when funds are short and changes nothing', () => {
    const s = createInitialState(0);
    s.dumplings = 10;
    expect(buyProducer(s, 'apprentice')).toBe(false);
    expect(s.producers.apprentice).toBeUndefined();
    expect(s.dumplings).toBe(10);
  });

  test('second unit costs more than the first', () => {
    const s = createInitialState(0);
    s.dumplings = 100;
    buyProducer(s, 'apprentice'); // 15
    buyProducer(s, 'apprentice'); // 15 * 1.15
    expect(s.producers.apprentice).toBe(2);
    expect(s.dumplings).toBeCloseTo(100 - 15 - 15 * 1.15, 10);
  });

  test('unknown producer id is refused', () => {
    const s = createInitialState(0);
    s.dumplings = 1e12;
    expect(buyProducer(s, 'ghost')).toBe(false);
  });
});

describe('buyUpgrade', () => {
  test('deducts cost and records the upgrade', () => {
    const s = createInitialState(0);
    s.dumplings = 150;
    expect(buyUpgrade(s, 'fast-fingers')).toBe(true); // costs 100
    expect(s.upgrades).toContain('fast-fingers');
    expect(s.dumplings).toBe(50);
  });

  test('cannot buy the same upgrade twice', () => {
    const s = createInitialState(0);
    s.dumplings = 1000;
    buyUpgrade(s, 'fast-fingers');
    expect(buyUpgrade(s, 'fast-fingers')).toBe(false);
    expect(s.dumplings).toBe(900);
  });

  test('refuses when funds are short', () => {
    const s = createInitialState(0);
    s.dumplings = 99;
    expect(buyUpgrade(s, 'fast-fingers')).toBe(false);
    expect(s.upgrades).toEqual([]);
  });
});

describe('accrue', () => {
  test('adds dps * dt seconds of production', () => {
    const s = createInitialState(0);
    s.producers = { stall: 2 };
    const expected = dpsOf(s) * 0.5; // half a second of production
    accrue(s, 500, 0);
    expect(s.dumplings).toBeCloseTo(expected, 10);
    expect(s.totalEarned).toBeCloseTo(expected, 10);
  });

  test('clamps a single step to MAX_TICK_DT_MS', () => {
    const s = createInitialState(0);
    s.producers = { stall: 1 };
    const rate = dpsOf(s);
    accrue(s, 60_000, 0); // a stalled tab woke up
    expect(s.dumplings).toBeCloseTo(rate * (MAX_TICK_DT_MS / 1000), 10);
  });

  test('tracks playtime', () => {
    const s = createInitialState(0);
    accrue(s, 500, 0);
    expect(s.stats.playtimeMs).toBe(500);
  });
});

describe('frenzy', () => {
  test('startFrenzy runs for FRENZY_DURATION_MS from now', () => {
    const s = createInitialState(0);
    startFrenzy(s, 4_000);
    expect(s.frenzyUntil).toBe(4_000 + FRENZY_DURATION_MS);
  });

  test('tapping a second golden dumpling restarts the timer, never stacks it', () => {
    const s = createInitialState(0);
    startFrenzy(s, 0);
    startFrenzy(s, 5_000);
    expect(s.frenzyUntil).toBe(5_000 + FRENZY_DURATION_MS);
  });

  test('a click during a frenzy earns FRENZY_MULTIPLIER times as much', () => {
    const s = createInitialState(0);
    startFrenzy(s, 0);
    expect(click(s, 1_000).earned).toBe(FRENZY_MULTIPLIER);
    expect(s.dumplings).toBe(FRENZY_MULTIPLIER);
  });

  test('production during a frenzy accrues FRENZY_MULTIPLIER times as fast', () => {
    const s = createInitialState(0);
    s.producers = { stall: 2 };
    const plain = dpsOf(s) * 0.5;
    startFrenzy(s, 0);
    accrue(s, 500, 100);
    expect(s.dumplings).toBeCloseTo(plain * FRENZY_MULTIPLIER, 10);
  });

  test('once the frenzy expires income returns to normal', () => {
    const s = createInitialState(0);
    s.producers = { stall: 2 };
    const plain = dpsOf(s) * 0.5;
    startFrenzy(s, 0);
    accrue(s, 500, FRENZY_DURATION_MS + 1); // well after expiry
    expect(s.dumplings).toBeCloseTo(plain, 10);
    // back to the plain click value, share-of-production term included
    expect(click(s, FRENZY_DURATION_MS + 1).earned).toBeCloseTo(clickValue(s), 10);
  });

  test('a frenzy does not multiply the click count or playtime', () => {
    const s = createInitialState(0);
    startFrenzy(s, 0);
    click(s, 10);
    accrue(s, 500, 10);
    expect(s.stats.totalClicks).toBe(1);
    expect(s.stats.playtimeMs).toBe(500);
  });
});

describe('grant', () => {
  test('advances the rebirth gate as well as the balance', () => {
    const s = createInitialState(0);
    grant(s, 500);
    expect(s.dumplings).toBe(500);
    expect(s.totalEarned).toBe(500);
    expect(s.runEarned).toBe(500);
  });

  test('a frenzy does not multiply a granted payout', () => {
    const s = createInitialState(0);
    startFrenzy(s, 0);
    grant(s, 100);
    expect(s.dumplings).toBe(100);
    expect(s.runEarned).toBe(100);
  });

  test('is not a squish, so it never moves the click count', () => {
    const s = createInitialState(0);
    grant(s, 42);
    expect(s.stats.totalClicks).toBe(0);
  });
});

describe('resetGame', () => {
  test('wipes the economy but keeps the designed squishy and settings', () => {
    const s = createInitialState(0);
    s.dumplings = 5000;
    s.producers = { apprentice: 4 };
    s.upgrades = ['fast-fingers'];
    s.avatar = { color: 'matcha', eyes: 'star', mouth: 'cat', accessory: 'bow' };
    s.designed = true;
    s.settings.sound = false;
    const fresh = resetGame(s, 999);
    expect(fresh.dumplings).toBe(0);
    expect(fresh.producers).toEqual({});
    expect(fresh.upgrades).toEqual([]);
    expect(fresh.stats.totalClicks).toBe(0);
    expect(fresh.avatar).toEqual(s.avatar);
    expect(fresh.designed).toBe(true);
    expect(fresh.settings.sound).toBe(false);
    expect(fresh.stats.createdAt).toBe(999);
  });
});

describe('critical squishes', () => {
  const lucky = () => {
    const s = createInitialState(0);
    s.upgrades = ['lucky-hands'];
    return s;
  };

  test('a plain squish reports no crit', () => {
    const s = createInitialState(0);
    const hit = click(s, 0, () => 0); // roll would crit if it could
    expect(hit.crit).toBe(false);
    expect(hit.earned).toBe(1);
  });

  test('a winning roll pays the crit multiplier and says so', () => {
    const s = lucky();
    const { chance, mult } = critParams(s.upgrades);
    const hit = click(s, 0, () => chance / 2); // inside the window
    expect(hit.crit).toBe(true);
    expect(hit.earned).toBeCloseTo(mult, 10);
    expect(s.dumplings).toBeCloseTo(mult, 10);
  });

  test('a losing roll pays the ordinary amount', () => {
    const s = lucky();
    const hit = click(s, 0, () => 0.99);
    expect(hit.crit).toBe(false);
    expect(hit.earned).toBe(1);
  });

  test('a crit still counts as exactly one squish', () => {
    const s = lucky();
    click(s, 0, () => 0);
    expect(s.stats.totalClicks).toBe(1);
  });

  test('a crit during a frenzy stacks with it — both are live-tap bonuses', () => {
    const s = lucky();
    startFrenzy(s, 0);
    const { mult } = critParams(s.upgrades);
    expect(click(s, 10, () => 0).earned).toBeCloseTo(mult * FRENZY_MULTIPLIER, 10);
  });

  test('the rebirth gate sees the crit too', () => {
    const s = lucky();
    const { mult } = critParams(s.upgrades);
    click(s, 0, () => 0);
    expect(s.runEarned).toBeCloseTo(mult, 10);
  });
});

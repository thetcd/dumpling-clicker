import { describe, expect, test } from 'vitest';
import { upgradeGainLabel } from '../src/ui/shop';
import { UPGRADES } from '../src/game/config/upgrades';
import { createInitialState } from '../src/game/state';

const byId = (id: string) => UPGRADES.find((u) => u.id === id)!;

describe('upgradeGainLabel', () => {
  test('a flat multiplier reads as the multiplier, not an outcome', () => {
    // "click: 2 -> 4" reads as "your click BECOMES 4", so two x2 upgrades on the
    // shelf both promised 4 at different prices and looked like the same
    // upgrade duplicated. They are sequential doublings; say so.
    const s = createInitialState(0);
    s.upgrades = ['fast-fingers'];
    const label = upgradeGainLabel(byId('silk-gloves'), s);
    expect(label).toContain('2');
    expect(label).not.toContain('←');
  });

  test('two different flat upgrades of the same size read identically — that is honest', () => {
    const s = createInitialState(0);
    s.upgrades = ['fast-fingers'];
    // both double; the NAME and price are what distinguish them, and neither
    // claims an absolute result the other contradicts
    expect(upgradeGainLabel(byId('silk-gloves'), s)).toBe(
      upgradeGainLabel(byId('warm-hands'), s),
    );
  });

  test('a share upgrade still shows before and after — nobody can do that sum', () => {
    const s = createInitialState(0);
    s.producers = { stall: 1_000 };
    const label = upgradeGainLabel(byId('grandma-hands'), s);
    expect(label).toContain('←');
  });

  test('a crit upgrade describes the roll instead of claiming no change', () => {
    // crit lives outside clickValue by design, so the before/after preview
    // rendered "49 -> 49" — an upgrade that appears to do nothing
    const s = createInitialState(0);
    s.producers = { stall: 1_000 };
    const label = upgradeGainLabel(byId('lucky-hands'), s);
    expect(label).not.toContain('←');
    expect(label).toContain('%');
    expect(label).toContain('7');
  });

  test('the crit upgrade that only raises the payout says so', () => {
    const s = createInitialState(0);
    s.upgrades = ['lucky-hands'];
    const label = upgradeGainLabel(byId('jackpot-squish'), s);
    expect(label).toContain('12');
  });

  test('every shipped upgrade produces a label with no undefined or NaN', () => {
    const s = createInitialState(0);
    s.producers = { stall: 500 };
    for (const u of UPGRADES) {
      const label = upgradeGainLabel(u, s);
      expect(label, u.id).toBeTruthy();
      expect(label, u.id).not.toContain('undefined');
      expect(label, u.id).not.toContain('NaN');
    }
  });
});

describe('crit label edge case', () => {
  test('a payout-only crit upgrade never advertises x0', () => {
    // critParams reports "no crit at all" until a CHANCE upgrade is owned,
    // which is right for the economy and rendered "מעיכה מושלמת ×0" in the shop
    const s = createInitialState(0);
    const label = upgradeGainLabel(byId('jackpot-squish'), s);
    expect(label).not.toContain('0');
    expect(label).toContain('12');
  });
});

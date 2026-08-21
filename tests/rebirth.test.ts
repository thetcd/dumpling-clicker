import { describe, expect, test } from 'vitest';
import { STR } from '../src/i18n/strings.he';
import { isFrenzyActive } from '../src/game/golden';
import { UPGRADES } from '../src/game/config/upgrades';
import { roundToDisplay } from '../src/game/quantize';
import {
  canRebirth,
  rebirthMultiplier,
  rebirthProgress,
  rebirthKeepSummary,
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
    // rounded to the figure the rebirth bar prints — see game/quantize.ts
    expect(rebirthRequirement(1)).toBe(roundToDisplay(REBIRTH_BASE * REBIRTH_GROWTH));
    expect(rebirthRequirement(3)).toBe(roundToDisplay(REBIRTH_BASE * REBIRTH_GROWTH ** 3));
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
    s.dumplings = 9999;
    const after = rebirth(s, 0);
    expect(after.prestige).toBe(1);
    expect(after.dumplings).toBe(0);
    expect(after.runEarned).toBe(0);
  });

  // THE KEEP RULE, in one place. Dor reported the kept amounts as
  // "not consistent" and asked for a rule he could state, so this describes it
  // exactly: a quarter of every producer, ROUNDED, plus the flat click
  // upgrades permanently.
  test('you keep a quarter of every producer, rounded', () => {
    // Rounded, not floored. Under floor, owning 3 kept nothing while owning 4
    // kept one, so two runs that looked the same kept wildly different amounts
    // and small tiers silently vanished.
    const s = at(0, REBIRTH_BASE);
    s.producers = { apprentice: 40, stall: 8, factory: 3, army: 2 };
    const after = rebirth(s, 0);
    expect(after.producers.apprentice).toBe(10);
    expect(after.producers.stall).toBe(2);
    expect(after.producers.factory).toBe(1); // round(0.75) — floor kept nothing
    expect(after.producers.army).toBe(1); // round(0.5)
  });

  test('a single unit of something is not kept, and leaves no zero behind', () => {
    const s = at(0, REBIRTH_BASE);
    s.producers = { boss: 1 };
    const after = rebirth(s, 0);
    // round(0.25) is 0, and a 0 count would render a "you own 0" row and feed
    // dpsOf a dead entry — so the key is dropped, never stored as zero
    expect(after.producers.boss).toBeUndefined();
    expect('boss' in after.producers).toBe(false);
  });

  test('the flat click upgrades are kept forever', () => {
    // Dor at rebirth 18 was re-buying the same five cheap upgrades every run
    // before the ladder even started, which is grind, not progression. The flat
    // tier is now permanent; `keepOnRebirth` says so in the data.
    const s = at(0, REBIRTH_BASE);
    s.upgrades = ['fast-fingers', 'warm-hands', 'silk-gloves', 'two-thumbs', 'secret-technique'];
    expect(rebirth(s, 0).upgrades).toEqual(s.upgrades);
  });

  test('the share and crit upgrades are re-climbed every run', () => {
    // these are the ladder the run is FOR — keeping them makes it one-and-done
    const s = at(0, REBIRTH_BASE);
    s.upgrades = ['fast-fingers', 'team-spirit', 'quantum-squish', 'lucky-hands'];
    expect(rebirth(s, 0).upgrades).toEqual(['fast-fingers']);
  });

  test('every upgrade is either kept or re-climbed, never unclassified', () => {
    // a new upgrade added without deciding which side it is on would silently
    // land in the re-climbed pile
    for (const def of UPGRADES) {
      const permanent = def.keepOnRebirth === true;
      const laddered = Boolean(def.shareMultiplier || def.critChance || def.critMult);
      expect(permanent).toBe(!laddered);
    }
  });

  test('an active golden frenzy survives a rebirth', () => {
    // Dor: "if there is a rebirth and a golden dumpling is active, don't stop
    // it". The frenzy is wall-clock and belongs to the player, not the run —
    // it is the one counter that carries across.
    const s = at(0, REBIRTH_BASE);
    s.frenzyUntil = 60_000;
    expect(rebirth(s, 50_000).frenzyUntil).toBe(60_000);
  });

  test('an expired frenzy is not resurrected by a rebirth', () => {
    const s = at(0, REBIRTH_BASE);
    s.frenzyUntil = 10_000;
    const after = rebirth(s, 50_000);
    expect(isFrenzyActive(after.frenzyUntil, 50_000)).toBe(false);
  });

  test('what you keep compounds across rebirths without ever reaching zero-sum', () => {
    let s = at(0, REBIRTH_BASE);
    s.producers = { stall: 100 };
    s = rebirth(s, 0);
    expect(s.producers.stall).toBe(25);
    s.runEarned = rebirthRequirement(s.prestige);
    s = rebirth(s, 0);
    expect(s.producers.stall).toBe(6); // round(25 * 0.25)
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

describe('rebirthKeepSummary', () => {
  /**
   * Dor, 2026-08-21: "the saved items in each rebirth are not consistent, tell
   * me the rules and lets make it consistent."
   *
   * Half of consistency is the rule (round, not floor — see the keep tests
   * above); the other half is the player being able to SEE it before they
   * commit. The confirm modal reads this, and it agrees with rebirth() by
   * construction: both are asked, nothing is described twice.
   */
  test('counts the units and the tiers that survive', () => {
    const s = at(0, REBIRTH_BASE);
    s.producers = { apprentice: 40, stall: 8, factory: 3 };
    const kept = rebirthKeepSummary(s);
    expect(kept.units).toBe(13); // 10 + 2 + 1
    expect(kept.tiers).toBe(3);
  });

  test('a tier that rounds away is not counted', () => {
    const s = at(0, REBIRTH_BASE);
    s.producers = { boss: 1, stall: 8 };
    const kept = rebirthKeepSummary(s);
    expect(kept.units).toBe(2);
    expect(kept.tiers).toBe(1);
  });

  test('counts the permanent upgrades', () => {
    const s = at(0, REBIRTH_BASE);
    s.upgrades = ['fast-fingers', 'warm-hands', 'team-spirit', 'lucky-hands'];
    expect(rebirthKeepSummary(s).upgrades).toBe(2);
  });

  test('agrees with what rebirth() actually does', () => {
    // the two must never drift: a modal that promises more than the reset
    // delivers is worse than no modal at all
    const s = at(0, REBIRTH_BASE);
    s.producers = { apprentice: 40, stall: 8, factory: 3, boss: 1 };
    s.upgrades = ['fast-fingers', 'secret-technique', 'quantum-squish'];
    const kept = rebirthKeepSummary(s);
    const after = rebirth(s, 0);
    expect(Object.keys(after.producers).length).toBe(kept.tiers);
    expect(Object.values(after.producers).reduce((a, b) => a + b, 0)).toBe(kept.units);
    expect(after.upgrades.length).toBe(kept.upgrades);
  });

  test('a fresh run keeps nothing and says so', () => {
    const kept = rebirthKeepSummary(createInitialState(0));
    expect(kept).toEqual({ units: 0, tiers: 0, upgrades: 0 });
  });
});

describe('the keep-list copy', () => {
  // Hebrew does not take a numeral for one: "ב־1 מקומות" is wrong the way
  // "in 1 places" is wrong, and this line is the one place the game explains
  // its own rules — it cannot read as machine output.
  test('reads naturally for a single place and a single squishy', () => {
    expect(STR.rebirthKeepProducers(1, 1)).toBe('רביע מהצוות — סקווישי אחד במקום אחד');
  });

  test('takes the numeral for more than one', () => {
    expect(STR.rebirthKeepProducers(10, 3)).toBe('רביע מהצוות — 10 סקווישים ב־3 מקומות');
  });

  test('handles a single permanent upgrade', () => {
    expect(STR.rebirthKeepUpgrades(1)).toBe('שדרוג מעיכה קבוע אחד');
    expect(STR.rebirthKeepUpgrades(4)).toBe('4 שדרוגי מעיכה קבועים');
  });
});

import { describe, expect, test } from 'vitest';
import { STR } from '../src/i18n/strings.he';
import { isFrenzyActive } from '../src/game/golden';
import { UPGRADES } from '../src/game/config/upgrades';
import { roundToDisplay } from '../src/game/quantize';
import {
  canRebirth,
  isRebirthMaxed,
  rebirthMultiplier,
  rebirthProgress,
  rebirthKeepSummary,
  rebirthRequirement,
  upgradesPermanentAt,
} from '../src/game/rebirth';
import { rebirth } from '../src/game/actions';
import { clickValue, dpsOf } from '../src/game/economy';
import { createInitialState } from '../src/game/state';
import {
  REBIRTH_BASE,
  REBIRTH_GROWTH,
  REBIRTH_MAX,
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

  test('keeps growing right up to the cap', () => {
    expect(rebirthMultiplier(REBIRTH_MAX)).toBeGreaterThan(rebirthMultiplier(REBIRTH_MAX - 1));
  });

  test('stops at the cap — a tampered save cannot buy a bigger bonus', () => {
    // the ladder is capped, so the scalar has to be too, or editing localStorage
    // to rank 999 hands out a multiplier the game can never legitimately give
    expect(rebirthMultiplier(REBIRTH_MAX + 50)).toBe(rebirthMultiplier(REBIRTH_MAX));
    expect(rebirthMultiplier(100_000)).toBe(rebirthMultiplier(REBIRTH_MAX));
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

  // THE KEEP RULE, in one place. Dor's rule (2026-08-22): one survivor per
  // every 4 owned — 1-4 keeps 1, 5-8 keeps 2, 9-12 keeps 3 — all the way up,
  // capped at 10 per tier. Plus the flat click upgrades permanently.
  test('one survivor per every 4 owned: 1-4 keeps 1, 5-8 keeps 2, 9-12 keeps 3', () => {
    const s = at(0, REBIRTH_BASE);
    s.producers = { apprentice: 4, stall: 5, factory: 8, army: 9, school: 12, boss: 13 };
    const after = rebirth(s, 0);
    expect(after.producers.apprentice).toBe(1);
    expect(after.producers.stall).toBe(2);
    expect(after.producers.factory).toBe(2);
    expect(after.producers.army).toBe(3);
    expect(after.producers.school).toBe(3);
    expect(after.producers.boss).toBe(4);
  });

  test('even a single unit survives — no tier ever silently vanishes', () => {
    // Dor hit this: 1 kindergarten kept nothing under the old rounded-quarter
    // rule and read as a bug. Under "1-4 keeps 1" owning anything keeps one.
    const s = at(0, REBIRTH_BASE);
    s.producers = { boss: 1 };
    const after = rebirth(s, 0);
    expect(after.producers.boss).toBe(1);
  });

  test('the keep is capped at 10 per tier, however many you own', () => {
    const s = at(0, REBIRTH_BASE);
    s.producers = { apprentice: 37, stall: 40, factory: 400 };
    const after = rebirth(s, 0);
    expect(after.producers.apprentice).toBe(10); // ceil(37/4) = 10, first count to hit the cap
    expect(after.producers.stall).toBe(10);
    expect(after.producers.factory).toBe(10);
  });

  /**
   * PER-UPGRADE PERMANENCE. Each click upgrade names the rank from which it is
   * yours forever, instead of a hardcoded "the five cheapest are permanent".
   *
   * The rule: an upgrade goes permanent at the rank where its price has stopped
   * being a meaningful share of the run. That is Antimatter Dimensions' Eternity
   * Milestone mechanism — permanence removes what has become overhead, never
   * what is still a decision — wearing the clothes of a Roblox rebirth shop,
   * which is the grammar these players already read.
   */
  test('the flat tier is permanent from the very start', () => {
    const s = at(0, REBIRTH_BASE);
    s.upgrades = ['fast-fingers', 'warm-hands', 'silk-gloves', 'two-thumbs', 'secret-technique'];
    expect(rebirth(s, 0).upgrades).toEqual(s.upgrades);
  });

  test('a share upgrade is re-bought below its rank and kept from it onward', () => {
    // team-spirit is permanent from rank 10, so rebirthing INTO 10 keeps it
    const below = at(7, REBIRTH_BASE * 999);
    below.upgrades = ['fast-fingers', 'team-spirit'];
    expect(rebirth(below, 0).upgrades).toEqual(['fast-fingers']);

    const at10 = at(9, REBIRTH_BASE * 999);
    at10.upgrades = ['fast-fingers', 'team-spirit'];
    expect(rebirth(at10, 0).upgrades).toEqual(['fast-fingers', 'team-spirit']);
  });

  test('permanence is earned, never granted — an unbought upgrade stays unbought', () => {
    // auto-granting at the threshold would skip content and break "I earned it"
    const s = at(40, REBIRTH_BASE * 999);
    s.upgrades = ['fast-fingers'];
    expect(rebirth(s, 0).upgrades).toEqual(['fast-fingers']);
  });

  test('by the last permanence rank every upgrade owned is permanent', () => {
    const s = at(40, REBIRTH_BASE * 999);
    s.upgrades = UPGRADES.map((u) => u.id);
    expect(rebirth(s, 0).upgrades).toEqual(s.upgrades);
  });

  test('every upgrade names a permanence rank, and the ladder only rises with cost', () => {
    // a rank per upgrade rather than a boolean, so inserting an upgrade
    // mid-ladder can never silently strip permanence from the ones above it
    const byCost = [...UPGRADES].sort((a, b) => a.cost - b.cost);
    let previous = -1;
    for (const def of byCost) {
      expect(typeof def.permanentFromRank, `${def.id}`).toBe('number');
      expect(def.permanentFromRank, `${def.id} regresses`).toBeGreaterThanOrEqual(previous);
      previous = def.permanentFromRank;
    }
  });

  test('nothing becomes permanent after the cap, or it never becomes permanent', () => {
    for (const def of UPGRADES) {
      expect(def.permanentFromRank, `${def.id}`).toBeLessThanOrEqual(REBIRTH_MAX);
    }
  });

  test('the table agrees with the curve that generated it', () => {
    // P(u) = ceil(log1.5(cost / (k * REBIRTH_BASE))) with k = 0.5 — permanent
    // once the price is under half a run's requirement. The table is the
    // content and the formula is its rationale, so they may differ by the one
    // rank a hand review is allowed to move; more than that means the table
    // drifted away from any stated reason.
    for (const def of UPGRADES) {
      if (def.permanentFromRank === 0) continue;
      const generated = Math.ceil(
        Math.log(def.cost / (0.5 * REBIRTH_BASE)) / Math.log(REBIRTH_GROWTH),
      );
      expect(Math.abs(def.permanentFromRank - generated), `${def.id}`).toBeLessThanOrEqual(1);
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
    expect(s.producers.stall).toBe(10); // capped
    s.runEarned = rebirthRequirement(s.prestige);
    s = rebirth(s, 0);
    expect(s.producers.stall).toBe(3); // ceil(10 / 4)
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
    expect(kept.units).toBe(13); // 10 (capped) + 2 + 1
    expect(kept.tiers).toBe(3);
  });

  test('every owned tier is counted — a single unit no longer rounds away', () => {
    const s = at(0, REBIRTH_BASE);
    s.producers = { boss: 1, stall: 8 };
    const kept = rebirthKeepSummary(s);
    expect(kept.units).toBe(3); // 1 + 2
    expect(kept.tiers).toBe(2);
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
    expect(STR.rebirthKeepProducers(1, 1)).toBe('אחד מכל 4 בצוות: סקווישי אחד במקום אחד');
  });

  test('takes the numeral for more than one', () => {
    expect(STR.rebirthKeepProducers(10, 3)).toBe('אחד מכל 4 בצוות: 10 סקווישים ב־3 מקומות');
  });

  test('handles a single permanent upgrade', () => {
    expect(STR.rebirthKeepUpgrades(1)).toBe('שדרוג מעיכה קבוע אחד');
    expect(STR.rebirthKeepUpgrades(4)).toBe('4 שדרוגי מעיכה קבועים');
  });
});


describe('the rebirth cap', () => {
  /**
   * Dor, 2026-08-22: "we need to limit the rebirth amounts, like they do in some
   * roblox games." The cap is the content boundary — a release raises it, which
   * is what makes the weekly-update model work. It also deletes the worst-paced
   * stretch of the game: rank 60 measured at 33.8h and rank 70 at 308h, and
   * neither is reachable any more.
   */
  test('is a real number, not unbounded', () => {
    expect(Number.isFinite(REBIRTH_MAX)).toBe(true);
    expect(REBIRTH_MAX).toBe(50);
  });

  test('the cap sits above the last designer part, so nothing is stranded', () => {
    // every part unlocks by rank 40; a cap below that would make some
    // permanently unreachable
    expect(REBIRTH_MAX).toBeGreaterThanOrEqual(40);
  });

  test('isRebirthMaxed is false below the cap and true at or above it', () => {
    expect(isRebirthMaxed(REBIRTH_MAX - 1)).toBe(false);
    expect(isRebirthMaxed(REBIRTH_MAX)).toBe(true);
    expect(isRebirthMaxed(REBIRTH_MAX + 10)).toBe(true);
  });

  test('junk prestige is not treated as maxed', () => {
    expect(isRebirthMaxed(Number.NaN)).toBe(false);
    expect(isRebirthMaxed(-5)).toBe(false);
  });

  test('the bar reads full at the cap, however little the run has earned', () => {
    // a full bar with no button is the "MAX" state — the same shape Roblox uses
    const s = at(REBIRTH_MAX, 0);
    expect(rebirthProgress(s)).toBe(1);
  });

  test('you cannot rebirth at the cap, however much you earn', () => {
    expect(canRebirth(at(REBIRTH_MAX, Number.MAX_SAFE_INTEGER))).toBe(false);
    // ...but the rank right below it still works
    expect(canRebirth(at(REBIRTH_MAX - 1, Number.MAX_SAFE_INTEGER))).toBe(true);
  });

  test('the rebirth action refuses at the cap and leaves the run untouched', () => {
    const s = at(REBIRTH_MAX, Number.MAX_SAFE_INTEGER);
    s.producers = { stall: 40 };
    s.dumplings = 12_345;
    const after = rebirth(s, 0);
    expect(after.prestige).toBe(REBIRTH_MAX);
    expect(after.producers).toEqual({ stall: 40 });
    expect(after.dumplings).toBe(12_345);
  });

  test('the last legitimate rebirth lands exactly on the cap', () => {
    const s = at(REBIRTH_MAX - 1, Number.MAX_SAFE_INTEGER);
    expect(rebirth(s, 0).prestige).toBe(REBIRTH_MAX);
  });
});

describe('upgradesPermanentAt', () => {
  test('names only the upgrades whose rank is exactly this one', () => {
    // team-spirit is permanent from 10, grandma-hands from 13
    expect(upgradesPermanentAt(['team-spirit', 'grandma-hands'], 10)).toEqual(['team-spirit']);
    expect(upgradesPermanentAt(['team-spirit', 'grandma-hands'], 13)).toEqual(['grandma-hands']);
  });

  test('says nothing on a rank that grants nothing', () => {
    expect(upgradesPermanentAt(['team-spirit', 'grandma-hands'], 11)).toEqual([]);
  });

  test('an upgrade never bought is never announced', () => {
    expect(upgradesPermanentAt([], 10)).toEqual([]);
  });

  test('the always-permanent flat tier is never announced as news', () => {
    expect(upgradesPermanentAt(['fast-fingers'], 0)).toEqual([]);
    expect(upgradesPermanentAt(['fast-fingers'], 10)).toEqual([]);
  });

  test('every non-flat upgrade gets exactly one announcement across a playthrough', () => {
    const owned = UPGRADES.map((u) => u.id);
    const announced = new Set<string>();
    for (let rank = 1; rank <= REBIRTH_MAX; rank++) {
      for (const id of upgradesPermanentAt(owned, rank)) {
        expect(announced.has(id), `${id} announced twice`).toBe(false);
        announced.add(id);
      }
    }
    const expected = UPGRADES.filter((u) => u.permanentFromRank > 0).map((u) => u.id);
    expect([...announced].sort()).toEqual(expected.sort());
  });
});

import { describe, expect, test } from 'vitest';
import { roundToDisplay } from '../src/game/quantize';
import {
  isUpgradeRevealed,
  clickValue,
  clickValueWith,
  costOf,
  critEV,
  critParams,
  dpsOf,
  incomeMultiplier,
  producerDps,
} from '../src/game/economy';
import { createInitialState } from '../src/game/state';
import { PRODUCERS } from '../src/game/config/producers';
import { UPGRADES } from '../src/game/config/upgrades';
import {
  BASE_DPS,
  CLICK_DPS_SHARE,
  FRENZY_MULTIPLIER,
} from '../src/game/config/balance';

const apprentice = PRODUCERS[0]; // baseCost 15

describe('costOf', () => {
  test('first unit costs baseCost', () => {
    expect(costOf(apprentice, 0)).toBe(15);
  });

  // Costs are rounded to the figure the shop prints (game/quantize.ts), so the
  // curve is followed to display precision rather than to the last float digit.
  test('nth unit follows 1.15^owned growth', () => {
    expect(costOf(apprentice, 1)).toBe(roundToDisplay(15 * 1.15));
    expect(costOf(apprentice, 10)).toBe(roundToDisplay(15 * 1.15 ** 10));
    // still within a rounding step of the true curve
    expect(costOf(apprentice, 10) / (15 * 1.15 ** 10)).toBeCloseTo(1, 1);
  });

  test('bulk buy of 10 equals the sum of the next 10 unit costs', () => {
    let sum = 0;
    for (let i = 3; i < 13; i++) sum += 15 * 1.15 ** i;
    expect(costOf(apprentice, 3, 10)).toBe(roundToDisplay(sum));
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
    // grandma-hands is share x2 AND flat x2 — the flat part is the floor that
    // stops it being a dud with no producers owned (see upgrades.ts)
    const after = clickValueWith(s, 'grandma-hands');
    expect(after).toBeCloseTo(2 + CLICK_DPS_SHARE * 2 * 1_000, 10);
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

  test('share-scaling upgrades multiply the production share as well as the base', () => {
    const s = createInitialState(0);
    s.producers = { stall: 1_000 }; // 1000 dps
    s.upgrades = ['grandma-hands']; // shareMultiplier 2, multiplier 2
    expect(clickValue(s)).toBeCloseTo(2 + CLICK_DPS_SHARE * 2 * 1_000, 10);
  });

  test('share-scaling upgrades stack multiplicatively with each other', () => {
    const s = createInitialState(0);
    s.producers = { stall: 1_000 };
    s.upgrades = ['grandma-hands', 'quantum-squish']; // share x2 * x2.5, flat x2 * x2
    expect(clickValue(s)).toBeCloseTo(4 + CLICK_DPS_SHARE * 5 * 1_000, 10);
  });

  test('flat multipliers and share multipliers apply to their own term', () => {
    const s = createInitialState(0);
    s.producers = { stall: 1_000 };
    // fast-fingers is flat x2; grandma-hands is flat x2 AND share x2
    s.upgrades = ['fast-fingers', 'grandma-hands'];
    expect(clickValue(s)).toBeCloseTo(4 + CLICK_DPS_SHARE * 2 * 1_000, 10);
  });

  test('with no producers the production share contributes nothing', () => {
    const s = createInitialState(0);
    s.upgrades = ['grandma-hands', 'quantum-squish'];
    // ...but their flat floor still does, which is the whole point of it: this
    // is the state that used to render "384 <- 384" on the shop chip
    expect(clickValue(s)).toBe(4);
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

// offlineEarnings' tests used to live here. Removed 2026-08-21 along with the
// function: nothing in the game pays for time away, so there is no away-time
// rate to test. The replacement guard is tests/loop.test.ts, which pins that a
// frame gap longer than one tick earns exactly nothing.

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

describe('critical squishes', () => {
  const withUpgrades = (...ids: string[]) => {
    const s = createInitialState(0);
    s.upgrades = ids;
    return s;
  };

  test('no crit upgrades means no crit at all', () => {
    const p = critParams([]);
    expect(p.chance).toBe(0);
    expect(critEV([])).toBe(1);
  });

  test('a crit upgrade sets the chance and the multiplier', () => {
    const p = critParams(['lucky-hands']);
    expect(p.chance).toBeGreaterThan(0);
    expect(p.mult).toBeGreaterThan(1);
  });

  test('later crit upgrades take the best of each, never multiply them', () => {
    // stacking would compound into a runaway; the ladder RAISES chance and mult
    const all = UPGRADES.filter((u) => u.critChance || u.critMult).map((u) => u.id);
    const p = critParams(all);
    const best = {
      chance: Math.max(...UPGRADES.map((u) => u.critChance ?? 0)),
      mult: Math.max(...UPGRADES.map((u) => u.critMult ?? 0)),
    };
    expect(p.chance).toBe(best.chance);
    expect(p.mult).toBe(best.mult);
  });

  test('expected value is chance-weighted, so the simulator can price it', () => {
    const p = critParams(['lucky-hands']);
    expect(critEV(['lucky-hands'])).toBeCloseTo(1 + p.chance * (p.mult - 1), 10);
  });

  test('crit never touches production, only taps', () => {
    const plain = createInitialState(0);
    const crit = withUpgrades('lucky-hands');
    plain.producers = { stall: 5 };
    crit.producers = { stall: 5 };
    expect(dpsOf(crit)).toBe(dpsOf(plain));
    // and the shop's before/after must not silently include a random roll
    expect(clickValue(crit)).toBe(clickValue(plain));
  });

  test('crit stays out of production entirely', () => {
    // a crit is a dice roll on a live tap, so it must not reach dpsOf — which
    // is what the shop, the click share-term and every rate readout use
    const crit = withUpgrades('lucky-hands');
    crit.producers = { stall: 5 };
    const plain = createInitialState(0);
    plain.producers = { stall: 5 };
    expect(dpsOf(crit)).toBe(dpsOf(plain));
  });
});

describe('the upgrade ladder', () => {
  test('every crit upgrade costs more than every share upgrade', () => {
    // crit is the endgame tier; a cheap crit would swamp early idle play
    const share = UPGRADES.filter((u) => u.shareMultiplier).map((u) => u.cost);
    const crit = UPGRADES.filter((u) => u.critChance || u.critMult).map((u) => u.cost);
    expect(Math.min(...crit)).toBeGreaterThan(Math.max(...share));
  });

  test('no upgrade above 15k relies on a flat multiplier ALONE', () => {
    // A flat multiplier is worth a fraction of just buying a building once
    // production is running, so above 15k it can only be a floor under a
    // share or crit effect — never the whole upgrade. That is what made
    // grandma-hands and quantum-squish traps when they were flat-only.
    for (const u of UPGRADES.filter((x) => x.multiplier)) {
      if (u.cost <= 15_000) continue;
      expect(
        Boolean(u.shareMultiplier || u.critChance || u.critMult),
        `${u.id} is a flat multiplier priced too high with nothing else on it`,
      ).toBe(true);
    }
  });

  test('the ladder hands out something roughly every step of the cost curve', () => {
    const costs = UPGRADES.map((u) => u.cost).sort((a, b) => a - b);
    for (let i = 1; i < costs.length; i++) {
      // no gap wider than 10x, or the shop goes quiet for hours
      expect(costs[i] / costs[i - 1], `gap above ${costs[i - 1]}`).toBeLessThanOrEqual(10);
    }
  });

  test('each upgrade carries exactly one HEADLINE effect', () => {
    // A share upgrade may also carry a flat multiplier as its floor, but
    // nothing may be both a share upgrade and a crit upgrade — the shop chip
    // can only phrase one headline, and the two ladders are priced apart.
    for (const u of UPGRADES) {
      const headline = [u.shareMultiplier, u.critChance ?? u.critMult].filter(Boolean);
      expect(headline.length, `${u.id} mixes headline effect types`).toBeLessThanOrEqual(1);
      expect(
        Boolean(u.multiplier || headline.length),
        `${u.id} has no effect at all`,
      ).toBe(true);
    }
  });
});

describe('every click upgrade is worth buying', () => {
  // The root of Dor's "384 -> 384": a shareMultiplier upgrade is worth
  // `share * producerDps`, so with no producers owned it buys literally
  // nothing. That is not a display bug, it is a dud on the shelf — and the
  // shelf sells one upgrade at a time in cost order, so the player cannot
  // route around it.
  //
  // Measured against the production a player could plausibly have WHEN THE
  // SHOP OFFERS IT, which is the only state that matters: from nothing (just
  // rebirthed, producers reset) up to a minute's worth of the price. The
  // reverse case — a 100-dumpling flat upgrade against 100k dps — is not a
  // real state, and it is why the share tier exists at all.
  test('raises the value of a tap at every production level it can be offered at', () => {
    for (const prestige of [0, 9, 18]) {
      for (const def of UPGRADES) {
        // 0 = a fresh run right after a rebirth; cost/60 = a minute of
        // production banks the price
        for (const dps of [0, def.cost / 600, def.cost / 60]) {
          const s = createInitialState(0);
          s.prestige = prestige;
          // stall is 1 dps per unit, so the count IS the dps
          if (dps >= 1) s.producers = { stall: Math.round(dps) };
          s.upgrades = UPGRADES.filter((u) => u.cost < def.cost).map((u) => u.id);
          // crit upgrades live outside clickValue on purpose — they raise the
          // expected value of a tap, not its face value
          const gain =
            def.critChance || def.critMult
              ? critEV([...s.upgrades, def.id]) / critEV(s.upgrades)
              : clickValueWith(s, def.id) / clickValue(s);
          expect(
            gain,
            `${def.id} at prestige ${prestige}, ${Math.round(dps)} dps`,
          ).toBeGreaterThanOrEqual(1.2);
        }
      }
    }
  });
});

describe('tapping is worth doing mid-run', () => {
  /**
   * Dor, 2026-08-21, at rebirth 18: "I got 1.2k per click and 23k passively —
   * it makes it not worth it to click".
   *
   * That state reproduced: prestige 18, ~1,950 raw production, and the two
   * share upgrades a player has actually bought by that point (team-spirit and
   * grandma-hands — assembly-line at 800k and quantum-squish at 5M are still
   * ahead of them). The full share table only exists at the very end of a run,
   * so pinning the balance to the endgame measured a state nobody is in.
   */
  const dorsState = (dps = 1_950) => {
    const s = createInitialState(0);
    s.prestige = 18;
    s.producers = { stall: dps };
    s.upgrades = [
      'fast-fingers',
      'warm-hands',
      'silk-gloves',
      'two-thumbs',
      'secret-technique',
      'team-spirit',
      'grandma-hands',
    ];
    return s;
  };

  // AT EVERY SCALE, which is the load-bearing half. A flat multiplier can lift
  // the ratio at one production level and then decay to nothing as the run
  // grows — only the `share * producerDps` term holds a ratio steady, which is
  // why CLICK_DPS_SHARE and not the flat ladder is the knob for this.
  const scales = [1_950, 19_500, 195_000, 1_950_000];

  test('five taps a second is worth at least half of idle income', () => {
    for (const dps of scales) {
      const s = dorsState(dps);
      expect((clickValue(s) * 5) / dpsOf(s), `at ${dps} dps`).toBeGreaterThanOrEqual(0.5);
    }
  });

  test('two taps a second is still a fifth of idle income', () => {
    // the casual rate the rebirth curve is measured at
    for (const dps of scales) {
      const s = dorsState(dps);
      expect((clickValue(s) * 2) / dpsOf(s), `at ${dps} dps`).toBeGreaterThanOrEqual(0.2);
    }
  });
});

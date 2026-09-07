// Does the HYBRID release cadence actually stay playable?
//
// Dor's cadence (2026-09-07): a small rank batch every week (+5 or +10), a
// full WORLD every two weeks carrying ~1-2 new ~6x income rungs. The open
// question this tool answers is the weekly batch SIZE — +5 needs one rung per
// world, +10 needs two, and both have to keep every weekly batch under what a
// kid actually plays.
//
//   node tools/release-policy.mjs [tapsPerSecond]
//
// HISTORY: this tool used to take `shipped|repriced` and compare four
// policies (A-D, table in docs/PROGRESS.md §6) because the boss reprice and
// the flattened curve were unbuilt and the cadence DEPENDED on them. Both
// SHIPPED 2026-09-07 (boss 1B gated rank 50; REBIRTH_GROWTH_PAST_CAP 1.2 past
// the pinned pivot 50), so the shipped config is what was called "repriced +
// flattened" and the flag is gone — the tool now reads the real table and the
// real curve constants.
//
// It measures the PLAY COST of each weekly batch. Nothing here mutates the
// shipped config — invented future tiers live in a local table, so this is a
// what-if, not a change.
//
// A kid playing ~45 min/day gets through ~5h a week, which is the bar every
// weekly column has to clear.
import esbuild from '../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = async (rel) => {
  const out = await esbuild.build({
    entryPoints: [resolve(here, '..', rel)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64')
  );
};

const economy = await load('src/game/economy.ts');
const actions = await load('src/game/actions.ts');
const state0 = await load('src/game/state.ts');
const producers = await load('src/game/config/producers.ts');
const upgrades = await load('src/game/config/upgrades.ts');
const balance = await load('src/game/config/balance.ts');
const rewards = await load('src/game/rewards.ts');
const findableCfg = await load('src/game/config/findables.ts');

const TAPS = Number(process.argv[2] ?? 5);
const CURRENT_CAP = balance.REBIRTH_MAX;
const WEEKS = 8; // measured horizon: two months of releases
const MAX_SECONDS = 60 * 60 * 900;

const payoutLanes = findableCfg.LANES.flatMap((lane) =>
  lane.kinds
    .filter((k) => k.payoutSeconds)
    .map((k) => ({
      kind: k.id,
      perSecond:
        (1 / ((lane.minMs + lane.maxMs) / 2 / 1000)) *
        (k.weight / lane.kinds.reduce((s, o) => s + o.weight, 0)),
    })),
);

// The SHIPPED requirement curve: steep to the pinned pivot, flat past it.
const requirement = (n) =>
  n <= balance.REBIRTH_CURVE_PIVOT
    ? balance.REBIRTH_BASE * balance.REBIRTH_GROWTH ** n
    : balance.REBIRTH_BASE *
      balance.REBIRTH_GROWTH ** balance.REBIRTH_CURVE_PIVOT *
      balance.REBIRTH_GROWTH_PAST_CAP ** (n - balance.REBIRTH_CURVE_PIVOT);

function measure({ batchSize, rungsPerWorld, label }) {
  const BATCH = batchSize;
  const BATCHES = WEEKS;
  // A world lands every SECOND weekly batch and carries rungsPerWorld income
  // sources, each worth ~6x the tier below at ~15x the cost — the shipped
  // table's own ratio. Modelled as producers, but a rank-gated permanent
  // multiplier of the same size is mathematically identical for pacing, which
  // is what lets Gal stay the top of the shop at no cost. A world's rungs
  // gate at that world's NEW cap: they are the reward for finishing it.
  let table = producers.PRODUCERS.map((p) => ({ ...p, gate: p.unlockAtPrestige ?? 0 }));
  for (let w = 1; w * 2 <= WEEKS; w++) {
    // rungsPerWorld may be fractional: 1.5 = alternate 1-rung and 2-rung worlds
    const rungs = Math.floor(rungsPerWorld) + (rungsPerWorld % 1 > 0 && w % 2 === 0 ? 1 : 0);
    for (let k = 0; k < rungs; k++) {
      const last = table[table.length - 1];
      // a world's rungs SPREAD across its two weekly caps (latest last): a
      // 2-rung world hands one rung to each week, which is what keeps income
      // arriving every batch instead of every other
      const gate = CURRENT_CAP + (w * 2 - (rungs - 1 - k)) * BATCH;
      table = [
        ...table,
        {
          id: `world${w}rung${k}`,
          // PRICING IS THE WHOLE GAME HERE, measured three ways tonight:
          // x15-per-rung (the shipped table's ratio) outruns the 1.2 curve by
          // world three and late rungs are never bought; a %-of-requirement
          // price is never SAVED FOR (the shopper spends continuously and
          // holds no bank). What works: anchor the first rung at 15x the boss
          // — the shipped table's own step — then grow rung-to-rung by what
          // the requirement grows between rungs (1.2^ranks), so every rung
          // stays near the marginal unit cost of the board that meets it.
          baseCost:
            15 * 1e9 *
            balance.REBIRTH_GROWTH_PAST_CAP ** (gate - (CURRENT_CAP + BATCH)),
          baseDps: last.baseDps * 6,
          gate,
        },
      ];
    }
  }

  let seed = 999;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  // dpsOf() reads the SHIPPED producer table, so invented tiers are summed here
  const dpsOf = (s) => {
    let raw = balance.BASE_DPS;
    for (const [id, count] of Object.entries(s.producers)) {
      const def = table.find((t) => t.id === id);
      if (def) raw += def.baseDps * count;
    }
    return raw * multiplierAt(s.prestige);
  };
  const multiplierAt = (n) => {
    let total = 1;
    let counted = 0;
    for (const tier of balance.REBIRTH_BUFF_TIERS) {
      if (counted >= n) break;
      const upto = Number.isFinite(tier.through) ? Math.min(tier.through, n) : n;
      total += (upto - counted) * tier.buff;
      counted = upto;
    }
    return total;
  };

  const shop = (s) => {
    for (;;) {
      let best = null;
      for (const p of table) {
        if (p.gate > s.prestige) continue;
        const cost = economy.costOf(p, s.producers[p.id] ?? 0);
        if (cost > s.dumplings) continue;
        const value = p.baseDps / cost;
        if (!best || value > best.value) best = { kind: 'p', id: p.id, value, def: p };
      }
      for (const u of upgrades.UPGRADES) {
        if (s.upgrades.includes(u.id) || u.cost > s.dumplings) continue;
        if (s.stats.totalClicks < u.unlockAtClicks) continue;
        const withEV = economy.clickValueWith(s, u.id) * economy.critEV([...s.upgrades, u.id]);
        const nowEV = economy.clickValue(s) * economy.critEV(s.upgrades);
        const value = ((withEV - nowEV) * TAPS) / u.cost;
        if (!best || value > best.value) best = { kind: 'u', id: u.id, value };
      }
      if (!best) return;
      if (best.kind === 'p') {
        // buyProducer() prices off the shipped table, so charge by hand
        s.dumplings -= economy.costOf(best.def, s.producers[best.id] ?? 0);
        s.producers[best.id] = (s.producers[best.id] ?? 0) + 1;
      } else actions.buyUpgrade(s, best.id);
    }
  };

  let s = state0.createInitialState(0);
  const clock = { now: 0 };
  let elapsed = 0;
  const perRank = [];
  const lastRank = CURRENT_CAP + BATCH * WEEKS;

  while (s.prestige < lastRank && elapsed < MAX_SECONDS) {
    const need = requirement(s.prestige);
    const start = elapsed;
    while (s.runEarned < need && elapsed < MAX_SECONDS) {
      clock.now += 1000;
      // accrue by hand: dpsOf() above knows about the invented tiers
      const earned = dpsOf(s);
      s.dumplings += earned;
      s.totalEarned += earned;
      s.runEarned += earned;
      let found = 0;
      for (const lane of payoutLanes) {
        found += rewards.rewardFor(lane.kind, dpsOf(s), economy.clickValue(s)) * lane.perSecond;
      }
      s.dumplings += found;
      s.totalEarned += found;
      s.runEarned += found;
      for (let i = 0; i < TAPS; i++) actions.click(s, clock.now, rand);
      shop(s);
      elapsed += 1;
    }
    perRank[s.prestige + 1] = elapsed - start;
    // rebirth by hand — actions.rebirth() gates on the COMPILED cap, which is
    // exactly the thing being explored
    const next = state0.createInitialState(clock.now);
    Object.assign(next, {
      avatar: s.avatar,
      settings: s.settings,
      stats: s.stats,
      totalEarned: s.totalEarned,
      prestige: s.prestige + 1,
      runEarned: 0,
    });
    for (const [id, count] of Object.entries(s.producers)) {
      const keep =
        count >= 1 ? Math.min(balance.REBIRTH_KEEP_MAX, Math.ceil(count / balance.REBIRTH_KEEP_PER)) : 0;
      if (keep > 0) next.producers[id] = keep;
    }
    // Mirrors keptUpgrades(): each upgrade names the rank from which it is
  // permanent, measured against the rank being rebirthed INTO. Forgetting this
  // models a game nobody plays and every number printed below is wrong.
  next.upgrades = s.upgrades.filter(
    (id) => next.prestige >= (upgrades.UPGRADE_BY_ID[id]?.permanentFromRank ?? Infinity),
  );
    s = next;
  }

  const fmt = (x) => (x == null ? '—' : x < 5400 ? `${(x / 60).toFixed(0)}m` : `${(x / 3600).toFixed(1)}h`);
  const batchCost = (lo) => {
    let sum = 0;
    for (let r = lo; r < lo + BATCH; r++) {
      if (perRank[r] == null) return null;
      sum += perRank[r];
    }
    return sum;
  };
  const firstBatchStart = CURRENT_CAP + 1;
  const cells = Array.from({ length: BATCHES }, (_, i) =>
    fmt(batchCost(firstBatchStart + i * BATCH)).padStart(7),
  );
  console.log(`${label.padEnd(38)} ${cells.join(' ')}`);
}

console.log(
  `Play cost of each WEEKLY batch, at ${TAPS} taps/sec, shipped curve + boss. Cap today: ${CURRENT_CAP}.`,
);
console.log('Columns are weeks after launch; a world (with its rungs) lands every 2nd week.');
console.log('A kid at ~45 min/day plays ~5h a week — that is the bar.\n');
const week = (i) => `wk${i + 1}`.padStart(7);
console.log(`${''.padEnd(38)} ${Array.from({ length: WEEKS }, (_, i) => week(i)).join(' ')}`);
measure({ batchSize: 5, rungsPerWorld: 1, label: 'H5 · +5/week, 1 rung per world' });
measure({ batchSize: 5, rungsPerWorld: 1.5, label: 'H5+ · +5/week, alternating 1-2 rungs' });
measure({ batchSize: 5, rungsPerWorld: 2, label: 'H5++ · +5/week, 2 rungs per world' });
measure({ batchSize: 5, rungsPerWorld: 0, label: 'H5 control · +5/week, no rungs' });
measure({ batchSize: 10, rungsPerWorld: 2, label: 'H10 · +10/week, 2 rungs per world' });
measure({ batchSize: 10, rungsPerWorld: 0, label: 'H10 control · +10/week, no rungs' });

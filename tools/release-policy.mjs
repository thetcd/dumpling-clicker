// Does a weekly "+5 rebirth ranks" release cadence actually stay playable?
//
// This is the tool the top backlog item depends on. The plan is to raise
// REBIRTH_MAX by ~5 every release, but REBIRTH_GROWTH (1.5) was measured for a
// game that ENDS at 50, and each release multiplies the requirement by
// 1.5^5 ~= 7.6x. So the honest question is not "is the cadence nice" but "how
// many releases before a batch of 5 ranks costs more than anyone will play".
//
//   node tools/release-policy.mjs [tapsPerSecond] [boss]
//
// `boss` is `shipped` (default) or `repriced`. This matters more than it looks:
// the planned boss change (gated at rank 50, priced 1B instead of 75B) is what
// makes the post-cap producer ladder AFFORDABLE at all. Measured with the
// shipped 75B boss, a "new tier per release" costs 15x of 75B and up, which
// nobody ever reaches — so policy C does almost nothing and even D drifts. The
// release cadence therefore DEPENDS on the boss reprice landing first.
//
// It compares four policies by measuring the PLAY COST of each batch of five
// ranks. Nothing here mutates the shipped config — the requirement curve and the
// producer table are patched in memory, so this is a what-if, not a change.
//
// Measured 2026-08-22 at 5 taps/sec, `repriced` (see docs/PROGRESS.md):
//   A cap+5 only           2.3h  4.4h  68m  5.0h  26.6h  154.5h  702.8h  <- collapses
//   B + flatten curve      2.3h  4.4h  48m  81m    2.7h    5.5h   11.4h
//   C + income per release 2.3h  4.4h  68m  3.0h   6.9h   14.0h   27.6h
//   D both                 2.3h  4.4h  48m  57m    1.6h    2.3h    3.5h  <- sustainable
//
// ...and with the boss as SHIPPED, even D drifts to 26.7h by the last batch.
// That is the finding: the reprice is a PREREQUISITE for the cadence.
//
// A kid playing ~45 min/day gets through ~5h a week, which is the bar every
// column has to clear.
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
const BOSS = (process.argv[3] ?? 'shipped') === 'repriced';
const CURRENT_CAP = balance.REBIRTH_MAX;
const BATCH = 5;
const BATCHES = 7;
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

/**
 * The requirement curve, with an optional flatter tail past the current cap.
 * Flattening only past the cap keeps every shipped rank exactly as measured —
 * this changes the future, never the game people have already played.
 */
const requirement = (n, tailGrowth) =>
  n <= CURRENT_CAP
    ? balance.REBIRTH_BASE * balance.REBIRTH_GROWTH ** n
    : balance.REBIRTH_BASE * balance.REBIRTH_GROWTH ** CURRENT_CAP * tailGrowth ** (n - CURRENT_CAP);

function measure({ tailGrowth, incomePerRelease, label }) {
  // Each release optionally adds one income source worth ~6x the last tier at
  // ~15x the cost — the same ratio the shipped ten-tier table already uses. It
  // is deliberately modelled as a producer, but a rank-gated permanent
  // multiplier of the same size is mathematically identical for pacing, which is
  // what lets Gal stay the top of the shop at no cost.
  let table = producers.PRODUCERS.map((p) =>
    p.id === 'boss' && BOSS ? { ...p, baseCost: 1e9, gate: CURRENT_CAP } : { ...p, gate: 0 },
  );
  if (incomePerRelease) {
    for (let i = 1; i <= BATCHES; i++) {
      const last = table[table.length - 1];
      table = [
        ...table,
        {
          id: `release${i}`,
          baseCost: last.baseCost * 15,
          baseDps: last.baseDps * 6,
          gate: CURRENT_CAP + i * BATCH,
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
  const lastRank = CURRENT_CAP - BATCH * 2 + BATCH * BATCHES;

  while (s.prestige < lastRank && elapsed < MAX_SECONDS) {
    const need = requirement(s.prestige, tailGrowth);
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
  const firstBatchStart = CURRENT_CAP - BATCH * 2 + 1;
  const cells = Array.from({ length: BATCHES }, (_, i) =>
    fmt(batchCost(firstBatchStart + i * BATCH)).padStart(7),
  );
  console.log(`${label.padEnd(38)} ${cells.join(' ')}`);
}

const firstBatchStart = CURRENT_CAP - BATCH * 2 + 1;
const headers = Array.from({ length: BATCHES }, (_, i) => {
  const lo = firstBatchStart + i * BATCH;
  return `${lo}-${lo + BATCH - 1}`.padStart(7);
});
console.log(
  `Play cost of each batch of ${BATCH} ranks, at ${TAPS} taps/sec. Current cap ${CURRENT_CAP}.`,
);
console.log(
  BOSS
    ? 'Boss REPRICED (gate 50, 1B) — the planned config, not yet built.'
    : 'Boss as SHIPPED (75B, ungated). Pass `repriced` to model the planned change.',
);
console.log('A kid at ~45 min/day plays ~5h a week — that is the bar.\n');
console.log(`${''.padEnd(38)} ${headers.join(' ')}`);
measure({ tailGrowth: balance.REBIRTH_GROWTH, incomePerRelease: 0, label: 'A · cap +5 only' });
measure({ tailGrowth: 1.2, incomePerRelease: 0, label: 'B · + flatten curve past the cap' });
measure({ tailGrowth: balance.REBIRTH_GROWTH, incomePerRelease: 1, label: 'C · + ~6x income per release' });
measure({ tailGrowth: 1.2, incomePerRelease: 1, label: 'D · both' });

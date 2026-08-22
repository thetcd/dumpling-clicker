// When does the CONTENT run out, as opposed to the rebirth counter?
//
// simulate.mjs answers "how long does each rebirth take". This answers the
// different and more important question: when does the player stop being given
// anything new to see? Those two diverged badly — every cosmetic is spent hours
// before the last producer tier is affordable — and that gap is the game's
// biggest open design problem.
//
//   node tools/milestones.mjs [tapsPerSecond] [catchRate]
//
// Uses the SHIPPED constants, so it re-measures itself after any balance change.
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
const rebirthMod = await load('src/game/rebirth.ts');
const unlocks = await load('src/game/unlocks.ts');

const TAPS = Number(process.argv[2] ?? 5);
const CATCH = Number(process.argv[3] ?? 1);
const MAX_SECONDS = 60 * 60 * 400;

// findable income as an average rate — over the hours these runs cover, the mean
// is what moves the curve, and it keeps this a closed-form second-by-second loop
const payoutLanes = findableCfg.LANES.flatMap((lane) =>
  lane.kinds
    .filter((k) => k.payoutSeconds)
    .map((k) => ({
      kind: k.id,
      perSecond:
        (1 / ((lane.minMs + lane.maxMs) / 2 / 1000)) *
        (k.weight / lane.kinds.reduce((sum, other) => sum + other.weight, 0)),
    })),
);
const findableIncome = (state) => {
  if (CATCH <= 0) return 0;
  const dps = economy.dpsOf(state);
  const click = economy.clickValue(state);
  let total = 0;
  for (const lane of payoutLanes) total += rewards.rewardFor(lane.kind, dps, click) * lane.perSecond;
  return total * CATCH;
};

// seeded, so two runs of the same measurement agree
let seed = 12345;
const nextRandom = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

/** Greedy shopper, same valuation simulate.mjs uses (crit needs critEV). */
function shop(state) {
  for (;;) {
    let best = null;
    for (const p of producers.PRODUCERS) {
      const cost = economy.costOf(p, state.producers[p.id] ?? 0);
      if (cost > state.dumplings) continue;
      const value = p.baseDps / cost;
      if (!best || value > best.value) best = { kind: 'producer', id: p.id, value };
    }
    for (const u of upgrades.UPGRADES) {
      if (state.upgrades.includes(u.id) || u.cost > state.dumplings) continue;
      if (state.stats.totalClicks < u.unlockAtClicks) continue;
      const withEV =
        economy.clickValueWith(state, u.id) * economy.critEV([...state.upgrades, u.id]);
      const nowEV = economy.clickValue(state) * economy.critEV(state.upgrades);
      const value = ((withEV - nowEV) * TAPS) / u.cost;
      if (!best || value > best.value) best = { kind: 'upgrade', id: u.id, value };
    }
    if (!best) return;
    if (best.kind === 'producer') actions.buyProducer(state, best.id);
    else actions.buyUpgrade(state, best.id);
  }
}

// the rank at which the last designer part opens — derived, so extending the
// ladder in parts.ts moves this automatically
const lastPartRank = Math.max(
  ...Array.from({ length: balance.REBIRTH_MAX + 1 }, (_, n) =>
    unlocks.partsUnlockedAt(n).length > 0 ? n : 0,
  ),
);
const ALL_UPGRADES = upgrades.UPGRADES.length;

const seen = {};
const everBought = new Set();
let state = state0.createInitialState(0);
let elapsed = 0;
const clock = { now: 0 };

while (elapsed < MAX_SECONDS) {
  const need = rebirthMod.rebirthRequirement(state.prestige);
  const maxed = rebirthMod.isRebirthMaxed(state.prestige);
  while ((maxed || state.runEarned < need) && elapsed < MAX_SECONDS) {
    clock.now += 1000;
    actions.accrue(state, 1000, clock.now);
    actions.grant(state, findableIncome(state));
    for (let i = 0; i < TAPS; i++) actions.click(state, clock.now, nextRandom);
    shop(state);
    for (const id of state.upgrades) everBought.add(id);
    elapsed += 1;
    if (!seen.boss && (state.producers.boss ?? 0) > 0) seen.boss = elapsed;
    if (!seen.upgrades && everBought.size >= ALL_UPGRADES) seen.upgrades = elapsed;
    // at the cap there is nothing left to wait for — stop once the rest landed
    if (maxed && seen.boss && seen.upgrades) break;
  }
  if (maxed) break;
  state = actions.rebirth(state, clock.now);
  if (!seen.halfParts && state.prestige >= Math.round(lastPartRank / 2)) {
    seen.halfParts = elapsed;
  }
  if (!seen.allParts && state.prestige >= lastPartRank) seen.allParts = elapsed;
  if (!seen.maxRank && rebirthMod.isRebirthMaxed(state.prestige)) seen.maxRank = elapsed;
}

const fmt = (s) =>
  s == null
    ? 'not reached'
    : s < 90
      ? `${s}s`
      : s < 5400
        ? `${(s / 60).toFixed(1)}m`
        : `${(s / 3600).toFixed(1)}h`;

console.log(`${TAPS} taps/sec, catching ${CATCH * 100}% of findables, cap ${balance.REBIRTH_MAX}\n`);
const rows = [
  [`rank ${Math.round(lastPartRank / 2)} — half the cosmetics`, seen.halfParts],
  [`rank ${lastPartRank} — EVERY cosmetic unlocked`, seen.allParts],
  [`all ${ALL_UPGRADES} click upgrades bought`, seen.upgrades],
  ['first boss tier owned', seen.boss],
  [`rank ${balance.REBIRTH_MAX} — max rank`, seen.maxRank],
];
for (const [label, at] of rows) console.log(`  ${label.padEnd(36)} ${fmt(at).padStart(10)}`);

if (seen.allParts && seen.maxRank && seen.maxRank > seen.allParts) {
  const gap = seen.maxRank - seen.allParts;
  console.log(
    `\n  ⚠ ${fmt(gap)} of play after the last cosmetic with nothing new to unlock.`,
  );
}

// Headless play simulation: how long does each rebirth ACTUALLY take?
//
// The spec predicts that an exponential rebirth requirement against this game's
// exponential production curve yields gently growing run lengths rather than
// exploding ones. That is a prediction from two curve shapes. This measures it.
//
//   node tools/simulate.mjs [tapsPerSecond]
//
// Never hand-tune REBIRTH_BASE / REBIRTH_GROWTH without re-running this.
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
const rebirthMod = await load('src/game/rebirth.ts');
const producers = await load('src/game/config/producers.ts');
const upgrades = await load('src/game/config/upgrades.ts');

const TAPS = Number(process.argv[2] ?? 2); // casual player, taps per second
// Swept from the CLI so the curve can be explored without a rebuild. The
// compiled constants stay the source of truth for the game itself.
const BASE = Number(process.argv[3] ?? 5_000);
const GROWTH = Number(process.argv[4] ?? 2.6);
const requirementFor = (n) => BASE * GROWTH ** n;
const STEP_MS = 1000;
const MAX_SECONDS = 60 * 60 * 400; // give up after 400 simulated hours

/** Greedy shopper: always buy the best dumplings-per-second per dumpling spent. */
function shop(state) {
  for (;;) {
    let best = null;
    for (const p of producers.PRODUCERS) {
      const owned = state.producers[p.id] ?? 0;
      const cost = economy.costOf(p, owned);
      if (cost > state.dumplings) continue;
      const value = p.baseDps / cost;
      if (!best || value > best.value) best = { kind: 'producer', id: p.id, value };
    }
    for (const u of upgrades.UPGRADES) {
      if (state.upgrades.includes(u.id)) continue;
      if (u.cost > state.dumplings) continue;
      if (state.stats.totalClicks < u.unlockAtClicks) continue;
      // value a click upgrade by the dps it adds at the assumed tap rate
      const gain = (economy.clickValueWith(state, u.id) - economy.clickValue(state)) * TAPS;
      const value = gain / u.cost;
      if (!best || value > best.value) best = { kind: 'upgrade', id: u.id, value };
    }
    if (!best) return;
    if (best.kind === 'producer') actions.buyProducer(state, best.id);
    else actions.buyUpgrade(state, best.id);
  }
}

function timeToRebirth(state, clock) {
  const need = requirementFor(state.prestige);
  let seconds = 0;
  while (state.runEarned < need && seconds < MAX_SECONDS) {
    clock.now += STEP_MS;
    actions.accrue(state, STEP_MS, clock.now);
    for (let i = 0; i < TAPS; i++) actions.click(state, clock.now);
    shop(state);
    seconds += 1;
  }
  return seconds;
}

const fmt = (s) => {
  if (s >= MAX_SECONDS) return 'NEVER';
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${(s / 60).toFixed(1)}m`;
  return `${(s / 3600).toFixed(1)}h`;
};

const clock = { now: 0 };
let state = state0.createInitialState(0);
const rows = [];
let cumulative = 0;

for (let n = 0; n < 60; n++) {
  const secs = timeToRebirth(state, clock);
  cumulative += secs;
  rows.push({
    rebirth: n + 1,
    need: requirementFor(state.prestige),
    took: secs,
    mult: rebirthMod.rebirthMultiplier(state.prestige),
    cumulative,
  });
  if (secs >= MAX_SECONDS) break;
  // Reset locally rather than via actions.rebirth(): that checks the COMPILED
  // requirement, so a swept BASE/GROWTH would fail its gate, leave prestige at
  // 0 and report a flat 0s for every run after the first.
  const next = state0.createInitialState(clock.now);
  next.avatar = { ...state.avatar };
  next.settings = { ...state.settings };
  next.stats = { ...state.stats };
  next.totalEarned = state.totalEarned;
  next.prestige = state.prestige + 1;
  next.runEarned = 0;
  state = next;
}

console.log(`taps/sec: ${TAPS}  base: ${BASE}  growth: ${GROWTH}`);
console.log('rebirth | requirement | multiplier | this run | total so far');
for (const r of rows) {
  if (![1, 2, 3, 4, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60].includes(r.rebirth)) continue;
  console.log(
    `${String(r.rebirth).padStart(7)} | ${r.need.toExponential(2).padStart(11)} | ${('x' + r.mult.toFixed(2)).padStart(10)} | ${fmt(r.took).padStart(8)} | ${fmt(r.cumulative)}`,
  );
}

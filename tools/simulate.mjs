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
const balance = await load('src/game/config/balance.ts');
const rewards = await load('src/game/rewards.ts');
const findableCfg = await load('src/game/config/findables.ts');

const TAPS = Number(process.argv[2] ?? 2); // casual player, taps per second
// Swept from the CLI so the curve can be explored without a rebuild. The
// compiled constants stay the source of truth for the game itself.
const BASE = Number(process.argv[3] ?? 5_000);
const GROWTH = Number(process.argv[4] ?? 2.6);
const requirementFor = (n) => BASE * GROWTH ** n;
const STEP_MS = 1000;
const MAX_SECONDS = 60 * 60 * 400; // give up after 400 simulated hours

// What share of findables the player actually catches. 1 = a player watching
// the screen the whole time, which is the upper bound on how fast the game can
// be played; pass a lower number to model someone half paying attention.
const CATCH_RATE = Number(process.argv[5] ?? 1);

/**
 * Findables were NOT modelled here until 2026-08-21, and the balance comments
 * said so ("an estimate, not a measurement"). That was tolerable while they
 * added ~65% on the margins. It stopped being tolerable when the airdrop lane
 * went to one every 30 seconds: findables are now a first-class income source,
 * and a sweep that ignores them measures a game nobody plays.
 *
 * Modelled as an average rate rather than by simulating spawn timers: over the
 * hours these runs cover, the mean is what moves the curve, and it keeps the
 * simulation a closed-form second-by-second loop.
 */
const payoutLanes = findableCfg.LANES.flatMap((lane) =>
  lane.kinds
    .filter((k) => k.payoutSeconds)
    .map((k) => ({
      kind: k.id,
      // one spawn per mean interval, shared across the kinds in the lane
      perSecond:
        (1 / ((lane.minMs + lane.maxMs) / 2 / 1000)) *
        (k.weight / lane.kinds.reduce((sum, other) => sum + other.weight, 0)),
    })),
);

/** Average dumplings per second from catching findables at the current state. */
function findableIncome(state) {
  if (CATCH_RATE <= 0) return 0;
  const dps = economy.dpsOf(state);
  const click = economy.clickValue(state);
  let total = 0;
  for (const lane of payoutLanes) {
    total += rewards.rewardFor(lane.kind, dps, click) * lane.perSecond;
  }
  return total * CATCH_RATE;
}

// Deterministic LCG for the crit roll, so a sweep is reproducible.
let seed = 12345;
const nextRandom = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

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
      // Value a click upgrade by the dps it adds at the assumed tap rate.
      // The crit term is essential, not a refinement: crit lives OUTSIDE
      // clickValue by design, so without it every crit upgrade prices at
      // exactly 0, the shopper never buys one, and the sweep silently reports
      // a curve for a game the player is not playing.
      const withEV = economy.clickValueWith(state, u.id) * economy.critEV([...state.upgrades, u.id]);
      const nowEV = economy.clickValue(state) * economy.critEV(state.upgrades);
      const gain = (withEV - nowEV) * TAPS;
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
    // grant(), not accrue(): a findable pays raw production with no frenzy
    // multiplier, exactly as main.ts credits a real catch
    actions.grant(state, findableIncome(state) * (STEP_MS / 1000));
    // A seeded roll, not Math.random: two runs of the same sweep must agree, or
    // "measured, never reasoned about" is not true of the numbers it prints.
    for (let i = 0; i < TAPS; i++) actions.click(state, clock.now, nextRandom);
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

// Stops at REBIRTH_MAX. The ladder is capped now (Dor, 2026-08-22), so
// measuring rank 60 or 70 would describe a game nobody can reach — and those
// were exactly the ranks whose 34h and 308h run lengths the cap exists to
// delete. Raise the cap in balance.ts and this follows automatically.
for (let n = 0; n < balance.REBIRTH_MAX; n++) {
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
  // Mirror actions.rebirth()'s keep rule. Forgetting it here would model a
  // cold restart the real game no longer does, and every run length below
  // would be too long. ROUNDED, matching actions.rebirth() since 2026-08-21.
  for (const [id, count] of Object.entries(state.producers)) {
    const keep = Math.round(count * balance.REBIRTH_KEEP_FRACTION);
    if (keep > 0) next.producers[id] = keep;
  }
  // ...and the flat click upgrades are permanent, so the run does NOT start by
  // re-buying them. Omitting this makes every measured run too long and models
  // a grind the game no longer asks for.
  next.upgrades = state.upgrades.filter((id) => upgrades.UPGRADE_BY_ID[id]?.keepOnRebirth);
  state = next;
}

console.log(
  `taps/sec: ${TAPS}  base: ${BASE}  growth: ${GROWTH}  cap: ${balance.REBIRTH_MAX}`,
);
console.log('rebirth | requirement | multiplier | this run | total so far');
for (const r of rows) {
  const shown = [1, 2, 3, 4, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60];
  // always print the final rank, whatever the cap is set to
  if (!shown.includes(r.rebirth) && r.rebirth !== balance.REBIRTH_MAX) continue;
  console.log(
    `${String(r.rebirth).padStart(7)} | ${r.need.toExponential(2).padStart(11)} | ${('x' + r.mult.toFixed(2)).padStart(10)} | ${fmt(r.took).padStart(8)} | ${fmt(r.cumulative)}`,
  );
}

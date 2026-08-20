# Findables (airdrops) + scheduler extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tappable airdrop packages that pay out a stage-scaled amount, and move the spawn scheduler out of the untested DOM module into pure, tested logic shared by every findable.

**Architecture:** One schedule owns one on-screen slot. A pure reducer in `src/game/findables.ts` decides when something spawns, which kind it is, and when it leaves; `src/ui/findables.ts` is a thin element adapter that renders whichever kind is active. Clearing the slot and rolling the next spawn are a single operation so no exit path can drop one, which is the bug fixed on 2026-08-20.

**Tech Stack:** TypeScript, Vite, Vitest, vanilla DOM. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-juice-pass-design.md` (section 5, Findables)

## Global Constraints

- All UI copy goes in `src/i18n/strings.he.ts`. Hebrew only, RTL.
- All tuning numbers go in `src/game/config/balance.ts`. Logic files never hold constants.
- Findable ids are save-adjacent identifiers: never rename after ship.
- `dpsOf()` stays raw. Findable payouts must NOT be multiplied by an active frenzy, and must never pay offline.
- No `SAVE_VERSION` bump. Nothing in this plan adds a persisted field.
- Run tests from `~/ApiScripts/dumpling-clicker`, never from `~/ApiScripts` (vitest there sweeps ~900 unrelated tests).
- Never commit `dist/`.

---

### Task 1: Pure schedule reducer

**Files:**
- Create: `src/game/config/findables.ts`
- Modify: `src/game/config/balance.ts` (replace the two golden interval constants, add airdrop knobs)
- Create: `src/game/findables.ts`
- Create: `tests/findables.test.ts`
- Modify: `tests/golden.test.ts` (drop the `rollNextSpawn` block, which moves here)
- Modify: `src/game/golden.ts` (delete `rollNextSpawn`, keep the frenzy helpers)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `Schedule`, `FindableKind`, `createSchedule(now, rand)`, `advance(schedule, now, rand)`, `collect(schedule, now, rand)`, `pickKind(rand)`, `rollNextSpawn(now, rand)`, and the `FINDABLES` table.

- [ ] **Step 1: Write the config table**

Create `src/game/config/findables.ts`:

```ts
// The things that appear on screen waiting to be tapped. Adding one is a data
// entry here plus a render case in ui/findables.ts — no scheduling changes.
// ids are stable identifiers; never rename after ship.
export type FindableKind = 'golden' | 'airdrop';

export interface FindableDef {
  id: FindableKind;
  /** relative spawn weight within the single shared slot */
  weight: number;
  /** how long it sits on screen before leaving untapped */
  lifetimeMs: number;
}

export const FINDABLES: FindableDef[] = [
  { id: 'golden', weight: 45, lifetimeMs: 13_000 },
  { id: 'airdrop', weight: 55, lifetimeMs: 11_000 },
];

export const FINDABLE_BY_ID: Record<FindableKind, FindableDef> =
  Object.fromEntries(FINDABLES.map((f) => [f.id, f])) as Record<FindableKind, FindableDef>;
```

- [ ] **Step 2: Move the timing knobs into balance.ts**

In `src/game/config/balance.ts`, replace these two lines:

```ts
export const GOLDEN_MIN_INTERVAL_MS = 5 * 60 * 1000;
export const GOLDEN_MAX_INTERVAL_MS = 15 * 60 * 1000;
```

with:

```ts
// One shared slot: at most one findable on screen at a time, so this interval
// covers goldens AND airdrops together rather than each having its own timer.
// Tighter than the golden's old 5-15min because it is now split between kinds.
export const FINDABLE_SPAWN_MIN_MS = 3 * 60 * 1000;
export const FINDABLE_SPAWN_MAX_MS = 8 * 60 * 1000;
// An airdrop pays this many seconds of current production. Self-scaling, so it
// stays meaningful at hour 1 and hour 25 with no per-stage table.
export const AIRDROP_SECONDS = 90;
// ...but production is near zero in the first minutes, so it never pays less
// than this many taps' worth. Expressed in clicks so it self-scales too.
export const AIRDROP_FLOOR_CLICKS = 25;
```

Leave `GOLDEN_LIFETIME_MS` in place for now; Task 3 removes it once the UI reads
lifetimes from `FINDABLES`.

- [ ] **Step 3: Write the failing tests**

Create `tests/findables.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  advance,
  collect,
  createSchedule,
  pickKind,
  rollNextSpawn,
} from '../src/game/findables';
import {
  FINDABLE_SPAWN_MAX_MS,
  FINDABLE_SPAWN_MIN_MS,
} from '../src/game/config/balance';
import { FINDABLE_BY_ID } from '../src/game/config/findables';

describe('rollNextSpawn', () => {
  test('rand=0 gives the soonest allowed spawn', () => {
    expect(rollNextSpawn(1_000, () => 0)).toBe(1_000 + FINDABLE_SPAWN_MIN_MS);
  });

  test('always lands inside the window', () => {
    for (let i = 0; i <= 20; i++) {
      const t = rollNextSpawn(5_000, () => i / 20);
      expect(t).toBeGreaterThanOrEqual(5_000 + FINDABLE_SPAWN_MIN_MS);
      expect(t).toBeLessThanOrEqual(5_000 + FINDABLE_SPAWN_MAX_MS);
    }
  });
});

describe('advance', () => {
  test('does nothing before the spawn time', () => {
    const s = createSchedule(0, () => 0);
    const { action } = advance(s, 10, () => 0);
    expect(action.type).toBe('none');
  });

  test('spawns once the spawn time arrives', () => {
    const s = createSchedule(0, () => 0);
    const at = FINDABLE_SPAWN_MIN_MS;
    const { schedule, action } = advance(s, at, () => 0);
    expect(action).toEqual({ type: 'spawn', kind: 'golden' });
    expect(schedule.active).toBe('golden');
    expect(schedule.despawnAt).toBe(at + FINDABLE_BY_ID.golden.lifetimeMs);
  });

  test('only one findable is on screen at a time', () => {
    const s = createSchedule(0, () => 0);
    const spawned = advance(s, FINDABLE_SPAWN_MIN_MS, () => 0).schedule;
    // a later tick while one is alive must never spawn a second
    const { action } = advance(spawned, FINDABLE_SPAWN_MIN_MS + 1, () => 0);
    expect(action.type).toBe('none');
  });

  test('despawns after its lifetime and reschedules into the future', () => {
    const s = createSchedule(0, () => 0);
    const spawned = advance(s, FINDABLE_SPAWN_MIN_MS, () => 0).schedule;
    const at = spawned.despawnAt;
    const { schedule, action } = advance(spawned, at, () => 0);
    expect(action.type).toBe('despawn');
    expect(schedule.active).toBeNull();
    expect(schedule.nextAt).toBeGreaterThanOrEqual(at + FINDABLE_SPAWN_MIN_MS);
  });
});

describe('collect — the 2026-08-20 regression', () => {
  // A natural spawn fires when now >= nextAt, so nextAt is in the PAST for as
  // long as that findable is alive. Clearing without rescheduling re-enters
  // spawn() on the very next frame, forever. Catching one used to do exactly
  // that, which left the x7 frenzy permanently active.
  test('catching reschedules into the future', () => {
    const s = createSchedule(0, () => 0);
    const spawned = advance(s, FINDABLE_SPAWN_MIN_MS, () => 0).schedule;
    const caughtAt = FINDABLE_SPAWN_MIN_MS + 500;
    const after = collect(spawned, caughtAt, () => 0);
    expect(after.active).toBeNull();
    expect(after.nextAt).toBeGreaterThanOrEqual(caughtAt + FINDABLE_SPAWN_MIN_MS);
  });

  test('the frame after a catch does not spawn', () => {
    const s = createSchedule(0, () => 0);
    const spawned = advance(s, FINDABLE_SPAWN_MIN_MS, () => 0).schedule;
    const caughtAt = FINDABLE_SPAWN_MIN_MS + 500;
    const after = collect(spawned, caughtAt, () => 0);
    const { action } = advance(after, caughtAt + 16, () => 0);
    expect(action.type).toBe('none');
  });

  test('every exit path leaves nextAt in the future', () => {
    // despawn path and collect path must agree — neither may leave a stale stamp
    const s = createSchedule(0, () => 0);
    const spawned = advance(s, FINDABLE_SPAWN_MIN_MS, () => 0).schedule;
    const viaTimeout = advance(spawned, spawned.despawnAt, () => 0).schedule;
    const viaCatch = collect(spawned, spawned.despawnAt, () => 0);
    expect(viaTimeout.nextAt).toBeGreaterThan(spawned.despawnAt);
    expect(viaCatch.nextAt).toBeGreaterThan(spawned.despawnAt);
  });
});

describe('pickKind', () => {
  test('rand=0 picks the first kind in the table', () => {
    expect(pickKind(() => 0)).toBe('golden');
  });

  test('rand just under 1 picks the last kind', () => {
    expect(pickKind(() => 0.999999)).toBe('airdrop');
  });

  test('both kinds are reachable across the range', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(pickKind(() => i / 100));
    expect(seen).toEqual(new Set(['golden', 'airdrop']));
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd ~/ApiScripts/dumpling-clicker && npx vitest run tests/findables.test.ts`
Expected: FAIL — cannot resolve `../src/game/findables`.

- [ ] **Step 5: Write the reducer**

Create `src/game/findables.ts`:

```ts
// When findables appear, which kind, and when they leave. Pure over
// (schedule, now, rand) so it is testable without a clock or a DOM — the
// element half lives in src/ui/findables.ts.
//
// ONE SLOT: at most one findable exists at a time, so `active` is a single
// field rather than a list. Two independent timers would let a golden and an
// airdrop overlap the squishy's face.
import {
  FINDABLE_SPAWN_MAX_MS,
  FINDABLE_SPAWN_MIN_MS,
} from './config/balance';
import { FINDABLES, FINDABLE_BY_ID, type FindableKind } from './config/findables';

export type { FindableKind };

export interface Schedule {
  /** epoch ms of the next spawn; only meaningful while `active` is null */
  nextAt: number;
  active: FindableKind | null;
  /** epoch ms the active one leaves untapped; only meaningful while active */
  despawnAt: number;
}

export type FindableAction =
  | { type: 'none' }
  | { type: 'spawn'; kind: FindableKind }
  | { type: 'despawn' };

/** Epoch ms for the next spawn: uniform in [MIN, MAX] after `now`. */
export function rollNextSpawn(now: number, rand: () => number = Math.random): number {
  const span = FINDABLE_SPAWN_MAX_MS - FINDABLE_SPAWN_MIN_MS;
  return now + FINDABLE_SPAWN_MIN_MS + rand() * span;
}

export function createSchedule(now: number, rand: () => number = Math.random): Schedule {
  return { nextAt: rollNextSpawn(now, rand), active: null, despawnAt: 0 };
}

/** Weighted pick across the FINDABLES table. */
export function pickKind(rand: () => number = Math.random): FindableKind {
  const total = FINDABLES.reduce((sum, f) => sum + f.weight, 0);
  let roll = rand() * total;
  for (const f of FINDABLES) {
    roll -= f.weight;
    if (roll < 0) return f.id;
  }
  return FINDABLES[FINDABLES.length - 1].id;
}

/**
 * Clearing the slot and rolling the next spawn are ONE operation, on purpose.
 * A natural spawn fires when `now >= nextAt`, which leaves `nextAt` in the past
 * for as long as that findable is alive. Any path that clears `active` without
 * rescheduling re-enters the spawn branch on the very next frame, forever.
 * That shipped on 2026-08-20 via the tap handler and left the x7 frenzy
 * permanently active. Both exit paths below go through here.
 */
function cleared(now: number, rand: () => number): Schedule {
  return { nextAt: rollNextSpawn(now, rand), active: null, despawnAt: 0 };
}

/** The player tapped it. Same clearing rules as a timeout. */
export function collect(
  _schedule: Schedule,
  now: number,
  rand: () => number = Math.random,
): Schedule {
  return cleared(now, rand);
}

/** One tick of the schedule. */
export function advance(
  schedule: Schedule,
  now: number,
  rand: () => number = Math.random,
): { schedule: Schedule; action: FindableAction } {
  if (schedule.active) {
    if (now >= schedule.despawnAt) {
      return { schedule: cleared(now, rand), action: { type: 'despawn' } };
    }
    return { schedule, action: { type: 'none' } };
  }
  if (now >= schedule.nextAt) {
    const kind = pickKind(rand);
    return {
      schedule: {
        nextAt: schedule.nextAt,
        active: kind,
        despawnAt: now + FINDABLE_BY_ID[kind].lifetimeMs,
      },
      action: { type: 'spawn', kind },
    };
  }
  return { schedule, action: { type: 'none' } };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd ~/ApiScripts/dumpling-clicker && npx vitest run tests/findables.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 7: Remove the moved function from its old home**

In `src/game/golden.ts`, delete the `rollNextSpawn` function and its now-unused
imports of `GOLDEN_MAX_INTERVAL_MS` / `GOLDEN_MIN_INTERVAL_MS`. Keep
`isFrenzyActive` and `frenzyRemainingMs` exactly as they are — frenzy is a
separate mechanic from scheduling and is not moving.

In `tests/golden.test.ts`, delete the entire `describe('rollNextSpawn', ...)`
block and the now-unused imports of `GOLDEN_MAX_INTERVAL_MS` and
`GOLDEN_MIN_INTERVAL_MS`. Keep the `isFrenzyActive` and `frenzyRemainingMs`
blocks unchanged.

- [ ] **Step 8: Run the full suite**

Run: `cd ~/ApiScripts/dumpling-clicker && npm test`
Expected: PASS. `src/ui/golden.ts` still imports `rollNextSpawn` from
`../game/golden`, so `npm run build` will fail until Task 3 — that is expected
and fine at this point. `npm test` does not typecheck.

- [ ] **Step 9: Commit**

```bash
git add src/game/findables.ts src/game/config/findables.ts src/game/config/balance.ts src/game/golden.ts tests/findables.test.ts tests/golden.test.ts
git commit -m "Extract findable scheduling into pure, tested logic

One shared slot, weighted kind selection, and clearing that always reschedules.
The catch path losing its reschedule is what made caught goldens respawn
instantly on 2026-08-20; it is now a test rather than a comment."
```

---

### Task 2: Airdrop payout

**Files:**
- Create: `src/game/rewards.ts`
- Create: `tests/rewards.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `airdropReward(dps: number, clickValue: number): number`.

- [ ] **Step 1: Write the failing test**

Create `tests/rewards.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { airdropReward } from '../src/game/rewards';
import { AIRDROP_FLOOR_CLICKS, AIRDROP_SECONDS } from '../src/game/config/balance';

describe('airdropReward', () => {
  test('pays the configured seconds of current production', () => {
    expect(airdropReward(1_000, 1)).toBe(1_000 * AIRDROP_SECONDS);
  });

  test('scales with the player stage without a table', () => {
    const early = airdropReward(10, 1);
    const late = airdropReward(10_000_000, 1);
    expect(late / early).toBe(1_000_000);
  });

  test('falls back to the click floor when production is near zero', () => {
    // a brand new game: dps 0.5, click 1 -> 45 from production, floor is 25
    expect(airdropReward(0.5, 1)).toBe(0.5 * AIRDROP_SECONDS);
    // production genuinely lower than the floor
    expect(airdropReward(0.1, 1)).toBe(AIRDROP_FLOOR_CLICKS);
  });

  test('the floor scales with click value, so it never goes stale', () => {
    expect(airdropReward(0, 8)).toBe(8 * AIRDROP_FLOOR_CLICKS);
  });

  test('never returns a negative or non-finite payout', () => {
    expect(airdropReward(-5, -5)).toBe(0);
    expect(airdropReward(Number.NaN, 1)).toBe(AIRDROP_FLOOR_CLICKS);
    expect(airdropReward(Number.POSITIVE_INFINITY, 1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ~/ApiScripts/dumpling-clicker && npx vitest run tests/rewards.test.ts`
Expected: FAIL — cannot resolve `../src/game/rewards`.

- [ ] **Step 3: Write the implementation**

Create `src/game/rewards.ts`:

```ts
// What a findable pays out. Pure, so payouts are testable without a DOM.
//
// Derived from the RAW dps: a findable is neither click() nor accrue(), so an
// active frenzy must not multiply it. Keeping the multiplier out here is the
// same rule that keeps it out of dpsOf() and offline earnings.
import { AIRDROP_FLOOR_CLICKS, AIRDROP_SECONDS } from './config/balance';

/**
 * An airdrop is worth AIRDROP_SECONDS of current production, floored at a
 * number of taps so it is not worthless in the first minutes when dps is ~0.
 * Both terms self-scale, so neither needs a per-stage table.
 */
export function airdropReward(dps: number, clickValue: number): number {
  const fromProduction = Number.isFinite(dps) && dps > 0 ? dps * AIRDROP_SECONDS : 0;
  const floor =
    Number.isFinite(clickValue) && clickValue > 0 ? clickValue * AIRDROP_FLOOR_CLICKS : 0;
  return Math.max(fromProduction, floor);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ~/ApiScripts/dumpling-clicker && npx vitest run tests/rewards.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/rewards.ts tests/rewards.test.ts
git commit -m "Add airdrop payout: N seconds of production, floored in clicks

Both terms self-scale, so the reward stays meaningful at every stage with no
per-stage table to go stale. Derived from raw dps so a frenzy cannot multiply
it."
```

---

### Task 3: Element adapter and wiring

**Files:**
- Create: `src/ui/findables.ts`
- Delete: `src/ui/golden.ts`
- Modify: `src/main.ts:79-91` (the `initGolden` call) and its import block
- Modify: `src/i18n/strings.he.ts` (airdrop label and payout floater)
- Modify: `src/game/config/balance.ts` (remove `GOLDEN_LIFETIME_MS`, now in `FINDABLES`)
- Modify: `src/styles/main.css` (airdrop styling next to `.golden`)

**Interfaces:**
- Consumes: `createSchedule`, `advance`, `collect`, `Schedule`, `FindableKind` from Task 1; `airdropReward` from Task 2.
- Produces: `initFindables(host, deps): FindablesApi` where `FindablesApi` is `{ tick(now: number): void; setAvatar(design: AvatarDesign): void; spawnNow(now: number, kind?: FindableKind): void }`.

- [ ] **Step 1: Add the copy**

In `src/i18n/strings.he.ts`, add to the `STR` object next to `goldenLabel`:

```ts
  airdropLabel: 'חבילת כופתאות!',
  airdropCaught: (amount: string) => `‎+${amount}‎ כופתאות!`,
```

The `‎` (LRM) prefix is required. Without it, RTL bidi reorders `+1.2K` into
`1.2K+`, the same reason `gainPerSecond` carries one.

- [ ] **Step 2: Port the element module**

Create `src/ui/findables.ts` by copying `src/ui/golden.ts` and making these
changes. Everything not listed stays byte-identical, including the placement
maths and its comments — the face-protection logic and the "position with
left/top, never transform" rule are both load-bearing.

1. Rename `initGolden` to `initFindables` and `GoldenApi` to `FindablesApi`.
2. Replace the module's private `nextAt` / `based` / `despawnAt` / `alive`
   variables with a single `let schedule: Schedule` plus `let based = false`,
   and delete the local `clear()` — Task 1 owns all of that now.
3. `render()` branches on the active kind:

```ts
const render = (kind: FindableKind) => {
  if (kind === 'golden') {
    el.innerHTML = avatarSVG(getAvatar(), 'golden-svg', GOLD);
    const svg = el.querySelector('svg');
    if (svg) svg.style.filter = GOLD_FILTER;
    el.setAttribute('aria-label', STR.goldenLabel);
    el.classList.add('golden');
    el.classList.remove('airdrop');
  } else {
    el.innerHTML = '<span class="airdrop-icon">🎁</span>';
    el.setAttribute('aria-label', STR.airdropLabel);
    el.classList.add('airdrop');
    el.classList.remove('golden');
  }
};
```

4. `spawn(now, kind)` takes the kind, calls `render(kind)`, and no longer sets
   `despawnAt` (the schedule owns it).
5. `tick(now)` delegates:

```ts
tick(now) {
  if (!based) {
    // the loop's first `now` is the real clock; rebase off it once
    schedule = createSchedule(now, rand);
    based = true;
    return;
  }
  const { schedule: next, action } = advance(schedule, now, rand);
  schedule = next;
  if (action.type === 'spawn') spawn(now, action.kind);
  else if (action.type === 'despawn') hide();
}
```

   `hide()` now only touches the DOM (`el.hidden = true`, remove `golden-in`).

6. The `pointerdown` handler reads the active kind before clearing, then calls
   the matching callback:

```ts
el.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation(); // never let the tap reach the squishy behind it
  const kind = schedule.active;
  if (!kind) return;
  const r = el.getBoundingClientRect();
  const x = e.clientX || r.left + r.width / 2;
  const y = e.clientY || r.top + r.height / 2;
  schedule = collect(schedule, Date.now(), rand);
  hide();
  onCatch(kind, x, y);
});
```

7. `spawnNow(now, kind = 'golden')` sets `based = true`, sets
   `schedule = { nextAt: rollNextSpawn(now, rand), active: kind, despawnAt: now + FINDABLE_BY_ID[kind].lifetimeMs }`
   and calls `spawn(now, kind)`.

   Note the difference from the old `spawnNow`: it now rolls `nextAt` forward
   too. The old one left `nextAt` untouched, which is precisely why
   `__spawnGolden()` could not reproduce the respawn bug — the forced path
   looked healthy while the natural path was broken.

- [ ] **Step 3: Move the lifetime constant**

In `src/game/config/balance.ts`, delete `GOLDEN_LIFETIME_MS`. Lifetimes now
live per kind in `src/game/config/findables.ts`.

- [ ] **Step 4: Wire it in main.ts**

In `src/main.ts`, change the import on line 29 from
`import { initGolden } from './ui/golden';` to
`import { initFindables } from './ui/findables';`, and add
`import { airdropReward } from './game/rewards';`.

`clickValue` and `dpsOf` are already imported on line 4 and `startFrenzy` on
line 3, so no other import changes are needed. Replace the `initGolden(...)`
call at lines 79-91 with:

```ts
const findables = initFindables(
  document.getElementById('stage')!,
  () => state.avatar,
  (kind, x, y) => {
    const at = Date.now();
    ensureAudio();
    if (kind === 'golden') {
      startFrenzy(state, at);
      playGolden();
      navigator.vibrate?.([12, 40, 12]);
      spawnFloater(x, y, STR.frenzyStart(FRENZY_MULTIPLIER));
    } else {
      // raw dps on purpose: a frenzy must not multiply a findable payout
      const amount = airdropReward(dpsOf(state), clickValue(state));
      state.dumplings += amount;
      state.totalEarned += amount;
      playGolden();
      navigator.vibrate?.([12, 40, 12]);
      spawnFloater(x, y, STR.airdropCaught(formatNumber(amount)));
    }
    saveToStorage(state, at);
  },
);
```

Update the loop wiring further down from `tickGolden: (at) => golden.tick(at)`
to `tickGolden: (at) => findables.tick(at)`, and any other `golden.` references
(for example the `setAvatar` call after the designer closes) to `findables.`.

Update the dev backdoor at the bottom of the file:

```ts
if (import.meta.env.DEV) {
  // dev-only backdoor: shipping this would let anyone farm rewards from the
  // console. Vite strips the branch from the production bundle.
  (window as unknown as Record<string, unknown>).__spawnGolden = () =>
    findables.spawnNow(Date.now(), 'golden');
  (window as unknown as Record<string, unknown>).__spawnAirdrop = () =>
    findables.spawnNow(Date.now(), 'airdrop');
}
```

- [ ] **Step 5: Delete the old module**

```bash
git rm src/ui/golden.ts
```

- [ ] **Step 6: Style the airdrop**

In `src/styles/main.css`, immediately after the `.golden` block, add:

```css
/* The airdrop shares .golden's box, tap target and bob so placement and hit
   area stay identical; only the look differs. */
.airdrop {
  filter: drop-shadow(0 0 14px rgba(120, 200, 255, 0.75));
}

.airdrop-icon {
  font-size: 2.6rem;
  line-height: 1;
  display: block;
}
```

Add `.airdrop` to the existing `@media (prefers-reduced-motion: reduce)` block
alongside `.golden`, `.golden-in` and `.hud-frenzy`.

- [ ] **Step 7: Typecheck, test and build**

Run: `cd ~/ApiScripts/dumpling-clicker && npm test && npm run build`
Expected: 112 tests PASS, build succeeds with no TypeScript errors. (99 today,
minus the 4 `rollNextSpawn` tests removed from `golden.test.ts` in Task 1, plus
12 in `findables.test.ts` and 5 in `rewards.test.ts`.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add airdrop findable and one shared on-screen slot

ui/golden.ts becomes ui/findables.ts: a thin element adapter over the pure
scheduler, rendering whichever kind is active. spawnNow now rolls nextAt
forward too, so the dev backdoor exercises the same path as a natural spawn."
```

---

### Task 4: Browser verification

**Files:**
- Create: `scratchpad/findables-drive.mjs` (throwaway, not committed)

**Interfaces:**
- Consumes: the running dev server and the `__spawnGolden` / `__spawnAirdrop` backdoors from Task 3.
- Produces: nothing. This task is evidence.

- [ ] **Step 1: Start the dev server**

Run: `cd ~/ApiScripts/dumpling-clicker && npm run dev`
Read the printed URL. Port drifts — 5173 is often taken by an unrelated demo.

- [ ] **Step 2: Install the driver into the scratchpad**

Run in the session scratchpad directory, never in the game's `package.json`:

```bash
npm init -y && npm i playwright-core@1.49.1
```

Browser binary:
`~/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

- [ ] **Step 3: Drive the regression case**

Temporarily set `FINDABLE_SPAWN_MIN_MS = 2_000` and
`FINDABLE_SPAWN_MAX_MS = 3_000` in `src/game/config/balance.ts`. This is
required: `__spawnAirdrop()` cannot reproduce the respawn bug, because a forced
spawn schedules `nextAt` into the future while a natural spawn leaves it in the
past. Only the natural path exercises it.

Context `{viewport:{width:430,height:900}, hasTouch:true, isMobile:true}`. Get
through the designer with `.designer-done`, then remove `.modal-backdrop` before
tapping anything. The handler is `pointerdown`, not `click`, so dispatch a real
`PointerEvent('pointerdown')` with `clientX`/`clientY`.

Assert, waiting for a NATURAL spawn rather than forcing one:
- catching one leaves the screen empty for at least 200ms afterwards
- catches in a 10-second window are in the low single digits, not the hundreds
- an untouched one disappears on its own and does not immediately return
- only one findable element is visible at any moment

Expected: roughly 4 catches per 10 seconds at a 2-3s interval. The pre-fix
number on this same drive was 186.

- [ ] **Step 4: Drive the airdrop payout**

With the same short interval, force an airdrop via `__spawnAirdrop()`, read
`#hud-num` before and after the tap, and confirm:
- the counter rises by roughly `dps * 90`
- the floater text reads the payout, with the `+` on the left of the digits
- the payout is unchanged when a frenzy is active (start one with
  `__spawnGolden()` and catch it first)

Read the floater from `document.querySelectorAll('.floater.float-up')` — the
floaters are a pre-allocated pool, so a MutationObserver never fires.

- [ ] **Step 5: Revert the test tuning**

Run: `cd ~/ApiScripts/dumpling-clicker && git checkout src/game/config/balance.ts`
Then confirm: `grep -n "FINDABLE_SPAWN" src/game/config/balance.ts` shows the
3-minute and 8-minute values.

- [ ] **Step 6: Final check and push**

Run: `cd ~/ApiScripts/dumpling-clicker && npm test && npm run build && git status --short`
Expected: tests pass, build clean, working tree clean.

```bash
git push origin juice-pass
```

---

## Not in this plan

Increments 2, 3 and 4 of the spec get their own plans once this ships:

- Character: slow-rise puff-back and idle life (spec sections 1 and 2)
- Upgrade density and the crit tier (spec section 4)
- Scene backgrounds (spec section 3)

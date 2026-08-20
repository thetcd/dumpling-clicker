# Findables (two lanes) + scheduler extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give kids something to catch every 10-25 seconds without starving the rare rewards, and move the spawn scheduler out of the untested DOM module into pure, tested logic.

**Architecture:** Two independent lanes, each owning one on-screen slot. A pure reducer in `src/game/findables.ts` takes a lane config and decides when something spawns, which kind, and when it leaves. `src/ui/findables.ts` drives one element per lane. Clearing a slot and rolling its next spawn are a single operation so no exit path can drop one, which is the bug fixed on 2026-08-20.

**Tech Stack:** TypeScript, Vite, Vitest, vanilla DOM. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-juice-pass-design.md` (section 5, Findables)

## Global Constraints

- All UI copy goes in `src/i18n/strings.he.ts`. Hebrew only, RTL. Any string embedding a signed number needs a leading `‎` (LRM) or bidi reorders `+5` into `5+`.
- All tuning numbers go in `src/game/config/balance.ts`. Logic files never hold constants. Dor will retune these after playtesting, so every interval, lifetime and payout must be a named export.
- Findable and lane ids are stable identifiers: never rename after ship.
- `dpsOf()` stays raw. Findable payouts must NOT be multiplied by an active frenzy, and must never pay offline.
- No `SAVE_VERSION` bump. Nothing here adds a persisted field.
- Nothing in either lane may cover the squishy's face or intercept a squish. Both lanes place above the face band.
- Run tests from `~/ApiScripts/dumpling-clicker`, never `~/ApiScripts` (vitest there sweeps ~900 unrelated tests).
- Never commit `dist/`.

---

### Task 1: Lane config and pure reducer

**Files:**
- Create: `src/game/config/findables.ts`
- Modify: `src/game/config/balance.ts`
- Create: `src/game/findables.ts`
- Create: `tests/findables.test.ts`
- Modify: `tests/golden.test.ts` (drop the `rollNextSpawn` block)
- Modify: `src/game/golden.ts` (delete `rollNextSpawn`, keep frenzy helpers)

**Interfaces:**
- Consumes: nothing.
- Produces: `LaneDef`, `FindableDef`, `FindableKind`, `LaneId`, `LANES`, `LANE_BY_ID`, `COMMON_SKINS`, and from the reducer `Schedule`, `createSchedule(lane, now, rand)`, `advance(lane, schedule, now, rand)`, `collect(lane, now, rand)`, `pickKind(lane, rand)`, `pickSkin(rand)`, `rollNextSpawn(lane, now, rand)`.

- [ ] **Step 1: Replace the golden constants in balance.ts**

In `src/game/config/balance.ts`, delete these three lines:

```ts
export const GOLDEN_MIN_INTERVAL_MS = 5 * 60 * 1000;
export const GOLDEN_MAX_INTERVAL_MS = 15 * 60 * 1000;
export const GOLDEN_LIFETIME_MS = 13_000;
```

and put this in their place:

```ts
// --- findables ---
// Two lanes, each holding at most one thing at a time. A single shared slot
// does not work: the common lane spawns every 10-25s and lives 7, so it would
// occupy a shared slot almost permanently and the golden dumpling would
// effectively never appear.
//
// The common lane exists because kids disengage when nothing happens for
// minutes at a time. Catching every one is worth roughly +29% income, and with
// the rare lane on top the total is near +65%, which pulls a 25.5h first run
// toward ~15h. That is an estimate, not a measurement — retune here.
export const COMMON_SPAWN_MIN_MS = 10_000;
export const COMMON_SPAWN_MAX_MS = 25_000;
export const COMMON_LIFETIME_MS = 7_000;
export const COMMON_SECONDS = 5; // a common findable is worth 5s of production
export const COMMON_FLOOR_CLICKS = 3; // ...but never less than 3 taps' worth

export const RARE_SPAWN_MIN_MS = 3 * 60 * 1000;
export const RARE_SPAWN_MAX_MS = 8 * 60 * 1000;
export const GOLDEN_LIFETIME_MS = 13_000;
export const AIRDROP_LIFETIME_MS = 11_000;
export const AIRDROP_SECONDS = 90;
export const AIRDROP_FLOOR_CLICKS = 25;
```

- [ ] **Step 2: Write the lane config**

Create `src/game/config/findables.ts`:

```ts
// The things that appear on screen waiting to be tapped, grouped into lanes.
// Each lane owns one slot and its own timer, so a constant drip of small
// rewards cannot crowd out the rare ones. Adding a findable is a data entry
// here plus a render case in ui/findables.ts.
// ids are stable identifiers; never rename after ship.
import {
  AIRDROP_FLOOR_CLICKS,
  AIRDROP_LIFETIME_MS,
  AIRDROP_SECONDS,
  COMMON_FLOOR_CLICKS,
  COMMON_LIFETIME_MS,
  COMMON_SECONDS,
  COMMON_SPAWN_MAX_MS,
  COMMON_SPAWN_MIN_MS,
  GOLDEN_LIFETIME_MS,
  RARE_SPAWN_MAX_MS,
  RARE_SPAWN_MIN_MS,
} from './balance';

export type FindableKind = 'common' | 'golden' | 'airdrop';
export type LaneId = 'common' | 'rare';

export interface FindableDef {
  id: FindableKind;
  /** relative spawn weight within its lane */
  weight: number;
  lifetimeMs: number;
  /** seconds of current production this pays; omitted for non-payout kinds */
  payoutSeconds?: number;
  /** minimum payout, in click values, so it is not worthless at dps ~0 */
  floorClicks?: number;
}

export interface LaneDef {
  id: LaneId;
  minMs: number;
  maxMs: number;
  kinds: FindableDef[];
}

// Cosmetic rotation over ONE mechanic. Six skins, identical payout maths —
// the variety is what keeps it feeling fresh, not six sets of rules.
export const COMMON_SKINS = ['🪙', '💵', '💎', '⭐', '🧧', '🥠'];

export const LANES: LaneDef[] = [
  {
    id: 'common',
    minMs: COMMON_SPAWN_MIN_MS,
    maxMs: COMMON_SPAWN_MAX_MS,
    kinds: [
      {
        id: 'common',
        weight: 1,
        lifetimeMs: COMMON_LIFETIME_MS,
        payoutSeconds: COMMON_SECONDS,
        floorClicks: COMMON_FLOOR_CLICKS,
      },
    ],
  },
  {
    id: 'rare',
    minMs: RARE_SPAWN_MIN_MS,
    maxMs: RARE_SPAWN_MAX_MS,
    kinds: [
      // golden grants a frenzy, not a payout — hence no payoutSeconds
      { id: 'golden', weight: 45, lifetimeMs: GOLDEN_LIFETIME_MS },
      {
        id: 'airdrop',
        weight: 55,
        lifetimeMs: AIRDROP_LIFETIME_MS,
        payoutSeconds: AIRDROP_SECONDS,
        floorClicks: AIRDROP_FLOOR_CLICKS,
      },
    ],
  },
];

export const LANE_BY_ID: Record<LaneId, LaneDef> = Object.fromEntries(
  LANES.map((l) => [l.id, l]),
) as Record<LaneId, LaneDef>;

export const FINDABLE_BY_ID: Record<FindableKind, FindableDef> = Object.fromEntries(
  LANES.flatMap((l) => l.kinds).map((f) => [f.id, f]),
) as Record<FindableKind, FindableDef>;
```

- [ ] **Step 3: Write the failing tests**

Create `tests/findables.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  advance,
  collect,
  createSchedule,
  pickKind,
  pickSkin,
  rollNextSpawn,
} from '../src/game/findables';
import {
  COMMON_SKINS,
  FINDABLE_BY_ID,
  LANE_BY_ID,
} from '../src/game/config/findables';

const COMMON = LANE_BY_ID.common;
const RARE = LANE_BY_ID.rare;

describe('rollNextSpawn', () => {
  test('rand=0 gives the lane its soonest allowed spawn', () => {
    expect(rollNextSpawn(COMMON, 1_000, () => 0)).toBe(1_000 + COMMON.minMs);
  });

  test('each lane uses its own window', () => {
    expect(rollNextSpawn(RARE, 0, () => 0)).toBe(RARE.minMs);
    expect(rollNextSpawn(COMMON, 0, () => 0)).toBe(COMMON.minMs);
    expect(RARE.minMs).toBeGreaterThan(COMMON.maxMs);
  });

  test('always lands inside the lane window', () => {
    for (const lane of [COMMON, RARE]) {
      for (let i = 0; i <= 20; i++) {
        const t = rollNextSpawn(lane, 5_000, () => i / 20);
        expect(t).toBeGreaterThanOrEqual(5_000 + lane.minMs);
        expect(t).toBeLessThanOrEqual(5_000 + lane.maxMs);
      }
    }
  });
});

describe('advance', () => {
  test('does nothing before the spawn time', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    expect(advance(COMMON, s, 10, () => 0).action.type).toBe('none');
  });

  test('spawns once the spawn time arrives', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    const at = COMMON.minMs;
    const { schedule, action } = advance(COMMON, s, at, () => 0);
    expect(action).toEqual({ type: 'spawn', kind: 'common' });
    expect(schedule.active).toBe('common');
    expect(schedule.despawnAt).toBe(at + FINDABLE_BY_ID.common.lifetimeMs);
  });

  test('a lane holds only one findable at a time', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    const spawned = advance(COMMON, s, COMMON.minMs, () => 0).schedule;
    expect(advance(COMMON, spawned, COMMON.minMs + 1, () => 0).action.type).toBe('none');
  });

  test('despawns after its lifetime and reschedules into the future', () => {
    const s = createSchedule(COMMON, 0, () => 0);
    const spawned = advance(COMMON, s, COMMON.minMs, () => 0).schedule;
    const at = spawned.despawnAt;
    const { schedule, action } = advance(COMMON, spawned, at, () => 0);
    expect(action.type).toBe('despawn');
    expect(schedule.active).toBeNull();
    expect(schedule.nextAt).toBeGreaterThanOrEqual(at + COMMON.minMs);
  });

  test('lanes are independent — a busy common lane never blocks the rare one', () => {
    // the whole reason two lanes exist: at 10-25s the common lane would
    // occupy a shared slot almost permanently and starve the golden dumpling
    const common = advance(COMMON, createSchedule(COMMON, 0, () => 0), COMMON.minMs, () => 0);
    const rare = advance(RARE, createSchedule(RARE, 0, () => 0), RARE.minMs, () => 0);
    expect(common.action.type).toBe('spawn');
    expect(rare.action.type).toBe('spawn');
  });
});

describe('collect — the 2026-08-20 regression', () => {
  // A natural spawn fires when now >= nextAt, so nextAt is in the PAST for as
  // long as that findable is alive. Clearing without rescheduling re-enters
  // the spawn branch on the very next frame, forever. Catching one used to do
  // exactly that, which left the x7 frenzy permanently active.
  test('catching reschedules into the future', () => {
    const spawned = advance(RARE, createSchedule(RARE, 0, () => 0), RARE.minMs, () => 0).schedule;
    const caughtAt = RARE.minMs + 500;
    const after = collect(RARE, caughtAt, () => 0);
    expect(after.active).toBeNull();
    expect(after.nextAt).toBeGreaterThanOrEqual(caughtAt + RARE.minMs);
  });

  test('the frame after a catch does not spawn', () => {
    const spawned = advance(RARE, createSchedule(RARE, 0, () => 0), RARE.minMs, () => 0).schedule;
    const caughtAt = RARE.minMs + 500;
    const after = collect(RARE, caughtAt, () => 0);
    expect(advance(RARE, after, caughtAt + 16, () => 0).action.type).toBe('none');
  });

  test('both exit paths leave nextAt in the future, in every lane', () => {
    for (const lane of [COMMON, RARE]) {
      const spawned = advance(lane, createSchedule(lane, 0, () => 0), lane.minMs, () => 0)
        .schedule;
      const viaTimeout = advance(lane, spawned, spawned.despawnAt, () => 0).schedule;
      const viaCatch = collect(lane, spawned.despawnAt, () => 0);
      expect(viaTimeout.nextAt).toBeGreaterThan(spawned.despawnAt);
      expect(viaCatch.nextAt).toBeGreaterThan(spawned.despawnAt);
    }
  });
});

describe('pickKind', () => {
  test('a single-kind lane always returns that kind', () => {
    expect(pickKind(COMMON, () => 0)).toBe('common');
    expect(pickKind(COMMON, () => 0.999999)).toBe('common');
  });

  test('rand=0 picks the first kind in the rare lane', () => {
    expect(pickKind(RARE, () => 0)).toBe('golden');
  });

  test('rand just under 1 picks the last kind in the rare lane', () => {
    expect(pickKind(RARE, () => 0.999999)).toBe('airdrop');
  });

  test('both rare kinds are reachable across the range', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(pickKind(RARE, () => i / 100));
    expect(seen).toEqual(new Set(['golden', 'airdrop']));
  });
});

describe('pickSkin', () => {
  test('rand=0 gives the first skin', () => {
    expect(pickSkin(() => 0)).toBe(COMMON_SKINS[0]);
  });

  test('every skin is reachable and none is undefined', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickSkin(() => i / 200));
    expect(seen).toEqual(new Set(COMMON_SKINS));
    expect(seen.has(undefined as unknown as string)).toBe(false);
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
// (lane, schedule, now, rand) so it is testable without a clock or a DOM —
// the element half lives in src/ui/findables.ts.
//
// ONE SLOT PER LANE: `active` is a single field, not a list. Lanes are
// independent so the common lane's 10-25s drip cannot crowd out the rare one.
import {
  COMMON_SKINS,
  FINDABLE_BY_ID,
  type FindableKind,
  type LaneDef,
} from './config/findables';

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

/** Epoch ms for this lane's next spawn: uniform in [min, max] after `now`. */
export function rollNextSpawn(
  lane: LaneDef,
  now: number,
  rand: () => number = Math.random,
): number {
  return now + lane.minMs + rand() * (lane.maxMs - lane.minMs);
}

export function createSchedule(
  lane: LaneDef,
  now: number,
  rand: () => number = Math.random,
): Schedule {
  return { nextAt: rollNextSpawn(lane, now, rand), active: null, despawnAt: 0 };
}

/** Weighted pick across the lane's kinds. */
export function pickKind(lane: LaneDef, rand: () => number = Math.random): FindableKind {
  const total = lane.kinds.reduce((sum, k) => sum + k.weight, 0);
  let roll = rand() * total;
  for (const k of lane.kinds) {
    roll -= k.weight;
    if (roll < 0) return k.id;
  }
  return lane.kinds[lane.kinds.length - 1].id;
}

/** Cosmetic only — which emoji a common findable wears this time. */
export function pickSkin(rand: () => number = Math.random): string {
  const i = Math.min(COMMON_SKINS.length - 1, Math.floor(rand() * COMMON_SKINS.length));
  return COMMON_SKINS[i];
}

/**
 * Clearing a slot and rolling its next spawn are ONE operation, on purpose.
 * A natural spawn fires when `now >= nextAt`, which leaves `nextAt` in the past
 * for as long as that findable is alive. Any path that clears `active` without
 * rescheduling re-enters the spawn branch on the very next frame, forever.
 * That shipped on 2026-08-20 via the tap handler and left the x7 frenzy
 * permanently active. Both exit paths below go through here.
 */
export function collect(
  lane: LaneDef,
  now: number,
  rand: () => number = Math.random,
): Schedule {
  return { nextAt: rollNextSpawn(lane, now, rand), active: null, despawnAt: 0 };
}

/** One tick of one lane. */
export function advance(
  lane: LaneDef,
  schedule: Schedule,
  now: number,
  rand: () => number = Math.random,
): { schedule: Schedule; action: FindableAction } {
  if (schedule.active) {
    if (now >= schedule.despawnAt) {
      return { schedule: collect(lane, now, rand), action: { type: 'despawn' } };
    }
    return { schedule, action: { type: 'none' } };
  }
  if (now >= schedule.nextAt) {
    const kind = pickKind(lane, rand);
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
Expected: PASS, 16 tests.

- [ ] **Step 7: Remove the moved function from its old home**

In `src/game/golden.ts`, delete `rollNextSpawn` and its now-unused imports of
`GOLDEN_MAX_INTERVAL_MS` / `GOLDEN_MIN_INTERVAL_MS`. Keep `isFrenzyActive` and
`frenzyRemainingMs` exactly as they are — frenzy is a separate mechanic and is
not moving.

In `tests/golden.test.ts`, delete the whole `describe('rollNextSpawn', ...)`
block (4 tests) and the now-unused imports of `GOLDEN_MAX_INTERVAL_MS` and
`GOLDEN_MIN_INTERVAL_MS`. Keep the `isFrenzyActive` and `frenzyRemainingMs`
blocks unchanged.

- [ ] **Step 8: Run the full suite**

Run: `cd ~/ApiScripts/dumpling-clicker && npm test`
Expected: PASS. `src/ui/golden.ts` still imports `rollNextSpawn` and
`GOLDEN_LIFETIME_MS`, so `npm run build` will fail until Task 3 — expected at
this point. `npm test` does not typecheck.

- [ ] **Step 9: Commit**

```bash
git add src/game/findables.ts src/game/config/findables.ts src/game/config/balance.ts src/game/golden.ts tests/findables.test.ts tests/golden.test.ts
git commit -m "Extract findable scheduling into pure, tested logic, in two lanes

A common lane every 10-25s and a rare lane every 3-8min, each owning one slot.
One shared slot would let the common drip starve the golden dumpling entirely.
Clearing always reschedules, which is what the catch path dropped on
2026-08-20; it is now a test rather than a comment."
```

---

### Task 2: Payouts

**Files:**
- Create: `src/game/rewards.ts`
- Create: `tests/rewards.test.ts`

**Interfaces:**
- Consumes: `FindableDef`, `FINDABLE_BY_ID` from Task 1.
- Produces: `rewardFor(kind: FindableKind, dps: number, clickValue: number): number`.

- [ ] **Step 1: Write the failing test**

Create `tests/rewards.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { rewardFor } from '../src/game/rewards';
import {
  AIRDROP_FLOOR_CLICKS,
  AIRDROP_SECONDS,
  COMMON_FLOOR_CLICKS,
  COMMON_SECONDS,
} from '../src/game/config/balance';

describe('rewardFor', () => {
  test('an airdrop pays its configured seconds of production', () => {
    expect(rewardFor('airdrop', 1_000, 1)).toBe(1_000 * AIRDROP_SECONDS);
  });

  test('a common findable pays its much smaller share', () => {
    expect(rewardFor('common', 1_000, 1)).toBe(1_000 * COMMON_SECONDS);
  });

  test('the golden dumpling pays nothing — it grants a frenzy instead', () => {
    expect(rewardFor('golden', 1_000, 1)).toBe(0);
  });

  test('scales with stage without a table', () => {
    expect(rewardFor('common', 10_000_000, 1) / rewardFor('common', 10, 1)).toBe(1_000_000);
  });

  test('falls back to the click floor when production is near zero', () => {
    expect(rewardFor('airdrop', 0.1, 1)).toBe(AIRDROP_FLOOR_CLICKS);
    expect(rewardFor('common', 0.1, 1)).toBe(COMMON_FLOOR_CLICKS);
  });

  test('the floor scales with click value, so it never goes stale', () => {
    expect(rewardFor('common', 0, 8)).toBe(8 * COMMON_FLOOR_CLICKS);
  });

  test('never returns a negative or non-finite payout', () => {
    expect(rewardFor('common', -5, -5)).toBe(0);
    expect(rewardFor('common', Number.NaN, 1)).toBe(COMMON_FLOOR_CLICKS);
    expect(rewardFor('common', Number.POSITIVE_INFINITY, 1)).toBe(COMMON_FLOOR_CLICKS);
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
import { FINDABLE_BY_ID, type FindableKind } from './config/findables';

/**
 * A payout findable is worth `payoutSeconds` of current production, floored at
 * a number of taps so it is not worthless in the first minutes when dps is ~0.
 * Both terms self-scale, so neither needs a per-stage table. Kinds with no
 * `payoutSeconds` (the golden dumpling, which grants a frenzy) pay nothing.
 */
export function rewardFor(kind: FindableKind, dps: number, clickValue: number): number {
  const def = FINDABLE_BY_ID[kind];
  if (!def?.payoutSeconds) return 0;
  const fromProduction = Number.isFinite(dps) && dps > 0 ? dps * def.payoutSeconds : 0;
  const floor =
    Number.isFinite(clickValue) && clickValue > 0
      ? clickValue * (def.floorClicks ?? 0)
      : 0;
  return Math.max(fromProduction, floor);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ~/ApiScripts/dumpling-clicker && npx vitest run tests/rewards.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/rewards.ts tests/rewards.test.ts
git commit -m "Add findable payouts: N seconds of production, floored in clicks

Both terms self-scale, so rewards stay meaningful at every stage with no
per-stage table to go stale. Derived from raw dps so a frenzy cannot multiply
them."
```

---

### Task 3: Element adapter and wiring

**Files:**
- Create: `src/ui/findables.ts`
- Delete: `src/ui/golden.ts`
- Modify: `src/main.ts` (import block, the `initGolden` call at 79-91, the loop wiring, the dev backdoor)
- Modify: `src/i18n/strings.he.ts`
- Modify: `src/styles/main.css`

**Interfaces:**
- Consumes: everything from Tasks 1 and 2.
- Produces: `initFindables(host, getAvatar, onCatch, rand?): FindablesApi` where `onCatch` is `(kind: FindableKind, x: number, y: number) => void` and `FindablesApi` is `{ tick(now: number): void; setAvatar(design: AvatarDesign): void; spawnNow(now: number, kind: FindableKind): void }`.

- [ ] **Step 1: Add the copy**

In `src/i18n/strings.he.ts`, add next to `goldenLabel`:

```ts
  airdropLabel: 'חבילת כופתאות!',
  commonLabel: 'משהו נוצץ!',
  rewardCaught: (amount: string) => `‎+${amount}`,
```

The `‎` (LRM) is required. Without it RTL bidi reorders `+1.2K` into `1.2K+`,
the same reason `gainPerSecond` carries one.

- [ ] **Step 2: Write the element adapter**

Create `src/ui/findables.ts`. It drives ONE element per lane, both children of
the stage. Port the placement maths from `src/ui/golden.ts` verbatim, including
its comments — the face-protection band and the "position with left/top, never
transform" rule are both load-bearing and were arrived at by measurement.

```ts
// The DOM half of findables: one element per lane, driven by a single tick(now)
// from the existing rAF loop — no second loop. All timing decisions come from
// game/findables.ts.
import { LANES, type FindableKind, type LaneDef } from '../game/config/findables';
import { advance, collect, createSchedule, pickSkin, type Schedule } from '../game/findables';
import { STR } from '../i18n/strings.he';
import type { AvatarDesign } from '../game/state';
import { avatarSVG } from './avatar';

const GOLD = '#f3c033';
// The fill override only reaches the body, so accessories kept their own
// colours — a "golden" squishy wearing a bright blue baseball cap. A CSS
// sepia+saturate pass pulls every layer into the same metallic range.
const GOLD_FILTER = 'sepia(0.75) saturate(2.6) hue-rotate(-12deg) brightness(1.08)';

export interface FindablesApi {
  tick(now: number): void;
  setAvatar(design: AvatarDesign): void;
  spawnNow(now: number, kind: FindableKind): void;
}

interface Lane {
  def: LaneDef;
  el: HTMLButtonElement;
  schedule: Schedule;
}

export function initFindables(
  host: HTMLElement,
  getAvatar: () => AvatarDesign,
  onCatch: (kind: FindableKind, x: number, y: number) => void,
  rand: () => number = Math.random,
): FindablesApi {
  let based = false;

  const lanes: Lane[] = LANES.map((def) => {
    const el = document.createElement('button');
    el.className = `findable findable-${def.id}`;
    el.type = 'button';
    el.hidden = true;
    host.appendChild(el);
    return { def, el, schedule: createSchedule(def, 0, rand) };
  });

  const render = (lane: Lane, kind: FindableKind) => {
    const { el } = lane;
    el.classList.remove('golden', 'airdrop', 'common');
    el.classList.add(kind);
    if (kind === 'golden') {
      el.innerHTML = avatarSVG(getAvatar(), 'golden-svg', GOLD);
      const svg = el.querySelector('svg');
      if (svg) svg.style.filter = GOLD_FILTER;
      el.setAttribute('aria-label', STR.goldenLabel);
    } else {
      const icon = kind === 'airdrop' ? '🎁' : pickSkin(rand);
      el.innerHTML = `<span class="findable-icon">${icon}</span>`;
      el.setAttribute('aria-label', kind === 'airdrop' ? STR.airdropLabel : STR.commonLabel);
    }
  };

  const place = (lane: Lane) => {
    const { el } = lane;
    // Protect the FACE, not the whole hero. On a phone the squishy is ~70% of
    // the stage width, so "never overlap the hero at all" is unachievable —
    // there is no free lane wide enough. What matters is that a findable never
    // covers the eyes/mouth or crowds the tap target, so it sits in the strip
    // above the face. Measured every spawn, because the stage is far shorter
    // in landscape than at 430x900.
    const stage = host.getBoundingClientRect();
    const heroBox = host
      .querySelector('.squish-wrap')
      ?.querySelector('svg')
      ?.getBoundingClientRect();
    const size = el.offsetWidth || stage.width * 0.2;
    const maxX = Math.max(0, stage.width - size);
    const GAP = 8;
    // The face starts ~35% down the SVG's box (eyes sit at viewBox y≈110/200,
    // and the drawn body starts at y≈26 — see bodyLayer in ui/avatar.ts).
    const faceTop =
      heroBox && heroBox.width > 0 ? heroBox.top + heroBox.height * 0.35 : stage.bottom;
    const band = Math.max(0, faceTop - GAP - size - stage.top);
    // Positioned with left/top, never transform (the bob/pop animations own it).
    el.style.insetInlineStart = 'auto';
    el.style.left = `${rand() * maxX}px`;
    el.style.top = `${band > 4 ? rand() * band : 0}px`;
  };

  const spawn = (lane: Lane, kind: FindableKind) => {
    render(lane, kind);
    lane.el.hidden = false; // must be laid out before it can be measured
    place(lane);
    // restart the entry animation
    lane.el.classList.remove('findable-in');
    void lane.el.offsetWidth;
    lane.el.classList.add('findable-in');
  };

  const hide = (lane: Lane) => {
    lane.el.hidden = true;
    lane.el.classList.remove('findable-in');
  };

  for (const lane of lanes) {
    lane.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // never let the tap reach the squishy behind it
      const kind = lane.schedule.active;
      if (!kind) return;
      const r = lane.el.getBoundingClientRect();
      const x = e.clientX || r.left + r.width / 2;
      const y = e.clientY || r.top + r.height / 2;
      // wall clock, matching the `now` the loop feeds tick()
      lane.schedule = collect(lane.def, Date.now(), rand);
      hide(lane);
      onCatch(kind, x, y);
    });
  }

  return {
    tick(now) {
      if (!based) {
        // the loop's first `now` is the real clock; rebase every lane off it once
        for (const lane of lanes) lane.schedule = createSchedule(lane.def, now, rand);
        based = true;
        return;
      }
      for (const lane of lanes) {
        const { schedule, action } = advance(lane.def, lane.schedule, now, rand);
        lane.schedule = schedule;
        if (action.type === 'spawn') spawn(lane, action.kind);
        else if (action.type === 'despawn') hide(lane);
      }
    },
    setAvatar() {
      for (const lane of lanes) {
        if (lane.schedule.active === 'golden') render(lane, 'golden');
      }
    },
    spawnNow(now, kind) {
      based = true;
      const lane = lanes.find((l) => l.def.kinds.some((k) => k.id === kind));
      if (!lane) return;
      // NOTE: this rolls nextAt forward too. The old spawnNow left it untouched,
      // which is exactly why __spawnGolden() could not reproduce the respawn
      // bug — the forced path looked healthy while the natural path was broken.
      lane.schedule = {
        nextAt: collect(lane.def, now, rand).nextAt,
        active: kind,
        despawnAt: now + lane.def.kinds.find((k) => k.id === kind)!.lifetimeMs,
      };
      spawn(lane, kind);
    },
  };
}
```

- [ ] **Step 3: Delete the old module**

```bash
git rm src/ui/golden.ts
```

- [ ] **Step 4: Wire it in main.ts**

Change the import on line 29 from `import { initGolden } from './ui/golden';`
to `import { initFindables } from './ui/findables';`, and add
`import { rewardFor } from './game/rewards';`.

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
    playGolden();
    navigator.vibrate?.([12, 40, 12]);
    if (kind === 'golden') {
      startFrenzy(state, at);
      spawnFloater(x, y, STR.frenzyStart(FRENZY_MULTIPLIER));
    } else {
      // raw dps on purpose: a frenzy must not multiply a findable payout
      const amount = rewardFor(kind, dpsOf(state), clickValue(state));
      state.dumplings += amount;
      state.totalEarned += amount;
      spawnFloater(x, y, STR.rewardCaught(formatNumber(amount)));
    }
    saveToStorage(state, at);
  },
);
```

Change the loop wiring from `tickGolden: (at) => golden.tick(at)` to
`tickGolden: (at) => findables.tick(at)`, and every other `golden.` reference
(for example the `setAvatar` call after the designer closes) to `findables.`.

Replace the dev backdoor at the bottom of the file:

```ts
if (import.meta.env.DEV) {
  // dev-only backdoor: shipping this would let anyone farm rewards from the
  // console. Vite strips the branch from the production bundle.
  const w = window as unknown as Record<string, unknown>;
  w.__spawnGolden = () => findables.spawnNow(Date.now(), 'golden');
  w.__spawnAirdrop = () => findables.spawnNow(Date.now(), 'airdrop');
  w.__spawnCommon = () => findables.spawnNow(Date.now(), 'common');
}
```

- [ ] **Step 5: Restyle**

In `src/styles/main.css`, rename the `.golden` selector block to `.findable`
and `.golden-in` to `.findable-in`, keeping every declaration and the
`golden-bob` / `golden-pop` keyframes as they are. Then add after it:

```css
/* The rare lane keeps the golden glow. */
.findable.airdrop {
  filter: drop-shadow(0 0 14px rgba(120, 200, 255, 0.75));
}

/* The common lane is small and quiet — it appears every 10-25s, so at the
   rare lane's size and glow it would dominate the screen and read as noise. */
.findable.common {
  width: 12%;
  max-width: 56px;
  min-width: 44px; /* still a real tap target */
  filter: drop-shadow(0 0 10px rgba(255, 226, 150, 0.7));
}

.findable-icon {
  font-size: 2.2rem;
  line-height: 1;
  display: block;
}

.findable.common .findable-icon {
  font-size: 1.7rem;
}
```

Update the existing `@media (prefers-reduced-motion: reduce)` block: replace
`.golden, .golden-in` with `.findable, .findable-in`.

- [ ] **Step 6: Typecheck, test and build**

Run: `cd ~/ApiScripts/dumpling-clicker && npm test && npm run build`
Expected: 118 tests PASS (99 today, minus 4 removed from `golden.test.ts`, plus
16 in `findables.test.ts` and 7 in `rewards.test.ts`), build succeeds with no
TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add two findable lanes with per-lane elements and skins

ui/golden.ts becomes ui/findables.ts: a thin adapter over the pure scheduler,
one element per lane. The common lane is small and quiet on purpose — at the
rare lane's size and glow, something appearing every 10-25s reads as noise."
```

---

### Task 4: Browser verification

**Files:**
- Create: `scratchpad/findables-drive.mjs` (throwaway, not committed)

**Interfaces:**
- Consumes: the dev server and the three `__spawn*` backdoors from Task 3.
- Produces: evidence. No code.

- [ ] **Step 1: Start the dev server**

Run: `cd ~/ApiScripts/dumpling-clicker && npm run dev`
Read the printed URL. Port drifts — 5173 is often taken by an unrelated demo.

- [ ] **Step 2: Install the driver into the scratchpad**

In the session scratchpad, never in the game's `package.json`:

```bash
npm init -y && npm i playwright-core@1.49.1
```

Browser binary:
`~/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

Context `{viewport:{width:430,height:900}, hasTouch:true, isMobile:true}`. Get
through the designer with `.designer-done`, then remove `.modal-backdrop`
before tapping anything. The handler is `pointerdown`, not `click`, so dispatch
a real `PointerEvent('pointerdown')` with `clientX`/`clientY`.

- [ ] **Step 3: Drive the common lane on its real timing**

No tuning needed — the common lane is already 10-25s. Over a 90-second run,
assert:
- between 4 and 9 common findables appear
- each disappears on its own within ~7s if untapped
- catching one raises `#hud-num` and the floater reads `+<amount>` with the
  sign on the LEFT of the digits
- catching one does NOT make another appear within 200ms (the 2026-08-20
  regression, now on the lane that fires often enough to be noticed)
- at most one common element is visible at any instant

Read floaters from `document.querySelectorAll('.floater.float-up')` — they are
a pre-allocated pool, so a MutationObserver never fires.

- [ ] **Step 4: Drive the rare lane's regression case**

Temporarily set `RARE_SPAWN_MIN_MS = 2_000` and `RARE_SPAWN_MAX_MS = 3_000` in
`src/game/config/balance.ts`. This is required: `__spawnGolden()` cannot
reproduce the respawn bug, because a forced spawn schedules `nextAt` into the
future while a natural spawn leaves it in the past. Only the natural path
exercises it.

Waiting for a NATURAL spawn, assert:
- catching one leaves that lane empty for at least 200ms afterwards
- catches in a 10-second window are in the low single digits, not the hundreds
  (expected ~4; the pre-fix number on this drive was 186)

- [ ] **Step 5: Confirm the lanes do not block each other**

With the rare lane still on the short interval, run 30 seconds and assert both
a common and a rare findable appeared. This is the whole reason for two lanes:
on a single shared slot the common drip would starve the rare one.

- [ ] **Step 6: Confirm a frenzy does not inflate a payout**

Catch a golden to start a frenzy, then immediately force a common with
`__spawnCommon()` and catch it. Its payout must equal `dps * 5` using the RAW
dps, unchanged by the active x7.

- [ ] **Step 7: Screenshot the busy state**

Force a rare and a common at once, screenshot at 430x900, and confirm by eye
that neither covers the squishy's eyes or mouth and that the squish still
responds to a tap on `.squish-hit`.

- [ ] **Step 8: Revert the test tuning**

Run: `cd ~/ApiScripts/dumpling-clicker && git checkout src/game/config/balance.ts`
Confirm: `grep -n "RARE_SPAWN" src/game/config/balance.ts` shows the 3-minute
and 8-minute values.

- [ ] **Step 9: Final check and push**

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

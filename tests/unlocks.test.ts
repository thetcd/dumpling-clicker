import { describe, expect, test } from 'vitest';
import {
  isPartUnlocked,
  partsUnlockedAt,
  unlockLevel,
  unlockedCount,
} from '../src/game/unlocks';
import { ACCESSORIES, BODY_COLORS, EYES, MOUTHS } from '../src/game/config/parts';

describe('isPartUnlocked', () => {
  test('an ungated part is always choosable', () => {
    expect(isPartUnlocked({ id: 'bow', nameHe: '' }, 0)).toBe(true);
  });

  test('a gated part needs the prestige level', () => {
    const part = { id: 'scarf', nameHe: '', unlockAtPrestige: 4 };
    expect(isPartUnlocked(part, 3)).toBe(false);
    expect(isPartUnlocked(part, 4)).toBe(true);
    expect(isPartUnlocked(part, 9)).toBe(true);
  });

  test('what you are already wearing is always choosable, even if locked', () => {
    // a save made before the part was gated must not become unselectable, and
    // reopening the designer must never silently strip the current look
    const part = { id: 'chef', nameHe: '', unlockAtPrestige: 5 };
    expect(isPartUnlocked(part, 0)).toBe(false);
    expect(isPartUnlocked(part, 0, 'chef')).toBe(true);
  });

  test('a junk prestige value locks rather than unlocks', () => {
    const part = { id: 'scarf', nameHe: '', unlockAtPrestige: 4 };
    expect(isPartUnlocked(part, Number.NaN)).toBe(false);
    expect(isPartUnlocked(part, -3)).toBe(false);
  });
});

describe('the accessory ladder', () => {
  test('run 1 still offers a real choice, not an empty row', () => {
    // "lock some, not everything" — the designer is the first screen anyone
    // sees, and emptying it makes run 1 look like the whole game
    const free = unlockedCount(ACCESSORIES, 0);
    expect(free).toBeGreaterThanOrEqual(4);
    expect(free).toBeLessThan(ACCESSORIES.length);
  });

  test('"none" is never locked, or a new player could be stuck', () => {
    const none = ACCESSORIES.find((a) => a.id === 'none')!;
    expect(isPartUnlocked(none, 0)).toBe(true);
  });

  test('rewards thin out as runs lengthen', () => {
    // runs pass an hour around rank 20, so unlocks spread out past it rather
    // than demanding one every rank forever
    const all = [...BODY_COLORS, ...EYES, ...MOUTHS, ...ACCESSORIES];
    const early = all.filter((p) => unlockLevel(p) > 0 && unlockLevel(p) <= 20).length;
    const late = all.filter((p) => unlockLevel(p) > 20).length;
    expect(early).toBeGreaterThan(late);
  });

  test('every category keeps a real choice at rank 0', () => {
    // "lock some, not everything" applies per category — a designer with one
    // eye option is not a designer
    for (const [name, parts] of [
      ['colours', BODY_COLORS],
      ['eyes', EYES],
      ['mouths', MOUTHS],
      ['accessories', ACCESSORIES],
    ] as const) {
      const free = unlockedCount(parts as never, 0);
      expect(free, `${name} free at rank 0`).toBeGreaterThanOrEqual(5);
      expect(free, `${name} all free`).toBeLessThan(parts.length);
    }
  });

  test('every rank from 1 to 20 unlocks something', () => {
    // the early ranks are minutes apart, so each one has to hand over a reward
    const all = [...BODY_COLORS, ...EYES, ...MOUTHS, ...ACCESSORIES];
    const levels = new Set(all.map(unlockLevel).filter((n) => n > 0));
    for (let i = 1; i <= 20; i++) {
      expect(levels.has(i), `nothing unlocks at rank ${i}`).toBe(true);
    }
  });

  test('no rank has to carry two unlocks from the same category', () => {
    // interleaved on purpose: two colours in a row reads as one reward
    for (const parts of [BODY_COLORS, EYES, MOUTHS, ACCESSORIES]) {
      const levels = parts.map(unlockLevel).filter((n) => n > 0);
      expect(new Set(levels).size).toBe(levels.length);
    }
  });

  test('the whole wardrobe is open by rank 40', () => {
    const all = [...BODY_COLORS, ...EYES, ...MOUTHS, ...ACCESSORIES];
    expect(all.every((p) => unlockLevel(p) <= 40)).toBe(true);
  });
});

describe('partsUnlockedAt', () => {
  test('returns the parts whose gate is exactly this rank', () => {
    // peach is the rank-2 colour in the shipped ladder
    const opened = partsUnlockedAt(2);
    expect(opened.map((p) => p.id)).toContain('peach');
    expect(opened.every((p) => unlockLevel(p) === 2)).toBe(true);
  });

  test('a rank that opens nothing returns an empty list', () => {
    const all = [...BODY_COLORS, ...EYES, ...MOUTHS, ...ACCESSORIES];
    const gated = new Set(all.map(unlockLevel));
    const quiet = [21, 23, 25].find((n) => !gated.has(n))!;
    expect(partsUnlockedAt(quiet)).toEqual([]);
  });

  test('rank 0 is not a reward — free parts are not "newly unlocked"', () => {
    expect(partsUnlockedAt(0)).toEqual([]);
  });

  test('every gated part is announced at exactly one rank', () => {
    const all = [...BODY_COLORS, ...EYES, ...MOUTHS, ...ACCESSORIES];
    const gatedCount = all.filter((p) => unlockLevel(p) > 0).length;
    let announced = 0;
    for (let rank = 1; rank <= 40; rank++) announced += partsUnlockedAt(rank).length;
    expect(announced).toBe(gatedCount);
  });
});

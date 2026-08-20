import { describe, expect, test } from 'vitest';
import { isPartUnlocked, unlockLevel, unlockedCount } from '../src/game/unlocks';
import { ACCESSORIES, EYES, MOUTHS } from '../src/game/config/parts';

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

  test('every locked accessory opens at a reachable level', () => {
    for (const a of ACCESSORIES) {
      expect(unlockLevel(a), a.id).toBeLessThanOrEqual(6);
      expect(unlockLevel(a), a.id).toBeGreaterThanOrEqual(0);
    }
  });

  test('the ladder has no gaps — every level from 1 to 6 opens something', () => {
    const levels = new Set(ACCESSORIES.map(unlockLevel).filter((n) => n > 0));
    for (let i = 1; i <= 6; i++) {
      expect(levels.has(i), `nothing unlocks at prestige ${i}`).toBe(true);
    }
  });

  test('everything is open by the final prestige', () => {
    expect(unlockedCount(ACCESSORIES, 6)).toBe(ACCESSORIES.length);
  });

  test('eyes and mouths stay free — only accessories are gated', () => {
    expect(unlockedCount(EYES, 0)).toBe(EYES.length);
    expect(unlockedCount(MOUTHS, 0)).toBe(MOUTHS.length);
  });
});

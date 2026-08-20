import { describe, expect, test } from 'vitest';
import { burstSpec, sceneSprites, spritesFor } from '../src/game/scene';
import {
  SCENE_BAND_BOTTOM,
  SCENE_BAND_TOP,
  SCENE_MAX_PER_TIER,
  SCENE_MAX_SPRITES,
  SCENE_TIERS_SHOWN,
} from '../src/game/config/scene';
import { PRODUCERS } from '../src/game/config/producers';

describe('spritesFor', () => {
  test('owning none shows none', () => {
    expect(spritesFor(0)).toBe(0);
  });

  test('grows logarithmically so early purchases are visible', () => {
    expect(spritesFor(1)).toBe(1);
    expect(spritesFor(3)).toBe(2);
    expect(spritesFor(4)).toBe(3);
    expect(spritesFor(16)).toBe(5);
  });

  test('never exceeds the per-tier cap however many you own', () => {
    expect(spritesFor(1_000_000)).toBe(SCENE_MAX_PER_TIER);
  });

  test('junk input shows nothing rather than throwing', () => {
    expect(spritesFor(-5)).toBe(0);
    expect(spritesFor(Number.NaN)).toBe(0);
    expect(spritesFor(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('sceneSprites', () => {
  test('a fresh game has an empty scene', () => {
    expect(sceneSprites({})).toEqual([]);
  });

  test('owning one producer puts it on screen', () => {
    const s = sceneSprites({ apprentice: 1 });
    expect(s).toHaveLength(1);
    expect(s[0].icon).toBe(PRODUCERS[0].icon);
  });

  test('only the highest owned tiers show, so the world evolves', () => {
    const all: Record<string, number> = {};
    for (const p of PRODUCERS) all[p.id] = 1;
    const tiers = new Set(sceneSprites(all).map((s) => s.tierId));
    expect(tiers.size).toBe(SCENE_TIERS_SHOWN);
    // the ones kept are the last tiers in the table, not the first
    expect(tiers.has('boss')).toBe(true);
    expect(tiers.has('apprentice')).toBe(false);
  });

  test('never exceeds the total sprite cap', () => {
    const all: Record<string, number> = {};
    for (const p of PRODUCERS) all[p.id] = 500;
    expect(sceneSprites(all).length).toBeLessThanOrEqual(SCENE_MAX_SPRITES);
  });

  test('the cap keeps the highest tiers, not the lowest', () => {
    const all: Record<string, number> = {};
    for (const p of PRODUCERS) all[p.id] = 500;
    const tiers = sceneSprites(all).map((s) => s.tierId);
    expect(tiers).toContain('boss');
    expect(tiers).not.toContain('apprentice');
  });

  test('is deterministic — the same state renders the same scene', () => {
    const state = { stall: 6, bakery: 2 };
    expect(sceneSprites(state)).toEqual(sceneSprites(state));
  });

  test('buying more does not move the sprites already on screen', () => {
    // the whole reason positions are hashed rather than random: a re-roll on
    // every purchase would teleport the entire crowd
    const before = sceneSprites({ stall: 4, bakery: 1 });
    const after = sceneSprites({ stall: 4, bakery: 2 });
    for (const b of before) {
      const match = after.find((a) => a.key === b.key);
      if (!match) continue;
      expect(match.xPct).toBe(b.xPct);
      expect(match.yPct).toBe(b.yPct);
    }
  });

  test('every sprite lands on screen with sane values', () => {
    const all: Record<string, number> = {};
    for (const p of PRODUCERS) all[p.id] = 40;
    for (const s of sceneSprites(all)) {
      expect(s.xPct).toBeGreaterThanOrEqual(0);
      expect(s.xPct).toBeLessThanOrEqual(100);
      expect(s.yPct).toBeGreaterThanOrEqual(0);
      expect(s.yPct).toBeLessThanOrEqual(100);
      expect(s.scale).toBeGreaterThan(0);
      expect(s.opacity).toBeGreaterThan(0);
      expect(s.opacity).toBeLessThanOrEqual(1);
      expect(Number.isFinite(s.durationMs)).toBe(true);
      expect(s.durationMs).toBeGreaterThan(0);
    }
  });

  test('stays in the readable band above the hero', () => {
    // the squishy covers the middle of the stage; sprites placed there are
    // simply invisible, which was the state before the band was clamped
    const all: Record<string, number> = {};
    for (const p of PRODUCERS) all[p.id] = 40;
    for (const s of sceneSprites(all)) {
      expect(s.yPct).toBeGreaterThanOrEqual(SCENE_BAND_TOP);
      expect(s.yPct).toBeLessThanOrEqual(SCENE_BAND_BOTTOM);
    }
  });

  test('keys are unique, so DOM reuse cannot collide', () => {
    const all: Record<string, number> = {};
    for (const p of PRODUCERS) all[p.id] = 40;
    const keys = sceneSprites(all).map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('burstSpec', () => {
  test('throws the art you actually caught, so theming is free', () => {
    const parts = burstSpec('gem', 6, () => 0.5);
    expect(parts).toHaveLength(6);
    expect(parts.every((p) => p.icon === 'gem')).toBe(true);
  });

  test('particles fall, so the eye follows them down the scene', () => {
    for (const p of burstSpec('coin', 20, Math.random)) {
      expect(p.dy).toBeGreaterThan(0);
    }
  });

  test('every value is finite', () => {
    for (const p of burstSpec('star', 20, Math.random)) {
      expect(Number.isFinite(p.dx)).toBe(true);
      expect(Number.isFinite(p.dy)).toBe(true);
      expect(Number.isFinite(p.rot)).toBe(true);
      expect(p.scale).toBeGreaterThan(0);
      expect(p.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  test('a zero or negative count produces nothing rather than throwing', () => {
    expect(burstSpec('coin', 0)).toEqual([]);
    expect(burstSpec('coin', -3)).toEqual([]);
  });
});

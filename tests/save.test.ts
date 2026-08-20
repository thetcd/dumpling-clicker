import { describe, expect, test } from 'vitest';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState, SAVE_VERSION } from '../src/game/state';

describe('serialize/deserialize round trip', () => {
  test('a state survives the round trip intact', () => {
    const s = createInitialState(123);
    s.dumplings = 42.5;
    s.producers = { apprentice: 3 };
    s.upgrades = ['fast-fingers'];
    s.avatar = { color: 'matcha', eyes: 'star', mouth: 'cat', accessory: 'bow' };
    s.designed = true;
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
  });
});

describe('deserialize hostile input', () => {
  test('corrupt JSON returns null', () => {
    expect(deserialize('{not json')).toBeNull();
  });

  test('valid JSON that is not a save returns null', () => {
    expect(deserialize('"hello"')).toBeNull();
    expect(deserialize('[1,2,3]')).toBeNull();
    expect(deserialize('{"foo": 1}')).toBeNull();
  });

  test('a save from a NEWER version than this build returns null', () => {
    const future = { ...createInitialState(0), version: SAVE_VERSION + 1 };
    expect(deserialize(JSON.stringify(future))).toBeNull();
  });

  test('missing fields are healed with defaults, not crashes', () => {
    const minimal = JSON.stringify({ version: 1, savedAt: 50, dumplings: 10 });
    const s = deserialize(minimal);
    expect(s).not.toBeNull();
    expect(s!.dumplings).toBe(10);
    expect(s!.producers).toEqual({});
    expect(s!.upgrades).toEqual([]);
    expect(s!.settings.sound).toBe(true);
    expect(s!.avatar.color).toBeTypeOf('string');
  });

  test('a pre-frenzy save loads without loss and starts with no frenzy', () => {
    // The exact shape shipped before the golden dumpling existed. This must
    // keep working: bumping SAVE_VERSION without registering a migration would
    // make deserialize() return null here and wipe every player's save.
    const v1 = JSON.stringify({
      version: 1,
      savedAt: 1_000,
      dumplings: 12_345,
      totalEarned: 99_999,
      producers: { apprentice: 3, stall: 2 },
      upgrades: ['fast-fingers', 'silk-gloves'],
      avatar: { color: 'matcha', eyes: 'star', mouth: 'cat', accessory: 'bow' },
      designed: true,
      settings: { sound: false },
      stats: { totalClicks: 500, playtimeMs: 60_000, createdAt: 10 },
    });
    const s = deserialize(v1);
    expect(s).not.toBeNull();
    expect(s!.dumplings).toBe(12_345);
    expect(s!.producers).toEqual({ apprentice: 3, stall: 2 });
    expect(s!.upgrades).toEqual(['fast-fingers', 'silk-gloves']);
    expect(s!.avatar.eyes).toBe('star');
    expect(s!.frenzyUntil).toBe(0);
  });

  test('a garbage frenzyUntil is healed rather than trusted', () => {
    for (const bad of ['"soon"', 'null', '1e999', 'true']) {
      const raw = `{"version":1,"savedAt":1,"dumplings":1,"frenzyUntil":${bad}}`;
      const s = deserialize(raw);
      expect(s, `frenzyUntil ${bad}`).not.toBeNull();
      expect(Number.isFinite(s!.frenzyUntil), `frenzyUntil ${bad}`).toBe(true);
    }
  });

  test('non-finite numbers are rejected (NaN/Infinity cheats or corruption)', () => {
    const bad = { ...createInitialState(0), dumplings: Number.POSITIVE_INFINITY };
    // JSON.stringify turns Infinity into null — craft it manually
    const raw = serialize(createInitialState(0)).replace(
      '"dumplings":0',
      '"dumplings":1e999',
    );
    expect(raw).toContain('1e999');
    const s = deserialize(raw);
    expect(s).not.toBeNull();
    expect(Number.isFinite(s!.dumplings)).toBe(true);
    void bad;
  });
});

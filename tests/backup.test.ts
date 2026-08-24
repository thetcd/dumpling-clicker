// The save backup code: serialize → base64 → clipboard, paste to restore.
// This is the only rescue path a save has — iOS Safari evicts localStorage
// after ~7 days away — so import must be forgiving about what messaging apps
// do to a pasted string (surrounding whitespace, inserted line breaks) and
// must never produce a state the game can't run on (it heals through
// deserialize(), same as loading from storage).
import { describe, expect, it } from 'vitest';
import { exportCode, importCode, BACKUP_PREFIX } from '../src/game/backup';
import { serialize } from '../src/game/save';
import { createInitialState, SAVE_VERSION } from '../src/game/state';

function richState() {
  const s = createInitialState(1_700_000_000_000);
  s.dumplings = 123_456.78;
  s.totalEarned = 999_999;
  s.runEarned = 42_000;
  s.prestige = 7;
  s.producers = { apprentice: 12, stall: 3, boss: 1 };
  s.upgrades = ['soft-paws', 'grandma-hands'];
  s.avatar = { color: 'charcoal', eyes: 'shekel', mouth: 'grin', accessory: 'crown' };
  s.designed = true;
  s.stats.totalClicks = 555;
  return s;
}

describe('exportCode', () => {
  it('round-trips every gameplay field', () => {
    const s = richState();
    const back = importCode(exportCode(s));
    expect(back).not.toBeNull();
    expect(back!.dumplings).toBe(s.dumplings);
    expect(back!.totalEarned).toBe(s.totalEarned);
    expect(back!.runEarned).toBe(s.runEarned);
    expect(back!.prestige).toBe(s.prestige);
    expect(back!.producers).toEqual(s.producers);
    expect(back!.upgrades).toEqual(s.upgrades);
    expect(back!.avatar).toEqual(s.avatar);
    expect(back!.designed).toBe(true);
    expect(back!.stats.totalClicks).toBe(555);
  });

  it('is one line of ASCII with the recognizable prefix', () => {
    const code = exportCode(richState());
    expect(code.startsWith(BACKUP_PREFIX)).toBe(true);
    // clipboard-safe: no whitespace, nothing outside printable ASCII, and no
    // HTML-active characters (the restore textarea is filled via innerHTML)
    expect(code).toMatch(/^[A-Za-z0-9+/=:.-]+$/);
  });
});

describe('importCode', () => {
  it('forgives surrounding whitespace and inserted line breaks', () => {
    const code = exportCode(richState());
    const mangled = `  ${code.slice(0, 40)}\n${code.slice(40, 100)} \n ${code.slice(100)}\n`;
    expect(importCode(mangled)?.prestige).toBe(7);
  });

  it('accepts a code with the prefix stripped', () => {
    const code = exportCode(richState());
    expect(importCode(code.slice(BACKUP_PREFIX.length))?.prestige).toBe(7);
  });

  it('returns null on garbage, not-base64, and non-JSON payloads', () => {
    expect(importCode('')).toBeNull();
    expect(importCode('hello there')).toBeNull();
    expect(importCode(`${BACKUP_PREFIX}%%%not-base64%%%`)).toBeNull();
    expect(importCode(btoa('not json at all'))).toBeNull();
    expect(importCode(btoa('[1,2,3]'))).toBeNull();
  });

  it('rejects a save from a newer build instead of guessing', () => {
    const raw = JSON.stringify({ ...JSON.parse(serialize(richState())), version: SAVE_VERSION + 1 });
    expect(importCode(btoa(raw))).toBeNull();
  });

  it('heals a sparse payload the way loading from storage does', () => {
    // an old or hand-trimmed code: valid version, everything else missing
    const back = importCode(btoa(JSON.stringify({ version: 1, dumplings: 50 })));
    expect(back).not.toBeNull();
    expect(back!.dumplings).toBe(50);
    expect(back!.prestige).toBe(0);
    expect(back!.producers).toEqual({});
    expect(back!.settings.sound).toBe(true);
  });
});

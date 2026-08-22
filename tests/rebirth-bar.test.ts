import { describe, expect, test } from 'vitest';
import { rebirthMeterLabel } from '../src/ui/rebirth';
import { REBIRTH_BASE, REBIRTH_MAX } from '../src/game/config/balance';
import { createInitialState, type GameState } from '../src/game/state';
import { STR } from '../src/i18n/strings.he';

const at = (prestige: number, runEarned: number): GameState => {
  const s = createInitialState(0);
  s.prestige = prestige;
  s.runEarned = runEarned;
  return s;
};

/**
 * Dor, 2026-08-22: "the bottom meter, show how much exp did the user earn out
 * of how much for rebirth like 1k/3.5k" — and then, explicitly: this is the
 * rebirth EXP, not the game's currency, so it carries no ₪ and no label.
 *
 * Calling it exp rather than shekels is also the more honest name: `runEarned`
 * only ever accumulates, so spending in the shop never lowers this bar. A
 * player told the bar was shekels would expect it to drop when they buy
 * something.
 */
describe('rebirthMeterLabel', () => {
  test('reads earned out of needed', () => {
    expect(rebirthMeterLabel(at(0, 1_200))).toBe('1,200 / 3,000');
  });

  test('carries no currency mark and no label — exp is not shekels', () => {
    const label = rebirthMeterLabel(at(0, 1_200));
    expect(label).not.toContain('₪');
    expect(label).not.toContain(STR.dumplings);
  });

  test('starts at zero rather than blank', () => {
    expect(rebirthMeterLabel(at(0, 0))).toBe('0 / 3,000');
  });

  test('never shows more earned than needed', () => {
    // overshooting between frames must not render "4,100 / 3,000", which reads
    // like the button should already have fired
    expect(rebirthMeterLabel(at(0, REBIRTH_BASE * 2))).toBe('3,000 / 3,000');
  });

  test('uses the same big-number words as the rest of the game', () => {
    const label = rebirthMeterLabel(at(20, 5_000_000));
    expect(label).toContain('מיליון');
    expect(label).toContain('/');
  });

  test('at the cap it says so instead of showing a target that does not exist', () => {
    expect(rebirthMeterLabel(at(REBIRTH_MAX, 999))).toBe(STR.rebirthMaxed);
    expect(rebirthMeterLabel(at(REBIRTH_MAX, 999))).not.toContain('/');
  });

  test('the rank right below the cap still shows a target', () => {
    expect(rebirthMeterLabel(at(REBIRTH_MAX - 1, 0))).toContain('/');
  });

  test('junk state degrades to zero rather than NaN', () => {
    expect(rebirthMeterLabel(at(0, Number.NaN))).toBe('0 / 3,000');
    expect(rebirthMeterLabel(at(0, -50))).toBe('0 / 3,000');
  });
});

describe('the rank readout', () => {
  test('shows the cap, the way a Roblox simulator does', () => {
    expect(STR.rebirthLevel(12, REBIRTH_MAX)).toBe('לידה מחדש 12/50');
  });
});

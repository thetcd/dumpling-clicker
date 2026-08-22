import { describe, expect, test } from 'vitest';
import { STR } from '../src/i18n/strings.he';

/**
 * Caught on the live site 2026-08-22, on the very first screen: after one tap
 * the HUD read "1 שקלים". Hebrew takes the singular at one — "1 שקלים" is wrong
 * the way "1 shekels" is wrong — and this is the first sentence a new player
 * reads, one tap in. Same class of bug as the rebirth keep-list.
 */
describe('the currency unit agrees with its number', () => {
  test('one is singular', () => {
    expect(STR.currencyUnit(1)).toBe('שקל');
  });

  test('everything else is plural', () => {
    expect(STR.currencyUnit(0)).toBe('שקלים');
    expect(STR.currencyUnit(2)).toBe('שקלים');
    expect(STR.currencyUnit(1_000_000)).toBe('שקלים');
  });

  test('a fraction on its way to one is still plural', () => {
    // the HUD floors, so 1.4 displays as "1" and must read שקל
    expect(STR.currencyUnit(1.4)).toBe('שקל');
    expect(STR.currencyUnit(0.5)).toBe('שקלים');
  });

  test('junk never renders as undefined', () => {
    expect(STR.currencyUnit(Number.NaN)).toBe('שקלים');
    expect(STR.currencyUnit(-3)).toBe('שקלים');
  });
});

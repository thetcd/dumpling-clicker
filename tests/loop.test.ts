import { describe, expect, test } from 'vitest';
import { creditableGapMs } from '../src/game/loop';
import { MAX_TICK_DT_MS } from '../src/game/config/balance';

/**
 * Dor, 2026-08-21: "if the game is in the background, you dont passively get
 * stuff — the window must be open."
 *
 * rAF stops firing on a hidden tab, so a backgrounded PWA hands the next frame
 * one enormous `dt`. The loop used to settle that whole gap at full production
 * rate (capped at 8h), which paid for exactly the time away Dor wants unpaid.
 */
describe('creditableGapMs', () => {
  test('a normal frame is credited in full', () => {
    expect(creditableGapMs(16)).toBe(16);
    expect(creditableGapMs(250)).toBe(250);
  });

  test('a gap up to the tick clamp is credited in full', () => {
    expect(creditableGapMs(MAX_TICK_DT_MS)).toBe(MAX_TICK_DT_MS);
  });

  test('a gap longer than the clamp earns nothing at all', () => {
    // this is the whole change: it used to credit up to eight hours here
    expect(creditableGapMs(MAX_TICK_DT_MS + 1)).toBe(0);
    expect(creditableGapMs(60_000)).toBe(0);
    expect(creditableGapMs(8 * 60 * 60 * 1000)).toBe(0);
  });

  test('a negative or junk gap earns nothing rather than draining the clock', () => {
    expect(creditableGapMs(-100)).toBe(0);
    expect(creditableGapMs(Number.NaN)).toBe(0);
    expect(creditableGapMs(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

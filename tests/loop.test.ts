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
    expect(creditableGapMs(16, true)).toBe(16);
    expect(creditableGapMs(250, true)).toBe(250);
  });

  test('a gap up to the tick clamp is credited in full', () => {
    expect(creditableGapMs(MAX_TICK_DT_MS, true)).toBe(MAX_TICK_DT_MS);
  });

  test('a gap longer than the clamp earns nothing at all', () => {
    // this is the whole change: it used to credit up to eight hours here
    expect(creditableGapMs(MAX_TICK_DT_MS + 1, true)).toBe(0);
    expect(creditableGapMs(60_000, true)).toBe(0);
    expect(creditableGapMs(8 * 60 * 60 * 1000, true)).toBe(0);
  });

  test('a negative or junk gap earns nothing rather than draining the clock', () => {
    expect(creditableGapMs(-100, true)).toBe(0);
    expect(creditableGapMs(Number.NaN, true)).toBe(0);
    expect(creditableGapMs(Number.POSITIVE_INFINITY, true)).toBe(0);
  });
});

describe('a window that is not on screen earns nothing', () => {
  /**
   * Dor, 2026-08-22: "not only closing the app, but also minimizing should not
   * give you passive income."
   *
   * Measured before the fix: a backgrounded window kept earning the FULL
   * 1,400/sec. The dt clamp was the only guard, and browsers throttle a
   * background tab's requestAnimationFrame to roughly 1Hz — so every throttled
   * frame arrived with dt about 1000ms, passed `dt <= MAX_TICK_DT_MS`, and paid
   * out a full second of production. The clamp was never a visibility test; it
   * is a stutter guard that happened to look like one.
   */
  test('a perfectly normal frame earns nothing while hidden', () => {
    expect(creditableGapMs(16, false)).toBe(0);
    expect(creditableGapMs(250, false)).toBe(0);
  });

  test('the throttled-background frame that leaked earns nothing', () => {
    // exactly the case that passed the old clamp
    expect(creditableGapMs(MAX_TICK_DT_MS, false)).toBe(0);
    expect(creditableGapMs(1_000, false)).toBe(0);
  });

  test('coming back does not pay for the time away', () => {
    expect(creditableGapMs(30 * 60 * 1000, false)).toBe(0);
    expect(creditableGapMs(30 * 60 * 1000, true)).toBe(0);
  });
});

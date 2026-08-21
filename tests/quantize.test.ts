import { describe, expect, test } from 'vitest';
import { roundToDisplay } from '../src/game/quantize';
import { formatNumber } from '../src/ui/format';
import { costOf } from '../src/game/economy';
import { PRODUCERS } from '../src/game/config/producers';
import { rebirthRequirement } from '../src/game/rebirth';

describe('roundToDisplay', () => {
  test('leaves small whole numbers alone', () => {
    expect(roundToDisplay(15)).toBe(15);
    expect(roundToDisplay(100)).toBe(100);
    expect(roundToDisplay(999)).toBe(999);
  });

  test('rounds a fractional small cost to a whole number', () => {
    expect(roundToDisplay(17.25)).toBe(17);
    expect(roundToDisplay(19.86)).toBe(20);
  });

  test('never rounds a positive price down to free', () => {
    expect(roundToDisplay(0.2)).toBe(1);
  });

  test('keeps three significant digits from a thousand up', () => {
    expect(roundToDisplay(723_451)).toBe(723_000);
    expect(roundToDisplay(1_234)).toBe(1_230);
    expect(roundToDisplay(12_345)).toBe(12_300);
  });

  test('rounds to a one-decimal mantissa from a million up', () => {
    expect(roundToDisplay(5_143_556_201)).toBe(5_100_000_000);
    expect(roundToDisplay(5_143_556)).toBe(5_100_000);
    expect(roundToDisplay(12_345_678)).toBe(12_300_000);
    expect(roundToDisplay(123_456_789)).toBe(123_500_000);
  });

  test('carries into the next scale word rather than printing 1000 of the old one', () => {
    expect(roundToDisplay(999_990_000)).toBe(1_000_000_000);
  });

  test('rounds to a two-decimal mantissa once the scale words run out', () => {
    expect(roundToDisplay(1.74235e18)).toBe(1.74e18);
  });

  test('guards non-finite and negative input', () => {
    expect(roundToDisplay(Number.NaN)).toBe(0);
    expect(roundToDisplay(Number.POSITIVE_INFINITY)).toBe(0);
    expect(roundToDisplay(-5)).toBe(0);
    expect(roundToDisplay(0)).toBe(0);
  });

  // The whole point: what the shop charges IS what the shop printed. A player
  // told they need 5.1B must be able to buy at 5.1B, not at 5.14235B.
  test('round-trips through formatNumber for every scale', () => {
    for (const n of [
      17, 999, 1_234, 723_451, 5_143_556, 12_345_678, 123_456_789, 5_143_556_201,
      7.7e12, 1.74235e18,
    ]) {
      const rounded = roundToDisplay(n);
      expect(formatNumber(rounded)).toBe(formatNumber(roundToDisplay(rounded)));
      // and the displayed string parses back to the charged amount
      expect(roundToDisplay(rounded)).toBe(rounded);
    }
  });
});

describe('quantized prices stay ordered', () => {
  // A quantization step is at most 5% (a one-decimal mantissa at mantissa 1.0)
  // and the cost curve grows 15% per unit, so rounding can never make the next
  // unit cost the same as — or less than — the one before it.
  test('every producer gets strictly more expensive with each unit owned', () => {
    for (const def of PRODUCERS) {
      let prev = 0;
      for (let owned = 0; owned < 250; owned++) {
        const cost = costOf(def, owned);
        expect(cost).toBeGreaterThan(prev);
        prev = cost;
      }
    }
  });

  test('every producer cost is already display-rounded', () => {
    for (const def of PRODUCERS) {
      for (let owned = 0; owned < 60; owned++) {
        const cost = costOf(def, owned);
        expect(roundToDisplay(cost)).toBe(cost);
      }
    }
  });

  test('every rebirth requirement is display-rounded and strictly rising', () => {
    let prev = 0;
    for (let n = 0; n < 60; n++) {
      const need = rebirthRequirement(n);
      expect(roundToDisplay(need)).toBe(need);
      expect(need).toBeGreaterThan(prev);
      prev = need;
    }
  });
});

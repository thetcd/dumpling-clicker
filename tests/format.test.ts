import { describe, expect, test } from 'vitest';
import { formatNumber, formatRate } from '../src/ui/format';

describe('formatNumber', () => {
  test('small integers render as plain digits', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(999)).toBe('999');
  });

  test('fractional balances floor to whole dumplings', () => {
    expect(formatNumber(41.7)).toBe('41');
  });

  test('thousands get grouping separators', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(999_999)).toBe('999,999');
  });

  test('a million and up use Hebrew compact words', () => {
    expect(formatNumber(1_000_000)).toContain('מיליון');
    expect(formatNumber(2_500_000)).toContain('מיליון');
    expect(formatNumber(3_000_000_000)).toContain('מיליארד');
  });

  test('compact form keeps a sensible mantissa', () => {
    expect(formatNumber(2_500_000)).toContain('2.5');
    expect(formatNumber(1_000_000)).toContain('1');
  });

  test('trillions still read as a Hebrew word', () => {
    expect(formatNumber(1.234e12)).toContain('טריליון');
  });

  test('above a trillion never degrades into "1000 טריליון"', () => {
    // Intl compact-long tops out at טריליון and then just scales the mantissa,
    // so 1e15 renders "1000 טריליון" and 1e24 "1,000,000,000,000 טריליון".
    for (const n of [1e15, 1e18, 1.7e18, 1e21, 1e24, 1e30]) {
      const out = formatNumber(n);
      expect(out, `${n.toExponential()} -> ${out}`).not.toMatch(/^\D*[\d,]{4,}/);
      expect(out, `${n.toExponential()} -> ${out}`).not.toContain(',000 ');
    }
  });

  test('very large values stay short enough for a HUD pill', () => {
    for (const n of [1e15, 1.7e18, 1e24, 1e60, Number.MAX_VALUE]) {
      expect(formatNumber(n).length, formatNumber(n)).toBeLessThanOrEqual(14);
    }
  });

  test('non-finite values never reach the screen as NaN or Infinity', () => {
    expect(formatNumber(NaN)).not.toContain('NaN');
    expect(formatNumber(Number.POSITIVE_INFINITY)).not.toContain('Infinity');
    expect(formatNumber(Number.POSITIVE_INFINITY)).not.toContain('∞');
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(-5)).toBe('0'); // balances are never negative
  });
});

describe('formatRate', () => {
  test('sub-1 rates keep enough precision to be meaningful', () => {
    // formatNumber floors, so a 0.15/sec producer rendered as a flat "0".
    expect(formatRate(0.15)).toBe('0.15');
    expect(formatRate(0.5)).toBe('0.5');
  });

  test('small rates show one decimal, not a misleading whole number', () => {
    expect(formatRate(1.5)).toBe('1.5');
    expect(formatRate(8)).toBe('8');
  });

  test('large rates fall back to the compact scheme', () => {
    expect(formatRate(1_000_000)).toContain('מיליון');
    expect(formatRate(47)).toBe('47');
  });

  test('never renders a bare 0 for a non-zero rate', () => {
    for (const n of [0.01, 0.05, 0.1, 0.15, 0.99]) {
      expect(formatRate(n), `${n}`).not.toBe('0');
    }
  });

  test('zero and garbage are safe', () => {
    expect(formatRate(0)).toBe('0');
    expect(formatRate(NaN)).toBe('0');
    expect(formatRate(-3)).toBe('0');
  });
});

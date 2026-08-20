// Hebrew number formatting for the HUD and shop. The one place that knows how
// big numbers look — swapping the scheme (e.g. to K/M) is a change to this file only.
const plain = new Intl.NumberFormat('he');
const compact = new Intl.NumberFormat('he', {
  notation: 'compact',
  compactDisplay: 'long',
  maximumFractionDigits: 1,
});
const mantissa = new Intl.NumberFormat('he', { maximumFractionDigits: 2 });

// Intl's compact-long scale stops at טריליון (1e12): past that it keeps the
// word and inflates the mantissa, so 1e15 comes out "1000 טריליון" and 1e24
// "1,000,000,000,000 טריליון". The boss tier alone is 1.6M/s per unit, so a
// player crosses 1e12 in a day — this is reachable, not theoretical. Above the
// last real word we switch to short scientific notation instead.
const COMPACT_CEILING = 1e15;

/**
 * Rates, not balances. formatNumber floors, which turned the apprentice's
 * 0.15/sec into a flat "0" — so a per-second figure needs real precision at the
 * small end and the compact words at the large end.
 */
export function formatRate(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 10) {
    const fixed = n.toFixed(n < 1 ? 2 : 1);
    return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  }
  return formatNumber(n);
}

export function formatNumber(n: number): string {
  // Never let NaN/Infinity/negatives reach the screen. A single bad number
  // upstream would otherwise paint "NaN כופתאות" across the whole HUD.
  if (!Number.isFinite(n) || n < 0) return '0';
  const whole = Math.floor(n);
  if (whole < 1_000_000) return plain.format(whole);
  if (whole < COMPACT_CEILING) return compact.format(whole);
  const exp = Math.floor(Math.log10(whole));
  return `${mantissa.format(whole / 10 ** exp)}e${exp}`;
}

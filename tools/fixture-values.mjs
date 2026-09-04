// The deterministic value list shared by format-fixture.mjs (Hebrew) and
// format-fixture-en.mjs (English). One list, so the two fixtures always pin
// the same 482 values row-for-row — a per-locale fixture with a different
// value set would let a locale bug hide in the gap.
export function fixtureValues() {
  const values = new Set();

  // the small end: every integer that formats plainly plus rate-precision cases
  for (const v of [0, 0.05, 0.1, 0.15, 0.45, 0.5, 0.95, 1, 1.5, 2, 2.5, 5, 7.5, 9.9, 10, 15, 99, 100, 123, 999]) values.add(v);
  // boundaries of every regime, exact and ±1
  for (const b of [1e3, 1e4, 1e5, 1e6, 1e9, 1e12, 1e15, 1e18]) {
    values.add(b - 1); values.add(b); values.add(b + 1);
  }
  // mantissa rounding: sweep two decades at odd mantissas across each scale word
  for (const scale of [1e6, 1e9, 1e12]) {
    for (const m of [1, 1.04, 1.05, 1.15, 1.5, 2.34, 3.7, 5.14235, 7.77, 9.94, 9.95, 42.5, 123.4, 999.9]) {
      values.add(m * scale);
    }
  }
  // past the compact ceiling: scientific form
  for (const v of [1.74e18, 2.5e16, 9.994e20, 1e21]) values.add(v);
  // the cost curve itself: every producer price for the first 40 buys (growth 1.15)
  for (const base of [15, 100, 1100, 12000, 130000, 1.4e6, 20e6, 330e6, 5.1e9, 75e9]) {
    let c = base;
    for (let i = 0; i < 40; i++) { values.add(Math.round(c)); c *= 1.15; }
  }
  return [...values].sort((a, b) => a - b);
}

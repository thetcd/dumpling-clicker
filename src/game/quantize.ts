/**
 * Price rounding: a number the game CHARGES is rounded to the number the game
 * PRINTS, so the two can never disagree.
 *
 * Dor's report: the shop said an upgrade needed 5.1B and the real price was
 * 5.14235B. `formatNumber` is lossy above a million by design — Intl's
 * compact-long notation carries one decimal on the mantissa — so the only way
 * for the printed figure to be the true figure is to quantize the figure
 * itself. Every scale here mirrors exactly what `ui/format.ts` renders:
 *
 *   < 1,000   whole numbers          (plain, every digit shown)
 *   < 1e6     three significant      (plain, every digit shown — 723,451 is
 *             digits                  accurate but reads as noise, so it tidies
 *                                     to 723,000)
 *   < 1e15    one-decimal mantissa   ("5.1 מיליארד")
 *   >= 1e15   two-decimal mantissa   ("1.74e18")
 *
 * Lives in `game/`, not `ui/format.ts`, because `economy.ts` charges through it
 * and the economy layer must not import the UI.
 *
 * The function is IDEMPOTENT, which is the property the callers depend on:
 * `roundToDisplay(roundToDisplay(n)) === roundToDisplay(n)`, so a cost can be
 * re-rounded anywhere without drifting.
 */
export function roundToDisplay(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Never round a real price down to free — a 0 would hand out a producer.
  if (n < 1_000) return Math.max(1, Math.round(n));

  const exp = Math.floor(Math.log10(n));
  if (n < 1_000_000) {
    // three significant digits
    const step = 10 ** (exp - 2);
    return Math.round(n / step) * step;
  }
  if (n < 1e15) {
    // One decimal on the mantissa WITHIN its scale word (מיליון / מיליארד /
    // טריליון), which is what compact-long prints — so the step is the scale
    // divided by ten, not a fixed number of significant digits.
    const scale = 10 ** (3 * Math.floor(exp / 3));
    const step = scale / 10;
    return Math.round(n / step) * step;
  }
  // past the last scale word format.ts switches to `1.74e18` — two decimals
  const step = 10 ** (exp - 2);
  return Math.round(n / step) * step;
}

import { describe, expect, test } from 'vitest';
import { PALETTE, TOKENS } from '../src/ui/palette';
import { BODY_COLORS } from '../src/game/config/parts';

// The dusk build could not have had this test: contrast there was a property of
// the BACKDROP, because the panels were 6%-white tints over whatever happened to
// be behind them. Now the panels are opaque, so legibility is a fixed pair of
// values — which makes it something a unit test can actually hold.
//
// This catches unreadable. It does not catch ugly, and no unit test will; that
// is what looking at the four widths is for.

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const T = TOKENS;

describe('text is readable on the surfaces it sits on', () => {
  test.each([
    ['--ink on --surface', T['--ink'], T['--surface'], 7],
    ['--ink on --surface-raised', T['--ink'], T['--surface-raised'], 7],
    ['--ink on --surface-sunken', T['--ink'], T['--surface-sunken'], 7],
    ['--ink-soft on --surface', T['--ink-soft'], T['--surface'], 4.5],
    ['--danger on --surface', T['--danger'], T['--surface'], 4.5],
  ])('%s', (_name, fg, bg, floor) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(floor);
  });

  test('--accent-text clears AA, which is the whole reason it exists', () => {
    // The dusk --accent measured 1.66:1 on paper, and it coloured every price
    // and every gain in the shop — the exact numbers a purchase decision is made
    // on. Splitting decoration from text is what fixed that; this holds it.
    expect(ratio(T['--accent-text'], T['--surface'])).toBeGreaterThanOrEqual(4.5);
  });

  test('the decorative --accent is NOT used as text anywhere', () => {
    // If this ever fails it means someone has started colouring text with the
    // vivid token again. It is a fill, a border and a gradient stop, never ink.
    expect(ratio(T['--accent'], T['--surface'])).toBeLessThan(4.5);
  });

  test('text on the accent gradient reads', () => {
    for (const bg of ['--accent', '--accent-deep'] as const) {
      expect(ratio(T['--accent-ink'], T[bg]), bg).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('the crit floater and its badge read at large-text AA', () => {
    expect(ratio(T['--crit'], T['--surface'])).toBeGreaterThanOrEqual(3);
    expect(ratio(T['--ink-inverse'], T['--crit'])).toBeGreaterThanOrEqual(3);
  });
});

describe('the squishy reads on every body colour', () => {
  // The designer is the game's stated core concept, so the face has to be
  // legible on all 16 swatches. `charcoal` is the tight one — it will be the
  // first to break if anyone lightens the ink.
  test.each(BODY_COLORS.map((c) => [c.id, c.fill] as const))('ink on %s', (_id, fill) => {
    expect(ratio(PALETTE.ink, fill)).toBeGreaterThanOrEqual(3);
  });
});

describe('panels separate from the sky behind them', () => {
  // NOT a text floor — a separation floor, and the guard against the failure
  // mode this whole theme risks: near-white paper on a near-white sky, where
  // the shop panel loses its edge and the column dissolves. This is the
  // assertion most likely to catch a well-meaning "let's brighten the sky".
  test.each([
    ['--bd-sky-1', 1.15],
    ['--bd-sky-4', 1.05],
  ])('--surface against %s', (sky, floor) => {
    expect(ratio(T['--surface'], T[sky])).toBeGreaterThanOrEqual(floor);
  });
});

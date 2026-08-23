import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { TOKENS } from '../src/ui/palette';

// src/styles/tokens.css is the ONE place a colour is written twice. It has to
// exist: a data: URI SVG cannot read CSS custom properties, and CSS cannot
// import TypeScript. So the duplication is deliberate — and this file is the
// thing that stops it silently drifting apart.
const CSS = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function parseRoot(css: string): Record<string, string> {
  const root = css.slice(css.indexOf(':root'), css.lastIndexOf('}'));
  const out: Record<string, string> = {};
  for (const line of root.split('\n')) {
    const m = line.match(/^\s*(--[a-z0-9-]+):\s*(.+?);\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const css = parseRoot(CSS);

describe('the palette mirror', () => {
  test('every TypeScript token appears in tokens.css with the same value', () => {
    for (const [name, value] of Object.entries(TOKENS)) {
      expect(css[name], `${name} is missing from tokens.css`).toBeDefined();
      expect(css[name], `${name} disagrees between palette.ts and tokens.css`).toBe(value);
    }
  });

  test('and every tokens.css variable exists in TypeScript', () => {
    // the other direction, so deleting from palette.ts without deleting from
    // the CSS leaves a variable nothing owns
    for (const name of Object.keys(css)) {
      expect(TOKENS[name], `${name} is in tokens.css but not in palette.ts`).toBeDefined();
    }
  });
});

describe('rules the theme depends on', () => {
  test('tokens.css declares a light color-scheme', () => {
    // Without it, Chrome for Android's "auto dark theme" will force-invert the
    // game straight back to the dusk look — and the planned Play TWA is exactly
    // where that would happen unseen.
    expect(CSS).toMatch(/color-scheme:\s*light/);
  });

  test('the sticker outline is doubled, not single', () => {
    // One pass at this radius reads as a blur; two read as an outline. It is
    // the only thing keeping pale art legible on a pale sky.
    const passes = TOKENS['--sticker'].match(/drop-shadow/g) ?? [];
    expect(passes).toHaveLength(2);
  });

  test('no shadow is pure black', () => {
    // Black over pastel reads as dirt. Everything casts the plum tint instead.
    for (const key of ['--shadow-sm', '--shadow-md', '--shadow-lg', '--lift']) {
      expect(TOKENS[key], key).toContain(TOKENS['--shadow-tint']);
    }
  });
});

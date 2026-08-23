import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

// This is the test that stops the theme rotting six weeks from now.
//
// Before the token layer there were six different spellings of "gold"
// (#f0b25e, #ffd766, #ffd07a, #ffd75e, #f0b429, rgba(243,192,51,…)) scattered
// across CSS and TypeScript, and a recolour meant hunting ~150 literals by
// hand. The rule now is: colour is declared in one place and referenced
// everywhere else.

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** The only files allowed to hold literal colour values, and why. */
const PALETTE_FILES = [
  // the single source of truth
  'ui/palette.ts',
  // its mirror; tests/palette.test.ts holds the two together
  'styles/tokens.css',
  // The player-facing swatch palette. Stays here rather than in palette.ts
  // because a swatch is an id (a SAVE KEY), a Hebrew name and a fill together —
  // splitting the fill out would scatter one concept across two files.
  'game/config/parts.ts',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|css)$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk(SRC)
  .map((f) => [relative(SRC, f).split('\\').join('/'), readFileSync(f, 'utf8')] as const)
  .filter(([rel]) => !PALETTE_FILES.includes(rel));

/** Strip comments so a hex quoted in prose is not a violation. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('colour lives in the palette, not scattered through the source', () => {
  test.each(files.map(([rel]) => rel))('%s has no hex literal', (rel) => {
    const src = stripComments(files.find(([r]) => r === rel)![1]);
    // #fff is the one exception: pure white is not a theme colour, it is the
    // constant that survives any theme. It is used for the sticker outline
    // rings, and wrapping it in a variable would make those rules unreadable.
    const hits = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter(
      (h) => h.toLowerCase() !== '#fff' && h.toLowerCase() !== '#ffffff',
    );
    expect(hits, `move these into src/ui/palette.ts: ${hits.join(', ')}`).toEqual([]);
  });

  test.each(files.filter(([rel]) => rel.endsWith('.ts')).map(([rel]) => rel))(
    '%s has no rgb()/rgba() literal either',
    (rel) => {
      // Stricter for TypeScript than for CSS: every .ts module can `import
      // { PALETTE, white }`, so it has no excuse. CSS still needs the
      // `rgb(r g b / a)` form to put alpha on a colour, which a bare custom
      // property cannot express.
      const src = stripComments(files.find(([r]) => r === rel)![1]);
      const hits = (src.match(/rgba?\([^)]*\)/g) ?? []).filter((h) => !h.includes('var('));
      expect(hits, `use PALETTE or white(a) instead: ${hits.join(', ')}`).toEqual([]);
    },
  );
});

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { isMultiTouch } from '../src/ui/gestures';

/**
 * Dor's brother, 2026-08-25: "zoomed in with two fingers and the game became
 * buggy."
 *
 * Every overlay in the app is `position: fixed; inset: 0`, and a fixed element
 * anchors to the LAYOUT viewport. A pinch opens a smaller VISUAL viewport
 * inside it, so .modal-backdrop goes on covering every pixel — and swallowing
 * every pointer event — while the buttons that dismiss it sit outside what the
 * player can see. #app is 100dvh with nothing scrollable behind it, so there is
 * no way to pan to them either. The game reads as frozen.
 */
describe('isMultiTouch', () => {
  test('one finger is a squish, not a zoom', () => {
    expect(isMultiTouch(1)).toBe(false);
  });

  test('a second finger is a zoom attempt', () => {
    expect(isMultiTouch(2)).toBe(true);
    expect(isMultiTouch(3)).toBe(true);
  });

  test('a touch sequence with no touches left is not a zoom', () => {
    // touchend fires with touches.length 0; blocking there would be harmless
    // but meaningless, and the explicit case documents that it was considered
    expect(isMultiTouch(0)).toBe(false);
  });
});

/**
 * The CSS half of the same fix, pinned here because it is invisible: the game
 * looks and behaves identically whether these rules are right or missing, right
 * up until someone pinches.
 *
 * `touch-action: manipulation` is the trap. It reads like "no browser
 * gestures", and it does remove the double-tap zoom — but the spec leaves PINCH
 * available, which is the whole bug. Anywhere that must not zoom needs `none`,
 * and anywhere that scrolls needs `pan-y` rather than `none`.
 */
describe('touch-action rules', () => {
  const main = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');
  const dumpling = readFileSync(new URL('../src/styles/dumpling.css', import.meta.url), 'utf8');

  /**
   * The declarations inside one top-level rule, by exact selector.
   *
   * Matches the selector EXACTLY rather than by substring, so `body` finds the
   * standalone `body { ... }` rule and not the `html, body { ... }` one above
   * it — which is what the first version of this helper did.
   */
  function block(css: string, selector: string): string {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const chunk of noComments.split('}')) {
      const brace = chunk.indexOf('{');
      if (brace === -1) continue;
      if (chunk.slice(0, brace).trim() === selector) return chunk.slice(brace + 1);
    }
    throw new Error(`${selector} not found as a standalone rule`);
  }

  test('the stage and the squishy refuse every browser gesture', () => {
    // `manipulation` here is what shipped the bug — it permits pinch
    expect(block(main, '#stage')).toMatch(/touch-action:\s*none/);
    expect(block(dumpling, '.squish-hit')).toMatch(/touch-action:\s*none/);
  });

  test('the modal backdrop cannot be zoomed away from', () => {
    expect(block(main, '.modal-backdrop')).toMatch(/touch-action:\s*none/);
  });

  test('the panels that scroll keep scrolling', () => {
    // pan-y, never none: #shop is the core purchase loop and .designer is the
    // first screen anyone sees. Locking either one is a worse bug than the one
    // being fixed.
    expect(block(main, '#shop')).toMatch(/touch-action:\s*pan-y/);
    expect(block(main, '.designer')).toMatch(/touch-action:\s*pan-y/);
  });

  test('no rule still relies on manipulation to stop a zoom', () => {
    // body keeps it deliberately — it kills double-tap zoom while leaving
    // children free to opt into panning. Anywhere else it is a false sense of
    // security.
    expect(block(main, 'body')).toMatch(/touch-action:\s*manipulation/);
    const stripped = main.replace(/\/\*[\s\S]*?\*\//g, '');
    expect([...stripped.matchAll(/touch-action:\s*manipulation/g)]).toHaveLength(1);
    expect(dumpling.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/touch-action:\s*manipulation/);
  });
});

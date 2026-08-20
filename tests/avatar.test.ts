import { describe, expect, test } from 'vitest';
import { avatarSVG } from '../src/ui/avatar';
import {
  ACCESSORIES,
  BODY_COLORS,
  DEFAULT_AVATAR,
  EYES,
  MOUTHS,
} from '../src/game/config/parts';

// A designer part lives in two files: an entry in parts.ts and a `case` in
// avatar.ts. Adding one and forgetting the other is silent — the part shows up
// in the creator and renders as the fallback (or as nothing). These tests make
// that mismatch loud.
const design = (over: Partial<typeof DEFAULT_AVATAR>) => ({
  ...DEFAULT_AVATAR,
  ...over,
});

describe('avatar part coverage', () => {
  test('every configured eye id has its own renderer case', () => {
    const fallback = avatarSVG(design({ eyes: '__no_such_id__' }));
    for (const e of EYES) {
      if (e.id === 'dot') continue; // 'dot' IS the fallback branch
      expect(
        avatarSVG(design({ eyes: e.id })),
        `eyes '${e.id}' is in parts.ts but has no case in avatar.ts`,
      ).not.toBe(fallback);
    }
  });

  test('every configured mouth id has its own renderer case', () => {
    const fallback = avatarSVG(design({ mouth: '__no_such_id__' }));
    for (const m of MOUTHS) {
      if (m.id === 'smile') continue; // 'smile' IS the fallback branch
      expect(
        avatarSVG(design({ mouth: m.id })),
        `mouth '${m.id}' is in parts.ts but has no case in avatar.ts`,
      ).not.toBe(fallback);
    }
  });

  test('every configured accessory id has its own renderer case', () => {
    const fallback = avatarSVG(design({ accessory: '__no_such_id__' }));
    for (const a of ACCESSORIES) {
      if (a.id === 'none') continue; // 'none' IS the fallback branch (empty)
      expect(
        avatarSVG(design({ accessory: a.id })),
        `accessory '${a.id}' is in parts.ts but has no case in avatar.ts`,
      ).not.toBe(fallback);
    }
  });

  test('every configured body colour paints its own fill', () => {
    for (const c of BODY_COLORS) {
      expect(
        avatarSVG(design({ color: c.id })),
        `colour '${c.id}' did not reach the body layer`,
      ).toContain(c.fill);
    }
  });

  test('an unknown colour id falls back instead of rendering undefined', () => {
    const svg = avatarSVG(design({ color: '__no_such_id__' }));
    expect(svg).toContain(BODY_COLORS[0].fill);
    expect(svg).not.toContain('undefined');
  });

  test('no part renders a malformed layer', () => {
    for (const eyes of EYES)
      for (const mouth of MOUTHS)
        for (const accessory of ACCESSORIES) {
          const svg = avatarSVG(design({ eyes: eyes.id, mouth: mouth.id, accessory: accessory.id }));
          expect(svg).not.toContain('undefined');
          expect(svg).not.toContain('NaN');
          // every opened tag is closed — cheap well-formedness check
          expect((svg.match(/<g/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
        }
  });
});

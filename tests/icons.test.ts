import { describe, expect, test } from 'vitest';
import { hasIcon, iconSVG } from '../src/ui/icons';
import { PRODUCERS } from '../src/game/config/producers';
import { COMMON_SKINS } from '../src/game/config/findables';

const ALL_IDS = [...PRODUCERS.map((p) => p.id), ...COMMON_SKINS, 'gift'];

describe('icon art', () => {
  test('every producer tier has drawn art', () => {
    for (const p of PRODUCERS) {
      expect(hasIcon(p.id), `missing art for producer "${p.id}"`).toBe(true);
    }
  });

  test('every findable skin has drawn art', () => {
    for (const skin of COMMON_SKINS) {
      expect(hasIcon(skin), `missing art for skin "${skin}"`).toBe(true);
    }
  });

  test('the airdrop has drawn art', () => {
    expect(hasIcon('gift')).toBe(true);
  });

  test('an unknown id yields nothing rather than broken markup', () => {
    expect(hasIcon('no-such-thing')).toBe(false);
    expect(iconSVG('no-such-thing')).toBe('');
  });

  test('every icon is well-formed SVG on one shared viewBox', () => {
    for (const id of ALL_IDS) {
      const svg = iconSVG(id);
      expect(svg, id).toContain('viewBox="0 0 100 100"');
      expect(svg.startsWith('<svg'), id).toBe(true);
      expect(svg.endsWith('</svg>'), id).toBe(true);
      // balanced groups — an unclosed <g> silently swallows everything after it
      const opens = (svg.match(/<g[\s>]/g) ?? []).length;
      const closes = (svg.match(/<\/g>/g) ?? []).length;
      expect(closes, `unbalanced <g> in "${id}"`).toBe(opens);
    }
  });

  test('no icon contains undefined, NaN or an empty attribute', () => {
    for (const id of ALL_IDS) {
      const svg = iconSVG(id);
      expect(svg, id).not.toContain('undefined');
      expect(svg, id).not.toContain('NaN');
      expect(svg, id).not.toMatch(/="\s*"/);
    }
  });

  test('icons stay roughly inside their viewBox', () => {
    // drawn at 30-50px in the shop and the crowd; anything far outside 0..100
    // is clipped and reads as a chopped-off shape.
    //
    // Scan GEOMETRY attributes only. Scraping every number in the markup also
    // picks up the 2000 in the xmlns URL and the 255s in rgba() colours.
    const GEOMETRY = /\s(?:d|cx|cy|rx|ry|x|y|x1|y1|x2|y2|width|height|r)="([^"]+)"/g;
    for (const id of ALL_IDS) {
      const svg = iconSVG(id);
      for (const m of svg.matchAll(GEOMETRY)) {
        for (const raw of m[1].match(/-?\d+(\.\d+)?/g) ?? []) {
          const n = Number(raw);
          expect(n, `${id} has an out-of-range coordinate ${n}`).toBeGreaterThan(-30);
          expect(n, `${id} has an out-of-range coordinate ${n}`).toBeLessThan(130);
        }
      }
    }
  });

  test('the class name is applied so CSS can size them', () => {
    expect(iconSVG('stall')).toContain('class="game-icon"');
    expect(iconSVG('stall', 'other')).toContain('class="other"');
  });
});

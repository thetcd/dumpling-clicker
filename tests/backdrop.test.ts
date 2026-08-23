// The backdrop scrolls by exactly one tile, so the loop is only seamless while
// every drawn thing stays INSIDE the tile. Anything crossing an edge is clipped
// in the second copy but not the first, and the background visibly jumps once
// per cycle — which is exactly the flaw the video version had and the whole
// reason this is drawn instead. A browser caught it; these tests keep it caught.
import { describe, expect, it } from 'vitest';
import {
  CLOUDS,
  ROOF_OVERHANG,
  VB_W,
  cloudExtent,
  villageHouses,
} from '../src/ui/backdrop';

describe('backdrop tiling', () => {
  it('keeps every house, roof overhang included, inside the tile', () => {
    for (const h of villageHouses()) {
      const left = h.x - ROOF_OVERHANG;
      const right = h.x + h.w + ROOF_OVERHANG;
      expect(left, `house at x=${h.x} pokes past the left edge`).toBeGreaterThanOrEqual(0);
      expect(right, `house at x=${h.x} pokes past the right edge`).toBeLessThan(VB_W);
    }
  });

  it('keeps every cloud inside the tile', () => {
    for (const c of CLOUDS) {
      const [left, right] = cloudExtent(c);
      expect(left, `cloud at x=${c.x} pokes past the left edge`).toBeGreaterThanOrEqual(0);
      expect(right, `cloud at x=${c.x} pokes past the right edge`).toBeLessThan(VB_W);
    }
  });

  it('does not let houses overlap each other', () => {
    // Not a seam issue — just that the village should read as separate
    // cottages rather than one smeared block.
    const boxes = villageHouses()
      .map((h) => [h.x - ROOF_OVERHANG, h.x + h.w + ROOF_OVERHANG] as const)
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i][0], `house ${i} overlaps the one before it`)
        .toBeGreaterThanOrEqual(boxes[i - 1][1]);
    }
  });

  it('sits every house on the ground rather than floating', () => {
    for (const h of villageHouses()) {
      expect(h.y + h.h).toBe(h.groundY);
    }
  });
});

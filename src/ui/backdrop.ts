// The ambient landscape behind everything: parallax hills at dusk, a lit
// village, drifting clouds, stars and a slow aurora.
//
// Drawn rather than filmed, for three reasons that all bit the video version:
// a 2.6MB mp4 dwarfed the entire 182KB precache, its bright pastel palette
// made the light UI text unreadable, and its 10s loop popped because the sky
// started pink and ended orange. Here the palette is the game's own tokens and
// every loop is seamless by construction — each layer holds two identical
// tiles and travels exactly one tile width, so the frame it ends on IS the
// frame it starts on.
//
// No per-frame JS, same rule as scene.ts: everything is a CSS transform or
// opacity animation, so it stays on the compositor and off the rAF loop.

// The tile is 1200 wide and the viewBox holds two of them. Height is 1200 so
// the box is ~2:1 doubled, which is close to how the layer actually renders on
// a phone — with preserveAspectRatio="none" a mismatch here stretches the
// hills vertically, and an early 2400x320 box turned gentle rolls into spikes.
export const VB_W = 1200;
const VB_H = 1200;

/** One horizon line, drawn twice so the layer can scroll into itself. */
function hillLayer(cls: string, path: string, fill: string, extra = ''): string {
  return `
    <div class="bd-layer ${cls}">
      <svg viewBox="0 0 ${VB_W * 2} ${VB_H}" preserveAspectRatio="none" aria-hidden="true">
        <g fill="${fill}">
          <path d="${path}"/>
          <g transform="translate(${VB_W},0)"><path d="${path}"/></g>
        </g>
        ${extra}
      </svg>
    </div>`;
}

// Ridges are placed so the horizon lands above the shop panel rather than
// behind it: far ~45%, mid ~52%, near ~60% of the viewport.
//
// Two rules make a tile repeat invisibly, and BOTH are needed:
//   1. y at x=0 must equal y at x=VB_W, or the ridge steps at the join.
//   2. the tangent must match too — the first control point's slope out of
//      x=0 has to equal the last control point's slope into x=VB_W. Without
//      this the heights line up but the curve corners, leaving a faint notch
//      that repeats across the whole scroll.
// Slopes below: far -46/100, mid -50/120, near -46/150, each mirrored at the
// far end.
const FAR = 'M0,260 C100,214 200,300 300,252 C400,204 500,308 600,258'
  + ' C700,208 800,302 900,250 C1000,198 1100,306 1200,260 L1200,1200 L0,1200 Z';
const MID = 'M0,380 C120,330 180,300 300,340 C420,380 480,430 600,392'
  + ' C720,354 780,320 900,356 C1020,392 1080,430 1200,380 L1200,1200 L0,1200 Z';
const NEAR = 'M0,520 C150,474 250,500 400,516 C550,532 650,566 800,540'
  + ' C950,514 1050,566 1200,520 L1200,1200 L0,1200 Z';

/** The roof overhangs the walls by this much on each side. */
export const ROOF_OVERHANG = 10;

/**
 * Where the houses sit and how big they are.
 *
 * **Every box must stay inside [0, VB_W).** The layer scrolls by exactly one
 * tile, so anything spilling past the tile edge is clipped in the second copy
 * but not the first, and the loop visibly jumps once per cycle. A house at
 * x=1070 did exactly that. `tests/backdrop.test.ts` pins this.
 *
 * Drawn ~3x wider than tall on purpose: the layer renders squashed
 * horizontally (x scales ~0.36, y ~0.75), so a square here lands on screen as
 * a tall narrow tower rather than a cottage.
 */
export function villageHouses(): Array<{
  x: number; y: number; w: number; h: number; groundY: number;
}> {
  // x on the tile, and the ridge height under it (roughly follows MID)
  const at: Array<[number, number]> = [
    [120, 352], [320, 392], [520, 372], [700, 386], [870, 366], [1040, 372],
  ];
  return at.map(([x, groundY], i) => {
    const h = 26 + ((i + 1) % 3) * 8;
    const w = h * 3.2 + (i % 3) * 14;
    return { x, y: groundY - h, w, h, groundY };
  });
}

/** A cluster of tiny houses with lit windows along the mid ridge. */
function village(): string {
  const houses = villageHouses()
    .map(({ x, y, w, h }, i) => `
        <g transform="translate(${x},${y})">
          <path d="M${-ROOF_OVERHANG} 0 L${w / 2} ${-h * 0.7} L${w + ROOF_OVERHANG} 0 Z"
                fill="var(--bd-roof)"/>
          <rect x="0" y="0" width="${w}" height="${h}" rx="4" fill="var(--bd-wall)"/>
          <rect class="bd-win" x="${w * 0.2}" y="${h * 0.32}" width="${w * 0.22}"
                height="${h * 0.34}" rx="3" fill="var(--bd-window)"
                style="animation-delay:${i * 1.7}s"/>
          <rect class="bd-win" x="${w * 0.58}" y="${h * 0.32}" width="${w * 0.22}"
                height="${h * 0.34}" rx="3" fill="var(--bd-window)"
                style="animation-delay:${i * 1.7 + 0.8}s"/>
        </g>`)
    .join('');
  return `<g class="bd-village">${houses}<g transform="translate(${VB_W},0)">${houses}</g></g>`;
}

/** The three overlapping ellipses that make one puff, in local coordinates. */
const PUFF = [
  { cx: 0, cy: 0, rx: 86, ry: 26 },
  { cx: 58, cy: 9, rx: 62, ry: 20 },
  { cx: -54, cy: 11, rx: 54, ry: 18 },
];

/**
 * Clouds on their own tile pair. Same tile-bounds rule as the village — a puff
 * crossing the tile edge would be clipped in one copy and not the other, which
 * is a visible jump once per loop.
 */
export const CLOUDS: Array<{ x: number; y: number; s: number; o: number }> = [
  { x: 200, y: 150, s: 1.0, o: 0.42 },
  { x: 560, y: 92, s: 0.72, o: 0.3 },
  { x: 900, y: 190, s: 1.15, o: 0.36 },
];

/** Horizontal extent of one cloud after scaling, as [left, right] on the tile. */
export function cloudExtent(c: { x: number; s: number }): [number, number] {
  const lefts = PUFF.map((p) => c.x + c.s * (p.cx - p.rx));
  const rights = PUFF.map((p) => c.x + c.s * (p.cx + p.rx));
  return [Math.min(...lefts), Math.max(...rights)];
}

function clouds(): string {
  const one = (c: { x: number; y: number; s: number; o: number }) => `
    <g transform="translate(${c.x},${c.y}) scale(${c.s})" opacity="${c.o}">
      ${PUFF.map((p) => `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}"
          fill="var(--bd-cloud)"/>`).join('')}
    </g>`;
  const tile = CLOUDS.map(one).join('');
  return `${tile}<g transform="translate(${VB_W},0)">${tile}</g>`;
}

/** Stars on a single 1200x400 tile (no scroll — the sky holds still). */
function stars(): string {
  // Fixed positions, not random: a re-render must not reshuffle the sky.
  const pts = [
    [60, 62], [148, 148], [232, 44], [318, 190], [402, 96], [488, 232], [560, 52],
    [648, 164], [726, 82], [812, 214], [890, 110], [968, 48], [1046, 174], [1130, 92],
  ];
  return pts
    .map(([x, y], i) => `<circle class="bd-star" cx="${x}" cy="${y}"
        r="${2.5 + (i % 3) * 1.2}" fill="var(--bd-star)"
        style="animation-delay:${(i % 7) * 0.9}s"/>`)
    .join('');
}

/**
 * Mount the backdrop as the first child of `host` (the app root). It is
 * decorative and inert: `aria-hidden`, no pointer events, never focusable.
 */
export function initBackdrop(host: HTMLElement): void {
  const el = document.createElement('div');
  el.className = 'backdrop';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="bd-sky"></div>
    <div class="bd-glow"></div>
    <div class="bd-aurora"></div>
    <div class="bd-layer bd-stars">
      <svg viewBox="0 0 1200 400" preserveAspectRatio="none">${stars()}</svg>
    </div>
    <div class="bd-layer bd-clouds">
      <svg viewBox="0 0 2400 400" preserveAspectRatio="none">${clouds()}</svg>
    </div>
    ${hillLayer('bd-far', FAR, 'var(--bd-far)')}
    ${hillLayer('bd-mid', MID, 'var(--bd-mid)', village())}
    ${hillLayer('bd-near', NEAR, 'var(--bd-near)')}
    <div class="bd-scrim"></div>`;
  host.prepend(el);
}

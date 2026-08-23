// The ambient landscape behind everything: parallax hills at dusk, a lit
// village, drifting clouds, stars and a slow aurora.
//
// Drawn rather than filmed. The source video was 2.6MB against a 182KB
// precache, its bright pastel palette made the light UI text unreadable, and
// its 10s loop popped because the sky started pink and ended orange. See
// docs/DECISIONS.md.
//
// **Each layer is a fixed-pixel tile repeated with background-repeat.** The
// first version sized the tile as a percentage of the viewport, which meant
// preserveAspectRatio="none" scaled x by 0.36 on a phone and 1.2 on a laptop —
// the same art rendered at roughly 3x different proportions, so houses became
// flat bunkers and stars became blobs on desktop. With a tile fixed in px, the
// horizontal scale no longer depends on viewport WIDTH at all; only height
// varies, and far less. Widescreens simply get more tiles.
//
// No per-frame JS, same rule as scene.ts: everything is a CSS transform or
// opacity animation, so it stays on the compositor and off the rAF loop.

/** Tile coordinate space. Square, so the art is authored undistorted. */
export const VB_W = 1200;
const VB_H = 1200;

// The palette lives here rather than in CSS custom properties because each
// layer is serialised into a data: URI, and a data: URI cannot see the page's
// variables. Values mirror the tokens in main.css.
const C = {
  far: '#43335a',
  mid: '#33264a',
  near: '#241a33',
  roof: '#5a3f63',
  wall: '#2e2340',
  window: '#f0b25e',
  cloud: '#6b5175',
  star: '#f5eee6',
};

/** Wrap tile content in a standalone SVG and encode it for `background-image`. */
function tileUrl(content: string, vbW = VB_W, vbH = VB_H): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}"`
    + ` preserveAspectRatio="none">${content}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Ridges are placed so the horizon lands above the shop panel rather than
// behind it: far ~45%, mid ~52%, near ~60% of the layer.
//
// Two rules make a tile repeat invisibly, and BOTH are needed:
//   1. y at x=0 must equal y at x=VB_W, or the ridge steps at every tile edge.
//   2. the tangent must match too — the slope out of x=0 has to equal the slope
//      into x=VB_W. Without it the heights line up but the curve corners,
//      leaving a notch that repeats across the whole scroll.
// Slopes below: far -46/100, mid -50/120, near -46/150, each mirrored.
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
 * **Every box must stay inside [0, VB_W).** Anything spilling past the tile
 * edge is cut off in every repeat, and back when the layer scrolled by tile
 * pairs it made the whole background jump once per cycle. `tests/backdrop.
 * test.ts` pins this.
 */
export function villageHouses(): Array<{
  x: number; y: number; w: number; h: number; groundY: number;
}> {
  // x on the tile, and the ridge height under it (roughly follows MID)
  const at: Array<[number, number]> = [
    [120, 352], [330, 392], [545, 372], [740, 386], [935, 366],
  ];
  return at.map(([x, groundY], i) => {
    const h = 34 + ((i + 1) % 3) * 10;
    // ~2.1x wide: the tile is squashed a little horizontally at a typical
    // phone/laptop height, so a square here still lands slightly tall.
    const w = h * 2.1 + (i % 3) * 12;
    return { x, y: groundY - h, w, h, groundY };
  });
}

/**
 * The village.
 *
 * Windows are baked in at varying opacity rather than animated: an SVG used as
 * a `background-image` is a static rendering context, so CSS animations inside
 * one never run. Anything that needs to move has to be a property of the
 * ELEMENT (see the star cross-fade below), not of the art.
 */
function village(): string {
  return villageHouses()
    .map(({ x, y, w, h }, i) => {
      const lit = [0.95, 0.6, 1, 0.72, 0.85][i % 5];
      const lit2 = [0.65, 1, 0.7, 0.95, 0.55][i % 5];
      return `
      <g transform="translate(${x},${y})">
        <path d="M${-ROOF_OVERHANG} 0 L${w / 2} ${-h * 0.62} L${w + ROOF_OVERHANG} 0 Z"
              fill="${C.roof}"/>
        <rect x="0" y="0" width="${w}" height="${h}" rx="4" fill="${C.wall}"/>
        <rect x="${w * 0.18}" y="${h * 0.3}" width="${w * 0.24}"
              height="${h * 0.32}" rx="3" fill="${C.window}" opacity="${lit}"/>
        <rect x="${w * 0.58}" y="${h * 0.3}" width="${w * 0.24}"
              height="${h * 0.32}" rx="3" fill="${C.window}" opacity="${lit2}"/>
      </g>`;
    })
    .join('');
}

/** The three overlapping ellipses that make one puff, in local coordinates. */
const PUFF = [
  { cx: 0, cy: 0, rx: 86, ry: 30 },
  { cx: 58, cy: 10, rx: 62, ry: 23 },
  { cx: -54, cy: 12, rx: 54, ry: 21 },
];

/** Clouds, on their own shorter tile. Same in-bounds rule as the village. */
export const CLOUDS: Array<{ x: number; y: number; s: number; o: number }> = [
  { x: 210, y: 150, s: 0.9, o: 0.4 },
  { x: 620, y: 96, s: 0.66, o: 0.3 },
  { x: 960, y: 196, s: 1.0, o: 0.34 },
];

/** Horizontal extent of one cloud after scaling, as [left, right] on the tile. */
export function cloudExtent(c: { x: number; s: number }): [number, number] {
  const lefts = PUFF.map((p) => c.x + c.s * (p.cx - p.rx));
  const rights = PUFF.map((p) => c.x + c.s * (p.cx + p.rx));
  return [Math.min(...lefts), Math.max(...rights)];
}

function clouds(): string {
  return CLOUDS.map((c) => `
    <g transform="translate(${c.x},${c.y}) scale(${c.s})" opacity="${c.o}">
      ${PUFF.map((p) => `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}"
          fill="${C.cloud}"/>`).join('')}
    </g>`).join('');
}

// Fixed positions, not random: a re-render must not reshuffle the sky.
const STARS: Array<[number, number]> = [
  [60, 62], [148, 148], [232, 44], [318, 190], [402, 96], [488, 232], [560, 52],
  [648, 164], [726, 82], [812, 214], [890, 110], [968, 48], [1046, 174], [1130, 92],
];

/**
 * Half the stars, so two layers can cross-fade into each other and read as
 * twinkling. The element's opacity is animated, which works — animating
 * anything *inside* the tile would not, since it is a background image.
 */
function stars(half: 0 | 1): string {
  return STARS.filter((_, i) => i % 2 === half)
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${3 + (i % 3) * 1.4}"
        fill="${C.star}" opacity="${0.45 + (i % 4) * 0.15}"/>`)
    .join('');
}

/**
 * Mount the backdrop as the first child of `host`. Decorative and inert:
 * `aria-hidden`, no pointer events, never focusable.
 */
export function initBackdrop(host: HTMLElement): void {
  const el = document.createElement('div');
  el.className = 'backdrop';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="bd-sky"></div>
    <div class="bd-glow"></div>
    <div class="bd-aurora"></div>
    <div class="bd-layer bd-stars bd-stars-a"></div>
    <div class="bd-layer bd-stars bd-stars-b"></div>
    <div class="bd-layer bd-clouds"></div>
    <div class="bd-layer bd-far"></div>
    <div class="bd-layer bd-mid"></div>
    <div class="bd-layer bd-near"></div>
    <div class="bd-scrim"></div>`;

  // Each layer's art rides in on a custom property; the CSS owns the geometry.
  const set = (sel: string, url: string) =>
    el.querySelector<HTMLElement>(sel)!.style.setProperty('--bd-img', url);

  set('.bd-stars-a', tileUrl(stars(0), VB_W, 400));
  set('.bd-stars-b', tileUrl(stars(1), VB_W, 400));
  set('.bd-clouds', tileUrl(clouds(), VB_W, 400));
  set('.bd-far', tileUrl(`<path d="${FAR}" fill="${C.far}"/>`));
  set('.bd-mid', tileUrl(`<path d="${MID}" fill="${C.mid}"/>${village()}`));
  set('.bd-near', tileUrl(`<path d="${NEAR}" fill="${C.near}"/>`));

  host.prepend(el);
}

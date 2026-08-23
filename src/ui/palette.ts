// The palette. Every colour in the game comes from here — there are no raw hex
// literals anywhere else in src/, and `tests/no-raw-colour.test.ts` enforces it.
//
// Two tiers:
//
//   PALETTE — art constants, consumed only by TypeScript that emits SVG
//             (backdrop, icons, avatar, steamer, findables). These deliberately
//             get NO CSS custom property: a data: URI SVG cannot read the page's
//             variables, so art colours have to be real values at build time.
//             Within TypeScript there is no duplication — those modules import
//             from here.
//
//   TOKENS  — the semantic layer the UI is built from, mirrored verbatim into
//             `src/styles/tokens.css`. That mirror is the ONE place a colour is
//             written twice, and `tests/palette.test.ts` checks both directions,
//             so editing one side without the other fails the suite.
//
// Palette source: the pastel low-poly reference clip — hills ramp green → aqua →
// lavender with atmospheric haze toward the horizon, clouds are flat white, and
// the only saturated things in the whole frame are the tiny rooftops. That is
// the rule the whole theme follows: a calm ground, and colour used sparingly so
// it actually means something.
//
// READ docs/DECISIONS.md § "Bright, and why the old rejection still stands"
// before changing anything here. Two rules in particular are load-bearing:
//
//   1. A GLOW IS DEAD ON A LIGHT GROUND. Glow is luminance addition and paper
//      has no headroom left. Depth comes from `--shadow-*` and separation comes
//      from the white sticker outline. Adding `drop-shadow` in a bright colour
//      just makes a smudge.
//   2. THE SKY GRADIENT IS STATIC. The reference clip was rejected as a video
//      partly because it started pink and ended orange, so its 10s loop popped.
//      Animating the sky through hues rebuilds that exact bug. Motion belongs to
//      the layer translations, which return to their start value by construction.

/**
 * White at a given alpha — the highlight language every piece of art shares.
 * A helper rather than a dozen near-identical constants, and it keeps the
 * "no raw colour outside this file" rule honest without inventing names like
 * `gleamSlightlyStrongerThanTheOtherGleam`.
 */
export const white = (a: number): string => `rgba(255,255,255,${a})`;

/** Art constants. TypeScript-only; these never become CSS variables. */
export const PALETTE = {
  /** Shared outline ink. Matches TOKENS['--ink'] so art and text agree. */
  ink: '#3d2f2a',

  /** The landscape. far → near is hue depth, not just lightness: haze lavender
   *  in the distance, aqua midground, fresh green underfoot. */
  bd: {
    far: '#cbbbdf', // hazy lavender ridge
    mid: '#a9dfcb', // aqua midground
    near: '#9ecb8a', // green foreground
    roof: '#f2879b', // the saturated pop — rooftops are the only loud thing
    wall: '#fdf6ec',
    window: '#ffc95e',
    cloud: '#ffffff',
    sparkle: '#ffffff',
  },

  /** Producer and findable icons. Every edge is MORE saturated than its fill,
   *  never merely darker — a pastel edge on a pastel ground is a smudge, and the
   *  edge stroke is the entire reason an icon reads as a sticker at 30px. */
  icon: {
    cream: '#fff3d6',
    creamEdge: '#d9a441',
    gold: '#ffc94e',
    goldEdge: '#c47a12',
    red: '#ff6d86',
    redEdge: '#c62f4f',
    wood: '#d9ab6f',
    woodEdge: '#8a5a28',
    stone: '#cfc9de',
    stoneEdge: '#6f6796',
    green: '#8ad86f',
    greenEdge: '#3f8235',
    blue: '#7fc9f0',
    blueEdge: '#2b76ad',
    /** Pleat/crease lines drawn on a cream fill. */
    creamLine: '#f7e3bd',
    /** Cheek blush — the one thing every real squishy in the reference has. */
    blush: 'rgba(240,130,140,0.5)',
  },

  /** The squishy itself. The outline is much stronger than the dusk version's
   *  `rgba(90,60,30,0.35)`: on paper, a soft edge lets pale bodies like `snow`
   *  and `classic` dissolve into the background entirely. */
  body: {
    line: 'rgba(94, 62, 34, 0.55)',
    lineSoft: 'rgba(94, 62, 34, 0.42)',
    lineFaint: 'rgba(94, 62, 34, 0.3)',
    highlight: 'rgba(255,255,255,0.5)',
    blush: 'rgba(240,120,135,0.5)',
    white: '#ffffff',
    catchlight: '#ffffff',
    heart: '#ff6d86',
    heartEdge: '#c62f4f',
    sparkle: '#ffe97a',
    shekelHalo: '#fdfbf5',
    shekelFill: '#2f8a4c',
    mouthInner: '#e8788a',
    tongueEdge: '#d05f72',
    drool: '#a8dcf0',
    droolEdge: '#6fb0cf',
    bowPink: '#ff6d86',
    bowPinkEdge: '#c62f4f',
    capBlue: '#4a90d9',
    capBlueEdge: '#33689e',
    flowerPink: '#f8a8c8',
    flowerPinkEdge: '#d87098',
    /** The bow's centre knot — a shade cooler than the flower pink. */
    bowKnot: '#f8a8b8',
    flowerGold: '#f7d060',
    flowerGoldEdge: '#d9a83a',
    sproutGreen: '#7ec46a',
    sproutGreenEdge: '#5a9a4a',
    chefWhite: '#fdfcf7',
    chefWhiteEdge: '#c6bfb0',
    bandaid: '#f7d9ab',
    bandaidEdge: '#d6ae79',
    shades: '#2c2c34',
  },

  /** The bamboo steamer the squishy sits in. */
  steamer: {
    rim: '#d9b585',
    body: '#c09a68',
    inner: '#9a7a4c',
    liner: '#fffaf0',
    linerFold: '#eae0cc',
    grain: '#a8875a',
  },

  /** The golden-frenzy findable paints the player's own design in this. */
  goldFill: '#ffb43d',

  /** Pulls every layer of the golden squishy into one metallic range. The old
   *  `brightness(1.08)` existed to lift gold off a dark ground; on paper it
   *  washes out, so it now sits just under 1. */
  goldFilter: 'sepia(0.7) saturate(2.4) hue-rotate(-12deg) brightness(0.98)',
} as const;

/**
 * The semantic layer. Mirrored verbatim into `src/styles/tokens.css`.
 * Keep the two in the same order — it makes the diff readable when one changes.
 */
export const TOKENS: Record<string, string> = {
  // --- ink ---
  '--ink': '#3d2f2a',
  '--ink-soft': '#6b5a52',
  '--ink-inverse': '#fffdf8',

  // --- surfaces ---
  // Opaque on purpose. The dusk build used nine different white tints at
  // 0.05–0.18 alpha as "panels", which worked only because whatever sat behind
  // them was dark. Over a bright landscape a 6%-white tint is not a surface, it
  // is nothing — so legibility now comes from opaque paper, and the backdrop is
  // free to be as colourful as it likes.
  '--surface': '#fffdf8',
  '--surface-raised': '#ffffff',
  '--surface-sunken': '#ece7f2',
  '--surface-veil': 'rgb(255 253 248 / 0.86)',
  '--hairline': 'rgb(61 47 42 / 0.12)',

  // --- brand ---
  // Split deliberately. `--accent` is for fills, gradients and borders;
  // `--accent-text` is the only one allowed to colour text. The dusk `#f0b25e`
  // measured 1.66:1 on paper, and it was being used for every price and every
  // gain in the shop — the exact numbers a purchase decision is made on.
  '--accent': '#ffb43d',
  '--accent-deep': '#f0912b',
  '--accent-text': '#9a5410',
  '--accent-ink': '#40230a',

  // --- events ---
  // Separated by HUE now, not by glow intensity, because glow does not survive
  // the move to a light ground.
  '--crit': '#e03a1c',
  '--find-gold': '#ff9d1f',
  '--find-air': '#38a6ff',
  '--find-common': '#ff7ab8',
  '--danger': '#c62740',
  '--success': '#2f9e5f',

  // --- depth ---
  /* Plum, never black — black over pastel reads as dirt rather than shadow. */
  '--shadow-tint': '92 74 128',
  '--shadow-sm': '0 1px 2px rgb(92 74 128 / 0.10)',
  '--shadow-md': '0 4px 12px rgb(92 74 128 / 0.14)',
  '--shadow-lg': '0 18px 44px rgb(92 74 128 / 0.22)',
  '--lift': 'drop-shadow(0 3px 5px rgb(92 74 128 / 0.28))',
  /** The white outline that keeps pale art readable on a pale sky. Doubled at
   *  a small radius reads as a real outline on arbitrary SVG; a single pass
   *  reads as a blur. */
  '--sticker': 'drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff)',

  // --- backdrop ---
  '--bd-sky-1': '#bfe4f7',
  '--bd-sky-2': '#d9edf8',
  '--bd-sky-3': '#f3e6dc',
  '--bd-sky-4': '#fcdcc4',
  '--bd-sun': 'rgb(255 236 170 / 0.55)',
  '--bd-rainbow-1': 'rgb(255 138 160 / 0.3)',
  '--bd-rainbow-2': 'rgb(255 214 128 / 0.3)',
  '--bd-rainbow-3': 'rgb(150 224 190 / 0.3)',
  '--bd-rainbow-4': 'rgb(150 196 240 / 0.3)',
  '--scrim-top': 'rgb(255 253 248 / 0.34)',
  '--scrim-bottom': 'rgb(255 253 248 / 0.2)',
};

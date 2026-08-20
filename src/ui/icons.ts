// Hand-drawn icons for producers and findables, in the same language as
// avatar.ts: soft rounded shapes, muted fills, a darker stroke of the same hue,
// one white highlight. Emoji were a placeholder and read as a different visual
// world from the squishy.
//
// Keyed by PRODUCER ID and by findable skin id, so nothing in config had to
// change: `iconSVG('stall')` just works, and anything without art here falls
// back to the emoji already in the config.
//
// viewBox is 0 0 100 100 for every icon, so they are interchangeable and scale
// to any size. Most are drawn at 30-50px in the shop and the background crowd,
// so detail is deliberately low — thin lines and small text vanish at that size
// (the same lesson the `shekel` eyes taught in avatar.ts).

const INK = '#3a2e26';
const CREAM = '#f6e7c8';
const CREAM_EDGE = '#cfae7c';
const GOLD = '#f2c14e';
const GOLD_EDGE = '#c9922f';
const RED = '#e8607a';
const RED_EDGE = '#c44860';
const WOOD = '#c9a06a';
const WOOD_EDGE = '#9d7442';
const STONE = '#b9b3c9';
const STONE_EDGE = '#867e9b';
const GREEN = '#7ec46a';
const GREEN_EDGE = '#54924a';
const BLUE = '#7fb8e0';
const BLUE_EDGE = '#4d87b3';

/** A soft white highlight, the same trick the squishy's body uses. */
const shine = (cx: number, cy: number, rx: number, ry: number, rot = -20) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(255,255,255,0.4)" transform="rotate(${rot} ${cx} ${cy})"/>`;

const ART: Record<string, string> = {
  // ---------- producers ----------
  apprentice: `
    <ellipse cx="50" cy="60" rx="30" ry="27" fill="${CREAM}" stroke="${CREAM_EDGE}" stroke-width="3"/>
    <ellipse cx="50" cy="34" rx="7" ry="5" fill="${CREAM}" stroke="${CREAM_EDGE}" stroke-width="2.5"/>
    <path d="M50 34 C 48 40 47 44 46 48 M50 34 C 52 40 53 44 54 48" fill="none" stroke="${CREAM_EDGE}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="40" cy="60" r="3.5" fill="${INK}"/>
    <circle cx="60" cy="60" r="3.5" fill="${INK}"/>
    <path d="M45 70 Q 50 75 55 70" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="33" cy="68" rx="5" ry="3.5" fill="rgba(240,130,140,0.5)"/>
    <ellipse cx="67" cy="68" rx="5" ry="3.5" fill="rgba(240,130,140,0.5)"/>
    ${shine(38, 48, 9, 6)}`,

  stall: `
    <rect x="18" y="52" width="64" height="32" rx="4" fill="${WOOD}" stroke="${WOOD_EDGE}" stroke-width="3"/>
    <path d="M12 52 L20 30 L80 30 L88 52 Z" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 30 L26 52 M50 30 L50 52 M68 30 L74 52" stroke="rgba(255,255,255,0.6)" stroke-width="5"/>
    <ellipse cx="50" cy="66" rx="11" ry="9" fill="${CREAM}" stroke="${CREAM_EDGE}" stroke-width="2.5"/>
    ${shine(42, 62, 4, 2.5)}`,

  kindergarten: `
    <circle cx="27" cy="32" r="11" fill="${WOOD}" stroke="${WOOD_EDGE}" stroke-width="3"/>
    <circle cx="73" cy="32" r="11" fill="${WOOD}" stroke="${WOOD_EDGE}" stroke-width="3"/>
    <circle cx="50" cy="56" r="31" fill="${WOOD}" stroke="${WOOD_EDGE}" stroke-width="3"/>
    <ellipse cx="50" cy="66" rx="14" ry="11" fill="${CREAM}" stroke="${CREAM_EDGE}" stroke-width="2"/>
    <circle cx="39" cy="50" r="4" fill="${INK}"/>
    <circle cx="61" cy="50" r="4" fill="${INK}"/>
    <ellipse cx="50" cy="62" rx="4" ry="3" fill="${INK}"/>
    ${shine(36, 40, 8, 5)}`,

  school: `
    <rect x="16" y="46" width="68" height="38" rx="4" fill="${CREAM}" stroke="${CREAM_EDGE}" stroke-width="3"/>
    <path d="M10 46 L50 22 L90 46 Z" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="42" y="62" width="16" height="22" rx="2" fill="${WOOD}" stroke="${WOOD_EDGE}" stroke-width="2.5"/>
    <rect x="24" y="56" width="12" height="12" rx="2" fill="${BLUE}" stroke="${BLUE_EDGE}" stroke-width="2.5"/>
    <rect x="64" y="56" width="12" height="12" rx="2" fill="${BLUE}" stroke="${BLUE_EDGE}" stroke-width="2.5"/>
    <path d="M50 22 L50 10" stroke="${WOOD_EDGE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M50 11 L66 15 L50 20 Z" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="2" stroke-linejoin="round"/>`,

  bakery: `
    <rect x="16" y="50" width="68" height="34" rx="4" fill="${CREAM}" stroke="${CREAM_EDGE}" stroke-width="3"/>
    <path d="M12 50 Q 16 34 26 34 L74 34 Q 84 34 88 50 Z" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M34 34 L30 50 M50 34 L50 50 M66 34 L70 50" stroke="rgba(255,255,255,0.55)" stroke-width="5"/>
    <ellipse cx="50" cy="68" rx="17" ry="13" fill="${WOOD}" stroke="${WOOD_EDGE}" stroke-width="3"/>
    <path d="M38 64 Q 50 56 62 64" fill="none" stroke="#f7e3bd" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M40 72 Q 50 66 60 72" fill="none" stroke="#f7e3bd" stroke-width="3" stroke-linecap="round"/>
    ${shine(41, 62, 6, 3)}`,

  factory: `
    <path d="M14 84 L14 54 L36 62 L36 46 L58 54 L58 40 L86 40 L86 84 Z" fill="${STONE}" stroke="${STONE_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="66" y="16" width="12" height="26" rx="2" fill="${STONE}" stroke="${STONE_EDGE}" stroke-width="3"/>
    <circle cx="72" cy="12" r="7" fill="rgba(255,255,255,0.55)"/>
    <circle cx="60" cy="8" r="5" fill="rgba(255,255,255,0.35)"/>
    <rect x="22" y="68" width="11" height="16" rx="2" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="2"/>
    <rect x="44" y="68" width="11" height="16" rx="2" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="2"/>
    <rect x="66" y="68" width="11" height="16" rx="2" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="2"/>`,

  army: `
    <path d="M16 62 Q 16 26 50 26 Q 84 26 84 62 Z" fill="${GREEN}" stroke="${GREEN_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="10" y="60" width="80" height="12" rx="6" fill="${GREEN}" stroke="${GREEN_EDGE}" stroke-width="3"/>
    <path d="M50 34 l4.4 10.4 10.6 1.4 -7.9 7.3 2.2 10.6 -9.3-5.4 -9.3 5.4 2.2-10.6 -7.9-7.3 10.6-1.4 Z" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="2" stroke-linejoin="round"/>
    ${shine(32, 40, 9, 5)}`,

  city: `
    <rect x="12" y="44" width="22" height="42" rx="3" fill="${STONE}" stroke="${STONE_EDGE}" stroke-width="3"/>
    <rect x="38" y="24" width="24" height="62" rx="3" fill="${BLUE}" stroke="${BLUE_EDGE}" stroke-width="3"/>
    <rect x="66" y="52" width="22" height="34" rx="3" fill="${STONE}" stroke="${STONE_EDGE}" stroke-width="3"/>
    <g fill="${GOLD}">
      <rect x="18" y="52" width="5" height="6" rx="1"/><rect x="26" y="52" width="5" height="6" rx="1"/>
      <rect x="18" y="64" width="5" height="6" rx="1"/><rect x="26" y="64" width="5" height="6" rx="1"/>
      <rect x="44" y="34" width="5" height="6" rx="1"/><rect x="52" y="34" width="5" height="6" rx="1"/>
      <rect x="44" y="46" width="5" height="6" rx="1"/><rect x="52" y="46" width="5" height="6" rx="1"/>
      <rect x="44" y="58" width="5" height="6" rx="1"/><rect x="52" y="58" width="5" height="6" rx="1"/>
      <rect x="72" y="60" width="5" height="6" rx="1"/><rect x="80" y="60" width="5" height="6" rx="1"/>
    </g>`,

  space: `
    <path d="M50 10 Q 68 32 68 58 L32 58 Q 32 32 50 10 Z" fill="${CREAM}" stroke="${CREAM_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="36" r="9" fill="${BLUE}" stroke="${BLUE_EDGE}" stroke-width="3"/>
    <path d="M32 46 L18 68 L32 62 Z" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M68 46 L82 68 L68 62 Z" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="38" y="56" width="24" height="8" rx="3" fill="${STONE}" stroke="${STONE_EDGE}" stroke-width="2.5"/>
    <path d="M42 66 Q 50 90 58 66 Z" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="2.5" stroke-linejoin="round"/>`,

  boss: `
    <path d="M16 70 L22 32 L38 50 L50 24 L62 50 L78 32 L84 70 Z" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="16" y="68" width="68" height="12" rx="5" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="3"/>
    <circle cx="50" cy="60" r="5" fill="${RED}" stroke="${RED_EDGE}" stroke-width="2"/>
    <circle cx="30" cy="62" r="4" fill="${BLUE}" stroke="${BLUE_EDGE}" stroke-width="2"/>
    <circle cx="70" cy="62" r="4" fill="${BLUE}" stroke="${BLUE_EDGE}" stroke-width="2"/>
    ${shine(34, 44, 8, 4)}`,

  // ---------- findable skins ----------
  coin: `
    <circle cx="50" cy="50" r="34" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="4"/>
    <circle cx="50" cy="50" r="24" fill="none" stroke="${GOLD_EDGE}" stroke-width="3" opacity="0.7"/>
    <path d="M50 34 L50 66 M42 40 L58 40 M42 60 L58 60" stroke="${GOLD_EDGE}" stroke-width="4" stroke-linecap="round"/>
    ${shine(36, 34, 10, 6)}`,

  bill: `
    <rect x="10" y="28" width="80" height="44" rx="6" fill="${GREEN}" stroke="${GREEN_EDGE}" stroke-width="3.5"/>
    <circle cx="50" cy="50" r="13" fill="rgba(255,255,255,0.6)" stroke="${GREEN_EDGE}" stroke-width="2.5"/>
    <circle cx="22" cy="38" r="4" fill="rgba(255,255,255,0.5)"/>
    <circle cx="78" cy="62" r="4" fill="rgba(255,255,255,0.5)"/>
    ${shine(30, 38, 10, 5)}`,

  gem: `
    <path d="M50 12 L84 40 L50 88 L16 40 Z" fill="${BLUE}" stroke="${BLUE_EDGE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M16 40 L84 40 M50 12 L36 40 L50 88 M50 12 L64 40" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3"/>
    ${shine(34, 28, 8, 4)}`,

  star: `
    <path d="M50 8 l12 26 28 3.4 -21 19.4 5.8 28 -24.8-14.4 -24.8 14.4 5.8-28 -21-19.4 28-3.4 Z"
          fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="3.5" stroke-linejoin="round"/>
    ${shine(38, 34, 8, 4)}`,

  envelope: `
    <rect x="22" y="12" width="56" height="76" rx="7" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3.5"/>
    <path d="M22 30 Q 50 46 78 30" fill="none" stroke="${RED_EDGE}" stroke-width="3"/>
    <circle cx="50" cy="52" r="13" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="3"/>
    ${shine(35, 26, 7, 4)}`,

  // A wrapped candy, not the fortune cookie this replaced: a folded cookie is
  // inherently ambiguous at 30px (it read as two eggs), and skins are purely
  // cosmetic, so a clear silhouette beats a thematic one.
  candy: `
    <path d="M22 34 L38 50 L22 66 Z" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M78 34 L62 50 L78 66 Z" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="50" cy="50" rx="20" ry="18" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3"/>
    <path d="M40 44 Q 50 52 40 58 M56 42 Q 46 50 56 58" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="4" stroke-linecap="round"/>
    ${shine(41, 40, 6, 3)}`,

  gift: `
    <path d="M50 20 Q 30 6 22 18 Q 30 28 50 26 Q 70 28 78 18 Q 70 6 50 20 Z" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="14" y="30" width="72" height="18" rx="4" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="3"/>
    <rect x="20" y="46" width="60" height="40" rx="4" fill="${RED}" stroke="${RED_EDGE}" stroke-width="3"/>
    <rect x="42" y="30" width="16" height="56" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="3"/>
    ${shine(32, 58, 8, 5)}`,
};

/** Ids that have hand-drawn art. */
export function hasIcon(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ART, id);
}

/** Inline SVG markup for `id`, or '' when there is no art for it. */
export function iconSVG(id: string, className = 'game-icon'): string {
  const art = ART[id];
  if (!art) return '';
  return `<svg class="${className}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${art}</svg>`;
}

/**
 * Paint an icon into `el`: drawn art when we have it, otherwise the emoji
 * `fallback`. Keeping the fallback means a new producer or skin still renders
 * something the day it is added, before anyone draws for it.
 */
export function renderIcon(el: HTMLElement, id: string, fallback: string): void {
  const svg = iconSVG(id);
  if (svg) el.innerHTML = svg;
  else el.textContent = fallback;
}

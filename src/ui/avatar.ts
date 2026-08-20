// Renders a player's squishy design as layered inline SVG. One shared
// coordinate space (viewBox 0 0 200 200, dumpling sits on y≈170) so parts
// always align. New eyes/mouths/accessories = a new case here + a config entry.
import { BODY_COLORS } from '../game/config/parts';
import type { AvatarDesign } from '../game/state';

const INK = '#3a2e26';

function bodyLayer(fill: string): string {
  return `
  <g>
    <path d="M100 34
             C 138 34 166 66 169 108
             C 172 148 142 170 100 170
             C 58 170 28 148 31 108
             C 34 66 62 34 100 34 Z"
          fill="${fill}" stroke="rgba(90,60,30,0.35)" stroke-width="3"/>
    <!-- pleats gathered at the top, like a real dumpling squishy -->
    <path d="M100 34 C 97 44 95 52 94 60" fill="none" stroke="rgba(90,60,30,0.3)" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M100 34 C 103 44 105 52 106 60" fill="none" stroke="rgba(90,60,30,0.3)" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M88 37 C 84 46 81 53 79 62" fill="none" stroke="rgba(90,60,30,0.25)" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M112 37 C 116 46 119 53 121 62" fill="none" stroke="rgba(90,60,30,0.25)" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M76 43 C 71 51 67 58 64 66" fill="none" stroke="rgba(90,60,30,0.2)" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M124 43 C 129 51 133 58 136 66" fill="none" stroke="rgba(90,60,30,0.2)" stroke-width="2.5" stroke-linecap="round"/>
    <!-- top knot -->
    <ellipse cx="100" cy="32" rx="10" ry="7" fill="${fill}" stroke="rgba(90,60,30,0.35)" stroke-width="2.5"/>
    <!-- soft highlight -->
    <ellipse cx="72" cy="82" rx="22" ry="14" fill="rgba(255,255,255,0.35)" transform="rotate(-20 72 82)"/>
    <!-- blush -->
    <ellipse cx="62" cy="122" rx="11" ry="7" fill="rgba(240,130,140,0.45)"/>
    <ellipse cx="138" cy="122" rx="11" ry="7" fill="rgba(240,130,140,0.45)"/>
  </g>`;
}

function eyesLayer(id: string): string {
  switch (id) {
    case 'happy':
      return `<g fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round">
        <path d="M66 112 Q 76 100 86 112"/><path d="M114 112 Q 124 100 134 112"/></g>`;
    case 'sleepy':
      return `<g fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round">
        <path d="M66 108 Q 76 116 86 108"/><path d="M114 108 Q 124 116 134 108"/>
        <path d="M84 118 l6 3 M136 118 l-6 3" stroke-width="3"/></g>`;
    case 'star':
      return `<g fill="${INK}">
        <path d="M76 100 l3.2 7.6 7.8 1 -5.8 5.4 1.6 7.8 -6.8-4 -6.8 4 1.6-7.8 -5.8-5.4 7.8-1 Z"/>
        <path d="M124 100 l3.2 7.6 7.8 1 -5.8 5.4 1.6 7.8 -6.8-4 -6.8 4 1.6-7.8 -5.8-5.4 7.8-1 Z"/></g>`;
    case 'wink':
      return `<g>
        <path d="M66 112 Q 76 100 86 112" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="124" cy="110" r="7" fill="${INK}"/>
        <circle cx="126.5" cy="107.5" r="2.2" fill="#fff"/></g>`;
    case 'hearts':
      return `<g fill="#e8607a" stroke="#c44860" stroke-width="1.5">
        <path d="M76 119 C 68 112, 64 105, 69 101 C 72 98.5, 75.5 100.5, 76 103.5 C 76.5 100.5, 80 98.5, 83 101 C 88 105, 84 112, 76 119 Z"/>
        <path d="M124 119 C 116 112, 112 105, 117 101 C 120 98.5, 123.5 100.5, 124 103.5 C 124.5 100.5, 128 98.5, 131 101 C 136 105, 132 112, 124 119 Z"/></g>`;
    case 'big':
      return `<g>
        <circle cx="76" cy="110" r="11" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
        <circle cx="124" cy="110" r="11" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
        <circle cx="77" cy="112" r="4.5" fill="${INK}"/><circle cx="123" cy="112" r="4.5" fill="${INK}"/></g>`;
    case 'closed':
      return `<g fill="none" stroke="${INK}" stroke-linecap="round">
        <path d="M67 111 L85 111" stroke-width="5"/><path d="M115 111 L133 111" stroke-width="5"/>
        <path d="M67 115 l-3.5 4 M85 115 l3.5 4 M115 115 l-3.5 4 M133 115 l3.5 4" stroke-width="2.5"/></g>`;
    case 'sparkly':
      return `<g>
        <ellipse cx="76" cy="110" rx="11" ry="13" fill="${INK}"/>
        <ellipse cx="124" cy="110" rx="11" ry="13" fill="${INK}"/>
        <circle cx="79" cy="105" r="4" fill="#fff"/><circle cx="127" cy="105" r="4" fill="#fff"/>
        <circle cx="72.5" cy="116" r="2" fill="#fff" opacity="0.75"/>
        <circle cx="120.5" cy="116" r="2" fill="#fff" opacity="0.75"/>
        <path d="M89 97 l1.7 4.3 4.3 1.7 -4.3 1.7 -1.7 4.3 -1.7-4.3 -4.3-1.7 4.3-1.7 Z" fill="#ffe97a"/>
        <path d="M137 97 l1.7 4.3 4.3 1.7 -4.3 1.7 -1.7 4.3 -1.7-4.3 -4.3-1.7 4.3-1.7 Z" fill="#ffe97a"/></g>`;
    case 'dizzy':
      return `<g fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round">
        <path d="M76 110 a2 2 0 1 1 -2 2 a4.5 4.5 0 1 1 4.5 -4.5 a7 7 0 1 1 -7 7 a9.5 9.5 0 1 1 9.5 -9.5"/>
        <path d="M124 110 a2 2 0 1 1 -2 2 a4.5 4.5 0 1 1 4.5 -4.5 a7 7 0 1 1 -7 7 a9.5 9.5 0 1 1 9.5 -9.5"/></g>`;
    case 'shekel':
      // ₪ as text, not a path: the glyph ships with system-ui on every target
      // platform and hand-drawing it at this size turns to mush. Cream halo so
      // it stays readable against dark body colours and at thumbnail size.
      return `<g font-family="system-ui, -apple-system, Arial, sans-serif"
        font-weight="700" font-size="32" text-anchor="middle">
        <g stroke="#fdfbf5" stroke-width="5" stroke-linejoin="round" fill="#fdfbf5">
          <text x="76" y="122">₪</text><text x="124" y="122">₪</text></g>
        <g fill="#2f8a4c"><text x="76" y="122">₪</text><text x="124" y="122">₪</text></g></g>`;
    case 'dot':
    default:
      return `<g fill="${INK}">
        <circle cx="76" cy="110" r="7"/><circle cx="124" cy="110" r="7"/>
        <circle cx="78.5" cy="107.5" r="2.2" fill="#fff"/><circle cx="126.5" cy="107.5" r="2.2" fill="#fff"/></g>`;
  }
}

function mouthLayer(id: string): string {
  switch (id) {
    case 'open':
      return `<g><ellipse cx="100" cy="136" rx="11" ry="13" fill="${INK}"/>
        <ellipse cx="100" cy="142" rx="6.5" ry="6" fill="#e8788a"/></g>`;
    case 'cat':
      return `<path d="M84 132 Q 92 141 100 132 Q 108 141 116 132" fill="none"
        stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    case 'tongue':
      return `<g><path d="M84 130 Q 100 143 116 130" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
        <path d="M94 136 Q 100 148 106 136 Z" fill="#e8788a" stroke="#d05f72" stroke-width="1.5"/></g>`;
    case 'kiss':
      return `<ellipse cx="100" cy="133" rx="6" ry="7" fill="${INK}"/>`;
    case 'grin':
      return `<g><path d="M82 128 Q 100 152 118 128 Z" fill="${INK}"/>
        <path d="M92 139 Q 100 147 108 139 L 108 141 Q 100 149 92 141 Z" fill="#e8788a"/></g>`;
    case 'wavy':
      return `<path d="M84 132 Q 90 127 96 132 Q 102 137 108 132 Q 111 129.5 116 132"
        fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    case 'ooh':
      return `<g><circle cx="100" cy="134" r="7.5" fill="${INK}"/>
        <circle cx="100" cy="136.5" r="3.5" fill="#e8788a"/></g>`;
    case 'smirk':
      return `<path d="M86 131 Q 100 142 115 127" fill="none" stroke="${INK}"
        stroke-width="5" stroke-linecap="round"/>`;
    case 'fangs':
      return `<g>
        <path d="M84 130 Q 100 144 116 130" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
        <path d="M91.5 134.5 l4.5 0.8 -2.8 5.6 Z" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M104 135.3 l4.5 -0.8 -1.7 5.9 Z" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/></g>`;
    case 'drool':
      return `<g>
        <path d="M84 129 Q 100 145 116 129" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
        <path d="M109 139 Q 113.5 147 110 152.5 Q 105.5 148 109 139 Z"
          fill="#a8dcf0" stroke="#6fb0cf" stroke-width="1.5"/></g>`;
    case 'smile':
    default:
      return `<path d="M84 130 Q 100 144 116 130" fill="none" stroke="${INK}"
        stroke-width="5" stroke-linecap="round"/>`;
  }
}

function accessoryLayer(id: string): string {
  switch (id) {
    case 'bow':
      return `<g transform="translate(136 46) rotate(18)">
        <path d="M0 0 L-20 -11 Q -25 0 -20 11 Z" fill="#e8607a" stroke="#c44860" stroke-width="2"/>
        <path d="M0 0 L20 -11 Q 25 0 20 11 Z" fill="#e8607a" stroke="#c44860" stroke-width="2"/>
        <circle cx="0" cy="0" r="5.5" fill="#f8a8b8" stroke="#c44860" stroke-width="2"/></g>`;
    case 'cap':
      return `<g>
        <path d="M64 42 Q 100 8 136 42 L 136 52 Q 100 36 64 52 Z" fill="#4a90d9" stroke="#33689e" stroke-width="2.5"/>
        <path d="M128 44 Q 158 44 164 56 Q 146 60 130 54 Z" fill="#4a90d9" stroke="#33689e" stroke-width="2.5"/>
        <circle cx="100" cy="22" r="6" fill="#33689e"/></g>`;
    case 'glasses':
      return `<g fill="none" stroke="${INK}" stroke-width="4.5">
        <circle cx="76" cy="110" r="16"/><circle cx="124" cy="110" r="16"/>
        <path d="M92 110 Q 100 104 108 110"/>
        <path d="M60 108 L 44 100 M140 108 L 156 100"/></g>`;
    case 'flower':
      return `<g transform="translate(138 48) rotate(15)">
        <g fill="#f8a8c8" stroke="#d87098" stroke-width="1.5">
          <ellipse cx="0" cy="-9" rx="5.5" ry="7"/>
          <ellipse cx="8.5" cy="-2.5" rx="7" ry="5.5" transform="rotate(50 8.5 -2.5)"/>
          <ellipse cx="5" cy="8" rx="5.5" ry="7" transform="rotate(150 5 8)"/>
          <ellipse cx="-5" cy="8" rx="5.5" ry="7" transform="rotate(-150 -5 8)"/>
          <ellipse cx="-8.5" cy="-2.5" rx="7" ry="5.5" transform="rotate(-50 -8.5 -2.5)"/>
        </g>
        <circle cx="0" cy="0" r="4.5" fill="#f7d060" stroke="#d9a83a" stroke-width="1.5"/></g>`;
    case 'sprout':
      return `<g>
        <path d="M100 30 C 100 24 100 20 100 14" fill="none" stroke="#5a9a4a" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M100 16 C 94 16 88 12 87 5 C 94 4 100 8 100 16 Z" fill="#7ec46a" stroke="#5a9a4a" stroke-width="2"/>
        <path d="M100 16 C 106 16 112 12 113 5 C 106 4 100 8 100 16 Z" fill="#7ec46a" stroke="#5a9a4a" stroke-width="2"/></g>`;
    case 'headphones':
      return `<g>
        <path d="M56 84 Q 100 30 144 84" fill="none" stroke="#e8607a" stroke-width="8" stroke-linecap="round"/>
        <rect x="46" y="76" width="16" height="26" rx="8" fill="#e8607a" stroke="#c44860" stroke-width="2"/>
        <rect x="138" y="76" width="16" height="26" rx="8" fill="#e8607a" stroke="#c44860" stroke-width="2"/></g>`;
    case 'chef':
      return `<g fill="#fdfcf7" stroke="#c6bfb0" stroke-width="2.5" stroke-linejoin="round">
        <path d="M71 45 Q 60 20 79 18 Q 83 5 100 5 Q 117 5 121 18 Q 140 20 129 45 Z"/>
        <rect x="69" y="41" width="62" height="13" rx="5"/></g>`;
    case 'sunglasses':
      return `<g>
        <path d="M58 101 L142 101" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
        <path d="M61 101 L94 101 Q 94 122 77.5 122 Q 61 122 61 101 Z" fill="#2c2c34" stroke="${INK}" stroke-width="3"/>
        <path d="M106 101 L139 101 Q 139 122 122.5 122 Q 106 122 106 101 Z" fill="#2c2c34" stroke="${INK}" stroke-width="3"/>
        <path d="M66 108 l7.5 -3.5 M111 108 l7.5 -3.5" stroke="rgba(255,255,255,0.5)"
          stroke-width="3" stroke-linecap="round"/></g>`;
    case 'bandaid':
      return `<g transform="translate(127 80) rotate(-25)">
        <rect x="-16" y="-6" width="32" height="12" rx="5.5" fill="#f7d9ab" stroke="#d6ae79" stroke-width="2"/>
        <g fill="#d6ae79"><circle cx="-5" cy="-1.5" r="1.3"/><circle cx="0" cy="1.5" r="1.3"/>
        <circle cx="5" cy="-1.5" r="1.3"/></g></g>`;
    case 'scarf':
      return `<g fill="#e8607a" stroke="#c44860" stroke-width="2.5" stroke-linejoin="round">
        <path d="M54 149 Q 100 167 146 149 Q 146 161 100 177 Q 54 161 54 149 Z"/>
        <path d="M118 165 L 131 188 L 116 186 L 110 169 Z"/></g>`;
    case 'none':
    default:
      return '';
  }
}

/**
 * `fillOverride` paints the body a colour that is NOT in the designer palette —
 * the golden dumpling renders the player's own design in gold this way, so a
 * 'gold' entry never has to leak into BODY_COLORS and show up as a pickable
 * body colour.
 */
export function avatarSVG(
  design: AvatarDesign,
  cssClass = '',
  fillOverride?: string,
): string {
  const color =
    BODY_COLORS.find((c) => c.id === design.color) ?? BODY_COLORS[0];
  return `<svg class="${cssClass}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${bodyLayer(fillOverride ?? color.fill)}
    ${eyesLayer(design.eyes)}
    ${mouthLayer(design.mouth)}
    ${accessoryLayer(design.accessory)}
  </svg>`;
}

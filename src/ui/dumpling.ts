// The product: the squishy in its steamer, deforming under the finger.
// Squash-and-stretch is pure composited CSS transforms driven by a damped
// spring in rAF — no layout, no paint, 60fps on mid-range phones.
// Narrow API (press via pointer events, setAvatar) so a WebGL mesh could
// replace the internals in v2 without touching game code.
//
// This loop is PRIVATE and owns .squish-wrap's transform. Anything driven from
// the game loop in game/loop.ts that writes that property gets clobbered here
// one frame later — idle behaviour belongs in frame() below, not in tickGolden.
import { springStep } from './spring';

const STEAMER_SVG = `
<svg viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="160" cy="84" rx="150" ry="40" fill="#c9a875"/>
  <path d="M10 84 L10 110 Q 10 138 60 144 L 260 144 Q 310 138 310 110 L310 84
           Q 310 122 160 122 Q 10 122 10 84 Z" fill="#b08e5e"/>
  <ellipse cx="160" cy="84" rx="132" ry="32" fill="#8a6b42"/>
  <ellipse cx="160" cy="82" rx="126" ry="29" fill="#f6f1e6"/>
  <g stroke="#e3dbc8" stroke-width="3" fill="none">
    <path d="M60 78 Q 160 104 260 78"/>
    <path d="M80 70 Q 160 92 240 70"/>
  </g>
  <g stroke="#9c7c50" stroke-width="2" opacity="0.6">
    <line x1="40" y1="96" x2="40" y2="132"/>
    <line x1="100" y1="106" x2="100" y2="141"/>
    <line x1="160" y1="108" x2="160" y2="143"/>
    <line x1="220" y1="106" x2="220" y2="141"/>
    <line x1="280" y1="96" x2="280" y2="132"/>
  </g>
</svg>`;

// Idle-life feel knobs. A frozen hero between taps was the loudest half of
// Gal's "everything must move" note — the golden findable had an idle bob while
// the star of the game sat perfectly still.
const BREATH_PERIOD_MS = 3600;
const BREATH_AMOUNT = 0.012; // ~1% — a breath, not a pulse
const BLINK_MS = 120;
const BLINK_MIN_MS = 3000;
const BLINK_MAX_MS = 7000;
const GLANCE_MS = 900;
const GLANCE_DEG = 2.5;
const GLANCE_MIN_MS = 6000;
const GLANCE_MAX_MS = 14000;

export interface DumplingApi {
  setAvatar(svgMarkup: string): void;
}

export function initDumpling(
  stage: HTMLElement,
  onSquish: (clientX: number, clientY: number) => void,
): DumplingApi {
  stage.innerHTML = `
    <div class="steam"><span></span><span></span><span></span></div>
    <div class="squish-hit">
      <div class="squish-wrap" id="squish-wrap"></div>
      <div class="steamer">${STEAMER_SVG}</div>
    </div>`;
  const wrap = stage.querySelector<HTMLElement>('.squish-wrap')!;
  const hit = stage.querySelector<HTMLElement>('.squish-hit')!;

  // spring state: s is squish amount 0..1, lean is -1..1 toward the finger
  let s = 0;
  let vel = 0;
  let target = 0;
  let lean = 0;
  let pressed = 0; // active pointer count
  let blinking = false;

  let lastTapAt = -Infinity; // drives the slow-rise tail; see spring.ts

  hit.addEventListener('pointerdown', (e) => {
    pressed++;
    target = 1;
    lastTapAt = performance.now();
    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    lean = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
    onSquish(e.clientX, e.clientY);
  });
  const release = () => {
    pressed = Math.max(0, pressed - 1);
    if (pressed === 0) target = 0;
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // Idle life. All of it composes into the ONE transform written below —
  // a CSS animation on .squish-wrap would fight this loop for the property,
  // the same trap that already forced the wrap to centre with inset-inline.
  let nextBlinkAt = 0;
  let blinkUntil = 0;
  let nextGlanceAt = 0;
  let glanceUntil = 0;
  let glanceDir = 1;
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    ({ s, vel } = springStep(s, vel, target, dt, now - lastTapAt));

    // Breathing, blinking and glancing only while the squishy is at rest —
    // they must never fight an active squish for the same transform.
    const resting = target === 0 && Math.abs(s) < 0.02;
    const alive = resting && !still.matches;

    let breath = 0;
    if (alive) {
      breath = Math.sin(now / BREATH_PERIOD_MS * Math.PI * 2) * BREATH_AMOUNT;

      if (now >= nextBlinkAt) {
        blinkUntil = now + BLINK_MS;
        nextBlinkAt = now + BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
      }
      if (now >= nextGlanceAt) {
        glanceUntil = now + GLANCE_MS;
        glanceDir = Math.random() < 0.5 ? -1 : 1;
        nextGlanceAt = now + GLANCE_MIN_MS + Math.random() * (GLANCE_MAX_MS - GLANCE_MIN_MS);
      }
    }

    // The blink group is absent for eyes that are already shut (see avatar.ts),
    // in which case there is nothing to swap and the query simply finds nothing.
    const blink = wrap.querySelector<SVGElement>('.eyes-blink');
    if (blink) {
      const shut = alive && now < blinkUntil;
      if (shut !== blinking) {
        blinking = shut;
        blink.style.display = shut ? '' : 'none';
        wrap.querySelector<SVGElement>('.eyes')!.style.display = shut ? 'none' : '';
      }
    }

    const glancing = alive && now < glanceUntil;
    const tilt = glancing ? glanceDir * GLANCE_DEG : 0;
    const sx = 1 + 0.34 * s + breath;
    const sy = 1 - 0.42 * s + breath;
    const skew = -lean * 13 * s;
    wrap.style.transform =
      `translateZ(0) rotate(${tilt}deg) skewX(${skew}deg) scale(${sx}, ${sy})`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setAvatar(svgMarkup: string) {
      wrap.innerHTML = svgMarkup;
    },
  };
}

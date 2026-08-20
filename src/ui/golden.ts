// The golden dumpling: the DOM half of the variable-reward mechanic. Owns one
// element and its lifetime; all timing decisions come from game/golden.ts.
// Driven by a single tick(now) from the existing rAF loop — no second loop.
import { GOLDEN_LIFETIME_MS } from '../game/config/balance';
import { rollNextSpawn } from '../game/golden';
import { STR } from '../i18n/strings.he';
import type { AvatarDesign } from '../game/state';
import { avatarSVG } from './avatar';

const GOLD = '#f3c033';
// The fill override only reaches the body, so accessories kept their own
// colours — a "golden" squishy wearing a bright blue baseball cap. A CSS
// sepia+saturate pass over the whole SVG pulls every layer into the same
// metallic range, which is also what the real toy's gold variant looks like.
const GOLD_FILTER = 'sepia(0.75) saturate(2.6) hue-rotate(-12deg) brightness(1.08)';

export interface GoldenApi {
  /** Called every frame from the game loop. */
  tick(now: number): void;
  /** Re-render with a new design (after the player edits their squishy). */
  setAvatar(design: AvatarDesign): void;
  /** Force one to appear right now — used by tests and the dev console. */
  spawnNow(now: number): void;
}

export function initGolden(
  host: HTMLElement,
  getAvatar: () => AvatarDesign,
  onCatch: (x: number, y: number) => void,
  rand: () => number = Math.random,
): GoldenApi {
  const el = document.createElement('button');
  el.className = 'golden';
  el.type = 'button';
  el.hidden = true;
  el.setAttribute('aria-label', STR.goldenLabel);
  host.appendChild(el);

  let nextAt = rollNextSpawn(0, rand); // re-based on the first tick
  let based = false;
  let despawnAt = 0;
  let alive = false;

  const render = () => {
    el.innerHTML = avatarSVG(getAvatar(), 'golden-svg', GOLD);
    const svg = el.querySelector('svg');
    if (svg) svg.style.filter = GOLD_FILTER;
  };

  const hide = () => {
    alive = false;
    el.hidden = true;
    el.classList.remove('golden-in');
  };

  const spawn = (now: number) => {
    render();
    el.hidden = false; // must be laid out before it can be measured
    alive = true;
    // Protect the FACE, not the whole hero. On a phone the squishy is ~70% of
    // the stage width, so "never overlap the hero at all" is unachievable —
    // there is no free lane wide enough. What actually matters is that the
    // golden one never covers the eyes/mouth or crowds the tap target, so it
    // sits in the strip above the face. Measured every spawn, because the stage
    // is far shorter in landscape than at 430x900.
    const stage = host.getBoundingClientRect();
    const heroBox = host
      .querySelector('.squish-wrap')
      ?.querySelector('svg')
      ?.getBoundingClientRect();
    const size = el.offsetWidth || stage.width * 0.2;
    const maxX = Math.max(0, stage.width - size);
    const GAP = 8;
    // The face starts ~35% down the SVG's box (eyes sit at viewBox y≈110/200,
    // and the drawn body starts at y≈26 — see bodyLayer in ui/avatar.ts).
    const faceTop = heroBox && heroBox.width > 0 ? heroBox.top + heroBox.height * 0.35 : stage.bottom;
    const band = Math.max(0, faceTop - GAP - size - stage.top);
    const x = rand() * maxX;
    const y = band > 4 ? rand() * band : 0;
    // Positioned with left/top, never transform (the bob/pop animations own it).
    el.style.insetInlineStart = 'auto';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    // restart the entry animation
    el.classList.remove('golden-in');
    void el.offsetWidth;
    el.classList.add('golden-in');
    despawnAt = now + GOLDEN_LIFETIME_MS;
  };

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation(); // never let the tap reach the squishy behind it
    if (!alive) return;
    const r = el.getBoundingClientRect();
    hide();
    // report where it was caught so the burst text lands under the finger
    onCatch(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
  });

  return {
    tick(now) {
      if (!based) {
        // The loop's first `now` is the real clock; rebase off it once.
        nextAt = rollNextSpawn(now, rand);
        based = true;
        return;
      }
      if (alive) {
        if (now >= despawnAt) {
          hide();
          nextAt = rollNextSpawn(now, rand);
        }
        return;
      }
      if (now >= nextAt) spawn(now);
    },
    setAvatar() {
      if (alive) render();
    },
    spawnNow(now) {
      based = true;
      spawn(now);
    },
  };
}

// The DOM half of findables: one element per lane, driven by a single tick(now)
// from the existing rAF loop — no second loop. All timing decisions come from
// game/findables.ts.
import { LANES, type FindableKind, type LaneDef } from '../game/config/findables';
import {
  advance,
  collect,
  createSchedule,
  pickFreeX,
  pickSkin,
  type Schedule,
} from '../game/findables';
import { STR } from '../i18n/strings.he';
import type { AvatarDesign } from '../game/state';
import { avatarSVG } from './avatar';
import { renderIcon } from './icons';

const GOLD = '#f3c033';
// The fill override only reaches the body, so accessories kept their own
// colours — a "golden" squishy wearing a bright blue baseball cap. A CSS
// sepia+saturate pass over the whole SVG pulls every layer into the same
// metallic range, which is also what the real toy's gold variant looks like.
const GOLD_FILTER = 'sepia(0.75) saturate(2.6) hue-rotate(-12deg) brightness(1.08)';

export interface FindablesApi {
  /** Called every frame from the game loop. */
  tick(now: number): void;
  /** Re-render with a new design (after the player edits their squishy). */
  setAvatar(design: AvatarDesign): void;
  /** Force one to appear right now — used by tests and the dev console. */
  spawnNow(now: number, kind: FindableKind): void;
}

interface Lane {
  def: LaneDef;
  el: HTMLButtonElement;
  schedule: Schedule;
  /** the art id currently shown, so a catch can theme its background burst */
  icon: string;
}

export function initFindables(
  host: HTMLElement,
  getAvatar: () => AvatarDesign,
  onCatch: (kind: FindableKind, x: number, y: number, icon: string) => void,
  onSpawn: (kind: FindableKind) => void = () => {},
  rand: () => number = Math.random,
): FindablesApi {
  let based = false;

  const lanes: Lane[] = LANES.map((def) => {
    const el = document.createElement('button');
    el.className = `findable findable-${def.id}`;
    el.type = 'button';
    el.hidden = true;
    host.appendChild(el);
    return { def, el, schedule: createSchedule(def, 0, rand), icon: '' };
  });

  const render = (lane: Lane, kind: FindableKind) => {
    const { el } = lane;
    el.classList.remove('golden', 'airdrop', 'common');
    el.classList.add(kind);
    if (kind === 'golden') {
      el.innerHTML = avatarSVG(getAvatar(), 'golden-svg', GOLD);
      const svg = el.querySelector('svg');
      if (svg) svg.style.filter = GOLD_FILTER;
      el.setAttribute('aria-label', STR.goldenLabel);
      // the golden one is the player's own squishy, so the burst borrows the
      // apprentice dumpling to throw across the scene
      lane.icon = 'apprentice';
    } else {
      const icon = kind === 'airdrop' ? 'gift' : pickSkin(rand);
      lane.icon = icon;
      el.innerHTML = '<span class="findable-icon"></span>';
      renderIcon(el.firstElementChild as HTMLElement, icon, '🎁');
      el.setAttribute('aria-label', kind === 'airdrop' ? STR.airdropLabel : STR.commonLabel);
    }
  };

  const place = (lane: Lane) => {
    const { el } = lane;
    // Protect the FACE, not the whole hero. On a phone the squishy is ~70% of
    // the stage width, so "never overlap the hero at all" is unachievable —
    // there is no free lane wide enough. What actually matters is that a
    // findable never covers the eyes/mouth or crowds the tap target, so it sits
    // in the strip above the face. Measured every spawn, because the stage is
    // far shorter in landscape than at 430x900.
    const stage = host.getBoundingClientRect();
    const heroBox = host
      .querySelector('.squish-wrap')
      ?.querySelector('svg')
      ?.getBoundingClientRect();
    const size = el.offsetWidth || stage.width * 0.2;
    const maxX = Math.max(0, stage.width - size);
    const GAP = 8;
    const SEPARATION = 16;
    // The face starts ~35% down the SVG's box (eyes sit at viewBox y≈110/200,
    // and the drawn body starts at y≈26 — see bodyLayer in ui/avatar.ts).
    const faceTop =
      heroBox && heroBox.width > 0 ? heroBox.top + heroBox.height * 0.35 : stage.bottom;
    const band = Math.max(0, faceTop - GAP - size - stage.top);
    // Both lanes draw into the same strip, so a fresh spawn has to dodge
    // whatever the other lane already has on screen. Without this a 96px
    // airdrop and a 56px coin collide into one blob and the lower element
    // cannot be tapped at all. Extents are stage-relative, matching `left`.
    //
    // SEPARATION is wider than the face GAP on purpose. The idle bob rotates
    // these elements 4deg, which inflates an axis-aligned box by about
    // width*sin(4deg) — ~7px for the airdrop plus ~4px for a coin. At an 8px
    // gap the laid-out boxes are correctly apart but the rendered ones graze.
    const occupied = lanes
      .filter((l) => l !== lane && !l.el.hidden)
      .map((l) => {
        const b = l.el.getBoundingClientRect();
        return [b.left - stage.left, b.right - stage.left] as [number, number];
      });
    // Positioned with left/top, never transform (the bob/pop animations own it).
    el.style.insetInlineStart = 'auto';
    el.style.left = `${pickFreeX(size, maxX, occupied, rand, SEPARATION)}px`;
    el.style.top = `${band > 4 ? rand() * band : 0}px`;
  };

  const spawn = (lane: Lane, kind: FindableKind) => {
    render(lane, kind);
    lane.el.hidden = false; // must be laid out before it can be measured
    place(lane);
    // restart the entry animation
    lane.el.classList.remove('findable-in');
    void lane.el.offsetWidth;
    lane.el.classList.add('findable-in');
    onSpawn(kind);
  };

  const hide = (lane: Lane) => {
    lane.el.hidden = true;
    lane.el.classList.remove('findable-in');
  };

  for (const lane of lanes) {
    lane.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // never let the tap reach the squishy behind it
      const kind = lane.schedule.active;
      if (!kind) return;
      const r = lane.el.getBoundingClientRect();
      const x = e.clientX || r.left + r.width / 2;
      const y = e.clientY || r.top + r.height / 2;
      // wall clock, matching the `now` the loop feeds tick()
      lane.schedule = collect(lane.def, Date.now(), rand);
      hide(lane);
      onCatch(kind, x, y, lane.icon);
    });
  }

  return {
    tick(now) {
      if (!based) {
        // The loop's first `now` is the real clock; rebase every lane off it once.
        for (const lane of lanes) lane.schedule = createSchedule(lane.def, now, rand);
        based = true;
        return;
      }
      for (const lane of lanes) {
        const { schedule, action } = advance(lane.def, lane.schedule, now, rand);
        lane.schedule = schedule;
        if (action.type === 'spawn') spawn(lane, action.kind);
        else if (action.type === 'despawn') hide(lane);
      }
    },
    setAvatar() {
      for (const lane of lanes) {
        if (lane.schedule.active === 'golden') render(lane, 'golden');
      }
    },
    spawnNow(now, kind) {
      based = true;
      const lane = lanes.find((l) => l.def.kinds.some((k) => k.id === kind));
      if (!lane) return;
      const def = lane.def.kinds.find((k) => k.id === kind)!;
      // NOTE: this rolls nextAt forward too. The old spawnNow left it untouched,
      // which is exactly why __spawnGolden() could not reproduce the respawn
      // bug — the forced path looked healthy while the natural path was broken.
      lane.schedule = {
        nextAt: collect(lane.def, now, rand).nextAt,
        active: kind,
        despawnAt: now + def.lifetimeMs,
      };
      spawn(lane, kind);
    },
  };
}

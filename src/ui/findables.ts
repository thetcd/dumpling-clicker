// The DOM half of findables, driven by a single tick(now) from the existing
// rAF loop — no second loop. All timing decisions come from game/findables.ts.
//
// Each lane owns a POOL of elements, one per slot in its capacity, addressed by
// the schedule's active ids. The airdrop lane holds ten at once (Gal: parcels
// should pile up while you are away), so "one element per lane" no longer works.
import { LANES, type FindableKind, type LaneDef } from '../game/config/findables';
import {
  advance,
  collect,
  createSchedule,
  pickFreeSpot,
  pickSkin,
  rollNextSpawn,
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

/** Wider than the face gap: the idle bob rotates 4deg, inflating the box. */
const SEPARATION = 16;
const FACE_GAP = 8;

export interface FindablesApi {
  /** Called every frame from the game loop. */
  tick(now: number): void;
  /** Re-render with a new design (after the player edits their squishy). */
  setAvatar(design: AvatarDesign): void;
  /** Force one to appear right now — used by tests and the dev console. */
  spawnNow(now: number, kind: FindableKind): void;
}

interface Live {
  el: HTMLButtonElement;
  kind: FindableKind;
  /** the art id currently shown, so a catch can theme its background burst */
  icon: string;
}

interface Lane {
  def: LaneDef;
  schedule: Schedule;
  /** live findables by their schedule id */
  live: Map<number, Live>;
  /** every element this lane owns; hidden ones are free to reuse */
  pool: HTMLButtonElement[];
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
    // Pre-allocated, never created in the hot path: at one spawn every 30s on
    // the phones this game is for, churning elements is pure GC pressure.
    const pool = Array.from({ length: def.capacity }, () => {
      const el = document.createElement('button');
      el.className = `findable findable-${def.id}`;
      el.type = 'button';
      el.hidden = true;
      host.appendChild(el);
      return el;
    });
    return { def, schedule: createSchedule(def, 0, rand), live: new Map<number, Live>(), pool };
  });

  /** Every findable currently on screen, across every lane. */
  const allLive = () => lanes.flatMap((l) => [...l.live.values()]);

  const render = (live: Live, kind: FindableKind) => {
    const { el } = live;
    el.classList.remove('golden', 'airdrop', 'common');
    el.classList.add(kind);
    if (kind === 'golden') {
      el.innerHTML = avatarSVG(getAvatar(), 'golden-svg', GOLD);
      const svg = el.querySelector('svg');
      if (svg) svg.style.filter = GOLD_FILTER;
      el.setAttribute('aria-label', STR.goldenLabel);
      // the golden one is the player's own squishy, so the burst borrows the
      // apprentice dumpling to throw across the scene
      live.icon = 'apprentice';
    } else {
      const icon = kind === 'airdrop' ? 'gift' : pickSkin(rand);
      live.icon = icon;
      el.innerHTML = '<span class="findable-icon"></span>';
      renderIcon(el.firstElementChild as HTMLElement, icon, '🎁');
      el.setAttribute('aria-label', kind === 'airdrop' ? STR.airdropLabel : STR.commonLabel);
    }
  };

  const place = (live: Live) => {
    const { el } = live;
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
    const size = el.offsetWidth || stage.width * 0.14;
    const maxX = Math.max(0, stage.width - size);
    const maxY = Math.max(0, stage.height - size);
    // Dodge everything already on screen, in BOTH axes. A purely horizontal
    // search cannot seat ten parcels on a 430px stage, and one buried under
    // another cannot be tapped at all.
    const occupied = allLive()
      .filter((o) => o !== live && !o.el.hidden)
      .map((o) => {
        const b = o.el.getBoundingClientRect();
        return { x: b.left - stage.left, y: b.top - stage.top, w: b.width, h: b.height };
      });
    // The FACE is a keep-out box rather than a ceiling. The strip above it
    // measures 53px on a 430x900 phone — one row — so restricting parcels to
    // it made ten of them impossible and they piled up on each other. They may
    // now sit beside and below the hero, just never over the eyes and mouth
    // (the face spans ~30%..90% of the SVG's box; eyes are at viewBox y≈110/200
    // and the drawn body starts at y≈26 — see bodyLayer in ui/avatar.ts).
    if (heroBox && heroBox.width > 0) {
      const faceH = heroBox.height * 0.6;
      occupied.push({
        x: heroBox.left - stage.left + heroBox.width * 0.2,
        y: heroBox.top - stage.top + heroBox.height * 0.3 - FACE_GAP,
        w: heroBox.width * 0.6,
        h: faceH + FACE_GAP,
      });
    }
    const spot = pickFreeSpot(size, maxX, maxY, occupied, rand, SEPARATION);
    // Positioned with left/top, never transform (the bob/pop animations own it).
    el.style.insetInlineStart = 'auto';
    el.style.left = `${spot.x}px`;
    el.style.top = `${spot.y}px`;
  };

  const spawn = (lane: Lane, id: number, kind: FindableKind) => {
    const el = lane.pool.find((candidate) => candidate.hidden);
    if (!el) return; // capacity and pool size agree, so this cannot normally happen
    const live: Live = { el, kind, icon: '' };
    lane.live.set(id, live);
    el.dataset.findableId = String(id);
    render(live, kind);
    el.hidden = false; // must be laid out before it can be measured
    place(live);
    // restart the entry animation
    el.classList.remove('findable-in');
    void el.offsetWidth;
    el.classList.add('findable-in');
    onSpawn(kind);
  };

  const hide = (lane: Lane, id: number) => {
    const live = lane.live.get(id);
    if (!live) return;
    live.el.hidden = true;
    live.el.classList.remove('findable-in');
    delete live.el.dataset.findableId;
    lane.live.delete(id);
  };

  for (const lane of lanes) {
    for (const el of lane.pool) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation(); // never let the tap reach the squishy behind it
        const id = Number(el.dataset.findableId);
        const live = lane.live.get(id);
        if (!live) return;
        const r = el.getBoundingClientRect();
        const x = e.clientX || r.left + r.width / 2;
        const y = e.clientY || r.top + r.height / 2;
        const { kind, icon } = live;
        // wall clock, matching the `now` the loop feeds tick()
        lane.schedule = collect(lane.def, lane.schedule, id, Date.now(), rand);
        hide(lane, id);
        onCatch(kind, x, y, icon);
      });
    }
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
        const { schedule, actions } = advance(lane.def, lane.schedule, now, rand);
        lane.schedule = schedule;
        for (const action of actions) {
          if (action.type === 'spawn') spawn(lane, action.id, action.kind);
          else hide(lane, action.id);
        }
      }
    },
    setAvatar() {
      for (const lane of lanes) {
        for (const live of lane.live.values()) {
          if (live.kind === 'golden') render(live, 'golden');
        }
      }
    },
    spawnNow(now, kind) {
      based = true;
      const lane = lanes.find((l) => l.def.kinds.some((k) => k.id === kind));
      if (!lane) return;
      if (lane.live.size >= lane.def.capacity) return;
      const def = lane.def.kinds.find((k) => k.id === kind)!;
      const id = lane.schedule.nextId;
      // NOTE: this rolls nextAt forward too. The old spawnNow left it untouched,
      // which is exactly why __spawnGolden() could not reproduce the respawn
      // bug — the forced path looked healthy while the natural path was broken.
      lane.schedule = {
        nextAt: rollNextSpawn(lane.def, now, rand),
        active: [...lane.schedule.active, { id, kind, despawnAt: now + def.lifetimeMs }],
        nextId: id + 1,
      };
      spawn(lane, id, kind);
    },
  };
}

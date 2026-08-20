// The living background: a crowd of whatever you own, always moving, plus a
// themed burst whenever the player catches something. Both layers sit BEHIND
// the squishy and take no pointer events — they must never cover the face or
// swallow a squish.
//
// No per-frame JS: the crowd's motion is CSS on the compositor, and the scene
// only rebuilds when the set of owned producers actually changes.
import { BURST_POOL_SIZE, BURST_MS, GOLD_WASH_MS } from '../game/config/scene';
import { burstSpec, sceneSprites, type SceneSprite } from '../game/scene';

export interface SceneApi {
  /** Rebuild the crowd. Cheap to call often — it no-ops unless it changed. */
  update(producers: Record<string, number>): void;
  /** Throw `emoji` across the scene from a catch at viewport (x, y). */
  burst(emoji: string, x: number, y: number): void;
  /** A golden catch also washes the whole scene, tying it to the frenzy. */
  goldWash(): void;
}

export function initScene(host: HTMLElement): SceneApi {
  const crowd = document.createElement('div');
  crowd.className = 'scene-crowd';
  const bursts = document.createElement('div');
  bursts.className = 'scene-bursts';
  const wash = document.createElement('div');
  wash.className = 'scene-wash';
  // prepend so both layers paint behind the steamer and the squishy regardless
  // of the order the UI modules happen to be initialised in
  host.prepend(crowd, bursts, wash);

  const pool = Array.from({ length: BURST_POOL_SIZE }, () => {
    const el = document.createElement('span');
    el.className = 'burst-bit';
    bursts.appendChild(el);
    return el;
  });
  let nextBit = 0;
  let washTimer: ReturnType<typeof setTimeout> | undefined;
  let signature = '';

  const paint = (sprites: SceneSprite[]) => {
    crowd.innerHTML = '';
    for (const s of sprites) {
      const el = document.createElement('span');
      el.className = 'scene-sprite';
      el.textContent = s.icon;
      el.style.left = `${s.xPct}%`;
      el.style.top = `${s.yPct}%`;
      el.style.opacity = String(s.opacity);
      // one custom property drives the keyframes, so scale survives the
      // animation instead of being overwritten by it
      el.style.setProperty('--s', String(s.scale));
      el.style.animationDelay = `${s.delayMs}ms`;
      el.style.animationDuration = `${s.durationMs}ms`;
      crowd.appendChild(el);
    }
  };

  return {
    update(producers) {
      const sprites = sceneSprites(producers ?? {});
      // rebuilding on every shop repaint (4Hz) would restart every animation
      // and the crowd would twitch in place forever
      const next = sprites.map((s) => s.key).join('|');
      if (next === signature) return;
      signature = next;
      paint(sprites);
    },

    burst(emoji, x, y) {
      const stage = host.getBoundingClientRect();
      for (const p of burstSpec(emoji)) {
        const el = pool[nextBit];
        nextBit = (nextBit + 1) % BURST_POOL_SIZE;
        el.textContent = p.emoji;
        el.style.left = `${x - stage.left}px`;
        el.style.top = `${y - stage.top}px`;
        el.style.setProperty('--dx', `${p.dx}px`);
        el.style.setProperty('--dy', `${p.dy}px`);
        el.style.setProperty('--rot', `${p.rot}deg`);
        el.style.setProperty('--s', String(p.scale));
        el.style.animationDelay = `${p.delayMs}ms`;
        el.style.animationDuration = `${BURST_MS}ms`;
        el.classList.remove('burst-go');
        void el.offsetWidth; // restart the CSS animation
        el.classList.add('burst-go');
      }
    },

    goldWash() {
      wash.classList.remove('wash-go');
      void wash.offsetWidth;
      wash.classList.add('wash-go');
      clearTimeout(washTimer);
      washTimer = setTimeout(() => wash.classList.remove('wash-go'), GOLD_WASH_MS);
    },
  };
}

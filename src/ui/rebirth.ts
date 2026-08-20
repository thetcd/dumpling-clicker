// The rebirth bar: current rank, progress to the next one, and the button.
//
// Sits between the stage and the shop because it is the meta-loop and the
// research is unanimous that the rank itself works as a status symbol — hiding
// it in a settings menu would waste the cheapest retention feature here.
import { canRebirth, rebirthMultiplier, rebirthProgress } from '../game/rebirth';
import type { GameState } from '../game/state';
import { STR } from '../i18n/strings.he';

export interface RebirthApi {
  /** Cheap enough to call from the loop; it no-ops unless something changed. */
  update(): void;
}

export function initRebirth(
  host: HTMLElement,
  getState: () => GameState,
  onRebirth: () => void,
): RebirthApi {
  const bar = document.createElement('section');
  bar.id = 'rebirth';
  bar.innerHTML = `
    <div class="rb-row">
      <span class="rb-rank"></span>
      <span class="rb-bonus"></span>
    </div>
    <div class="rb-track"><div class="rb-fill"></div></div>
    <button class="btn btn-primary rb-go" type="button" hidden></button>
    <span class="rb-next"></span>`;
  host.appendChild(bar);

  const rank = bar.querySelector<HTMLElement>('.rb-rank')!;
  const bonus = bar.querySelector<HTMLElement>('.rb-bonus')!;
  const fill = bar.querySelector<HTMLElement>('.rb-fill')!;
  const go = bar.querySelector<HTMLButtonElement>('.rb-go')!;
  const next = bar.querySelector<HTMLElement>('.rb-next')!;

  go.textContent = STR.rebirthReady;
  go.addEventListener('click', onRebirth);

  let lastSig = '';

  return {
    update() {
      const state = getState();
      const pct = rebirthProgress(state);
      const ready = canRebirth(state);
      // Rounded to whole percent so the bar does not thrash the DOM 60x a
      // second for sub-pixel changes.
      const sig = `${state.prestige}|${Math.round(pct * 100)}|${ready}`;
      if (sig === lastSig) return;
      lastSig = sig;

      rank.textContent = STR.rebirthLevel(state.prestige);
      bonus.textContent = STR.rebirthBonus(rebirthMultiplier(state.prestige).toFixed(2));
      fill.style.width = `${pct * 100}%`;
      bar.classList.toggle('ready', ready);
      go.hidden = !ready;
      // The payoff has to be visible BEFORE the button is pressed, or a reset
      // reads as losing your things rather than trading them.
      next.textContent = ready
        ? ''
        : STR.rebirthNext(rebirthMultiplier(state.prestige + 1).toFixed(2));
    },
  };
}

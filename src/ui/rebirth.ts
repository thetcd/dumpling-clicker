// The rebirth bar: current rank, progress to the next one, and the button.
//
// Sits between the stage and the shop because it is the meta-loop and the
// research is unanimous that the rank itself works as a status symbol — hiding
// it in a settings menu would waste the cheapest retention feature here.
import {
  canRebirth,
  isRebirthMaxed,
  rebirthMultiplier,
  rebirthProgress,
  rebirthRequirement,
} from '../game/rebirth';
import { REBIRTH_MAX } from '../game/config/balance';
import type { GameState } from '../game/state';
import { STR } from '../i18n/strings.he';
import { formatNumber } from './format';

/**
 * The exp readout under the bar: how much this run has earned out of what the
 * next rebirth needs.
 *
 * Deliberately carries NO currency mark and no label. This is rebirth EXP, not
 * the game's shekels (Dor, 2026-08-22), and that distinction is the honest one:
 * `runEarned` only ever accumulates, so spending in the shop never lowers this
 * bar. Marking it "₪" would promise a number that goes down when you buy
 * something, and it doesn't.
 *
 * Pure and exported so the copy is testable without a DOM.
 */
export function rebirthMeterLabel(state: GameState): string {
  if (isRebirthMaxed(state.prestige)) return STR.rebirthMaxed;
  const need = rebirthRequirement(state.prestige);
  const raw = Number.isFinite(state.runEarned) ? Math.max(0, state.runEarned) : 0;
  // Clamped: a frame can overshoot the target before the button is pressed, and
  // "4,100 / 3,000" reads like the game owes you a rebirth it isn't giving.
  const have = Math.min(raw, need);
  return `${formatNumber(have)} / ${formatNumber(need)}`;
}

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
    <span class="rb-exp"></span>
    <button class="btn btn-primary rb-go" type="button" hidden></button>
    <span class="rb-next"></span>`;
  host.appendChild(bar);

  const rank = bar.querySelector<HTMLElement>('.rb-rank')!;
  const bonus = bar.querySelector<HTMLElement>('.rb-bonus')!;
  const fill = bar.querySelector<HTMLElement>('.rb-fill')!;
  const exp = bar.querySelector<HTMLElement>('.rb-exp')!;
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
      const maxed = isRebirthMaxed(state.prestige);
      const meter = rebirthMeterLabel(state);
      // The percent is rounded so the bar does not thrash the DOM 60x a second
      // for sub-pixel changes — but the exp text has to be in the signature
      // too. Keyed on percent alone it froze between whole-percent ticks, which
      // at a million per percent is a counter that visibly sticks.
      const sig = `${state.prestige}|${Math.round(pct * 100)}|${ready}|${meter}`;
      if (sig === lastSig) return;
      lastSig = sig;

      rank.textContent = STR.rebirthLevel(state.prestige, REBIRTH_MAX);
      bonus.textContent = STR.rebirthBonus(rebirthMultiplier(state.prestige).toFixed(2));
      fill.style.width = `${pct * 100}%`;
      bar.classList.toggle('ready', ready);
      bar.classList.toggle('maxed', maxed);
      go.hidden = !ready;
      exp.textContent = meter;
      // The payoff has to be visible BEFORE the button is pressed, or a reset
      // reads as losing your things rather than trading them. At the cap there
      // is no next rank to preview, so the line becomes the reason to come back.
      next.textContent = maxed
        ? STR.rebirthMaxedNext
        : ready
          ? ''
          : STR.rebirthNext(rebirthMultiplier(state.prestige + 1).toFixed(2));
    },
  };
}

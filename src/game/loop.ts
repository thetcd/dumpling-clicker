// The single rAF game loop: production accrual, HUD every frame, shop at 4Hz,
// autosave every 10s and on hide. Gaps while the page stays open (throttled
// tab) settle at full rate up to the offline cap; true offline progress is
// handled once at boot.
import { accrue } from './actions';
import { dpsOf } from './economy';
import {
  AUTOSAVE_INTERVAL_MS,
  MAX_TICK_DT_MS,
  OFFLINE_CAP_MS,
} from './config/balance';
import { saveToStorage } from './save';
import type { GameState } from './state';

/**
 * `getState` is a getter, not the state object, on purpose. "Start over"
 * replaces the state with a fresh object; a captured reference would leave the
 * loop accruing into the dead one and — worse — leave the `pagehide` handler
 * writing that dead object back over the fresh save during the reload, so
 * resetting the game silently did nothing.
 */
export function startLoop(
  getState: () => GameState,
  ui: {
    updateHud: () => void;
    updateShop: () => void;
    tickGolden?: (nowMs: number) => void;
  },
): void {
  let last = performance.now();
  let sinceShop = 0;
  let sinceSave = 0;

  function frame(now: number) {
    const state = getState();
    const dt = now - last;
    last = now;
    // rAF's `now` is a page-relative timestamp; frenzy and spawn timers are
    // wall-clock, so they get Date.now() rather than the frame time.
    const wall = Date.now();
    if (dt <= MAX_TICK_DT_MS) {
      accrue(state, dt, wall);
    } else {
      // the tab was throttled/hidden but never unloaded — settle in one step.
      // No frenzy multiplier here: a buff must not pay out for time away.
      // Also not runEarned: a throttled tab is time away, and the rebirth gate
      // measures active play. Same rule as main.ts's offline credit.
      const settled = Math.min(dt, OFFLINE_CAP_MS);
      const earned = dpsOf(state) * (settled / 1000);
      state.dumplings += earned;
      state.totalEarned += earned;
    }
    ui.tickGolden?.(wall);
    ui.updateHud();
    sinceShop += dt;
    if (sinceShop >= 250) {
      sinceShop = 0;
      ui.updateShop();
    }
    sinceSave += dt;
    if (sinceSave >= AUTOSAVE_INTERVAL_MS) {
      sinceSave = 0;
      saveToStorage(getState(), Date.now());
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // the reliable mobile "user is leaving" signals
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveToStorage(getState(), Date.now());
  });
  window.addEventListener('pagehide', () => saveToStorage(getState(), Date.now()));
}

// The single rAF game loop: production accrual, HUD every frame, shop at 4Hz,
// autosave every 10s and on hide.
//
// PRODUCTION IS LIVE-ONLY. Nothing here pays for time the window was not open —
// see creditableGapMs.
import { accrue } from './actions';
import { AUTOSAVE_INTERVAL_MS, MAX_TICK_DT_MS } from './config/balance';
import { saveToStorage } from './save';
import type { GameState } from './state';

/**
 * How much of a frame gap actually earns, in ms. A gap longer than one tick
 * earns NOTHING.
 *
 * Dor, 2026-08-21: "if the game is in the background, you dont passively get
 * stuff — the window must be open." rAF stops firing on a hidden tab, so the
 * first frame after a backgrounded PWA resumes carries the whole absence in its
 * `dt`. This used to settle that gap at full production rate up to an eight
 * hour cap, which is precisely the away-time income he asked to remove.
 *
 * Pure and exported so the rule is testable — it used to be an if/else inside
 * the rAF callback, where nothing could reach it.
 */
export function creditableGapMs(dtMs: number): number {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return 0;
  return dtMs <= MAX_TICK_DT_MS ? dtMs : 0;
}

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
    // A throttled or hidden tab produces nothing. There is deliberately no
    // catch-up branch here any more.
    const credit = creditableGapMs(dt);
    if (credit > 0) accrue(state, credit, wall);
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

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
 * How much of a frame gap actually earns, in ms. Two conditions, and they do
 * different jobs — conflating them is what caused the bug below.
 *
 * `visible` is the real rule. Dor, 2026-08-21: "the window must be open", and
 * 2026-08-22: "not only closing the app, but also minimizing should not give
 * you passive income."
 *
 * `MAX_TICK_DT_MS` is only a STUTTER guard: a phone that drops a frame for
 * 400ms should still be paid, a page resumed after an hour should not.
 *
 * The clamp alone was not enough, and it measurably was not: a backgrounded
 * window kept earning the full production rate. Browsers throttle a background
 * tab's requestAnimationFrame to roughly 1Hz rather than stopping it, so every
 * throttled frame arrived with `dt` around 1000ms, passed `dt <=
 * MAX_TICK_DT_MS`, and paid out a whole second of production. Measured at
 * 1,400/sec on a 1,400/sec board — no reduction at all.
 *
 * Pure and exported so the rule is testable; it used to be an if/else inside
 * the rAF callback where nothing could reach it.
 */
export function creditableGapMs(dtMs: number, visible: boolean): number {
  if (!visible) return 0;
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
    const credit = creditableGapMs(dt, document.visibilityState === 'visible');
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
    if (document.visibilityState === 'hidden') {
      saveToStorage(getState(), Date.now());
    } else {
      // Restart the frame clock on the way back in. creditableGapMs would
      // already refuse the huge dt this frame carries, but resetting it here
      // means the first visible frame is a real frame rather than one the
      // guard has to throw away.
      last = performance.now();
    }
  });
  window.addEventListener('pagehide', () => saveToStorage(getState(), Date.now()));
}

// Pinch-zoom is not a gesture this game has a use for, and when it happens by
// accident it does not degrade gracefully — it breaks the game outright.
//
// Every overlay in the app is `position: fixed; inset: 0` (.modal-backdrop,
// .designer, .backdrop, .floaters), and a fixed element anchors to the LAYOUT
// viewport. Pinching opens a smaller VISUAL viewport inside that one, so an
// open modal goes on covering every pixel of the layout viewport — and
// swallowing every pointer event with it — while the buttons that dismiss it
// sit somewhere the player cannot see. #app is 100dvh with nothing scrollable
// behind it and `overscroll-behavior: none`, so there is no way to pan back to
// them either. The game reads as frozen: taps on the squishy do nothing,
// because .modal-backdrop is still in front of it.
//
// Reported by Dor's brother, 2026-08-25: "zoomed in with two fingers and the
// game became buggy."
//
// `user-scalable=no` in index.html has never done anything about this. Chrome
// has ignored it since Chrome 48 and iOS Safari since iOS 10, both deliberately
// and both for accessibility — so the intent was declared and never enforced on
// any browser a player actually uses. `touch-action: manipulation` on #stage
// and .squish-hit only removes the double-tap zoom; the spec leaves pinch
// available. This module is what enforces it, alongside the `touch-action`
// rules in main.css.

/**
 * A touch sequence is a zoom attempt the moment it carries a second finger.
 *
 * Pure and exported so the rule is testable — the listener wrapped around it
 * is not, the same reason creditableGapMs() lives outside the rAF callback.
 */
export function isMultiTouch(touchCount: number): boolean {
  return touchCount > 1;
}

/** WebKit's pinch events. Not in lib.dom, and Chrome never fires them. */
const GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'];

export function initGestures(target: EventTarget = document): void {
  // Chrome and Android honour the `touch-action` rules in main.css; this is
  // what catches a pinch that starts anywhere those rules do not reach.
  // `passive: false` is load-bearing — touchmove listeners default to passive
  // on every mobile browser, and a passive listener's preventDefault() is
  // ignored silently, which makes this look like it works while doing nothing.
  target.addEventListener(
    'touchmove',
    (e) => {
      if (isMultiTouch((e as TouchEvent).touches.length)) e.preventDefault();
    },
    { passive: false },
  );

  // iOS Safari does not honour `touch-action` for zoom the way Chrome does.
  // These three are the only thing that stops a pinch there.
  for (const type of GESTURE_EVENTS) {
    target.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
}

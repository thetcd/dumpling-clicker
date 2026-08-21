// The squish spring, pure so its curve can be tested without a DOM.
//
// The real dumpling squishy is a SLOW-RISE foam: it dents instantly and then
// re-inflates slowly, and that slow puff-back is the whole reason the toy went
// viral. DESIGN-NOTES puts the curve at fast squish -> quick recovery to about
// 70% -> slow final puff over 1 to 1.5 seconds.
//
// The constraint that shapes this: the game is tuned around tapping at ~5/sec,
// a tap every 200ms, far inside a 1.5s puff. A slow tail that always ran would
// make fast tapping feel mushy — each tap would start from a half-dented
// squishy and lose most of its travel. So the tail's stiffness is a function of
// how long ago the last tap was: during a burst the spring stays the snappy
// jelly it has always been, and the full slow puff only expresses once the
// player stops.

/** Squish-in: stiff and critically damped, so the dent lands under the finger. */
const PRESS_K = 1400;
/** Release: today's soft, underdamped jelly — 2-3 wobbles. Drives the fast phase. */
const RELEASE_K = 320;
const RELEASE_C = 9;
/** The slow puff: heavily overdamped, so it creeps back with no wobble at all. */
const PUFF_K = 135;
const PUFF_C = 60;
/**
 * The handoff between the two stages is by POSITION, not by a timer: the jelly
 * runs while the squishy is still deeply dented and the puff takes over for the
 * last of the travel. A timer would depend on how long the press was held — a
 * 300ms hold would already have burned the fast window and the squishy would
 * crawl back from fully dented.
 */
const PUFF_FROM = 0.45;
const PUFF_TO = 0.15;
/** A tap this recent means the player is mid-burst; keep the jelly. */
const SNAP_MS = 0;
/** ...fading to the full slow puff over this long. */
const SNAP_FADE_MS = 60;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface SpringState {
  s: number;
  vel: number;
}

/**
 * Advance the spring one frame.
 *
 * @param s squish amount, 0 resting .. 1 fully dented (negative = stretched)
 * @param vel current velocity
 * @param target 1 while a finger is down, 0 once it lifts
 * @param dt seconds since the last frame (the caller clamps this)
 * @param sinceTapMs how long ago the last tap was
 */
export function springStep(
  s: number,
  vel: number,
  target: number,
  dt: number,
  sinceTapMs: number,
): SpringState {
  let k: number;
  let c: number;
  if (target === 1) {
    k = PRESS_K;
    c = 2 * Math.sqrt(PRESS_K); // critical: snaps in without a bounce
  } else {
    // both have to agree before the tail engages: the squishy must be most of
    // the way back AND the player must have stopped tapping
    const byPosition = clamp01((PUFF_FROM - s) / (PUFF_FROM - PUFF_TO));
    const byRest = clamp01((sinceTapMs - SNAP_MS) / SNAP_FADE_MS);
    const slow = byPosition * byRest;
    k = lerp(RELEASE_K, PUFF_K, slow);
    c = lerp(RELEASE_C, PUFF_C, slow);
  }
  const accel = k * (target - s) - c * vel;
  const nextVel = vel + accel * dt;
  return { s: s + nextVel * dt, vel: nextVel };
}

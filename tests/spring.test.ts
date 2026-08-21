import { describe, expect, test } from 'vitest';
import { springStep } from '../src/ui/spring';

/**
 * Run the spring forward at a fixed 60fps and report the trajectory.
 * `sinceTapAt` is how long ago the last tap was, as a function of elapsed time —
 * it grows with time unless the player keeps tapping.
 */
function simulate(opts: {
  from: number;
  target: number;
  ms: number;
  sinceTapAt: (elapsedMs: number) => number;
}) {
  const dt = 1 / 60;
  let s = opts.from;
  let vel = 0;
  const trace: { t: number; s: number }[] = [{ t: 0, s }];
  for (let t = 0; t < opts.ms; t += 1000 / 60) {
    ({ s, vel } = springStep(s, vel, opts.target, dt, opts.sinceTapAt(t)));
    trace.push({ t: t + 1000 / 60, s });
  }
  return {
    at: (ms: number) =>
      trace.reduce((best, p) => (Math.abs(p.t - ms) < Math.abs(best.t - ms) ? p : best)).s,
    timeTo: (want: number) => trace.find((p) => p.s <= want)?.t ?? Infinity,
    min: () => Math.min(...trace.map((p) => p.s)),
  };
}

/** Let go and never tap again. */
const released = (ms: number) => simulate({ from: 1, target: 0, ms, sinceTapAt: (t) => t });

describe('springStep', () => {
  test('is pure — the same inputs always give the same result', () => {
    expect(springStep(0.5, 2, 0, 1 / 60, 300)).toEqual(springStep(0.5, 2, 0, 1 / 60, 300));
  });

  test('pressing still snaps in fast', () => {
    // the dent itself is unchanged: the toy squishes instantly
    const run = simulate({ from: 0, target: 1, ms: 300, sinceTapAt: () => 0 });
    expect(run.at(100)).toBeGreaterThan(0.85);
  });

  test('recovery to roughly 70% is quick', () => {
    // first half of the real toy's curve: it springs most of the way back
    expect(released(600).timeTo(0.3)).toBeLessThan(150);
  });

  test('the last of the puff is slow — the toy is named for this', () => {
    // DESIGN-NOTES puts the full re-inflation at 1 to 1.5 seconds
    const settle = released(3000).timeTo(0.02);
    expect(settle).toBeGreaterThan(800);
    expect(settle).toBeLessThan(2000);
  });

  test('tapping fast keeps it snappy — the slow puff never makes fast play mushy', () => {
    // a burst of taps: sinceTap never grows, so the tail never fully engages
    const burst = simulate({ from: 1, target: 0, ms: 200, sinceTapAt: () => 0 });
    expect(burst.at(200)).toBeLessThan(released(200).at(200));
    // and most of the travel is back, so the next tap still has room to squish
    expect(burst.at(200)).toBeLessThan(0.3);
  });

  test('the puff never stretches wildly past the resting shape', () => {
    // a little overshoot is the jelly wobble and is wanted; a lot is a glitch
    expect(released(3000).min()).toBeGreaterThan(-0.3);
  });
});

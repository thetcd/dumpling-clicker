// Golden dumpling timing. Pure functions over (now, rand) so the schedule and
// the frenzy window are testable without a clock or a DOM — the UI half lives
// in src/ui/golden.ts and owns the element.
import {
  GOLDEN_MAX_INTERVAL_MS,
  GOLDEN_MIN_INTERVAL_MS,
} from './config/balance';

/** Epoch ms for the next spawn: uniform in [MIN, MAX] after `now`. */
export function rollNextSpawn(now: number, rand: () => number = Math.random): number {
  const span = GOLDEN_MAX_INTERVAL_MS - GOLDEN_MIN_INTERVAL_MS;
  return now + GOLDEN_MIN_INTERVAL_MS + rand() * span;
}

/**
 * Is a frenzy running? `frenzyUntil` is a wall-clock stamp, so a value left in
 * a save from a previous session is simply in the past — no cleanup needed.
 */
export function isFrenzyActive(frenzyUntil: number, now: number): boolean {
  return now < frenzyUntil;
}

/** Milliseconds left on the frenzy, floored at 0 (for the HUD countdown). */
export function frenzyRemainingMs(frenzyUntil: number, now: number): number {
  return Math.max(0, frenzyUntil - now);
}

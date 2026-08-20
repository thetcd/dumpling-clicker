// The frenzy window: how long a golden dumpling's bonus runs and how much is
// left. Pure functions over (now) so they are testable without a clock.
//
// Spawn SCHEDULING used to live here too; it moved to src/game/findables.ts
// when a second lane of findables arrived. Frenzy stayed behind because it is a
// separate mechanic — a temporary multiplier, not a thing on the screen.

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

// Which designer parts a player may choose at their current prestige level.
// Pure over (part, prestige, wornId) so the rule is tested without a DOM.
import type { PartOption } from './config/parts';

/**
 * May this part be CHOSEN right now?
 *
 * `worn` is the part the save is already wearing, and it is always choosable
 * even when locked. Two reasons: a save made before a part was gated must not
 * become unselectable, and re-opening the designer must never silently strip
 * what the player is already wearing.
 */
export function isPartUnlocked(part: PartOption, prestige: number, worn?: string): boolean {
  if (part.id === worn) return true;
  const gate = part.unlockAtPrestige ?? 0;
  const level = Number.isFinite(prestige) ? prestige : 0;
  return level >= gate;
}

/** The prestige level that opens this part, or 0 when it was never gated. */
export function unlockLevel(part: PartOption): number {
  return part.unlockAtPrestige ?? 0;
}

/** How many of `parts` are choosable at `prestige` — for "3/11" style copy. */
export function unlockedCount(parts: PartOption[], prestige: number): number {
  return parts.filter((p) => isPartUnlocked(p, prestige)).length;
}

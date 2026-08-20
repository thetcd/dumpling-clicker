// Background scene tuning. Visual knobs, same rule as balance.ts: logic files
// never hold constants.

// Only your highest owned tiers render, so the world EVOLVES instead of
// accumulating. Market stalls give way to factories, factories to cities.
// Showing everything you ever bought would be both a mess and unbounded.
export const SCENE_TIERS_SHOWN = 4;
// Sprites per tier grow logarithmically with the count owned: 1 -> 1, 4 -> 3,
// 16 -> 5. Visible growth exactly when it matters (early), bounded later.
export const SCENE_MAX_PER_TIER = 5;
// The readable strip, as a percentage of stage height. The squishy is ~70% of
// the stage width and sits at the bottom, so mid-stage sprites are hidden
// behind it — only 3 of 11 were visible before this was clamped. Findables use
// the same strip, which is fine: the crowd is small, dim and static, so it
// reads as background rather than competing with them.
export const SCENE_BAND_TOP = 2;
export const SCENE_BAND_BOTTOM = 19; // the squishy's crown reaches ~18% of the stage

// Hard ceiling for the whole scene. "Everything moves" is also how a cheap
// Android becomes a slideshow.
export const SCENE_MAX_SPRITES = 20;

// A catch fires a burst of the thing you just caught. Pooled, never allocated
// in the hot path — at one catch every 10-25s, churning elements would be GC
// pressure on the phones this game is for.
export const BURST_POOL_SIZE = 48;
export const BURST_PARTICLES = 12;
export const BURST_MS = 1500;
// Catching a golden dumpling also washes the scene gold, tying the background
// to the frenzy that just started.
export const GOLD_WASH_MS = 1200;

// The living background: which sprites the scene shows for what you own, and
// what a catch throws across it. Pure over (producers) and (emoji, rand), so
// both are tested without a DOM — the element half lives in src/ui/scene.ts.
import { PRODUCERS } from './config/producers';
import {
  BURST_PARTICLES,
  SCENE_BAND_BOTTOM,
  SCENE_BAND_TOP,
  SCENE_MAX_PER_TIER,
  SCENE_MAX_SPRITES,
  SCENE_TIERS_SHOWN,
} from './config/scene';

export interface SceneSprite {
  /** stable identity, so a re-render reuses elements instead of rebuilding */
  key: string;
  tierId: string;
  icon: string;
  /** 0 = front row, 1 = furthest back */
  depth: number;
  xPct: number;
  yPct: number;
  scale: number;
  opacity: number;
  delayMs: number;
  durationMs: number;
}

export interface BurstParticle {
  /** art id, drawn by ui/icons.ts */
  icon: string;
  dx: number;
  dy: number;
  rot: number;
  scale: number;
  delayMs: number;
}

/**
 * Stable pseudo-random in [0, 1) from an integer seed.
 *
 * Positions MUST be a pure function of (tier, index) rather than random. With
 * random placement every purchase re-rolls the whole crowd and all your workers
 * teleport — fine in a screenshot, awful in the hand.
 */
function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** How many sprites represent `count` of one producer. */
export function spritesFor(count: number, cap: number = SCENE_MAX_PER_TIER): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(cap, Math.ceil(Math.log2(count + 1)));
}

/** The whole scene for a given set of owned producers. */
export function sceneSprites(producers: Record<string, number>): SceneSprite[] {
  const owned = PRODUCERS.map((p, tierIndex) => ({
    p,
    tierIndex,
    count: producers?.[p.id] ?? 0,
  })).filter((t) => Number.isFinite(t.count) && t.count > 0);

  // highest tiers first: they paint furthest back, and if the sprite cap bites
  // it drops the least impressive things rather than the most
  const shown = owned.slice(-SCENE_TIERS_SHOWN).reverse();

  const sprites: SceneSprite[] = [];
  shown.forEach((tier, i) => {
    const depth = shown.length > 1 ? 1 - i / (shown.length - 1) : 0;
    const n = spritesFor(tier.count);
    for (let s = 0; s < n; s++) {
      const seed = tier.tierIndex * 101 + s * 37;
      sprites.push({
        key: `${tier.p.id}-${s}`,
        tierId: tier.p.id,
        icon: tier.p.icon,
        depth,
        xPct: 4 + hash01(seed) * 92,
        // The crowd lives in the band ABOVE the hero. The squishy is ~70% of
        // the stage width and sits at the bottom, so anything placed mid-stage
        // is simply invisible — measured: 3 of 11 sprites visible before this
        // was clamped. SCENE_BAND_TOP/BOTTOM keep it in the readable strip.
        yPct: SCENE_BAND_TOP + (1 - depth) * (SCENE_BAND_BOTTOM - SCENE_BAND_TOP - 6)
          + hash01(seed + 7) * 6,
        scale: 0.5 + (1 - depth) * 0.5,
        // Dim enough to stay background, solid enough to actually read on the
        // bright sky — the whole point is that things are visibly happening.
        // Raised from 0.42/0.38 with the move off the dark gradient: a sprite
        // that was legible as a light shape on dusk is a ghost on daylight.
        // The white sticker outline in .scene-sprite does the rest.
        opacity: 0.62 + (1 - depth) * 0.3,
        // desynced so the crowd never breathes in unison
        delayMs: Math.round(hash01(seed + 13) * 4000),
        durationMs: 5200 + Math.round(hash01(seed + 19) * 4200),
      });
    }
  });
  return sprites.slice(0, SCENE_MAX_SPRITES);
}

/**
 * What a catch throws across the scene. Themed for free: the burst reuses the
 * art the player just tapped, so a coin rains coins and a gem rains gems with
 * no per-skin configuration.
 */
export function burstSpec(
  icon: string,
  count: number = BURST_PARTICLES,
  rand: () => number = Math.random,
): BurstParticle[] {
  const n = Math.max(0, Math.floor(count));
  return Array.from({ length: n }, () => ({
    icon,
    dx: (rand() - 0.5) * 200,
    dy: 60 + rand() * 190, // they fall, so the eye follows them down the scene
    rot: (rand() - 0.5) * 140,
    scale: 0.65 + rand() * 0.7,
    delayMs: Math.round(rand() * 240),
  }));
}

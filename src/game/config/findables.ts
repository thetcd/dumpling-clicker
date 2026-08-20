// The things that appear on screen waiting to be tapped, grouped into lanes.
// Each lane owns one slot and its own timer, so a constant drip of small
// rewards cannot crowd out the rare ones. Adding a findable is a data entry
// here plus a render case in ui/findables.ts.
// ids are stable identifiers; never rename after ship.
import {
  AIRDROP_FLOOR_CLICKS,
  AIRDROP_LIFETIME_MS,
  AIRDROP_SECONDS,
  COMMON_FLOOR_CLICKS,
  COMMON_LIFETIME_MS,
  COMMON_SECONDS,
  COMMON_SPAWN_MAX_MS,
  COMMON_SPAWN_MIN_MS,
  GOLDEN_LIFETIME_MS,
  RARE_SPAWN_MAX_MS,
  RARE_SPAWN_MIN_MS,
} from './balance';

export type FindableKind = 'common' | 'golden' | 'airdrop';
export type LaneId = 'common' | 'rare';

export interface FindableDef {
  id: FindableKind;
  /** relative spawn weight within its lane */
  weight: number;
  lifetimeMs: number;
  /** seconds of current production this pays; omitted for non-payout kinds */
  payoutSeconds?: number;
  /** minimum payout, in click values, so it is not worthless at dps ~0 */
  floorClicks?: number;
}

export interface LaneDef {
  id: LaneId;
  minMs: number;
  maxMs: number;
  kinds: FindableDef[];
}

// Cosmetic rotation over ONE mechanic. Six skins, identical payout maths —
// the variety is what keeps it feeling fresh, not six sets of rules.
// These are ART IDS, not emoji: ui/icons.ts draws each one.
export const COMMON_SKINS = ['coin', 'bill', 'gem', 'star', 'envelope', 'candy'];

export const LANES: LaneDef[] = [
  {
    id: 'common',
    minMs: COMMON_SPAWN_MIN_MS,
    maxMs: COMMON_SPAWN_MAX_MS,
    kinds: [
      {
        id: 'common',
        weight: 1,
        lifetimeMs: COMMON_LIFETIME_MS,
        payoutSeconds: COMMON_SECONDS,
        floorClicks: COMMON_FLOOR_CLICKS,
      },
    ],
  },
  {
    id: 'rare',
    minMs: RARE_SPAWN_MIN_MS,
    maxMs: RARE_SPAWN_MAX_MS,
    kinds: [
      // golden grants a frenzy, not a payout — hence no payoutSeconds
      { id: 'golden', weight: 45, lifetimeMs: GOLDEN_LIFETIME_MS },
      {
        id: 'airdrop',
        weight: 55,
        lifetimeMs: AIRDROP_LIFETIME_MS,
        payoutSeconds: AIRDROP_SECONDS,
        floorClicks: AIRDROP_FLOOR_CLICKS,
      },
    ],
  },
];

export const LANE_BY_ID: Record<LaneId, LaneDef> = Object.fromEntries(
  LANES.map((l) => [l.id, l]),
) as Record<LaneId, LaneDef>;

export const FINDABLE_BY_ID: Record<FindableKind, FindableDef> = Object.fromEntries(
  LANES.flatMap((l) => l.kinds).map((f) => [f.id, f]),
) as Record<FindableKind, FindableDef>;

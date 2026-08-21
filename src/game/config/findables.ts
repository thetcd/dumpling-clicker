// The things that appear on screen waiting to be tapped, grouped into lanes.
// Each lane owns one slot and its own timer, so a constant drip of small
// rewards cannot crowd out the rare ones. Adding a findable is a data entry
// here plus a render case in ui/findables.ts.
// ids are stable identifiers; never rename after ship.
import {
  AIRDROP_FLOOR_CLICKS,
  AIRDROP_LIFETIME_MS,
  AIRDROP_MAX_ON_SCREEN,
  AIRDROP_SECONDS,
  AIRDROP_SPAWN_MAX_MS,
  AIRDROP_SPAWN_MIN_MS,
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
export type LaneId = 'common' | 'rare' | 'airdrop';

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
  /**
   * How many of this lane's findables may sit on screen at once. Most lanes
   * hold one; the airdrop lane holds ten, which is the whole point of it —
   * parcels pile up while the player is not looking.
   */
  capacity: number;
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
    capacity: 1,
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
    // The frenzy, alone in its own lane. It used to share the rare lane with
    // the airdrop at 45/55, but the airdrop now runs every 30s — leaving them
    // together would either spend the golden's scarcity or starve the drip.
    id: 'rare',
    minMs: RARE_SPAWN_MIN_MS,
    maxMs: RARE_SPAWN_MAX_MS,
    capacity: 1,
    // golden grants a frenzy, not a payout — hence no payoutSeconds
    kinds: [{ id: 'golden', weight: 1, lifetimeMs: GOLDEN_LIFETIME_MS }],
  },
  {
    id: 'airdrop',
    minMs: AIRDROP_SPAWN_MIN_MS,
    maxMs: AIRDROP_SPAWN_MAX_MS,
    capacity: AIRDROP_MAX_ON_SCREEN,
    kinds: [
      {
        id: 'airdrop',
        weight: 1,
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

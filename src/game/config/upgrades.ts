// Click upgrades. Hidden until unlockAtClicks total squishes.
// ids are stable save keys — NEVER rename after ship.
//
// A click is worth `flat + share * dps` (see economy.ts). The cheap early
// upgrades raise `flat`, which is what carries the game before you own any
// producers. The two expensive ones raise `share`, so they keep paying forever
// instead of becoming dead weight the moment production takes over.
export interface UpgradeDef {
  id: string;
  nameHe: string;
  descHe: string;
  cost: number;
  multiplier?: number; // multiplies the flat per-click base
  shareMultiplier?: number; // multiplies CLICK_DPS_SHARE, the production cut
  unlockAtClicks: number;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'fast-fingers',
    nameHe: 'אצבעות מזורזות',
    descHe: 'כל מעיכה שווה כפול 2',
    cost: 100,
    multiplier: 2,
    unlockAtClicks: 10,
  },
  {
    id: 'silk-gloves',
    nameHe: 'כפפות משי',
    descHe: 'הסקווישי נהנה מזה. כפול 2.',
    cost: 1_000,
    multiplier: 2,
    unlockAtClicks: 50,
  },
  {
    id: 'secret-technique',
    nameHe: 'טכניקת מעיכה סודית',
    descHe: 'עברה במשפחה שלוש דורות. כפול 3.',
    cost: 15_000,
    multiplier: 3,
    unlockAtClicks: 200,
  },
  {
    id: 'grandma-hands',
    nameHe: 'ידיים של סבתא',
    descHe: 'אין מעיכה כמו של סבתא. החלק מהייצור שבכל מעיכה — כפול 2.',
    cost: 200_000,
    shareMultiplier: 2,
    unlockAtClicks: 700,
  },
  {
    id: 'quantum-squish',
    nameHe: 'מעיכה קוונטית',
    descHe: 'מועך בכל היקומים במקביל. החלק מהייצור שבכל מעיכה — כפול 2.5.',
    cost: 5_000_000,
    shareMultiplier: 2.5,
    unlockAtClicks: 2_000,
  },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

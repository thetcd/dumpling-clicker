// The producer roster: squishy-world places and helpers, escalating in absurdity.
// Tier 10 is the Squishy Boss — Gal as a squishy dumpling.
// ids are stable save keys — NEVER rename after ship. Names/descriptions are free to change.
export interface ProducerDef {
  id: string;
  nameHe: string;
  descHe: string;
  baseCost: number; // cost of the first unit; nth unit costs baseCost * COST_GROWTH^n
  baseDps: number; // dumplings per second per unit
  icon: string; // emoji for v1; can become an /art/ path without code changes
}

export const PRODUCERS: ProducerDef[] = [
  {
    id: 'apprentice',
    nameHe: 'סקווישי מתלמד',
    descHe: 'מועך בשבילך, לאט אבל באהבה',
    baseCost: 15,
    // 0.15, not Cookie Clicker's 0.1: at 0.1 the apprentice costs 150 per dps
    // while the stall costs 100, making the first thing you can afford the
    // worst buy in the game. CC gets away with it because cursors are carried
    // by click upgrades we don't have. 0.15 ties the stall at 100 per dps.
    baseDps: 0.15,
    icon: '🥟',
  },
  {
    id: 'stall',
    nameHe: 'דוכן בשוק',
    descHe: 'סקווישים טריים, שקל ליחידה',
    baseCost: 100,
    baseDps: 1,
    icon: '🏪',
  },
  {
    id: 'kindergarten',
    nameHe: 'גן ילדים לסקווישים',
    descHe: 'קטנים, רכים, ומייצרים כופתאות',
    baseCost: 1_100,
    baseDps: 8,
    icon: '🧸',
  },
  {
    id: 'school',
    nameHe: 'בית ספר לסקווישים',
    descHe: 'לומדים מעיכה מתקדמת, שיעור שני',
    baseCost: 12_000,
    baseDps: 47,
    icon: '🏫',
  },
  {
    id: 'bakery',
    nameHe: 'מאפיית כופתאות',
    descHe: 'האדים מרגיעים את כולם',
    baseCost: 130_000,
    baseDps: 260,
    icon: '🥠',
  },
  {
    id: 'factory',
    nameHe: 'מפעל סקווישים',
    descHe: 'פס ייצור של רכות טהורה',
    baseCost: 1_400_000,
    baseDps: 1_400,
    icon: '🏭',
  },
  {
    id: 'army',
    nameHe: 'בסיס סקווישים צבאי',
    descHe: 'מועכים בשלוש משמרות, בלי לשאול שאלות',
    baseCost: 20_000_000,
    baseDps: 7_800,
    icon: '🪖',
  },
  {
    id: 'city',
    nameHe: 'עיר הסקווישים',
    descHe: 'עירייה שלמה של בצק',
    baseCost: 330_000_000,
    baseDps: 44_000,
    icon: '🌆',
  },
  {
    id: 'space',
    nameHe: 'תוכנית החלל הסקווישית',
    descHe: 'כופתאות במסלול סביב הירח',
    baseCost: 5_100_000_000,
    baseDps: 260_000,
    icon: '🚀',
  },
  {
    id: 'boss',
    nameHe: 'הבוס של הסקווישים',
    descHe: 'גל בכבודו ובעצמו, כסקווישי. הגעת לפסגה.',
    baseCost: 75_000_000_000,
    baseDps: 1_600_000,
    icon: '👑',
  },
];

export const PRODUCER_BY_ID: Record<string, ProducerDef> = Object.fromEntries(
  PRODUCERS.map((p) => [p.id, p]),
);

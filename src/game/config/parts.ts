// Squishy designer part registry. Each entry maps to an SVG symbol id in the
// generated art layers (see src/ui/avatar.ts). Adding a part = new entry here
// + its layer markup; no logic changes.
export interface PartOption {
  id: string;
  nameHe: string;
}

export const BODY_COLORS: { id: string; nameHe: string; fill: string }[] = [
  { id: 'classic', nameHe: 'בצק קלאסי', fill: '#f5e6c8' },
  { id: 'blush', nameHe: 'ורוד מסמיק', fill: '#f7c8d0' },
  { id: 'matcha', nameHe: 'מאצ׳ה', fill: '#c8e0b8' },
  { id: 'sky', nameHe: 'תכלת', fill: '#c3dcf0' },
  { id: 'lavender', nameHe: 'לבנדר', fill: '#d8c8ee' },
  { id: 'sunny', nameHe: 'שמשי', fill: '#f7e08e' },
  { id: 'peach', nameHe: 'אפרסק', fill: '#f8cfa8' },
  { id: 'charcoal', nameHe: 'שומשום שחור', fill: '#8f8a86' },
  { id: 'mocha', nameHe: 'מוקה', fill: '#c9a789' },
  { id: 'mint', nameHe: 'מנטה', fill: '#c4ecd9' },
  { id: 'berry', nameHe: 'פטל', fill: '#f096ac' },
  { id: 'ube', nameHe: 'אובה', fill: '#a98fd4' },
  { id: 'coral', nameHe: 'אלמוג', fill: '#f9a58c' },
  { id: 'teal', nameHe: 'ירוק ים', fill: '#8fd6cc' },
  { id: 'blueberry', nameHe: 'אוכמניות', fill: '#8fa2dc' },
  { id: 'snow', nameHe: 'שלג', fill: '#f2f0ea' },
];

export const EYES: PartOption[] = [
  { id: 'dot', nameHe: 'נקודות' },
  { id: 'happy', nameHe: 'שמחות' },
  { id: 'sleepy', nameHe: 'מנומנמות' },
  { id: 'star', nameHe: 'כוכבים' },
  { id: 'wink', nameHe: 'קריצה' },
  { id: 'hearts', nameHe: 'לבבות' },
  { id: 'big', nameHe: 'מופתעות' },
  { id: 'closed', nameHe: 'עצומות' },
  { id: 'sparkly', nameHe: 'נוצצות' },
  { id: 'dizzy', nameHe: 'מסוחררות' },
  { id: 'shekel', nameHe: 'עיני שקל' },
];

export const MOUTHS: PartOption[] = [
  { id: 'smile', nameHe: 'חיוך' },
  { id: 'open', nameHe: 'וואו' },
  { id: 'cat', nameHe: 'חתולי' },
  { id: 'tongue', nameHe: 'לשון' },
  { id: 'kiss', nameHe: 'נשיקה' },
  { id: 'grin', nameHe: 'צחוק גדול' },
  { id: 'wavy', nameHe: 'מבולבל' },
  { id: 'ooh', nameHe: 'הו!' },
  { id: 'smirk', nameHe: 'חיוך עקום' },
  { id: 'fangs', nameHe: 'שיניים קטנות' },
  { id: 'drool', nameHe: 'מזיל ריר' },
];

export const ACCESSORIES: PartOption[] = [
  { id: 'none', nameHe: 'בלי' },
  { id: 'bow', nameHe: 'פפיון' },
  { id: 'cap', nameHe: 'כובע' },
  { id: 'glasses', nameHe: 'משקפיים' },
  { id: 'flower', nameHe: 'פרח' },
  { id: 'sprout', nameHe: 'נבט' },
  { id: 'headphones', nameHe: 'אוזניות' },
  { id: 'chef', nameHe: 'כובע שף' },
  { id: 'sunglasses', nameHe: 'משקפי שמש' },
  { id: 'bandaid', nameHe: 'פלסטר' },
  { id: 'scarf', nameHe: 'צעיף' },
];

export const DEFAULT_AVATAR = {
  color: 'classic',
  eyes: 'dot',
  mouth: 'smile',
  accessory: 'none',
};

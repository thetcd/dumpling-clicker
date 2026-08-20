// Pure music theory for the synthesized audio. No WebAudio here, so the
// pitches and the loop can be unit-tested without a browser.
//
// Choices come from how reward audio actually works: ascending runs on
// consonant intervals (major third, perfect fifth) read as success, while a
// descending run reads as failure. Pentatonic means any two notes in the set
// sound fine together, so nothing ever clashes with a squish landing on top.

/** Equal-temperament transpose: `semis` semitones above `root` Hz. */
export function hzFromRoot(root: number, semis: number): number {
  return root * 2 ** (semis / 12);
}

// Major pentatonic degrees, in semitones. No 4th or 7th — no dissonance
// possible against the drone or against a squish blip.
const PENTATONIC = [0, 2, 4, 7, 9];

const C4 = 261.63;

/**
 * The purchase "win" run. Higher tiers get more notes, start higher and end
 * higher — the escalation is the point: buying the boss must not sound like
 * buying an apprentice.
 */
export function purchaseArpeggio(tier: number): number[] {
  const t = Number.isFinite(tier) ? Math.min(Math.max(Math.round(tier), 0), 9) : 0;
  const count = 3 + Math.floor(t / 2); // 3 notes at tier 0 → 7 at tier 9
  const notes: number[] = [];
  for (let i = 0; i < count; i++) {
    const degree = PENTATONIC[i % PENTATONIC.length];
    const octave = Math.floor(i / PENTATONIC.length);
    // whole run shifts up with the tier so expensive things sound brighter
    notes.push(hzFromRoot(C4, degree + 12 * octave + t));
  }
  return notes;
}

export interface MusicEvent {
  /** beat within the bar, 0..4 (4/4) */
  beat: number;
  hz: number;
  /** seconds */
  dur: number;
}

/** Bars in the loop before it repeats. */
export const MUSIC_BARS = 8;

// A slow, sparse pentatonic figure. Deliberately under-written: idle-game
// background music has to survive hours, so it stays low-energy and never
// resolves hard enough to demand attention. Bar 0 and bar MUSIC_BARS are
// identical by construction, so the loop has no seam.
const FIGURE: Array<Array<[number, number, number]>> = [
  // [beat, pentatonic degree index (may exceed 5 → next octave), duration]
  [[0, 0, 1.6], [2, 2, 1.2]],
  [[0, 4, 1.6], [2.5, 3, 0.9]],
  [[0, 2, 1.6], [1.5, 5, 0.8], [3, 4, 0.7]],
  [[0, 0, 2.2]],
  [[0, 3, 1.6], [2, 5, 1.2]],
  [[0, 2, 1.6], [2.5, 6, 0.9]],
  [[0, 4, 1.4], [1.5, 3, 0.8], [3, 1, 0.9]],
  [[0, 0, 2.4], [2, 7, 1.0]],
];

export function musicBar(bar: number): MusicEvent[] {
  const idx = ((Math.floor(bar) % MUSIC_BARS) + MUSIC_BARS) % MUSIC_BARS;
  return FIGURE[idx].map(([beat, degreeIdx, dur]) => {
    const degree = PENTATONIC[degreeIdx % PENTATONIC.length];
    const octave = Math.floor(degreeIdx / PENTATONIC.length);
    return { beat, hz: hzFromRoot(C4, degree + 12 * octave), dur };
  });
}

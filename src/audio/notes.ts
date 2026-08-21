// Pure music theory for the synthesized audio. No WebAudio here, so the
// pitches, the groove and the loop can be unit-tested without a browser.
//
// Choices come from how reward audio actually works: ascending runs on
// consonant intervals (major third, perfect fifth) read as success, while a
// descending run reads as failure. The background loop is a different job —
// see the block above BACKGROUND LOOP.

/** Equal-temperament transpose: `semis` semitones above `root` Hz. */
export function hzFromRoot(root: number, semis: number): number {
  return root * 2 ** (semis / 12);
}

// Major pentatonic degrees, in semitones. No 4th or 7th — no dissonance
// possible against a squish blip landing on top.
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

// ---------------------------------------------------------------------------
// BACKGROUND LOOP
//
// Rewritten 2026-08-21. Dor: "change the music into something more pumping,
// style that used in roblox games."
//
// What was here before was the opposite by design: 74bpm, a sparse pentatonic
// figure and a pad, written to survive hours unnoticed. Roblox-simulator music
// is loud, fast and repetitive on purpose — a driving tempo, four-on-the-floor
// kick, offbeat hats, a moving bass and a bright arpeggio over a four-chord
// loop. The pieces are split into three pure generators (lead / bass / drums)
// so the groove is testable and `audio/music.ts` only has to know how to make
// each voice's sound.
//
// Durations are in BEATS, not seconds — the tempo lives here, and music.ts
// converts. Under the old design the durations were hardcoded seconds tuned to
// a 74bpm bar, which silently desynced from any tempo change.
// ---------------------------------------------------------------------------

/** Beats per minute of the background loop. */
export const MUSIC_BPM = 128;

/** Bars in the loop before it repeats. */
export const MUSIC_BARS = 8;

/** The tonal centre: A3. Everything below is semitones from here. */
const TONIC_HZ = 220;

export interface MusicEvent {
  /** beat within the bar, 0..4 (4/4) */
  beat: number;
  hz: number;
  /** length in BEATS — music.ts multiplies by the beat duration */
  dur: number;
}

export interface DrumEvent {
  beat: number;
  kind: 'kick' | 'snare' | 'hat';
}

export interface Chord {
  /** semitones from the tonic */
  root: number;
  minor: boolean;
}

/**
 * i – VI – III – VII in A minor, two bars each. The workhorse progression of
 * the genre: it never resolves hard, so an eight-bar loop can run all evening
 * without the ear demanding an ending.
 */
const PROGRESSION: Chord[] = [
  { root: 0, minor: true }, // Am
  { root: -4, minor: false }, // F
  { root: 3, minor: false }, // C
  { root: -2, minor: false }, // G
];

const BARS_PER_CHORD = 2;

/** Which chord bar `bar` sits on. Wraps with the loop; junk input is the tonic. */
export function chordAt(bar: number): Chord {
  const idx = normalizeBar(bar);
  return PROGRESSION[Math.floor(idx / BARS_PER_CHORD) % PROGRESSION.length];
}

function normalizeBar(bar: number): number {
  if (!Number.isFinite(bar)) return 0;
  return ((Math.floor(bar) % MUSIC_BARS) + MUSIC_BARS) % MUSIC_BARS;
}

/** Chord tones, extended over two octaves so an arpeggio has somewhere to go. */
function chordTones(chord: Chord): number[] {
  const triad = chord.minor ? [0, 3, 7] : [0, 4, 7];
  return [...triad, ...triad.map((s) => s + 12)];
}

/**
 * The lead: a fixed eighth-note rhythm whose degrees are read off whatever
 * chord the bar is on. A constant shape over changing harmony is what makes
 * this style feel like one hook rather than eight unrelated bars — and it means
 * the melody can never fall off the chord, which the tests pin.
 *
 * Two alternating figures, so the two bars of each chord are not identical.
 */
const LEAD_FIGURES: number[][] = [
  [0, 2, 1, 2, 3, 2, 1, 0],
  [3, 2, 3, 4, 2, 1, 2, 0],
];

export function musicBar(bar: number): MusicEvent[] {
  const idx = normalizeBar(bar);
  const chord = chordAt(idx);
  const tones = chordTones(chord);
  const figure = LEAD_FIGURES[idx % LEAD_FIGURES.length];
  return figure.map((degree, i) => ({
    beat: i * 0.5,
    // +12: the lead sits an octave above the tonic, clear of the bass
    hz: hzFromRoot(TONIC_HZ, chord.root + tones[degree % tones.length] + 12),
    dur: 0.45, // just short of an eighth — the gap is what makes it plucky
  }));
}

/**
 * The bass: the chord root on driving eighths with an octave lift at the end of
 * the bar, an octave below the tonic. This is the voice doing most of the
 * "pumping" — drums give the pulse, the bass gives it weight.
 */
const BASS_BEATS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];

export function bassBar(bar: number): MusicEvent[] {
  const idx = normalizeBar(bar);
  const chord = chordAt(idx);
  return BASS_BEATS.map((beat) => ({
    beat,
    // the last eighth jumps an octave — a one-note turnaround into the next bar
    hz: hzFromRoot(TONIC_HZ, chord.root - 12 + (beat === 3.5 ? 12 : 0)),
    dur: 0.4,
  }));
}

/**
 * The drums. Four-on-the-floor kick, backbeat snare, offbeat hats — the exact
 * pattern that reads as "dance music" to anyone who has played a Roblox
 * simulator. The last bar of the loop adds a snare fill so the eight bars have
 * a top rather than just stopping and starting again.
 */
export function drumBar(bar: number): DrumEvent[] {
  const idx = normalizeBar(bar);
  const hits: DrumEvent[] = [];
  for (const beat of [0, 1, 2, 3]) hits.push({ beat, kind: 'kick' });
  for (const beat of [1, 3]) hits.push({ beat, kind: 'snare' });
  for (const beat of [0.5, 1.5, 2.5, 3.5]) hits.push({ beat, kind: 'hat' });
  if (idx === MUSIC_BARS - 1) {
    for (const beat of [3.25, 3.5, 3.75]) hits.push({ beat, kind: 'snare' });
  }
  return hits;
}

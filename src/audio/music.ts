// Procedural background loop. Synthesized rather than a sample file: no
// licensing, no payload, and it can react to game state.
//
// Shaped for an idle game specifically — this thing may run for hours, so it is
// slow, sparse, pentatonic and low in the mix. It is meant to be noticed once
// and then forgotten. It never resolves hard enough to demand attention.
import { MUSIC_BARS, hzFromRoot, musicBar } from './notes';
import { audioGraph } from './sound';

const BPM = 74; // slow — fast music against idle pacing reads as nagging
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOKAHEAD_S = 1.5; // schedule this far ahead of the clock
const TICK_MS = 500;

let timer: number | null = null;
let bar = 0;
let nextBarAt = 0;
let intensity = 0; // 0 = calm, 1 = frenzy

/** Raise while a frenzy runs: adds an octave sparkle layer and a touch of gain. */
export function setMusicIntensity(level: number): void {
  intensity = Math.min(Math.max(level, 0), 1);
}

function voice(
  ctx: AudioContext,
  out: GainNode,
  at: number,
  hz: number,
  dur: number,
  gain: number,
  type: OscillatorType = 'triangle',
): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  const g = ctx.createGain();
  // long soft attack/release — no clicks, nothing percussive
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + dur * 0.25);
  g.gain.linearRampToValueAtTime(0, at + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  o.connect(g).connect(lp).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function scheduleBar(ctx: AudioContext, out: GainNode, index: number, at: number): void {
  for (const e of musicBar(index)) {
    voice(ctx, out, at + e.beat * BEAT, e.hz, e.dur, 0.16);
    // frenzy layer: the same note an octave up, quieter — makes the loop feel
    // lit up for 30s without changing the harmony
    if (intensity > 0) {
      voice(ctx, out, at + e.beat * BEAT, e.hz * 2, e.dur * 0.6, 0.05 * intensity, 'sine');
    }
  }
  // A quiet sustained pad under every bar — root + fifth, an octave down.
  // Without it the melody notes are so sparse they read as occasional plinks
  // rather than music; the pad is what makes it a loop you stop noticing.
  for (const semis of [-12, -5]) {
    voice(ctx, out, at, hzFromRoot(261.63, semis), BAR * 1.05, 0.055, 'sine');
  }
  // a deeper root drone under every other bar, holding the whole loop together
  if (index % 2 === 0) {
    voice(ctx, out, at, hzFromRoot(261.63, -24), BAR * 2, 0.09, 'sine');
  }
}

function pump(): void {
  const g = audioGraph();
  if (!g) return;
  const { ctx, music } = g;
  if (nextBarAt === 0) nextBarAt = ctx.currentTime + 0.15;
  while (nextBarAt < ctx.currentTime + LOOKAHEAD_S) {
    scheduleBar(ctx, music, bar, nextBarAt);
    bar = (bar + 1) % MUSIC_BARS;
    nextBarAt += BAR;
  }
}

/** Begin scheduling. Safe to call repeatedly; needs unlockAudio() first. */
export function startMusic(): void {
  if (timer !== null || !audioGraph()) return;
  nextBarAt = 0;
  pump();
  timer = window.setInterval(pump, TICK_MS);
}

export function stopMusic(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  bar = 0;
  nextBarAt = 0;
}

export function isMusicRunning(): boolean {
  return timer !== null;
}

// Procedural background loop. Synthesized rather than a sample file: no
// licensing, no payload, and it can react to game state.
//
// REWRITTEN 2026-08-21 on Dor's note: "change the music into something more
// pumping, style that used in roblox games." What was here was a 74bpm sparse
// pentatonic pad, written to be noticed once and then forgotten. This is the
// other thing entirely — 128bpm, four-on-the-floor kick, offbeat hats, a
// driving saw bass and a detuned arpeggio lead over a four-chord loop.
//
// The notes, the groove and the tempo are all in `notes.ts`, which is pure and
// unit-tested. This file only knows how to make each voice's SOUND: it reads
// three generators per bar and schedules them.
import {
  MUSIC_BARS,
  MUSIC_BPM,
  bassBar,
  drumBar,
  musicBar,
  type DrumEvent,
} from './notes';
import { audioGraph } from './sound';

const BEAT = 60 / MUSIC_BPM;
const BAR = BEAT * 4;
const LOOKAHEAD_S = 1.5; // schedule this far ahead of the clock
const TICK_MS = 500;

// Levels, mixed once here rather than scattered through the voices. The loop
// runs for hours under gameplay SFX, so every voice is deliberately quiet — the
// energy comes from the rhythm, not the volume.
const LEAD_GAIN = 0.075;
const BASS_GAIN = 0.13;
const KICK_GAIN = 0.3;
const SNARE_GAIN = 0.1;
const HAT_GAIN = 0.035;

let timer: number | null = null;
let bar = 0;
let nextBarAt = 0;
let intensity = 0; // 0 = calm, 1 = frenzy
let noise: AudioBuffer | null = null;

/** Raise while a frenzy runs: opens the lead's filter and lifts the whole mix. */
export function setMusicIntensity(level: number): void {
  intensity = Math.min(Math.max(level, 0), 1);
}

/** One short burst of white noise, reused by the snare and the hats. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = Math.floor(ctx.sampleRate * 0.4);
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

/**
 * The lead: two saws a few cents apart. The detune is the whole character —
 * a single saw reads as a cheap beep, two slightly apart read as a synth.
 */
function lead(ctx: AudioContext, out: GainNode, at: number, hz: number, dur: number): void {
  const g = ctx.createGain();
  // plucky: instant attack, exponential fall. A soft attack here would smear
  // the eighth notes into each other and lose the rhythm entirely.
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(LEAD_GAIN * (1 + intensity * 0.5), at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  // the frenzy opens the filter — brighter, not just louder
  lp.frequency.value = 2200 + intensity * 3500;
  lp.Q.value = 6;

  for (const cents of [-7, 7]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz;
    o.detune.value = cents;
    o.connect(g);
    o.start(at);
    o.stop(at + dur + 0.02);
  }
  g.connect(lp).connect(out);
}

/** The bass: one saw through a tight lowpass, short and punchy. */
function bass(ctx: AudioContext, out: GainNode, at: number, hz: number, dur: number): void {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(BASS_GAIN, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  o.connect(g).connect(lp).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Kick: a sine pitched from 130Hz down to 45 in 90ms. The genre's whole floor. */
function kick(ctx: AudioContext, out: GainNode, at: number): void {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(130, at);
  o.frequency.exponentialRampToValueAtTime(45, at + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(KICK_GAIN, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 0.2);
}

/** Snare: noise through a bandpass, with a short body tone under it. */
function snare(ctx: AudioContext, out: GainNode, at: number, gain = SNARE_GAIN): void {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
  n.connect(bp).connect(g).connect(out);
  n.start(at);
  n.stop(at + 0.15);
}

/** Hat: the same noise, highpassed hard and cut very short. */
function hat(ctx: AudioContext, out: GainNode, at: number): void {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 8000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(HAT_GAIN * (1 + intensity), at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  n.connect(hp).connect(g).connect(out);
  n.start(at);
  n.stop(at + 0.06);
}

function drum(ctx: AudioContext, out: GainNode, at: number, d: DrumEvent): void {
  if (d.kind === 'kick') kick(ctx, out, at);
  else if (d.kind === 'snare') snare(ctx, out, at);
  else hat(ctx, out, at);
}

function scheduleBar(ctx: AudioContext, out: GainNode, index: number, at: number): void {
  // durations from notes.ts are in BEATS — the tempo lives there
  for (const e of musicBar(index)) {
    lead(ctx, out, at + e.beat * BEAT, e.hz, e.dur * BEAT);
    // frenzy layer: the same note an octave up, quieter. Keeps the harmony and
    // just lights it up for the 30 seconds the multiplier runs.
    if (intensity > 0) {
      lead(ctx, out, at + e.beat * BEAT, e.hz * 2, e.dur * BEAT * 0.6);
    }
  }
  for (const e of bassBar(index)) {
    bass(ctx, out, at + e.beat * BEAT, e.hz, e.dur * BEAT);
  }
  for (const d of drumBar(index)) {
    drum(ctx, out, at + d.beat * BEAT, d);
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

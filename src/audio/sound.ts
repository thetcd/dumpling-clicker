import { purchaseArpeggio } from './notes';

// Synthesized WebAudio — no sample files. Each squish is filtered noise + a
// pitch-dropping blip with randomized rate/gain, so mashing never sounds
// repetitive. Context unlocks inside the first user gesture (iOS requirement).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
// SFX and music sit on separate buses so they mute independently — players who
// want the squish but not the loop are the common case.
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = false;
let voices = 0;
const MAX_VOICES = 6;
const MUSIC_GAIN = 0.3; // deliberately low: background, never foreground

export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = muted ? 0 : 1;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0; // raised by setMusicEnabled once the player opts in
  musicBus.connect(master);
  const len = Math.floor(ctx.sampleRate * 0.1);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (sfxBus && ctx) {
    sfxBus.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.01);
  }
}

/** Fade the music bus in/out. Separate from setMuted (SFX). */
export function setMusicEnabled(on: boolean): void {
  if (musicBus && ctx) {
    musicBus.gain.setTargetAtTime(on ? MUSIC_GAIN : 0, ctx.currentTime, 0.4);
  }
}

/** Graph handles for the music scheduler (src/audio/music.ts). */
export function audioGraph(): { ctx: AudioContext; music: GainNode } | null {
  return ctx && musicBus ? { ctx, music: musicBus } : null;
}

// --- squish combo: rapid squishing climbs in pitch (up to +1 octave), a
// pause resets it. The rising ladder is the addictive part — it rewards
// mashing streaks the way coin/candy games do.
const COMBO_WINDOW_MS = 900;
const COMBO_MAX = 16;
let combo = 0;
let lastSquishAt = 0;

export function playSquish(): void {
  const nowMs = performance.now();
  combo = nowMs - lastSquishAt < COMBO_WINDOW_MS ? Math.min(combo + 1, COMBO_MAX) : 0;
  lastSquishAt = nowMs;
  if (!ctx || !sfxBus || !noiseBuffer || muted || voices >= MAX_VOICES) return;
  voices++;
  const t = ctx.currentTime;
  const dur = 0.09 + Math.random() * 0.04;
  const pitch = 2 ** (combo / COMBO_MAX); // 1.0 → 2.0 across a full streak
  const lift = 1 + combo / (COMBO_MAX * 3); // streaks also get slightly louder

  // squelchy noise burst through a closing lowpass
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.playbackRate.value = (0.85 + Math.random() * 0.3) * pitch;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime((900 + Math.random() * 300) * pitch, t);
  lp.frequency.exponentialRampToValueAtTime(250 * pitch, t + dur);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime((0.5 + Math.random() * 0.15) * lift, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(lp).connect(ng).connect(sfxBus);

  // soft body "boing": a sine dropping in pitch
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f0 = (260 + Math.random() * 80) * pitch;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + dur);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.25 * lift, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(og).connect(sfxBus);

  // bright arcade "tick" on top — the tiny reward transient that makes each
  // tap feel like scoring, not just touching dough
  const tick = ctx.createOscillator();
  tick.type = 'triangle';
  tick.frequency.setValueAtTime(1400 * pitch, t);
  tick.frequency.exponentialRampToValueAtTime(2100 * pitch, t + 0.03);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.08 * lift, t);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  tick.connect(tg).connect(sfxBus);

  // topping out the streak adds a sparkle chime so players chase it
  if (combo === COMBO_MAX) {
    const chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(1760, t);
    chime.frequency.exponentialRampToValueAtTime(2637, t + 0.12);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.12, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    chime.connect(cg).connect(sfxBus);
    chime.start(t);
    chime.stop(t + 0.32);
  }

  noise.start(t);
  osc.start(t);
  tick.start(t);
  noise.stop(t + dur + 0.02);
  osc.stop(t + dur + 0.02);
  tick.stop(t + 0.06);
  osc.onended = () => {
    voices = Math.max(0, voices - 1);
  };
}

/** Cheerful pop — kept for small confirmations. */
export function playPop(): void {
  if (!ctx || !sfxBus || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(g).connect(sfxBus);
  osc.start(t);
  osc.stop(t + 0.16);
}

/** One metallic coin transient — the "money landed in the tray" association. */
function coinTransient(at: number, hz: number, gain: number): void {
  if (!ctx || !sfxBus || !noiseBuffer) return;
  // short bright noise chirp = the clatter
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer;
  n.playbackRate.value = 2.6;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = hz * 2;
  bp.Q.value = 3;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(gain * 0.5, at);
  ng.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
  n.connect(bp).connect(ng).connect(sfxBus);
  n.start(at);
  n.stop(at + 0.06);
  // two detuned squares = the metallic ring
  for (const detune of [1, 1.005]) {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = hz * detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * 0.16, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.13);
    o.connect(g).connect(sfxBus);
    o.start(at);
    o.stop(at + 0.15);
  }
}

/**
 * The purchase payoff. Built from what reward audio actually does: a metallic
 * coin transient for the money association, then an ascending pentatonic run
 * (rising = success; falling would read as failure), then a shimmer tail.
 *
 * `tier` scales the whole thing so buying the boss cannot sound like buying an
 * apprentice, and `jackpot` (first time you own a tier) adds the low weight and
 * the long tail — the once-per-tier "big win" instead of a routine restock.
 */
export function playPurchase(tier: number, jackpot = false): void {
  if (!ctx || !sfxBus || muted) return;
  const t0 = ctx.currentTime;
  const notes = purchaseArpeggio(tier);
  const step = jackpot ? 0.085 : 0.06; // jackpots land slower, more deliberate

  notes.forEach((hz, i) => {
    const at = t0 + i * step;
    coinTransient(at, hz, jackpot ? 0.85 : 0.6);
    // sung body under the coins so the run reads as a melody, not just clicks
    const o = ctx!.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(hz, at);
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(jackpot ? 0.2 : 0.13, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
    o.connect(g).connect(sfxBus!);
    o.start(at);
    o.stop(at + 0.24);
  });

  const end = t0 + notes.length * step;

  if (jackpot) {
    // low thump for physical weight
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, t0);
    sub.frequency.exponentialRampToValueAtTime(60, t0 + 0.3);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.3, t0);
    sg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
    sub.connect(sg).connect(sfxBus);
    sub.start(t0);
    sub.stop(t0 + 0.37);

    // shimmer tail: a held high fifth that rings out after the run
    const top = notes[notes.length - 1];
    for (const [mult, gain] of [[2, 0.1], [3, 0.06]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = top * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, end);
      g.gain.linearRampToValueAtTime(gain, end + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, end + 0.9);
      o.connect(g).connect(sfxBus);
      o.start(end);
      o.stop(end + 0.95);
    }
  }
}

/** Bright rising sparkle when a golden dumpling is caught. */
export function playGolden(): void {
  if (!ctx || !sfxBus || muted) return;
  const notes = [783.99, 1046.5, 1318.51];
  notes.forEach((f, i) => {
    const t = ctx!.currentTime + i * 0.07;
    const osc = ctx!.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.18);
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(g).connect(sfxBus!);
    osc.start(t);
    osc.stop(t + 0.34);
  });
}

/**
 * "Something just appeared" — played when a findable spawns, not when it is
 * caught. Deliberately quiet and short: the common lane fires every 10-25s, so
 * at catch-volume this would become nagging within a minute. The rare lane gets
 * a brighter, longer arpeggio so a golden dumpling is audibly different from a
 * coin without the player having to look.
 */
export function playAppear(rare: boolean): void {
  if (!ctx || !sfxBus || muted) return;
  const notes = rare ? [659.25, 987.77, 1318.51] : [880, 1174.66];
  const peak = rare ? 0.16 : 0.075;
  notes.forEach((f, i) => {
    const t = ctx!.currentTime + i * (rare ? 0.075 : 0.055);
    const osc = ctx!.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    const g = ctx!.createGain();
    // a soft attack, so it reads as a chime rather than a click
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + (rare ? 0.3 : 0.16));
    osc.connect(g).connect(sfxBus!);
    osc.start(t);
    osc.stop(t + 0.34);
  });
}

/** Tiny fanfare for unlocking the Squishy Boss. */
export function playFanfare(): void {
  if (!ctx || !sfxBus || muted) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const t = ctx!.currentTime + i * 0.12;
    const osc = ctx!.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g).connect(sfxBus!);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

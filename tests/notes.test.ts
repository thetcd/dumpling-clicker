import { describe, expect, test } from 'vitest';
import {
  MUSIC_BARS,
  hzFromRoot,
  musicBar,
  purchaseArpeggio,
} from '../src/audio/notes';

describe('hzFromRoot', () => {
  test('0 semitones is the root itself', () => {
    expect(hzFromRoot(440, 0)).toBeCloseTo(440, 6);
  });

  test('12 semitones is exactly an octave', () => {
    expect(hzFromRoot(440, 12)).toBeCloseTo(880, 6);
    expect(hzFromRoot(440, -12)).toBeCloseTo(220, 6);
  });

  test('7 semitones is a perfect fifth (3:2, the consonance reward sounds use)', () => {
    expect(hzFromRoot(440, 7) / 440).toBeCloseTo(1.5, 2);
  });
});

describe('purchaseArpeggio', () => {
  test('always ascends — a falling reward sound reads as failure', () => {
    for (let tier = 0; tier < 10; tier++) {
      const notes = purchaseArpeggio(tier);
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i], `tier ${tier} note ${i}`).toBeGreaterThan(notes[i - 1]);
      }
    }
  });

  test('bigger purchases get longer, higher runs', () => {
    expect(purchaseArpeggio(9).length).toBeGreaterThan(purchaseArpeggio(0).length);
    const top = purchaseArpeggio(9);
    const bottom = purchaseArpeggio(0);
    expect(top[top.length - 1]).toBeGreaterThan(bottom[bottom.length - 1]);
  });

  test('every note is audible and finite', () => {
    for (let tier = 0; tier < 10; tier++) {
      for (const hz of purchaseArpeggio(tier)) {
        expect(Number.isFinite(hz)).toBe(true);
        expect(hz).toBeGreaterThan(80);
        expect(hz).toBeLessThan(12_000); // stays out of the ear-piercing range
      }
    }
  });

  test('out-of-range tiers are clamped, never NaN', () => {
    for (const tier of [-5, 0, 99, NaN]) {
      const notes = purchaseArpeggio(tier);
      expect(notes.length).toBeGreaterThan(0);
      for (const hz of notes) expect(Number.isFinite(hz)).toBe(true);
    }
  });

  test('is deterministic for a given tier', () => {
    expect(purchaseArpeggio(4)).toEqual(purchaseArpeggio(4));
  });
});

describe('musicBar', () => {
  test('loops seamlessly: bar N and bar N+MUSIC_BARS are identical', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      expect(musicBar(bar), `bar ${bar}`).toEqual(musicBar(bar + MUSIC_BARS));
    }
  });

  test('every event sits inside its bar and has real duration', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      for (const e of musicBar(bar)) {
        expect(e.beat).toBeGreaterThanOrEqual(0);
        expect(e.beat).toBeLessThan(4); // 4/4
        expect(e.dur).toBeGreaterThan(0);
        expect(Number.isFinite(e.hz)).toBe(true);
        expect(e.hz).toBeGreaterThan(50);
      }
    }
  });

  test('stays sparse — idle-game music must not draw attention', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      expect(musicBar(bar).length, `bar ${bar}`).toBeLessThanOrEqual(6);
    }
  });

  test('the loop is not a single repeated bar', () => {
    const shapes = new Set(
      Array.from({ length: MUSIC_BARS }, (_, b) =>
        musicBar(b).map((e) => `${e.beat}:${e.hz.toFixed(1)}`).join('|'),
      ),
    );
    expect(shapes.size).toBeGreaterThan(1);
  });
});

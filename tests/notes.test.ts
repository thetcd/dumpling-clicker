import { describe, expect, test } from 'vitest';
import {
  MUSIC_BARS,
  MUSIC_BPM,
  bassBar,
  chordAt,
  drumBar,
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

/**
 * Dor, 2026-08-21: "change the music into something more pumping, style that
 * used in roblox games."
 *
 * That is a direct reversal of what this loop was written for — the old figure
 * was a slow 74bpm pentatonic pad, deliberately sparse so it could run for
 * hours unnoticed. Roblox-simulator music is the opposite: a driving tempo,
 * four-on-the-floor drums, a moving bass and a bright arpeggio over a short
 * chord loop. The "stays sparse" test below became a DENSITY floor for exactly
 * this reason.
 */
describe('tempo', () => {
  test('drives rather than idles', () => {
    expect(MUSIC_BPM).toBeGreaterThanOrEqual(120);
  });
});

describe('chordAt', () => {
  test('changes every two bars, so the loop moves without churning', () => {
    expect(chordAt(0)).toEqual(chordAt(1));
    expect(chordAt(0)).not.toEqual(chordAt(2));
  });

  test('walks a four-chord progression across the eight-bar loop', () => {
    const distinct = new Set(
      Array.from({ length: MUSIC_BARS }, (_, b) => JSON.stringify(chordAt(b))),
    );
    expect(distinct.size).toBe(4);
  });

  test('wraps with the loop, so there is no seam', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      expect(chordAt(bar), `bar ${bar}`).toEqual(chordAt(bar + MUSIC_BARS));
    }
  });

  test('junk input falls back to the tonic rather than undefined', () => {
    expect(chordAt(Number.NaN)).toEqual(chordAt(0));
    expect(chordAt(-1)).toEqual(chordAt(MUSIC_BARS - 1));
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
        expect(e.hz).toBeLessThan(6_000);
      }
    }
  });

  // was "stays sparse — idle-game music must not draw attention", which is the
  // exact note Dor overruled
  test('drives — at least an eighth-note lead in every bar', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      expect(musicBar(bar).length, `bar ${bar}`).toBeGreaterThanOrEqual(8);
      // ...but not a wall of sound: a 16th-note lead over drums is mush
      expect(musicBar(bar).length, `bar ${bar}`).toBeLessThanOrEqual(16);
    }
  });

  test('the lead sits on the chord, so the loop is harmony and not noise', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      const { root, minor } = chordAt(bar);
      const tones = (minor ? [0, 3, 7] : [0, 4, 7]).map((s) => (((root + s) % 12) + 12) % 12);
      for (const e of musicBar(bar)) {
        // pitch class of the event, measured against the A tonal centre
        const semis = Math.round(12 * Math.log2(e.hz / 220));
        expect(tones, `bar ${bar} beat ${e.beat}`).toContain(((semis % 12) + 12) % 12);
      }
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

describe('bassBar', () => {
  test('holds the chord root, an octave or more below the lead', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      const lowestLead = Math.min(...musicBar(bar).map((e) => e.hz));
      for (const e of bassBar(bar)) {
        expect(e.hz, `bar ${bar}`).toBeLessThan(lowestLead);
        expect(e.hz).toBeGreaterThan(40); // still on a phone speaker
      }
    }
  });

  test('is on the chord, and moves with it', () => {
    const roots = Array.from({ length: MUSIC_BARS }, (_, b) => bassBar(b)[0].hz);
    expect(new Set(roots.map((r) => r.toFixed(2))).size).toBeGreaterThan(1);
  });

  test('pushes the beat — at least six notes a bar', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      expect(bassBar(bar).length, `bar ${bar}`).toBeGreaterThanOrEqual(6);
    }
  });

  test('loops seamlessly', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      expect(bassBar(bar), `bar ${bar}`).toEqual(bassBar(bar + MUSIC_BARS));
    }
  });
});

describe('drumBar', () => {
  test('four-on-the-floor: a kick on every beat', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      const kicks = drumBar(bar).filter((d) => d.kind === 'kick').map((d) => d.beat);
      expect(kicks, `bar ${bar}`).toEqual([0, 1, 2, 3]);
    }
  });

  test('backbeat snare on two and four', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      const snares = drumBar(bar).filter((d) => d.kind === 'snare').map((d) => d.beat);
      expect(snares, `bar ${bar}`).toContain(1);
      expect(snares).toContain(3);
    }
  });

  test('offbeat hats, which is what makes it read as dance music', () => {
    const hats = drumBar(0).filter((d) => d.kind === 'hat').map((d) => d.beat);
    expect(hats).toEqual([0.5, 1.5, 2.5, 3.5]);
  });

  test('the last bar of the loop fills, so the loop has a top', () => {
    const last = drumBar(MUSIC_BARS - 1).filter((d) => d.kind === 'snare');
    const plain = drumBar(0).filter((d) => d.kind === 'snare');
    expect(last.length).toBeGreaterThan(plain.length);
  });

  test('every hit sits inside its bar', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      for (const d of drumBar(bar)) {
        expect(d.beat).toBeGreaterThanOrEqual(0);
        expect(d.beat).toBeLessThan(4);
      }
    }
  });

  test('loops seamlessly', () => {
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      expect(drumBar(bar), `bar ${bar}`).toEqual(drumBar(bar + MUSIC_BARS));
    }
  });
});

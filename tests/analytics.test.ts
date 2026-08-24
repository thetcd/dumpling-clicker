import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  BUCKET_ACTIVE_MINUTES,
  BUCKET_INSTALL_AGE_DAYS,
  activeMinutesBucket,
  installAgeBucket,
  createSessionTimer,
  isFirstOpenToday,
} from '../src/analytics';

const vercelTrack = vi.fn();
const vercelInject = vi.fn();
vi.mock('@vercel/analytics', () => ({
  track: (...args: unknown[]) => vercelTrack(...args),
  inject: (...args: unknown[]) => vercelInject(...args),
}));

import {
  EVENTS,
  EVENTS_ENABLED,
  RANK_MILESTONES,
  initAnalytics,
  rankMilestone,
  sanitize,
  track,
} from '../src/analytics';

afterEach(() => {
  vercelTrack.mockReset();
  vercelInject.mockReset();
});

// These are not style tests. The game is child-directed, so "aggregate only,
// no identifier, no per-player profile" is what keeps it out of COPPA's
// persistent-identifier rules, Amendment 13's consent banner and the Play
// Families ban list. sanitize() is the enforcement point; this pins it.
describe('what may leave the device', () => {
  test('an event outside the published surface is dropped', () => {
    expect(sanitize('player-id')).toBeNull();
    expect(sanitize('session-length')).toBeNull();
  });

  test('a property outside the allowlist is dropped, event and all', () => {
    // the whole event dies rather than being sent with the offending key
    // stripped — a half-sent event is how a field nobody vetted ships
    expect(sanitize(EVENTS.launch, { userId: 'abc' })).toBeNull();
    expect(sanitize(EVENTS.rank, { rank: 10, saveAge: 500 })).toBeNull();
  });

  test('an allowlisted key with an unexpected value is still dropped', () => {
    // the key being legal is not the point; the value is what would carry data
    expect(sanitize(EVENTS.launch, { mode: 'ios-17.4-iphone' })).toBeNull();
    expect(sanitize(EVENTS.launch, { mode: 'browser' })).not.toBeNull();
  });

  test('only bucketed ranks survive', () => {
    // an exact deep rank in a player base this small is a near-unique value —
    // an identifier by another name
    expect(sanitize(EVENTS.rank, { rank: 37 })).toBeNull();
    expect(sanitize(EVENTS.rank, { rank: 30 })).not.toBeNull();
  });

  test('no event may carry more than the two properties Vercel allows', () => {
    expect(sanitize(EVENTS.launch, { mode: 'browser', rank: 10, extra: 1 })).toBeNull();
  });

  test('the whole event surface is ten names and stays that way', () => {
    // adding an eleventh means re-reading docs/DECISIONS.md § Analytics first
    expect(Object.values(EVENTS).sort()).toEqual([
      'boss-bought',
      'daily-open',
      'first-buy',
      'first-launch',
      'first-rebirth',
      'first-squish',
      'game-launch',
      'rank-reached',
      'session-end',
      'squishy-designed',
    ]);
  });
});

describe('rankMilestone', () => {
  test('returns the rank only at a milestone', () => {
    expect(rankMilestone(5)).toBe(5);
    expect(rankMilestone(50)).toBe(50);
    expect(rankMilestone(4)).toBeNull();
    expect(rankMilestone(49)).toBeNull();
  });

  test('rank 1 is not a milestone — first-rebirth already covers it', () => {
    expect(rankMilestone(1)).toBeNull();
  });

  test('junk locks rather than leaks', () => {
    expect(rankMilestone(Number.NaN)).toBeNull();
    expect(rankMilestone(10.5)).toBeNull();
    expect(rankMilestone(-5)).toBeNull();
  });

  test('the buckets stop at the shipped rank cap', () => {
    // REBIRTH_CAP is 50; a bucket past it would never fire and would quietly
    // rot the day the cap moves
    expect(Math.max(...RANK_MILESTONES)).toBe(50);
  });
});

describe('track', () => {
  test('sends nothing at all while custom events are a Pro-only feature', () => {
    // Hobby gets page views only, so an event here spends a request on data
    // nobody can read. Flip EVENTS_ENABLED in src/analytics.ts on upgrade.
    expect(EVENTS_ENABLED).toBe(false);
    track(EVENTS.launch, { mode: 'browser' });
    expect(vercelTrack).not.toHaveBeenCalled();
  });

  test('a rejected payload never reaches the SDK', () => {
    track(EVENTS.rank, { rank: 37 });
    expect(vercelTrack).not.toHaveBeenCalled();
  });

  test('an SDK that throws does not take the game down', () => {
    vercelTrack.mockImplementation(() => {
      throw new Error('offline');
    });
    expect(() => track(EVENTS.boss)).not.toThrow();
  });
});

describe('initAnalytics', () => {
  test('strips the query string before anything is sent', () => {
    initAnalytics();
    const { beforeSend } = vercelInject.mock.calls[0][0];
    // a URL is the classic way personal data reaches an analytics pipeline by
    // accident, and the game never reads a query parameter anyway
    expect(beforeSend({ url: 'https://dumplingclicker.com/?name=dor' }).url).toBe(
      'https://dumplingclicker.com/',
    );
  });

  test('an SDK that throws does not take the game down', () => {
    vercelInject.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => initAnalytics()).not.toThrow();
  });
});

// ── What the research changed ──────────────────────────────────────────────
//
// Retention is the highest-decision-value metric for an idle game and we could
// not see it at all. It turns out to be reachable without breaking any of the
// four conditions, by the same trick Apple's SKAdNetwork uses at industry
// scale: the DEVICE computes a statistic about itself and reports only a coarse
// bucket, so no identifier crosses the boundary and no two events can be
// joined.
//
// Both inputs already exist as GAMEPLAY state — `stats.createdAt` and
// `savedAt` — so nothing new is written to the device for analytics, which is
// what keeps condition 1 intact.
//
// D1 = count(age=1 today) / count(age=0 yesterday). A real per-day cohort
// measurement, not a steady-state guess, because new players are counted too.

describe('installAgeBucket', () => {
  const DAY = 86_400_000;

  test('a brand new player is day zero', () => {
    expect(installAgeBucket(1_000, 1_000)).toBe(0);
    expect(installAgeBucket(0, DAY - 1)).toBe(0);
  });

  test('the D1 and D7 cohorts land on their own buckets, exactly', () => {
    // these two carry the whole retention measurement; nothing may share them
    expect(installAgeBucket(0, DAY)).toBe(1);
    expect(installAgeBucket(0, 7 * DAY)).toBe(7);
  });

  test('boundaries are FROZEN — changing one severs the time series', () => {
    // there is no raw data to re-bucket, so these values are permanent
    expect(BUCKET_INSTALL_AGE_DAYS).toEqual([0, 1, 2, 3, 7, 14, 30]);
  });

  test('days between boundaries report the bucket below', () => {
    expect(installAgeBucket(0, 4 * DAY)).toBe(3);
    expect(installAgeBucket(0, 6 * DAY)).toBe(3);
    expect(installAgeBucket(0, 13 * DAY)).toBe(7);
    expect(installAgeBucket(0, 29 * DAY)).toBe(14);
  });

  test('everything past a month collapses into one open-ended bucket', () => {
    expect(installAgeBucket(0, 30 * DAY)).toBe(30);
    expect(installAgeBucket(0, 900 * DAY)).toBe(30);
  });

  test('a wound-back clock cannot emit a negative age', () => {
    // kids move the device clock to farm offline income; Clicker Heroes is the
    // canonical case. A negative age would be a nonsense event forever.
    expect(installAgeBucket(5 * DAY, 0)).toBe(0);
  });

  test('junk timestamps degrade to day zero rather than NaN', () => {
    expect(installAgeBucket(Number.NaN, DAY)).toBe(0);
    expect(installAgeBucket(0, Number.NaN)).toBe(0);
    expect(installAgeBucket(Number.POSITIVE_INFINITY, DAY)).toBe(0);
  });
});

describe('isFirstOpenToday', () => {
  // Gated on the save's own last-touched time — GAMEPLAY state. Using
  // sessionStorage would be writing to the device for analytics, which is
  // exactly what condition 1 forbids.
  const at = (iso: string) => new Date(iso).getTime();

  test('a second open on the same day does not report again', () => {
    expect(isFirstOpenToday(at('2026-08-22T09:00'), at('2026-08-22T21:00'))).toBe(false);
  });

  test('the first open on a new day reports', () => {
    expect(isFirstOpenToday(at('2026-08-22T23:50'), at('2026-08-23T00:10'))).toBe(true);
  });

  test('a gap of days still reports exactly once', () => {
    expect(isFirstOpenToday(at('2026-08-01T12:00'), at('2026-08-22T12:00'))).toBe(true);
  });

  test('a save with no usable timestamp reports', () => {
    expect(isFirstOpenToday(Number.NaN, at('2026-08-22T09:00'))).toBe(true);
    expect(isFirstOpenToday(0, at('2026-08-22T09:00'))).toBe(true);
  });

  test('a clock wound backwards reports rather than going silent', () => {
    // silence would lose the day entirely; a duplicate is the safer failure
    expect(isFirstOpenToday(at('2026-08-25T09:00'), at('2026-08-22T09:00'))).toBe(true);
  });
});

describe('activeMinutesBucket', () => {
  /**
   * ACTIVE time, never wall-clock. Idle-game players park the tab: CrazyGames
   * measured an average browser session near 30 minutes with sessions peaking
   * at 4am, which is substantially left-open-tab behaviour rather than play.
   * Wall-clock would measure the tab, not the child.
   *
   * Log-scale, because idle session lengths are heavy-tailed — and a mean is
   * unrecoverable from buckets anyway, so the honest statistic is the median.
   */
  test('boundaries are FROZEN', () => {
    expect(BUCKET_ACTIVE_MINUTES).toEqual([0, 1, 3, 10, 30]);
  });

  test('a bounce is its own bucket — the FTUE alarm signal', () => {
    expect(activeMinutesBucket(0)).toBe(0);
    expect(activeMinutesBucket(59_000)).toBe(0);
  });

  test('the genre benchmark band is resolvable', () => {
    // casual median lands 4-6 min and the top quartile near 5.2, so 3-10 has
    // to be its own bucket or the one number worth watching is invisible
    expect(activeMinutesBucket(4 * 60_000)).toBe(3);
    expect(activeMinutesBucket(6 * 60_000)).toBe(3);
  });

  test('the long tail collapses rather than fingerprinting', () => {
    expect(activeMinutesBucket(30 * 60_000)).toBe(30);
    expect(activeMinutesBucket(11 * 60 * 60_000)).toBe(30);
  });

  test('junk and negatives degrade to the bounce bucket', () => {
    expect(activeMinutesBucket(Number.NaN)).toBe(0);
    expect(activeMinutesBucket(-5000)).toBe(0);
  });
});

describe('createSessionTimer', () => {
  const clock = (start = 0) => { let t = start; return { now: () => t, advance: (ms: number) => (t += ms) }; };

  test('counts only the time the game was actually being played', () => {
    const c = clock();
    const s = createSessionTimer(c.now);
    c.advance(2 * 60_000); // played
    s.pause();
    c.advance(60 * 60_000); // tab parked for an hour — must not count
    s.resume();
    c.advance(3 * 60_000); // played again
    let got = -1;
    s.end((b) => { got = b; });
    expect(got).toBe(3); // five active minutes, not sixty-five
  });

  test('reports once even when told to end twice', () => {
    // visibilitychange and pagehide both fire on a real exit; a double count
    // would inflate the bounce bucket, which is the FTUE alarm
    const c = clock();
    const s = createSessionTimer(c.now);
    c.advance(5 * 60_000);
    const seen: number[] = [];
    s.end((b) => seen.push(b));
    s.end((b) => seen.push(b));
    expect(seen).toEqual([3]);
  });

  test('a bounce reports the bounce bucket rather than nothing', () => {
    const c = clock();
    const s = createSessionTimer(c.now);
    c.advance(4_000);
    let got = -1;
    s.end((b) => { got = b; });
    expect(got).toBe(0);
  });

  test('a backwards clock cannot subtract time', () => {
    const c = clock(1_000_000);
    const s = createSessionTimer(c.now);
    c.advance(-500_000);
    expect(s.elapsed()).toBe(0);
  });
});

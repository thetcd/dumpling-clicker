import { afterEach, describe, expect, test, vi } from 'vitest';

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

  test('the whole event surface is six names and stays that way', () => {
    // adding a seventh means re-reading docs/DECISIONS.md § Analytics first
    expect(Object.values(EVENTS).sort()).toEqual([
      'boss-bought',
      'first-launch',
      'first-rebirth',
      'game-launch',
      'rank-reached',
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

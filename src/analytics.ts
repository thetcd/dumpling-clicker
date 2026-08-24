// Aggregate, cookieless analytics — and the legal boundary that shapes it.
//
// The players are kids, which makes this the strictest kind of measurement
// there is. Three regimes stack (COPPA, Israel's PPL Amendment 13, Google Play
// Families) and they all collapse to nothing to consent to IF, and only if,
// four things hold:
//
//   1. no cookie, and nothing read from or written to the device for analytics
//   2. no identifier transmitted — not a device id, not an install id, not a
//      hash we compute ourselves
//   3. no per-player profile: no field may ever let two events be joined into
//      one child's history
//   4. aggregate counts only
//
// Break any one and the game inherits a consent banner, a written retention
// policy and a written security programme. So this module is deliberately
// small and deliberately paranoid: `sanitize()` below drops anything that is
// not on the allowlist rather than trusting the call site. See
// docs/DECISIONS.md § "Analytics" for the full reasoning and what was rejected.
//
// Vercel Web Analytics was chosen because Vercel already hosts the game and
// therefore already sees every request — it adds no new recipient of data,
// no new sub-processor and nothing new to declare. Their collector keeps a
// hash of the incoming request for 24h and stores no IP.
import { inject, track as vercelTrack } from '@vercel/analytics';

// ON since 2026-08-24, ahead of the promoted launch: the launch week is the
// most informative week the game will ever have and there is no raw data to
// backfill from, so measuring it late means not measuring it.
//
// Custom events are a Pro-plan feature. On Hobby the SDK still sends them and
// Vercel simply does not record them — harmless, but invisible, so the plan
// upgrade is what actually turns this on. Page views work on every plan.
//
// TIED TO public/privacy.html. The page enumerates this exact event surface and
// both bucket ladders. Adding an event or moving a boundary is a change to a
// published promise on a site played by children: edit both in the same commit,
// or don't edit either.
export const EVENTS_ENABLED = true;

/** The complete event surface. Nothing outside this may ever be sent. */
export const EVENTS = {
  /** every launch, split by installed-app vs browser tab */
  launch: 'game-launch',
  /** no save existed — a genuinely new player */
  firstLaunch: 'first-launch',
  /** finished the first-launch designer (the first real drop-off point) */
  designed: 'squishy-designed',
  /** completed rebirth 1 — the meta-loop actually engaged. Rank 1 is
   *  deliberately absent from RANK_MILESTONES so this is not double-counted. */
  firstRebirth: 'first-rebirth',
  /** crossed one of RANK_MILESTONES; carries the bucket, never the exact rank */
  rank: 'rank-reached',
  /** bought Gal, the tier-10 boss */
  boss: 'boss-bought',
  /**
   * RETENTION. Once per calendar day, carrying how old the install is. This is
   * the whole retention measurement and it is the highest-decision-value
   * number the game can produce: D1 = count(age=1 today) / count(age=0
   * yesterday), and likewise for D7 and D30. A real per-day cohort, because
   * `firstLaunch` gives every day's denominator.
   */
  dailyOpen: 'daily-open',
  /**
   * SESSION LENGTH, in ACTIVE minutes — never wall-clock. Sent on the way out,
   * and re-sent at next launch if the browser killed us before the beacon
   * (mobile OSes drop PWAs without firing pagehide, which right-censors exactly
   * the long sessions an idle game cares most about).
   */
  sessionEnd: 'session-end',
  /** the first tap ever — time-to-core-gameplay, the earliest drop-off */
  firstSquish: 'first-squish',
  /** the first producer ever bought — the first real core-loop decision */
  firstBuy: 'first-buy',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

const EVENT_NAMES: readonly string[] = Object.values(EVENTS);

/**
 * The only ranks that report. Sending the exact rank would turn a coarse
 * histogram into a near-unique value for anyone deep in the game — a small
 * player base plus an exact number is an identifier by another name.
 */
export const RANK_MILESTONES = [5, 10, 20, 30, 40, 50] as const;

/** The rank bucket `prestige` crosses, or null if it is not a milestone. */
export function rankMilestone(prestige: number): number | null {
  if (!Number.isInteger(prestige)) return null;
  return RANK_MILESTONES.includes(prestige as (typeof RANK_MILESTONES)[number])
    ? prestige
    : null;
}

/**
 * Vercel allows 2 custom properties per event on Pro. That ceiling is a useful
 * accident: it is also about as much detail as this game may carry.
 *
 * Worth knowing: the Web Analytics Plus add-on raises this to 8 and extends the
 * reporting window from 12 to 24 months. If that is ever bought, the first
 * property to add is a completed-the-designer flag on `dailyOpen`, which would
 * let retention be split by whether the player ever got past the creator — the
 * single most useful segment this game has.
 */
const MAX_PROPS = 2;

/** Every property key that may ever be sent, and what counts as a legal value. */
const ALLOWED_PROPS: Record<string, (v: unknown) => boolean> = {
  // how the game was opened. Two values, both derived from the display mode —
  // nothing about the device, nothing about the player.
  mode: (v) => v === 'standalone' || v === 'browser',
  // only ever a value from RANK_MILESTONES
  rank: (v) => typeof v === 'number' && rankMilestone(v) !== null,
  // days since install, and only ever a frozen bucket boundary
  age: (v) => typeof v === 'number' && BUCKET_INSTALL_AGE_DAYS.includes(v as never),
  // active minutes in the session, and only ever a frozen bucket boundary
  active: (v) => typeof v === 'number' && BUCKET_ACTIVE_MINUTES.includes(v as never),
};

/**
 * FROZEN. Bucket boundaries can never change: there is no raw data kept
 * anywhere, so re-bucketing is impossible and a moved boundary silently severs
 * the time series it is supposed to measure.
 *
 * Chosen so the numbers that drive decisions each get their own cell. Days 1
 * and 7 are exact because D1 and D7 are the measurement; 30 is open-ended
 * because beyond a month the population is too thin to slice without making a
 * rare combination identifying.
 */
export const BUCKET_INSTALL_AGE_DAYS = [0, 1, 2, 3, 7, 14, 30] as const;

/**
 * FROZEN, log-scale. Idle-game session lengths are heavy-tailed, and a mean
 * cannot be recovered from buckets at all — so the honest statistic is a
 * median read off this histogram, and the bands have to be wide near the top.
 *
 * 0 is its own bucket because a sub-minute session is a bounce, which is the
 * loudest FTUE alarm there is. 3-10 is its own bucket because the casual
 * benchmark band sits at 4-6 minutes, and collapsing it would hide the one
 * number most worth watching.
 */
export const BUCKET_ACTIVE_MINUTES = [0, 1, 3, 10, 30] as const;

const DAY_MS = 86_400_000;

/** The largest boundary in `ladder` that `value` reaches. */
function bucketOf(value: number, ladder: readonly number[]): number {
  let chosen = ladder[0];
  for (const edge of ladder) if (value >= edge) chosen = edge;
  return chosen;
}

/**
 * How old this install is, in bucketed days, from the save's own `createdAt`.
 *
 * Clamped at zero: children wind the device clock back to farm offline income
 * (Clicker Heroes is the canonical case), and a negative age would be a
 * permanently nonsensical event with no way to clean it up later.
 */
export function installAgeBucket(createdAt: number, now: number): number {
  if (!Number.isFinite(createdAt) || !Number.isFinite(now)) return 0;
  const days = Math.floor(Math.max(0, now - createdAt) / DAY_MS);
  return bucketOf(days, BUCKET_INSTALL_AGE_DAYS);
}

/**
 * Is this the first launch on a new calendar day?
 *
 * Gated on `savedAt` — the save's own last-touched time, which is GAMEPLAY
 * state. Using sessionStorage would mean writing to the device for analytics,
 * which is precisely what condition 1 forbids.
 *
 * Anything unusable reports rather than going silent: a duplicated day inflates
 * one cell, whereas a missed day loses a cohort denominator permanently.
 */
export function isFirstOpenToday(savedAt: number, now: number): boolean {
  if (!Number.isFinite(savedAt) || savedAt <= 0 || !Number.isFinite(now)) return true;
  if (savedAt > now) return true; // clock wound back
  const last = new Date(savedAt);
  const today = new Date(now);
  return (
    last.getFullYear() !== today.getFullYear() ||
    last.getMonth() !== today.getMonth() ||
    last.getDate() !== today.getDate()
  );
}

/** Active minutes in a session, bucketed. Never wall-clock — see the ladder. */
export function activeMinutesBucket(activeMs: number): number {
  if (!Number.isFinite(activeMs) || activeMs <= 0) return 0;
  return bucketOf(Math.floor(activeMs / 60_000), BUCKET_ACTIVE_MINUTES);
}

export type EventProps = Record<string, string | number | boolean | null>;

/**
 * The gate every event passes through. Returns the payload to send, or null to
 * drop it. Written as a pure function so the rules above are testable without
 * a browser, a network or the SDK.
 */
export function sanitize(
  name: string,
  props?: EventProps,
): { name: EventName; props?: EventProps } | null {
  if (!EVENT_NAMES.includes(name)) return null;
  if (!props) return { name: name as EventName };

  const entries = Object.entries(props);
  if (entries.length > MAX_PROPS) return null;
  for (const [key, value] of entries) {
    const legal = ALLOWED_PROPS[key];
    if (!legal || !legal(value)) return null;
  }
  return { name: name as EventName, props };
}

/** Installed app or browser tab. Never throws — this runs before the game does. */
export function launchMode(): 'standalone' | 'browser' {
  try {
    const standalone =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    return standalone ? 'standalone' : 'browser';
  } catch {
    return 'browser';
  }
}

/**
 * Start page-view collection. Called once, from boot.
 *
 * `beforeSend` strips the query string outright. The game never reads a query
 * parameter, so nothing is lost — but a link Gal posts could carry one, and a
 * URL is the classic way personal data reaches an analytics pipeline by
 * accident. Belt and braces on a kids' site.
 */
export function initAnalytics(): void {
  try {
    inject({
      mode: import.meta.env.DEV ? 'development' : 'production',
      beforeSend: (event) => ({ ...event, url: event.url.split('?')[0] }),
    });
  } catch {
    // analytics must never take the game down with it
  }
}

/**
 * Session length, measured as ACTIVE time and reported once on the way out.
 *
 * Active, never wall-clock: idle-game players park the tab, and a wall-clock
 * figure measures the tab rather than the child. CrazyGames measured an average
 * browser session near 30 minutes with a peak at 4am — that is a left-open
 * laptop, not engagement.
 *
 * `sendBeacon` via the SDK's own transport, on `visibilitychange -> hidden`
 * rather than `pagehide`: mobile browsers frequently kill a PWA without ever
 * firing pagehide, which would right-censor exactly the long sessions an idle
 * game most wants to see.
 */
export function createSessionTimer(now: () => number = () => Date.now()) {
  let activeMs = 0;
  let since: number | null = now();
  let reported = false;

  return {
    /** Visible and being played — start counting. */
    resume(): void {
      if (since === null) since = now();
    },
    /** Hidden or idle — bank what we have and stop counting. */
    pause(): void {
      if (since !== null) {
        activeMs += Math.max(0, now() - since);
        since = null;
      }
    },
    /** Active ms so far, whether or not the clock is currently running. */
    elapsed(): number {
      return activeMs + (since === null ? 0 : Math.max(0, now() - since));
    },
    /**
     * Report once and once only. A session can be told to end more than once —
     * visibilitychange and pagehide both fire on a real exit — and a double
     * count would inflate the shortest bucket, which is the one the FTUE alarm
     * reads.
     */
    end(send: (bucket: number) => void): void {
      if (reported) return;
      reported = true;
      this.pause();
      send(activeMinutesBucket(activeMs));
    },
  };
}

/** Send an aggregate event, if it survives `sanitize()`. Never throws. */
export function track(name: EventName, props?: EventProps): void {
  const safe = sanitize(name, props);
  if (!safe) return;
  if (!EVENTS_ENABLED) return;
  try {
    vercelTrack(safe.name, safe.props);
  } catch {
    // as above: a failed beacon is not a reason to break someone's game
  }
}

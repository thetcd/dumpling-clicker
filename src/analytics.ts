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

// Custom events are a Pro-plan feature. On Hobby the account gets page views
// only (50k events/month, one-month reporting window), so firing events there
// spends requests on data nobody can read. Every call site is written and
// tested now; the day the Vercel team goes Pro this constant is the only edit.
export const EVENTS_ENABLED = false;

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
 * Vercel allows 2 custom properties per event on Pro. That ceiling is a
 * useful accident: it is also about as much detail as this game may carry.
 */
const MAX_PROPS = 2;

/** Every property key that may ever be sent, and what counts as a legal value. */
const ALLOWED_PROPS: Record<string, (v: unknown) => boolean> = {
  // how the game was opened. Two values, both derived from the display mode —
  // nothing about the device, nothing about the player.
  mode: (v) => v === 'standalone' || v === 'browser',
  // only ever a value from RANK_MILESTONES
  rank: (v) => typeof v === 'number' && rankMilestone(v) !== null,
};

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

---
name: analytics
description: Aggregate, cookieless analytics for דאמפלינג קליקר via Vercel Web Analytics. Use for anything about measuring players, the Vercel dashboard, the 50k free-tier limit, adding or changing a tracked event, src/analytics.ts, the privacy policy's data section, the Play Data safety form's answers, COPPA / Israel Amendment 13 / Play Families obligations, or "how many people are playing".
---

# Analytics — aggregate only, and that is a legal boundary

Shipped 2026-08-23. `src/analytics.ts`, wired from `src/boot.ts`, collecting via
**Vercel Web Analytics** (enabled in the dashboard the same day).

`docs/DECISIONS.md` § "Analytics: aggregate or nothing" is the reasoning and the
rejected alternatives. This skill is the operational knowledge.

## The one rule everything else follows

The players are **children**. COPPA, Israel's PPL Amendment 13 and Google Play
Families all bind. The game clears all three — **no consent banner, no written
retention policy, no security programme** — only while four things hold:

1. no cookie, and nothing read from or written to the device for measurement
2. **no identifier transmitted** — not a device ID, not an install ID, not one
   we hash ourselves
3. no per-player profile: no field may let two events be joined into one child's
   history
4. aggregate counts only

Break any one and the game inherits a banner as its first screen *plus* written
retention and security obligations. This is not a style preference.

`sanitize()` enforces it in code with an allowlist of **six event names and two
property keys**, and drops the whole event — not just the offending key — if
anything is off-list. A half-sent event is how an unvetted field ships.

## Never do these

- **Add a random install ID to the save to count returning players.** This is
  the single most tempting shortcut and it is exactly the persistent identifier
  COPPA restricts on a child-directed service. There is no retention chart worth
  it.
- **Add Google Analytics, Plausible, PostHog or any other tool.** Vercel was
  chosen on one argument: it already hosts the game, so it adds **no new
  recipient of data** — no new sub-processor, no new DPA, nothing new to name on
  the privacy page or the Play form. Every alternative loses on that point alone.
- **Send session length / time-on-page.** Genuinely useful, deliberately
  dropped: it is the field most likely to read as behavioural measurement of a
  child to a reviewer.
- **Send the exact rebirth rank.** The player base is small enough that an exact
  deep rank is a near-unique value. `rankMilestone()` reports 5/10/20/30/40/50
  or nothing.
- **Add an in-game opt-out toggle.** Considered and rejected as *actively
  worse*: it implies there is something to opt out of and invites the argument
  that consent was the lawful basis all along. The right answer to "can I turn
  tracking off" is that there is no tracking to turn off.

## If you change src/analytics.ts, two other things must change with it

1. **`public/privacy.html`** — both the Hebrew and English sections itemise what
   is collected. It already shipped once saying "no analytics and no tracking",
   which stopped being true.
2. **The Play Data safety form** — `docs/GOOGLE-PLAY.md` Phase D carries the
   exact answers. A wrong answer there is a **takedown risk, not a paperwork
   slip**.

## The account, and the link

| | |
|---|---|
| Team | `DC's projects`, slug **`dcs-projects-15812ffd`** |
| Project | `dumpling-clicker` |
| Dashboard | https://vercel.com/dcs-projects-15812ffd/dumpling-clicker/analytics |
| Plan | **Hobby** |

## The free-tier limit, and when it runs out

**50,000 events per month**, and an event is one page view. The game is a single
page with no client-side router, so **one launch = one event**. That is
~1,666 launches per day sustained.

| launches per player per day | monthly-active players that fits |
|---|---|
| 1 | ~1,600 |
| 2 | ~830 |
| 3 | ~550 |
| 5 | ~330 |

**Call it 500–1,500 monthly-active players.** The game has no offline income, so
there is no reason to check in constantly — 1–3 launches a day is the realistic
band, which puts the ceiling around 550–1,600.

Three things that make the real number lower than the table:

- **The quota is shared across the whole team.** `dorwebsite` is on the same
  account and eats the same 50,000.
- **A reload is an event.** `registerType: 'autoUpdate'` can reload the page
  under a player when a new build lands.
- **A PWA/TWA launch is a page load**, same as a browser visit.

**A Gal video is not the risk.** 3,000 curious kids clicking once is 6% of a
month. The risk is *sustained* daily players, not a spike.

**At the limit:** a 3-day grace period, then collection pauses. Hobby is never
billed for overage — you just stop collecting until the cycle resets.

## Custom events are Pro-only, and are currently dark

`EVENTS_ENABLED` in `src/analytics.ts` is **`false`** on purpose. Hobby gets page
views only, so firing events there spends requests on data nobody can read.

The six events are written, wired and tested:

| event | fires when |
|---|---|
| `game-launch` | every launch, with `mode: standalone \| browser` |
| `first-launch` | no save existed — a genuinely new player |
| `squishy-designed` | finished the first-launch designer |
| `first-rebirth` | completed rebirth 1 |
| `rank-reached` | crossed a RANK_MILESTONES bucket, with `rank` |
| `boss-bought` | bought Gal |

Going Pro is **one constant flip**, not a code change.

## What it can and cannot answer

**Can:** how many players, roughly where, installed-app vs browser share, what
they arrived from, and — once Pro — how far into the game they get.

**Cannot, by design:** retention cohorts, "is this the same kid as last week",
anything per-person. **There are no accounts, so there are no sign-ins to
count.** Daily uniques come free from Vercel's 24h server-side request hash,
which is discarded and never touches the device.

## Two limits worth knowing before reading the dashboard

- **The reporting window on Hobby is one month.** That is *shorter than the
  multi-week question* the release cadence in `docs/PROGRESS.md` §6 actually
  asks. If that question starts mattering, it is the real argument for Pro —
  not the event ceiling.
- **Nothing backfills.** The script only fires on views after it was enabled.

## Tests

`tests/analytics.test.ts` (15) pins the boundary, not the behaviour: off-list
events dropped, allowlisted keys with unexpected values still dropped, the
2-property ceiling, junk ranks locking rather than leaking, and that a throwing
SDK never takes the game down.

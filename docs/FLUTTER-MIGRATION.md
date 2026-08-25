# Dumpling Clicker → Flutter + Flame

**Status:** IN PROGRESS. Approved 2026-08-25; Phase 0 + Phase 1 built the same
day. **Three deviations, Dor's call (2026-08-25):** the Flutter project lives in
its own sibling repo `~/ApiScripts/dumpling-clicker-flutter` (not `app/` here —
its `PORTING.md` carries the conventions), and ads + richer screens are planned
after parity. This repo stays the frozen TS oracle the port is tested against.

Done so far (all verified): the 0a format fixture (482 rows, committed to the
Flutter repo — regenerate with `node tools/format-fixture.mjs` here); the whole
pure core + tests ported (243 passing); `tool/simulate.dart` diffs
BYTE-IDENTICAL against `tools/simulate.mjs` at the shipped constants; a first
runnable RTL shell with the DC1 restore path; Android identity pinned
(`com.dumplingclicker.twa`, versionCode 2). Not started: Flame stage, real
avatar/SVG rendering, audio, analytics endpoint, the migration-nag web release.

> **Start here, before writing any code.** Read `CLAUDE.md` and
> `docs/DECISIONS.md` (721 lines) first. Both encode *measured* decisions where
> the obvious implementation was tried and failed — `CLICK_DPS_SHARE = 0.05` not
> 0.01, the getter-not-reference convention, `heal()`-instead-of-migrations, "no
> offline income", the crit-outside-`clickValue` rule. A port that reimplements
> from the running app rather than from these docs will re-introduce bugs that
> already cost real time.

---

## Context

Dumpling Clicker ships today as a vanilla-TypeScript PWA (~7,500 lines of app
source + 3,637 lines of Vitest) hosted on Vercel at `dumplingclicker.com`,
wrapped for Google Play as a Bubblewrap TWA. It is a Hebrew-first, full-RTL
clicker for kids: one screen, one currency, ten producers, a rebirth meta-loop,
three "findable" lanes, a player-designed squishy avatar, and no backend of any
kind.

The web platform is now the constraint rather than the enabler. Everything
visual is DOM/SVG/CSS — ~35 `@keyframes`, three independent
`requestAnimationFrame` loops, pooled `<div>`s restarted with reflow hacks —
which caps what the game can do and makes every new effect a CSS fight. The TWA
is a browser wrapper: it inherits Chrome's storage eviction, Chrome's "auto dark
theme" (already worked around), and AdSense's rules rather than AdMob's.
`docs/DOMAIN-AND-ADS.md` records that AdMob qualifies for child-directed
treatment where AdSense does not, so going native also unblocks the parked ad
path later.

**Target:** a Flutter app where Flame renders the game stage (backdrop, steamer,
hero, producer crowd, findables, particles, floating numbers) and ordinary
Flutter widgets render everything else (HUD, shop, rebirth bar, designer,
settings sheet, modals, toasts). Android and iOS; the web version retires.

### Decisions taken (2026-08-25)

| | |
|---|---|
| **Scope** | Faithful port. No new screens, no new features, no gameplay changes. Parity is the bar. |
| **Web** | Retired. `dumplingclicker.com` becomes a landing/redirect page. The TS source is frozen for reference (and for one final migration-nag release). |
| **Saves** | DC1 backup-code bridge — a web release that nags players to copy their code, and a paste-to-restore path in the Flutter app. |
| **Audio** | Re-synthesized in Dart. The combo pitch ladder and the frenzy-reactive music layer are gameplay feel, not decoration. |

---

## Repository layout

Keep **one repo**. The Flutter project becomes a subdirectory:

```
dumpling-clicker/
├── src/  tests/  tools/        TS — frozen after the migration-nag release
├── app/                        ← NEW: the Flutter project
│   ├── lib/
│   │   ├── game/               pure Dart port of src/game/** — NO package:flutter import
│   │   ├── i18n/strings_he.dart
│   │   ├── render/             SVG generators + rasterization cache
│   │   ├── flame/              DumplingGame + components (the stage)
│   │   ├── ui/                 Flutter widgets (HUD, shop, designer, modals)
│   │   ├── audio/              synth + playback
│   │   └── analytics.dart
│   ├── test/                   ported Vitest suite
│   ├── tool/                   ported balance simulators
│   └── android/  ios/
├── android/                    Bubblewrap TWA — dead after cutover, KEEP the keystore
├── docs/                       stays canonical, gets updated in the same commits
└── CLAUDE.md
```

One repo keeps the docs, the keystore, and the frozen TS reference
implementation next to the port — which matters, because the TS side is the
oracle the Dart side is tested against.

---

## Architecture

### The split

A single `Scaffold` with the stage in the middle:

```
Directionality(rtl) > Scaffold > SafeArea > Column
  ├── HudWidget            Flutter   ← #hud
  ├── Expanded(GameWidget) FLAME     ← #stage
  ├── RebirthBarWidget     Flutter   ← #rebirth
  └── ShopWidget           Flutter   ← #shop
Overlays (Flutter): designer, settings sheet, modals, toasts
Settings button: Flutter, positioned over the stage
```

The existing `#stage` / everything-else boundary in `index.html` is already
exactly the right line. Nothing moves across it.

### State ownership

`CLAUDE.md` records a load-bearing convention: **UI that outlives a rebirth
takes state GETTERS, not the state object**, because `rebirth()` *replaces* the
state and a captured reference reads and mutates the dead run. `startLoop`,
`initShop`, `initSettings` and `initRebirth` all do this.

In Flutter this becomes a single owner:

```dart
class GameController extends ChangeNotifier {
  GameState _state;
  GameState get state => _state;          // widgets read through this, never capture
  void rebirthNow(int at) { _state = rebirth(_state, at); notifyListeners(); }
}
```

- Widgets read `context.watch<GameController>().state` at build time. The
  framework enforces the getter rule for free.
- Flame components hold the **controller**, never the `GameState`.
- The two things that hold rendered output rather than a getter —
  `scene.update()` and `dumpling.setAvatar()` — become explicit
  `notifyListeners()`-driven repaints in their Flame components. Same trap, same
  fix; don't assume the framework handles it.

### The game loop

`src/game/loop.ts` becomes Flame's `update(dt)` on the root `FlameGame`.

**`creditableGapMs(dtMs, visible)` is the entire no-offline-income invariant**
and needs *both* terms. Port it unchanged, in **milliseconds**, so
`tests/loop.test.ts` ports verbatim; convert at the call site (Flame's `dt` is
seconds, a `double`).

```dart
void update(double dt) {
  final credit = creditableGapMs(dt * 1000, _visible);
  if (credit > 0) accrue(controller.state, credit, nowMs());
  ...
}
```

`_visible` comes from a `WidgetsBindingObserver`: `AppLifecycleState.resumed` →
true, everything else → false. **This is the single highest-risk behavioural
difference in the whole port.** Browser `visibilityState` and Flutter's lifecycle
are not the same thing, and OEM Android builds vary in when they stop producing
frames. Do not assume Flame's own dt clamping covers it — verify on real
hardware (see Verification).

The 4 Hz shop repaint and the 10 s autosave keep their existing cadences, driven
off accumulated `dt` exactly as now. The `visibilitychange` → save and `pagehide`
→ save handlers become `AppLifecycleState.paused`/`detached` saves.

The other two loops collapse: `ui/spring.ts`'s private rAF loop folds into the
hero component's `update(dt)`, and `audio/music.ts`'s 500 ms `setInterval`
scheduler disappears entirely (see Phase 5).

---

## Phase 0 — Spikes, before committing

Three unknowns can each invalidate a subsystem. Timebox each; do them first.

**0a. Hebrew compact-long number formatting.** `src/ui/format.ts` and
`src/game/quantize.ts` are coupled by design: `roundToDisplay()` rounds the price
the game **charges** to the price the game **prints**, so a formatter difference
between `Intl.NumberFormat('he', {notation:'compact', compactDisplay:'long'})`
and Dart's `intl` silently breaks price/label agreement — the exact bug (`5.1B`
shown, `5.14235B` charged) that `quantize.ts` was written to kill.

Fix method, not hope: write a throwaway Node script that emits ~500 values →
their JS-formatted strings as a JSON fixture, commit it to
`app/test/fixtures/format_he.json`, and assert Dart's `formatNumber` against it.
If `intl` disagrees, hand-write the formatter — it is only four scale words
(`אלף`/`מיליון`/`מיליארד`/`טריליון`) plus the `1e15` cutover to `1.74e18`.

**0b. Audio synthesis.** Confirm `flutter_soloud` (or equivalent) accepts a raw
PCM buffer generated in Dart and plays it with per-voice pitch/volume, on both
platforms. This gates the whole audio approach.

**0c. SVG rasterization cost.** Rasterize `avatarSVG()` output to a `ui.Image` at
device pixel ratio and measure. The avatar changes only on designer-save and
rebirth, so a cache is trivial — but confirm the one-time cost is not a visible
hitch on a low-end phone, since the designer re-renders 49 part tiles.

---

## Phase 1 — Pure Dart core + tests

This is the cheap, high-value half. `src/game/**` and `src/i18n/` are
framework-free, DOM-free and pure over injectable `rand`/`now` — roughly 1,600
lines that transliterate to Dart nearly mechanically, and 3,637 lines of Vitest
that port with them.

Port, in order:

| TS | Dart | notes |
|---|---|---|
| `game/state.ts` | `game/state.dart` | `SAVE_VERSION` stays **1**. `dumplings`, `prestige` keep their names — live save keys. |
| `game/config/*.ts` | `game/config/*.dart` | pure data: balance, producers, upgrades, parts, findables, scene |
| `game/quantize.ts` | `game/quantize.dart` | must stay idempotent |
| `ui/format.ts` | `render/format.dart` | port **as a pair** with quantize; fixture-tested (0a) |
| `game/economy.ts` | `game/economy.dart` | `CLICK_DPS_SHARE = 0.05`, crit is max-of not product |
| `game/actions.ts` | `game/actions.dart` | the only state mutator |
| `game/rebirth.ts` | `game/rebirth.dart` | multiplier is a SUM, never a product |
| `game/loop.ts` | `game/loop.dart` | `creditableGapMs` only; the rAF body moves to Flame |
| `game/findables.ts` `golden.ts` `rewards.ts` `unlocks.ts` `scene.ts` | ditto | `pickFreeSpot`'s coordinate contract is pinned by tests |
| `game/save.ts` `backup.ts` | ditto | see Phase 6 |
| `i18n/strings.he.ts` | `i18n/strings_he.dart` | keep the U+200E LRM marks **verbatim** |

Rules that must not drift in translation:

- **Hebrew takes the singular at one.** `currencyUnit`, `ב־1 מקומות` etc. all
  need their singular branch. This has shipped broken to production twice.
- **`runEarned` is the rebirth gate**, written in exactly three places:
  `click()`, `accrue()`, `grant()`.
- **A frenzy never pays for time away** — `incomeMultiplier()` in `click()` and
  `accrue()` only, never folded into `dpsOf()`.
- Add a test asserting no file under `lib/game/` imports `package:flutter` — the
  mechanical version of the purity rule the TS side observes by convention.

**Also port `tools/simulate.mjs`, `milestones.mjs`, `release-policy.mjs`** to
`app/tool/*.dart` reading the Dart constants. `CLAUDE.md` treats these as the
source of truth for every balance number ("MEASURED, never reasoned about").
Beyond keeping that workflow alive, running both implementations and diffing the
output is the strongest available end-to-end proof the economy ported correctly:
rebirth 1 ≈ 7m, rebirth 10 ≈ 24m, rebirth 30 ≈ 3.8h at 2 taps/sec.

---

## Phase 2 — Rendering pipeline

**All art is runtime-generated SVG strings** — `ui/avatar.ts` (49 parts
composited from four independently-chosen layers), `ui/icons.ts` (16 icons),
`ui/backdrop.ts` (6 tiled layers), the steamer. There are no image assets and no
spritesheets.

A flat spritesheet is not an option: 16 colours × 11 eyes × 11 mouths × 11
accessories = 21,296 avatar permutations. Layer-based rendering is mandatory.

**Keep the SVG generators as the single source of truth**, ported to Dart string
templates. This preserves the workflow `CLAUDE.md` insists on — *a designer part
= one entry in `config/parts.dart` + one case in `render/avatar.dart`* — and
`tests/avatar.test.ts` (which fails loudly if you do one and not the other) ports
with it.

Render them two ways depending on where they appear:

- **Flutter widget side** (designer tiles, shop producer icons, modals):
  `SvgPicture.string(...)` directly. The generator output is used as-is.
- **Flame side** (hero, findables, producer crowd, backdrop): rasterize the same
  string once to a cached `ui.Image` keyed by
  `(design, logicalSize, devicePixelRatio)`, drawn by a `SpriteComponent`.
  Invalidate on designer-save, rebirth, and resize — all rare.

`ui/palette.ts` becomes `render/palette.dart`, and **the one place a colour is
written twice disappears**: there is no `tokens.css` mirror any more, because
there is no CSS. `tests/palette.test.ts`'s two-way check collapses to a single
source; `tests/no-raw-colour.test.ts` ports as a Dart source scan. Net
simplification — record it in `DECISIONS.md`.

**Backdrop.** `ui/backdrop.ts` relies on `background-repeat` with a fixed-pixel
tile and matched slope-and-height continuity at the seam (documented at length;
`tests/backdrop.test.ts` pins the bounds). Port each layer to one rasterized tile
`ui.Image` drawn by a repeating-tile Flame component (or `ParallaxComponent`).
Two rules survive unchanged and one dies:

- **The tile is a FIXED PIXEL SIZE, never a fraction of the viewport.**
  Widescreens get *more tiles*, not stretched ones.
- **Everything drawn stays inside `[0, VB_W)`**, and ridge tangents must match
  across the join.
- *Dies:* "an SVG used as a background-image is a static rendering context." In
  Flame the tile is just an image, so that trap is gone — but keep the sparkle
  cross-fade as *component* opacity anyway, so the tile cache stays a single
  entry per layer.

---

## Phase 3 — The Flame stage

Everything inside `#stage` today. ~35 `@keyframes` become components and
effects:

| effect | today | Flame |
|---|---|---|
| squash & stretch on tap | damped spring in rAF → composited CSS transform | `ui/spring.ts` ports verbatim (pure math), driven from `HeroComponent.update(dt)`; two-stage jelly-then-foam preserved |
| idle breathe / blink / glance | rAF + `display` flip on a pre-rendered closed-eye group | same timers in `update(dt)`; swap the cached eye image |
| floating "+N" | pool of 14 divs + `void el.offsetWidth` reflow hack | `TextComponent` pool with a move+fade effect. **The reflow hack disappears.** |
| producer crowd | ≤20 sprites, hashed positions, CSS `scene-bob` | `game/scene.ts`'s pure position hash ports unchanged; components bob in `update(dt)` |
| catch burst | 12-particle pool of 48, `--dx/--dy/--rot/--s` custom props | `burstSpec()` ports and feeds Flame's `ParticleSystemComponent`. **CSS-custom-property parameterization disappears.** |
| gold wash | full-stage CSS overlay pulse | a full-stage `RectangleComponent` with an opacity effect. Not `multiply` blend — on a light ground it reads as a shadow. |
| steam | 3 blurred divs, CSS keyframes | three sprite components |
| findable bob/pop, frenzy pulse | CSS keyframes | effects |

**Findable placement.** `ui/findables.ts` calls `getBoundingClientRect()` on the
stage *and* on the hero's SVG each spawn, then feeds physical rectangles into the
pure `pickFreeSpot()`. In Flame these are component sizes and positions —
mechanically simpler, and the RTL hack (`insetInlineStart = 'auto'` then position
with physical `left`) becomes unnecessary since Flame's coordinate space is
already physical. Preserve `pickFreeSpot`'s contract; its tests pin it.

**Hero sizing.** `CLAUDE.md` documents a hard-won CSS rule — the hero's *height*
drives its size and `height: min(88vw, 360px, 100%)` is what stops the steamer
sliding under the shop panel on short windows. In Flame this becomes an
`onGameResize` that sizes the hero from the *available stage height*, and
`.squish-wrap`'s box is not the dumpling — derive geometry from viewBox
fractions, not from the container.

**Respect reduced motion** throughout: `MediaQuery.disableAnimations` replaces
`prefers-reduced-motion`. Every effect honours it today.

---

## Phase 4 — Flutter app UI

There is **no router, no tabs, no navigation** — one screen plus overlays
appended to `<body>`. Keep it that way.

| surface | Flutter |
|---|---|
| HUD (count, dps, click value, frenzy badge) | `HudWidget`, rebuilt from the controller |
| Shop (producer rows + **exactly one** upgrade chip + one teaser) | `ShopWidget`, `ListView`; `MAX_UPGRADE_CHIPS = 1` is a design decision, not a layout constant |
| Rebirth bar | `RebirthBarWidget` |
| Squishy Designer (full-screen; live preview + 4 option groups; locked tiles show 🔒 + rank) | full-screen route or overlay; tiles use `SvgPicture.string` |
| Settings sheet | `showModalBottomSheet` |
| Rebirth confirm / celebration, boss celebration, backup code, restore, reset confirm | one `showAppModal()` helper mirroring `ui/modal.ts` |
| Toasts (1.8 s) | `SnackBar` or a custom overlay |
| `privacy.html` / `about.html` | bundled as assets + rendered in-app, **and** kept on the web (Play requires a reachable privacy URL) |

**Port `ui/modal.ts`'s ordering quirk deliberately or fix it deliberately** —
today buttons close the modal *before* `onClick` runs, which is why the restore
textarea mirrors its value into a local on every `input` event, and why a failed
clipboard copy has to reopen the backup modal. Flutter's `Navigator.pop(result)`
makes the clean version trivial; take it, and delete the mirroring workaround
rather than transliterating it.

**RTL.** `MaterialApp(locale: Locale('he'), supportedLocales: [Locale('he')])`
wrapped in `Directionality(TextDirection.rtl)`. The bidi hazard is identical to
the web's: `'‎+$amount‎ לשנייה'` needs its LRM marks or the `+` reorders. Keep
them.

**Do not port (dead on arrival):** `ui/update.ts` and
`STR.updateReady`/`updateLoading`, the service worker and `virtual:pwa-register`,
`vite-plugin-pwa`, `src/main.ts`'s origin dispatcher and "we moved" screen,
`tokens.css`, `public/.well-known/assetlinks.json`, `.github/workflows/deploy.yml`,
and the iOS "add to home screen" hint modal. Play's own update mechanism
replaces the update toast.

Native replacements for web APIs: `navigator.vibrate` → `HapticFeedback`,
`navigator.share` → `share_plus`, `navigator.clipboard` → `Clipboard`,
`env(safe-area-inset-*)` → `SafeArea`, `100dvh` → normal layout.
`:root { color-scheme: light }` — the guard against Chrome for Android's
auto-dark-theme force-inverting the game — becomes a locked `ThemeMode.light`,
and the trap it was defending against **disappears entirely** in a native app.

---

## Phase 5 — Audio

741 lines of Web Audio synthesis with zero audio files: `sound.ts` (360),
`notes.ts` (176), `music.ts` (205). Master bus → separate SFX and music buses
with independent mute, 6-voice cap, procedural noise buffer.

Approach, following the decision to keep the feel:

1. **`notes.ts` ports verbatim** — it is pure note/chord/groove generation,
   already covered by `tests/notes.test.ts`.
2. **Write a small software synth in Dart**: oscillators (sine/saw/noise), ADSR,
   a biquad filter, rendering to a `Float32List` → 16-bit PCM. This replaces the
   WebAudio *graph*, which has no Dart equivalent; the parameters `sound.ts`
   already uses map onto it directly.
3. **SFX: pre-synthesize a bank at boot.** `playSquish`'s combo pitch ladder is
   16 steps over a 900 ms window and `playCatch` has its own catch-streak ladder
   — so render each step to its own buffer once (a few dozen short buffers)
   rather than synthesizing per tap. Zero per-tap cost, ladder preserved exactly.
4. **Music: render the loop offline instead of scheduling it.** The 128 BPM
   four-on-the-floor loop (kick, offbeat hats, snare, saw bass, detuned arpeggio
   lead over a 4-chord progression) is currently scheduled 1.5 s ahead on a
   500 ms `setInterval`. Render the full progression **twice** at boot in an
   isolate — once at `intensity 0`, once at `intensity 1` (lead filter open, mix
   lifted) — and make `setMusicIntensity()` a crossfade between two looping
   voices. The scheduler disappears entirely.

   *This is the one deliberate deviation from the web implementation.* It
   preserves both the frenzy layer and the exact note content while removing a
   real-time scheduler that Dart is a bad fit for. Record it in `DECISIONS.md`
   with the rejected option (a Dart-side ahead-of-time scheduler).
5. `ensureAudio()` on first gesture is still needed on iOS. Keep it.

---

## Phase 6 — Persistence, the DC1 bridge, and analytics

### Save format

Port `save.ts` and `backup.ts` to Dart with **byte-identical semantics**:

- `SAVE_VERSION` stays **1**; the `migrations` map stays **empty**. `CLAUDE.md`:
  bumping it without registering `migrations[next]` makes `deserialize()` return
  null for every save and starts every player from zero. `heal()` defaults every
  missing field, so this port needs no version bump.
- `heal()` ports field-for-field, including the reject-non-finite and
  reject-zero-count rules.
- Storage: `shared_preferences`, key `'dumpling-save'`, same JSON, plus
  `'dumpling-save-backup'` for the corrupt-blob stash (don't destroy evidence).
- **Cross-runtime JSON check:** Dart's `jsonEncode` writes `1.0` where JS writes
  `1`. `heal()` accepts either, but prove it — round-trip real JS-produced save
  strings through the Dart `deserialize()` in a test fixture.
- **Base64:** JS `btoa` on latin1 bytes ≡ `base64Encode(utf8.encode(json))`.
  Dart's `base64Decode` is stricter about padding than `atob`, so `importCode`
  must re-pad after stripping whitespace (messaging apps insert line breaks —
  that's why the whitespace strip exists). Fixture-test against codes exported by
  the live web build.

### The bridge

Existing Play users' saves live in Chrome's `localStorage` under the TWA's origin
and are unreachable from a Flutter app. The `DC1:` code is the only path across.

1. **One final TS release** that shows a modal on launch — "the app is moving to
   Google Play, copy your code" — with copy-to-clipboard and a Play link. Gate it
   on `state.designed` so a brand-new player never sees it. This must ship
   *before* the Flutter AAB, with enough lead time for players to see it.
2. **Flutter first run:** if there is no local save, the designer screen offers
   "יש לי קוד" → paste → `importCode()` → same `deserialize()` gate. Not a
   blocking wall; a new player just designs their squishy.
3. Keep the settings-sheet export/restore in the Flutter app — it remains the
   only rescue path, and now it is also the iOS-install path.

### Analytics — this is a legal boundary, not a style preference

Players are children, so COPPA, Israel's PPL Amendment 13 and Play Families all
apply. The game avoids a consent banner, a retention policy and a written
security programme **only** while four things hold: no cookie or device write for
measurement, **no identifier transmitted** (not even a self-hashed one), no
per-player profile, aggregate counts only.

`@vercel/analytics` has no Dart SDK.

- **Rejected: Firebase Analytics.** It collects an app-instance ID, which
  violates condition 2 outright.
- **Recommended:** POST the same sanitized payload from Dart (`package:http`) to
  a thin Vercel endpoint. `sanitize()` ports verbatim — the allowlist stays at
  **ten event names and four property keys**, dropping the whole event on any
  violation, not just the offending key. The bucket ladders
  (`BUCKET_INSTALL_AGE_DAYS`, `BUCKET_ACTIVE_MINUTES`, `RANK_MILESTONES`) stay
  **frozen**: no raw data is kept anywhere, so a moved boundary severs the series
  rather than re-basing it. Retention still derives from `savedAt` and
  `stats.createdAt` in the save itself, so nothing extra is written to the
  device.
- **One unavoidable discontinuity.** The `mode` property comes from
  `matchMedia('(display-mode: standalone)')`, which has no Flutter equivalent.
  Pin it to `'app'` — do **not** drop the property, since the event shape is a
  published promise. Every retention series breaks comparability at the cutover
  date; record that date in `DECISIONS.md` so nobody later reads the step as a
  behaviour change.
- **`public/privacy.html` enumerates this exact event surface in Hebrew and
  English.** Update it in the same commit, ship it as a bundled app asset *and*
  keep it reachable on the web, and **re-check the Play Data-safety form**
  against it (`docs/GOOGLE-PLAY.md` Phase D). A wrong answer there is a takedown
  risk, not a paperwork slip.

No ads and no IAP in this migration — the game ships to Play under the Families
policy with neither, exactly as today. If ads follow later, note the standing
rule: **an ad reward must not use `grant()`**, because `grant()` advances the
rebirth gate.

---

## Phase 7 — Play cutover and web retirement

**The Android identity must not change.** The Flutter build takes:

- `applicationId` = **`com.dumplingclicker.twa`** — keep the ugly `.twa` suffix.
  It is invisible to players and irreversible; a new package means a new listing
  and orphans every installed user.
- signing key = **`android/upload-keystore.jks`**, the existing one. Without it
  the listing cannot be updated in place.
- `versionCode` > 1 (currently 1 / 1.0.0), portrait-locked,
  `supportsRtl="true"`, minSdk 21+.
- The maskable icon is `icon-512-maskable.png`, a **separate asset** (art at 74%
  in a full-bleed field). Never point the adaptive icon at `icon-512.png` — the
  circular crop clips its rounded corners.

Ship to internal testing first and verify the DC1 restore path against a real
code exported from the live web build before any production rollout.

**Web retirement:** replace `dumplingclicker.com` with a static landing page
carrying a Play badge and the `og:`/`twitter:` tags (link scrapers need absolute
URLs — that hardcoded origin in `index.html` is the one place allowed to have
one). Keep `/privacy.html` and `/about.html` live at their current paths. The
retired GitHub Pages "we moved" screen can point at the same landing page.
`assetlinks.json` can be dropped once the TWA is gone, not before.

---

## Verification

**1. Economy correctness — the strongest check available.** Port the Vitest
suites for `game/**`, `format`, `quantize`, `notes`, `palette`, `backdrop`,
`avatar`, `rebirth`, `economy`, `findables`, `loop`. Then run both simulators and
diff:

```bash
node tools/simulate.mjs 2 3000 1.5 1
```

```bash
cd app && dart run tool/simulate.dart 2 3000 1.5 1
```

They read the same constants through two implementations; identical output is a
strong end-to-end proof of the port. Expect rebirth 1 ≈ 7m, 10 ≈ 24m, 30 ≈ 3.8h
at 2 taps/sec.

**2. Formatting parity.** `flutter test` against the committed
`format_he.json` fixture (Phase 0a). Failing here means charged prices and
printed prices have diverged — the exact bug `quantize.ts` exists to prevent.

**3. Save parity.** Round-trip real JS-produced saves and real `DC1:` codes
(exported from the live site) through the Dart `deserialize()` / `importCode()`
in tests. Include a truncated code and a code with injected line breaks.

**4. The no-offline-income invariant — on real hardware, not in a simulator.**
This is the rule most likely to break silently in the platform change. Verify on
a physical Android device *and* an iPhone: bank a visible rate, background the
app for 60 s (home button, app switcher, screen lock, and a phone call if you
can), return, and confirm the balance is unchanged. Repeat with the app merely
obscured (split-screen, notification shade). Then re-verify after any Flutter or
Flame upgrade.

**5. Visual parity.** Golden tests for the avatar at thumbnail size (check every
new part on the palest body, `snow` — a pale part on a pale body against a pale
sky is the failure case) and for the backdrop tile bounds. Contact-sheet the 16
producer/findable icons at 30 px and *look at them*; two icons read fine in code
and failed at that size.

**6. Audio A/B.** Play the web build and the Flutter build side by side. Check
specifically: the squish combo ladder rising over ~16 rapid taps, the catch-streak
ladder, the golden chime staying distinct from the ordinary catch, and the music
opening up for the 30 s a frenzy runs.

**7. RTL and bidi.** Every screen in Hebrew. Confirm `+7 לשנייה` keeps its `+` on
the left, that `1 שקל` is singular and `2 שקלים` plural, and that the restore
textarea stays `ltr` inside an rtl app.

**8. Play track.** Internal testing → confirm the update installs *over* an
existing TWA install (same package, same key) without wiping, and that the DC1
restore screen works for a real player's real code.

---

## Documentation — Dor's standing rule

Every change updates the doc that covers it, **in the same commit**. This
migration touches nearly all of them:

- `CLAUDE.md` — the traps that survive (getter-not-reference,
  `heal()`-not-migrations, `runEarned`'s three writers, Hebrew singular,
  fixed-pixel backdrop tile) and the ones that **die** with the web (reflow
  hacks, CSS-animation-outranks-inline-style, `tokens.css` mirror,
  service-worker prompt mode, `VITE_BASE`, auto-dark-theme). Add the new one:
  Flutter lifecycle ≠ browser visibility.
- `docs/DECISIONS.md` — every choice here with its rejected alternative:
  offline-rendered music vs. a Dart scheduler; SVG-generators-kept vs. pre-baked
  atlases; DC1 bridge vs. accepting a wipe; a Vercel endpoint vs. Firebase
  Analytics.
- `docs/PROGRESS.md` — phase status.
- `docs/GOOGLE-PLAY.md` — rewritten: the Bubblewrap runbook is replaced by a
  Flutter build/sign/upload runbook, same package and same keystore.
- `docs/DOMAIN-AND-ADS.md` — the web retirement, and that AdMob is now the
  available path.
- `README.md` — new commands, new entry point.

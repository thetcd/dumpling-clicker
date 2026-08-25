// Boot: load save → build UI → first-launch designer → start the loop →
// register the service worker (via vite-plugin-pwa).
//
// There is deliberately NO offline-progress step. Dor, 2026-08-21: "if the game
// is in the background, you dont passively get stuff — the window must be
// open." Production comes from live frames only (game/loop.ts), taps, and
// catching findables, which never paid offline either.
import { click, grant, rebirth, resetGame, startFrenzy } from './game/actions';
import { clickValue, dpsOf, incomeMultiplier } from './game/economy';
import { startLoop } from './game/loop';
import { frenzyRemainingMs } from './game/golden';
import { FRENZY_MULTIPLIER } from './game/config/balance';
import { clearStorage, loadFromStorage, saveToStorage } from './game/save';
import { createInitialState, type GameState } from './game/state';
import { STR } from './i18n/strings.he';
import {
  EVENTS,
  createSessionTimer,
  initAnalytics,
  installAgeBucket,
  isFirstOpenToday,
  launchMode,
  rankMilestone,
  track,
} from './analytics';
import {
  playFanfare,
  playAppear,
  playCatch,
  playGolden,
  playPop,
  playRebirth,
  playPurchase,
  playSquish,
  setMuted,
  setMusicEnabled,
  unlockAudio,
} from './audio/sound';
import { setMusicIntensity, startMusic } from './audio/music';
import { PRODUCERS } from './game/config/producers';
import { avatarSVG } from './ui/avatar';
import { initBackdrop } from './ui/backdrop';
import { openDesigner } from './ui/designer';
import { initDumpling } from './ui/dumpling';
import { initGestures } from './ui/gestures';
import { initFindables } from './ui/findables';
import { initScene } from './ui/scene';
import { initRebirth } from './ui/rebirth';
import { canRebirth, rebirthKeepSummary, rebirthMultiplier } from './game/rebirth';
import { partsUnlockedAt } from './game/unlocks';
import { upgradesPermanentAt } from './game/rebirth';
import { rewardFor } from './game/rewards';
import { formatNumber } from './ui/format';
import { initHud } from './ui/hud';
import { showModal } from './ui/modal';
import { initPopups, spawnFloater } from './ui/popups';
import { initSettings, shareGame, toast } from './ui/settings';
import { initShop } from './ui/shop';
import { showUpdateToast } from './ui/update';
import { registerSW } from 'virtual:pwa-register';

// Service-worker registration, in 'prompt' mode (vite.config.ts). Importing
// the virtual module here — instead of the plugin's auto-injected script in
// index.html — also keeps the retired Pages "we moved" screen from registering
// anything: main.ts only imports this file on the real origin.
const updateSW = registerSW({
  onNeedRefresh: () => showUpdateToast(() => void updateSW(true)),
});

const now = Date.now();
const saved = loadFromStorage();
let state: GameState = saved ?? createInitialState(now);
setMuted(!state.settings.sound);

// Aggregate, cookieless measurement. It lives HERE and not in main.ts: the
// retired Pages build renders the "we moved" screen and must stay silent.
// Read src/analytics.ts before adding anything to it — what it may collect is
// a legal boundary, not a style preference.
initAnalytics();
const mode = launchMode();
track(EVENTS.launch, { mode });
if (!saved) track(EVENTS.firstLaunch);
// RETENTION. Once per calendar day, carrying the install's age bucket — that
// pair is the whole D1/D7/D30 measurement. Both inputs are gameplay state the
// save already holds, so nothing extra is written to the device.
//
// `mode` is the second property rather than anything richer, and deliberately:
// iOS Safari evicts localStorage after ~7 days of not visiting, so on the web
// the save itself dies before a returning player does and long-horizon
// retention is structurally undercounted. Splitting installed-app from
// browser-tab is the only way to read the numbers honestly.
if (saved && isFirstOpenToday(saved.savedAt, now)) {
  track(EVENTS.dailyOpen, { age: installAgeBucket(saved.stats.createdAt, now), mode });
}

// SESSION LENGTH, in active minutes.
const session = createSessionTimer();
const endSession = () => session.end((active) => track(EVENTS.sessionEnd, { active, mode }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    session.pause();
    endSession();
  } else {
    session.resume();
  }
});
window.addEventListener('pagehide', endSession);

// Browsers refuse to start audio outside a user gesture, so the context and the
// music loop both come up on the player's first tap — whatever that tap was.
function ensureAudio(): void {
  unlockAudio();
  if (state.settings.music) {
    setMusicEnabled(true);
    startMusic();
  }
}

// --- UI ---
// Behind everything, including the producer crowd in scene.ts. Mounted on
// <body> rather than #app so it is never affected by the app's flex layout.
initBackdrop(document.body);
// Before any overlay can exist. Every one of them is `position: fixed`, which
// is what makes an accidental pinch-zoom leave an invisible, untappable modal
// covering the game — see ui/gestures.ts.
initGestures();
initPopups();
const hud = initHud(document.getElementById('hud')!);
const dumpling = initDumpling(document.getElementById('stage')!, (x, y) => {
  // time-to-core-gameplay: the earliest drop-off point there is. Read off the
  // lifetime click count BEFORE click() increments it, so it fires exactly once.
  if (state.stats.totalClicks === 0) track(EVENTS.firstSquish);
  ensureAudio();
  playSquish();
  navigator.vibrate?.(8); // subtle haptic tick (Android; iOS ignores it)
  const { earned, crit } = click(state, Date.now());
  // a crit has to LOOK like one, or a 5% roll is invisible and the whole tier
  // is wasted code: bigger gold floater, the jackpot run, a longer buzz
  spawnFloater(x, y, crit ? STR.critFloater(formatNumber(earned)) : `+${formatNumber(earned)}`, crit);
  if (crit) {
    playPurchase(6, true);
    navigator.vibrate?.([14, 30, 14]);
  }
});
dumpling.setAvatar(avatarSVG(state.avatar, 'squishy-svg'));

// --- living background: the team you own, always working ---
const scene = initScene(document.getElementById('stage')!);
scene.update(state.producers);

// --- findables: a common lane every 10-25s, a rare lane every 3-8min ---
const findables = initFindables(
  document.getElementById('stage')!,
  () => state.avatar,
  (kind, x, y, icon) => {
    const at = Date.now();
    ensureAudio();
    // The golden squishy gets its own sparkle. Coin and airdrop stay on
    // playCatch(), which owns the catch-streak pitch ladder — routing the
    // golden through it would advance that streak on a different kind of event.
    if (kind === 'golden') playGolden();
    else playCatch();
    navigator.vibrate?.([12, 40, 12]);
    // every catch throws what you caught across the background
    scene.burst(icon, x, y);
    if (kind === 'golden') {
      startFrenzy(state, at);
      scene.goldWash();
      spawnFloater(x, y, STR.frenzyStart(FRENZY_MULTIPLIER));
    } else {
      // raw dps on purpose: a frenzy must not multiply a findable payout
      const amount = rewardFor(kind, dpsOf(state), clickValue(state));
      grant(state, amount); // counts toward the rebirth gate — catches are active play
      spawnFloater(x, y, STR.rewardCaught(formatNumber(amount)));
    }
    saveToStorage(state, at);
  },
  // a spawn has no user gesture behind it, so this is silent until the first
  // tap unlocks the audio context — which is fine, that tap always comes first
  // Only the golden dumpling gets the bright "something rare arrived" chime.
  // Airdrops now land every 30s, and that chime three times a minute stops
  // being an event and starts being a nag.
  (kind) => playAppear(kind === 'golden'),
);

const rebirthBar = initRebirth(
  document.getElementById('app')!,
  () => state,
  () => {
    const at = Date.now();
    if (!canRebirth(state)) return;
    // State what the reset keeps, before it happens. Dor could not tell what
    // survived a rebirth, and the numbers come straight from the function the
    // reset itself uses, so the promise cannot outrun the outcome.
    const kept = rebirthKeepSummary(state);
    const keepLines = [
      kept.tiers > 0 ? STR.rebirthKeepProducers(kept.units, kept.tiers) : '',
      kept.upgrades > 0 ? STR.rebirthKeepUpgrades(kept.upgrades) : '',
    ].filter(Boolean);
    showModal({
      title: STR.rebirthConfirmTitle,
      bodyHTML: `<p>${STR.rebirthConfirmBody}</p>
        <p class="keep-list"><strong>${STR.rebirthKeepTitle}</strong><br>${
          keepLines.length ? keepLines.join('<br>') : STR.rebirthKeepNothing
        }</p>`,
      buttons: [
        {
          label: STR.rebirthYes,
          primary: true,
          onClick: () => {
            // captured BEFORE the reset: the fresh state has already dropped
            // every upgrade that did not survive, so the celebration cannot
            // tell what just became permanent from it
            const ownedBefore = [...state.upgrades];
            state = rebirth(state, at);
            ensureAudio();
            playRebirth();
            navigator.vibrate?.([18, 60, 18, 60, 26]);
            saveToStorage(state, at);
            // Aggregate only: the first rebirth as a funnel step, then a
            // coarse rank histogram. rankMilestone() drops every rank that is
            // not a bucket, so an exact deep rank never leaves the device.
            if (state.prestige === 1) track(EVENTS.firstRebirth);
            const milestone = rankMilestone(state.prestige);
            if (milestone !== null) track(EVENTS.rank, { rank: milestone });
            // the shop and settings read through getters, so they follow the
            // replaced state automatically; the scene and dumpling hold their
            // own render output and have to be repainted
            scene.update(state.producers);
            dumpling.setAvatar(avatarSVG(state.avatar, 'squishy-svg'));
            rebirthBar.update();
            paintHud();
            // The biggest moment in the game used to get a 1.8s toast while a
            // producer purchase got a full modal. 28 of 49 designer parts are
            // prestige-gated, so new parts ARE the payoff for rebirthing —
            // nothing told the player it had happened.
            const opened = partsUnlockedAt(state.prestige);
            // upgrades that just became permanent — read from the run that
            // ENDED, since the fresh state has already dropped the rest
            const nowPermanent = upgradesPermanentAt(ownedBefore, state.prestige);
            showModal({
              title: STR.rebirthCelebrateTitle(state.prestige),
              celebration: true,
              // toFixed(2), matching the rebirth bar: formatNumber rounds the
              // x1.10 bonus to a flat "1", which reads as "no bonus".
              bodyHTML: `<p>${STR.rebirthCelebrateBody(
                rebirthMultiplier(state.prestige).toFixed(2),
              )}</p>
                <p>${opened.length ? STR.rebirthNewParts(opened.length) : STR.rebirthNoParts}</p>
                ${nowPermanent.length ? `<p>${STR.rebirthNewPermanent(nowPermanent.length)}</p>` : ''}`,
              buttons: [
                ...(opened.length
                  ? [{ label: STR.rebirthDesignNow, primary: true, onClick: editSquishy }]
                  : []),
                { label: STR.bossShare, onClick: () => void shareGame(state) },
                { label: STR.close, primary: !opened.length },
              ],
            });
          },
        },
        { label: STR.cancel },
      ],
    });
  },
);

const shop = initShop(document.getElementById('shop')!, () => state, (kind, id) => {
  // Escalating payoff: a tier you have never owned before is a "jackpot" —
  // longer run, low thump, ringing tail. Restocking one you already have gets
  // the same run without the celebration, so the first of each still lands.
  ensureAudio();
  if (kind === 'producer') {
    // the first real core-loop decision — "aha, things earn on their own"
    const ownedTotal = Object.values(state.producers).reduce((a, b) => a + b, 0);
    if (ownedTotal === 1) track(EVENTS.firstBuy);
    const tierIndex = PRODUCERS.findIndex((p) => p.id === id);
    const first = (state.producers[id] ?? 0) <= 1;
    playPurchase(tierIndex, first);
    // Nine of the ten tiers used to pass in silence — only the boss got a
    // modal. A toast, never showModal(): modals are one-at-a-time, so one here
    // would clobber the boss celebration and interrupt the purchase-mash loop.
    if (first && id !== 'boss') {
      playPop();
      toast(STR.firstOfTier(PRODUCERS[tierIndex].nameHe));
    }
  } else {
    // upgrades are rare and permanent — always the full jackpot treatment
    playPurchase(6, true);
  }
  if (kind === 'producer' && id === 'boss' && state.producers.boss === 1) {
    track(EVENTS.boss);
    playFanfare();
    showModal({
      title: STR.bossTitle,
      bodyHTML: `<p>${STR.bossBody}</p>`,
      celebration: true,
      buttons: [
        { label: STR.bossShare, primary: true, onClick: () => void shareGame(state) },
        { label: STR.close },
      ],
    });
  }
  scene.update(state.producers);
  saveToStorage(state, Date.now());
  maybeShowInstallHint();
});

// One designer entry point for every caller (settings sheet, rebirth
// celebration). Forgetting findables.setAvatar here leaves an on-screen golden
// dumpling wearing the old look.
function editSquishy(): void {
  openDesigner(state, (design) => {
    state.avatar = design;
    dumpling.setAvatar(avatarSVG(design, 'squishy-svg'));
    findables.setAvatar(design);
    saveToStorage(state, Date.now());
  });
}

initSettings(document.getElementById('settings-btn')!, () => state, {
  onEditSquishy: editSquishy,
  onReset: () => {
    state = resetGame(state, Date.now());
    clearStorage();
    saveToStorage(state, Date.now());
    location.reload();
  },
  // Restoring a backup code replaces the whole run. Reassign `state` BEFORE the
  // reload — the loop's pagehide autosave reads through the getter, so leaving
  // the old object in place would let it clobber the save we just wrote (the
  // exact bug that once made "start over" a silent no-op).
  onRestore: (imported) => {
    state = imported;
    saveToStorage(state, Date.now());
    location.reload();
  },
});

// --- first launch: design your squishy ---
if (!state.designed) {
  openDesigner(state, (design) => {
    state.avatar = design;
    state.designed = true;
    dumpling.setAvatar(avatarSVG(design, 'squishy-svg'));
    saveToStorage(state, Date.now());
    // The designer is the first screen anyone sees and therefore the first
    // place they can leave. Fired only here, never from editSquishy() — this
    // counts players who got past the door, not designer visits. No part of
    // the design is sent; the event carries nothing at all.
    track(EVENTS.designed);
  });
}

// --- iOS "add to home screen" hint (no beforeinstallprompt on iOS) ---
function maybeShowInstallHint(): void {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  const producersOwned = Object.values(state.producers).reduce((a, b) => a + b, 0);
  if (!isIos || standalone || producersOwned < 3) return;
  try {
    if (localStorage.getItem('install-hint-shown')) return;
    localStorage.setItem('install-hint-shown', '1');
  } catch {
    return;
  }
  showModal({
    title: STR.title,
    bodyHTML: `<p>${STR.iosInstallHint}</p>`,
    buttons: [{ label: STR.gotIt, primary: true }],
  });
}

const paintHud = () => {
  const at = Date.now();
  const mult = incomeMultiplier(state, at);
  // adaptive layer: the loop lights up for the 30s a frenzy runs
  setMusicIntensity(mult > 1 ? 1 : 0);
  hud.update(
    state.dumplings,
    dpsOf(state) * mult,
    clickValue(state) * mult,
    frenzyRemainingMs(state.frenzyUntil, at),
    FRENZY_MULTIPLIER,
  );
};
// Paint once before the first frame: the HUD ships with a hardcoded "0", and a
// returning player with millions banked would otherwise read "0 שקלים" until
// rAF fires — which on a backgrounded PWA resume can be a visible beat.
paintHud();

startLoop(() => state, {
  updateHud: paintHud,
  updateShop: () => {
    shop.update();
    rebirthBar.update();
  },
  tickGolden: (at) => findables.tick(at),
});

// dev handles: force any findable to appear right now
if (import.meta.env.DEV) {
  // dev-only backdoor: shipping this would let anyone farm rewards from the
  // console. Vite strips the branch from the production bundle.
  const w = window as unknown as Record<string, unknown>;
  w.__spawnGolden = () => findables.spawnNow(Date.now(), 'golden');
  w.__spawnAirdrop = () => findables.spawnNow(Date.now(), 'airdrop');
  w.__spawnCommon = () => findables.spawnNow(Date.now(), 'common');
}

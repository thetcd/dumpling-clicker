// Boot: load save → offline progress → build UI → first-launch designer →
// start the loop → register the service worker (via vite-plugin-pwa).
import { click, resetGame, startFrenzy } from './game/actions';
import { clickValue, dpsOf, incomeMultiplier, offlineEarnings } from './game/economy';
import { startLoop } from './game/loop';
import { frenzyRemainingMs } from './game/golden';
import {
  FRENZY_MULTIPLIER,
  WELCOME_BACK_MIN_AWAY_MS,
  WELCOME_BACK_MIN_SECONDS,
} from './game/config/balance';
import { clearStorage, loadFromStorage, saveToStorage } from './game/save';
import { createInitialState, type GameState } from './game/state';
import { STR } from './i18n/strings.he';
import {
  playFanfare,
  playGolden,
  playPurchase,
  playSquish,
  setMuted,
  setMusicEnabled,
  unlockAudio,
} from './audio/sound';
import { setMusicIntensity, startMusic } from './audio/music';
import { PRODUCERS } from './game/config/producers';
import { avatarSVG } from './ui/avatar';
import { openDesigner } from './ui/designer';
import { initDumpling } from './ui/dumpling';
import { initFindables } from './ui/findables';
import { initScene } from './ui/scene';
import { rewardFor } from './game/rewards';
import { formatNumber } from './ui/format';
import { initHud } from './ui/hud';
import { showModal } from './ui/modal';
import { initPopups, spawnFloater } from './ui/popups';
import { initSettings, shareGame } from './ui/settings';
import { initShop } from './ui/shop';

const now = Date.now();
let state: GameState = loadFromStorage() ?? createInitialState(now);
setMuted(!state.settings.sound);

// --- offline progress (before anything renders) ---
const awayMs = Math.max(0, now - state.savedAt);
const away = offlineEarnings(dpsOf(state), state.savedAt, now);
if (away > 0) {
  state.dumplings += away;
  state.totalEarned += away;
}
// Credit small amounts silently. Gating the modal on "earned >= 1 dumpling"
// meant a 1-second refresh at 400 dps threw a full-screen celebration for 0.01%
// of the player's balance — and a PWA resuming from background does exactly
// that. Only interrupt for a real absence AND a sum worth naming.
const worthAnnouncing =
  awayMs >= WELCOME_BACK_MIN_AWAY_MS &&
  away >= Math.max(1, dpsOf(state) * WELCOME_BACK_MIN_SECONDS);

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
initPopups();
const hud = initHud(document.getElementById('hud')!);
const dumpling = initDumpling(document.getElementById('stage')!, (x, y) => {
  ensureAudio();
  playSquish();
  navigator.vibrate?.(8); // subtle haptic tick (Android; iOS ignores it)
  const earned = click(state, Date.now());
  spawnFloater(x, y, `+${formatNumber(earned)}`);
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
    playGolden();
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
      state.dumplings += amount;
      state.totalEarned += amount;
      spawnFloater(x, y, STR.rewardCaught(formatNumber(amount)));
    }
    saveToStorage(state, at);
  },
);

const shop = initShop(document.getElementById('shop')!, state, (kind, id) => {
  // Escalating payoff: a tier you have never owned before is a "jackpot" —
  // longer run, low thump, ringing tail. Restocking one you already have gets
  // the same run without the celebration, so the first of each still lands.
  ensureAudio();
  if (kind === 'producer') {
    const tierIndex = PRODUCERS.findIndex((p) => p.id === id);
    playPurchase(tierIndex, (state.producers[id] ?? 0) <= 1);
  } else {
    // upgrades are rare and permanent — always the full jackpot treatment
    playPurchase(6, true);
  }
  if (kind === 'producer' && id === 'boss' && state.producers.boss === 1) {
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

initSettings(document.getElementById('settings-btn')!, state, {
  onEditSquishy: () =>
    openDesigner(state, (design) => {
      state.avatar = design;
      dumpling.setAvatar(avatarSVG(design, 'squishy-svg'));
      findables.setAvatar(design); // keep an on-screen golden one in sync
      saveToStorage(state, Date.now());
    }),
  onReset: () => {
    state = resetGame(state, Date.now());
    clearStorage();
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
  });
} else if (worthAnnouncing) {
  showModal({
    title: STR.welcomeBackTitle,
    bodyHTML: `<p>${STR.welcomeBackBody}</p>
      <p class="welcome-amount">🥟 ${formatNumber(away)}</p>`,
    buttons: [{ label: STR.collect, primary: true }],
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
// returning player with millions banked would otherwise read "0 כופתאות" until
// rAF fires — which on a backgrounded PWA resume can be a visible beat.
paintHud();

startLoop(() => state, {
  updateHud: paintHud,
  updateShop: () => shop.update(),
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

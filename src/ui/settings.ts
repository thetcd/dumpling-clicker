// Settings sheet: sound, redesign, share, reset. Share uses the Web Share API
// with a clipboard fallback so it works on desktop too.
import type { GameState } from '../game/state';
import { STR } from '../i18n/strings.he';
import { setMuted, setMusicEnabled, unlockAudio } from '../audio/sound';
import { startMusic, stopMusic } from '../audio/music';
import { formatNumber } from './format';
import { showModal } from './modal';

export function initSettings(
  button: HTMLElement,
  getState: () => GameState,
  hooks: {
    onEditSquishy: () => void;
    onReset: () => void;
  },
): void {
  button.addEventListener('click', () => {
    showModal({
      title: STR.settings,
      bodyHTML: `
        <label class="setting-row">
          <span>${STR.sound}</span>
          <input type="checkbox" id="set-sound" ${getState().settings.sound ? 'checked' : ''}>
        </label>
        <label class="setting-row">
          <span>${STR.music}</span>
          <input type="checkbox" id="set-music" ${getState().settings.music ? 'checked' : ''}>
        </label>
        <button class="btn setting-btn" id="set-edit">🎨 ${STR.editSquishy}</button>
        <button class="btn setting-btn" id="set-share">📤 ${STR.share}</button>
        <button class="btn setting-btn danger" id="set-reset">🗑️ ${STR.reset}</button>`,
      buttons: [{ label: STR.close, primary: true }],
    });
    document.getElementById('set-sound')!.addEventListener('change', (e) => {
      getState().settings.sound = (e.target as HTMLInputElement).checked;
      setMuted(!getState().settings.sound);
    });
    document.getElementById('set-music')!.addEventListener('change', (e) => {
      getState().settings.music = (e.target as HTMLInputElement).checked;
      unlockAudio();
      setMusicEnabled(getState().settings.music);
      if (getState().settings.music) startMusic();
      else stopMusic();
    });
    document.getElementById('set-edit')!.addEventListener('click', () => {
      document.querySelector('.modal-backdrop')?.remove();
      hooks.onEditSquishy();
    });
    document.getElementById('set-share')!.addEventListener('click', () => {
      void shareGame(getState());
    });
    document.getElementById('set-reset')!.addEventListener('click', () => {
      showModal({
        title: STR.reset,
        bodyHTML: `<p>${STR.resetConfirm}</p>`,
        buttons: [
          { label: STR.cancel, primary: true },
          { label: STR.resetYes, onClick: hooks.onReset },
        ],
      });
    });
  });
}

export async function shareGame(state: GameState): Promise<void> {
  const text = STR.shareText(formatNumber(state.totalEarned));
  const url = location.origin + location.pathname;
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return;
    } catch {
      /* user cancelled — fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast(STR.copied);
  } catch {
    /* clipboard blocked — nothing else to try */
  }
}

export function toast(text: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

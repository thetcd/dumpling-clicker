// The "new version ready" toast. vite-plugin-pwa runs in 'prompt' mode: a new
// build downloads in the background and then WAITS — the old 'autoUpdate' mode
// swapped it in and reloaded the page on its own, which can pull the game out
// from under a kid mid-frenzy. The reload now costs one tap, so it always
// happens at a moment the player chose. boot.ts wires onTap to updateSW(true),
// which tells the waiting service worker to take over and reloads.
import { STR } from '../i18n/strings.he';

export function showUpdateToast(onTap: () => void): void {
  if (document.querySelector('.update-toast')) return;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'update-toast';
  el.textContent = STR.updateReady;
  el.addEventListener(
    'click',
    () => {
      el.disabled = true;
      el.textContent = STR.updateLoading;
      onTap();
    },
    { once: true },
  );
  document.body.appendChild(el);
}

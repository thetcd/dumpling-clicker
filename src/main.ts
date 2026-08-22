// Entry dispatcher. The GitHub Pages build (CI sets VITE_BASE to the
// '/dumpling-clicker/' sub-path — see vite.config.ts) is retired to a static
// "we moved" screen instead of booting the game, so old home-screen installs
// aren't silently abandoned after the move to the custom domain. Every other
// build (dev, preview, the root-domain Vercel deploy) leaves BASE_URL at '/'
// and boots normally.
import { STR } from './i18n/strings.he';

const NEW_ORIGIN = 'https://dumplingclicker.com/';

if (import.meta.env.BASE_URL !== '/') {
  document.getElementById('app')!.innerHTML = `
    <div class="moved-screen">
      <div class="moved-emoji">🥟</div>
      <p class="moved-title">${STR.movedTitle}</p>
      <p class="moved-body">${STR.movedBody}</p>
      <a class="moved-cta" href="${NEW_ORIGIN}">${STR.movedCta}</a>
    </div>`;
} else {
  void import('./boot');
}

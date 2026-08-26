// Entry dispatcher. Three outcomes, checked in this order:
//
//  1. The GitHub Pages build (CI sets VITE_BASE to the '/dumpling-clicker/'
//     sub-path — see vite.config.ts) is retired to a static "we moved" screen
//     instead of booting the game, so old home-screen installs aren't silently
//     abandoned after the move to the custom domain.
//  2. PLAY_LIVE (src/migration.ts) retires the CUSTOM DOMAIN too, once the
//     Flutter app is public on Google Play. That screen still hands over the
//     player's backup code — see ui/farewell.ts for why it must.
//  3. Otherwise (dev, preview, today's root-domain Vercel deploy) the game
//     boots normally.
//
// Only branch 3 ever reaches ./boot, which is what keeps the service worker
// and analytics out of the two retired screens.
import { STR } from './i18n/strings.he';
import { PLAY_LIVE } from './migration';

const NEW_ORIGIN = 'https://dumplingclicker.com/';

if (import.meta.env.BASE_URL !== '/') {
  document.getElementById('app')!.innerHTML = `
    <div class="moved-screen">
      <div class="moved-emoji">🥟</div>
      <p class="moved-title">${STR.movedTitle}</p>
      <p class="moved-body">${STR.movedBody}</p>
      <a class="moved-cta" href="${NEW_ORIGIN}">${STR.movedCta}</a>
    </div>`;
} else if (PLAY_LIVE) {
  void import('./ui/farewell').then(({ renderFarewell }) => {
    renderFarewell(document.getElementById('app')!);
  });
} else {
  void import('./boot');
}

import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves a project repo from a sub-path (/dumpling-clicker/), so
// every absolute URL — assets, manifest icons, service-worker scope — has to be
// prefixed. The CI workflow sets VITE_BASE; local dev, local preview and any
// root-domain host (Vercel) leave it unset and keep serving from '/'.
//
// `||` and not `??` on purpose. `??` only catches undefined, so an env var that
// EXISTS but is BLANK — which is one accidental keystroke in the Vercel or
// Cloudflare dashboard — yielded base '', and that builds `start_url: ""`, a
// scope of "" and `./assets/...` relative paths. Verified: unset gives '/',
// blank gave a broken manifest.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png'],
      manifest: {
        // Fixed id: installs must survive a future start_url/scope change
        // (e.g. the Pages sub-path → custom-domain move) without being
        // treated as a different app by the browser or by a Play TWA.
        id: '/',
        name: 'דאמפלינג קליקר',
        short_name: 'דאמפלינג',
        description: 'מעצבים סקווישי, מועכים אותו, ובונים אימפריה של שקלים',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        background_color: '#bfe4f7',
        theme_color: '#bfe4f7',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            // A REAL maskable asset: art at 74% inside a full-bleed field.
            // icon-512.png has rounded corners and edge-to-edge art, so
            // Android's circular crop clips it — never reuse it here.
            src: `${base}icons/icon-512-maskable.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // the whole game is the app shell — precache everything, run offline
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The link-preview card is 200KB that only link scrapers ever fetch,
        // and they do not run a service worker. Precaching it would put it in
        // every install for nobody.
        globIgnores: ['og.png'],
        navigateFallback: `${base}index.html`,
        // The SPA fallback must not swallow the standalone static pages
        // (privacy/about — required by Play and AdSense) or /.well-known/.
        navigateFallbackDenylist: [/\/(privacy|about)\.html$/, /\/\.well-known\//],
      },
    }),
  ],
});

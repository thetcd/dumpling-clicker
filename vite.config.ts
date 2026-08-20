import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves a project repo from a sub-path (/dumpling-clicker/), so
// every absolute URL — assets, manifest icons, service-worker scope — has to be
// prefixed. The CI workflow sets VITE_BASE; local dev, local preview and any
// root-domain host (Vercel) leave it unset and keep serving from '/'.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png'],
      manifest: {
        name: 'דאמפלינג קליקר',
        short_name: 'דאמפלינג',
        description: 'מעצבים סקווישי, מועכים אותו, ובונים אימפריית כופתאות',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        background_color: '#241a28',
        theme_color: '#241a28',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${base}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // the whole game is the app shell — precache everything, run offline
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
});

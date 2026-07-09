import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// For GitHub Pages *project* sites the app is served from /<repo>/, so a
// deploy workflow sets VITE_BASE=/learningLanguageMachine/ at build time
// (docs/ARCHITECTURE.md §5). Defaults to '/' for local dev. Michi's dev
// server owns port 5174 — Mishka Hub's owns 5173 — so both can run
// side-by-side on the household machine.
const BASE = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    // Offline support for use in Japan with patchy signal (docs/HANDOFF.md
    // "post-launch ops"): precaches the app shell so it opens with no
    // network at all, and caches curriculum/phrasebook GETs so a lesson
    // fetched once stays readable offline. Auth/settings/progress writes are
    // deliberately NOT cached — they need a real round-trip, and failing
    // loudly offline is correct there (see settings.ts's error banner).
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: BASE,
        name: 'Michi',
        short_name: 'Michi',
        description: "A household's Japanese phrasebook and lesson path for the trip.",
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#f7fbfa',
        theme_color: '#f7fbfa',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // The SPA shell itself — HTML/JS/CSS/fonts — precached at build time.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            // Curriculum content, phrasebook item bank, course manifest —
            // read-mostly and safe to serve stale-while-revalidate offline.
            // These responses are per-caller (progress, partner presence),
            // not shared static content, so the cache key includes a hash of
            // the bearer token — without that, two accounts signed in on the
            // same device/browser (unlikely for this household, but not
            // impossible while testing) could get served each other's
            // cached progress while offline.
            urlPattern: ({ url, request }: { url: URL; request: Request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/curriculum/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'michi-content',
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
                    const auth = request.headers.get('Authorization') ?? ''
                    let hash = 0
                    for (let i = 0; i < auth.length; i++) {
                      hash = (hash * 31 + auth.charCodeAt(i)) >>> 0
                    }
                    return `${request.url}::${hash}`
                  },
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5174 },
})

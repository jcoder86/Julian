import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Vite root is the project directory.
// `assets/` is served as a sibling of `src/`; we expose it via publicDir
// so paths like `assets/audio/sfx/cast.mp3` resolve at runtime.
export default defineConfig({
  publicDir: 'assets',
  server: {
    host: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',     // service worker activates new versions on next load
      includeAssets: ['pwa/icon-180.png'],
      manifest: {
        name: "Julian's Visavontuur",
        short_name: 'Visavontuur',
        description: 'Julian\'s Visavontuur -- een rustig vis-spelletje',
        theme_color: '#1c2530',
        background_color: '#1c2530',
        display: 'fullscreen',          // hide URL bar when launched from home screen
        orientation: 'landscape',       // optimised for iPad landscape
        start_url: '/',
        icons: [
          { src: 'pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Pre-cache everything that could be needed offline. The 49 MB
        // budget is fine for a game that's a single static deploy.
        globPatterns: ['**/*.{js,css,html,png,mp3,wav,mp4,json}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,   // 10 MB per file
      },
    }),
  ],
});

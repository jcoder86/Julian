import { defineConfig } from 'vite';

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
});

import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://ftocheri.github.io/date-night-dles/. Each game is its own page so
// links like /date-night-dles/tv/ work on static hosting without a router.
export default defineConfig({
  base: '/date-night-dles/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        tv: resolve(import.meta.dirname, 'tv/index.html'),
        movies: resolve(import.meta.dirname, 'movies/index.html'),
      },
    },
  },
});

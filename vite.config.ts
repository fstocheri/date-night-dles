import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://fstocheri.github.io/date-night-dles/. Each game is its own page so
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
        songs: resolve(import.meta.dirname, 'songs/index.html'),
        artists: resolve(import.meta.dirname, 'artists/index.html'),
        rock: resolve(import.meta.dirname, 'rock/index.html'),
        trivia: resolve(import.meta.dirname, 'trivia/index.html'),
      },
    },
  },
});

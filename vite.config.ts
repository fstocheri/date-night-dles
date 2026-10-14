import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://ftocheri.github.io/channel-surf/
export default defineConfig({
  base: '/channel-surf/',
  plugins: [react()],
});

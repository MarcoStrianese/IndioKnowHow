import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: './', // percorsi relativi: funziona su GitHub Pages anche in sottocartella
  plugins: [svelte()],
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});

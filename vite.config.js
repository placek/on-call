import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` controls the asset URL prefix. GitHub Pages serves project sites
// from `https://<user>.github.io/<repo>/`, so the deploy workflow injects
// `BASE_PATH=/<repo>/` at build time. Local dev and root-served setups
// (Docker / user-org page) keep the default `/`.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});

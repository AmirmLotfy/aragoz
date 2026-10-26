import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { assetReviewPlugin } from './asset-review-plugin.ts';
export default defineConfig({
  plugins: [react(),assetReviewPlugin()],
  server: { proxy: { '/api': { target: 'http://127.0.0.1:3000', ws: true } } },
  build: { target: 'es2023', chunkSizeWarningLimit: 1500, rolldownOptions: { output: { manualChunks(id) {
    if (id.includes('/@babylonjs/')) return 'babylon';
    if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(id)) return 'ui';
  } } } },
});

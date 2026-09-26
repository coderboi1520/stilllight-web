import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/pixi.js/') || id.includes('/node_modules/@pixi/')) return 'pixi';
        },
      },
    },
  },
});

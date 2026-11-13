import {defineConfig} from 'vite';
import {resolve} from 'path';

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, 'resources/js/main.js'),
      name: 'OreDashboardFilters',
      formats: ['iife'],
      fileName: () => 'build.iife.js',
    },
    outDir: 'public/build',
    emptyOutDir: false,
  },
});

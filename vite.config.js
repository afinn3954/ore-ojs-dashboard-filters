import {defineConfig} from 'vite';
import {resolve} from 'path';

// One IIFE bundle per page type. Vite lib mode allows a single IIFE entry
// per build, so the entry is chosen by --mode (see package.json).
const entries = {
  dashboard: 'resources/js/entries/dashboard.js',
  settings: 'resources/js/entries/settings.js',
};

export default defineConfig(({mode}) => {
  if (!entries[mode]) throw new Error(`Unknown build mode "${mode}"`);
  return {
    publicDir: false,
    build: {
      lib: {
        entry: resolve(__dirname, entries[mode]),
        name: `OreDashboardFilters_${mode}`,
        formats: ['iife'],
        fileName: () => `ore-${mode}.js`,
      },
      outDir: 'public/build',
      emptyOutDir: false,
    },
  };
});

/**
 * @file plugins/generic/oreDashboardFilters/vite.config.js
 *
 * Copyright (c) 2026 CERN
 * Original developer: Anthony Finnerty
 * Distributed under the GNU GPL v3. For full terms see the file LICENSE.
 */

import {defineConfig} from 'vite';
import {resolve} from 'path';

const licenceBanner = `/*!
 * ORE Dashboard Filters for OJS 3.6
 * Copyright (c) 2026 CERN
 * Original developer: Anthony Finnerty
 * Distributed under the GNU GPL v3. See LICENSE.
 */`;

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
    emptyOutDir: true,
    rollupOptions: {
      output: {
        banner: licenceBanner,
      },
    },
  },
});

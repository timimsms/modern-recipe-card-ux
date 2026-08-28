import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Track 02 is the first thing in this repo that needs building, which is itself part of what
 * Phase 08 measures. Tracks 01 and 03 are served straight from source; this one has to be
 * compiled before it exists at all.
 *
 * It builds to `dist/` and is served by the same `pnpm serve` as every other track, so the
 * comparison is not confounded by one track running behind a dev server with HMR and the others
 * being static files.
 */
export default defineConfig({
  base: '/experiments/02-react-shadcn/dist/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // The same `dist` every other track loads. Importing core's *source* here would give this
      // track a compilation step the others do not have and quietly change what is measured.
      '@recipe/core': fileURLToPath(new URL('../../packages/core/dist/index.js', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Phase 08 reports bytes, so nothing should be hidden in a sourcemap comment or split across
    // chunks in a way that makes the number hard to state.
    sourcemap: false,
  },
})

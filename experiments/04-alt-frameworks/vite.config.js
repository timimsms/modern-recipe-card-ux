import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import solid from 'vite-plugin-solid'

/**
 * One track, two apps.
 *
 * PHASE-07 wants the *same renderer design* across frameworks so that differences are
 * attributable to the framework rather than to design choices. Sharing a Vite config and a
 * stylesheet is how that constraint is enforced: neither variant can quietly diverge on tooling
 * or spacing, so what is left to differ is the reactivity model — which is the thing being
 * measured.
 *
 * Solid's plugin is scoped to `src/solid`. Left unscoped, its JSX transform would try to compile
 * anything JSX-shaped in the track.
 */
export default defineConfig({
  // Relative base, so the built assets load from wherever the dist directory is mounted —
  // the local server serves it at /experiments/<track>/dist/ and GitHub Pages under a project
  // subpath, and an absolute base would break the second silently.
  base: './',
  plugins: [svelte(), solid({ include: ['**/solid/**/*.jsx'] })],
  resolve: {
    alias: {
      // The same emitted `dist` every other track loads, so no track gets a compilation of core
      // that the others do not have.
      '@recipe/core': fileURLToPath(new URL('../../packages/core/dist/index.js', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        svelte: fileURLToPath(new URL('./svelte.html', import.meta.url)),
        solid: fileURLToPath(new URL('./solid.html', import.meta.url)),
      },
    },
  },
})

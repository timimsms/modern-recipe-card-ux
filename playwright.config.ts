import { defineConfig, devices } from '@playwright/test'

/**
 * Visual regression for the experiment tracks.
 *
 * **Deliberately not part of `pnpm check`.** Screenshot baselines are font-rendering dependent,
 * so a baseline generated on macOS fails on a Linux CI runner for reasons that have nothing to
 * do with the code. Wiring that into the main check would mean either a permanently red build or
 * a threshold loose enough to miss real regressions — both worse than running this on purpose.
 *
 *   pnpm test:visual                 # compare against committed baselines
 *   pnpm test:visual --update-snapshots
 *
 * Baselines are committed and are the fidelity reference Phase 08 scores the other tracks
 * against, so regenerate them only when a change is *meant* to alter the rendering, and review
 * the image diff before committing.
 */
export default defineConfig({
  testDir: './experiments',
  testMatch: '**/*.visual.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'node scripts/serve.mjs 8732',
    url: 'http://localhost:8732/experiments/01-css-grid/',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
  },
  use: {
    baseURL: 'http://localhost:8732',
    // Pinned so a baseline means something. A different scale factor or colour scheme changes
    // every pixel without changing the design.
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  },
  expect: {
    toHaveScreenshot: {
      // Small enough to catch a shifted cell, large enough to survive sub-pixel text rendering.
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (pkg: string) =>
  fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url))

export default defineConfig({
  resolve: {
    // Tests run against source, not dist, so `pnpm test` never depends on build order.
    // The dist path is exercised separately by the browser-loadability check in
    // packages/core/src/purity.test.ts.
    alias: {
      '@recipe/core': src('core'),
      '@recipe/corpus': src('corpus'),
      '@recipe/tokens': src('tokens'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
  },
})

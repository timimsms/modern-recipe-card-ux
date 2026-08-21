#!/usr/bin/env node
/**
 * Writes packages/tokens/tokens.css from the TypeScript source.
 *
 * The no-bundler track links that file directly, so it has to exist on disk with no build step
 * at serve time. `pnpm test` asserts the committed file still matches this output, so the two
 * cannot drift silently.
 *
 *   node scripts/build-tokens.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { toCss } from '../packages/tokens/dist/index.js'

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages',
  'tokens',
  'tokens.css',
)

writeFileSync(target, toCss())
console.log(`wrote ${target}`)

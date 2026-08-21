#!/usr/bin/env node
/**
 * Validate one corpus file and print its diagnostics.
 *
 *   node scripts/check-recipe.mjs packages/corpus/recipes/espresso-brownies.json
 *
 * A transcription aid. `pnpm test` is the authority; this exists so that fixing a recipe is a
 * one-second loop instead of a full suite run.
 */
import { readFileSync } from 'node:fs'
import { formatDiagnostic, normalizeRecipe, validateRecipe } from '../packages/core/dist/index.js'

const [, , ...files] = process.argv
if (files.length === 0) {
  console.error('usage: node scripts/check-recipe.mjs <file.json> [...]')
  process.exit(2)
}

let failed = false

for (const file of files) {
  let recipe
  try {
    recipe = normalizeRecipe(JSON.parse(readFileSync(file, 'utf8')))
  } catch (error) {
    console.log(`✗ ${file}\n    ${error.message}`)
    failed = true
    continue
  }

  const { ok, errors, warnings } = validateRecipe(recipe)
  const mark = ok ? '✓' : '✗'
  console.log(`${mark} ${file}  (${errors.length} errors, ${warnings.length} warnings)`)
  for (const d of [...errors, ...warnings]) console.log(`    ${formatDiagnostic(d)}`)
  if (!ok) failed = true
}

process.exit(failed ? 1 : 0)

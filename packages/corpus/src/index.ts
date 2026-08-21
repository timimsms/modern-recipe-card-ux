/**
 * @recipe/corpus — the transcribed source material, plus synthetic stress fixtures.
 *
 * Transcription is the cheapest possible test of a schema. Every awkwardness discovered while
 * hand-encoding Shepherd's pie is an awkwardness the layout engine would otherwise inherit.
 *
 * Recipes are committed as JSON rather than TypeScript literals so that a non-TypeScript
 * experiment track can read them directly, and so that a diff to a recipe reads as a change
 * to data rather than to code.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeRecipe, type AuthoredRecipe, type Recipe } from '@recipe/core'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

export const RECIPES_DIR = join(packageRoot, 'recipes')
export const FIXTURES_DIR = join(packageRoot, 'fixtures')

export type CorpusEntry = {
  /** Filename without extension: `espresso-brownies`. */
  slug: string
  path: string
  recipe: Recipe
}

function load(dir: string): CorpusEntry[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }

  return names
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const path = join(dir, name)
      // Files are stored in the authoring form — string fractions, bare input ids — and
      // normalised here. Everything downstream sees the strict model.
      const authored = JSON.parse(readFileSync(path, 'utf8')) as AuthoredRecipe
      return { slug: name.replace(/\.json$/, ''), path, recipe: normalizeRecipe(authored) }
    })
}

/** Recipes transcribed from the source material. These must all validate clean. */
export function loadRecipes(): CorpusEntry[] {
  return load(RECIPES_DIR)
}

/**
 * Synthetic stress cases. Split into `valid/` — extremes the engine must handle without
 * special-casing — and `invalid/`, one file per validator diagnostic, which exist precisely
 * to fail.
 */
export function loadFixtures(): CorpusEntry[] {
  return [...load(join(FIXTURES_DIR, 'valid')), ...load(join(FIXTURES_DIR, 'invalid'))]
}

export function loadValidFixtures(): CorpusEntry[] {
  return load(join(FIXTURES_DIR, 'valid'))
}

export function loadInvalidFixtures(): CorpusEntry[] {
  return load(join(FIXTURES_DIR, 'invalid'))
}

export function loadEntry(slug: string): CorpusEntry {
  const found = [...loadRecipes(), ...loadFixtures()].find((e) => e.slug === slug)
  if (!found) throw new Error(`No corpus entry named "${slug}".`)
  return found
}

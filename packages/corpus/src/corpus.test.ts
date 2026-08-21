import { describe, expect, it } from 'vitest'
import { formatDiagnostic, validateRecipe } from '@recipe/core'
import { loadRecipes, loadValidFixtures } from './index.js'

const recipes = loadRecipes()
const validFixtures = loadValidFixtures()

describe('transcribed recipes', () => {
  it('the corpus is not empty', () => {
    expect(recipes.length).toBeGreaterThan(0)
  })

  it.each(recipes.map((e) => [e.slug, e] as const))('%s validates clean', (_slug, entry) => {
    const result = validateRecipe(entry.recipe)
    expect(result.errors.map(formatDiagnostic)).toEqual([])
  })

  it.each(recipes.map((e) => [e.slug, e] as const))(
    '%s declares an id matching its filename',
    (slug, entry) => {
      expect(entry.recipe.id).toBe(slug)
    },
  )
})

describe('valid stress fixtures', () => {
  it.each(validFixtures.map((e) => [e.slug, e] as const))('%s validates clean', (_slug, entry) => {
    const result = validateRecipe(entry.recipe)
    expect(result.errors.map(formatDiagnostic)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { validateRecipe, type DiagnosticCode } from '@recipe/core'
import { loadEntry, loadInvalidFixtures } from './index.js'

/**
 * Every diagnostic gets a fixture that triggers it and an assertion on its message.
 *
 * The messages are part of the contract, not incidental. A validator that says "invalid tree"
 * teaches the author nothing; the whole reason E1 exists is that three separate people looked
 * at the brownie recipe and had to work out for themselves that the dry ingredients had no
 * instructions.
 */
const EXPECTED: Array<[slug: string, code: DiagnosticCode, messageIncludes: string]> = [
  ['orphan-ingredient', 'E1', 'is never consumed by any step'],
  ['unreachable-step', 'E2', "is not in the root's subtree"],
  ['cycle', 'E3', 'Cycle among steps: mix → fold → mix'],
  ['non-contiguous-run', 'E4', 'A step cell cannot span a gap'],
  ['undeclared-reuse', 'E5', 'is not declared in this component\'s "reuse" list'],
  ['dangling-component-ref', 'E6', 'which is not defined earlier in this recipe'],
  ['dangling-reference', 'E7', 'which does not exist'],
  ['duplicate-id', 'E8', 'Duplicate ingredient id'],
]

describe.each(EXPECTED)('%s → %s', (slug, code, messageIncludes) => {
  const { errors } = validateRecipe(loadEntry(slug).recipe)

  it('fails validation', () => {
    expect(errors.length).toBeGreaterThan(0)
  })

  it(`reports ${code} with a message the author can act on`, () => {
    const match = errors.find((d) => d.code === code)
    expect(match, `codes seen: ${errors.map((d) => d.code).join(', ')}`).toBeDefined()
    expect(match?.message).toContain(messageIncludes)
  })

  it('reports nothing else, so the fixture isolates one failure', () => {
    expect([...new Set(errors.map((d) => d.code))]).toEqual([code])
  })
})

describe('E4 suggests a concrete ingredient order', () => {
  const { errors } = validateRecipe(loadEntry('non-contiguous-run').recipe)
  const e4 = errors.find((d) => d.code === 'E4')

  it('names the order that would fix it', () => {
    // flour and sugar are sifted together; butter is melted alone. Interleaving them is
    // exactly the mistake, and the depth-first leaf order is the repair.
    expect(e4?.suggestion).toEqual(['flour', 'sugar', 'butter'])
  })

  it('suggests a permutation of what the author actually wrote', () => {
    const authored = loadEntry('non-contiguous-run').recipe.components[0]!.ingredients.map(
      (i) => i.id,
    )
    expect([...(e4?.suggestion ?? [])].sort()).toEqual([...authored].sort())
  })
})

describe('the invalid fixture set', () => {
  it('covers every diagnostic listed in the table above', () => {
    const slugs = loadInvalidFixtures().map((e) => e.slug)
    expect(slugs.sort()).toEqual(EXPECTED.map(([slug]) => slug).sort())
  })
})

import { describe, expect, it } from 'vitest'
import { normalizeRecipe, validateRecipe, type DiagnosticCode } from '@recipe/core'
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

/**
 * E9 and W7 — how a leaf shared by several steps is divided.
 *
 * Until Q8 the model recorded only the total, so anything naming a per-step amount named the
 * whole thing at every consumer. `InputRef.portion` records the share; these check the
 * arithmetic, including across units, since a cook may take "2 Tbs of the ½ cup".
 */
describe('a split leaf’s portions', () => {
  const build = (portions: Array<Record<string, unknown> | undefined>, total: unknown) => ({
    id: 'r',
    title: 'Split',
    components: [
      {
        id: 'c',
        prelude: [],
        ingredients: [
          { id: 'butter', item: 'butter', quantity: total },
          { id: 'oats', item: 'oats' },
        ],
        reuse: [{ leaf: 'butter' }],
        root: 'topping',
        steps: {
          cream: {
            id: 'cream',
            inputs: [
              {
                kind: 'ingredient',
                id: 'butter',
                ...(portions[0] ? { portion: portions[0] } : {}),
              },
            ],
            text: 'cream',
            effort: 'quick',
          },
          topping: {
            id: 'topping',
            inputs: [
              'cream',
              'oats',
              {
                kind: 'ingredient',
                id: 'butter',
                ...(portions[1] ? { portion: portions[1] } : {}),
              },
            ],
            text: 'rub in',
            effort: 'quick',
          },
        },
      },
    ],
  })

  const codes = (doc: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateRecipe(normalizeRecipe(doc as any))
    return [...result.errors, ...result.warnings].map((d) => d.code)
  }

  const half = { amount: 2, unit: 'Tbs' }
  const total = { amount: 4, unit: 'Tbs' }

  it('accepts portions that fit', () => {
    expect(codes(build([half, half], total))).not.toContain('E9')
    expect(codes(build([half, half], total))).not.toContain('W7')
  })

  // You cannot use more than you bought.
  it('rejects portions that exceed the total', () => {
    expect(codes(build([{ amount: 3, unit: 'Tbs' }, half], total))).toContain('E9')
  })

  it('allows a split that leaves some over — reserving a little is ordinary', () => {
    expect(codes(build([{ amount: 1, unit: 'Tbs' }, half], total))).not.toContain('E9')
  })

  it('converts across a ladder, so "2 Tbs of the 1/2 cup" checks out', () => {
    const cup = { amount: '1/2', unit: 'cup' }
    expect(
      codes(
        build(
          [
            { amount: '1/4', unit: 'cup' },
            { amount: 2, unit: 'Tbs' },
          ],
          cup,
        ),
      ),
    ).not.toContain('E9')
    // 1/2 cup is 8 Tbs; asking for 1/4 cup plus 7 Tbs is 11.
    expect(
      codes(
        build(
          [
            { amount: '1/4', unit: 'cup' },
            { amount: 7, unit: 'Tbs' },
          ],
          cup,
        ),
      ),
    ).toContain('E9')
  })

  it('warns when a split leaf with a quantity says nothing about the shares', () => {
    expect(codes(build([undefined, undefined], total))).toContain('W7')
    expect(codes(build([half, undefined], total))).toContain('W7')
  })

  // Salt and pepper are seasoned twice and measured neither time; there is nothing to divide.
  it('says nothing about a split leaf with no quantity at all', () => {
    expect(codes(build([undefined, undefined], undefined))).not.toContain('W7')
  })

  // A pinch does not convert to a teaspoon, and guessing would be worse than not checking.
  it('skips the check for units it cannot compare', () => {
    const pinches = { amount: 3, unit: 'pinch' }
    expect(
      codes(
        build(
          [
            { amount: 2, unit: 'pinch' },
            { amount: 2, unit: 'pinch' },
          ],
          pinches,
        ),
      ),
    ).not.toContain('E9')
  })
})

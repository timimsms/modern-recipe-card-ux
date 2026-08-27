import { describe, expect, it } from 'vitest'
import { layout, normalizeRecipe } from '@recipe/core'
import { METRICS, layoutDendrogram, wrap } from './geometry.js'

/**
 * A stand-in for `canvas.measureText`, so the geometry is testable without a browser.
 *
 * That this is possible at all is the point: SVG forces the layout into code, where it can be
 * asserted. Track 01 hands the same problem to CSS Grid, which is less work and cannot be
 * unit-tested — the trade runs both ways and Phase 08 should say so.
 */
const measure = (text) => text.length * 7

const component = (over = {}) => ({
  id: 'c',
  prelude: [],
  ingredients: [
    { id: 'a', item: 'butter', quantity: { amount: 4, unit: 'oz' } },
    { id: 'b', item: 'sugar' },
  ],
  root: 'mix',
  steps: {
    melt: { id: 'melt', inputs: [{ kind: 'ingredient', id: 'a' }], text: 'melt', effort: 'quick' },
    mix: {
      id: 'mix',
      inputs: [
        { kind: 'step', id: 'melt' },
        { kind: 'ingredient', id: 'b' },
      ],
      text: 'mix',
      effort: 'quick',
    },
  },
  ...over,
})

describe('wrapping', () => {
  it('breaks at the last word that fits', () => {
    // 7px a character: "one two" is 49 and fits, "one two three" is 91 and does not.
    expect(wrap('one two three', 60, measure)).toEqual(['one two', 'three'])
    expect(wrap('one two three', 100, measure)).toEqual(['one two three'])
  })

  // An ingredient is a name. `Worcesters-` identifies nothing, so a long word overflows instead.
  it('never breaks inside a word', () => {
    expect(wrap('Worcestershire', 40, measure)).toEqual(['Worcestershire'])
  })

  it('survives empty text rather than producing an empty box', () => {
    expect(wrap('', 100, measure)).toEqual([''])
  })
})

describe('the dendrogram', () => {
  const build = (c = component()) => layoutDendrogram(c, layout(c), measure)

  it('gives every ingredient a row and every step a node', () => {
    const g = build()
    expect(g.rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(g.steps.map((s) => s.id).sort()).toEqual(['melt', 'mix'])
  })

  it('draws one edge per input, and they are real', () => {
    const g = build()
    // butter→melt, melt→mix, sugar→mix.
    expect(g.edges).toHaveLength(3)
    for (const edge of g.edges) {
      expect(Number.isFinite(edge.from.x)).toBe(true)
      expect(Number.isFinite(edge.to.y)).toBe(true)
    }
  })

  /**
   * The property that makes this a dendrogram rather than a chart with lines drawn on it: a node
   * sits where its edges converge, so the geometry states the tree instead of decorating it.
   */
  it('places a step at the vertical centroid of its inputs', () => {
    const g = build()
    const mix = g.steps.find((s) => s.id === 'mix')
    const melt = g.steps.find((s) => s.id === 'melt')
    const sugar = g.rows.find((r) => r.id === 'b')
    const centre = (box) => box.y + box.height / 2
    expect(centre(mix)).toBeCloseTo((centre(melt) + centre(sugar)) / 2, 5)
  })

  // A taller row is the only thing that moves anything, so wrapping has to feed back into layout.
  it('grows a row to fit text that wraps', () => {
    const long = component({
      ingredients: [
        { id: 'a', item: 'a name long enough to need three separate lines of wrapping here' },
        { id: 'b', item: 'sugar' },
      ],
    })
    const g = layoutDendrogram(long, layout(long), measure)
    expect(g.rows[0].lines.length).toBeGreaterThan(1)
    expect(g.rows[0].height).toBeGreaterThan(METRICS.minRowHeight)
    // And the row below has to move down by exactly that much.
    expect(g.rows[1].y).toBe(g.rows[0].y + g.rows[0].height + METRICS.rowGap)
  })

  it('keeps everything inside the reported canvas', () => {
    const g = build()
    for (const box of [...g.rows, ...g.steps]) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(g.width)
      expect(box.y + box.height).toBeLessThanOrEqual(g.height)
    }
  })
})

/**
 * I4, and the reason this track exists: a leaf feeding two distant steps gets two real edges. A
 * grid cannot draw this — it would need one rectangle spanning everything in between.
 */
describe('the non-planar case', () => {
  it('draws a separate edge to each consumer of a shared leaf', async () => {
    const { readFileSync } = await import('node:fs')
    const raw = JSON.parse(
      readFileSync(
        new URL('../../../packages/corpus/fixtures/valid/reuse-split.json', import.meta.url),
        'utf8',
      ),
    )
    const recipe = normalizeRecipe(raw)
    const c = recipe.components[0]
    const g = layoutDendrogram(c, layout(c), measure)

    const butter = g.edges.filter((e) => e.leaf === 'butter').map((e) => e.step)
    expect(butter.sort()).toEqual(['cream', 'topping'])
    // The two edges genuinely go to different places, rather than being drawn on top of one another.
    const [one, two] = g.edges.filter((e) => e.leaf === 'butter')
    expect(one.to.x).not.toBe(two.to.x)
  })
})

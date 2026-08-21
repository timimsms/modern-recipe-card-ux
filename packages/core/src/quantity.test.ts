import { describe, expect, it } from 'vitest'
import {
  formatAmount,
  formatTemperature,
  ingredientFromLine,
  parseIngredientLine,
  parseQuantityAmount,
} from './quantity.js'

describe('amounts', () => {
  it.each([
    ['2', 2],
    ['1.5', 1.5],
    ['.5', 0.5],
    ['1/4', 0.25],
    ['1-1/2', 1.5],
    ['1 1/2', 1.5],
    ['½', 0.5],
    ['1½', 1.5],
  ])('reads %s as %s', (text, expected) => {
    expect(parseQuantityAmount(text)).toBe(expected)
  })

  it.each([
    ['30 to 40', { from: 30, to: 40 }],
    ['30-40', { from: 30, to: 40 }],
    ['3–4', { from: 3, to: 4 }],
  ])('reads %s as a range', (text, expected) => {
    expect(parseQuantityAmount(text)).toEqual(expected)
  })

  // The ambiguity that matters: a hyphen means "range" everywhere except in a mixed number,
  // where CFE writes 1-1/2 for one and a half. Getting this backwards silently halves or
  // doubles an ingredient after Phase 05 scaling.
  it('does not mistake a mixed number for a range', () => {
    expect(parseQuantityAmount('1-1/2')).toBe(1.5)
    expect(parseQuantityAmount('1-2')).toEqual({ from: 1, to: 2 })
  })

  it('returns undefined rather than guessing', () => {
    expect(parseQuantityAmount('a handful')).toBeUndefined()
    expect(parseQuantityAmount('')).toBeUndefined()
  })
})

describe('ingredient lines', () => {
  it('decomposes an imperial amount with an authored metric pair', () => {
    expect(parseIngredientLine('1-1/2 lb. (700 g) russet potatoes, peeled and quartered')).toEqual({
      quantity: { amount: 1.5, unit: 'lb', metric: { amount: 700, unit: 'g' } },
      item: 'russet potatoes',
      note: 'peeled and quartered',
    })
  })

  it('takes the metric pair when it follows the unit', () => {
    expect(parseIngredientLine('1 tsp. (5 mL) olive oil')).toEqual({
      quantity: { amount: 1, unit: 'tsp', metric: { amount: 5, unit: 'mL' } },
      item: 'olive oil',
    })
  })

  it('reads a fraction', () => {
    expect(parseIngredientLine('1/4 cup sugar').quantity).toEqual({ amount: 0.25, unit: 'cup' })
  })

  it('reads a range', () => {
    expect(parseIngredientLine('30 to 40 g cocoa').quantity).toEqual({
      amount: { from: 30, to: 40 },
      unit: 'g',
    })
  })

  it('marks gestural units approximate', () => {
    expect(parseIngredientLine('1 pinch saffron')).toEqual({
      quantity: { amount: 1, unit: 'pinch', approximate: true },
      item: 'saffron',
    })
  })

  it('leaves an unmeasured ingredient without a quantity', () => {
    expect(parseIngredientLine('salt and pepper')).toEqual({ item: 'salt and pepper' })
  })

  // "large" is a size, not a unit. Consuming it as one would drop it from the rendered row.
  it('keeps a size adjective in the item', () => {
    expect(parseIngredientLine('1 large artichoke')).toEqual({
      quantity: { amount: 1, unit: 'count' },
      item: 'large artichoke',
    })
  })
})

/**
 * Found while transcribing the brownies: both of these came back looking like successes.
 * A parser that degrades into a plausible wrong answer is worse than one that refuses,
 * because nothing downstream can tell the difference — Phase 05 would scale the wrong number.
 */
describe('lines the parser must refuse rather than guess at', () => {
  it('flags a size adjective sitting between the count and the metric pair', () => {
    const parsed = parseIngredientLine('2 large (100 g) eggs')
    expect(parsed.unparsed).toBe('large (100 g) eggs')
  })

  it('flags a customary-primary chain it cannot represent', () => {
    const parsed = parseIngredientLine('1 shot (4 Tbs; 60 mL) fresh brewed espresso')
    expect(parsed.unparsed).toBeDefined()
  })

  it('does not flag a line it read completely', () => {
    expect(parseIngredientLine('1-1/2 lb. (700 g) russet potatoes').unparsed).toBeUndefined()
    expect(parseIngredientLine('salt and pepper').unparsed).toBeUndefined()
  })

  it('makes the strict constructor throw instead of inventing a quantity', () => {
    expect(() => ingredientFromLine('eggs', '2 large (100 g) eggs')).toThrow(
      /Could not fully parse/,
    )
    expect(ingredientFromLine('potatoes', '2 lb. (900 g) potatoes').quantity).toEqual({
      amount: 2,
      unit: 'lb',
      metric: { amount: 900, unit: 'g' },
    })
  })
})

describe('rendering (R6)', () => {
  it.each([
    [1.5, '1½'],
    [0.25, '¼'],
    [1 / 3, '⅓'],
    [2, '2'],
  ])('renders %s as %s with a unicode fraction', (value, expected) => {
    expect(formatAmount(value)).toBe(expected)
  })

  it('renders a range with an en dash', () => {
    expect(formatAmount({ from: 30, to: 40 })).toBe('30–40')
  })

  // jenelope1st removed the space before the scale letter and dropped the parentheses to put
  // the two scales on an equal footing. Both are encoded here rather than left to each renderer.
  it('renders both temperature scales at equal weight, with no space before the scale', () => {
    expect(formatTemperature({ f: 350, c: 170 })).toBe('350°F / 170°C')
  })

  it('falls back to a label when there is no number', () => {
    expect(formatTemperature({ label: 'medium' })).toBe('medium')
  })
})

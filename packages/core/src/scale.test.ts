import { describe, expect, it } from 'vitest'
import { formatScaled, scaleQuantity, unscalableDimensions } from './scale.js'
import type { Quantity } from './model.js'

const q = (amount: Quantity['amount'], unit: string, extra: Partial<Quantity> = {}): Quantity =>
  ({ amount, unit, ...extra }) as Quantity

/**
 * R6 puts a non-breaking space between a quantity and its unit so "4 oz" never splits across
 * lines. It is invisible in an expectation and makes every failure read as `'4 oz' !== '4 oz'`,
 * so the assertions normalise it and one test below checks it is actually there.
 */
const at = (quantity: Quantity, factor: number, system?: 'imperial' | 'metric' | 'both') =>
  formatScaled(scaleQuantity(quantity, factor), system).replace(/\u00a0/g, ' ')

/**
 * PHASE-05 names the awkward cases to test and says to pull them straight from the corpus.
 * These are those, plus the one the whole feature exists for.
 */
describe('the cases PHASE-05 named', () => {
  it('1-1/2 lb at 0.5×', () => {
    expect(at(q(1.5, 'lb', { metric: { amount: 700, unit: 'g' } }), 0.5)).toBe('¾ lb / 350 g')
  })

  it('1/4 tsp at 3×', () => {
    expect(at(q(0.25, 'tsp'), 3)).toBe('¾ tsp')
  })

  it('1 shot (4 Tbs / 60 mL) at 2×', () => {
    expect(at(q(4, 'Tbs', { metric: { amount: 60, unit: 'mL' } }), 2)).toBe('½ cup / 120 mL')
  })
})

/**
 * The reason this is not multiplication. `4½ tsp` is arithmetically right and nobody writes it.
 */
describe('unit laddering', () => {
  it('turns 1½ tsp × 3 into 1 Tbs + 1½ tsp', () => {
    expect(at(q(1.5, 'tsp'), 3)).toBe('1 Tbs + 1½ tsp')
  })

  it('drops the remainder when it comes out even', () => {
    expect(at(q(1, 'tsp'), 3)).toBe('1 Tbs')
    expect(at(q(4, 'Tbs'), 4)).toBe('1 cup')
  })

  it('climbs from ounces to pounds', () => {
    expect(at(q(8, 'oz'), 4)).toBe('2 lb')
  })

  it('leaves a quantity alone at 1×', () => {
    expect(at(q(1.5, 'lb', { metric: { amount: 700, unit: 'g' } }), 1)).toBe('1½ lb / 700 g')
  })
})

describe('metric rounds to numbers a scale can show', () => {
  it('snaps grams by magnitude', () => {
    // 115 g × 1.5 = 172.5, which no recipe would print.
    expect(at(q(4, 'oz', { metric: { amount: 115, unit: 'g' } }), 1.5, 'metric')).toBe('170 g')
  })

  it('climbs to kilograms only when comfortably past the boundary', () => {
    expect(at(q(1, 'g', { metric: { amount: 400, unit: 'g' } }), 3, 'metric')).toBe('1200 g')
    expect(at(q(1, 'g', { metric: { amount: 400, unit: 'g' } }), 5, 'metric')).toBe('2 kg')
  })
})

/**
 * A lie in a quantity is worse than an omission, because it gets measured out.
 */
describe('things that do not scale', () => {
  it('refuses to multiply a pinch', () => {
    const scaled = scaleQuantity(q(1, 'pinch', { approximate: true }), 3)
    expect(scaled.unscalable).toBe('to taste — does not scale')
    expect(scaled.parts[0]?.amount).toBe(1)
  })

  it('says nothing about a pinch at 1×, where there is nothing to warn about', () => {
    expect(scaleQuantity(q(1, 'pinch', { approximate: true }), 1).unscalable).toBeUndefined()
  })

  it('handles a quantity with a unit and no number', () => {
    const scaled = scaleQuantity({ unit: 'pinch' } as Quantity, 2)
    expect(scaled.unscalable).toBe('as needed')
    // Not "1 pinch". Supplying a 1 so the arithmetic has something to chew on invents a
    // precision the source deliberately withheld — caught by a chart that started saying it.
    expect(formatScaled(scaled)).toBe('pinch')
  })

  // Two 15 oz cans at 2× is four 15 oz cans. There is no 30 oz can.
  it('scales containers by count, not by size', () => {
    const scaled = scaleQuantity(q(2, 'can', { of: { amount: 15.5, unit: 'oz' } }), 2)
    expect(formatScaled(scaled).replace(/\u00a0/g, ' ')).toBe('4 can (15½ oz each)')
  })

  it('flags a temperature and a pan rather than scaling them', () => {
    expect(unscalableDimensions({ text: 'bake', temperature: { f: 350 } })).toContain(
      'temperature does not scale',
    )
    expect(unscalableDimensions({ text: 'Butter and flour an 8x8-in pan' })[0]).toContain(
      'pan size',
    )
    expect(unscalableDimensions({ text: 'stir gently' })).toEqual([])
  })
})

describe('ranges', () => {
  it('scales both ends and keeps them in one unit', () => {
    expect(at(q({ from: 2, to: 3 }, 'Tbs'), 2)).toBe('4–6 Tbs')
  })

  it('ladders a range as a whole rather than splitting one end', () => {
    // `1 Tbs + 1 tsp to 2 Tbs` would be unreadable; staying in tsp is the lesser evil.
    const result = at(q({ from: 2, to: 4 }, 'tsp'), 2)
    expect(result).not.toContain('+')
  })
})

describe('unit system (R6)', () => {
  const butter = q(4, 'oz', { metric: { amount: 115, unit: 'g' } })

  it('shows both at equal weight by default, no parentheses', () => {
    expect(at(butter, 1)).toBe('4 oz / 115 g')
  })

  it('shows one system when asked', () => {
    expect(at(butter, 1, 'imperial')).toBe('4 oz')
    expect(at(butter, 1, 'metric')).toBe('115 g')
  })

  it('falls back to imperial when no metric pair was authored', () => {
    expect(at(q(2, 'cup'), 1, 'metric')).toBe('2 cup')
  })

  it('never renders "count" as a unit', () => {
    expect(at(q(2, 'count'), 2)).toBe('4')
  })

  it('binds the quantity to its unit with a non-breaking space', () => {
    expect(formatScaled(scaleQuantity(q(4, 'oz'), 1))).toBe('4 oz')
  })
})

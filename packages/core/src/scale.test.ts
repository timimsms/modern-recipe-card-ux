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

/**
 * PHASE-05's acceptance criterion: `espresso-brownies` at 2× and 0.5×, "verified against a
 * hand-computed table". This is that table, checked by hand row by row.
 *
 * Doing it caught the one real error in the ladder. Halving `⅓ cup` gave `⅛ cup` — 25% short,
 * and contradicting its own metric column, which correctly said 40 g. The ladder only climbed;
 * it now steps down when a rung cannot say the number.
 */
describe('espresso-brownies, hand-checked', () => {
  const rows: Array<[string, Quantity, string, string, string]> = [
    [
      'butter',
      q(4, 'oz', { metric: { amount: 115, unit: 'g' } }),
      '4 oz / 115 g',
      '½ lb / 230 g',
      '2 oz / 60 g',
    ],
    [
      'sugar',
      q(1, 'cup', { metric: { amount: 200, unit: 'g' } }),
      '1 cup / 200 g',
      '2 cup / 400 g',
      '½ cup / 100 g',
    ],
    [
      'vanilla',
      q(0.25, 'tsp', { metric: { amount: 2.5, unit: 'mL' } }),
      '¼ tsp / 2½ mL',
      '½ tsp / 5 mL',
      '⅛ tsp / 1.3 mL',
    ],
    [
      'espresso',
      q(4, 'Tbs', { metric: { amount: 60, unit: 'mL' } }),
      '4 Tbs / 60 mL',
      '½ cup / 120 mL',
      '2 Tbs / 30 mL',
    ],
    [
      'eggs',
      q(2, 'count', { metric: { amount: 100, unit: 'g' } }),
      '2 / 100 g',
      '4 / 200 g',
      '1 / 50 g',
    ],
    [
      'flour',
      q(0.5, 'cup', { metric: { amount: 80, unit: 'g' } }),
      '½ cup / 80 g',
      '1 cup / 160 g',
      '¼ cup / 40 g',
    ],
    // ⅙ cup is 8 tsp, which is 2 Tbs + 2 tsp. It is not ⅛ cup, and 40 g agrees with it.
    [
      'cocoa',
      q(1 / 3, 'cup', { metric: { amount: 80, unit: 'g' } }),
      '⅓ cup / 80 g',
      '⅔ cup / 160 g',
      '2 Tbs + 2 tsp / 40 g',
    ],
    [
      'baking soda',
      q(0.25, 'tsp', { metric: { amount: 1.3, unit: 'g' } }),
      '¼ tsp / 1.3 g',
      '½ tsp / 3 g',
      '⅛ tsp / 0.7 g',
    ],
    [
      'salt',
      q(0.25, 'tsp', { metric: { amount: 1.5, unit: 'g' } }),
      '¼ tsp / 1½ g',
      '½ tsp / 3 g',
      '⅛ tsp / 0.8 g',
    ],
  ]

  for (const [name, quantity, asWritten, doubled, halved] of rows) {
    it(name, () => {
      expect(at(quantity, 1)).toBe(asWritten)
      expect(at(quantity, 2)).toBe(doubled)
      expect(at(quantity, 0.5)).toBe(halved)
    })
  }
})

/** The rule the table above forced: a rung that cannot say the number hands it down one. */
describe('stepping down the ladder', () => {
  it('splits a cup fraction no scoop can measure', () => {
    expect(at(q(1 / 3, 'cup'), 0.5)).toBe('2 Tbs + 2 tsp')
  })

  it('never leaves a fraction on a tablespoon, since half-tablespoons do not exist', () => {
    // 4 tsp doubled is 8 tsp, which is 2⅔ Tbs — arithmetically right and unmeasurable.
    expect(at(q(4, 'tsp'), 2)).toBe('2 Tbs + 2 tsp')
  })

  it('leaves fractions where a kitchen has them', () => {
    expect(at(q(1, 'cup'), 0.5)).toBe('½ cup')
    expect(at(q(0.5, 'tsp'), 0.5)).toBe('¼ tsp')
  })

  it('drops the whole part when there is none', () => {
    // Not "0 cup + 2 Tbs + 2 tsp".
    expect(at(q(1 / 3, 'cup'), 0.5)).not.toContain('0 cup')
  })

  // 1× is the author's own wording, ladder and all — running it through the snapper replaces
  // the source's rounding with ours, which is the thing the authored-metric rule prevents.
  it('leaves an already-awkward authored amount alone at 1×', () => {
    expect(at(q(8, 'tsp'), 1)).toBe('8 tsp')
  })
})

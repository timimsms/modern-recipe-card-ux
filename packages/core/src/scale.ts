/**
 * Serving-size scaling — the reason `Quantity` is structured rather than a string.
 *
 * Scaling is a *rendering-time transform*, never a mutation. The store holds a factor and
 * formatters apply it, which keeps scale reversible and keeps corpus data as authored.
 *
 * Two things make this harder than multiplication:
 *
 *  - `1½ tsp × 3` is `4½ tsp`, which no cook writes. It is `1 Tbs + 1½ tsp`. Getting that right
 *    needs unit ladders and a sense of which increments a kitchen actually has.
 *  - Not everything scales. A pinch does not triple, an oven does not get hotter, and a pan does
 *    not grow. Those must be flagged rather than silently multiplied — a lie in a quantity is
 *    worse than an omission, because it will be measured out.
 */

import { isRange } from './quantity.js'
import type { Quantity, Range, Unit } from './model.js'

/**
 * One number and one unit. A scaled quantity may need several to read naturally.
 *
 * `amount` is optional because some quantities genuinely have none — "a pinch of nutmeg" is a
 * unit with no number. Defaulting that to 1 printed "1 pinch", inventing a precision the source
 * deliberately withheld.
 */
export type Portion = { amount?: number | Range; unit: Unit }

export type ScaledQuantity = {
  /** Usually one; more when laddering produces something like `1 Tbs + 1½ tsp`. */
  parts: Portion[]
  metric?: Portion[]
  /** The authored per-container size, scaled by count rather than by size. */
  of?: Portion
  /**
   * Set when the quantity could not be scaled honestly — a pinch, a splash, anything the model
   * marked approximate, or a quantity with no number at all. The renderer must show this rather
   * than a number.
   */
  unscalable?: string
}

// --- Ladders ------------------------------------------------------------------------------------
// Each ladder runs smallest to largest with the multiple needed to climb one rung. Only units a
// kitchen actually steps between are here: nobody writes "0.4 gallon".

/**
 * `fractional` means a kitchen can measure a *part* of this unit directly. There are ¼, ⅓ and ½
 * cup scoops and scales read half a pound, so `8 Tbs` is better written `½ cup`. There is no
 * half-tablespoon in a standard set, so `4½ tsp` climbs to `1 Tbs + 1½ tsp` and not to `1½ Tbs`.
 */
type Rung = { unit: Unit; perNext?: number; fractional?: boolean }

const LADDERS: Rung[][] = [
  [
    { unit: 'tsp', perNext: 3 },
    { unit: 'Tbs', perNext: 16 },
    { unit: 'cup', fractional: true },
  ],
  [
    { unit: 'oz', perNext: 16 },
    { unit: 'lb', fractional: true },
  ],
  [{ unit: 'g', perNext: 1000 }, { unit: 'kg' }],
  [{ unit: 'mL', perNext: 1000 }, { unit: 'L' }],
]

function ladderFor(unit: Unit): { ladder: Rung[]; index: number } | undefined {
  for (const ladder of LADDERS) {
    const index = ladder.findIndex((rung) => rung.unit === unit)
    if (index !== -1) return { ladder, index }
  }
  return undefined
}

/**
 * Fractions a kitchen can actually measure. A ⅓-cup scoop exists; a 0.42-cup scoop does not.
 * Ordered so the search prefers the simplest fraction that is close enough.
 */
const KITCHEN_FRACTIONS = [0, 1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1]

function snapFraction(value: number): number {
  const whole = Math.floor(value)
  const rest = value - whole
  let best = KITCHEN_FRACTIONS[0]!
  for (const candidate of KITCHEN_FRACTIONS) {
    if (Math.abs(candidate - rest) < Math.abs(best - rest)) best = candidate
  }
  return whole + best
}

/**
 * Metric weights and volumes are decimal, so they want round numbers rather than round
 * fractions — and how round depends on size. Nobody weighs 237 g of flour.
 */
function snapMetric(value: number): number {
  if (value >= 500) return Math.round(value / 25) * 25
  if (value >= 100) return Math.round(value / 10) * 10
  if (value >= 20) return Math.round(value / 5) * 5
  if (value >= 2) return Math.round(value)
  return Number(value.toFixed(1))
}

const METRIC = new Set<Unit>(['g', 'kg', 'mL', 'L'])

// --- Scaling ------------------------------------------------------------------------------------

/**
 * Expresses a scaled amount the way a cook would write it, climbing the ladder where that helps
 * and splitting into two parts where a single rung would give an awkward fraction.
 */
function express(value: number, unit: Unit): Portion[] {
  if (METRIC.has(unit)) {
    const found = ladderFor(unit)
    if (found) {
      const { ladder, index } = found
      const rung = ladder[index]!
      // Climb only when the result is comfortably past the boundary; 1,100 g is still grams.
      if (rung.perNext && value >= rung.perNext * 1.5) {
        return express(value / rung.perNext, ladder[index + 1]!.unit)
      }
    }
    return [{ amount: snapMetric(value), unit }]
  }

  const found = ladderFor(unit)
  if (!found) return [{ amount: snapFraction(value), unit }]

  const { ladder, index } = found
  const rung = ladder[index]!
  const above = rung.perNext ? ladder[index + 1] : undefined
  const below = ladder[index - 1]

  /**
   * Step *down* when this rung cannot say the number.
   *
   * The ladder only ever climbed, so halving `⅓ cup` snapped to the nearest cup fraction and
   * gave `⅛ cup` — 25% short, and flatly contradicted its own metric column, which correctly
   * said 40 g. Two columns disagreeing is worse than either being wrong alone.
   *
   * Two ways a rung fails to say a number: the fraction is not one a kitchen can measure (⅙ of
   * a cup), or the rung has no fractions at all (there is no ⅔ tablespoon). Either way the
   * answer lives one rung down — ⅙ cup is `2 Tbs + 2 tsp`.
   */
  if (below?.perNext) {
    const unmeasurable = Math.abs(snapFraction(value) - value) > 1e-6
    const needsWhole = !rung.fractional && Math.abs(value - Math.round(value)) > 1e-6
    if (unmeasurable || needsWhole) {
      const whole = Math.floor(value)
      const rest = value - whole
      const smaller = express(rest * below.perNext, below.unit)
      // `0 cup + 2 Tbs` is just `2 Tbs`.
      return whole > 0 ? [{ amount: whole, unit }, ...smaller] : smaller
    }
  }

  // Climb on a clean fraction when the larger unit can be measured in parts: 8 Tbs is ½ cup,
  // which is one scoop, where "8 Tbs" is eight.
  if (rung.perNext && above?.fractional) {
    const inNext = value / rung.perNext
    if (inNext >= 0.25 && Math.abs(snapFraction(inNext) - inNext) < 1e-6) {
      return [{ amount: snapFraction(inNext), unit: above.unit }]
    }
  }

  if (rung.perNext && value >= rung.perNext) {
    const next = ladder[index + 1]!.unit
    const bigger = Math.floor(value / rung.perNext)
    const remainder = value - bigger * rung.perNext
    const snappedRemainder = snapFraction(remainder)

    // `1 Tbs + 1½ tsp` beats `4½ tsp`, but `1 Tbs` alone beats `1 Tbs + 0 tsp`.
    if (snappedRemainder < 1e-6) return [{ amount: bigger, unit: next }]
    return [
      { amount: bigger, unit: next },
      { amount: snappedRemainder, unit },
    ]
  }

  return [{ amount: snapFraction(value), unit }]
}

function scaleAmount(amount: number | Range, factor: number, unit: Unit): Portion[] {
  if (isRange(amount)) {
    // A range ladders as a whole or not at all — "1 Tbs + 1 tsp to 2 Tbs" is unreadable.
    const from = amount.from * factor
    const to = amount.to * factor
    const lowest = express(from, unit)
    const highest = express(to, unit)
    if (lowest.length === 1 && highest.length === 1 && lowest[0]!.unit === highest[0]!.unit) {
      return [
        {
          amount: { from: lowest[0]!.amount as number, to: highest[0]!.amount as number },
          unit: lowest[0]!.unit,
        },
      ]
    }
    return [{ amount: { from: snapFraction(from), to: snapFraction(to) }, unit }]
  }
  return express(amount * factor, unit)
}

/**
 * Scales one authored quantity.
 *
 * The authored metric pair is scaled too rather than recomputed from the imperial value — Phase
 * 01 established that the sources round deliberately, and converting would quietly overwrite
 * their arithmetic with ours.
 */
export function scaleQuantity(quantity: Quantity, factor: number): ScaledQuantity {
  // At 1× the answer is what the author wrote. Passing it through the ladder and the snapper
  // turned an authored `115 g` into `120 g` — quietly replacing the source's own rounding with
  // ours, which is precisely what the authored-metric rule exists to prevent.
  if (factor === 1 && quantity.amount !== undefined) {
    const identity: ScaledQuantity = { parts: [{ amount: quantity.amount, unit: quantity.unit }] }
    if (quantity.metric) identity.metric = [{ ...quantity.metric }]
    if (quantity.of) identity.of = { ...quantity.of }
    return identity
  }

  // "a pinch of nutmeg" — a unit with no number. There is nothing to multiply, and supplying a
  // 1 so the arithmetic has something to work on prints "1 pinch", which the source did not say.
  if (quantity.amount === undefined) {
    return { parts: [{ unit: quantity.unit }], unscalable: 'as needed' }
  }

  // "1 pinch" times three is not "3 pinches", it is still a pinch or two — the model said this
  // number was a gesture, so multiplying it would be inventing precision it disclaimed.
  if (quantity.approximate) {
    return {
      parts: [{ amount: quantity.amount, unit: quantity.unit }],
      unscalable: factor === 1 ? undefined : 'to taste — does not scale',
    }
  }

  const scaled: ScaledQuantity = { parts: scaleAmount(quantity.amount, factor, quantity.unit) }
  if (quantity.metric) {
    scaled.metric = scaleAmount(quantity.metric.amount, factor, quantity.metric.unit)
  }
  // A container scales by *count*, not by size: two 15 oz cans at 2× is four 15 oz cans, and
  // there is no such thing as a 30 oz can because you doubled a recipe.
  if (quantity.of) scaled.of = { amount: quantity.of.amount, unit: quantity.of.unit }
  return scaled
}

/**
 * Does this step contain something that cannot follow the scale factor?
 *
 * A doubled cake does not bake at 700°F, and it does not fit the same tin. Flagging is the whole
 * of the answer here — resizing a pan is a judgement the cook has to make.
 */
export function unscalableDimensions(step: {
  text: string
  temperature?: unknown
  equipment?: string[]
}): string[] {
  const flags: string[] = []
  if (step.temperature) flags.push('temperature does not scale')
  const pan = step.text.match(/\b\d+\s*[x×]\s*\d+\b|\b\d+\s*-?\s*in\b|\bpan\b|\btin\b|\bskillet\b/i)
  if (pan) flags.push('pan size does not scale — you may need a different tin or more batches')
  return flags
}

// --- Rendering ----------------------------------------------------------------------------------

const GLYPHS: Array<[number, string]> = [
  [0.125, '⅛'],
  [1 / 6, '⅙'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.375, '⅜'],
  [0.5, '½'],
  [0.625, '⅝'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
  [0.875, '⅞'],
]

function renderAmount(amount: number | Range): string {
  if (isRange(amount)) return `${renderAmount(amount.from)}–${renderAmount(amount.to)}`
  const whole = Math.floor(amount)
  const rest = amount - whole
  if (rest < 1e-6) return String(whole)
  for (const [value, glyph] of GLYPHS) {
    if (Math.abs(rest - value) < 1e-3) return whole === 0 ? glyph : `${whole}${glyph}`
  }
  return String(Number(amount.toFixed(2)))
}

/** `count` is the model's placeholder for a number with no unit — two eggs, one artichoke. */
function renderPortion(portion: Portion): string {
  if (portion.amount === undefined) return portion.unit === 'count' ? '' : portion.unit
  return portion.unit === 'count'
    ? renderAmount(portion.amount)
    : `${renderAmount(portion.amount)}\u00a0${portion.unit}`
}

export type UnitSystem = 'imperial' | 'metric' | 'both'

/**
 * R6 throughout: unicode fractions, a non-breaking space before the unit, an en dash for ranges,
 * and both systems at equal weight rather than one parenthesised as a footnote.
 *
 * `both` is the default because it is what the sources do.
 */
export function formatScaled(scaled: ScaledQuantity, system: UnitSystem = 'both'): string {
  const imperial = scaled.parts.map(renderPortion).join(' + ')
  const metric = scaled.metric?.map(renderPortion).join(' + ')

  const chosen =
    system === 'metric' && metric
      ? metric
      : system === 'imperial' || !metric
        ? imperial
        : `${imperial} / ${metric}`

  const container = scaled.of ? ` (${renderPortion(scaled.of)} each)` : ''
  return `${chosen}${container}`
}

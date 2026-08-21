/**
 * Quantities as structure, not strings.
 *
 * `"1-1/2 lb. (700 g) russet potatoes"` has to decompose: Phase 05's serving-size scaling is
 * impossible otherwise, and R6's typographic control over unit rendering requires knowing
 * which part of the string is the number.
 *
 * The parser exists to make transcription bearable — it is an authoring aid, not a runtime
 * dependency. Corpus entries are committed as structured JSON; if the parser gets something
 * wrong, the fix is to correct the JSON, not to make the parser cleverer.
 */

import type { Ingredient, Quantity, Range, Unit } from './model.js'

// --- Amounts ---------------------------------------------------------------------------

const VULGAR_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅐': 1 / 7,
  '⅑': 1 / 9,
  '⅒': 0.1,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
}

/** Preferred glyph per value, for rendering back out under R6. */
const FRACTION_GLYPHS: Array<[number, string]> = [
  [0.125, '⅛'],
  [1 / 6, '⅙'],
  [0.2, '⅕'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.375, '⅜'],
  [0.4, '⅖'],
  [0.5, '½'],
  [0.6, '⅗'],
  [0.625, '⅝'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
  [0.8, '⅘'],
  [5 / 6, '⅚'],
  [0.875, '⅞'],
]

export function isRange(amount: number | Range): amount is Range {
  return typeof amount === 'object'
}

/**
 * Parses a single scalar amount. Accepts `2`, `1/4`, `1-1/2`, `1 1/2`, `1½`, `.5`, `1.5`.
 * Returns `undefined` rather than guessing when the text is not a number.
 */
export function parseAmount(text: string): number | undefined {
  const source = text.trim()
  if (!source) return undefined

  // "1½" and bare "½".
  const vulgar = source.match(/^(\d*)\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/u)
  if (vulgar) {
    const whole = vulgar[1] ? Number(vulgar[1]) : 0
    const fraction = VULGAR_FRACTIONS[vulgar[2] as string]
    return fraction === undefined ? undefined : whole + fraction
  }

  // "1-1/2" and "1 1/2" — a hyphen here is a mixed number, not a range, because the tail
  // is itself a fraction. `parseQuantityAmount` handles the range reading of "30-40".
  const mixed = source.match(/^(\d+)\s*[-\s]\s*(\d+)\s*\/\s*(\d+)$/)
  if (mixed) {
    const [, whole, numerator, denominator] = mixed
    const d = Number(denominator)
    if (d === 0) return undefined
    return Number(whole) + Number(numerator) / d
  }

  // "1/4"
  const fraction = source.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fraction) {
    const d = Number(fraction[2])
    return d === 0 ? undefined : Number(fraction[1]) / d
  }

  // "2", "1.5", ".5"
  if (/^\d*\.?\d+$/.test(source)) return Number(source)

  return undefined
}

/**
 * Parses a scalar or a range. `30 to 40`, `30-40`, and `3–4` are ranges; `1-1/2` is not.
 */
export function parseQuantityAmount(text: string): number | Range | undefined {
  const source = text.trim()

  const range = source.match(/^(.+?)\s*(?:to|through|[-–—])\s*(.+)$/u)
  if (range) {
    const tail = range[2] as string
    // "1-1/2": the tail is a bare fraction, so this is a mixed number.
    if (!/^\s*\d+\s*\/\s*\d+\s*$/.test(tail)) {
      const from = parseAmount(range[1] as string)
      const to = parseAmount(tail)
      if (from !== undefined && to !== undefined) return { from, to }
    }
  }

  return parseAmount(source)
}

// --- Units -----------------------------------------------------------------------------

/**
 * Source spellings → the canonical unit. CFE writes `Tbs.`, `tsp.`, `lb.`, `mL`; the
 * screenshots use `tbsp` and `T`. R6 wants one rendering, so normalise on the way in.
 */
const UNIT_ALIASES: Record<string, Unit> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  mg: 'mg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  ml: 'mL',
  milliliter: 'mL',
  millilitre: 'mL',
  l: 'L',
  liter: 'L',
  litre: 'L',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  t: 'tsp',
  tbs: 'Tbs',
  tbsp: 'Tbs',
  tablespoon: 'Tbs',
  tablespoons: 'Tbs',
  c: 'cup',
  cup: 'cup',
  cups: 'cup',
  pt: 'pint',
  pint: 'pint',
  pints: 'pint',
  qt: 'quart',
  quart: 'quart',
  quarts: 'quart',
  gal: 'gallon',
  gallon: 'gallon',
  'fl oz': 'fl oz',
  'fl. oz.': 'fl oz',
  clove: 'clove',
  cloves: 'clove',
  can: 'can',
  cans: 'can',
  pinch: 'pinch',
  pinches: 'pinch',
  dash: 'dash',
  dashes: 'dash',
  stick: 'stick',
  sticks: 'stick',
  slice: 'slice',
  slices: 'slice',
  sprig: 'sprig',
  sprigs: 'sprig',
  bunch: 'bunch',
  bunches: 'bunch',
  piece: 'piece',
  pieces: 'piece',
  in: 'in',
  inch: 'in',
  inches: 'in',
  cm: 'cm',
  large: 'count',
  medium: 'count',
  small: 'count',
}

/** Units where the number is a gesture rather than a measurement. */
const APPROXIMATE_UNITS = new Set<Unit>(['pinch', 'dash', 'sprig', 'bunch', 'piece'])

export function normalizeUnit(text: string): Unit | undefined {
  const key = text.trim().replace(/\.$/, '').toLowerCase()
  return UNIT_ALIASES[key]
}

// --- Whole ingredient lines --------------------------------------------------------------

export type ParsedIngredientLine = {
  quantity?: Quantity
  item: string
  note?: string
  /**
   * Set when measurement-looking text survived into `item` or `note` — a number, or a
   * parenthetical the parser could not read as a metric pair.
   *
   * This field exists because the first real transcription caught the parser failing
   * *quietly*: `"2 large (100 g) eggs"` came back as `{ amount: 2, unit: 'count',
   * item: 'large (100 g) eggs' }`, silently dropping the authored metric pair, and
   * `"1 shot (4 Tbs; 60 mL) espresso"` swallowed the entire measurement chain. Both look
   * like successes. A parser that degrades into a plausible wrong answer is worse than one
   * that refuses, because Phase 05 will scale the wrong number without complaint.
   */
  unparsed?: string
}

/** Digits or a parenthetical left over in the item text mean the parse was incomplete. */
const RESIDUAL_MEASUREMENT = /\d|\([^)]*\)/

const AMOUNT_HEAD =
  /^\s*((?:\d+\s*[-–—]\s*\d+\s*\/\s*\d+)|(?:\d+\s+\d+\s*\/\s*\d+)|(?:\d*\.?\d+\s*(?:to|through|[-–—])\s*\d*\.?\d+)|(?:\d+\s*\/\s*\d+)|(?:\d*\.?\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞])|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d*\.?\d+)\s*/u

/**
 * Best-effort decomposition of a source line such as
 * `"1-1/2 lb. (700 g) russet potatoes, peeled and quartered"`.
 *
 * Deliberately conservative: anything it cannot read confidently stays in `item`, where a
 * human transcriber will see it. Silently inventing a quantity would be worse than leaving
 * one unparsed, because the scaled version in Phase 05 would then be quietly wrong.
 */
export function parseIngredientLine(line: string): ParsedIngredientLine {
  let rest = line.trim()

  const head = rest.match(AMOUNT_HEAD)
  const amount = head ? parseQuantityAmount(head[1] as string) : undefined
  if (amount === undefined) {
    // No leading number at all — "salt and pepper", "chopped parsley, to serve".
    return flagResidue(splitNote(rest))
  }
  rest = rest.slice((head as RegExpMatchArray)[0].length)

  // An authored metric pair immediately after the imperial one: "(700 g)".
  let metric: Quantity['metric']
  const paren = rest.match(/^\(([^)]*)\)\s*/)
  if (paren) {
    const inner = (paren[1] as string).trim()
    const innerHead = inner.match(AMOUNT_HEAD)
    const innerAmount = innerHead ? parseQuantityAmount(innerHead[1] as string) : undefined
    const innerUnit = innerHead
      ? normalizeUnit(inner.slice((innerHead[0] as string).length))
      : undefined
    if (innerAmount !== undefined && innerUnit) {
      metric = { amount: innerAmount, unit: innerUnit }
      rest = rest.slice(paren[0].length)
    }
  }

  // The unit is the next token, if it is one we recognise. "2 large artichokes" has no
  // unit token to take — `large` is part of the item, so `count` falls out of the parse.
  let unit: Unit | undefined
  const token = rest.match(/^([A-Za-z.]+(?:\s+oz\.?)?)\s+/)
  if (token) {
    const candidate = normalizeUnit(token[1] as string)
    if (candidate && candidate !== 'count') {
      unit = candidate
      rest = rest.slice(token[0].length)
    }
  }

  // Metric pair may follow the unit instead: "1 tsp. (5 mL) olive oil".
  if (!metric) {
    const trailing = rest.match(/^\(([^)]*)\)\s*/)
    if (trailing) {
      const inner = (trailing[1] as string).trim()
      const innerHead = inner.match(AMOUNT_HEAD)
      const innerAmount = innerHead ? parseQuantityAmount(innerHead[1] as string) : undefined
      const innerUnit = innerHead
        ? normalizeUnit(inner.slice((innerHead[0] as string).length))
        : undefined
      if (innerAmount !== undefined && innerUnit) {
        metric = { amount: innerAmount, unit: innerUnit }
        rest = rest.slice(trailing[0].length)
      }
    }
  }

  const quantity: Quantity = { amount, unit: unit ?? 'count' }
  if (metric) quantity.metric = metric
  if (unit && APPROXIMATE_UNITS.has(unit)) quantity.approximate = true

  return flagResidue({ quantity, ...splitNote(rest) })
}

function flagResidue(parsed: ParsedIngredientLine): ParsedIngredientLine {
  const residue = [parsed.item, parsed.note].filter(Boolean).join(', ')
  if (!RESIDUAL_MEASUREMENT.test(residue)) return parsed
  return { ...parsed, unparsed: residue }
}

/** "russet potatoes, peeled and quartered" → item + note. */
function splitNote(text: string): { item: string; note?: string } {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  const comma = trimmed.indexOf(',')
  if (comma === -1) return { item: trimmed }
  return { item: trimmed.slice(0, comma).trim(), note: trimmed.slice(comma + 1).trim() }
}

/**
 * Convenience wrapper that produces a corpus-shaped leaf.
 *
 * Throws rather than returning a partially-read line. This is the strict door: a transcriber
 * who reaches for it is asking to be told when hand-encoding is required, and every line the
 * parser cannot fully account for is one where it would otherwise invent a number.
 */
export function ingredientFromLine(id: string, line: string): Ingredient {
  const parsed = parseIngredientLine(line)
  if (parsed.unparsed) {
    throw new Error(
      `Could not fully parse "${line}" — "${parsed.unparsed}" still looks like a measurement. ` +
        `Encode this ingredient by hand rather than accepting a guess.`,
    )
  }
  const ingredient: Ingredient = { id, item: parsed.item }
  if (parsed.quantity) ingredient.quantity = parsed.quantity
  if (parsed.note) ingredient.note = parsed.note
  return ingredient
}

// --- Rendering (R6) ----------------------------------------------------------------------

/** `1.5` → `1½`, `0.25` → `¼`. Unicode fractions, never `1-1/2`. */
export function formatAmount(amount: number | Range): string {
  if (isRange(amount)) return `${formatScalar(amount.from)}–${formatScalar(amount.to)}`
  return formatScalar(amount)
}

function formatScalar(value: number): string {
  const whole = Math.floor(value)
  const remainder = value - whole
  if (remainder < 1e-6) return String(whole)

  for (const [fraction, glyph] of FRACTION_GLYPHS) {
    if (Math.abs(remainder - fraction) < 1e-3) return whole === 0 ? glyph : `${whole}${glyph}`
  }
  return String(Number(value.toFixed(2)))
}

/**
 * `350°F (170°C)` — no space before the scale letter, no space inside the degree token,
 * and the two scales rendered at equal weight rather than one parenthesised as an
 * afterthought. Both fixes come straight from jenelope1st's annotations (R6).
 */
export function formatTemperature(t: { f?: number; c?: number; label?: string }): string {
  const parts: string[] = []
  if (t.f !== undefined) parts.push(`${t.f}°F`)
  if (t.c !== undefined) parts.push(`${t.c}°C`)
  if (parts.length === 0) return t.label ?? ''
  return parts.join(' / ')
}

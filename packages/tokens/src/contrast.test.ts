import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  dark,
  depthRamp,
  light,
  luminance,
  mix,
  parseHex,
  cardGrounds,
  textGrounds,
  toCss,
  type Palette,
} from './index.js'

/**
 * PHASE-03 asks for the palette to ship with a contrast-validation test rather than a promise.
 * This is that test. It fails the build, not a review.
 */

const AA_BODY = 4.5
const AA_LARGE = 3

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, palette: Palette) => {
  const grounds = textGrounds(palette)

  it.each(grounds.map((g) => [g.name, g.colour] as const))(
    'body ink on %s meets WCAG AA',
    (_ground, colour) => {
      expect(contrastRatio(palette.ink, colour)).toBeGreaterThanOrEqual(AA_BODY)
    },
  )

  it.each(grounds.map((g) => [g.name, g.colour] as const))(
    'soft ink on %s meets WCAG AA',
    (_ground, colour) => {
      expect(contrastRatio(palette.inkSoft, colour)).toBeGreaterThanOrEqual(AA_BODY)
    },
  )

  /**
   * Faint ink is held to the *body* threshold, on the grounds it is actually painted on.
   *
   * Two corrections, both of which the palette had wrong in opposite directions. It was held to
   * the large-text threshold on the reasoning that these are labels rather than prose — a
   * misreading, since WCAG's large-text allowance is about size (18pt, or 14pt bold) and the
   * labels it excused render at 10.88px. axe found four of them on the glance bar at 4.34:1
   * while this test passed.
   *
   * But raising it against *every* ground, including cell fills faint ink never touches, pushed
   * the dark palette's faint to within two points of its soft — deleting a level of hierarchy to
   * fix a combination that does not occur. `cardGrounds` is the honest set, and a browser test
   * checks the assumption behind it holds in the rendered chart.
   */
  it.each(cardGrounds(palette).map((g) => [g.name, g.colour] as const))(
    'faint ink on %s meets WCAG AA for small text',
    (_ground, colour) => {
      expect(contrastRatio(palette.inkFaint, colour)).toBeGreaterThanOrEqual(AA_BODY)
    },
  )

  // Still readable where it does appear over a fill, even though it should not.
  it.each(grounds.map((g) => [g.name, g.colour] as const))(
    'faint ink on %s clears the large-text floor even so',
    (_ground, colour) => {
      expect(contrastRatio(palette.inkFaint, colour)).toBeGreaterThanOrEqual(AA_LARGE)
    },
  )

  // `ruleHeavy` stopped being border-only when the completion band started setting it as text:
  // "All done. Shepherd's Pie is finished." So it is held to the body threshold now.
  it.each(grounds.map((g) => [g.name, g.colour] as const))(
    'heavy rule as text on %s meets WCAG AA',
    (_ground, colour) => {
      expect(contrastRatio(palette.ruleHeavy, colour)).toBeGreaterThanOrEqual(AA_BODY)
    },
  )

  it('the structural hue reads as a border against both grounds', () => {
    expect(contrastRatio(palette.rule, palette.surface)).toBeGreaterThanOrEqual(AA_LARGE)
    expect(contrastRatio(palette.rule, palette.paper)).toBeGreaterThanOrEqual(AA_LARGE)
  })

  // Clay carries the duration mark, which is small text sitting on whatever fill its cell has.
  it.each(grounds.map((g) => [g.name, g.colour] as const))(
    'the exception hue is legible as text on %s',
    (_ground, colour) => {
      expect(contrastRatio(palette.clay, colour)).toBeGreaterThanOrEqual(AA_BODY)
    },
  )

  // Deliberately *not* asserted: that clay separates from rule in luminance. Contrast ratio is
  // a luminance measure, so it scores two different hues at similar lightness as identical —
  // and the design never relies on hue alone anyway. Clay is always paired with a hatch, a
  // weight, or a label, and the greyscale check on the rendered chart is what enforces that.
})

/**
 * The depth ramp is R5's group encoding, and its channel is luminance rather than hue — which is
 * what makes it survive both colour-vision deficiency and greyscale print without needing a
 * separate palette for either.
 */
describe.each([
  ['light', light],
  ['dark', dark],
])('%s depth ramp', (_name, palette: Palette) => {
  const fills = depthRamp.map((pct) => mix(palette.rule, palette.surface, pct))

  it('steps monotonically, so depth reads as an order rather than a set', () => {
    const lums = fills.map((f) => luminance(parseHex(f)))
    const rising = lums.every((l, i) => i === 0 || l > lums[i - 1]!)
    const falling = lums.every((l, i) => i === 0 || l < lums[i - 1]!)
    expect(rising || falling).toBe(true)
  })

  it('separates adjacent steps enough to survive greyscale print', () => {
    // Adjacent fills differ only in luminance, so this is exactly what a greyscale printer sees.
    for (let i = 1; i < fills.length; i++) {
      const ratio = contrastRatio(fills[i]!, fills[i - 1]!)
      expect(ratio, `depth ${i - 1} → ${i}`).toBeGreaterThan(1.05)
    }
  })

  it('spans a visible range from root to leaf', () => {
    expect(contrastRatio(fills[0]!, fills[fills.length - 1]!)).toBeGreaterThan(1.35)
  })
})

describe('the committed CSS', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'tokens.css')

  it('matches the TypeScript source', () => {
    const committed = readFileSync(cssPath, 'utf8')
    expect(committed).toBe(toCss())
  })

  it('declares each theme three times, so a viewer toggle beats the OS preference', () => {
    const css = toCss()
    expect(css).toContain(':root {')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain(':root[data-theme="dark"]')
    expect(css).toContain(':root[data-theme="light"]')
  })
})

/**
 * @recipe/tokens — the design system, as data.
 *
 * One source of truth. `tokens.css` at the package root is *generated* from this file by
 * `scripts/build-tokens.mjs` and committed, so the no-bundler track can link it directly and
 * nothing has to run at serve time. A test asserts the committed CSS still matches, so drift
 * fails CI rather than being discovered in a screenshot.
 *
 * The palette is inherited from `docs/design/resolved-card.html`, which is Phase 03's visual
 * target — this is that exploration promoted to tokens, not a new identity.
 *
 * Zero dependencies, including on `core`. Tokens are a leaf: they describe how things look and
 * know nothing about recipes.
 */

// --- Colour ---------------------------------------------------------------------------------

export type Hex = `#${string}`

export type Palette = {
  /** Page ground. */
  paper: Hex
  /** Card ground, sitting on paper. */
  surface: Hex
  ink: Hex
  inkSoft: Hex
  inkFaint: Hex
  /** The structural hue. Borders, the staircase, anything that encodes the tree. */
  rule: Hex
  ruleHeavy: Hex
  ruleFaint: Hex
  /** The exception hue. Reserved for whatever the recipe wants you to notice. */
  clay: Hex
  claySoft: Hex
  hairline: Hex
  /** Unoccupied grid space, only ever visible in a debug mode. */
  void: Hex
}

/**
 * Adjusted from `docs/design/resolved-card.html`, which was never contrast-tested and does not
 * pass: its clay measured 4.38 against white (under AA) and 2.99 against a shaded root cell,
 * where the duration mark actually sits. Faint ink measured 2.43. The hues are unchanged in
 * character; they are darkened and lightened until the numbers hold.
 */
export const light: Palette = {
  paper: '#fbfaf5',
  surface: '#ffffff',
  ink: '#16211b',
  inkSoft: '#4a5a51',
  inkFaint: '#68776e',
  rule: '#2f6b45',
  ruleHeavy: '#1c4a2e',
  ruleFaint: '#cfdbd2',
  clay: '#854c0e',
  claySoft: '#f2e6d2',
  hairline: '#e2e7e2',
  void: '#eceee9',
}

export const dark: Palette = {
  paper: '#10150f',
  surface: '#181f19',
  ink: '#e8efe7',
  inkSoft: '#a3b3a7',
  inkFaint: '#8a9a8f',
  rule: '#6cba86',
  ruleHeavy: '#9ad8ad',
  ruleFaint: '#2f3d33',
  clay: '#f0c274',
  claySoft: '#3a2f1c',
  hairline: '#29332a',
  void: '#212a22',
}

/**
 * R5's group encoding — a depth ramp, not a categorical palette.
 *
 * A categorical palette would have to survive deuteranopia, protanopia, and greyscale print,
 * which is a hard constraint to meet with enough hues to be useful. A single-hue ramp sidesteps
 * it entirely: the channel is *luminance*, which every form of colour vision shares and which
 * print preserves. Group identity then comes from rule weight and position, which R5 wanted as
 * the redundant channel anyway.
 *
 * Values are mix percentages of `rule` into `surface`, **darkest at the finished dish**. PHASE-03
 * asked whether the ramp should run the other way — lightest at the root, reading as "converging
 * toward finished". Rendered on shepherd's pie, that inverts the emphasis: the eye is pulled left
 * to the raw ingredients, the deepest prep steps become the heaviest cells on the chart, and the
 * finished dish — the one cell everything else exists to produce — is the palest thing on it.
 *
 * A renderer scales these to the chart's own `GridPlan.maxDepth` rather than using the index
 * directly; an absolute mapping collapses on a long chain.
 *
 * Five steps, not more. Percentage is not linear in perceived luminance, so a longer ramp
 * bunches up at the shallow end — the seven-step version tested at 1.03 between its last two
 * steps, which is invisible on paper. Five steps that can actually be told apart beat seven
 * that cannot.
 */
export const depthRamp: readonly number[] = [26, 18, 12, 7, 3]

/** Beyond the ramp's length, everything is flat — deep charts stop gaining contrast. */
export function fillForDepth(depth: number): number {
  return depthRamp[Math.min(depth, depthRamp.length - 1)] ?? 0
}

// --- Rule weights ---------------------------------------------------------------------------

/**
 * Maps one-to-one onto `Edge` in the layout engine. jenelope1st's "added heavier lines to group
 * the ingredients and their related instructions" (R4) is literally this scale.
 */
export const edgeWidth = {
  none: 0,
  hairline: 1,
  rule: 1.5,
  heavy: 2.5,
} as const

export type EdgeName = keyof typeof edgeWidth

// --- Type -----------------------------------------------------------------------------------

export const font = {
  display: '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif',
  body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
} as const

/**
 * Deliberately small. A wall-chart is mostly one size of text in a lot of boxes; the hierarchy
 * comes from weight and position, not from a dozen sizes.
 *
 * Sized against a 390px phone as well as a 1400px chart, per PHASE-03's coupling warning —
 * `step` and `ingredient` are the two that have to survive the drop, so neither goes below 13px.
 */
export const type = {
  cardTitle: { size: '1.45rem', weight: 600, family: font.display, leading: 1.15 },
  componentTitle: { size: '1.05rem', weight: 600, family: font.display, leading: 1.2 },
  prelude: { size: '0.86rem', weight: 600, family: font.body, leading: 1.4 },
  step: { size: '0.86rem', weight: 500, family: font.body, leading: 1.35 },
  ingredient: { size: '0.83rem', weight: 400, family: font.body, leading: 1.35 },
  mark: { size: '0.72rem', weight: 600, family: font.mono, leading: 1 },
  label: { size: '0.68rem', weight: 500, family: font.mono, leading: 1.2 },
} as const

// --- Space ----------------------------------------------------------------------------------

export const space = {
  /** Between grid regions. Non-zero is what makes stray rules structurally impossible (R1). */
  gap: '2px',
  cellPaddingY: '0.4rem',
  cellPaddingX: '0.5rem',
  /**
   * R9, as track ceilings rather than a text measure.
   *
   * Capping the *text* inside an uncapped column produced the worst of both: the column stretched
   * to whatever was available and the text sat in a narrow ribbon inside it — a 621px cell
   * wrapping at 18ch. Capping the column instead means long text wraps because it has run out of
   * column, which is what R9 actually asks for, and a 20rem column is ~45 characters at step size.
   */
  ingredientColumn: '13rem',
  ingredientColumnMax: '22rem',
  stepColumnMin: '6.5rem',
  stepColumnMax: '20rem',
  radius: '2px',
} as const

// --- Contrast ---------------------------------------------------------------------------------
// Shipped as functions so the palette can be *validated* rather than asserted. See
// `contrast.test.ts`, which fails the build if any text pair drops below WCAG AA.

export type Rgb = { r: number; g: number; b: number }

export function parseHex(hex: string): Rgb {
  const v = hex.replace('#', '')
  const full =
    v.length === 3
      ? v
          .split('')
          .map((c) => c + c)
          .join('')
      : v
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

export function toHex({ r, g, b }: Rgb): Hex {
  const part = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** sRGB relative luminance, per WCAG 2.1. */
export function luminance(colour: Rgb): number {
  const channel = (raw: number): number => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(parseHex(a))
  const lb = luminance(parseHex(b))
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** The same computation CSS `color-mix(in srgb, a P%, b)` performs, so tests see real colours. */
export function mix(a: string, b: string, percentA: number): Hex {
  const x = parseHex(a)
  const y = parseHex(b)
  const t = percentA / 100
  return toHex({
    r: x.r * t + y.r * (1 - t),
    g: x.g * t + y.g * (1 - t),
    b: x.b * t + y.b * (1 - t),
  })
}

/** Every ground a reader has to read body text against, per theme. */
/**
 * The grounds a *card-level* label sits on: paper and surface, never inside a shaded cell.
 *
 * Faint ink carries the at-a-glance labels, the mini-map caption and the timer badge, and every
 * one of them sits on the card or the page rather than in a step region — verified in the
 * browser rather than assumed, by a test that walks the rendered chart and checks no faint text
 * has a depth fill behind it.
 *
 * Holding faint ink to AA against fills it never touches is not free strictness: it forced the
 * dark palette's faint and soft to within two points of each other, which deletes a level of
 * hierarchy to fix a combination that does not occur.
 */
export function cardGrounds(palette: Palette): Array<{ name: string; colour: Hex }> {
  return [
    { name: 'paper', colour: palette.paper },
    { name: 'surface', colour: palette.surface },
  ]
}

export function textGrounds(palette: Palette): Array<{ name: string; colour: Hex }> {
  return [
    { name: 'paper', colour: palette.paper },
    { name: 'surface', colour: palette.surface },
    ...depthRamp.map((pct, i) => ({
      name: `depth ${i} fill`,
      colour: mix(palette.rule, palette.surface, pct),
    })),
    { name: 'clay wash', colour: mix(palette.clay, palette.surface, 8) },
  ]
}

// --- CSS emission -----------------------------------------------------------------------------

function block(palette: Palette): string[] {
  const lines: string[] = []
  for (const [key, value] of Object.entries(palette)) {
    lines.push(`  --${kebab(key)}: ${value};`)
  }
  depthRamp.forEach((pct, i) => {
    lines.push(`  --fill-depth-${i}: color-mix(in srgb, var(--rule) ${pct}%, var(--surface));`)
  })
  lines.push(`  color-scheme: ${palette === dark ? 'dark' : 'light'};`)
  return lines
}

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/**
 * Emits the custom properties, with the theme declared three times: `:root`, the
 * `prefers-color-scheme` media query, and explicit `data-theme` attributes.
 *
 * The third is what makes a viewer's toggle beat their OS preference *in both directions* — with
 * only the media query, a viewer on a dark OS cannot choose light.
 */
export function toCss(): string {
  const out: string[] = []
  out.push('/* Generated by scripts/build-tokens.mjs from packages/tokens/src/index.ts.')
  out.push('   Do not edit by hand — `pnpm test` fails if this drifts from the source. */')
  out.push('')
  out.push(':root {')
  out.push(...block(light))
  out.push('')
  for (const [name, width] of Object.entries(edgeWidth)) {
    out.push(`  --edge-${name}: ${width}px;`)
  }
  out.push('')
  out.push(`  --font-display: ${font.display};`)
  out.push(`  --font-body: ${font.body};`)
  out.push(`  --font-mono: ${font.mono};`)
  for (const [name, t] of Object.entries(type)) {
    out.push(`  --type-${kebab(name)}-size: ${t.size};`)
    out.push(`  --type-${kebab(name)}-weight: ${t.weight};`)
    out.push(`  --type-${kebab(name)}-leading: ${t.leading};`)
  }
  out.push('')
  for (const [name, value] of Object.entries(space)) {
    out.push(`  --space-${kebab(name)}: ${value};`)
  }
  out.push('}')
  out.push('')
  out.push('@media (prefers-color-scheme: dark) {')
  out.push('  :root {')
  out.push(...block(dark).map((l) => `  ${l}`))
  out.push('  }')
  out.push('}')
  out.push('')
  out.push(':root[data-theme="dark"] {')
  out.push(...block(dark))
  out.push('}')
  out.push('')
  out.push(':root[data-theme="light"] {')
  out.push(...block(light))
  out.push('}')
  out.push('')
  return out.join('\n')
}

export const tokens = { light, dark, depthRamp, edgeWidth, font, type, space } as const

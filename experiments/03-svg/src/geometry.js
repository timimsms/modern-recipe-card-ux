/**
 * `GridPlan` → pixels.
 *
 * This module is the whole difference between track 01 and track 03, and the reason the phase
 * doc calls text "the track's central cost".
 *
 * CSS Grid is an *auto-layout* engine: track 01 hands it row and column indices and the browser
 * works out how tall a row has to be to fit its text. SVG has no such thing. Every box needs an
 * explicit x, y, width and height before anything can be drawn, and a row's height depends on how
 * many lines its ingredient wraps to — which depends on the font, which the browser knows and this
 * file does not.
 *
 * So text measurement is injected. In the page that is `canvas.measureText`; in a test it is a
 * stub that counts characters. Either way the layout is deterministic given a measurer, which
 * keeps the geometry testable without a browser.
 *
 * The shape is a **dendrogram**, not a grid: a step sits at the vertical centroid of its inputs
 * and is joined to them by drawn edges. That is what makes this track able to render a leaf
 * feeding two distant steps (I4) — it is not confined to a rectangle that has to span everything
 * in between.
 */

/** Deliberately close to track 01's spacing so a fidelity comparison means something. */
export const METRICS = {
  ingredientWidth: 208,
  stepWidth: 132,
  columnGap: 34,
  rowGap: 6,
  padding: 16,
  lineHeight: 17,
  cellPaddingY: 7,
  cellPaddingX: 9,
  minRowHeight: 34,
  ingredientFont: '13px ui-sans-serif, system-ui, sans-serif',
  stepFont: '500 13px ui-sans-serif, system-ui, sans-serif',
}

/**
 * Greedy word wrap to a pixel width.
 *
 * A word longer than the line is left to overflow rather than broken mid-word: an ingredient is a
 * name, and `Worcesters-` identifies nothing. Track 01 leaves this to the browser, which is
 * exactly the asymmetry worth reporting.
 */
export function wrap(text, width, measure) {
  const words = String(text ?? '')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ['']

  const lines = []
  let line = words[0]
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`
    if (measure(candidate) <= width) line = candidate
    else {
      lines.push(line)
      line = word
    }
  }
  lines.push(line)
  return lines
}

const centre = (box) => box.y + box.height / 2

/**
 * @param {object} component
 * @param {object} plan  a GridPlan — the same one every other track consumes
 * @param {(text: string, font: string) => number} measure
 */
export function layoutDendrogram(component, plan, measure) {
  const m = METRICS
  const textWidth = m.ingredientWidth - m.cellPaddingX * 2

  // --- Rows: one per ingredient, height driven by how far its text wraps ---------------------
  const rows = []
  let y = m.padding

  for (const leafId of plan.rowOrder) {
    const leaf = component.ingredients.find((l) => l.id === leafId)
    const label = leaf?.component ? (leaf.label ?? leaf.component) : (leaf?.item ?? leafId)
    const quantity = leaf?.quantity ? formatQuantityText(leaf.quantity) : ''
    const lines = [
      ...(quantity ? wrap(quantity, textWidth, (t) => measure(t, m.ingredientFont)) : []),
      ...wrap(label, textWidth, (t) => measure(t, m.ingredientFont)),
    ]
    const height = Math.max(m.minRowHeight, lines.length * m.lineHeight + m.cellPaddingY * 2)
    rows.push({ id: leafId, x: m.padding, y, width: m.ingredientWidth, height, lines })
    y += height + m.rowGap
  }

  const rowById = new Map(rows.map((row) => [row.id, row]))

  // --- Steps: x from the plan's column, y from the centroid of the inputs --------------------
  // The centroid is what makes the drawing a dendrogram rather than a chart with lines on it: a
  // node sits where its edges converge, so the geometry states the tree rather than decorating it.
  const stepCells = plan.cells.filter((cell) => cell.kind === 'step')
  const columnX = (col) => m.padding + m.ingredientWidth + col * (m.stepWidth + m.columnGap)

  const nodes = new Map()
  // Shallowest first, so a step's inputs always have positions by the time it needs them.
  const ordered = [...stepCells].sort((a, b) => b.depth - a.depth)

  for (const cell of ordered) {
    const step = component.steps[cell.ref]
    const anchors = step.inputs
      .map((input) => (input.kind === 'step' ? nodes.get(input.id) : rowById.get(input.id)))
      .filter(Boolean)

    const lines = wrap(step.text, m.stepWidth - m.cellPaddingX * 2, (t) => measure(t, m.stepFont))
    const height = Math.max(m.minRowHeight, lines.length * m.lineHeight + m.cellPaddingY * 2)
    const middle =
      anchors.length > 0
        ? anchors.reduce((sum, a) => sum + centre(a), 0) / anchors.length
        : m.padding + height / 2

    nodes.set(cell.ref, {
      id: cell.ref,
      x: columnX(cell.col - 1),
      y: middle - height / 2,
      width: m.stepWidth,
      height,
      lines,
      depth: cell.depth,
      unattended: step.effort === 'long-unattended' || step.effort === 'passive',
    })
  }

  // --- Edges: one per input, drawn ----------------------------------------------------------
  const edges = []
  for (const cell of stepCells) {
    const node = nodes.get(cell.ref)
    for (const input of component.steps[cell.ref].inputs) {
      const from = input.kind === 'step' ? nodes.get(input.id) : rowById.get(input.id)
      if (!from || !node) continue
      edges.push({
        from: { x: from.x + from.width, y: centre(from) },
        to: { x: node.x, y: centre(node) },
        kind: input.kind,
        leaf: input.kind === 'ingredient' ? input.id : undefined,
        step: cell.ref,
      })
    }
  }

  const steps = [...nodes.values()]
  const width =
    Math.max(...steps.map((n) => n.x + n.width), m.padding + m.ingredientWidth) + m.padding
  const height =
    Math.max(...rows.map((r) => r.y + r.height), ...steps.map((n) => n.y + n.height), m.padding) +
    m.padding

  // A node placed at a centroid can land above the first row; shifting everything down is
  // cheaper than clamping, which would quietly move a node off its own edges.
  const top = Math.min(m.padding, ...steps.map((n) => n.y))
  const shift = top < m.padding ? m.padding - top : 0
  if (shift > 0) {
    for (const node of steps) node.y += shift
    for (const edge of edges) {
      edge.from.y += edge.from.y > 0 && edge.kind === 'step' ? shift : 0
      edge.to.y += shift
    }
  }

  return { rows, steps, edges, width, height: height + shift }
}

// --- Quantity text ------------------------------------------------------------------------------

const GLYPHS = [
  [0.125, '⅛'],
  [1 / 6, '⅙'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
]

function amountText(amount) {
  if (amount && typeof amount === 'object')
    return `${amountText(amount.from)}–${amountText(amount.to)}`
  const whole = Math.floor(amount)
  const rest = amount - whole
  if (rest < 1e-6) return String(whole)
  for (const [value, glyph] of GLYPHS) {
    if (Math.abs(rest - value) < 1e-3) return whole === 0 ? glyph : `${whole}${glyph}`
  }
  return String(Number(amount.toFixed(2)))
}

/**
 * Local to this track on purpose.
 *
 * Track 01 formats quantities through `@recipe/core`'s `formatScaled`, and so will this one once
 * scaling lands. For the wall chart alone a fraction and a unit is all that is needed, and
 * reaching for the scaling machinery before there is a scale to apply would be borrowing
 * complexity.
 */
function formatQuantityText(quantity) {
  if (quantity.amount === undefined) return quantity.unit === 'count' ? '' : quantity.unit
  const unit = quantity.unit === 'count' ? '' : `\u00a0${quantity.unit}`
  const metric = quantity.metric
    ? ` / ${amountText(quantity.metric.amount)}\u00a0${quantity.metric.unit}`
    : ''
  return `${amountText(quantity.amount)}${unit}${metric}`
}

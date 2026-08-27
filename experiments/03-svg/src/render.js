/**
 * Geometry → SVG.
 *
 * Everything here is a string, exactly as in track 01, and for the same reason: the output is a
 * complete document that needs no script to be correct. It also means the same function that
 * fills the page can write a file, which is where this track's export comes from — the format
 * spreads as screenshots, so being able to *emit* one is a capability rather than a nicety.
 *
 * Two things SVG makes harder than HTML, both reported rather than hidden:
 *
 *   - **Text does not wrap.** Every line is a separate `<tspan>` at a computed `y`, laid out by
 *     `geometry.js` from measured widths.
 *   - **Nothing has a semantic role.** A `<rect>` is a rectangle. The accessibility of this track
 *     rests on an explicit tree — `role`, `aria-label`, and Phase 06's narrative — rather than on
 *     the substrate carrying meaning the way `<table>` or even a labelled `<div>` does.
 */

import { METRICS } from './geometry.js'

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

/**
 * A cubic Bézier flattened at both ends.
 *
 * A straight line between two boxes crosses whatever is in the way and gives no sense of flow; a
 * curve that leaves horizontally and arrives horizontally reads as "this feeds that" even when
 * the two are far apart vertically. The control points sit at the horizontal midpoint, which is
 * the standard dendrogram elbow and degenerates to a straight line when the boxes are level.
 */
function edgePath({ from, to }) {
  const midway = from.x + (to.x - from.x) / 2
  return `M${from.x},${from.y} C${midway},${from.y} ${midway},${to.y} ${to.x},${to.y}`
}

/**
 * Text in a box, one `<tspan>` per measured line.
 *
 * `text-anchor` has to be set as well as the x, and forgetting it is not subtle: the first render
 * put every step label outside its own rectangle, running off to the right, because an anchor of
 * `start` at the box's right edge is exactly that instruction. HTML has no equivalent mistake to
 * make — `text-align: end` moves text within a box that already exists.
 */
const lines = (box, anchor = 'start') => {
  const end = anchor === 'end'
  const x = end ? box.x + box.width - METRICS.cellPaddingX : box.x + METRICS.cellPaddingX
  const first = box.y + METRICS.cellPaddingY + METRICS.lineHeight - 4
  const tspans = box.lines
    .map((line, i) => `<tspan x="${x}" y="${first + i * METRICS.lineHeight}">${esc(line)}</tspan>`)
    .join('')
  return { tspans, anchor: end ? ' text-anchor="end"' : '' }
}

/**
 * @param {object} component
 * @param {object} geometry  from `layoutDendrogram`
 * @param {{ title?: string, standalone?: boolean }} [options]
 */
export function renderDendrogram(component, geometry, options = {}) {
  const { rows, steps, edges, width, height } = geometry

  // Edges first so nodes paint over them: an edge arriving at a box should stop at its border,
  // and letting the box cover the last pixel is cheaper than trimming the path.
  const drawnEdges = edges
    .map(
      (edge) =>
        `<path class="edge edge-${edge.kind}" d="${edgePath(edge)}" ` +
        `${edge.leaf ? `data-leaf="${esc(edge.leaf)}" ` : ''}data-step="${esc(edge.step)}"/>`,
    )
    .join('')

  const drawnRows = rows
    .map(
      (row) =>
        `<g class="leaf" data-leaf="${esc(row.id)}">` +
        `<rect x="${row.x}" y="${row.y}" width="${row.width}" height="${row.height}" rx="3"/>` +
        `<text class="leaf-text">${lines(row).tspans}</text></g>`,
    )
    .join('')

  const drawnSteps = steps
    .map(
      (node) =>
        `<g class="step${node.unattended ? ' unattended' : ''}" data-step="${esc(node.id)}" ` +
        `data-depth="${node.depth}" role="listitem" ` +
        `aria-label="${esc(component.steps[node.id]?.text ?? node.id)}">` +
        `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="3"/>` +
        (({ tspans, anchor }) => `<text class="step-text"${anchor}>${tspans}</text></g>`)(
          lines(node, 'end'),
        ),
    )
    .join('')

  const title = options.title ?? component.title ?? 'Recipe'
  // `role="list"` over the steps and a title/description on the root are the whole of what SVG
  // gives for free. Phase 06's narrative carries the rest, which is the honest position for this
  // substrate rather than a shortfall to apologise for.
  const body =
    `<title>${esc(title)}</title>` +
    `<desc>${esc(`${rows.length} ingredients converging through ${steps.length} steps.`)}</desc>` +
    `<g class="edges" aria-hidden="true">${drawnEdges}</g>` +
    `<g class="leaves">${drawnRows}</g>` +
    `<g class="steps" role="list">${drawnSteps}</g>`

  const openTag =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" class="dendrogram" role="img" ` +
    `aria-label="${esc(title)}">`

  // A standalone file carries its own styles, because an exported SVG that depends on the page's
  // stylesheet arrives somewhere else as black text on nothing.
  return options.standalone
    ? `${openTag}<style>${STANDALONE_CSS}</style>${body}</svg>`
    : `${openTag}${body}</svg>`
}

/**
 * The subset of the page's styling an exported file needs, inlined.
 *
 * Duplicated from `card.css` on purpose: the export has to survive leaving this repo, and a
 * `var(--rule)` that resolves to nothing outside the page is worse than a hard-coded green.
 */
const STANDALONE_CSS = `
.dendrogram{background:#fff;font-family:ui-sans-serif,system-ui,sans-serif}
.edge{fill:none;stroke:#cfdbd2;stroke-width:1.5}
.edge-step{stroke:#2f6b45;stroke-width:2}
.leaf rect{fill:#fff;stroke:#e2e7e2}
.step rect{fill:#eaf1ec;stroke:#2f6b45}
.step.unattended rect{stroke:#854c0e}
.leaf-text{fill:#16211b;font-size:13px}
.step-text{fill:#16211b;font-size:13px;font-weight:500}
`

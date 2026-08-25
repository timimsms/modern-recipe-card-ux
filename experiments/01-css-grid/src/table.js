/**
 * The chart as a `<table>` — the other half of Q3.
 *
 * The 2004 source *was* a table with `rowspan`, so this is not an exotic alternative; it is the
 * original substrate, rebuilt from the plan rather than recovered from geometry. The question
 * PHASE-06 asks is whether decades of table-navigation support in assistive tech beats the
 * control CSS Grid gives — whether a reader is better served by "column 3, row 4, spans 3 rows"
 * announced natively than by relationships we assert by hand.
 *
 * Emits the *same* `GridPlan`. That is the point of the comparison: identical topology, two
 * substrates, so any difference is the substrate and not the layout.
 */

import { ingredientKey, isUnattended, stepKey } from '../../../packages/core/dist/index.js'

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

/**
 * A table is emitted row by row, so a cell that starts three rows up has to be *skipped* rather
 * than re-emitted. `GridPlan` gives absolute positions, which is the information a grid needs and
 * exactly the information a table does not — hence this occupancy pass.
 *
 * Getting this wrong is silent: the browser repairs a malformed table by shifting cells, so the
 * chart still draws and the columns are quietly wrong. The plan's own invariants (no overlaps, no
 * holes) are what make the repair unnecessary; this asserts nothing and simply follows them.
 */
function occupancy(plan, preludeRows) {
  const rows = plan.rows + preludeRows
  const taken = Array.from({ length: rows }, () => new Array(plan.columnCount).fill(false))
  const starts = new Map()

  for (const cell of plan.cells) {
    const r = cell.row + preludeRows
    const c = cell.col
    starts.set(`${r},${c}`, cell)
    for (let i = 0; i < cell.rowSpan; i++) {
      for (let j = 0; j < cell.colSpan; j++) {
        if (taken[r + i]) taken[r + i][c + j] = true
      }
    }
  }
  return { rows, starts, taken }
}

/**
 * @param {object} component
 * @param {object} plan   a GridPlan — the same one the CSS Grid renderer consumes
 * @param {object} options
 */
export function renderTableChart(component, plan, options = {}) {
  const leafById = new Map(component.ingredients.map((l) => [l.id, l]))
  const preludeRows = plan.preludes.length > 0 ? 1 : 0
  const { rows, starts } = occupancy(plan, preludeRows)

  const body = []

  if (preludeRows) {
    const text = plan.preludes.map((p) => component.prelude.find((q) => q.id === p.ref)?.text ?? '')
    body.push(
      `<tr><th scope="rowgroup" colspan="${plan.columnCount}" class="t-prelude">${esc(text.join(' · '))}</th></tr>`,
    )
  }

  for (let r = preludeRows; r < rows; r++) {
    const cells = []
    for (let c = 0; c < plan.columnCount; c++) {
      const cell = starts.get(`${r},${c}`)
      if (!cell) continue

      const span =
        (cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '') +
        (cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '')

      if (cell.kind === 'filler') {
        /**
         * A hole in the chart is not a cell.
         *
         * The table has to emit one anyway — a row must account for every column — but leaving
         * it exposed doubled what a reader hears: 13 announced cells for the brownies' 5 real
         * steps, and 30 for shepherd's pie's 15. Marking them presentational takes both to
         * exactly the number of real steps while `row` and `rowheader` counts stay intact,
         * measured against the browser's accessibility tree rather than assumed.
         *
         * This is the CSS Grid substrate's one structural advantage handed back: a grid simply
         * has no element where there is no cell.
         */
        cells.push(`<td${span} role="presentation" class="t-filler"></td>`)
        continue
      }

      if (cell.kind === 'ingredient') {
        const leaf = leafById.get(cell.ref)
        const key = ingredientKey(component, cell.ref)
        const checked = options.checkedIngredients?.has(key) ? ' checked' : ''
        const label = leaf?.component ? (leaf.label ?? leaf.component) : (leaf?.item ?? cell.ref)
        // `scope="row"` is the whole argument for this substrate: it makes the ingredient the
        // header of its row, so a screen reader announces it when the reader enters any step
        // cell on that row — the adjacency the chart draws, restated by the table itself.
        cells.push(
          `<th${span} scope="row" class="t-ing"><label><input type="checkbox" class="tick" ` +
            `data-ing="${esc(key)}"${checked}> ${esc(label)}</label></th>`,
        )
        continue
      }

      const step = component.steps[cell.ref]
      const complete = options.doneSteps?.has(stepKey(component, cell.ref)) ? ' t-done' : ''
      cells.push(
        `<td${span} class="t-step${complete}${isUnattended(step.effort) ? ' t-unatt' : ''}" ` +
          `data-step="${esc(cell.ref)}">${esc(step.text)}</td>`,
      )
    }
    body.push(`<tr>${cells.join('')}</tr>`)
  }

  // A caption rather than a visually-hidden paragraph: a caption is part of the table's own
  // semantics, so it is announced when the reader enters the table rather than before it.
  const caption =
    `${esc(component.title ?? 'Chart')} — ${plan.rows} ingredient rows, ` +
    `${plan.columnCount - 1} step columns. Each row's ingredient is its header.`

  return `<table class="t-chart"><caption>${caption}</caption><tbody>${body.join('')}</tbody></table>`
}

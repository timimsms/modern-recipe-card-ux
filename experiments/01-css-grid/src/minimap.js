/**
 * The mini-map — the whole `GridPlan` at thumbnail scale, with position and progress.
 *
 * This is the load-bearing element of cook mode. Stepping through a tree one node at a time is
 * a numbered list unless the reader can still see the tree, and the mini-map is what keeps that
 * visible. It matters more than the parallelism banner: measured across the corpus, only 24% of
 * steps have anything to offer alongside the current one (67% in shepherd's pie, 0% in five of
 * nine components), so on most steps the banner is silent and the mini-map is all there is.
 *
 * No text. At this scale type is illegible and attempting it just produces grey mush — the
 * information is *shape and position*, which is exactly what survives being made tiny.
 */

/** Fits a plan into a box, rather than picking one cell size and hoping. */
export function scaleFor(plan, box = { width: 330, height: 140 }) {
  const gap = 1
  const cols = plan.columnCount
  const rows = plan.rows + 1 // the prelude band
  const colW = Math.max(3, Math.min(34, Math.floor((box.width - gap * (cols - 1)) / cols)))
  const rowH = Math.max(3, Math.min(14, Math.floor((box.height - gap * (rows - 1)) / rows)))
  return { colW, rowH, gap }
}

/**
 * One scale for every component of a recipe.
 *
 * Sized per-plan, shepherd's pie's four-column mashed-potatoes map came out at 139px and its
 * eleven-column pie map at 330px — so the mini-map would resize as the cook crossed from one
 * component to the next, which is the one moment it most needs to look like the same object.
 * Taking the tightest scale across all plans keeps the cell size fixed, so a smaller component
 * simply draws a smaller map, which is true.
 */
export function sharedScale(plans, box) {
  const scales = plans.map((plan) => scaleFor(plan, box))
  return {
    colW: Math.min(...scales.map((s) => s.colW)),
    rowH: Math.min(...scales.map((s) => s.rowH)),
    gap: 1,
  }
}

/**
 * @param {object} plan       a GridPlan
 * @param {object} options
 * @param {string} [options.current]  step id the cook is on now
 * @param {Set<string>} [options.done]  step ids already completed
 * @param {{width:number,height:number}} [options.box]
 * @param {boolean} [options.interactive]  emit buttons so any step can be jumped to
 */
export function renderMiniMap(plan, options = {}) {
  const { current, done = new Set(), interactive = false } = options
  const { colW, rowH, gap } = options.scale ?? scaleFor(plan, options.box)

  const parts = []
  const style = (cell, extraRows = 1) =>
    `grid-area:${cell.row + extraRows}/${cell.col + 1}/${cell.row + extraRows + cell.rowSpan}/${cell.col + 1 + cell.colSpan}`

  if (plan.preludes.length > 0) {
    parts.push(`<i class="mm-prelude" style="grid-area:1/1/2/${plan.columnCount + 1}"></i>`)
  }

  for (const cell of plan.cells) {
    if (cell.kind === 'filler') continue

    if (cell.kind === 'ingredient') {
      parts.push(`<i class="mm-leaf" style="${style(cell, 2)}"></i>`)
      continue
    }

    const state = cell.ref === current ? 'now' : done.has(cell.ref) ? 'done' : 'todo'
    if (interactive) {
      // A step in the mini-map is the fastest route to any other ready step — one tap, and it
      // is spatial rather than a list you have to read.
      parts.push(
        `<button type="button" class="mm-step mm-${state}" style="${style(cell, 2)}" ` +
          `data-step="${cell.ref}" title="${cell.ref}"></button>`,
      )
    } else {
      parts.push(`<i class="mm-step mm-${state}" style="${style(cell, 2)}"></i>`)
    }
  }

  const width = plan.columnCount * colW + (plan.columnCount - 1) * gap
  /**
   * `img` when it is a picture, `group` when it is a set of buttons.
   *
   * The interactive map was `role="img"` with focusable children, which axe flags as
   * `nested-interactive` and which is genuinely contradictory: `img` makes the element a leaf in
   * the accessibility tree, so the buttons inside it are announced as part of an image that also
   * claims to have no children. Screen-reader users would have found jump targets they could
   * reach by Tab and never hear described.
   */
  const role = interactive ? 'group' : 'img'
  return (
    `<div class="minimap" role="${role}" aria-label="${describe(plan, current, done)}" ` +
    `style="width:${width}px;grid-template-columns:repeat(${plan.columnCount},${colW}px);` +
    `grid-auto-rows:${rowH}px;gap:${gap}px">${parts.join('')}</div>`
  )
}

/**
 * The mini-map is decorative to a screen reader unless it says what it shows. A sighted cook
 * gets "where am I" from the picture; this is the same sentence in words.
 */
function describe(plan, current, done) {
  const total = plan.linearization.length
  if (!current) return `Recipe map: ${total} steps.`
  const position = plan.linearization.indexOf(current) + 1
  return `Recipe map: step ${position} of ${total}, ${done.size} complete.`
}

/**
 * Steps whose inputs are all satisfied but which are not the current one — the set the
 * parallelism banner offers, and what the mini-map's other tappable cells lead to.
 */
export function readySteps(component, plan, done, current) {
  return plan.linearization.filter((id) => {
    if (id === current || done.has(id)) return false
    return component.steps[id].inputs.every((i) => i.kind === 'ingredient' || done.has(i.id))
  })
}

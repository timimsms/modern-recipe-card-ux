/**
 * Track 01 — the reference renderer. `GridPlan` → HTML string.
 *
 * Returns markup rather than touching the DOM, for two reasons. It makes the acceptance
 * criterion "zero JavaScript required for the static chart to be correct" literally true — the
 * output is complete markup that CSS alone finishes — and it means the same function can run in
 * a browser, in a static generator, or in a screenshot harness without changing.
 *
 * No framework, no bundler, no build step. Loads `@recipe/core` straight from `dist/`.
 */

import {
  describeOutput,
  formatTemperature,
  ingredientKey,
  isComponentComplete,
  isRecipeComplete,
  isUnattended,
  stepKey,
} from '../../../packages/core/dist/index.js'
import { formatQuantity, unscalableNote } from './quantity.js'

/**
 * The corpus transcribes step text faithfully, and the sources write the temperature *into* the
 * text — "bake 350°F (170°C) 30 to 40 min". Rendering the structured `temperature` beside that
 * prints it twice. So the structured value is shown only when the text has not already said it;
 * where both exist the authored sentence wins, because it is what the source actually printed.
 *
 * Recorded in findings/Q4 as an open item: the model has no way to know that a step's own text
 * duplicates its fields.
 */
const statesTemperature = (text) => /\d\s*°|\bdegrees\b/i.test(text)

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

// --- Duration marks (Q5) ---------------------------------------------------------------------

/**
 * Which effort class to mark.
 *
 * Q5 settled on "label the exception, not the default", assuming the exception is *unattended* —
 * true for the brownies, false for bread. EDGE-CASES E1 proposed making the rule relative
 * instead: mark whichever class is in the minority, and let the summary bar state the polarity.
 * This is that rule, implemented so it can be looked at rather than argued about.
 */
export function markPolarity(component, mode = 'fixed') {
  if (mode === 'fixed') return 'unattended'
  const steps = Object.values(component.steps)
  const unattended = steps.filter((s) => isUnattended(s.effort)).length
  return unattended <= steps.length - unattended ? 'unattended' : 'attended'
}

const UNITS = { sec: 's', min: 'm', hour: 'h', day: 'd' }

function formatDuration(d) {
  if (!d) return ''
  const unit = UNITS[d.unit] ?? d.unit
  return d.max !== undefined && d.max !== d.min
    ? `${d.min}\u2013${d.max}${unit}`
    : `${d.min}${unit}`
}

function markFor(step, polarity) {
  const unattended = isUnattended(step.effort)
  const marked = polarity === 'unattended' ? unattended : !unattended
  const text = formatDuration(step.duration)

  // An unmarked step still shows an authored duration — the number is information whether or
  // not the step is the exception. What the mark adds is the glyph.
  if (!marked) return text ? `<span class="mark quiet">${esc(text)}</span>` : ''

  // A bare glyph with no number says nothing a reader can act on. Unattended is the exception
  // even without a duration ("you can leave"), so it keeps its glyph; a quick attended step
  // with no authored time has nothing worth marking.
  if (!unattended && !text) return ''

  const glyph = unattended ? '◷' : '●'
  const repeat = step.repeat ? ` ×${step.repeat.times}` : ''
  return `<span class="mark"><span class="glyph" aria-hidden="true">${glyph}</span>${esc(text)}${esc(repeat)}</span>`
}

// --- At-a-glance bar --------------------------------------------------------------------------

function minutes(total) {
  if (total < 60) return `${Math.round(total)} min`
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/**
 * Everything except `servings` is derived, so the bar costs no extra authoring.
 *
 * Two rules from Q5 hold here. `start to finish` is the critical path, never the sum — summing
 * is the standard error on recipe sites and it inflates the figure by exactly the amount this
 * format exists to save. And when the timing is not authored, the numbers are labelled
 * `approx` rather than presented as measured; with no data at all they are dropped entirely.
 */
export function renderGlance(recipe, component, plan, options = {}) {
  const t = plan.timing
  const fields = [
    recipe.servings ? { label: 'serves', value: String(recipe.servings) } : null,
    { label: 'ingredients', value: String(plan.rows) },
    { label: 'steps', value: String(plan.linearization.length) },
  ]

  if (t.basis !== 'none') {
    // `singleCook`, not `criticalPathDuration`. The critical path assumes unlimited hands and
    // lets two attended steps run at once; measured across the corpus it is unreachable by a
    // person cooking alone on every recipe where it differs from this. A summary bar is read by
    // one person deciding whether to start, so it gets the number they can actually achieve.
    fields.push({ label: 'start to finish', value: minutes(t.singleCook), tone: 'total' })
    fields.push({ label: 'hands-on', value: minutes(t.handsOn) })
    if (t.longestWalkAway > 0) {
      fields.push({ label: 'longest walk-away', value: minutes(t.longestWalkAway), tone: 'away' })
    }
  }

  const cells = fields
    .filter(Boolean)
    .map(
      (f) =>
        `<div class="g${f.tone ? ` ${f.tone}` : ''}"><b>${esc(f.value)}</b><span class="lab">${esc(f.label)}</span></div>`,
    )
    .join('')

  // The legend is not decoration. Under the relative rule the glyph's meaning changes from one
  // recipe to the next, and a reader moving between two of them has no way to know it flipped —
  // which is exactly the risk EDGE-CASES E1 flagged. Saying it out loud is the minimum price.
  const steps = Object.values(component.steps)
  const unattended = steps.filter((s) => isUnattended(s.effort)).length
  const polarity = markPolarity(component, options.markRule)
  const legend =
    steps.length === 0
      ? ''
      : polarity === 'unattended'
        ? `<p class="legend"><span class="glyph" aria-hidden="true">◷</span> marks a step you can walk away from — ${unattended} of ${steps.length} here</p>`
        : `<p class="legend flipped"><span class="glyph" aria-hidden="true">●</span> marks a step that needs you — only ${steps.length - unattended} of ${steps.length}. Everything else is waiting.</p>`

  const notes = []
  if (t.basis === 'approx') notes.push('times are approximate — most steps are not timed')
  if (t.basis !== 'none' && plan.linearization.length > 1) {
    // Two different claims, and only one of them is ever true.
    notes.push(
      t.parallelSaving === 0
        ? 'nothing overlaps in this recipe — the steps run in order'
        : `${minutes(t.parallelSaving)} of this could be saved with a second pair of hands`,
    )
  }
  const note = notes.length ? `<p class="glance-note">${esc(notes.join(' · '))}</p>` : ''

  return `<div class="glance">${cells}</div>${legend}${note}`
}

// --- The chart ---------------------------------------------------------------------------------

/** How many fills the token ramp defines. Kept in step with `depthRamp` in @recipe/tokens. */
const RAMP_STEPS = 5

/**
 * Which fill a cell gets, scaled to the chart it is in rather than to an absolute depth.
 *
 * An absolute mapping looked fine on the brownies (4 deep) and collapsed on everything longer:
 * 7 of shepherd's pie's 12 step cells landed in the flattest bucket, and the deep half of the
 * chain — where "how close to done" is most worth knowing — came out uniformly flat.
 *
 * Normalising means the same depth can shade differently in two recipes. That is the same trade
 * Q5 already accepted for the duration bars, and it is the right one: a reader sees one chart at
 * a time, and what the ramp encodes is progress through *this* recipe.
 */
function shadeFor(depth, maxDepth, direction) {
  const span = Math.max(1, maxDepth)
  const index = Math.round((depth / span) * (RAMP_STEPS - 1))
  return direction === 'converging' ? RAMP_STEPS - 1 - index : index
}

function edgeStyle(edges) {
  return ['top', 'right', 'bottom', 'left']
    .map((side) => `border-${side}-width:var(--edge-${edges[side]})`)
    .join(';')
}

/**
 * R1, structurally. Every border comes from `cell.edges` — computed by the engine from whether
 * the cell actually bounds its subtree on that side — and filler is simply absent from the DOM.
 *
 * That absence is the whole fix. The original format had to emit a `<td>` for every gap, every
 * `<td>` drew borders, and `class="righthide"` was a hand-applied patch over the result. CSS
 * Grid places by coordinate, so a gap can just be nothing.
 */
export function renderChart(component, plan, options = {}) {
  const polarity = options.polarity ?? markPolarity(component, options.markRule)
  const preludeRows = component.prelude.length
  const parts = []

  component.prelude.forEach((p, i) => {
    const temp =
      p.temperature && !statesTemperature(p.text)
        ? ` <span class="temp">${esc(formatTemperature(p.temperature))}</span>`
        : ''
    parts.push(
      `<div class="cell prelude" style="grid-area:${i + 1}/1/${i + 2}/${plan.columnCount + 1}">` +
        `<span>${esc(p.text)}${temp}</span></div>`,
    )
  })

  const leafById = new Map(component.ingredients.map((l) => [l.id, l]))
  const chipsByStep = new Map()
  for (const c of plan.connections) {
    if (!chipsByStep.has(c.to)) chipsByStep.set(c.to, [])
    chipsByStep.get(c.to).push(c)
  }

  for (const cell of plan.cells) {
    const r1 = cell.row + preludeRows + 1
    const r2 = r1 + cell.rowSpan
    const c1 = cell.col + 1
    const c2 = c1 + cell.colSpan
    const area = `grid-area:${r1}/${c1}/${r2}/${c2}`

    if (cell.kind === 'filler') {
      // Filler is not a cell and carries no borders. The only reason it appears at all is the
      // Q1 leader rule: right-packed leaves a long blank run between an ingredient and its own
      // step, and the eye needs something to follow across it.
      if (!cell.leader) continue
      parts.push(`<div class="leader" style="${area}" aria-hidden="true"></div>`)
      continue
    }

    if (cell.kind === 'ingredient') {
      const leaf = leafById.get(cell.ref)
      // `checked` is rendered in, so gathering an ingredient in one view is still gathered in
      // the next. One model, two views — PHASE-04's rule, and the reason state does not live
      // in the DOM.
      // Qualified by component: shepherd's pie has a `salt` leaf in both, and a flat id meant
      // ticking the potatoes' salt also ticked the pie's — including through the `:has()` rules
      // below, which is a wrong answer with no JavaScript involved at all.
      const key = ingredientKey(component, cell.ref)
      const checked = options.checkedIngredients?.has(key) ? ' checked' : ''
      const at = `${r1},${c1},${cell.rowSpan},${cell.colSpan}`
      parts.push(
        `<label class="cell ing${cell.duplicate ? ' dup' : ''}" style="${area};${edgeStyle(cell.edges)}" data-row="${esc(key)}">` +
          `<input type="checkbox" class="tick" data-ing="${esc(key)}" data-at="${at}"${checked}>` +
          `<span class="ing-text">${renderLeaf(leaf, options)}</span></label>`,
      )
      continue
    }

    const step = component.steps[cell.ref]
    const micro = options.microList?.get(cell.ref)
    const chips = (chipsByStep.get(cell.ref) ?? [])
      .map((c) => {
        const leaf = leafById.get(c.leaf)
        const label = leaf?.item ?? c.leaf
        return `<span class="chip" title="${esc(c.note ?? '')}">↑ ${esc(label)}</span>`
      })
      .join('')
    const temp =
      step.temperature && !statesTemperature(step.text)
        ? `<span class="temp">${esc(formatTemperature(step.temperature))}</span>`
        : ''

    // A collapsed run renders as a stack, each part sitting against the rows it actually adds,
    // rather than as one paragraph of joined text. That is what keeps `ground lamb` beside
    // "cook until meat is no longer pink" after six columns have become one — losing that
    // alignment would give back exactly what R3 and R4 exist to establish.
    const body = micro
      ? `<span class="micro" style="grid-template-rows:repeat(${cell.rowSpan},1fr)">` +
        micro
          .map(
            (p) =>
              `<span class="micro-part" style="grid-row:${p.row - cell.row + 1}/span ${p.rowSpan}">` +
              `${esc(p.text)}</span>`,
          )
          .join('') +
        `</span>`
      : `<span class="step-text">${esc(step.text)}</span>`

    // A step cell is the way into cook mode, so it has to be operable — a real role and a tab
    // stop, not a div that happens to respond to clicks.
    const complete = options.doneSteps?.has(stepKey(component, cell.ref)) ? ' complete' : ''
    // A running timer shows on the chart cell too, so a glance at the wall chart says what is
    // on the stove — the reason to have a wall chart rather than a card per step. `tick()`
    // refreshes the text in place; the markup here is only the initial value.
    const timerKey = stepKey(component, cell.ref)
    const badge = options.timers?.[timerKey]
      ? `<span class="cell-timer" data-timer-for="${esc(timerKey)}" role="status"></span>`
      : ''
    parts.push(
      `<div class="cell step d${shadeFor(cell.depth, plan.maxDepth, options.ramp)}${isUnattended(step.effort) ? ' unatt' : ''}${micro ? ' collapsed' : ''}${complete}" ` +
        `role="button" tabindex="0" data-step="${esc(cell.ref)}" ` +
        `data-at="${r1},${c1},${cell.rowSpan},${cell.colSpan}" ` +
        // The tree edges, so the keyboard can walk the *graph* and not only the grid. This is
        // the relationship the chart draws with adjacency and a reader cannot otherwise follow.
        `data-inputs="${esc(
          step.inputs
            .map((i) =>
              i.kind === 'step' ? `step:${i.id}` : `ing:${ingredientKey(component, i.id)}`,
            )
            .join(' '),
        )}" ` +
        `data-feeds="${esc(consumerOf(component, cell.ref) ?? '')}" ` +
        // Brownies has two steps whose text is "mix". On the chart their position tells them
        // apart; announced, "mix" alone does not — the same ambiguity W6 catches for outputs.
        `data-produces="${esc(describeOutput(component, cell.ref))}" ` +
        `aria-label="${esc(step.text)}${complete ? ', done' : ''}. Open in cook mode." ` +
        `style="${area};${edgeStyle(cell.edges)}" data-fed-by="${esc(
          feedsOf(component, plan, cell.ref)
            .map((id) => ingredientKey(component, id))
            .join(' '),
        )}">` +
        `${chips}${body}${temp}${markFor(step, polarity)}${badge}</div>`,
    )
  }

  return (
    `<div class="chart" style="--cols:${plan.columnCount - 1};--rows:${plan.rows + preludeRows}">` +
    parts.join('') +
    `</div>`
  )
}

/** Every ingredient row that reaches this step, so check-off can propagate without JS. */
function feedsOf(component, plan, stepId) {
  const out = new Set()
  const walk = (id) => {
    const step = component.steps[id]
    if (!step) return
    for (const input of step.inputs) {
      if (input.kind === 'step') walk(input.id)
      else out.add(input.id)
    }
  }
  walk(stepId)
  return [...out]
}

/** The single step that consumes this one's output, if any. The tree has one consumer per node. */
function consumerOf(component, stepId) {
  for (const step of Object.values(component.steps)) {
    if (step.inputs.some((i) => i.kind === 'step' && i.id === stepId)) return step.id
  }
  return undefined
}

function renderLeaf(leaf, options = {}) {
  if (!leaf) return ''
  if (leaf.component) {
    return `<span class="ref">${esc(leaf.label ?? leaf.component)}</span>${leaf.note ? `<span class="note">${esc(leaf.note)}</span>` : ''}`
  }
  const q = leaf.quantity
    ? `<span class="qty">${esc(formatQuantity(leaf.quantity, options))}</span>`
    : ''
  // A quantity that cannot follow the factor says so where it is read, not in a legend. A lie
  // in a quantity is worse than an omission, because it gets measured out.
  const warning = unscalableNote(leaf.quantity, options.scale)
  const note = leaf.note ? `<span class="note">${esc(leaf.note)}</span>` : ''
  const flag = warning ? `<span class="note unscalable">${esc(warning)}</span>` : ''
  return `${q}<span class="item">${esc(leaf.item)}</span>${note}${flag}`
}

// --- The card -----------------------------------------------------------------------------------

export function renderCard(recipe, options = {}) {
  // The same two marks cook mode uses, so "part done" and "all done" mean one thing wherever
  // the reader meets them. On the chart they sit against the component title, which is the only
  // place a component announces itself.
  const state = options.state
  const done = state ? isRecipeComplete(recipe, state) : false

  const components = recipe.components
    .map((component, i) => {
      const plan = recipe.plans[i]
      const partDone = state && !done && isComponentComplete(component, state)
      const mark = partDone
        ? `<span class="seal seal-part" aria-hidden="true"></span><span class="component-done">done</span>`
        : ''
      const title = component.title
        ? `<h3 class="component-title">${esc(component.title)}${mark}</h3>`
        : ''
      return `<section class="component${partDone ? ' part-done' : ''}">${title}<div class="scroller">${renderChart(component, plan, options)}</div></section>`
    })
    .join('')

  const main = recipe.plans[recipe.plans.length - 1]
  const source = recipe.source ? `<p class="src">${esc(recipe.source.name)}</p>` : ''

  // One rule per ingredient, so checking a box propagates through every region it feeds with no
  // JavaScript at all. `:has()` does the work a script would otherwise do.
  const rules = recipe.components
    .flatMap((c) => c.ingredients.map((l) => ingredientKey(c, l.id)))
    .map(
      (id) =>
        `.card:has(.tick[data-ing="${cssEscape(id)}"]:checked) [data-row="${cssEscape(id)}"]{opacity:.5}` +
        `.card:has(.tick[data-ing="${cssEscape(id)}"]:checked) [data-fed-by~="${cssEscape(id)}"]{--started:1}`,
    )
    .join('')

  const allDone = done
    ? `<p class="ending all"><span class="seal seal-all" aria-hidden="true"></span>` +
      `<span><b>All done.</b> ${esc(recipe.title)} is finished.</span></p>`
    : ''

  return (
    `<article class="card${done ? ' done' : ''}">` +
    `<style>${rules}</style>` +
    `<header class="cardhead"><h2 class="card-title">${esc(recipe.title)}</h2>${source}` +
    (recipe.yield ? `<p class="yield">${esc(recipe.yield)}</p>` : '') +
    `</header>` +
    renderGlance(recipe, recipe.components[recipe.components.length - 1], main, options) +
    allDone +
    components +
    `</article>`
  )
}

function cssEscape(id) {
  return String(id).replace(/["\\]/g, '\\$&')
}

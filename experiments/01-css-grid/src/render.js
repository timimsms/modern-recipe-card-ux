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

import { formatTemperature, isUnattended } from '../../../packages/core/dist/index.js'

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
    fields.push({ label: 'start to finish', value: minutes(t.criticalPathDuration), tone: 'total' })
    fields.push({ label: 'hands-on', value: minutes(t.handsOn) })
    if (t.longestWalkAway > 0) {
      fields.push({ label: 'longest walk-away', value: minutes(t.longestWalkAway), tone: 'away' })
    }
    // A zero here is the honest answer for most of this corpus, and hiding it would be the
    // dishonest one — but it is not worth a whole field, so it becomes a sentence instead.
    if (t.parallelSaving > 0) {
      fields.push({ label: 'saved in parallel', value: minutes(t.parallelSaving), tone: 'saved' })
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
  if (t.basis !== 'none' && t.parallelSaving === 0 && plan.linearization.length > 1) {
    notes.push('nothing overlaps in this recipe — the steps run in order')
  }
  const note = notes.length ? `<p class="glance-note">${esc(notes.join(' · '))}</p>` : ''

  return `<div class="glance">${cells}</div>${legend}${note}`
}

// --- The chart ---------------------------------------------------------------------------------

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
      parts.push(
        `<label class="cell ing${cell.duplicate ? ' dup' : ''}" style="${area};${edgeStyle(cell.edges)}" data-row="${esc(cell.ref)}">` +
          `<input type="checkbox" class="tick" data-ing="${esc(cell.ref)}">` +
          `<span class="ing-text">${renderLeaf(leaf)}</span></label>`,
      )
      continue
    }

    const step = component.steps[cell.ref]
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

    parts.push(
      `<div class="cell step d${Math.min(cell.depth, 4)}${isUnattended(step.effort) ? ' unatt' : ''}" ` +
        `style="${area};${edgeStyle(cell.edges)}" data-fed-by="${esc(feedsOf(component, plan, cell.ref).join(' '))}">` +
        `${chips}<span class="step-text">${esc(step.text)}</span>${temp}${markFor(step, polarity)}</div>`,
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

function renderLeaf(leaf) {
  if (!leaf) return ''
  if (leaf.component) {
    return `<span class="ref">${esc(leaf.label ?? leaf.component)}</span>${leaf.note ? `<span class="note">${esc(leaf.note)}</span>` : ''}`
  }
  const q = leaf.quantity
    ? `<span class="qty">${esc(formatQuantityText(leaf.quantity))}</span>`
    : ''
  const note = leaf.note ? `<span class="note">${esc(leaf.note)}</span>` : ''
  return `${q}<span class="item">${esc(leaf.item)}</span>${note}`
}

/**
 * R6, applied. Unicode fractions, a non-breaking space between quantity and unit so `4 oz`
 * never breaks across lines, an en dash for ranges, and both metric and customary at equal
 * weight rather than one parenthesised as a footnote.
 */
function formatQuantityText(q) {
  const parts = []
  // `count` is the model's placeholder for "this ingredient has a number but no unit" \u2014 two
  // eggs, one artichoke. Printing it would render "2 count large eggs".
  const one = (m) =>
    m.unit === 'count' ? formatAmountText(m.amount) : `${formatAmountText(m.amount)}\u00a0${m.unit}`
  if (q.amount !== undefined) parts.push(one(q))
  else if (q.unit && q.unit !== 'count') parts.push(q.unit)
  if (q.of) parts.push(`(${one(q.of)} each)`)
  if (q.metric) parts.push(`/ ${one(q.metric)}`)
  return parts.join(' ')
}

const GLYPHS = [
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

function formatAmountText(amount) {
  if (amount && typeof amount === 'object') {
    return `${formatAmountText(amount.from)}\u2013${formatAmountText(amount.to)}`
  }
  const whole = Math.floor(amount)
  const rest = amount - whole
  if (rest < 1e-6) return String(whole)
  for (const [value, glyph] of GLYPHS) {
    if (Math.abs(rest - value) < 1e-3) return whole === 0 ? glyph : `${whole}${glyph}`
  }
  return String(Number(amount.toFixed(2)))
}

// --- The card -----------------------------------------------------------------------------------

export function renderCard(recipe, options = {}) {
  const components = recipe.components
    .map((component, i) => {
      const plan = recipe.plans[i]
      const title = component.title
        ? `<h3 class="component-title">${esc(component.title)}</h3>`
        : ''
      return `<section class="component">${title}<div class="scroller">${renderChart(component, plan, options)}</div></section>`
    })
    .join('')

  const main = recipe.plans[recipe.plans.length - 1]
  const source = recipe.source ? `<p class="src">${esc(recipe.source.name)}</p>` : ''

  // One rule per ingredient, so checking a box propagates through every region it feeds with no
  // JavaScript at all. `:has()` does the work a script would otherwise do.
  const rules = recipe.components
    .flatMap((c) => c.ingredients.map((l) => l.id))
    .map(
      (id) =>
        `.card:has(.tick[data-ing="${cssEscape(id)}"]:checked) [data-row="${cssEscape(id)}"]{opacity:.5}` +
        `.card:has(.tick[data-ing="${cssEscape(id)}"]:checked) [data-fed-by~="${cssEscape(id)}"]{--started:1}`,
    )
    .join('')

  return (
    `<article class="card">` +
    `<style>${rules}</style>` +
    `<header class="cardhead"><h2 class="card-title">${esc(recipe.title)}</h2>${source}` +
    (recipe.yield ? `<p class="yield">${esc(recipe.yield)}</p>` : '') +
    `</header>` +
    renderGlance(recipe, recipe.components[recipe.components.length - 1], main, options) +
    components +
    `</article>`
  )
}

function cssEscape(id) {
  return String(id).replace(/["\\]/g, '\\$&')
}

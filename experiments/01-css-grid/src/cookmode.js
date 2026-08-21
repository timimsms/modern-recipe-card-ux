/**
 * Cook mode — one step at a time, for a phone propped against a canister.
 *
 * The trap PHASE-04 names up front is that the easy mobile answer is to relinearize into a
 * numbered list, which throws away the entire reason this format exists. Three things keep this
 * from being that list:
 *
 *   - the mini-map, which shows where you are in the tree at all times;
 *   - inputs resolved to *named* prior results rather than "the previous step";
 *   - one-tap access to any other ready step, so the order is a suggestion and not a rail.
 *
 * PHASE-04 expected the parallelism banner to be the centrepiece — "the format's central
 * insight, delivered actively". Measured, it fires on **0 of 66 steps** in the corpus: there is
 * never anything a lone cook can start during a wait in these recipes. The code is correct and
 * a genuinely parallel recipe would use it, but nothing here may depend on it appearing.
 */

import {
  cookSchedule,
  isUnattended,
  outstandingSteps,
  resolveInputs,
  whileThisRuns,
} from '../../../packages/core/dist/index.js'
import { renderMiniMap, sharedScale } from './minimap.js'

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const UNITS = { sec: 's', min: 'm', hour: 'h', day: 'd' }

function duration(d) {
  if (!d) return ''
  const unit = UNITS[d.unit] ?? d.unit
  return d.max !== undefined && d.max !== d.min ? `${d.min}–${d.max}${unit}` : `${d.min}${unit}`
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

function amount(value) {
  if (value && typeof value === 'object') return `${amount(value.from)}–${amount(value.to)}`
  const whole = Math.floor(value)
  const rest = value - whole
  if (rest < 1e-6) return String(whole)
  for (const [fraction, glyph] of GLYPHS) {
    if (Math.abs(rest - fraction) < 1e-3) return whole === 0 ? glyph : `${whole}${glyph}`
  }
  return String(Number(value.toFixed(2)))
}

function quantity(q) {
  if (!q) return ''
  // R6: a non-breaking space, so "4 oz" never splits across lines. Written as an escape
  // rather than a literal, which lint cannot tell apart from an ordinary space.
  const one = (m) => (m.unit === 'count' ? amount(m.amount) : `${amount(m.amount)}\u00a0${m.unit}`)
  const parts = []
  if (q.amount !== undefined) parts.push(one(q))
  else if (q.unit && q.unit !== 'count') parts.push(q.unit)
  if (q.of) parts.push(`(${one(q.of)} each)`)
  if (q.metric) parts.push(`/ ${one(q.metric)}`)
  return parts.join(' ')
}

/**
 * Inputs, resolved. An ingredient shows its quantity because that is what you are about to
 * measure; a prior result shows its name because "step 4" is not something you can pick up.
 */
function renderInputs(component, stepId) {
  const inputs = resolveInputs(component, stepId)
  if (inputs.length === 0) return ''

  const items = inputs
    .map((input) => {
      if (input.kind === 'step') {
        return `<li class="from-step"><button type="button" class="jump" data-step="${esc(input.id)}">${esc(input.name)}</button></li>`
      }
      const leaf = input.leaf
      const label = leaf.component ? (leaf.label ?? leaf.component) : leaf.item
      const q = quantity(leaf.quantity)
      const note = leaf.note ? `<span class="note">${esc(leaf.note)}</span>` : ''
      return `<li><span class="qty">${esc(q)}</span> <span class="item">${esc(label)}</span>${note}</li>`
    })
    .join('')

  return `<ul class="inputs">${items}</ul>`
}

/**
 * "While this simmers, you can…" — the format's central insight delivered actively rather than
 * left to be inferred from geometry. Only ever shown for steps you can walk away from.
 */
function renderBanner(component, stepId, done) {
  const others = whileThisRuns(component, stepId, done)
  if (others.length === 0) return ''
  const chips = others
    .map(
      (id) =>
        `<button type="button" class="jump" data-step="${esc(id)}">${esc(component.steps[id].text)}</button>`,
    )
    .join('')
  return `<div class="banner"><span class="banner-lead">while this runs, you can</span>${chips}</div>`
}

export function renderCookMode(recipe, state) {
  const index = state.componentIndex ?? 0
  const component = recipe.components[index]
  const plan = recipe.plans[index]
  const done = state.done ?? new Set()
  const scale = sharedScale(recipe.plans, { width: 320, height: 130 })

  const schedule = cookSchedule(component)
  const order = schedule.order
  const current = state.current ?? order[0]
  const step = component.steps[current]

  // Position counts across the whole recipe, not within a component — "4 of 15" is what a cook
  // wants to know, and "1 of 12" after finishing three steps of mashed potatoes is a lie.
  const path = cookPathOf(recipe)
  const absolute = path.findIndex((p) => p.componentIndex === index && p.stepId === current)
  const position = absolute + 1
  const total = path.length

  const mark = isUnattended(step.effort)
    ? `<span class="cm-mark"><span aria-hidden="true">◷</span> ${esc(duration(step.duration) || 'you can walk away')}</span>`
    : duration(step.duration)
      ? `<span class="cm-mark quiet">${esc(duration(step.duration))}</span>`
      : ''

  // Any other ready step, one tap away. The order is a suggestion; the tree is the truth.
  // Same exclusions as the banner: nothing already behind you, and not the step this one is
  // blocking. Offering "heat" while covering a pie with potatoes is worse than offering nothing.
  const nextInOrder = order[order.indexOf(current) + 1]
  const alsoReady = outstandingSteps(component, current, done).filter((id) => id !== nextInOrder)
  const jumps = alsoReady
    .slice(0, 3)
    .map(
      (id) =>
        `<button type="button" class="jump ghost" data-step="${esc(id)}">${esc(component.steps[id].text)}</button>`,
    )
    .join('')

  const componentTitle =
    recipe.components.length > 1 && component.title
      ? `<span class="cm-component">${esc(component.title)}</span>`
      : ''

  return (
    `<article class="cookmode" data-step="${esc(current)}">` +
    `<header class="cm-head">` +
    `<span class="cm-count">${position} of ${total}</span>${componentTitle}` +
    `</header>` +
    `<div class="cm-body">` +
    `<p class="cm-text">${esc(step.text)}</p>${mark}` +
    renderInputs(component, current) +
    `</div>` +
    renderBanner(component, current, done) +
    `<div class="cm-map">${renderMiniMap(plan, { current, done, scale, interactive: true })}</div>` +
    (jumps ? `<div class="cm-jumps"><span class="banner-lead">or start</span>${jumps}</div>` : '') +
    `<div class="cm-nav">` +
    `<button type="button" class="cm-prev"${position <= 1 ? ' disabled' : ''}>Back</button>` +
    `<button type="button" class="cm-done">${done.has(current) ? 'Done ✓' : 'Mark done'}</button>` +
    `<button type="button" class="cm-next"${position >= total ? ' disabled' : ''}>Next</button>` +
    `</div>` +
    `</article>`
  )
}

/** The order cook mode walks, exposed so the harness can drive it. */
export function cookOrderOf(component) {
  return cookSchedule(component).order
}

/**
 * Every step of every component, in order, flattened.
 *
 * Cooking a two-component recipe means finishing the mashed potatoes and then starting the pie
 * — components are sequential, and the later one consumes the earlier one's output. Navigating
 * within a single component leaves the cook stranded at the end of the first.
 */
export function cookPathOf(recipe) {
  return recipe.components.flatMap((component, componentIndex) =>
    cookSchedule(component).order.map((stepId) => ({ componentIndex, stepId })),
  )
}

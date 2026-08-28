/**
 * Cook mode for the SVG track.
 *
 * The interesting move here is that the mini-map is *the same drawing*, scaled down. Tracks 01,
 * 02 and 04 each build a separate thumbnail renderer that draws coloured blocks; this track
 * re-runs `layoutDendrogram` at a smaller metric and gets the map for nothing, because an SVG
 * already knows how to be any size. PHASE-07 guessed the mini-map would be SVG's clearest win and
 * that looks right — it is the one place the substrate removes work instead of adding it.
 *
 * Everything about *what* to show still comes from core: `cookSchedule` for the order,
 * `resolveInputs` for named prior results, `completionAt` for the endings.
 */

import {
  completedIn,
  completionAt,
  cookSchedule,
  formatScaled,
  isUnattended,
  resolveInputs,
  scaleQuantity,
  stepKey,
  stepMinutes,
  stepsOf,
} from '../../../packages/core/dist/index.js'
import { layoutDendrogram } from './geometry.js'
import { renderDendrogram } from './render.js'

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

/** Every step of every component, flattened. Components are sequential. */
export function cookPath(recipe) {
  return recipe.components.flatMap((component, componentIndex) =>
    cookSchedule(component).order.map((stepId) => ({ componentIndex, stepId })),
  )
}

function progressByTime(recipe, done) {
  let total = 0
  let complete = 0
  for (const component of recipe.components) {
    for (const step of stepsOf(component)) {
      const minutes = stepMinutes(step)
      total += minutes
      if (done.has(stepKey(component, step.id))) complete += minutes
    }
  }
  return total === 0 ? 0 : complete / total
}

function inputLine(input, scale) {
  if (input.kind === 'step') return `<li class="from-step">${esc(input.name)}</li>`
  const leaf = input.leaf
  const label = leaf.component ? (leaf.label ?? leaf.component) : leaf.item
  const quantity = input.quantity ? formatScaled(scaleQuantity(input.quantity, scale)) : ''
  return `<li><span class="qty">${esc(quantity)}</span><span>${esc(label)}</span></li>`
}

/**
 * @param {object} recipe   with `plans`
 * @param {object} view     { at, scale, state, measure }
 */
export function renderCookMode(recipe, view) {
  const steps = cookPath(recipe)
  const here = steps[Math.min(view.at, steps.length - 1)]
  const component = recipe.components[here.componentIndex]
  const plan = recipe.plans[here.componentIndex]
  const step = component.steps[here.stepId]
  const key = stepKey(component, here.stepId)

  const done = completedIn(component, view.state)
  const completion = completionAt(recipe, here.componentIndex, view.state)
  const percent = Math.round(progressByTime(recipe, view.state.completedSteps) * 100)

  const inputs = resolveInputs(component, here.stepId)
    .map((input) => inputLine(input, view.scale))
    .join('')

  // The map: the same layout function, at a tenth of the size and with no text measured, because
  // no text is drawn. `viewBox` does the scaling, so nothing has to be re-laid-out to fit.
  const geometry = layoutDendrogram(component, plan, view.measure)
  const map = renderDendrogram(component, geometry, {
    title: `Recipe map: ${plan.linearization.length} steps, ${done.size} complete.`,
    minimap: { current: here.stepId, done, width: 320 },
  })

  const ending =
    completion.kind === 'none'
      ? ''
      : `<p class="ending ${completion.kind}" data-ending="${completion.kind}">` +
        `<span class="seal seal-${completion.kind === 'all' ? 'all' : 'part'}" aria-hidden="true"></span>` +
        (completion.kind === 'all'
          ? `<span><b>All done.</b> ${esc(recipe.title)} is finished.</span>`
          : `<span><b>${esc(completion.component.title ?? 'This part')} done</b> — part ` +
            `${completion.index + 1} of ${completion.of}. ` +
            `${esc(completion.next.title ?? 'The next part')} is next, and its map starts empty.</span>`) +
        `</p>`

  const mark = isUnattended(step.effort)
    ? `<span class="cm-mark">◷ ${esc(step.duration ? `${step.duration.min}${step.duration.unit}` : 'you can walk away')}</span>`
    : ''

  return (
    `<article class="card" data-card>` +
    `<header class="cm-head"><span data-count>${view.at + 1} of ${steps.length}</span>` +
    (recipe.components.length > 1 && component.title
      ? `<span>${esc(component.title)}</span>`
      : '') +
    `<span class="cm-progress" data-progress>${percent}% of the time</span></header>` +
    `<div class="cm-body"><p class="cm-text" data-step-text>${esc(step.text)}</p>${mark}` +
    `<ul class="inputs">${inputs}</ul></div>` +
    ending +
    `<div class="cm-map">${map}` +
    (recipe.components.length > 1
      ? `<span class="cm-part">part ${here.componentIndex + 1} of ${recipe.components.length}</span>`
      : '') +
    `</div>` +
    `<div class="cm-nav">` +
    `<button type="button" data-back${view.at === 0 ? ' disabled' : ''}>Back</button>` +
    `<button type="button" class="cm-done" data-done data-key="${esc(key)}">` +
    `${view.state.completedSteps.has(key) ? 'Done ✓' : 'Mark done'}</button>` +
    `<button type="button" data-next${view.at >= steps.length - 1 ? ' disabled' : ''}>Next</button>` +
    `</div></article>`
  )
}

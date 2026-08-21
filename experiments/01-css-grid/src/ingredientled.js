/**
 * Ingredient-led — the ladder's browsing rung.
 *
 * The ingredient column becomes the spine at full width, and each row says what becomes of it:
 * which step consumes it, and how far into the recipe that is. This is the "do I have this,
 * what am I buying, when does it get used" view, not the cooking one.
 *
 * PHASE-04 is openly sceptical of this rung — "a shopping-list feature wearing a layout
 * costume". Rendering it, the doubt looks justified on ingredients alone: a flat list with a
 * "used at step 7" note is a shopping list. What earns it a place, if anything does, is *depth*:
 * an ingredient consumed at the very end (paprika, garnish, flaky salt) behaves completely
 * differently in a kitchen from one consumed at the start, and no shopping list says so.
 * So depth is what this view encodes, and it should be judged on that.
 */

import { describeOutput } from '../../../packages/core/dist/index.js'

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

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
  // R6: non-breaking space, written as an escape so lint can tell it from a plain space.
  const one = (m) => (m.unit === 'count' ? amount(m.amount) : `${amount(m.amount)}\u00a0${m.unit}`)
  const parts = []
  if (q.amount !== undefined) parts.push(one(q))
  else if (q.unit && q.unit !== 'count') parts.push(q.unit)
  if (q.of) parts.push(`(${one(q.of)} each)`)
  if (q.metric) parts.push(`/ ${one(q.metric)}`)
  return parts.join(' ')
}

/** Which step consumes each leaf, and how deep into the recipe that step sits. */
function consumers(component, plan) {
  const byLeaf = new Map()
  for (const cell of plan.cells) {
    if (cell.kind !== 'step') continue
    const step = component.steps[cell.ref]
    for (const input of step.inputs) {
      if (input.kind !== 'ingredient') continue
      if (!byLeaf.has(input.id)) byLeaf.set(input.id, [])
      byLeaf.get(input.id).push({ id: cell.ref, depth: cell.depth })
    }
  }
  return byLeaf
}

export function renderIngredientLed(recipe) {
  const componentCount = recipe.components.length

  const sections = recipe.components
    .map((component, i) => {
      const plan = recipe.plans[i]
      const byLeaf = consumers(component, plan)
      const maxDepth = Math.max(1, plan.maxDepth)

      const rows = component.ingredients
        .map((leaf) => {
          const uses = byLeaf.get(leaf.id) ?? []
          const label = leaf.component ? (leaf.label ?? leaf.component) : leaf.item
          const q = quantity(leaf.quantity)
          const note = leaf.note ? `<span class="note">${esc(leaf.note)}</span>` : ''

          // Distance from the finished dish, as a proportion. A bar rather than a step number,
          // because "how near the end" is the thing a shopping list cannot tell you and the
          // only reason this view is not one.
          const nearest = uses.reduce((best, u) => Math.min(best, u.depth), Infinity)
          const within = uses.length === 0 ? 0 : 1 - nearest / (maxDepth + 1)

          // Scaled across the whole recipe, not the component. Components are sequential, so
          // the last step of the mashed potatoes is only halfway through shepherd's pie —
          // per-component depth marked its salt and white pepper "at the end", which is exactly
          // backwards for something you make first.
          const progress = (i + within) / componentCount

          const usedIn = uses
            .map((u) => esc(component.steps[u.id].outputName ?? component.steps[u.id].text))
            .join(', ')
          const late = progress > 0.85 ? ' late' : ''

          return (
            `<li class="il-row${late}">` +
            `<label class="il-name"><input type="checkbox" class="tick" data-ing="${esc(leaf.id)}">` +
            `<span class="qty">${esc(q)}</span> <span class="item">${esc(label)}</span>${note}</label>` +
            `<span class="il-when"><span class="il-bar" style="--at:${progress.toFixed(3)}"></span>` +
            `<span class="il-step">${usedIn || 'unused'}</span></span>` +
            `</li>`
          )
        })
        .join('')

      const title =
        recipe.components.length > 1 && component.title
          ? `<h3 class="component-title">${esc(component.title)}</h3>`
          : ''
      return `${title}<ul class="il-list">${rows}</ul>`
    })
    .join('')

  return (
    `<article class="card ingredient-led">` +
    `<header class="cardhead"><h2 class="card-title">${esc(recipe.title)}</h2>` +
    `<p class="src">what you need, and when it gets used</p></header>` +
    sections +
    `</article>`
  )
}

/** A named intermediate reads better than instruction text in a list of things. */
export function usedInLabel(component, stepId) {
  return component.steps[stepId]?.outputName ?? describeOutput(component, stepId)
}

/**
 * Everything both variants need that is not a component.
 *
 * Shared *within* the track on purpose: PHASE-07 wants the same renderer design across
 * frameworks, so the corpus list, the loading, the cell geometry and the harness marks are
 * identical by construction and cannot drift into a difference that looks like a framework
 * difference.
 *
 * What is deliberately *not* here is anything reactive. That is the whole experiment.
 */

import {
  cookSchedule,
  createStore,
  formatScaled,
  ingredientKey,
  isUnattended,
  layout,
  normalizeRecipe,
  scaleQuantity,
  stepKey,
  stepMinutes,
  stepsOf,
} from '@recipe/core'

/**
 * One store, shared by both variants — and it is the *same* store every other track binds.
 *
 * PHASE-05 put it in core precisely so the bake-off measures rendering rather than someone's
 * taste in state management. What differs between Svelte and Solid is only the adapter that makes
 * it reactive: a handful of lines each, and the thing PHASE-08 counts.
 */
export const store = createStore()

export const RECIPES = [
  'espresso-brownies',
  'no-knead-bread',
  'shepherds-pie',
  'beef-stroganoff',
  'grilled-artichokes',
  'spinach-artichoke-skillet',
  'braised-short-ribs',
  'fennel-citrus-salad',
  'bbq-pulled-chicken',
]

export const FIXTURES = [
  'long-text',
  'unicode',
  'wide-shallow',
  'deep-narrow',
  'reuse-split',
  'degenerate',
]

export const SCALES = [
  ['0.5', 'half'],
  ['1', 'as written'],
  ['2', 'double'],
  ['3', 'triple'],
]

export async function load(slug) {
  // Relative, not root-relative. The dist page sits at experiments/<track>/dist/, so this
  // resolves to /packages/corpus/… on the local server *and* under a GitHub Pages project
  // subpath — a root-relative URL would escape the subpath and 404 in production only.
  const response = await fetch(`../../../packages/corpus/${slug}.json`)
  if (!response.ok) throw new Error(`${slug} → ${response.status}`)
  const recipe = normalizeRecipe(await response.json())
  return { slug, recipe, plans: recipe.components.map((c) => layout(c)) }
}

const EDGE = { none: '0px', hairline: '1px', rule: '1.5px', heavy: '2.5px' }

/** Grid placement and border weights for one cell, as a style object. */
export function cellStyle(cell, preludeRows) {
  const row = cell.row + preludeRows + 1
  const col = cell.col + 1
  return (
    `grid-area:${row}/${col}/${row + cell.rowSpan}/${col + cell.colSpan};` +
    `border-top-width:${EDGE[cell.edges.top]};border-right-width:${EDGE[cell.edges.right]};` +
    `border-bottom-width:${EDGE[cell.edges.bottom]};border-left-width:${EDGE[cell.edges.left]}`
  )
}

export function chartStyle(plan, preludeRows) {
  return (
    `grid-template-columns:minmax(13rem,22rem) repeat(${plan.columnCount - 1},minmax(6.5rem,20rem));` +
    `grid-template-rows:repeat(${plan.rows + preludeRows},auto)`
  )
}

export function depthClass(depth, maxDepth) {
  if (maxDepth <= 0) return 'd0'
  return `d${Math.min(4, Math.round((depth / maxDepth) * 4))}`
}

export function leafOf(component, ref) {
  return component.ingredients.find((l) => l.id === ref)
}

export function leafParts(leaf, scale) {
  if (!leaf) return { quantity: '', label: '', note: undefined }
  const label = leaf.component ? (leaf.label ?? leaf.component) : leaf.item
  return {
    quantity: leaf.quantity ? formatScaled(scaleQuantity(leaf.quantity, scale)) : '',
    label,
    note: leaf.note,
  }
}

export function stepMark(step) {
  if (!isUnattended(step.effort)) return ''
  return `◷ ${step.duration ? `${step.duration.min}${step.duration.unit}` : 'walk away'}`
}

export { ingredientKey }

/**
 * The harness marks, by convention rather than by import — a track that imports the harness is
 * measuring itself, and dependency-cruiser enforces it. See packages/harness/src/protocol.ts.
 */
export function markStart() {
  performance.mark('recipe:render:start')
}

export function markEnd() {
  performance.mark('recipe:render:end')
  const first = performance.getEntriesByName('recipe:first-render').length === 0
  try {
    performance.measure(
      first ? 'recipe:first-render' : 'recipe:render',
      'recipe:render:start',
      'recipe:render:end',
    )
  } catch {
    // A render with no start mark is not one Phase 08 is asking about.
  }
}

// --- Cook mode -----------------------------------------------------------------------------------
// Shared by both variants for the same reason everything else here is: the logic must be identical
// so that any difference between them is the reactivity model.

/** Every step of every component, flattened. Components are sequential; the pie eats the potatoes. */
export function cookPath(recipe) {
  return recipe.components.flatMap((component, componentIndex) =>
    cookSchedule(component).order.map((stepId) => ({ componentIndex, stepId })),
  )
}

/**
 * Completion weighted by time rather than step count — R7. Four of five steps done reads as
 * "nearly there" and is wrong when the fifth is a three-hour braise.
 */
export function progressByTime(recipe, done) {
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

export function inputParts(input, scale) {
  if (input.kind === 'step') return { kind: 'step', name: input.name }
  const leaf = input.leaf
  return {
    kind: 'ingredient',
    quantity: input.quantity ? formatScaled(scaleQuantity(input.quantity, scale)) : '',
    label: leaf.component ? (leaf.label ?? leaf.component) : leaf.item,
  }
}

/** Mini-map cell placement and state, so both variants draw the identical thumbnail. */
export function miniCells(plan, current, done) {
  return plan.cells
    .filter((c) => c.kind !== 'filler')
    .map((c) => ({
      key: `${c.kind}-${c.row}-${c.col}`,
      ref: c.kind === 'step' ? c.ref : undefined,
      state:
        c.kind === 'ingredient'
          ? 'mm-leaf'
          : c.ref === current
            ? 'mm-now'
            : done.has(c.ref)
              ? 'mm-done'
              : 'mm-todo',
      style: `grid-area:${c.row + 1}/${c.col + 1}/${c.row + 1 + c.rowSpan}/${c.col + 1 + c.colSpan}`,
    }))
}

export { stepKey }

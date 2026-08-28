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
  formatScaled,
  ingredientKey,
  isUnattended,
  layout,
  normalizeRecipe,
  scaleQuantity,
} from '@recipe/core'

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
  const response = await fetch(`/packages/corpus/${slug}.json`)
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

/**
 * Track 01 entry point.
 *
 * Fetches a corpus recipe, normalises it, lays it out, and drops the rendered markup in. No
 * bundler, no framework, no build step for this track — `@recipe/core` is loaded straight from
 * its emitted `dist/`, exactly as PHASE-00 required it to be.
 */

import { layout, normalizeRecipe } from '../../../packages/core/dist/index.js'
import { renderCard } from './render.js'

const RECIPES = [
  'espresso-brownies',
  'no-knead-bread',
  'shepherds-pie',
  'beef-stroganoff',
  'grilled-artichokes',
  'spinach-artichoke-skillet',
  'braised-short-ribs',
  'fennel-citrus-salad',
]

const FIXTURES = [
  'long-text',
  'unicode',
  'wide-shallow',
  'deep-narrow',
  'reuse-split',
  'degenerate',
]

const root = document.getElementById('cards')
const picker = document.getElementById('recipe')
const strategy = document.getElementById('strategy')
const reuse = document.getElementById('reuse')
const markRule = document.getElementById('markrule')

for (const group of [
  { label: 'recipes', items: RECIPES, dir: 'recipes' },
  { label: 'fixtures', items: FIXTURES, dir: 'fixtures/valid' },
]) {
  const optgroup = document.createElement('optgroup')
  optgroup.label = group.label
  for (const slug of group.items) {
    const option = document.createElement('option')
    option.value = `${group.dir}/${slug}`
    option.textContent = slug
    optgroup.append(option)
  }
  picker.append(optgroup)
}

async function show() {
  const path = picker.value
  // Relative to this module, which lives at experiments/01-css-grid/src/.
  const url = new URL(`../../../packages/corpus/${path}.json`, import.meta.url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url.pathname} → ${response.status}`)
  const recipe = normalizeRecipe(await response.json())
  recipe.plans = recipe.components.map((c) =>
    layout(c, { columns: strategy.value, reuse: reuse.value }),
  )
  root.innerHTML = renderCard(recipe, { markRule: markRule.value })
  document.title = `${recipe.title} — track 01`
}

// A blank page with a silent console is the worst possible failure mode for a study you are
// meant to look at, so say what broke, on the page.
async function refresh() {
  try {
    await show()
  } catch (error) {
    root.innerHTML = `<pre class="failure">${error.stack ?? error.message}</pre>`
    throw error
  }
}

for (const control of [picker, strategy, reuse, markRule])
  control.addEventListener('change', refresh)

const theme = document.getElementById('theme')
theme.addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.value)
})
// Start from what the viewer is actually seeing. A control that reads "light" on a dark page is
// worse than no control.
theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
document.documentElement.setAttribute('data-theme', theme.value)

picker.value = 'recipes/espresso-brownies'
await refresh()

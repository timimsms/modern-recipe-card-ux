/**
 * Track 01 entry point.
 *
 * Fetches a corpus recipe, normalises it, lays it out, and drops the rendered markup in. No
 * bundler, no framework, no build step for this track — `@recipe/core` is loaded straight from
 * its emitted `dist/`, exactly as PHASE-00 required it to be.
 */

import { layout, normalizeRecipe } from '../../../packages/core/dist/index.js'
import { renderCard } from './render.js'
import { renderMiniMap, sharedScale } from './minimap.js'

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
const ramp = document.getElementById('ramp')
const view = document.getElementById('view')

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
  root.innerHTML =
    view.value === 'filmstrip'
      ? renderFilmstrip(recipe)
      : renderCard(recipe, { markRule: markRule.value, ramp: ramp.value })
  document.title = `${recipe.title} — track 01`
}

/**
 * One mini-map per step, in cook order, with everything before it marked done.
 *
 * A single mini-map always looks fine. The question is whether *position* reads across a whole
 * recipe — whether a cook glancing down at step 7 of 12 can tell where they are without
 * studying it — and that only shows up when you see the frames in sequence.
 */
function renderFilmstrip(recipe) {
  const frames = []
  const scale = sharedScale(recipe.plans)
  for (const [i, component] of recipe.components.entries()) {
    const plan = recipe.plans[i]
    const done = new Set()
    for (const id of plan.linearization) {
      const text = component.steps[id].text || id
      frames.push(
        `<figure class="frame">${renderMiniMap(plan, { current: id, done: new Set(done), scale })}` +
          `<figcaption><b>${done.size + 1}/${plan.linearization.length}</b> ${escapeText(text)}</figcaption></figure>`,
      )
      done.add(id)
    }
  }
  return `<div class="card"><div class="filmstrip">${frames.join('')}</div></div>`
}

const escapeText = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

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

for (const control of [picker, strategy, reuse, markRule, ramp, view])
  control.addEventListener('change', refresh)

// R5 claims colour is never the only channel. Checking that should not require devtools, and
// greyscale is also the closest thing to a print preview without a printer — so it desaturates
// the card only, leaving the controls legible, the way the page would actually print.
document.getElementById('grey').addEventListener('change', (e) => {
  root.classList.toggle('grey', e.target.checked)
})

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

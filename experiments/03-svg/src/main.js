/**
 * Track 03 entry point — the SVG dendrogram.
 *
 * Same `GridPlan` as every other track, same corpus, no bundler. The renderer is a pure
 * `plan → string` function, so all this file does is fetch, measure, and put the result on
 * the page.
 */

import { createStore, layout, normalizeRecipe } from '../../../packages/core/dist/index.js'
import { layoutDendrogram } from './geometry.js'
import { renderDendrogram } from './render.js'
import { cookPath, renderCookMode } from './cookmode.js'

/**
 * The store adapter, in full: one subscription that redraws.
 *
 * With no framework there is no reactivity to adapt *to* — the whole binding is "when it changes,
 * draw again". That is the shortest adapter of the four and the least clever, and it is worth
 * recording as such: the framework tracks each spend four to six lines teaching their reactivity
 * system about an external store, and this one spends one.
 */
const store = createStore()

const RECIPES = [
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

/**
 * Text measurement, through a canvas rather than the DOM.
 *
 * `measureText` needs no layout pass and no element in the tree, so a chart with sixty labels
 * costs sixty calls rather than sixty reflows. It is also the part of this track with no
 * counterpart in track 01, where the browser does all of it and is never asked.
 */
const surface = document.createElement('canvas').getContext('2d')
const widths = new Map()

function measure(text, font) {
  const key = `${font} ${text}`
  let width = widths.get(key)
  if (width === undefined) {
    surface.font = font
    width = surface.measureText(text).width
    widths.set(key, width)
  }
  return width
}

let current = null
let firstRenderDone = false
let at = 0
let slug = 'recipes/espresso-brownies'

const escapeText = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

async function show() {
  const path = picker.value
  const url = new URL(`../../../packages/corpus/${path}.json`, import.meta.url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url.pathname} → ${response.status}`)

  const recipe = normalizeRecipe(await response.json())
  recipe.plans = recipe.components.map((c) => layout(c))
  current = recipe
  at = 0
  store.reset()
  draw(path)
}

function draw(which = slug) {
  slug = which
  const recipe = current
  if (!recipe) return

  // The harness reads these back by name — see packages/harness/src/protocol.ts. Plain marks
  // rather than an import, because a track that imports the harness is measuring itself.
  performance.mark('recipe:render:start')

  if (view.value === 'cook') {
    root.innerHTML = renderCookMode(recipe, { at, scale: 1, state: store.get(), measure })
    root.dataset.recipe = slug
    document.title = `${recipe.title} — track 03`
    finishRender()
    return
  }

  const sections = recipe.components
    .map((component, i) => {
      const geometry = layoutDendrogram(component, recipe.plans[i], measure)
      const title = recipe.components.length > 1 ? component.title : undefined
      // tabindex, because the chart is wider than the card and scrolls: a scrollable region a
      // keyboard cannot reach is content a keyboard user cannot see. Axe flags it as
      // scrollable-region-focusable, and it was this track's one violation.
      return (
        `<section class="component" tabindex="0" role="region" ` +
        `aria-label="${escapeText(title ?? recipe.title)} chart">` +
        (title ? `<h3 class="component-title">${escapeText(title)}</h3>` : '') +
        renderDendrogram(component, geometry, { title: title ?? recipe.title }) +
        `</section>`
      )
    })
    .join('')

  root.innerHTML =
    `<article class="card" data-card>` +
    `<header class="cardhead"><h2 class="card-title">${escapeText(recipe.title)}</h2>` +
    (recipe.source ? `<p class="src">${escapeText(recipe.source.name)}</p>` : '') +
    `</header>${sections}</article>`

  root.dataset.recipe = slug
  document.title = `${recipe.title} — track 03`
  finishRender()
}

function finishRender() {
  performance.mark('recipe:render:end')
  performance.measure(
    firstRenderDone ? 'recipe:render' : 'recipe:first-render',
    'recipe:render:start',
    'recipe:render:end',
  )
  firstRenderDone = true
}

// The whole store binding.
store.subscribe(() => draw())

root.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element) || !current) return

  const done = target.closest('[data-done]')
  if (done) {
    store.toggleStep(done.dataset.key)
    return
  }
  if (target.closest('[data-back]')) {
    at = Math.max(0, at - 1)
    draw()
    return
  }
  if (target.closest('[data-next]')) {
    const steps = cookPath(current)
    const here = steps[Math.min(at, steps.length - 1)]
    const key = `${current.components[here.componentIndex].id}/${here.stepId}`
    // Moving on *is* finishing: otherwise the map never fills as you cook.
    if (!store.get().completedSteps.has(key)) store.toggleStep(key)
    at = Math.min(steps.length - 1, at + 1)
    draw()
  }
})

view.addEventListener('change', () => draw())

// A blank page with a silent console is the worst failure mode for something meant to be looked
// at, so say what broke, on the page.
async function refresh() {
  try {
    await show()
  } catch (error) {
    root.innerHTML = `<pre class="failure">${escapeText(error.stack ?? error.message)}</pre>`
    throw error
  }
}

picker.addEventListener('change', refresh)

const theme = document.getElementById('theme')
theme.addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.value)
})
// Start from what the viewer is actually seeing, as track 01 does.
theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
document.documentElement.setAttribute('data-theme', theme.value)

picker.value = 'recipes/espresso-brownies'
await refresh()

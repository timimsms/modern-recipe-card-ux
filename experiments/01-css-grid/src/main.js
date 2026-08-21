/**
 * Track 01 entry point.
 *
 * Fetches a corpus recipe, normalises it, lays it out, and drops the rendered markup in. No
 * bundler, no framework, no build step for this track — `@recipe/core` is loaded straight from
 * its emitted `dist/`, exactly as PHASE-00 required it to be.
 */

import { condense, layout, normalizeRecipe } from '../../../packages/core/dist/index.js'
import { renderIngredientLed } from './ingredientled.js'
import { renderCard } from './render.js'
import { renderMiniMap, sharedScale } from './minimap.js'
import { cookOrderOf, cookPathOf, renderCookMode } from './cookmode.js'

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
  current = recipe
  cook = { componentIndex: 0, current: undefined, done: new Set() }
  draw()
}

/**
 * Cook-mode state lives here rather than in the renderer, because Phase 04's transition and
 * Phase 05's persistence both need one model behind two views — check-off in cook mode has to
 * fill the same regions in the chart.
 */
let current = null
let cook = { componentIndex: 0, current: undefined, done: new Set() }

function draw() {
  const recipe = current
  if (!recipe) return
  const options = { markRule: markRule.value, ramp: ramp.value }
  root.innerHTML =
    view.value === 'filmstrip'
      ? renderFilmstrip(recipe)
      : view.value === 'cook'
        ? renderCookMode(recipe, cook)
        : view.value === 'ingredients'
          ? renderIngredientLed(recipe)
          : view.value === 'condensed'
            ? (({ recipe: r, microList }) => renderCard(r, { ...options, microList }))(
                condensedOf(recipe),
              )
            : renderCard(recipe, options)
  document.title = `${recipe.title} — track 01`
}

/**
 * The condensed rung: single-file runs collapsed until the chart fits six columns, the critical
 * path last. The transform runs on the component and the result goes back through `layout()`,
 * so the condensed chart is a real plan with every invariant intact — not a special rendering
 * mode with its own geometry rules.
 */
function condensedOf(recipe) {
  const components = []
  const plans = []
  const microList = new Map()

  for (const [i, component] of recipe.components.entries()) {
    const full = recipe.plans[i]
    const keep = new Set(full.criticalPath)
    const { component: small, merged } = condense(component, { maxColumns: 6, keep })
    components.push(small)
    plans.push(layout(small, { columns: strategy.value, reuse: reuse.value }))

    // Each part of a collapsed run gets the rows it *adds*, not the rows it covers. A chain
    // nests — each step spans everything before it plus its own new ingredients — so laying the
    // parts out by their full bands would stack six overlapping blocks. The difference between
    // consecutive bands is exactly the ingredients that step introduced, which is what the
    // micro-list should sit against.
    const bandOf = new Map(full.cells.filter((c) => c.kind === 'step').map((c) => [c.ref, c]))
    for (const [survivor, originals] of merged) {
      if (originals.length < 2) continue
      let coveredTop = null
      let coveredBottom = null
      const parts = []
      for (const id of originals) {
        const cell = bandOf.get(id)
        if (!cell) continue
        const top = cell.row
        const bottom = cell.row + cell.rowSpan - 1
        const newTop = coveredTop === null ? top : coveredBottom + 1
        const newBottom = bottom
        if (newTop <= newBottom) {
          parts.push({
            row: newTop,
            rowSpan: newBottom - newTop + 1,
            text: component.steps[id].text,
          })
        }
        coveredTop = coveredTop === null ? top : Math.min(coveredTop, top)
        coveredBottom = coveredBottom === null ? bottom : Math.max(coveredBottom, bottom)
      }
      if (parts.length > 1) microList.set(survivor, parts)
    }
  }
  return { recipe: { ...recipe, components, plans }, microList }
}

/**
 * Cook-mode navigation. Delegated from the root so a redraw never leaves a dead listener, and
 * every control is a real button so the whole thing works from a keyboard.
 */
root.addEventListener('click', (event) => {
  if (!current || view.value !== 'cook') return
  const target = event.target
  if (!(target instanceof Element)) return

  const jump = target.closest('.jump, .minimap button')
  if (jump) {
    cook.current = jump.dataset.step
    draw()
    return
  }

  // Navigation runs over the whole recipe, so the last step of one component leads into the
  // first of the next rather than dead-ending.
  const path = cookPathOf(current)
  const order = cookOrderOf(current.components[cook.componentIndex])
  const here = cook.current ?? order[0]
  const at = Math.max(
    0,
    path.findIndex((p) => p.componentIndex === cook.componentIndex && p.stepId === here),
  )
  const goTo = (index) => {
    const target = path[Math.max(0, Math.min(path.length - 1, index))]
    cook.componentIndex = target.componentIndex
    cook.current = target.stepId
  }

  if (target.closest('.cm-next')) {
    // Moving on *is* finishing the step, so Next marks it done. Without this the mini-map never
    // fills in as you cook — you walk the whole recipe and it still shows nothing complete,
    // which is the one job it has.
    cook.done.add(here)
    goTo(at + 1)
  } else if (target.closest('.cm-prev')) {
    goTo(at - 1)
  } else if (target.closest('.cm-done')) {
    // Toggling rather than one-way: the commonest kitchen mistake is a mis-tap.
    if (cook.done.has(here)) cook.done.delete(here)
    else cook.done.add(here)
  } else {
    return
  }
  draw()
})

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

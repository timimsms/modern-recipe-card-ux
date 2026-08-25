/**
 * Track 01 entry point.
 *
 * Fetches a corpus recipe, normalises it, lays it out, and drops the rendered markup in. No
 * bundler, no framework, no build step for this track — `@recipe/core` is loaded straight from
 * its emitted `dist/`, exactly as PHASE-00 required it to be.
 */

import {
  condense,
  createStore,
  ingredientKey,
  layout,
  narrate,
  normalizeRecipe,
  stepKey,
  stepMinutes,
} from '../../../packages/core/dist/index.js'
import { SHORTCUTS, describeCell, installKeyboard } from './keyboard.js'
import { renderIngredientLed } from './ingredientled.js'
import { renderCard } from './render.js'
import { renderMiniMap, sharedScale } from './minimap.js'
import { cookOrderOf, cookPathOf, formatRemaining, renderCookMode } from './cookmode.js'

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
const polite = document.getElementById('say-polite')
const urgent = document.getElementById('say-urgent')
const picker = document.getElementById('recipe')
const scaleControl = document.getElementById('scale')
const scaleAny = document.getElementById('scale-any')
const units = document.getElementById('units')
const checkoff = document.getElementById('checkoff')
const undoButton = document.getElementById('undo')
const startOver = document.getElementById('startover')
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

/**
 * Loads the picked recipe and lays it out.
 *
 * Two things this deliberately does *not* do.
 *
 * It does not reset progress unless the recipe actually changed. `strategy` and `reuse` come
 * through here too because they change the plan, and resetting on those meant switching from
 * right-packed to left-packed threw away every box you had ticked — the same bug as the view
 * switch, one layer down.
 *
 * And it does not let a slow load overwrite a newer one. The fetch is async, so a tap on a step
 * cell during a load opened cook mode correctly and was then clobbered by the load completing
 * and resetting the cursor. Guarding on a token makes the last request the one that wins.
 */
let loadToken = 0

async function show() {
  const path = picker.value
  const token = ++loadToken
  // Relative to this module, which lives at experiments/01-css-grid/src/.
  const url = new URL(`../../../packages/corpus/${path}.json`, import.meta.url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url.pathname} → ${response.status}`)
  const recipe = normalizeRecipe(await response.json())
  if (token !== loadToken) return

  recipe.plans = recipe.components.map((c) =>
    layout(c, { columns: strategy.value, reuse: reuse.value }),
  )
  const changed = path !== currentSlug
  current = recipe
  currentSlug = path
  if (changed) {
    store.reset()
    cook = { componentIndex: 0, current: undefined }
    restore(path)
  }
  draw()
}

// --- Persistence -------------------------------------------------------------------------------

/**
 * Cooking is not a browsing session. A phone on a counter locks, a floury thumb hits back, a tab
 * gets closed to look something up — and losing an hour of check-offs to any of those is the
 * difference between a card you cook from and a card you look at.
 *
 * Keyed by recipe, so the bread you started yesterday is still where you left it after a detour
 * through the brownies. Timers are deliberately *not* saved: a countdown restored from disk is a
 * countdown that has been running while the tab was shut, and resuming one silently is how you
 * get told a braise has forty minutes left when it has been out of the oven since Tuesday.
 */
const KEY = 'track01:progress'
let currentSlug = null

function persist() {
  if (!currentSlug) return
  const state = store.get()
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    all[currentSlug] = {
      ingredients: [...state.checkedIngredients],
      steps: [...state.completedSteps],
      scale: state.scale,
      unitSystem: state.unitSystem,
    }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // A full or disabled localStorage must not take the card down with it. Losing progress is
    // a bad afternoon; a blank page is a broken study.
  }
}

function restore(slug) {
  let saved
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')[slug]
  } catch {
    return
  }
  if (!saved) return
  store.update((state) => ({
    ...state,
    checkedIngredients: new Set(saved.ingredients ?? []),
    completedSteps: new Set(saved.steps ?? []),
    scale: saved.scale ?? 1,
    unitSystem: saved.unitSystem ?? 'both',
  }))
  syncScaleControls()
  units.value = store.get().unitSystem
}

/**
 * One model, every view.
 *
 * The chart and cook mode were keeping separate notions of "done" — the chart tracked which
 * ingredients had been gathered, cook mode tracked which steps were finished, and neither knew
 * about the other. Switching views silently threw your progress away.
 *
 * This is now `createStore()` from core rather than a pair of Sets held here, so scale, units,
 * timers and check-off are one object that every view reads. The binding below is the whole of
 * this track's adapter — PHASE-05 says a large adapter is itself a finding, and at ~20 lines
 * this one says the store's shape is right.
 */
const store = createStore()
store.subscribe(() => {
  undoButton.disabled = !store.canUndo()
  scheduleDraw()
})

/**
 * Coalesced redraw.
 *
 * Every store mutation notifies, and a single tap on Next both marks a step done and moves the
 * cursor — two notifications, two full re-renders, and the first of them drawn at the *old*
 * position. Deferring to a microtask collapses them; a synchronous `draw()` clears the flag so
 * the FLIP transition, which has to measure between two renders, is never chased by a stale one.
 */
let pendingDraw = false
function scheduleDraw() {
  if (pendingDraw) return
  pendingDraw = true
  queueMicrotask(() => {
    if (pendingDraw) draw()
  })
}

let current = null
let cook = { componentIndex: 0, current: undefined }

function draw() {
  pendingDraw = false
  const recipe = current
  if (!recipe) return
  const state = store.get()
  const options = {
    markRule: markRule.value,
    ramp: ramp.value,
    doneSteps: state.completedSteps,
    checkedIngredients: state.checkedIngredients,
    timers: state.timers,
    scale: state.scale,
    unitSystem: state.unitSystem,
    // The chart draws the same part-done / all-done marks cook mode does.
    state,
  }
  root.innerHTML =
    view.value === 'narrative'
      ? renderNarrative(recipe, state)
      : view.value === 'filmstrip'
        ? renderFilmstrip(recipe)
        : view.value === 'cook'
          ? renderCookMode(recipe, {
              ...cook,
              state,
              progress: recipeProgress(recipe, state),
              scale: state.scale,
              unitSystem: state.unitSystem,
              store,
            })
          : view.value === 'ingredients'
            ? renderIngredientLed(recipe, options)
            : view.value === 'condensed'
              ? (({ recipe: r, microList }) => renderCard(r, { ...options, microList }))(
                  condensedOf(recipe),
                )
              : renderCard(recipe, options)
  document.title = `${recipe.title} — track 01`
  // Which recipe is actually on screen. The fetch is async, so "a .card exists" only means *a*
  // recipe is rendered — a harness that waits on that reads the previous one and races.
  root.dataset.recipe = currentSlug ?? ''
  persist()
  tick()
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
/**
 * Ingredient check-off stays a pure-CSS `:has()` affair so the chart still works with no
 * JavaScript at all; this only mirrors it into shared state so the other views can see it.
 */
root.addEventListener('change', (event) => {
  const box = event.target
  if (!(box instanceof Element) || !box.matches('.tick')) return
  // The checkbox has already flipped itself; this only mirrors it into shared state. Going
  // through `toggleIngredient` rather than setting a Set directly is what puts it on the undo
  // stack, which is the whole point of routing every mutation through the store.
  // `data-ing` already carries the component-qualified key, so this passes it straight on.
  store.toggleIngredient(box.dataset.ing)
  // The resulting state, not the action. "Checked" tells you what you did; a cook who has just
  // mis-tapped needs to know what is now true.
  say(`${describeCell(box)}: ${box.checked ? 'gathered' : 'not gathered'}.`)
})

/**
 * Chart → cook mode, expanding the tapped cell into the card it becomes.
 *
 * The point is not decoration: the reader has just picked a cell out of a chart they understand,
 * and arriving somewhere unrelated costs them that understanding. The cell grows into the card,
 * and backing out puts it back where it was.
 */
root.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  if (view.value !== 'cook') {
    const cell = target.closest('.step[data-step]')
    if (!current || !cell) return
    openCookMode(cell)
    return
  }

  if (target.closest('.cm-back')) {
    view.value = 'chart'
    draw()
    return
  }

  if (!current) return

  // Timers. Started by hand, because arriving at a step does not mean the pan is on.
  const start = target.closest('.cm-timer-start')
  if (start) {
    const key = start.dataset.timer
    const component = current.components[cook.componentIndex]
    alerted.delete(key)
    // The tap that starts a timer is the one moment asking for notification permission has an
    // obvious reason, so it is the only moment we ask. A refusal is permanent, and the beep
    // works without it.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    store.startTimer(key, component.steps[key.slice(component.id.length + 1)])
    return
  }
  const stop = target.closest('.cm-timer-stop')
  if (stop) {
    alerted.delete(stop.dataset.timerStop)
    store.stopTimer(stop.dataset.timerStop)
    return
  }

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
    const key = stepKey(current.components[cook.componentIndex], here)
    if (!store.get().completedSteps.has(key))
      completeStep(current.components[cook.componentIndex], here)
    goTo(at + 1)
  } else if (target.closest('.cm-prev')) {
    goTo(at - 1)
  } else if (target.closest('.cm-done')) {
    // Toggling rather than one-way: the commonest kitchen mistake is a mis-tap.
    completeStep(current.components[cook.componentIndex], here)
  } else {
    return
  }
  draw()
})

// A step cell is a control, so the keyboard has to reach it.
root.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const cell = event.target instanceof Element ? event.target.closest('.step[data-step]') : null
  if (!cell || view.value === 'cook') return
  event.preventDefault()
  openCookMode(cell)
})

/**
 * FLIP: measure where the cell is, switch views, measure where the card landed, then play the
 * difference backwards. Animating layout properties would reflow on every frame; a transform
 * does not touch layout at all.
 */
function openCookMode(cell) {
  const stepId = cell.dataset.step
  const componentIndex = [...root.querySelectorAll('.component')].findIndex((c) => c.contains(cell))

  const from = cell.getBoundingClientRect()
  cook.componentIndex = Math.max(0, componentIndex)
  cook.current = stepId
  view.value = 'cook'
  draw()

  const card = root.querySelector('.cookmode')
  if (!card) return

  // Reduced motion still needs the positional relationship, so it cross-fades in place rather
  // than teleporting — the difference is that nothing flies across the screen.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' })
    return
  }

  const to = card.getBoundingClientRect()
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const sx = Math.max(0.05, from.width / to.width)
  const sy = Math.max(0.05, from.height / to.height)

  card.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.4 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  )
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

/**
 * Only the controls that change the *plan* re-fetch and re-lay-out. The rest are rendering
 * options and need nothing but a redraw.
 *
 * They were all wired to `refresh()`, which re-runs `show()` — and `show()` resets the store.
 * So switching from cook mode to the chart to see where you were threw away your place, your
 * timers, and (before persistence) every box you had ticked. Switching a *view* is the one
 * moment a cook most wants their state kept.
 */
for (const control of [picker, strategy, reuse]) control.addEventListener('change', refresh)
for (const control of [markRule, ramp, checkoff]) control.addEventListener('change', draw)

/**
 * The Phase 04 ladder swaps the whole presentation. Doing that silently leaves a screen-reader
 * user in a document that has been replaced underneath them with no indication anything happened.
 */
view.addEventListener('change', () => {
  draw()
  const named = view.options[view.selectedIndex]?.textContent ?? view.value
  say(`Now showing: ${named}.`)
})

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

/**
 * PHASE-05 asks whether finishing a step should tick the ingredients it consumed, and says to
 * prototype both. Both are here, behind the `check-off` control.
 *
 * `linked` ticks a step's own ingredient inputs when it completes. `independent` is the default
 * — see docs/findings/Q7-two-check-gestures.md for what looking at both showed.
 */
function completeStep(component, stepId) {
  const key = stepKey(component, stepId)
  const finishing = !store.get().completedSteps.has(key)
  store.toggleStep(key)
  if (!finishing || checkoff.value !== 'linked') return

  const state = store.get()
  for (const input of component.steps[stepId].inputs) {
    if (input.kind !== 'ingredient') continue
    const ing = ingredientKey(component, input.id)
    if (!state.checkedIngredients.has(ing)) store.toggleIngredient(ing)
  }
}

/**
 * Completion across the whole recipe, weighted by time rather than by step count.
 *
 * Measured over the corpus, a step-count bar overstates by up to 62 points — the short ribs sit
 * at 7 steps of 9 with four hours of braising left, which counts as 78% done and is not. Whole
 * recipe rather than per component, because "12 of 15" is the number a cook wants and finishing
 * the mashed potatoes is not finishing the pie.
 *
 * See docs/findings/R7-progress-weighting.md.
 */
function recipeProgress(recipe, state) {
  let total = 0
  let done = 0
  for (const component of recipe.components) {
    for (const step of Object.values(component.steps)) {
      const minutes = stepMinutes(step)
      total += minutes
      if (state.completedSteps.has(stepKey(component, step.id))) done += minutes
    }
  }
  return total === 0 ? 0 : done / total
}

// --- Timers on screen --------------------------------------------------------------------------

/**
 * Refreshes running countdowns in place, once a second.
 *
 * In place, and not by redrawing: a full re-render every second would throw away focus, restart
 * the FLIP transition, and rewrite the whole card to change four characters. The store is not
 * touched at all — `remaining()` recomputes from the clock, so this is a pure read.
 */
function tick() {
  for (const node of root.querySelectorAll('[data-timer-for]')) {
    const key = node.dataset.timerFor
    const left = store.remaining(key)
    if (left === null) continue
    const ringing = store.isRinging(key)
    node.textContent = formatRemaining(left, ringing, node.classList.contains('cell-timer'))
    node.classList.toggle('ringing', ringing)
    if (ringing) alertOnce(key)
  }
}

// --- Alerting ----------------------------------------------------------------------------------

/**
 * Assume the screen is off and the cook is across the room.
 *
 * Fires once per timer: `tick()` runs every second and a ringing timer stays ringing until it is
 * stopped, so without this the cook gets a beep a second until they come back.
 */
const alerted = new Set()
function alertOnce(key) {
  if (alerted.has(key)) return
  alerted.add(key)
  const label = key.split('/').pop()
  // Sound first — it is the one channel that works with the screen off and no permission
  // granted, which is the common case. The notification is the improvement on top.
  beep()
  notify(`${label} — check it`)
  // The one thing on this page that earns an interruption: the cook is across the room and the
  // oven is not going to wait for a polite pause.
  say(`Timer finished for ${label}. Check it.`, { assertive: true })
}

/**
 * Two short tones from an oscillator rather than an audio file.
 *
 * The track has no build step and loads no assets, so a bundled sound would be the only binary
 * dependency in it. Wrapped because autoplay policy rejects audio with no prior user gesture —
 * and a timer is always started by a tap, so in practice there has been one.
 */
let audio = null
function beep() {
  try {
    audio ??= new (window.AudioContext ?? window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
    for (const [at, freq] of [
      [0, 880],
      [0.28, 1175],
    ]) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = freq
      // A hard start and stop on a square-ish tone clicks; a short ramp does not.
      gain.gain.setValueAtTime(0.0001, audio.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.22)
      osc.connect(gain).connect(audio.destination)
      osc.start(audio.currentTime + at)
      osc.stop(audio.currentTime + at + 0.24)
    }
  } catch {
    // No audio context available. The visual ringing state is still there.
  }
}

/**
 * Only ever with permission already granted.
 *
 * Asking on page load is the behaviour everyone has learned to dismiss, and a denied permission
 * is permanent — so the prompt is offered from the timer button, where the request has obvious
 * cause, and never from here.
 */
function notify(text) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    new Notification(text, { tag: text, silent: true })
  } catch {
    // Notifications unsupported or blocked. The beep already fired.
  }
}

setInterval(tick, 1000)

/**
 * A backgrounded tab throttles `setInterval` to once a minute or stops it altogether, so the
 * first thing a cook sees on coming back is a stale number. Recomputing on wake costs nothing
 * and is the difference between a timer that survives a locked phone and one that only appears
 * to.
 */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tick()
})

// --- Kitchen affordances -----------------------------------------------------------------------

undoButton.addEventListener('click', () => store.undo())

/**
 * Deliberate rather than easy to hit: two taps, and the button says what it is about to do.
 * `confirm()` would block the extension harness, and a modal for this is heavier than it
 * deserves — the button becoming its own confirmation is enough, and it reverts on a stray tap
 * elsewhere.
 */
let armed = false
startOver.addEventListener('click', () => {
  if (!armed) {
    armed = true
    startOver.textContent = 'Tap again to clear'
    startOver.classList.add('armed')
    return
  }
  disarm()
  alerted.clear()
  store.reset()
  syncScaleControls()
  units.value = 'both'
  cook = { componentIndex: 0, current: undefined }
})

function disarm() {
  armed = false
  startOver.textContent = 'Start over'
  startOver.classList.remove('armed')
}
document.addEventListener('click', (event) => {
  if (armed && event.target !== startOver) disarm()
})

/**
 * The preset menu and the number box are two views of one value, so each writes the store and
 * the store writes both back. Left independent, the menu would keep reading "double" next to a
 * card scaled to 2.75.
 */
function syncScaleControls() {
  const scale = store.get().scale
  scaleAny.value = String(scale)
  // A scale with no preset leaves the menu showing whatever was last picked, which is a lie.
  scaleControl.value = [...scaleControl.options].some((o) => Number(o.value) === scale)
    ? String(scale)
    : ''
}
scaleControl.addEventListener('change', () => store.setScale(Number(scaleControl.value)))
scaleAny.addEventListener('change', () => {
  const value = Number(scaleAny.value)
  if (Number.isFinite(value) && value > 0) store.setScale(value)
  // Reflect the clamp: typing 100 and being silently given 8 needs to show in the box.
  syncScaleControls()
})
units.addEventListener('change', () => store.setUnitSystem(units.value))

/**
 * Keeps the screen awake while cooking.
 *
 * A phone that sleeps every thirty seconds is a phone you wake with a floury knuckle. Requested
 * only in cook mode — holding a wake lock while someone reads a chart is a battery cost with
 * nothing to show for it. Unsupported on some browsers, which is fine: it is an improvement, not
 * a dependency, so failure is silent by design.
 */
let wakeLock = null
async function updateWakeLock() {
  const wanted = view.value === 'cook'
  try {
    if (wanted && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen')
      wakeLock.addEventListener('release', () => (wakeLock = null))
    } else if (!wanted && wakeLock) {
      await wakeLock.release()
      wakeLock = null
    }
  } catch {
    wakeLock = null
  }
}
view.addEventListener('change', updateWakeLock)
// A lock is dropped whenever the tab loses visibility and has to be retaken by hand.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateWakeLock()
})

// --- Announcements ------------------------------------------------------------------------------

/**
 * Two regions, two urgencies.
 *
 * `polite` waits for a pause — focus moves, check-off, a view change. `urgent` interrupts, which
 * is right for exactly one thing: a timer reaching the end of its range while the cook is across
 * the room. Using `alert` for anything else trains people to ignore it.
 *
 * The same text twice in a row is not re-announced by most screen readers, so a repeated message
 * gets a zero-width suffix to force it. Two timers finishing on the same wording would otherwise
 * announce once.
 */
let lastSaid = ''
function say(text, { assertive = false } = {}) {
  if (!text) return
  const region = assertive ? urgent : polite
  const message = text === lastSaid ? `${text}\u200b` : text
  lastSaid = text
  // Cleared first: a live region whose text is *replaced* in one tick sometimes coalesces with
  // the previous value and says neither.
  region.textContent = ''
  queueMicrotask(() => {
    region.textContent = message
  })
}

installKeyboard(root, (text) => say(text))

/**
 * The structural narrative, on screen.
 *
 * PHASE-06 asks whether this should be a mode or always-present visually-hidden text, and warns
 * that always-present risks double-announcing content already in the DOM. It is a mode, and
 * visible: the chart already carries every one of these words in some form, so hiding a second
 * copy inside it would make every step read twice for the people who most need it read once.
 * Visible also means it is available to everyone, which is the stronger claim the phase makes
 * for it — this is arguably the better presentation of the format's central insight.
 */
function renderNarrative(recipe, state) {
  const narration = narrate(recipe, { units: state.unitSystem })
  const items = narration.steps
    .map((step) => {
      const detail = [step.takes, step.produces, step.effort, step.alongside]
        .filter(Boolean)
        .join(' ')
      const walkAway = step.alongside ? ' class="walk-away"' : ''
      return (
        `<li${walkAway}><span class="n-pos">Step ${step.position} of ${step.of}</span>` +
        `<span class="n-action">${escapeText(step.action)}</span> ` +
        `<span class="n-detail">${escapeText(detail)}</span></li>`
      )
    })
    .join('')

  const keys = SHORTCUTS.map(
    ([key, what]) => `<dt>${escapeText(key)}</dt><dd>${escapeText(what)}</dd>`,
  ).join('')

  return (
    `<article class="card"><div class="narrative">` +
    `<h3>${escapeText(recipe.title)}</h3>` +
    `<p class="summary">${escapeText(narration.summary)}</p>` +
    `<ol>${items}</ol>` +
    `<div class="shortcuts"><b>On the chart:</b><dl>${keys}</dl></div>` +
    `</div></article>`
  )
}

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
  completedIn,
  completionAt,
  cookSchedule,
  isUnattended,
  outstandingSteps,
  resolveInputs,
  stepKey,
  whileThisRuns,
} from '../../../packages/core/dist/index.js'
import { renderMiniMap, sharedScale } from './minimap.js'
import { formatQuantity, unscalableNote } from './quantity.js'

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

/**
 * Inputs, resolved. An ingredient shows its quantity because that is what you are about to
 * measure; a prior result shows its name because "step 4" is not something you can pick up.
 */
function renderInputs(component, stepId, options = {}) {
  const inputs = resolveInputs(component, stepId)
  if (inputs.length === 0) return ''

  const items = inputs
    .map((input) => {
      if (input.kind === 'step') {
        return `<li class="from-step"><button type="button" class="jump" data-step="${esc(input.id)}">${esc(input.name)}</button></li>`
      }
      const leaf = input.leaf
      const label = leaf.component ? (leaf.label ?? leaf.component) : leaf.item
      // `input.quantity` is this step's share, which is the leaf total unless the leaf is split
      // between steps. Cook mode is where the difference bites: this is the number someone
      // measures out, and the pulled chicken's barbecue sauce would otherwise say 1½ cups at
      // both ends of a 1 cup / ½ cup split.
      const measured = input.quantity ?? leaf.quantity
      const q = formatQuantity(measured, options)
      const warning = unscalableNote(measured, options.scale)
      const note = leaf.note ? `<span class="note">${esc(leaf.note)}</span>` : ''
      const flag = warning ? `<span class="note unscalable">${esc(warning)}</span>` : ''
      return `<li><span class="qty">${esc(q)}</span> <span class="item">${esc(label)}</span>${note}${flag}</li>`
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

/**
 * The timer, and the reason it is a button rather than something that starts itself.
 *
 * Arriving at a step does not mean the pan is on. Auto-starting a forty-minute bake the moment
 * the card is drawn produces a countdown that is confidently wrong for whatever length of time
 * the cook spent finding the tin.
 *
 * The remaining time is rendered from `store.remaining()` and refreshed in place by `main.js`,
 * never accumulated — see the store for why.
 */
function renderTimer(component, stepId, cook) {
  const step = component.steps[stepId]
  if (!step?.duration || !cook.store) return ''
  const key = stepKey(component, stepId)
  const running = cook.store.remaining(key) !== null
  if (!running) {
    return (
      `<div class="cm-timer-row">` +
      `<button type="button" class="cm-timer-start" data-timer="${esc(key)}">Start timer</button></div>`
    )
  }
  const ringing = cook.store.isRinging(key)
  return (
    `<div class="cm-timer-row">` +
    `<span class="cm-timer${ringing ? ' ringing' : ''}" data-timer-for="${esc(key)}" role="status">` +
    `${esc(formatRemaining(cook.store.remaining(key), ringing))}</span>` +
    `<button type="button" class="cm-timer-stop" data-timer-stop="${esc(key)}">Stop</button></div>`
  )
}

/**
 * A countdown reads m:ss so the seconds are visible at the end, which is when anyone is
 * watching it. Past the low end of a range it counts *up* rather than going negative — "30–40
 * min" has not failed at 31 minutes, it has entered the window where you start checking.
 *
 * `terse` drops the words for the chart badge, which sits in a grid cell that can be 60px wide
 * on a phone. The badge still turns clay and bold, so the ringing state keeps two channels
 * there as well — it just says it in the space it has.
 */
export function formatRemaining(ms, ringing, terse = false) {
  const seconds = Math.max(0, Math.round(Math.abs(ms) / 1000))
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  if (!ringing) return text
  return terse ? `+${text}` : `check it — +${text}`
}

/**
 * Time-weighted, and it says so.
 *
 * A bar reading 16% next to "7 of 9" looks broken unless the reader knows what it measures, so
 * the label is "16% of the time" rather than a bare percentage. Both numbers are on screen and
 * they disagree honestly — which is the point, since the step count is the one that lies.
 */
function renderProgress(fraction) {
  if (typeof fraction !== 'number') return ''
  const percent = Math.round(fraction * 100)
  return (
    `<span class="cm-progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" ` +
    `aria-valuemax="100" aria-label="${percent}% of the cooking time">` +
    `<span class="cm-progress-fill" style="inline-size:${percent}%"></span>` +
    `<span class="cm-progress-text">${percent}% of the time</span></span>`
  )
}

/**
 * Says which ending this is.
 *
 * The mini-map is per-component, so finishing the mashed potatoes fills it completely — the same
 * picture as finishing the dish — and the next step empties it, which reads as losing progress
 * rather than starting part two. "3 of 15" is right there and correct, and the eye does not read
 * it; the map is the loud element, so the ending has to be named next to it.
 *
 * The two marks are the vocabulary: a half-filled square for a part, a full one for the whole.
 * They are drawn in CSS rather than set as glyphs so they cannot depend on a font having ◧, and
 * they differ in *shape* as well as fill, so greyscale and print keep the distinction.
 */
function renderCompletion(recipe, index, state) {
  if (!state) return ''
  const completion = completionAt(recipe, index, state)

  if (completion.kind === 'all') {
    return (
      `<p class="ending all"><span class="seal seal-all" aria-hidden="true"></span>` +
      `<span><b>All done.</b> ${esc(recipe.title)} is finished.</span></p>`
    )
  }
  if (completion.kind === 'part') {
    return (
      `<p class="ending part"><span class="seal seal-part" aria-hidden="true"></span>` +
      `<span><b>${esc(completion.component.title ?? 'This part')} done</b> — ` +
      `part ${completion.index + 1} of ${completion.of}. ` +
      `${esc(completion.next.title ?? 'The next part')} is next, and its map starts empty.</span></p>`
    )
  }
  return ''
}

export function renderCookMode(recipe, cook) {
  const index = cook.componentIndex ?? 0
  const component = recipe.components[index]
  const plan = recipe.plans[index]
  // `cook.ts` speaks in bare ids because it only ever sees one component; the store holds
  // component-qualified keys. This is the one place the track translates.
  const done = cook.state ? completedIn(component, cook.state) : (cook.done ?? new Set())
  const scale = sharedScale(recipe.plans, { width: 320, height: 130 })

  const schedule = cookSchedule(component)
  const order = schedule.order
  const current = cook.current ?? order[0]
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
    `<button type="button" class="cm-back" aria-label="Back to the chart">← chart</button>` +
    `<span class="cm-count">${position} of ${total}</span>${componentTitle}` +
    renderProgress(cook.progress) +
    `</header>` +
    `<div class="cm-body">` +
    `<p class="cm-text">${esc(step.text)}</p>${mark}${renderTimer(component, current, cook)}` +
    renderInputs(component, current, cook) +
    `</div>` +
    renderBanner(component, current, done) +
    renderCompletion(recipe, index, cook.state) +
    `<div class="cm-map">${renderMiniMap(plan, { current, done, scale, interactive: true })}` +
    (recipe.components.length > 1
      ? `<span class="cm-part">part ${index + 1} of ${recipe.components.length}` +
        `${component.title ? ` · ${esc(component.title)}` : ''}</span>`
      : '') +
    `</div>` +
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

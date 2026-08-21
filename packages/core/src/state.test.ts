import { describe, expect, it } from 'vitest'
import {
  checkedIn,
  completedIn,
  createStore,
  ingredientKey,
  progress,
  progressByStepCount,
  regionFill,
  stepKey,
} from './state.js'
import { layout } from './layout.js'
import type { Component, Step } from './model.js'

const step = (
  id: string,
  inputs: Step['inputs'],
  effort: Step['effort'],
  minutes?: number,
): Step => ({
  id,
  inputs,
  text: id,
  effort,
  ...(minutes === undefined ? {} : { duration: { min: minutes, unit: 'min' as const } }),
})

const ing = (id: string) => ({ kind: 'ingredient' as const, id })
const from = (id: string) => ({ kind: 'step' as const, id })

/** Four quick steps and one long bake — the shape most of this corpus actually has. */
const brownies: Component = {
  id: 'brownies',
  prelude: [],
  ingredients: [
    { id: 'butter', item: 'butter' },
    { id: 'sugar', item: 'sugar' },
  ],
  root: 'bake',
  steps: {
    melt: step('melt', [ing('butter')], 'quick', 2),
    mix: step('mix', [from('melt'), ing('sugar')], 'quick', 3),
    beat: step('beat', [from('mix')], 'quick', 3),
    fold: step('fold', [from('beat')], 'quick', 2),
    bake: step('bake', [from('fold')], 'long-unattended', 40),
  },
}

describe('the store', () => {
  it('notifies subscribers and stops when they unsubscribe', () => {
    const store = createStore()
    let calls = 0
    const off = store.subscribe(() => calls++)
    store.toggleStep(stepKey(brownies, 'melt'))
    expect(calls).toBe(1)
    off()
    store.toggleStep(stepKey(brownies, 'mix'))
    expect(calls).toBe(1)
  })

  it('hands out a fresh snapshot on each change, so identity comparison works', () => {
    const store = createStore()
    const before = store.get()
    store.toggleIngredient(ingredientKey(brownies, 'butter'))
    expect(store.get()).not.toBe(before)
    expect(before.checkedIngredients.has(ingredientKey(brownies, 'butter'))).toBe(false)
    expect(store.get().checkedIngredients.has(ingredientKey(brownies, 'butter'))).toBe(true)
  })

  it('toggles rather than only setting', () => {
    const store = createStore()
    store.toggleStep(stepKey(brownies, 'melt'))
    store.toggleStep(stepKey(brownies, 'melt'))
    expect(store.get().completedSteps.has(stepKey(brownies, 'melt'))).toBe(false)
  })

  // Wet fingers mis-tap constantly, and the mis-tap is always on check-off.
  it('undoes a check-off', () => {
    const store = createStore()
    expect(store.canUndo()).toBe(false)
    store.toggleIngredient(ingredientKey(brownies, 'butter'))
    store.toggleIngredient(ingredientKey(brownies, 'sugar'))
    expect(store.canUndo()).toBe(true)
    store.undo()
    expect(store.get().checkedIngredients.has(ingredientKey(brownies, 'sugar'))).toBe(false)
    expect(store.get().checkedIngredients.has(ingredientKey(brownies, 'butter'))).toBe(true)
  })

  /**
   * Found on screen, not in a test. Undo restored a whole `CookState` snapshot, which carried
   * `timers` with it — so undoing a mis-tapped checkbox also wound the state back to before the
   * bake started, and a running forty-minute timer vanished off the card.
   */
  it('does not stop a running timer', () => {
    const store = createStore({ now: () => 1_000_000 })
    store.startTimer('brownies/bake', brownies.steps.bake!)
    store.toggleIngredient(ingredientKey(brownies, 'butter'))
    store.undo()

    expect(store.get().checkedIngredients.size).toBe(0)
    expect(store.remaining('brownies/bake')).toBe(40 * 60_000)
  })

  it('leaves scale and units alone, since their controls still show the new value', () => {
    const store = createStore()
    store.setScale(2)
    store.toggleStep(stepKey(brownies, 'melt'))
    store.undo()

    expect(store.get().completedSteps.size).toBe(0)
    expect(store.get().scale).toBe(2)
  })

  it('clamps the scale to something a kitchen could attempt', () => {
    const store = createStore()
    store.setScale(100)
    expect(store.get().scale).toBe(8)
    store.setScale(0)
    expect(store.get().scale).toBe(0.25)
  })
})

/**
 * Timers are two timestamps and a clock, never an accumulating countdown. A forty-minute bake
 * will be backgrounded, and a tab that slept has to wake up correct rather than behind.
 */
describe('timers', () => {
  const clock = () => {
    let t = 1_000_000
    return { now: () => t, advance: (ms: number) => (t += ms) }
  }

  it('counts down from the step duration', () => {
    const c = clock()
    const store = createStore({ now: c.now })
    store.startTimer('brownies/bake', brownies.steps.bake!)
    expect(store.remaining('brownies/bake')).toBe(40 * 60_000)
    c.advance(10 * 60_000)
    expect(store.remaining('brownies/bake')).toBe(30 * 60_000)
  })

  it('survives a tab that slept, because nothing accumulates', () => {
    const c = clock()
    const store = createStore({ now: c.now })
    store.startTimer('brownies/bake', brownies.steps.bake!)
    // No ticks happened at all during this jump — the equivalent of a backgrounded tab.
    c.advance(39 * 60_000)
    expect(store.remaining('brownies/bake')).toBe(60_000)
    expect(store.isRinging('brownies/bake')).toBe(false)
    c.advance(60_000)
    expect(store.isRinging('brownies/bake')).toBe(true)
  })

  it('alerts at the low end of a range and keeps counting to the high end', () => {
    const c = clock()
    const store = createStore({ now: c.now })
    const ranged: Step = {
      id: 'bake',
      inputs: [],
      text: 'bake',
      effort: 'long-unattended',
      duration: { min: 30, max: 40, unit: 'min' },
    }
    store.startTimer('brownies/bake', ranged)
    c.advance(30 * 60_000)
    // "30–40 min" means start looking at 30, not that it is finished at 30.
    expect(store.isRinging('brownies/bake')).toBe(true)
    expect(store.get().timers['brownies/bake']!.endsAfter).toBe(40 * 60_000)
  })

  it('runs several at once, which is the whole point of a parallel format', () => {
    const c = clock()
    const store = createStore({ now: c.now })
    store.startTimer('brownies/bake', brownies.steps.bake!)
    store.startTimer('brownies/melt', brownies.steps.melt!)
    c.advance(60_000)
    expect(store.remaining('brownies/bake')).toBe(39 * 60_000)
    expect(store.remaining('brownies/melt')).toBe(60_000)
    store.stopTimer('brownies/melt')
    expect(store.remaining('brownies/melt')).toBeNull()
  })

  it('ignores a step with no authored duration', () => {
    const store = createStore()
    store.startTimer('brownies/x', { id: 'x', inputs: [], text: 'x', effort: 'quick' })
    expect(store.remaining('brownies/x')).toBeNull()
  })
})

/**
 * The reason progress is time-weighted. Four of five steps done reads as "nearly there" and is
 * wrong when the fifth is a forty-minute bake — which is the shape of most of this corpus.
 */
describe('progress', () => {
  it('weights by time, not by step count', () => {
    const store = createStore()
    for (const id of ['melt', 'mix', 'beat', 'fold']) store.toggleStep(stepKey(brownies, id))

    expect(progressByStepCount(brownies, store.get())).toBe(0.8)
    expect(progress(brownies, store.get())).toBeCloseTo(10 / 50, 3)
  })

  it('is zero at the start and one at the end', () => {
    const store = createStore()
    expect(progress(brownies, store.get())).toBe(0)
    for (const id of Object.keys(brownies.steps)) store.toggleStep(stepKey(brownies, id))
    expect(progress(brownies, store.get())).toBe(1)
  })
})

describe('region fill', () => {
  it('reports how much of each subtree is complete', () => {
    const plan = layout(brownies)
    const store = createStore()
    store.toggleStep(stepKey(brownies, 'melt'))

    const fill = regionFill(brownies, plan, store.get())
    // `melt` is a leaf step, so its own region is finished; `bake` covers everything.
    expect(fill.get('melt')).toBe(1)
    expect(fill.get('bake')).toBeCloseTo(1 / 5, 3)
  })
})

/**
 * The reason `CookState` holds qualified keys instead of bare ids.
 *
 * Shepherd's pie really does have a `season` step and a `salt` leaf in both of its components.
 * Held flat, seasoning the potatoes also seasoned the pie — the card claiming the cook was two
 * steps further along than they were.
 */
describe('ids are unique per component, not per recipe', () => {
  const potatoes: Component = {
    id: 'mashed-potatoes',
    prelude: [],
    ingredients: [{ id: 'salt', item: 'salt' }],
    root: 'season',
    steps: { season: step('season', [ing('salt')], 'quick', 1) },
  }
  const pie: Component = {
    id: 'shepherds-pie',
    prelude: [],
    ingredients: [{ id: 'salt', item: 'salt' }],
    root: 'season',
    steps: { season: step('season', [ing('salt')], 'quick', 1) },
  }

  it('does not mark the other component done', () => {
    const store = createStore()
    store.toggleStep(stepKey(potatoes, 'season'))

    expect(progress(potatoes, store.get())).toBe(1)
    expect(progress(pie, store.get())).toBe(0)
  })

  it('does not tick the other component’s salt', () => {
    const store = createStore()
    store.toggleIngredient(ingredientKey(potatoes, 'salt'))

    expect(checkedIn(potatoes, store.get())).toEqual(new Set(['salt']))
    expect(checkedIn(pie, store.get())).toEqual(new Set())
  })

  it('hands a component its own progress as bare ids, for cook.ts', () => {
    const store = createStore()
    store.toggleStep(stepKey(pie, 'season'))

    // `cook.ts` speaks in bare ids because it only ever sees one component; this is the
    // translation at the boundary, so no track has to hand-roll it.
    expect(completedIn(pie, store.get())).toEqual(new Set(['season']))
    expect(completedIn(potatoes, store.get())).toEqual(new Set())
  })
})

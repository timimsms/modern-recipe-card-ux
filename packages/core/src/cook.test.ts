import { describe, expect, it } from 'vitest'
import { cookSchedule, readySteps, resolveInputs, whileThisRuns } from './cook.js'
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

/**
 * A recipe where overlap is genuinely available: a 30-minute braise that needs no attention, and
 * two minutes of chopping that does not depend on it. A cook with any sense starts the braise
 * first.
 */
const overlappable: Component = {
  id: 'overlappable',
  prelude: [],
  ingredients: [
    { id: 'meat', item: 'meat' },
    { id: 'herb', item: 'herb' },
  ],
  root: 'plate',
  steps: {
    braise: step('braise', [ing('meat')], 'long-unattended', 30),
    chop: step('chop', [ing('herb')], 'quick', 2),
    plate: step('plate', [from('braise'), from('chop')], 'quick', 1),
  },
}

describe('the schedule starts waits first', () => {
  const schedule = cookSchedule(overlappable)

  it('begins with the step you can walk away from', () => {
    expect(schedule.order[0]).toBe('braise')
  })

  it('fills the wait with the work that does not depend on it', () => {
    expect(schedule.order).toEqual(['braise', 'chop', 'plate'])
  })

  // 30 + 2 + 1 = 33 if you stand and watch; 31 if the chopping happens during the braise.
  it('finishes sooner than doing the same steps one after another', () => {
    expect(schedule.totalMinutes).toBe(31)
  })

  it('counts the time left with nothing to do', () => {
    // Two of the braise's thirty minutes are spent chopping; the other 28 are waiting.
    expect(schedule.idleMinutes).toBe(28)
  })
})

describe('the schedule on a pure chain', () => {
  const chain: Component = {
    id: 'chain',
    prelude: [],
    ingredients: [{ id: 'a', item: 'a' }],
    root: 'c',
    steps: {
      a: step('a', [ing('a')], 'quick', 2),
      b: step('b', [from('a')], 'long-unattended', 30),
      c: step('c', [from('b')], 'quick', 1),
    },
  }

  it('cannot overlap anything, and says so', () => {
    const schedule = cookSchedule(chain)
    expect(schedule.order).toEqual(['a', 'b', 'c'])
    expect(schedule.totalMinutes).toBe(33)
    expect(schedule.idleMinutes).toBe(30)
  })
})

describe('ready steps', () => {
  it('lists only steps whose dependencies are met', () => {
    expect(readySteps(overlappable, new Set()).sort()).toEqual(['braise', 'chop'])
    expect(readySteps(overlappable, new Set(['braise', 'chop']))).toEqual(['plate'])
  })

  it('excludes what is already in progress', () => {
    expect(readySteps(overlappable, new Set(), new Set(['braise']))).toEqual(['chop'])
  })
})

describe('what to do while a step runs', () => {
  it('offers other work during a step you can leave', () => {
    expect(whileThisRuns(overlappable, 'braise', new Set())).toEqual(['chop'])
  })

  // Suggesting a second task during a step that needs both hands is how you get two burnt
  // things instead of one.
  it('offers nothing during a step that needs you', () => {
    expect(whileThisRuns(overlappable, 'chop', new Set())).toEqual([])
  })

  /**
   * You cannot be baking a pie you have not assembled, so everything the current step depends
   * on has already happened whether or not anyone ticked it off. Without this the banner
   * offered work from the start of the recipe: standing at the oven with shepherd's pie in it,
   * it suggested "heat", "dice" and "cut up into small pieces".
   */
  it('never offers work the current step already depends on', () => {
    const late: Component = {
      id: 'late',
      prelude: [],
      ingredients: [
        { id: 'a', item: 'a' },
        { id: 'b', item: 'b' },
      ],
      root: 'bake',
      steps: {
        prep: step('prep', [ing('a')], 'quick', 2),
        assemble: step('assemble', [from('prep')], 'quick', 2),
        bake: step('bake', [from('assemble')], 'long-unattended', 30),
        garnish: step('garnish', [ing('b')], 'quick', 1),
      },
    }
    // `garnish` is genuinely outstanding; `prep` and `assemble` are behind us.
    expect(whileThisRuns(late, 'bake', new Set())).toEqual(['garnish'])
  })

  it('never offers the step that is waiting on this one', () => {
    const chain: Component = {
      id: 'chain',
      prelude: [],
      ingredients: [{ id: 'a', item: 'a' }],
      root: 'shape',
      steps: {
        mix: step('mix', [ing('a')], 'quick', 2),
        rest: step('rest', [from('mix')], 'long-unattended', 30),
        shape: step('shape', [from('rest')], 'quick', 5),
      },
    }
    // "While the dough rests, you can: shape the dough" is the one suggestion that cannot be
    // taken — shaping is what the resting is blocking.
    expect(whileThisRuns(chain, 'rest', new Set())).toEqual([])
  })
})

describe('resolved inputs', () => {
  it('names step inputs and returns ingredient rows whole', () => {
    const resolved = resolveInputs(overlappable, 'plate')
    // Both are pure prep steps, so each names its own ingredient rather than hedging.
    expect(resolved).toEqual([
      { kind: 'step', id: 'braise', name: 'the meat' },
      { kind: 'step', id: 'chop', name: 'the herb' },
    ])
  })

  it('gives an ingredient step its actual leaf, quantity and all', () => {
    const resolved = resolveInputs(overlappable, 'chop')
    expect(resolved).toEqual([
      { kind: 'ingredient', id: 'herb', leaf: { id: 'herb', item: 'herb' } },
    ])
  })
})

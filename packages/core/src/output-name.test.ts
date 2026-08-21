import { describe, expect, it } from 'vitest'
import { describeOutput, type Component } from './index.js'

/**
 * Cook mode shows one step at a time, so its inputs have to be *named* — the grid can point at a
 * cell, a card cannot. The original format leaves every intermediate result anonymous.
 *
 * The generator is deliberately timid. See the note on `describeOutput`: the obvious version,
 * technique plus the step's own ingredients, produced fluent falsehoods on the real corpus.
 */

const component = (steps: Component['steps'], root: string): Component => ({
  id: 'c',
  prelude: [],
  ingredients: [
    { id: 'beef', item: 'ground beef' },
    { id: 'butter', item: 'butter' },
    { id: 'onion', item: 'onion' },
    { id: 'carrot', item: 'carrot' },
    { id: 'celery', item: 'celery' },
  ],
  root,
  steps,
})

describe('a step with no step inputs', () => {
  it('names its ingredients, because they are the whole of what it made', () => {
    const c = component(
      {
        slice: {
          id: 'slice',
          inputs: [{ kind: 'ingredient', id: 'beef' }],
          text: 'cut into strips',
          effort: 'minutes',
          technique: 'slice',
        },
      },
      'slice',
    )
    expect(describeOutput(c, 'slice')).toBe('the sliced ground beef')
  })

  it('joins two ingredients but refuses to list three', () => {
    const two = component(
      {
        chop: {
          id: 'chop',
          inputs: [
            { kind: 'ingredient', id: 'onion' },
            { kind: 'ingredient', id: 'carrot' },
          ],
          text: 'dice',
          effort: 'minutes',
          technique: 'chop',
        },
      },
      'chop',
    )
    expect(describeOutput(two, 'chop')).toBe('the chopped onion and carrot')

    const three = component(
      {
        chop: {
          id: 'chop',
          inputs: [
            { kind: 'ingredient', id: 'onion' },
            { kind: 'ingredient', id: 'carrot' },
            { kind: 'ingredient', id: 'celery' },
          ],
          text: 'dice',
          effort: 'minutes',
          technique: 'chop',
        },
      },
      'chop',
    )
    expect(describeOutput(three, 'chop')).toBe('the chopped mixture')
  })
})

/**
 * The bug this function exists to avoid. `brown` in the stroganoff consumes the *seared beef*
 * plus butter; naming it from its own ingredients gave "the browned butter", which is fluent,
 * confident and wrong. Vague beats wrong: a cook can resolve "the browned mixture" from the step
 * in front of them, but cannot recover from being told the wrong ingredient.
 */
describe('a step built on another step', () => {
  const c = component(
    {
      sear: {
        id: 'sear',
        inputs: [{ kind: 'ingredient', id: 'beef' }],
        text: 'sear',
        effort: 'minutes',
        technique: 'sear',
      },
      brown: {
        id: 'brown',
        inputs: [
          { kind: 'step', id: 'sear' },
          { kind: 'ingredient', id: 'butter' },
        ],
        text: 'brown',
        effort: 'minutes',
        technique: 'brown',
      },
    },
    'brown',
  )

  it('never names the ingredients it merely added', () => {
    expect(describeOutput(c, 'brown')).toBe('the browned mixture')
    expect(describeOutput(c, 'brown')).not.toContain('butter')
  })

  it('still names a pure prep step correctly in the same recipe', () => {
    expect(describeOutput(c, 'sear')).toBe('the seared ground beef')
  })
})

describe('fallbacks', () => {
  it('prefers an authored name over anything derived', () => {
    const c = component(
      {
        brown: {
          id: 'brown',
          inputs: [{ kind: 'ingredient', id: 'beef' }],
          text: 'brown',
          effort: 'minutes',
          technique: 'brown',
          outputName: 'the browned beef',
        },
      },
      'brown',
    )
    expect(describeOutput(c, 'brown')).toBe('the browned beef')
  })

  it('avoids "the mixed mixture"', () => {
    const c = component(
      {
        a: { id: 'a', inputs: [{ kind: 'ingredient', id: 'beef' }], text: 'a', effort: 'quick' },
        mix: {
          id: 'mix',
          inputs: [
            { kind: 'step', id: 'a' },
            { kind: 'ingredient', id: 'butter' },
          ],
          text: 'mix',
          effort: 'quick',
          technique: 'mix',
        },
      },
      'mix',
    )
    expect(describeOutput(c, 'mix')).toBe('the mixture')
  })

  it('says something usable when there is no technique at all', () => {
    const c = component(
      {
        a: { id: 'a', inputs: [{ kind: 'ingredient', id: 'beef' }], text: 'a', effort: 'quick' },
        b: {
          id: 'b',
          inputs: [
            { kind: 'step', id: 'a' },
            { kind: 'ingredient', id: 'butter' },
          ],
          text: 'b',
          effort: 'quick',
        },
      },
      'b',
    )
    expect(describeOutput(c, 'b')).toBe('the mixture so far')
  })

  it('does not throw on an unknown step', () => {
    expect(describeOutput(component({}, 'nope'), 'nope')).toBe('the previous step')
  })
})

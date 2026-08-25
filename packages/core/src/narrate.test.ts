import { describe, expect, it } from 'vitest'
import { narrate, narrateComponent, spokenTotal } from './narrate.js'
import type { Component, Recipe, Step } from './model.js'

const step = (id: string, inputs: Step['inputs'], extra: Partial<Step> = {}): Step => ({
  id,
  inputs,
  text: id,
  effort: 'quick',
  ...extra,
})

const ing = (id: string) => ({ kind: 'ingredient' as const, id })
const from = (id: string) => ({ kind: 'step' as const, id })

const brownies: Component = {
  id: 'brownies',
  title: 'Brownies',
  prelude: [],
  ingredients: [
    {
      id: 'butter',
      item: 'unsalted butter',
      quantity: { amount: 4, unit: 'oz', metric: { amount: 115, unit: 'g' } },
    },
    { id: 'flour', item: 'all-purpose flour', quantity: { amount: 0.5, unit: 'cup' } },
    { id: 'salt', item: 'table salt', quantity: { amount: 0.25, unit: 'tsp' } },
  ],
  root: 'bake',
  steps: {
    melt: step('melt', [ing('butter')], { technique: 'melt' }),
    fold: step('fold', [from('melt'), ing('flour'), ing('salt')], { technique: 'fold' }),
    bake: step('bake', [from('fold')], {
      text: 'bake',
      effort: 'long-unattended',
      duration: { min: 30, max: 40, unit: 'min' },
    }),
  },
}

describe('the spoken step', () => {
  const narration = narrateComponent(brownies)

  it('names every input, because "the previous step" is useless out loud', () => {
    // On the chart an input is the cell physically next to you, which is why the chart can leave
    // it unnamed. Read aloud that affordance is gone.
    expect(narration.steps[1]!.takes).toBe(
      'Takes the melted unsalted butter, ½ cup of all-purpose flour, and ¼ teaspoon of table salt.',
    )
  })

  it('speaks units in full, since the abbreviations exist to fit a column', () => {
    expect(narration.steps[0]!.takes).toBe('Takes 4 ounces of unsalted butter.')
  })

  // "¼ teaspoons" is wrong English; below one, the unit stays singular.
  it('keeps the unit singular below one', () => {
    expect(narration.steps[1]!.takes).toContain('¼ teaspoon of table salt')
    expect(narration.steps[1]!.takes).toContain('½ cup of all-purpose flour')
  })

  it('names what a step produces, so the next step has something to refer back to', () => {
    expect(narration.steps[0]!.produces).toBe('Produces the melted unsalted butter.')
  })

  it('says nothing about what the last step produces — the title already said', () => {
    expect(narration.steps.at(-1)!.produces).toBeUndefined()
  })

  it('reads a duration as words, and says when you can walk away', () => {
    expect(narration.steps.at(-1)!.effort).toBe('30 to 40 minutes. You can walk away.')
  })

  /**
   * Q2 measured the parallelism banner firing on 0 of 66 corpus steps. Saying "nothing else is
   * pending" is the useful half of that: silence would leave the listener wondering whether they
   * had missed a branch.
   */
  it('says explicitly when there is nothing to do alongside', () => {
    expect(narration.steps.at(-1)!.alongside).toBe('While this runs, nothing else is pending.')
  })

  it('offers the alternative when there genuinely is one', () => {
    const parallel: Component = {
      id: 'p',
      prelude: [],
      ingredients: [
        { id: 'meat', item: 'beef' },
        { id: 'veg', item: 'carrots' },
      ],
      root: 'serve',
      steps: {
        braise: step('braise', [ing('meat')], {
          text: 'braise',
          effort: 'long-unattended',
          duration: { min: 120, unit: 'min' },
        }),
        chop: step('chop', [ing('veg')], { text: 'chop the carrots' }),
        serve: step('serve', [from('braise'), from('chop')], { text: 'serve' }),
      },
    }
    const spoken = narrateComponent(parallel).steps.find((s) => s.id === 'braise')!
    expect(spoken.alongside).toBe('While this runs you could start "chop the carrots".')
  })
})

/**
 * The sentence the chart draws and a numbered list cannot: where separate work happens and where
 * it meets.
 */
describe('the summary', () => {
  it('calls a chain a chain', () => {
    expect(narrateComponent(brownies).summary).toContain('A single run')
  })

  /**
   * The first version read the *root's* inputs, reasoning that the root is the final
   * convergence. Over the corpus that called all nine components "one strand of work" — false,
   * four of them branch. No corpus root has two step inputs, so the one place it looked was the
   * one place it never happens.
   */
  it('finds a join that is not at the root', () => {
    const joined: Component = {
      id: 'j',
      prelude: [],
      ingredients: [
        { id: 'a', item: 'onion' },
        { id: 'b', item: 'garlic' },
      ],
      root: 'finish',
      steps: {
        chopA: step('chopA', [ing('a')], { text: 'chop the onion', technique: 'chop' }),
        chopB: step('chopB', [ing('b')], { text: 'chop the garlic', technique: 'chop' }),
        combine: step('combine', [from('chopA'), from('chopB')], { text: 'combine' }),
        finish: step('finish', [from('combine')], { text: 'finish' }),
      },
    }
    const summary = narrateComponent(joined).summary
    expect(summary).toContain('where separate work')
    expect(summary).toContain('"combine"')
  })
})

describe('a recipe in several parts', () => {
  const potatoes: Component = {
    id: 'mash',
    title: 'Mashed potatoes',
    prelude: [],
    ingredients: [{ id: 'spuds', item: 'potatoes' }],
    root: 'mash',
    steps: {
      mash: step('mash', [ing('spuds')], { text: 'mash', outputName: 'the mashed potatoes' }),
    },
  }
  const pie: Component = {
    id: 'pie',
    title: 'The pie',
    prelude: [],
    ingredients: [{ id: 'ref', component: 'mash', label: 'mashed potatoes' }],
    root: 'bake',
    steps: { bake: step('bake', [ing('ref')], { text: 'bake' }) },
  }
  const recipe: Recipe = { id: 'sp', title: "Shepherd's Pie", components: [potatoes, pie] }

  it('counts steps across the whole recipe, not within a part', () => {
    const steps = narrate(recipe).steps
    expect(steps.map((s) => `${s.position} of ${s.of}`)).toEqual(['1 of 2', '2 of 2'])
    expect(steps[1]!.spoken).toContain('Step 2 of 2.')
  })

  /**
   * A component root is not the end of the recipe. Saying nothing there — the rule for the final
   * step — lost the link between the mashed potatoes and the pie that eats them.
   */
  it('says a part is finished rather than falling silent', () => {
    expect(narrate(recipe).steps[0]!.produces).toBe('That finishes the mashed potatoes.')
  })
})

describe('quantities that would read as a bug', () => {
  /**
   * "Takes 3 tablespoons of vegetable oil. Produces the vegetable oil." is true and reads like a
   * bug. It happens when a step has no `technique` for `describeOutput` to build a participle
   * from, so the output is named after its own input.
   */
  it('does not restate a step’s only input as its output', () => {
    const heat: Component = {
      id: 'h',
      prelude: [],
      ingredients: [{ id: 'oil', item: 'vegetable oil', quantity: { amount: 3, unit: 'Tbs' } }],
      root: 'done',
      steps: {
        heat: step('heat', [ing('oil')], { text: 'heat' }),
        done: step('done', [from('heat')], { text: 'done' }),
      },
    }
    const spoken = narrateComponent(heat).steps.find((s) => s.id === 'heat')!
    expect(spoken.takes).toBe('Takes 3 tablespoons of vegetable oil.')
    expect(spoken.produces).toBeUndefined()
  })

  it('speaks a component reference with its quantity', () => {
    const ref: Component = {
      id: 'r',
      prelude: [],
      ingredients: [
        {
          id: 'mp',
          component: 'mash',
          label: 'mashed potatoes',
          quantity: { amount: 1.75, unit: 'lb', metric: { amount: 800, unit: 'g' } },
        },
      ],
      root: 'top',
      steps: { top: step('top', [ing('mp')], { text: 'cover with potatoes' }) },
    }
    // The number lived in `note` in the corpus, where scaling could not see it and the narrator
    // could not say it.
    expect(narrateComponent(ref).steps[0]!.takes).toBe('Takes 1¾ pounds of mashed potatoes.')
  })

  it('can speak metric instead, without doubling every line', () => {
    const spoken = narrateComponent(brownies, { units: 'metric' }).steps[0]!
    expect(spoken.takes).toBe('Takes 115 grams of unsalted butter.')
  })
})

describe('how long it takes', () => {
  it('reads the wall clock, with plurals that survive the value one', () => {
    expect(spokenTotal(brownies)).toBe('44 minutes')
    const hour: Component = {
      id: 'h',
      prelude: [],
      ingredients: [{ id: 'a', item: 'a' }],
      root: 'wait',
      steps: {
        wait: step('wait', [ing('a')], {
          effort: 'long-unattended',
          duration: { min: 61, unit: 'min' },
        }),
      },
    }
    expect(spokenTotal(hour)).toBe('1 hour 1 minute')
  })
})

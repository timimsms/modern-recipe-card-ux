import { describe, expect, it } from 'vitest'
import { normalizeComponent, normalizeRecipe, type AuthoredComponent } from './authoring.js'

const component = (overrides: Partial<AuthoredComponent> = {}): AuthoredComponent => ({
  id: 'only',
  prelude: [],
  ingredients: [
    { id: 'butter', quantity: { amount: '1-1/2', unit: 'cup' }, item: 'butter' },
    { id: 'sugar', quantity: { amount: '1/3', unit: 'cup' }, item: 'sugar' },
  ],
  root: 'cream',
  steps: {
    cream: { id: 'cream', inputs: ['butter', 'sugar'], text: 'cream', effort: 'quick' },
  },
  ...overrides,
})

describe('amounts written as the source prints them', () => {
  it('reads a mixed number', () => {
    const { ingredients } = normalizeComponent(component())
    expect(ingredients[0]?.quantity?.amount).toBe(1.5)
  })

  // The reason this exists: 1/3 cup has to be typed as 0.3333333333333333 in strict JSON.
  // You cannot proofread that against a photograph, and dropping one 3 changes the amount.
  it('reads a bare fraction exactly', () => {
    const { ingredients } = normalizeComponent(component())
    expect(ingredients[1]?.quantity?.amount).toBe(1 / 3)
  })

  it('reads a range', () => {
    const authored = component({
      ingredients: [
        { id: 'butter', quantity: { amount: '30 to 40', unit: 'g' }, item: 'butter' },
        { id: 'sugar', item: 'sugar' },
      ],
    })
    expect(normalizeComponent(authored).ingredients[0]?.quantity?.amount).toEqual({
      from: 30,
      to: 40,
    })
  })

  it('normalises the authored metric pair too', () => {
    const authored = component({
      ingredients: [
        {
          id: 'butter',
          quantity: { amount: '1/2', unit: 'cup', metric: { amount: '1/4', unit: 'L' } },
          item: 'butter',
        },
        { id: 'sugar', item: 'sugar' },
      ],
    })
    expect(normalizeComponent(authored).ingredients[0]?.quantity?.metric?.amount).toBe(0.25)
  })

  // "2 15.5 oz cans of beans" is a count and a size. Before `of` existed the size went into
  // `note`, so Phase 05 would have scaled the cans and left the ounces behind as a stale string.
  it('keeps container contents structured', () => {
    const authored = component({
      ingredients: [
        {
          id: 'butter',
          quantity: { amount: 2, unit: 'can', of: { amount: '15-1/2', unit: 'oz' } },
          item: 'beans',
        },
        { id: 'sugar', item: 'sugar' },
      ],
    })
    expect(normalizeComponent(authored).ingredients[0]?.quantity?.of).toEqual({
      amount: 15.5,
      unit: 'oz',
    })
  })

  // "large pinch of nutmeg" has a unit and no number. Inventing a 1 would be a measurement
  // the source never made.
  it('allows a unit with no amount at all', () => {
    const authored = component({
      ingredients: [
        { id: 'butter', quantity: { unit: 'pinch', approximate: true }, item: 'nutmeg' },
        { id: 'sugar', item: 'sugar' },
      ],
    })
    const quantity = normalizeComponent(authored).ingredients[0]?.quantity
    expect(quantity).toEqual({ unit: 'pinch', approximate: true })
    expect(quantity && 'amount' in quantity).toBe(false)
  })

  it('refuses an amount it cannot read rather than defaulting', () => {
    const authored = component({
      ingredients: [
        { id: 'butter', quantity: { amount: 'a lump', unit: 'cup' }, item: 'butter' },
        { id: 'sugar', item: 'sugar' },
      ],
    })
    expect(() => normalizeComponent(authored)).toThrow(/Could not read "a lump"/)
  })

  it('leaves numbers alone', () => {
    const authored = component({
      ingredients: [
        { id: 'butter', quantity: { amount: 2, unit: 'cup' }, item: 'butter' },
        { id: 'sugar', item: 'sugar' },
      ],
    })
    expect(normalizeComponent(authored).ingredients[0]?.quantity?.amount).toBe(2)
  })
})

describe('inputs written as bare ids', () => {
  it('resolves a step and an ingredient by lookup', () => {
    const authored = component({
      steps: {
        melt: { id: 'melt', inputs: ['butter'], text: 'melt', effort: 'quick' },
        cream: { id: 'cream', inputs: ['melt', 'sugar'], text: 'cream', effort: 'quick' },
      },
    })
    expect(normalizeComponent(authored).steps.cream?.inputs).toEqual([
      { kind: 'step', id: 'melt' },
      { kind: 'ingredient', id: 'sugar' },
    ])
  })

  it('honours an explicit prefix', () => {
    const authored = component({
      steps: {
        cream: {
          id: 'cream',
          inputs: ['ingredient:butter', 'step:cream'],
          text: 'cream',
          effort: 'quick',
        },
      },
    })
    expect(normalizeComponent(authored).steps.cream?.inputs).toEqual([
      { kind: 'ingredient', id: 'butter' },
      { kind: 'step', id: 'cream' },
    ])
  })

  it('passes the long form through unchanged', () => {
    const authored = component({
      steps: {
        cream: {
          id: 'cream',
          inputs: [{ kind: 'ingredient', id: 'butter' }],
          text: 'cream',
          effort: 'quick',
        },
      },
    })
    expect(normalizeComponent(authored).steps.cream?.inputs).toEqual([
      { kind: 'ingredient', id: 'butter' },
    ])
  })

  it('refuses when one id names both a step and an ingredient', () => {
    const authored = component({
      steps: { butter: { id: 'butter', inputs: ['sugar'], text: 'x', effort: 'quick' } },
      root: 'butter',
    })
    expect(() => normalizeComponent(authored)).toThrow(/names both a step and an ingredient/)
  })

  // A typo caught here names the file and the step; the same typo in the long form reaches the
  // validator as E7. Both are fine — what matters is that neither silently drops the input.
  it('refuses an id that matches nothing', () => {
    const authored = component({
      steps: { cream: { id: 'cream', inputs: ['buttr'], text: 'cream', effort: 'quick' } },
    })
    expect(() => normalizeComponent(authored)).toThrow(/matches no step or ingredient id/)
  })
})

describe('whole recipes', () => {
  it('normalises every component', () => {
    const recipe = normalizeRecipe({
      id: 'r',
      title: 'R',
      components: [component(), { ...component(), id: 'second' }],
    })
    expect(recipe.components.map((c) => c.steps.cream?.inputs[0])).toEqual([
      { kind: 'ingredient', id: 'butter' },
      { kind: 'ingredient', id: 'butter' },
    ])
  })
})

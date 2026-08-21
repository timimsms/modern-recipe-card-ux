/**
 * The authoring form, and its normalisation into the runtime model.
 *
 * This exists because of what Phase 01's transcription actually turned up. Q4 asked whether
 * raw JSON authoring is tolerable or whether the corpus needs a terse indentation-based DSL.
 * Three people transcribed four recipes independently and reported the same two frictions,
 * and neither of them needs a DSL to fix:
 *
 *  1. **Fractions become decimals.** The source prints `1-1/2 lb.` and `1/3 cup`; strict JSON
 *     forces `1.5` and `0.3333333333333333`. The second is unreviewable — you cannot proofread
 *     a transcription against a photograph when the numbers no longer look like the numbers,
 *     and dropping a `3` silently changes the amount.
 *  2. **`inputs` is 40% boilerplate.** `{ "kind": "step", "id": "cover-with-potatoes" }` is
 *     45 characters to express one edge, and Shepherd's pie has seventeen of them.
 *
 * So: strings are accepted where they read better, and normalised on load. The runtime model
 * is unchanged — every consumer downstream of `normalizeRecipe` sees exactly the strict shape
 * described in `model.ts`. This is a thin door, not a language.
 */

import type {
  Component,
  ComponentRefLeaf,
  Ingredient,
  InputRef,
  Leaf,
  Measure,
  Prelude,
  Quantity,
  Range,
  Recipe,
  Step,
  StepId,
} from './model.js'
import { parseQuantityAmount } from './quantity.js'

/** `1.5`, `{ from: 30, to: 40 }`, or any string `parseQuantityAmount` understands. */
export type AuthoredAmount = number | Range | string

export type AuthoredMeasure = Omit<Measure, 'amount' | 'metric'> & {
  amount: AuthoredAmount
  metric?: AuthoredMeasure
}

export type AuthoredQuantity = Omit<Quantity, 'amount' | 'metric' | 'of'> & {
  amount?: AuthoredAmount
  metric?: AuthoredMeasure
  of?: AuthoredMeasure
}

/**
 * `{ kind: 'step', id: 'brown' }`, or `'brown'`, or `'step:brown'`.
 *
 * A bare id is resolved by looking it up — steps and leaves live in separate namespaces, so
 * the only way it is ambiguous is if one id appears in both, which throws rather than guesses.
 */
export type AuthoredInput = InputRef | string

export type AuthoredIngredient = Omit<Ingredient, 'quantity'> & { quantity?: AuthoredQuantity }

export type AuthoredComponentRef = Omit<ComponentRefLeaf, 'quantity'> & {
  quantity?: AuthoredQuantity
}

export type AuthoredLeaf = AuthoredIngredient | AuthoredComponentRef

export type AuthoredStep = Omit<Step, 'inputs'> & { inputs: AuthoredInput[] }

export type AuthoredComponent = Omit<Component, 'ingredients' | 'steps'> & {
  ingredients: AuthoredLeaf[]
  steps: Record<StepId, AuthoredStep>
}

export type AuthoredRecipe = Omit<Recipe, 'components'> & { components: AuthoredComponent[] }

/**
 * Normalises an authored recipe into the strict runtime model.
 *
 * Throws on anything it cannot resolve unambiguously. This is deliberate and matches the rule
 * `ingredientFromLine` follows: an authoring aid that degrades into a plausible wrong answer is
 * worse than one that refuses, because everything downstream will trust the number.
 */
export function normalizeRecipe(authored: AuthoredRecipe): Recipe {
  return {
    ...authored,
    components: authored.components.map(normalizeComponent),
  }
}

export function normalizeComponent(authored: AuthoredComponent): Component {
  const leafIds = new Set(authored.ingredients.map((leaf) => leaf.id))
  const stepIds = new Set(Object.keys(authored.steps))

  const collisions = [...stepIds].filter((id) => leafIds.has(id))
  if (collisions.length > 0) {
    throw new Error(
      `Component "${authored.id}": ${collisions.map((c) => `"${c}"`).join(', ')} names both a ` +
        `step and an ingredient, so a bare input reference would be ambiguous. Rename one, or ` +
        `write the inputs in full as { "kind": …, "id": … }.`,
    )
  }

  const steps: Record<StepId, Step> = {}
  for (const [key, step] of Object.entries(authored.steps)) {
    steps[key] = {
      ...step,
      inputs: step.inputs.map((input) => resolveInput(input, authored.id, key, stepIds, leafIds)),
    }
  }

  return {
    ...authored,
    ingredients: authored.ingredients.map(normalizeLeaf),
    steps,
    prelude: authored.prelude as Prelude[],
  }
}

function resolveInput(
  input: AuthoredInput,
  componentId: string,
  stepId: string,
  stepIds: ReadonlySet<string>,
  leafIds: ReadonlySet<string>,
): InputRef {
  if (typeof input !== 'string') return input

  const explicit = input.match(/^(step|ingredient):(.+)$/)
  if (explicit) {
    return { kind: explicit[1] as InputRef['kind'], id: explicit[2] as string }
  }

  if (stepIds.has(input)) return { kind: 'step', id: input }
  if (leafIds.has(input)) return { kind: 'ingredient', id: input }

  // Left unresolved rather than guessed at — the validator reports it as E7 with the same
  // wording every other dangling reference gets, which is where an author will look for it.
  throw new Error(
    `Component "${componentId}", step "${stepId}": input "${input}" matches no step or ` +
      `ingredient id. Check the spelling, or write it in full as { "kind": …, "id": … }.`,
  )
}

function normalizeLeaf(leaf: AuthoredLeaf): Leaf {
  if (!leaf.quantity) return leaf as Leaf
  return { ...leaf, quantity: normalizeQuantity(leaf.quantity, leaf.id) } as Leaf
}

export function normalizeQuantity(quantity: AuthoredQuantity, context: string): Quantity {
  const { amount, metric, of, ...rest } = quantity
  const normalized: Quantity = { ...rest }
  if (amount !== undefined) normalized.amount = normalizeAmount(amount, context)
  if (metric) normalized.metric = normalizeMeasure(metric, `${context} (metric)`)
  if (of) normalized.of = normalizeMeasure(of, `${context} (contents)`)
  return normalized
}

function normalizeMeasure(measure: AuthoredMeasure, context: string): Measure {
  const { metric, ...rest } = measure
  const normalized: Measure = { ...rest, amount: normalizeAmount(measure.amount, context) }
  if (metric) normalized.metric = normalizeMeasure(metric, `${context} (metric)`)
  return normalized
}

function normalizeAmount(amount: AuthoredAmount, context: string): number | Range {
  if (typeof amount !== 'string') return amount

  const parsed = parseQuantityAmount(amount)
  if (parsed === undefined) {
    throw new Error(
      `Could not read "${amount}" as an amount (in ${context}). Accepted forms: 2, 1.5, 1/4, ` +
        `1-1/2, 1½, "30 to 40".`,
    )
  }
  return parsed
}

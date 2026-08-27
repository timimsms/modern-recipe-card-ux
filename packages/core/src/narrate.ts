/**
 * The structural narrative — the convergence grid said in words.
 *
 * PHASE-06's framing, and it is the right one: a 2D dependency diagram has no natural reading
 * order, and the format's whole claim — "these things happen separately, then converge" — is
 * carried by geometry. Geometry is not available to a screen reader, to a phone held sideways,
 * or to anyone whose hands are covered in flour. Restating the structure in language is
 * therefore not a fallback. On the format's central insight it is arguably the better interface,
 * because it can *say* the thing the chart can only show.
 *
 * Returns structure, not a paragraph. A renderer decides whether this becomes visually-hidden
 * text, a "read it to me" mode, or a printed appendix; deciding that here would put a
 * presentation choice in `core`.
 *
 * The house rule from `describeOutput` applies throughout: **vague beats wrong**. A cook can
 * recover from "the mixture so far" by looking at the step in front of them. They cannot recover
 * from being told confidently that it is the browned butter when it is the beef.
 */

import { isRange } from './quantity.js'
import {
  childSteps,
  describeOutput,
  findLeaf,
  isComponentRef,
  isUnattended,
  stepsOf,
  subtreeSteps,
  type Component,
  type Leaf,
  type Quantity,
  type Range,
  type Recipe,
  type Step,
  type StepId,
  type Unit,
} from './model.js'
import { cookSchedule, whileThisRuns } from './cook.js'
import { formatAmount } from './quantity.js'

export type StepNarration = {
  id: StepId
  /** Position in the narrated order, which is cook order rather than grid order. */
  position: number
  of: number
  /** "Fold in." — the instruction itself. */
  action: string
  /** "Takes the mixed wet ingredients and the sifted dry ingredients." */
  takes: string
  /** "Produces the batter." Absent for the final step, which produces the dish. */
  produces?: string
  /** "About 40 minutes, and you can walk away." */
  effort: string
  /**
   * "While this bakes, nothing else is pending."
   *
   * Measured over the corpus this says "nothing else" on 66 of 66 steps — see Q2. It is stated
   * anyway, because *knowing* there is nothing else to do is the useful half of the claim, and
   * silence would leave the reader wondering whether they had missed something.
   */
  alongside: string
  /** Everything above, joined — what a "read it to me" mode would speak. */
  spoken: string
}

/** Which system the spoken quantities use. See `spokenQuantity` for why `both` is not default. */
export type SpokenUnits = 'imperial' | 'metric' | 'both'

export type NarrateOptions = {
  units?: SpokenUnits
  title?: string
  /**
   * Whether this component ends the recipe. Only the final root produces "the dish"; every other
   * component root produces the thing the next component consumes, and shepherd's pie's "season
   * to taste" said nothing at all — losing the link between the mashed potatoes and the pie that
   * eats them.
   */
  final?: boolean
}

export type Narration = {
  /** A paragraph describing the shape of the tree before any step is read out. */
  summary: string
  steps: StepNarration[]
}

// --- Phrasing helpers ---------------------------------------------------------------------------

const list = (items: string[]): string => {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]!
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

/**
 * Joins whole clauses, where `list` joins noun phrases.
 *
 * "at X, where A and B come together and at Y, where C and D come together" has four `and`s and
 * no way to hear where one clause ends. Semicolons give the ear the boundary.
 */
const clauses = (items: string[]): string => {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]}; and ${items[1]}`
  return `${items.slice(0, -1).join('; ')}; and ${items.at(-1)}`
}

const leafName = (leaf: Leaf): string =>
  isComponentRef(leaf) ? (leaf.label ?? leaf.component) : leaf.item

/**
 * An ingredient with its amount, for a reader who cannot see the quantity column.
 *
 * Deliberately spoken as "4 ounces of unsalted butter" rather than "4 oz unsalted butter": the
 * abbreviations exist to fit a narrow column, and a column is exactly what this reader does not
 * have.
 */
const SPOKEN_UNITS: Record<string, [string, string]> = {
  tsp: ['teaspoon', 'teaspoons'],
  Tbs: ['tablespoon', 'tablespoons'],
  cup: ['cup', 'cups'],
  oz: ['ounce', 'ounces'],
  lb: ['pound', 'pounds'],
  g: ['gram', 'grams'],
  kg: ['kilogram', 'kilograms'],
  mL: ['millilitre', 'millilitres'],
  L: ['litre', 'litres'],
  can: ['can', 'cans'],
  clove: ['clove', 'cloves'],
  pinch: ['pinch', 'pinches'],
}

/** English takes the singular below one: "¼ teaspoon", not "¼ teaspoons". */
const isPlural = (amount: number | Range): boolean => (isRange(amount) ? amount.to : amount) > 1

function spokenMeasure(measure: { amount: number | Range; unit: Unit }): string {
  const amount = formatAmount(measure.amount)
  if (measure.unit === 'count') return amount
  const spoken = SPOKEN_UNITS[measure.unit]
  // An unrecognised unit still needs a plural: "2 pack of chicken thighs" was the first thing
  // the corpus's tenth recipe said out loud. Naive -s, because the alternative is a dictionary,
  // and the known units — the ones with irregular spoken forms — are already in the table.
  if (!spoken) {
    return `${amount} ${measure.unit}${isPlural(measure.amount) ? 's' : ''}`
  }
  return `${amount} ${isPlural(measure.amount) ? spoken[1] : spoken[0]}`
}

/**
 * `both` is offered but is not the default here, and that is a deliberate departure from R6.
 *
 * R6's parity rule is about a *column*, where showing both costs a few characters and letting
 * one hide in parentheses makes it second-class. Speech is linear: reading "4 ounces, or 115
 * grams, of unsalted butter" for every line roughly doubles how long the ingredient list takes
 * to hear, and the listener cannot skim past the half they do not use. So the caller picks one,
 * and picking is cheap. Parity is preserved by making neither the hard-coded answer.
 */
function spokenQuantity(leaf: Leaf, units: SpokenUnits): string {
  const quantity = leaf.quantity
  const name = leafName(leaf)
  return quantity ? spokenMeasured(quantity, name, units) : name
}

/** A quantity and the thing it measures. Shared by leaf totals and per-step portions. */
function spokenMeasured(quantity: Quantity, name: string, units: SpokenUnits): string {
  if (quantity.amount === undefined) return `${quantity.unit} of ${name}`

  const imperial = { amount: quantity.amount, unit: quantity.unit }
  const metric = quantity.metric

  if (units === 'metric' && metric) return `${spokenMeasure(metric)} of ${name}`

  const primary = spokenMeasure(imperial)
  // A parenthetical, not ", or 110 grams," — the comma form buried the ingredient between two
  // numbers and produced "1, or 110 grams, medium onion", which has to be read twice.
  const pair = units === 'both' && metric ? ` (${spokenMeasure(metric)})` : ''

  return quantity.unit === 'count' ? `${primary} ${name}${pair}` : `${primary}${pair} of ${name}`
}

/** A sentence, whatever the fragment handed in looked like. */
const sentence = (text: string): string => {
  const trimmed = text.trim()
  if (trimmed === '') return ''
  const capitalised = trimmed[0]!.toUpperCase() + trimmed.slice(1)
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`
}

function spokenDuration(step: Step): string {
  if (!step.duration) return ''
  const unit = { sec: 'second', min: 'minute', hour: 'hour', day: 'day' }[step.duration.unit]
  const plural = (n: number) => `${formatAmount(n)} ${unit}${n === 1 ? '' : 's'}`
  return step.duration.max !== undefined && step.duration.max !== step.duration.min
    ? `${formatAmount(step.duration.min)} to ${plural(step.duration.max)}`
    : plural(step.duration.min)
}

// --- The summary --------------------------------------------------------------------------------

/**
 * The shape of the tree, before any instruction is read.
 *
 * This is the sentence the chart draws and a numbered list cannot: where separate work is going
 * on, and where it comes together.
 *
 * The first version described the *root's* inputs, on the reasoning that the root is the final
 * convergence. Run over the corpus it called all nine components "one strand of work", which is
 * false — four of them branch. No root in the corpus has two step inputs, so the one place the
 * summary looked was the one place it never happens. It reads every join now.
 */
function summarise(component: Component, title: string): string {
  const steps = stepsOf(component)
  const leaves = component.ingredients.length
  const root = component.steps[component.root]
  if (!root || steps.length === 0) return `${title}: nothing to do.`

  const scale =
    `${title}: ${leaves} ingredient${leaves === 1 ? '' : 's'}, ` +
    `${steps.length} step${steps.length === 1 ? '' : 's'}, about ${spokenTotal(component)}.`

  const joins = steps
    .map((step) => ({ step, strands: childSteps(component, step) }))
    .filter((join) => join.strands.length > 1)

  if (joins.length === 0) {
    return `${scale} A single run: each step builds on the one before, ending with ${quoted(root)}.`
  }

  const described = joins.map(({ step, strands }) => {
    const named = strands.map((strand) => describeOutput(component, strand.id))
    return `at ${quoted(step)}, where ${list(named)} come together`
  })

  // "Mostly a single run" is the honest shape here: measured across the corpus these joins are
  // almost always one prepared thing meeting a long spine, not two equal branches — which is the
  // same structural fact P02 and Q2 found from the timing side.
  const spine = joins.every(({ strands }) =>
    strands.some((strand) => subtreeSteps(component, strand.id).length === 1),
  )
  const lead = spine
    ? `Mostly a single run, with ${joins.length} place${joins.length === 1 ? '' : 's'} where separate work joins it`
    : `${joins.length} place${joins.length === 1 ? '' : 's'} where separate work comes together`

  return `${scale} ${lead}: ${clauses(described)}. It ends with ${quoted(root)}.`
}

const quoted = (step: Step): string => `"${step.text.replace(/\s+/g, ' ').trim()}"`

// --- Per-step -----------------------------------------------------------------------------------

function narrateStep(
  component: Component,
  id: StepId,
  position: number,
  of: number,
  done: Set<StepId>,
  units: SpokenUnits,
  final: boolean,
): StepNarration {
  const step = component.steps[id]!

  // Inputs named explicitly. On the chart an input is the cell physically next to you, which is
  // why the chart can leave it unnamed; read aloud, "the previous step" is useless.
  const taken = step.inputs.map((input) => {
    if (input.kind === 'step') {
      const name = describeOutput(component, input.id)
      return { spoken: name, bare: name }
    }
    const leaf = findLeaf(component, input.id)
    if (!leaf) return { spoken: input.id, bare: input.id }

    /**
     * A shared leaf is spoken as *this step's* share.
     *
     * `input.portion` is the model's answer to the gap Q8 found: the leaf carries the total,
     * because that is what you shop for, and the input carries the share, because that is what
     * you measure. Without it the pulled chicken announced its full 1½ cups of barbecue sauce at
     * both consumers, when the split is 1 cup and ½ cup.
     *
     * Where a split leaf has *no* portion — W7 says so, and salt seasoned twice never will —
     * "part of" is the honest fallback. Vague and true beats a share this file would be guessing
     * at.
     */
    const shared = (component.reuse ?? []).some((r) => r.leaf === input.id)
    if (input.portion) {
      return { spoken: spokenMeasured(input.portion, leafName(leaf), units), bare: leafName(leaf) }
    }
    const spoken = spokenQuantity(leaf, units)
    return {
      spoken: shared && !isComponentRef(leaf) && leaf.quantity ? `part of the ${spoken}` : spoken,
      bare: leafName(leaf),
    }
  })
  const takes = taken.length === 0 ? '' : `Takes ${list(taken.map((t) => t.spoken))}.`

  const output = describeOutput(component, id)
  const isRoot = id === component.root

  // "Takes 3 tablespoons of vegetable oil. Produces the vegetable oil." is true and reads like a
  // bug. It happens when `describeOutput` has no `technique` to build a participle from and so
  // names the output after its own input. Saying nothing is honest: the step text already said
  // what was done to it.
  const bare = (text: string) => text.replace(/^the /i, '').trim().toLowerCase()
  const restatesInput = taken.some((t) => bare(t.bare) === bare(output))

  const produces = isRoot
    ? // The last root produces the dish, which the title already named. Any other root ends a
      // part that a later component consumes, and that link is the thing a listener cannot see.
      final
      ? undefined
      : `That finishes ${output}.`
    : restatesInput
      ? undefined
      : `Produces ${output}.`

  const duration = spokenDuration(step)
  const walkAway = isUnattended(step.effort)
  const effort = duration
    ? `${sentence(duration)}${walkAway ? ' You can walk away.' : ''}`
    : walkAway
      ? 'You can walk away.'
      : ''

  // Q2 measured this as "nothing else" on every step of the corpus. Said anyway: knowing there
  // is nothing else to start is the useful half, and silence reads as an omission.
  const others = whileThisRuns(component, id, done)
  const alongside = !walkAway
    ? ''
    : others.length > 0
      ? `While this runs you could start ${list(others.map((other) => quoted(component.steps[other]!)))}.`
      : 'While this runs, nothing else is pending.'

  const spoken = [
    `Step ${position} of ${of}.`,
    sentence(step.text),
    takes,
    produces,
    effort,
    alongside,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')

  return {
    id,
    position,
    of,
    action: sentence(step.text),
    takes,
    ...(produces ? { produces } : {}),
    effort,
    alongside,
    spoken,
  }
}

/**
 * Narrates one component in **cook order**, not grid order.
 *
 * `plan.linearization` is a valid topological order and reads worse: it is derived from the
 * layout, so it walks the chart rather than the kitchen. `cookSchedule` is the order the cook
 * mode already uses, and having the spoken version disagree with the tapped version would be its
 * own accessibility failure.
 */
export function narrateComponent(component: Component, options: NarrateOptions = {}): Narration {
  const units = options.units ?? 'imperial'
  const final = options.final ?? true
  const order = cookSchedule(component).order
  const done = new Set<StepId>()
  const steps = order.map((id, index) => {
    const narration = narrateStep(component, id, index + 1, order.length, done, units, final)
    done.add(id)
    return narration
  })
  return {
    summary: summarise(component, options.title ?? component.title ?? 'This part'),
    steps,
  }
}

/**
 * The whole recipe, components in order.
 *
 * Components are sequential and the later one consumes the earlier one's output, so they are
 * narrated in order with the position counted across the recipe — "step 4 of 15", matching what
 * cook mode shows. A per-component count would tell a reader they were on step 1 after twenty
 * minutes of work.
 */
export function narrate(recipe: Recipe, options: NarrateOptions = {}): Narration {
  const parts = recipe.components.map((component, index) =>
    narrateComponent(component, {
      ...options,
      title: component.title ?? recipe.title,
      final: index === recipe.components.length - 1,
    }),
  )
  const total = parts.reduce((sum, part) => sum + part.steps.length, 0)

  let position = 0
  const steps = parts.flatMap((part) =>
    part.steps.map((step) => {
      position += 1
      const renumbered = { ...step, position, of: total }
      return {
        ...renumbered,
        spoken: step.spoken.replace(/^Step \d+ of \d+\./, `Step ${position} of ${total}.`),
      }
    }),
  )

  const summary =
    recipe.components.length === 1
      ? parts[0]!.summary
      : `${recipe.title}: ${recipe.components.length} parts, made in order. ` +
        parts.map((part) => part.summary).join(' ')

  return { summary, steps }
}

/**
 * How long this takes, start to finish, as a phrase.
 *
 * The schedule's wall clock rather than the sum of every step: a step that overlaps a wait does
 * not add to the time the cook stands in the kitchen, and summing said "1 hour 1 minute" for a
 * stroganoff that takes less. Same number the at-a-glance bar prints, so the spoken version and
 * the seen version cannot disagree.
 */
export function spokenTotal(component: Component): string {
  const minutes = Math.round(cookSchedule(component).totalMinutes)
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  if (minutes < 60) return unit(minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? unit(hours, 'hour') : `${unit(hours, 'hour')} ${unit(rest, 'minute')}`
}

/**
 * The assembly tree — the data model for a recipe.
 *
 * A recipe is not a list. It is a tree of convergence: ingredients are leaves, steps are
 * internal nodes that consume leaves and other steps, and the finished dish is the root.
 *
 * The source format (a 2004 HTML table) has no tree in it — the structure is *implied* by
 * rowspan geometry, and recovering it is ambiguous and lossy. So this model is tree-first
 * and geometry is derived from it in Phase 02, never the reverse.
 *
 * Nothing here knows about columns, spans, or pixels. See GAMEPLAN.md §3 for vocabulary.
 *
 * **This is the runtime shape, not the on-disk one.** Corpus files are written in the looser
 * authoring form — `"amount": "1-1/2"`, `"inputs": ["brown", "onion"]` — and normalised into
 * these types on load. If you are about to transcribe a recipe, read `authoring.ts` and
 * `packages/corpus/README.md` first; reading this file alone will mislead you about the format
 * you actually type.
 */

export type RecipeId = string
export type ComponentId = string
export type IngredientId = string
export type StepId = string
export type PreludeId = string
export type GroupId = string

// --- Recipe ----------------------------------------------------------------------------

export type Recipe = {
  id: RecipeId
  title: string
  /** Free text as the source wrote it: "serves 4 when served over noodles or rice". */
  yield?: string
  /**
   * The one field of the at-a-glance bar that is not derived. Everything else — start to
   * finish, hands-on, longest walk-away, saved in parallel — falls out of the tree.
   * Also the basis for Phase 05's scaling.
   */
  servings?: number
  /** Ordered. A later component may reference an earlier one; never the reverse (I5). */
  components: Component[]
  source?: { name: string; url?: string }
}

/** One sub-recipe = one tree. "Mashed potatoes" inside "Shepherd's pie". */
export type Component = {
  id: ComponentId
  /** Omitted for single-component recipes. */
  title?: string
  /** Full-width bands that apply across the component: "Preheat oven to 400°F". */
  prelude: Prelude[]
  /**
   * The ingredient column, top to bottom. Holds both plain ingredients and references to
   * earlier components' outputs. Validated against the tree for contiguity (I1).
   */
  ingredients: Leaf[]
  root: StepId
  /** Flat storage keyed by id — nested literals are nicer to read but painful to diff. */
  steps: Record<StepId, Step>
  /**
   * Leaves the author knows are consumed by more than one step ("reserve half the butter").
   * That makes the tree a DAG and the layout non-planar, so it has to be deliberate — an
   * undeclared multi-consumed leaf is validation error E5. *How* it renders is a layout
   * option in Phase 02, not an authoring decision (I4).
   */
  reuse?: ReuseDeclaration[]
}

export type ReuseDeclaration = {
  leaf: IngredientId
  /** Why the split exists: "half now, half for the topping". */
  note?: string
}

/**
 * A step with no inputs, applying to the whole component rather than to specific ones.
 * Rendered as CFE's full-width `colspan` first row.
 */
export type Prelude = {
  id: PreludeId
  text: string
  temperature?: Temperature
  equipment?: string[]
}

// --- Leaves ----------------------------------------------------------------------------

export type Ingredient = {
  id: IngredientId
  /** Omitted entirely for "salt and pepper" and other unmeasured items. */
  quantity?: Quantity
  /** "unsalted butter" — the item alone, with preparation split out into `note`. */
  item: string
  /** "drained, chopped", "Cento", "at room temperature". */
  note?: string
  optional?: boolean
  /**
   * Presentational only. A garnish still has to reach the root through an explicit step
   * (the convention is a `serve` root that consumes the dish plus its garnishes) — this
   * field changes how it renders, never whether it validates. See EDGE-CASES E5.
   */
  role?: 'ingredient' | 'garnish' | 'accompaniment'
}

/**
 * A reference to another component's output, consumed as though it were an ingredient.
 * Shepherd's pie eats the mashed-potatoes component this way (I5). Modelled as a
 * first-class node so the layout engine can draw the seam, not as a magic string.
 */
export type ComponentRefLeaf = {
  id: IngredientId
  /** Must name a component defined *earlier* in `Recipe.components`. */
  component: ComponentId
  /**
   * How much of it this component takes. Shepherd's pie calls for "1-3/4 lb. (800 g) mashed
   * potatoes" — a real, scalable, metric-paired quantity — while the mashed-potatoes component
   * itself yields roughly 700 g of potato plus water and butter. Without this field the number
   * has nowhere to live but `note`, where Phase 05's scaling cannot see it.
   */
  quantity?: Quantity
  /** Overrides the referenced component's title in the ingredient column, if given. */
  label?: string
  note?: string
}

/** The ingredient column holds both kinds of leaf. */
export type Leaf = Ingredient | ComponentRefLeaf

export function isComponentRef(leaf: Leaf): leaf is ComponentRefLeaf {
  return 'component' in leaf
}

// --- Quantities ------------------------------------------------------------------------

export type Range = { from: number; to: number }

/** A plain number-and-unit pair. Always has an amount. */
export type Measure = {
  /** "30 to 40 min" and "3–4 cloves" are ranges, not averages. */
  amount: number | Range
  unit: Unit
  metric?: Measure
}

export type Quantity = {
  /**
   * Optional, because "large pinch of nutmeg" has a unit and no number. Omitting it is not
   * the same as `approximate` — approximate says the number is a gesture, this says there
   * is no number at all, and the rule against inventing one is absolute.
   */
  amount?: number | Range
  unit: Unit
  /**
   * Authored, never computed. The sources round deliberately and inconsistently —
   * the shepherd's pie source photo has both `400°F (204°C)` and `400°F (205°C)` in one recipe. Preserving the
   * author's rounding is more faithful than being arithmetically correct; the validator
   * surfaces the discrepancy as a warning rather than silently fixing it.
   */
  metric?: Measure
  /**
   * What one of `unit` contains: `2 15.5 oz cans of beans` is
   * `{ amount: 2, unit: 'can', of: { amount: 15.5, unit: 'oz' } }`.
   *
   * Without this the size has nowhere to go but `note`, and Phase 05 would scale the *cans*
   * while the ounces sat beside them as a stale string. Two of the sixteen ingredients in
   * `spinach-artichoke-skillet` need it, so this is a modelling gap, not a nicety.
   */
  of?: Measure
  /** "1 pinch", "a splash" — a number is present but is not a measurement. */
  approximate?: boolean
}

/**
 * Open vocabulary with a known core. The known set is what R6's typographic rules key off
 * (unit parity, spacing, abbreviation); anything outside it renders verbatim and warns.
 */
export type KnownUnit =
  | 'g'
  | 'kg'
  | 'mg'
  | 'oz'
  | 'lb'
  | 'mL'
  | 'L'
  | 'tsp'
  | 'Tbs'
  | 'cup'
  | 'pint'
  | 'quart'
  | 'gallon'
  | 'fl oz'
  | 'clove'
  | 'can'
  | 'pinch'
  | 'dash'
  | 'stick'
  | 'slice'
  | 'sprig'
  | 'bunch'
  | 'piece'
  | 'in'
  | 'cm'
  | 'count'

// The `& {}` keeps editor autocomplete for KnownUnit while still admitting anything.
export type Unit = KnownUnit | (string & {})

export const KNOWN_UNITS: readonly KnownUnit[] = [
  'g',
  'kg',
  'mg',
  'oz',
  'lb',
  'mL',
  'L',
  'tsp',
  'Tbs',
  'cup',
  'pint',
  'quart',
  'gallon',
  'fl oz',
  'clove',
  'can',
  'pinch',
  'dash',
  'stick',
  'slice',
  'sprig',
  'bunch',
  'piece',
  'in',
  'cm',
  'count',
]

const METRIC_UNITS = new Set<Unit>(['g', 'kg', 'mg', 'mL', 'L', 'cm'])

export function isMetricUnit(unit: Unit): boolean {
  return METRIC_UNITS.has(unit)
}

// --- Steps -----------------------------------------------------------------------------

/**
 * A step consumes leaves and other steps — and nothing else. A cross-component reference is
 * a *leaf* (`ComponentRefLeaf`) occupying a row in the ingredient column, so it arrives here
 * as `{ kind: 'ingredient' }` like any other row. One mechanism, not two.
 */
export type InputRef =
  | {
      kind: 'ingredient'
      id: IngredientId
      /**
       * How much of the leaf *this* step takes, when the leaf is split between several.
       *
       * The share belongs to the consumption, not to the ingredient: the leaf carries the total,
       * because that is what you shop for, and each step carries its portion, because that is
       * what you measure out. Putting it on `ReuseDeclaration` instead would mean restating step
       * ids that `inputs` already lists, and keeping the two in step.
       *
       * Absent for the overwhelmingly common case of a leaf with one consumer, where the portion
       * *is* the total. Also absent where there is nothing to divide — salt and pepper are
       * seasoned twice and measured neither time.
       *
       * Discovered by narrating the BBQ pulled chicken, whose 1½ cups
       * of barbecue sauce is 1 cup into the sauce and ½ cup stirred through at the end. Both
       * consumers announced the full 1½ cups, which is wrong at both ends. The chart never had
       * to face it: a quantity sits in the ingredient column beside the ingredient, never beside
       * a step. See Q8.
       */
      portion?: Quantity
    }
  | { kind: 'step'; id: StepId }

export type Step = {
  id: StepId
  /** Order matters: it is the top-to-bottom order of the rows this step spans. */
  inputs: InputRef[]
  /** "cook until meat is no longer pink". Always required, even when `technique` is set. */
  text: string
  /**
   * What this step produces, as a cook would refer to it later: "the browned beef", "the sifted
   * dry ingredients".
   *
   * The grid never needs this — on a chart the output of a step is the cell you can see, and
   * pointing at it is enough. Cook mode shows one step at a time, so its inputs have to be
   * *named*, and the original format leaves every intermediate result anonymous. Optional,
   * because `describeOutput` derives a usable fallback.
   */
  outputName?: string
  /**
   * Required and cheap. Drives the duration glyph and Phase 04's parallelism banner.
   * See findings/Q5-time-axis.md — the design cannot render more precision than this.
   */
  effort: Effort
  /** Optional. Timers and the at-a-glance bar only; never layout. */
  duration?: Duration
  temperature?: Temperature
  /** Optional closed vocabulary *alongside* the free text, never instead of it. */
  technique?: Technique
  /** Feeds the equipment-contention check that makes the parallelism banner honest (E4). */
  equipment?: string[]
  /** "Fold every 30 minutes, 4 times" is one instruction with a cadence, not four steps (E3). */
  repeat?: Repeat
  /** Explicit grouping hint for the R4/R5 shading. Derived grouping is the default. */
  group?: GroupId
}

/**
 * Ordinal effort buckets. Resolved by findings/Q5-time-axis.md: a cook reading a duration
 * bar cannot distinguish 1 min from 2 min, so requiring an authored duration on every step
 * is a permanent authoring burden for precision the design cannot render.
 *
 * `passive` sits above `long-unattended` (EDGE-CASES E2): overnight rests and multi-day
 * cures are excluded from bar scaling entirely, because scaled against a 3-day step a
 * 30-minute bake becomes a sub-pixel sliver.
 */
export type Effort = 'quick' | 'minutes' | 'long-unattended' | 'passive'

export const EFFORTS: readonly Effort[] = ['quick', 'minutes', 'long-unattended', 'passive']

/** Can the cook walk away? The one boolean the duration glyph actually needs. */
export function isUnattended(effort: Effort): boolean {
  return effort === 'long-unattended' || effort === 'passive'
}

/**
 * Excluded from duration-bar scaling and from "start to finish" as a single number.
 * A 3-day elapsed figure is true but useless; the cook wants active sessions.
 */
export function isPassive(effort: Effort): boolean {
  return effort === 'passive'
}

export type Repeat = {
  times: number
  /** The gap between repetitions: "every 30 minutes". */
  every?: Duration
}

export type DurationUnit = 'sec' | 'min' | 'hour' | 'day'

export type Duration = {
  min: number
  /** Present when the source gave a range: "30 to 40 min". */
  max?: number
  unit: DurationUnit
}

const MINUTES_PER: Record<DurationUnit, number> = {
  sec: 1 / 60,
  min: 1,
  hour: 60,
  day: 60 * 24,
}

/** Normalises to minutes so Phase 02 can add durations across mixed units. */
export function durationToMinutes(d: Duration, bound: 'min' | 'max' = 'max'): number {
  const value = bound === 'max' ? (d.max ?? d.min) : d.min
  return value * MINUTES_PER[d.unit]
}

/**
 * Ordinal fallbacks, used only when a step has no authored duration. They exist so the
 * at-a-glance bar can say something useful about a recipe nobody has timed; the layout engine's
 * `basis` field records that the numbers came from here rather than from the source.
 */
const EFFORT_MINUTES: Record<Effort, number> = {
  quick: 2,
  minutes: 6,
  'long-unattended': 30,
  passive: 480,
}

/**
 * Elapsed minutes for one step, including any repeat cadence.
 *
 * Lives here rather than in the layout engine because the timing summary, the cook schedule and
 * the progress bar must agree to the minute. Three copies of this had already drifted apart into
 * three files before the fourth caller made the problem obvious.
 */
export function stepMinutes(step: Step): number {
  const base = step.duration ? durationToMinutes(step.duration) : EFFORT_MINUTES[step.effort]
  if (!step.repeat) return base
  const gap = step.repeat.every ? durationToMinutes(step.repeat.every) : 0
  // "fold every 30 min, 3 times" is one instruction with a cadence: the folds themselves are
  // trivial, the elapsed time is the waiting between them.
  return base * step.repeat.times + gap * Math.max(0, step.repeat.times - 1)
}

export type Temperature = {
  f?: number
  c?: number
  /** "medium heat", "low" — a setting rather than a number. */
  label?: string
}

/**
 * Closed set, deliberately small. A closed vocabulary is what makes icons and
 * technique-based color coding possible (a candidate answer to R5); the required free
 * `text` is what keeps it from fighting the reality of how recipes are written.
 */
export type Technique =
  | 'mix'
  | 'fold'
  | 'whisk'
  | 'sift'
  | 'cream'
  | 'knead'
  /**
   * Distinct from `knead`, and the corpus needed it: the no-knead bread's shaping step was
   * tagged `knead` for want of anything better, so `describeOutput` called its output "the
   * kneaded mixture" — in a recipe whose name is No-Knead Bread.
   */
  | 'shape'
  | 'chop'
  | 'slice'
  | 'trim'
  | 'peel'
  | 'measure'
  | 'melt'
  | 'brown'
  | 'sear'
  | 'saute'
  | 'simmer'
  | 'boil'
  | 'steam'
  | 'grill'
  | 'roast'
  | 'bake'
  | 'broil'
  | 'fry'
  | 'chill'
  | 'freeze'
  | 'rest'
  | 'ferment'
  | 'marinate'
  | 'drain'
  /** Pulling cooked meat apart with forks. The corpus gained a recipe named after it. */
  | 'shred'
  | 'season'
  | 'brush'
  | 'assemble'
  | 'serve'

export const TECHNIQUES: readonly Technique[] = [
  'mix',
  'fold',
  'whisk',
  'sift',
  'cream',
  'knead',
  'shape',
  'chop',
  'slice',
  'trim',
  'peel',
  'measure',
  'melt',
  'brown',
  'sear',
  'saute',
  'simmer',
  'boil',
  'steam',
  'grill',
  'roast',
  'bake',
  'broil',
  'fry',
  'chill',
  'freeze',
  'rest',
  'ferment',
  'marinate',
  'drain',
  'shred',
  'season',
  'brush',
  'assemble',
  'serve',
]

// --- Traversal helpers -----------------------------------------------------------------
// Small, pure, and shared. Every consumer needs these and none of them should reimplement
// them — a track with its own subtly different leaf ordering is exactly how the bake-off
// stops measuring what it claims to measure.

export function stepsOf(component: Component): Step[] {
  return Object.values(component.steps)
}

/** Direct child steps, in input order. */
export function childSteps(component: Component, step: Step): Step[] {
  const children: Step[] = []
  for (const input of step.inputs) {
    if (input.kind !== 'step') continue
    const child = component.steps[input.id]
    if (child) children.push(child)
  }
  return children
}

/**
 * Leaf ids in depth-first input order under `step`. This is *the* canonical ordering: the
 * ingredient column must match it or the layout violates leaf contiguity (I1), and the
 * validator's suggested reordering is built from it.
 */
export function leafOrder(component: Component, stepId: StepId = component.root): IngredientId[] {
  const seen = new Set<StepId>()
  const out: IngredientId[] = []

  const walk = (id: StepId): void => {
    if (seen.has(id)) return
    seen.add(id)
    const step = component.steps[id]
    if (!step) return
    for (const input of step.inputs) {
      if (input.kind === 'step') walk(input.id)
      else out.push(input.id)
    }
  }

  walk(stepId)
  return out
}

/** Every step id in `step`'s subtree, including `step` itself. */
export function subtreeSteps(component: Component, stepId: StepId): StepId[] {
  const seen = new Set<StepId>()
  const walk = (id: StepId): void => {
    if (seen.has(id)) return
    const step = component.steps[id]
    if (!step) return
    seen.add(id)
    for (const child of childSteps(component, step)) walk(child.id)
  }
  walk(stepId)
  return [...seen]
}

/** The leaf that an id refers to, whether it is an ingredient or a cross-component ref. */
export function findLeaf(component: Component, id: IngredientId): Leaf | undefined {
  return component.ingredients.find((leaf) => leaf.id === id)
}

/**
 * Past participles for the techniques where the English is irregular enough that appending "-ed"
 * would be wrong. Everything else takes the regular rule.
 */
const PARTICIPLES: Partial<Record<Technique, string>> = {
  mix: 'mixed',
  slice: 'sliced',
  chop: 'chopped',
  sift: 'sifted',
  whisk: 'whisked',
  cream: 'creamed',
  knead: 'kneaded',
  shape: 'shaped',
  melt: 'melted',
  brown: 'browned',
  sear: 'seared',
  saute: 'sautéed',
  simmer: 'simmered',
  boil: 'boiled',
  steam: 'steamed',
  grill: 'grilled',
  roast: 'roasted',
  bake: 'baked',
  broil: 'broiled',
  fry: 'fried',
  chill: 'chilled',
  freeze: 'frozen',
  rest: 'rested',
  ferment: 'fermented',
  marinate: 'marinated',
  drain: 'drained',
  shred: 'shredded',
  season: 'seasoned',
  brush: 'brushed',
  fold: 'folded',
  peel: 'peeled',
  trim: 'trimmed',
  assemble: 'assembled',
  serve: 'served',
  measure: 'measured',
}

/**
 * What to call a step's result when it is referred to from somewhere else.
 *
 * Prefers the authored `outputName` and is deliberately vague without one.
 *
 * The obvious generator — technique plus the step's own ingredients — is wrong far more often
 * than it looks. It reads the *additions* as the subject, which only holds for a step with no
 * step inputs. Applied to the corpus it produced "the browned butter" for the stroganoff step
 * that browns beef in butter, "the seasoned paprika" for covering a pie with paprika, and "the
 * mixed all-purpose flour" for a meat mixture that flour was stirred into. Each is confident,
 * fluent, and false.
 *
 * So: name the ingredients only when they are demonstrably the whole subject, and otherwise say
 * "the simmered mixture" — vague, but never a lie. A cook can work out what the vague phrase
 * refers to from the step in front of them; they cannot recover from being told the wrong thing.
 */
export function describeOutput(component: Component, id: StepId): string {
  const step = component.steps[id]
  if (!step) return 'the previous step'
  if (step.outputName) return step.outputName

  const participle = step.technique ? PARTICIPLES[step.technique] : undefined
  const buildsOnAnotherStep = step.inputs.some((i) => i.kind === 'step')

  if (!buildsOnAnotherStep) {
    // A pure prep step: its ingredients really are the whole of what it produced.
    const leaves = step.inputs
      .map((i) => findLeaf(component, i.id))
      .filter((leaf): leaf is Leaf => leaf !== undefined)
      .map((leaf) => (isComponentRef(leaf) ? (leaf.label ?? leaf.component) : leaf.item))

    if (leaves.length > 0 && leaves.length <= 2) {
      const subject = leaves.join(' and ')
      return participle ? `the ${participle} ${subject}` : `the ${subject}`
    }
    if (participle) return `the ${participle} mixture`
  }

  // "the mixed mixture" is true and unusable.
  if (participle === 'mixed') return 'the mixture'
  return participle ? `the ${participle} mixture` : 'the mixture so far'
}

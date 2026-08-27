/**
 * The validator.
 *
 * The original format allows every one of these errors silently — that is why the viral
 * Threads thread contains three people independently *fixing* the same recipe. jenelope1st's
 * "added missing instructions for the dry ingredients" is not a design critique here; it is
 * error E1, and it fails the build.
 */

import {
  childSteps,
  describeOutput,
  durationToMinutes,
  isComponentRef,
  leafOrder,
  stepsOf,
  subtreeSteps,
  type Component,
  type ComponentId,
  type IngredientId,
  type Quantity,
  type Range,
  type Recipe,
  type Step,
  type StepId,
  type Temperature,
  type Unit,
} from './model.js'
import { formatAmount, isRange } from './quantity.js'
import { inSmallestUnit } from './scale.js'

export type Severity = 'error' | 'warning'

/**
 * E1–E6 are the set specified in PHASE-01. E7 and E8 are structural preconditions that
 * discovered themselves while writing the others: every later check assumes references
 * resolve and ids are unique, so those have to be reported first rather than crashing.
 */
export type DiagnosticCode =
  | 'E1' // orphan ingredient
  | 'E2' // unreachable step
  | 'E3' // cycle
  | 'E4' // non-contiguous run
  | 'E5' // undeclared multi-consumed leaf
  | 'E6' // dangling component reference
  | 'E7' // dangling id reference
  | 'E8' // duplicate id
  | 'E9' // a split leaf over-allocated
  | 'W1' // long step text
  | 'W2' // single-scale temperature
  | 'W3' // unlabeled merge
  | 'W4' // metric rounding discrepancy
  | 'W5' // wide raw merge
  | 'W6' // colliding output names
  | 'W7' // a split leaf with no portions

export type Diagnostic = {
  code: DiagnosticCode
  severity: Severity
  message: string
  at: {
    component?: ComponentId
    step?: StepId
    ingredient?: IngredientId
  }
  /**
   * E4 always carries the ingredient order that would fix it. An author who has hit a
   * contiguity error wants the corrected order, not a lecture about depth-first traversal.
   */
  suggestion?: IngredientId[]
}

export type ValidationResult = {
  ok: boolean
  errors: Diagnostic[]
  warnings: Diagnostic[]
}

export type ValidateOptions = {
  /** W1 threshold in characters. Drives the Phase 03 text-measure problem (R9). */
  longStepText?: number
  /** W4 tolerance as a fraction: how far an authored metric pair may sit from the conversion. */
  metricTolerance?: number
  /** W5 threshold: how many raw ingredients one step may take before it reads as a join. */
  wideMerge?: number
}

const DEFAULTS = {
  longStepText: 90,
  metricTolerance: 0.12,
  wideMerge: 4,
} satisfies Required<ValidateOptions>

export function validateRecipe(recipe: Recipe, options: ValidateOptions = {}): ValidationResult {
  const opts = { ...DEFAULTS, ...options }
  const diagnostics: Diagnostic[] = []
  const seenComponents = new Set<ComponentId>()

  for (const component of recipe.components) {
    diagnostics.push(...validateComponent(component, seenComponents, opts))
    seenComponents.add(component.id)
  }

  return partition(diagnostics)
}

/**
 * `earlierComponents` is the set of component ids defined *before* this one. Forward
 * references are E6: a component cannot eat something that has not been made yet, and
 * allowing it would make the render order undecidable.
 */
export function validateComponent(
  component: Component,
  earlierComponents: ReadonlySet<ComponentId> = new Set(),
  options: ValidateOptions = {},
): Diagnostic[] {
  const opts = { ...DEFAULTS, ...options }
  const at = { component: component.id }
  const out: Diagnostic[] = []

  const steps = stepsOf(component)
  const stepIds = new Set(Object.keys(component.steps))
  const leafIds = new Set<IngredientId>()

  // --- E8 duplicate ids, and E7 key/id disagreement ------------------------------------

  for (const leaf of component.ingredients) {
    if (leafIds.has(leaf.id)) {
      out.push({
        code: 'E8',
        severity: 'error',
        message: `Duplicate ingredient id "${leaf.id}". Ids address rows; two rows cannot share one.`,
        at: { ...at, ingredient: leaf.id },
      })
    }
    leafIds.add(leaf.id)
  }

  for (const [key, step] of Object.entries(component.steps)) {
    if (step.id !== key) {
      out.push({
        code: 'E7',
        severity: 'error',
        message: `Step stored under key "${key}" declares id "${step.id}". They must match.`,
        at: { ...at, step: key },
      })
    }
  }

  // --- E6 cross-component references ----------------------------------------------------

  for (const leaf of component.ingredients) {
    if (!isComponentRef(leaf)) continue
    if (!earlierComponents.has(leaf.component)) {
      out.push({
        code: 'E6',
        severity: 'error',
        message:
          `Ingredient "${leaf.id}" references component "${leaf.component}", which is not ` +
          `defined earlier in this recipe. A component can only consume output that already exists.`,
        at: { ...at, ingredient: leaf.id },
      })
    }
  }

  // --- E7 dangling input references, and the root --------------------------------------

  if (!stepIds.has(component.root)) {
    out.push({
      code: 'E7',
      severity: 'error',
      message: `Root step "${component.root}" is not present in this component's steps.`,
      at,
    })
  }

  for (const step of steps) {
    for (const input of step.inputs) {
      const known = input.kind === 'step' ? stepIds.has(input.id) : leafIds.has(input.id)
      if (!known) {
        out.push({
          code: 'E7',
          severity: 'error',
          message: `Step "${step.id}" consumes ${input.kind} "${input.id}", which does not exist.`,
          at: { ...at, step: step.id },
        })
      }
    }
  }

  // Everything below walks the tree. Bail out if the graph is not addressable yet —
  // cascading nonsense from a typo'd id helps nobody.
  if (out.some((d) => d.code === 'E7')) return out

  // --- E3 cycles ------------------------------------------------------------------------

  const cycle = findCycle(component)
  if (cycle) {
    out.push({
      code: 'E3',
      severity: 'error',
      message: `Cycle among steps: ${cycle.join(' → ')}. The assembly tree must be acyclic.`,
      at: { ...at, step: cycle[0] as StepId },
    })
    // A cycle makes reachability and contiguity meaningless. Stop here.
    return out
  }

  // --- E2 unreachable steps --------------------------------------------------------------

  const reachable = new Set(subtreeSteps(component, component.root))
  for (const step of steps) {
    if (!reachable.has(step.id)) {
      out.push({
        code: 'E2',
        severity: 'error',
        message:
          `Step "${step.id}" (${quote(step.text)}) is not in the root's subtree, so nothing ` +
          `it produces reaches the finished dish.`,
        at: { ...at, step: step.id },
      })
    }
  }

  // --- E1 orphan ingredients, E5 undeclared reuse ----------------------------------------

  const consumers = new Map<IngredientId, StepId[]>()
  for (const step of steps) {
    if (!reachable.has(step.id)) continue
    for (const input of step.inputs) {
      if (input.kind !== 'ingredient') continue
      const list = consumers.get(input.id) ?? []
      list.push(step.id)
      consumers.set(input.id, list)
    }
  }

  for (const leaf of component.ingredients) {
    if (!consumers.has(leaf.id)) {
      const label = isComponentRef(leaf) ? (leaf.label ?? leaf.component) : leaf.item
      out.push({
        code: 'E1',
        severity: 'error',
        message:
          `Ingredient "${leaf.id}" (${quote(label)}) is never consumed by any step. Every ` +
          `ingredient must reach the root through an explicit, labeled step — including ` +
          `garnishes, which belong to a "serve" step rather than being exempt.`,
        at: { ...at, ingredient: leaf.id },
      })
    }
  }

  // --- W6 colliding output names ---------------------------------------------------------

  /**
   * Two steps whose outputs are described identically.
   *
   * Invisible on the chart, where an input is the cell physically next to you and never has to
   * be named. Read aloud it is a genuine ambiguity: the no-knead bread produced "the rested
   * mixture" twice and "the baked mixture" twice, so a listener building a mental model hears
   * one name for two different things. Measured before adding this, 5 of the 9 corpus components
   * collided — systematic, not incidental, and only discoverable once Phase 06 tried to say the
   * tree out loud.
   *
   * A warning rather than an error: it costs a listener, not a cook, and the fix is an
   * `outputName` the author has to choose.
   */
  const named = new Map<string, StepId[]>()
  for (const step of steps) {
    if (!reachable.has(step.id)) continue
    const output = describeOutput(component, step.id).trim().toLowerCase()
    named.set(output, [...(named.get(output) ?? []), step.id])
  }
  for (const [output, ids] of named) {
    if (ids.length < 2) continue
    out.push({
      code: 'W6',
      severity: 'warning',
      message:
        `Steps ${ids.map((id) => `"${id}"`).join(' and ')} are both described as ` +
        `${quote(output)}. On the chart position tells them apart; read aloud it does not. ` +
        `Give at least one an explicit "outputName".`,
      at: { ...at, step: ids[1] },
    })
  }

  const declaredReuse = new Set((component.reuse ?? []).map((r) => r.leaf))
  for (const [leafId, consumedBy] of consumers) {
    if (consumedBy.length > 1 && !declaredReuse.has(leafId)) {
      out.push({
        code: 'E5',
        severity: 'error',
        message:
          `Ingredient "${leafId}" is consumed by ${consumedBy.length} steps ` +
          `(${consumedBy.join(', ')}) but is not declared in this component's "reuse" list. ` +
          `Sharing a leaf turns the tree into a DAG; it has to be deliberate.`,
        at: { ...at, ingredient: leafId },
      })
    }
  }

  // --- E9 / W7 how a split leaf is divided --------------------------------------------------

  /**
   * A leaf shared by several steps has one quantity and several portions, and until Q8 the model
   * recorded only the total — so anything naming a per-step amount named the whole thing at every
   * consumer. `InputRef.portion` fixes that; these two check the arithmetic.
   */
  for (const [leafId, consumedBy] of consumers) {
    if (consumedBy.length < 2) continue
    const leaf = component.ingredients.find((l) => l.id === leafId)
    const total = leaf?.quantity
    if (!total || total.amount === undefined) continue

    const portions = consumedBy.map((stepId) => {
      const input = component.steps[stepId]?.inputs.find(
        (i) => i.kind === 'ingredient' && i.id === leafId,
      )
      return { stepId, portion: input?.kind === 'ingredient' ? input.portion : undefined }
    })

    const missing = portions.filter((p) => p.portion?.amount === undefined)
    if (missing.length > 0) {
      out.push({
        code: 'W7',
        severity: 'warning',
        message:
          `Ingredient "${leafId}" is split between ${consumedBy.length} steps and has a ` +
          `quantity, but ${missing.map((m) => `"${m.stepId}"`).join(' and ')} ` +
          `${missing.length === 1 ? 'does' : 'do'} not say how much of it ${missing.length === 1 ? 'it takes' : 'they take'}. ` +
          `Anything showing a quantity beside that step will show the whole amount.`,
        at: { ...at, ingredient: leafId },
      })
      continue
    }

    // Smallest portions against the largest total, so a range never raises a false alarm.
    const asSmallest = (amount: number | Range, unit: Unit) =>
      inSmallestUnit(isRange(amount) ? amount.from : amount, unit)
    const capacity = inSmallestUnit(
      isRange(total.amount) ? total.amount.to : total.amount,
      total.unit,
    )
    const shares = portions.map((p) => asSmallest(p.portion!.amount!, p.portion!.unit))
    // Anything off the ladders — a pinch, a can, a bare count — cannot be compared, and
    // guessing at a conversion would be worse than not checking.
    if (!capacity || shares.some((sh) => sh === undefined || sh.unit !== capacity.unit)) continue

    const allocated = shares.reduce((sum, sh) => sum + sh!.value, 0)
    if (allocated > capacity.value * 1.001) {
      out.push({
        code: 'E9',
        severity: 'error',
        message:
          `Ingredient "${leafId}" is split into portions totalling more than the recipe calls ` +
          `for: ${formatAmount(allocated)} ${capacity.unit} allocated across ` +
          `${consumedBy.map((c) => `"${c}"`).join(', ')}, out of ${formatAmount(capacity.value)} ` +
          `${capacity.unit}. A cook following this runs out.`,
        at: { ...at, ingredient: leafId },
      })
    }
  }

  // --- E4 leaf contiguity (I1) ------------------------------------------------------------

  out.push(...checkContiguity(component, reachable, at))

  // --- Warnings ---------------------------------------------------------------------------

  for (const step of steps) {
    if (step.text.length > opts.longStepText) {
      out.push({
        code: 'W1',
        severity: 'warning',
        message:
          `Step "${step.id}" text is ${step.text.length} characters (over ${opts.longStepText}). ` +
          `Long step text is the direct cause of the absurd column widths in the source (R9).`,
        at: { ...at, step: step.id },
      })
    }

    if (step.inputs.length > 1 && step.text.trim() === '') {
      out.push({
        code: 'W3',
        severity: 'warning',
        message:
          `Step "${step.id}" merges ${step.inputs.length} inputs but has no text. An unlabeled ` +
          `merge is the implicit join that R3 exists to eliminate.`,
        at: { ...at, step: step.id },
      })
    }

    // A step that combines several raw ingredients *and nothing else* is one honest action —
    // whisking a vinaigrette from oil, lemon, honey and salt needs no sub-step. The pattern
    // worth flagging is raw ingredients being folded into an already-prepared thing, which is
    // exactly what jenelope1st fixed by hand: the brownies' four dry ingredients feed the fold
    // directly, so she added the "sift together" they were missing. The step is labeled, so W3
    // cannot see it, but it is still an implicit join.
    const rawLeaves = step.inputs.filter((i) => i.kind === 'ingredient').length
    const hasPreparedInput = step.inputs.some((i) => i.kind === 'step')
    if (rawLeaves >= opts.wideMerge && hasPreparedInput) {
      out.push({
        code: 'W5',
        severity: 'warning',
        message:
          `Step "${step.id}" (${quote(step.text)}) folds ${rawLeaves} raw ingredients into an ` +
          `already-prepared input. They probably want a combining step of their own — this is ` +
          `the join R3 is about, and being labeled is not the same as being explicit.`,
        at: { ...at, step: step.id },
      })
    }

    if (step.temperature)
      out.push(...checkTemperature(step.temperature, opts, { ...at, step: step.id }))
    if (step.duration && step.duration.max !== undefined && step.duration.max < step.duration.min) {
      out.push({
        code: 'W1',
        severity: 'warning',
        message: `Step "${step.id}" has a duration range that runs backwards.`,
        at: { ...at, step: step.id },
      })
    }
  }

  for (const prelude of component.prelude) {
    if (prelude.temperature) {
      out.push(...checkTemperature(prelude.temperature, opts, at))
    }
  }

  for (const leaf of component.ingredients) {
    if (isComponentRef(leaf) || !leaf.quantity) continue
    out.push(...checkMetricPair(leaf.quantity, opts, { ...at, ingredient: leaf.id }))
  }

  return dedupe(out)
}

/**
 * Collapses warnings that state the same fact twice. A baking recipe repeats its oven
 * temperature in the prelude *and* on the bake step, so a single authored rounding produces
 * two identical W4s. Messages that name a step or ingredient carry the id, so genuinely
 * distinct findings never collide here.
 */
function dedupe(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>()
  return diagnostics.filter((d) => {
    const key = `${d.code} ${d.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// --- Individual checks --------------------------------------------------------------------

/**
 * I1: a step's inputs must occupy contiguous rows, so the authored ingredient order is not
 * free — it has to be a valid depth-first leaf ordering of the tree.
 */
function checkContiguity(
  component: Component,
  reachable: ReadonlySet<StepId>,
  at: { component: ComponentId },
): Diagnostic[] {
  const out: Diagnostic[] = []
  const rowOf = new Map<IngredientId, number>()
  component.ingredients.forEach((leaf, index) => rowOf.set(leaf.id, index))

  for (const step of stepsOf(component)) {
    if (!reachable.has(step.id)) continue
    const rows = [...new Set(leafOrder(component, step.id))]
      .map((id) => rowOf.get(id))
      .filter((row): row is number => row !== undefined)
    if (rows.length === 0) continue

    const span = Math.max(...rows) - Math.min(...rows) + 1
    if (span !== rows.length) {
      out.push({
        code: 'E4',
        severity: 'error',
        message:
          `Step "${step.id}" (${quote(step.text)}) consumes ${rows.length} ingredients that are ` +
          `not adjacent — they occupy rows ${[...rows].sort((a, b) => a - b).join(', ')}, ` +
          `spanning ${span}. A step cell cannot span a gap. Reorder the ingredient list.`,
        at: { ...at, step: step.id },
        suggestion: suggestedOrder(component),
      })
    }
  }

  return out
}

/**
 * The ingredient order the tree implies. Any leaf the tree does not reach keeps its authored
 * position at the end, so the suggestion is always a permutation of what the author wrote.
 */
export function suggestedOrder(component: Component): IngredientId[] {
  const fromTree = [...new Set(leafOrder(component))]
  const known = new Set(fromTree)
  const remainder = component.ingredients.map((l) => l.id).filter((id) => !known.has(id))
  return [...fromTree, ...remainder]
}

function checkTemperature(
  t: Temperature,
  opts: Required<ValidateOptions>,
  at: Diagnostic['at'],
): Diagnostic[] {
  const out: Diagnostic[] = []

  if ((t.f === undefined) !== (t.c === undefined)) {
    out.push({
      code: 'W2',
      severity: 'warning',
      message:
        `Temperature given in one scale only (${t.f !== undefined ? '°F' : '°C'}). R6 asks for ` +
        `unit parity — both scales, authored rather than computed.`,
      at,
    })
  }

  if (t.f !== undefined && t.c !== undefined) {
    const converted = ((t.f - 32) * 5) / 9
    if (Math.abs(converted - t.c) > 5) {
      out.push({
        code: 'W4',
        severity: 'warning',
        message:
          `${t.f}°F converts to ${converted.toFixed(1)}°C, but ${t.c}°C is authored. Kept as ` +
          `written — the sources round deliberately — but worth a look.`,
        at,
      })
    }
  }

  return out
}

/** Rough conversions, used only to spot a *suspicious* authored pair. Never to replace one. */
const TO_METRIC: Partial<Record<Unit, { unit: Unit; factor: number }>> = {
  lb: { unit: 'g', factor: 453.592 },
  oz: { unit: 'g', factor: 28.3495 },
  cup: { unit: 'mL', factor: 236.588 },
  tsp: { unit: 'mL', factor: 4.92892 },
  Tbs: { unit: 'mL', factor: 14.7868 },
  'fl oz': { unit: 'mL', factor: 29.5735 },
  quart: { unit: 'mL', factor: 946.353 },
  pint: { unit: 'mL', factor: 473.176 },
  in: { unit: 'cm', factor: 2.54 },
}

function checkMetricPair(
  quantity: Quantity,
  opts: Required<ValidateOptions>,
  at: Diagnostic['at'],
): Diagnostic[] {
  const { metric } = quantity
  if (!metric) return []

  const conversion = TO_METRIC[quantity.unit]
  if (!conversion || conversion.unit !== metric.unit) return []
  // "large pinch" has a unit and no number. Nothing to cross-check.
  if (quantity.amount === undefined) return []

  const expected = scalarOf(quantity.amount) * conversion.factor
  const authored = scalarOf(metric.amount)
  if (expected === 0) return []

  const drift = Math.abs(authored - expected) / expected
  if (drift <= opts.metricTolerance) return []

  return [
    {
      code: 'W4',
      severity: 'warning',
      message:
        `${formatAmount(quantity.amount)} ${quantity.unit} converts to about ` +
        `${expected.toFixed(0)} ${conversion.unit}, but ${formatAmount(metric.amount)} ` +
        `${metric.unit} is authored (${(drift * 100).toFixed(0)}% off). Authored pairs are ` +
        `preserved on purpose; check this one is intentional rounding and not a typo.`,
      at,
    },
  ]
}

function scalarOf(amount: number | Range): number {
  return isRange(amount) ? (amount.from + amount.to) / 2 : amount
}

/** Returns the cycle as a readable path, or `undefined`. Iterative DFS with a colour map. */
function findCycle(component: Component): StepId[] | undefined {
  const state = new Map<StepId, 'open' | 'done'>()
  const path: StepId[] = []

  const walk = (id: StepId): StepId[] | undefined => {
    const current = state.get(id)
    if (current === 'done') return undefined
    if (current === 'open') return [...path.slice(path.indexOf(id)), id]

    const step = component.steps[id]
    if (!step) return undefined

    state.set(id, 'open')
    path.push(id)
    for (const child of childSteps(component, step)) {
      const found = walk(child.id)
      if (found) return found
    }
    path.pop()
    state.set(id, 'done')
    return undefined
  }

  for (const id of Object.keys(component.steps)) {
    const found = walk(id)
    if (found) return found
  }
  return undefined
}

// --- Utilities ------------------------------------------------------------------------------

function partition(diagnostics: Diagnostic[]): ValidationResult {
  const errors = diagnostics.filter((d) => d.severity === 'error')
  const warnings = diagnostics.filter((d) => d.severity === 'warning')
  return { ok: errors.length === 0, errors, warnings }
}

function quote(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return 'untitled'
  return trimmed.length > 40 ? `"${trimmed.slice(0, 37)}…"` : `"${trimmed}"`
}

/** Human-readable rendering, for test failures and CLI output. */
export function formatDiagnostic(d: Diagnostic): string {
  const where = [d.at.component, d.at.step ?? d.at.ingredient].filter(Boolean).join('/')
  const suffix = d.suggestion ? `\n    suggested order: ${d.suggestion.join(', ')}` : ''
  return `${d.code} ${where}: ${d.message}${suffix}`
}

/** Total authored duration in minutes, for quick corpus sanity checks. Phase 02 does this properly. */
export function totalAuthoredMinutes(component: Component): number {
  return stepsOf(component).reduce(
    (sum: number, step: Step) => sum + (step.duration ? durationToMinutes(step.duration) : 0),
    0,
  )
}

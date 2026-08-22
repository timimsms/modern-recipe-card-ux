/**
 * The kitchen state store — headless, framework-free, and the same one every track binds.
 *
 * It lives in `core` for the same reason the layout engine does: if each track brings its own
 * state management, Phase 08 measures someone's taste in stores rather than their rendering.
 * Each track adapts this with a thin binding; if an adapter grows large, that is itself a
 * finding.
 *
 * No DOM, no timers of its own. A timer here is two timestamps and a clock function — the
 * ticking belongs to whoever owns the screen.
 */

import {
  durationToMinutes,
  stepMinutes,
  stepsOf,
  subtreeSteps,
  type Component,
  type IngredientId,
  type Recipe,
  type Step,
  type StepId,
} from './model.js'
import type { GridPlan } from './layout.js'
import type { UnitSystem } from './scale.js'

// --- Identity ------------------------------------------------------------------------------------

/**
 * Step and ingredient ids are unique *within a component*, not within a recipe.
 *
 * Shepherd's pie has a `season` step in both the mashed potatoes and the pie, and a `salt` leaf
 * in both. Held in a flat set, ticking the potatoes' salt ticked the pie's, and marking one
 * `season` done marked the other — a recipe reporting itself two steps further along than the
 * cook actually is.
 *
 * So the store's identity is the qualified key, and the bare id never appears in `CookState`.
 * The alternative — asking every corpus file to make its ids globally unique — pushes a storage
 * detail onto the authoring format, and would silently break again the first time someone wrote
 * two components that both `reduce`.
 */
export type CookKey = string & { readonly __cookKey?: unique symbol }

export function stepKey(component: Pick<Component, 'id'>, id: StepId): CookKey {
  return `${component.id}/${id}`
}

export function ingredientKey(component: Pick<Component, 'id'>, id: IngredientId): CookKey {
  return `${component.id}/${id}`
}

/**
 * The completed steps of one component, as bare ids.
 *
 * `cook.ts` works on a single component and rightly speaks in bare ids; this is the translation
 * at the boundary, so a track never hand-rolls it and never gets it half-right.
 */
export function completedIn(component: Component, state: CookState): Set<StepId> {
  const bare = new Set<StepId>()
  for (const step of stepsOf(component)) {
    if (state.completedSteps.has(stepKey(component, step.id))) bare.add(step.id)
  }
  return bare
}

/** The checked ingredients of one component, as bare ids. */
export function checkedIn(component: Component, state: CookState): Set<IngredientId> {
  const bare = new Set<IngredientId>()
  for (const leaf of component.ingredients) {
    if (state.checkedIngredients.has(ingredientKey(component, leaf.id))) bare.add(leaf.id)
  }
  return bare
}

/**
 * A running timer, stored as timestamps rather than a countdown.
 *
 * Accumulating `setInterval` ticks drifts, and drift is guaranteed here because a forty-minute
 * bake will be backgrounded. Remaining time is recomputed from the clock every time it is asked
 * for, so a tab that slept for ten minutes wakes up correct rather than ten minutes behind.
 */
export type Timer = {
  startedAt: number
  /** Milliseconds until the low end of the step's range. */
  alertAfter: number
  /** Milliseconds until the high end. Equal to `alertAfter` when the duration is exact. */
  endsAfter: number
}

export type CookState = {
  /** Qualified keys — see `ingredientKey`. Never a bare id. */
  checkedIngredients: Set<CookKey>
  /** Qualified keys — see `stepKey`. Never a bare id. */
  completedSteps: Set<CookKey>
  currentStep: CookKey | null
  /** 1 = as authored. A rendering-time factor; corpus data is never mutated. */
  scale: number
  unitSystem: UnitSystem
  timers: Record<CookKey, Timer>
}

export function initialState(): CookState {
  return {
    checkedIngredients: new Set(),
    completedSteps: new Set(),
    currentStep: null,
    scale: 1,
    unitSystem: 'both',
    timers: {},
  }
}

export type Store = {
  get(): CookState
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** Every mutation goes through here so subscribers cannot miss one. */
  update(change: (state: CookState) => CookState): void

  /** Takes a qualified key from `ingredientKey`. */
  toggleIngredient(key: CookKey): void
  /** Takes a qualified key from `stepKey`. */
  toggleStep(key: CookKey): void
  setCurrentStep(key: CookKey | null): void
  setScale(scale: number): void
  setUnitSystem(system: UnitSystem): void

  startTimer(key: CookKey, step: Step): void
  stopTimer(key: CookKey): void
  /** Milliseconds left, negative once past the low end. `null` when no timer is running. */
  remaining(key: CookKey): number | null
  /** Past the low end of the range but still inside it — "check it now" rather than "done". */
  isRinging(key: CookKey): boolean

  /** Undo the last check-off. Wet fingers mis-tap constantly. */
  undo(): void
  canUndo(): boolean
  reset(): void
}

export type StoreOptions = {
  now?: () => number
  initial?: Partial<CookState>
}

/** Sets are copied on write, so a subscriber can compare snapshots by identity. */
function clone(state: CookState): CookState {
  return {
    ...state,
    checkedIngredients: new Set(state.checkedIngredients),
    completedSteps: new Set(state.completedSteps),
    timers: { ...state.timers },
  }
}

export function createStore(options: StoreOptions = {}): Store {
  const now = options.now ?? (() => Date.now())
  let state: CookState = { ...initialState(), ...options.initial }
  const listeners = new Set<() => void>()

  /**
   * Undo covers check-off and *only* check-off.
   *
   * Snapshotting the whole `CookState` looked equivalent and was not: it captured `timers` too,
   * so undoing a mis-tapped checkbox also restored the moment before you started the bake — the
   * running forty-minute timer silently disappeared. Scale and unit system are excluded for a
   * quieter reason: both are visible in the controls that set them, and rolling one back would
   * change the card while the control still reads the old value.
   */
  const history: Array<Pick<CookState, 'checkedIngredients' | 'completedSteps'>> = []

  const emit = () => {
    for (const listener of [...listeners]) listener()
  }

  const commit = (next: CookState, undoable = false) => {
    if (undoable) {
      history.push({
        checkedIngredients: new Set(state.checkedIngredients),
        completedSteps: new Set(state.completedSteps),
      })
      if (history.length > 50) history.shift()
    }
    state = next
    emit()
  }

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update(change) {
      commit(change(clone(state)))
    },

    toggleIngredient(key) {
      const next = clone(state)
      if (next.checkedIngredients.has(key)) next.checkedIngredients.delete(key)
      else next.checkedIngredients.add(key)
      commit(next, true)
    },

    toggleStep(key) {
      const next = clone(state)
      if (next.completedSteps.has(key)) next.completedSteps.delete(key)
      else next.completedSteps.add(key)
      commit(next, true)
    },

    setCurrentStep(id) {
      commit({ ...clone(state), currentStep: id })
    },

    setScale(scale) {
      commit({ ...clone(state), scale: Math.max(0.25, Math.min(8, scale)) })
    },

    setUnitSystem(system) {
      commit({ ...clone(state), unitSystem: system })
    },

    startTimer(key, step) {
      if (!step.duration) return
      const low = durationToMinutes(step.duration, 'min') * 60_000
      const high = durationToMinutes(step.duration, 'max') * 60_000
      const next = clone(state)
      next.timers[key] = { startedAt: now(), alertAfter: low, endsAfter: high }
      commit(next)
    },

    stopTimer(key) {
      const next = clone(state)
      delete next.timers[key]
      commit(next)
    },

    remaining(key) {
      const timer = state.timers[key]
      if (!timer) return null
      return timer.startedAt + timer.alertAfter - now()
    },

    isRinging(key) {
      const timer = state.timers[key]
      if (!timer) return false
      const elapsed = now() - timer.startedAt
      // A range alerts at the low end and keeps counting to the high end: "30–40 min" means
      // start looking at 30, not that it is finished at 30.
      return elapsed >= timer.alertAfter
    },

    undo() {
      const previous = history.pop()
      if (!previous) return
      // Merged into the *current* state, not swapped for an old one, so a timer started since
      // the mis-tap keeps running.
      state = { ...clone(state), ...previous }
      emit()
    },
    canUndo: () => history.length > 0,

    reset() {
      history.length = 0
      state = initialState()
      emit()
    },
  }
}

// --- Completion ----------------------------------------------------------------------------------

/**
 * What kind of ending the cook is looking at.
 *
 * Components are sequential and the mini-map is per-component, so finishing the mashed potatoes
 * fills the map completely — visually identical to finishing the dish. The cook then steps into
 * the pie and the map empties, which reads as losing an hour of progress rather than starting
 * part two.
 *
 * Neither the step count ("3 of 15") nor the time-weighted bar fixes this: both are correct and
 * neither is what the eye reads. The map is the loud element, so the ending needs naming.
 */
export type Completion =
  /** Nothing has ended; an ordinary step. */
  | { kind: 'none' }
  /** This component is finished and another follows. `next` is the one that follows. */
  | { kind: 'part'; component: Component; next: Component; index: number; of: number }
  /** Every step of every component is done. */
  | { kind: 'all' }

/** Every step of one component checked off. */
export function isComponentComplete(component: Component, state: CookState): boolean {
  const steps = stepsOf(component)
  return (
    steps.length > 0 && steps.every((step) => state.completedSteps.has(stepKey(component, step.id)))
  )
}

export function isRecipeComplete(recipe: Recipe, state: CookState): boolean {
  return (
    recipe.components.length > 0 &&
    recipe.components.every((component) => isComponentComplete(component, state))
  )
}

/**
 * Classifies the ending, if any, at the component the cook is currently in.
 *
 * `all` wins over `part`: on the final component both are true, and "you have finished the dish"
 * is the more useful of the two things to say.
 */
export function completionAt(recipe: Recipe, index: number, state: CookState): Completion {
  if (isRecipeComplete(recipe, state)) return { kind: 'all' }

  const component = recipe.components[index]
  const next = recipe.components[index + 1]
  if (!component || !next || !isComponentComplete(component, state)) return { kind: 'none' }
  return { kind: 'part', component, next, index, of: recipe.components.length }
}

// --- Derived selectors ---------------------------------------------------------------------------

/**
 * How complete each `PlacedGroup` is — R7's progressive fill, and the reason `groups` is on the
 * plan at all.
 */
export function regionFill(
  component: Component,
  plan: GridPlan,
  state: CookState,
): Map<StepId, number> {
  const fill = new Map<StepId, number>()
  for (const group of plan.groups) {
    const inside = subtreeSteps(component, group.ref)
    const done = inside.filter((id) => state.completedSteps.has(stepKey(component, id))).length
    fill.set(group.ref, inside.length === 0 ? 0 : done / inside.length)
  }
  return fill
}

/**
 * Overall completion, weighted by time rather than by step count.
 *
 * Four of five steps done reads as "nearly there" and is wrong when the fifth is a forty-minute
 * bake — which is most of this corpus, where the last step is usually the longest. Weighting by
 * elapsed minutes says 23% instead, which is what the cook actually faces.
 */
export function progress(component: Component, state: CookState): number {
  const steps = stepsOf(component)
  const total = steps.reduce((sum, step) => sum + stepMinutes(step), 0)
  if (total === 0) return 0
  const done = steps
    .filter((step) => state.completedSteps.has(stepKey(component, step.id)))
    .reduce((sum, step) => sum + stepMinutes(step), 0)
  return done / total
}

/** The same figure by step count, for comparison. Kept so the difference can be shown, not argued. */
export function progressByStepCount(component: Component, state: CookState): number {
  const steps = stepsOf(component)
  if (steps.length === 0) return 0
  return (
    steps.filter((step) => state.completedSteps.has(stepKey(component, step.id))).length /
    steps.length
  )
}

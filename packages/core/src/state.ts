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
  type Step,
  type StepId,
} from './model.js'
import type { GridPlan } from './layout.js'
import type { UnitSystem } from './scale.js'

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
  checkedIngredients: Set<IngredientId>
  completedSteps: Set<StepId>
  currentStep: StepId | null
  /** 1 = as authored. A rendering-time factor; corpus data is never mutated. */
  scale: number
  unitSystem: UnitSystem
  timers: Record<StepId, Timer>
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

  toggleIngredient(id: IngredientId): void
  toggleStep(id: StepId): void
  setCurrentStep(id: StepId | null): void
  setScale(scale: number): void
  setUnitSystem(system: UnitSystem): void

  startTimer(step: Step): void
  stopTimer(id: StepId): void
  /** Milliseconds left, negative once past the low end. `null` when no timer is running. */
  remaining(id: StepId): number | null
  /** Past the low end of the range but still inside it — "check it now" rather than "done". */
  isRinging(id: StepId): boolean

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

  // Only check-off is undoable. Scale and unit system are visible in the controls that set
  // them, so an undo stack across those would restore state the reader cannot see changing.
  const history: CookState[] = []

  const emit = () => {
    for (const listener of [...listeners]) listener()
  }

  const commit = (next: CookState, undoable = false) => {
    if (undoable) {
      history.push(clone(state))
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

    toggleIngredient(id) {
      const next = clone(state)
      if (next.checkedIngredients.has(id)) next.checkedIngredients.delete(id)
      else next.checkedIngredients.add(id)
      commit(next, true)
    },

    toggleStep(id) {
      const next = clone(state)
      if (next.completedSteps.has(id)) next.completedSteps.delete(id)
      else next.completedSteps.add(id)
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

    startTimer(step) {
      if (!step.duration) return
      const low = durationToMinutes(step.duration, 'min') * 60_000
      const high = durationToMinutes(step.duration, 'max') * 60_000
      const next = clone(state)
      next.timers[step.id] = { startedAt: now(), alertAfter: low, endsAfter: high }
      commit(next)
    },

    stopTimer(id) {
      const next = clone(state)
      delete next.timers[id]
      commit(next)
    },

    remaining(id) {
      const timer = state.timers[id]
      if (!timer) return null
      return timer.startedAt + timer.alertAfter - now()
    },

    isRinging(id) {
      const timer = state.timers[id]
      if (!timer) return false
      const elapsed = now() - timer.startedAt
      // A range alerts at the low end and keeps counting to the high end: "30–40 min" means
      // start looking at 30, not that it is finished at 30.
      return elapsed >= timer.alertAfter
    },

    undo() {
      const previous = history.pop()
      if (previous) {
        state = previous
        emit()
      }
    },
    canUndo: () => history.length > 0,

    reset() {
      history.length = 0
      state = initialState()
      emit()
    },
  }
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
    const done = inside.filter((id) => state.completedSteps.has(id)).length
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
    .filter((step) => state.completedSteps.has(step.id))
    .reduce((sum, step) => sum + stepMinutes(step), 0)
  return done / total
}

/** The same figure by step count, for comparison. Kept so the difference can be shown, not argued. */
export function progressByStepCount(component: Component, state: CookState): number {
  const steps = stepsOf(component)
  if (steps.length === 0) return 0
  return steps.filter((step) => state.completedSteps.has(step.id)).length / steps.length
}

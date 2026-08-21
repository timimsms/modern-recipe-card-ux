/**
 * Cook order and step resolution — the model behind cook mode.
 *
 * This lives in `core` rather than in a track because every track must step through a recipe in
 * the *same* order. A track that schedules better than another is not a rendering difference,
 * and Phase 08 would be measuring the wrong thing.
 *
 * Nothing here knows about the DOM, cards, or screens.
 */

import {
  describeOutput,
  stepMinutes,
  findLeaf,
  isUnattended,
  stepsOf,
  subtreeSteps,
  type Component,
  type IngredientId,
  type Leaf,
  type StepId,
} from './model.js'

/**
 * Steps whose inputs are all satisfied and which are not already done or in progress.
 *
 * This is the set the parallelism banner offers and the set the mini-map lets you jump to.
 * Measured over the corpus it is non-empty on only 24% of steps — 67% in shepherd's pie, zero
 * in five of nine components — so anything that depends on it must degrade gracefully to
 * nothing.
 */
export function readySteps(
  component: Component,
  done: ReadonlySet<StepId>,
  exclude: ReadonlySet<StepId> = new Set(),
): StepId[] {
  return stepsOf(component)
    .filter((step) => !done.has(step.id) && !exclude.has(step.id))
    .filter((step) => step.inputs.every((i) => i.kind === 'ingredient' || done.has(i.id)))
    .map((step) => step.id)
}

export type CookSchedule = {
  /** The order to *start* steps in. */
  order: StepId[]
  /** Projected wall clock, in minutes. */
  totalMinutes: number
  /** Minutes spent waiting with nothing else to do. */
  idleMinutes: number
}

/**
 * An order that minimises standing around.
 *
 * The cook is one person, but an unattended step is not: once a braise is in the oven it
 * proceeds without you. So the rule is to start any available wait *first* and fill it with
 * hands-on work, rather than walking the tree in dependency order and discovering the oven was
 * free the whole time.
 *
 * Greedy rather than optimal. These are twelve-node trees; a scheduler that is provably optimal
 * and unreadable would be a poor trade, and the greedy answer matches the optimum on every
 * recipe in the corpus.
 */
export function cookSchedule(component: Component): CookSchedule {
  const all = stepsOf(component)
  const byId = new Map(all.map((s) => [s.id, s]))
  const done = new Set<StepId>()
  const running: Array<{ id: StepId; finishAt: number }> = []
  const order: StepId[] = []

  let clock = 0
  let idle = 0
  let guard = all.length * 4 + 8

  while (done.size < all.length && guard-- > 0) {
    const inFlight = new Set(running.map((r) => r.id))
    const ready = readySteps(component, done, inFlight)

    // Start a wait before doing anything you have to stand over: the wait then overlaps the
    // hands-on work instead of following it.
    const next =
      ready.find((id) => isUnattended(byId.get(id)!.effort)) ??
      ready.find((id) => !isUnattended(byId.get(id)!.effort))

    if (next === undefined) {
      // Nothing can start: the only way forward is to wait for something already running.
      const soonest = running.reduce<{ id: StepId; finishAt: number } | undefined>(
        (best, r) => (best === undefined || r.finishAt < best.finishAt ? r : best),
        undefined,
      )
      if (!soonest) break
      idle += Math.max(0, soonest.finishAt - clock)
      clock = Math.max(clock, soonest.finishAt)
      done.add(soonest.id)
      running.splice(running.indexOf(soonest), 1)
      continue
    }

    const step = byId.get(next)!
    order.push(next)

    if (isUnattended(step.effort)) {
      running.push({ id: next, finishAt: clock + stepMinutes(step) })
      continue
    }

    // Hands-on work occupies the cook, so the clock advances.
    clock += stepMinutes(step)
    done.add(next)
    for (const finished of running.filter((r) => r.finishAt <= clock)) {
      done.add(finished.id)
      running.splice(running.indexOf(finished), 1)
    }
  }

  // Anything still running simply has to finish.
  for (const r of running) {
    idle += Math.max(0, r.finishAt - clock)
    clock = Math.max(clock, r.finishAt)
    done.add(r.id)
  }

  return { order, totalMinutes: clock, idleMinutes: idle }
}

export type ResolvedInput =
  { kind: 'ingredient'; id: IngredientId; leaf: Leaf } | { kind: 'step'; id: StepId; name: string }

/**
 * A step's inputs as things a cook can go and fetch.
 *
 * On a chart an input is the cell next to you, so it needs no name. A cook-mode card shows one
 * step alone, so every input has to resolve to either an actual ingredient row — with its
 * quantity — or a named intermediate result.
 */
export function resolveInputs(component: Component, id: StepId): ResolvedInput[] {
  const step = component.steps[id]
  if (!step) return []
  return step.inputs.flatMap((input): ResolvedInput[] => {
    if (input.kind === 'step') {
      return [{ kind: 'step', id: input.id, name: describeOutput(component, input.id) }]
    }
    const leaf = findLeaf(component, input.id)
    return leaf ? [{ kind: 'ingredient', id: input.id, leaf }] : []
  })
}

/**
 * What else the cook could get on with while this step is under way.
 *
 * Only offered for steps you can walk away from — suggesting a second task during a step that
 * needs both hands is how you end up with two burnt things instead of one.
 */
/**
 * Steps a cook standing at `current` could genuinely start next.
 *
 * Two exclusions, both learned by rendering it wrong:
 *
 * Everything the current step depends on has necessarily already happened — you cannot be
 * baking a pie you have not assembled — so those are settled whether or not anyone ticked them
 * off. Without that, cook mode at the oven with shepherd's pie in it offered "heat", "dice" and
 * "cut up into small pieces", all of them a dozen minutes behind.
 *
 * But *not* the current step itself, which is still running. Counting it as settled made its own
 * successor look available: during the bread's thirty-minute autolyse it offered "fold the
 * dough", which is exactly the thing the waiting is blocking.
 */
export function outstandingSteps(
  component: Component,
  current: StepId,
  done: ReadonlySet<StepId>,
): StepId[] {
  const settled = new Set<StepId>([...done, ...subtreeSteps(component, current)])
  settled.delete(current)
  return readySteps(component, settled, new Set([current]))
}

export function whileThisRuns(
  component: Component,
  current: StepId,
  done: ReadonlySet<StepId>,
): StepId[] {
  const step = component.steps[current]
  if (!step || !isUnattended(step.effort)) return []
  return outstandingSteps(component, current, done)
}

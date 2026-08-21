/**
 * Chain collapse — the middle rung of the responsive ladder.
 *
 * A convergence grid gets wide because of *depth*, and most of that depth is single-file: a run
 * like `heat → med-low until tender → cook until meat is no longer pink` is three columns that
 * fork nowhere and merge nothing. Those columns cost width and carry no structure.
 *
 * Collapsing them sheds the columns that only encode "and then". Shepherd's pie goes from eleven
 * columns to six.
 *
 * What that costs, stated precisely: PHASE-04 predicted this would happen "without losing a
 * single merge point", and both halves cannot hold. On this corpus almost every step adds
 * ingredients of its own, so the runs available to collapse are runs *of merges*, and merging two
 * merges leaves one. The merge count really does fall.
 *
 * What survives is the thing that matters. Every ingredient still arrives at a labelled step, and
 * the renderer lays a collapsed run out as a stack aligned to the rows each part adds — so
 * `ground lamb` still sits beside "cook until meat is no longer pink" after six columns have
 * become one. The trade is spatial *ordering* for width, not structure for width.
 *
 * Implemented as a transform on the *component*, so the result goes back through `layout()` and
 * inherits every invariant rather than reimplementing them on a plan.
 */

import { childSteps, stepsOf, type Component, type Step, type StepId } from './model.js'

export type CondenseOptions = {
  /** Stop collapsing once the plan would be this wide, including the ingredient column. */
  maxColumns?: number
  /** Steps to leave at full resolution. The critical path is the usual argument. */
  keep?: ReadonlySet<StepId>
}

export type Condensed = {
  component: Component
  /**
   * For each surviving step, the original steps it now stands for, in order. A step that was
   * not collapsed maps to just itself, so a renderer never needs a special case.
   */
  merged: Map<StepId, StepId[]>
}

/** Which step consumes this one, if exactly one does. */
function soleConsumer(component: Component, id: StepId): StepId | undefined {
  const consumers = stepsOf(component).filter((s) =>
    s.inputs.some((i) => i.kind === 'step' && i.id === id),
  )
  return consumers.length === 1 ? consumers[0]!.id : undefined
}

/** The single step this one builds on, if it builds on exactly one. */
function soleStepInput(step: Step): StepId | undefined {
  const stepInputs = step.inputs.filter((i) => i.kind === 'step')
  return stepInputs.length === 1 ? stepInputs[0]!.id : undefined
}

/**
 * Maximal runs of steps joined single-file: each link is a step whose only step-input is the
 * previous, where the previous feeds nothing else. Breaking either condition ends the run,
 * because that is where the tree actually branches or merges.
 */
function chainsOf(component: Component): StepId[][] {
  const starts = stepsOf(component).filter((step) => {
    const prior = soleStepInput(step)
    return prior === undefined || soleConsumer(component, prior) !== step.id
  })

  const chains: StepId[][] = []
  for (const start of starts) {
    const chain: StepId[] = [start.id]
    let cursor: StepId | undefined = start.id
    while (cursor !== undefined) {
      const next: StepId | undefined = soleConsumer(component, cursor)
      if (next === undefined) break
      const nextStep = component.steps[next]
      if (!nextStep || soleStepInput(nextStep) !== cursor) break
      chain.push(next)
      cursor = next
    }
    if (chain.length > 1) chains.push(chain)
  }
  return chains
}

function collapse(component: Component, chain: StepId[]): Component {
  const steps: Record<StepId, Step> = { ...component.steps }
  const first = steps[chain[0]!]!
  const last = steps[chain[chain.length - 1]!]!

  // The surviving step keeps the *last* id, because that is what everything downstream
  // references, and gathers every ingredient the run consumed along the way.
  const ingredients = chain.flatMap((id) =>
    steps[id]!.inputs.filter((i) => i.kind === 'ingredient'),
  )
  const outsideInputs = first.inputs.filter((i) => i.kind === 'step')

  const merged: Step = {
    ...last,
    inputs: [...outsideInputs, ...ingredients],
    text: chain.map((id) => steps[id]!.text).join(' → '),
    // Duration and effort belong to the run as a whole: the longest wait dominates what the
    // reader needs to know about it.
    effort: chain.map((id) => steps[id]!.effort).sort(byWeight)[0]!,
  }

  for (const id of chain) delete steps[id]
  steps[merged.id] = merged

  return { ...component, steps }
}

const WEIGHT = { passive: 0, 'long-unattended': 1, minutes: 2, quick: 3 } as const
const byWeight = (a: Step['effort'], b: Step['effort']) => WEIGHT[a] - WEIGHT[b]

/**
 * Collapses single-file runs until the chart is narrow enough, side branches first.
 *
 * The critical path is what the reader is following, so it keeps its resolution longest; a
 * three-step prep chain hanging off the side is the first thing worth compressing.
 */
export function condense(component: Component, options: CondenseOptions = {}): Condensed {
  const keep = options.keep ?? new Set<StepId>()
  const target = options.maxColumns ?? 6

  let working = component
  const merged = new Map<StepId, StepId[]>(stepsOf(component).map((s) => [s.id, [s.id]]))

  // `keep` is a preference, not a prohibition. Treating it as a veto collapsed nothing at all
  // on this corpus: these recipes are chains, so the critical path *is* the recipe, and
  // protecting it protects everything. Side branches go first; the long pole goes only if the
  // chart is still too wide without it.
  for (;;) {
    const height = depthOf(working)
    if (height + 1 <= target) break

    const chains = chainsOf(working).sort((a, b) => {
      const aKept = a.some((id) => keep.has(id)) ? 1 : 0
      const bKept = b.some((id) => keep.has(id)) ? 1 : 0
      return aKept - bKept || b.length - a.length
    })
    if (chains.length === 0) break

    // Collapse only as far as the target needs, not the whole run. Swallowing a nine-step chain
    // whole took the bread from ten columns to two — one cell containing the entire recipe,
    // which is not a chart. Each merge sheds (length − 1) columns, so take the shortest prefix
    // that closes the gap.
    const excess = height + 1 - target
    const chain = chains[0]!.slice(0, Math.min(chains[0]!.length, excess + 1))
    if (chain.length < 2) break
    const survivor = chain[chain.length - 1]!
    merged.set(
      survivor,
      chain.flatMap((id) => merged.get(id) ?? [id]),
    )
    for (const id of chain.slice(0, -1)) merged.delete(id)
    working = collapse(working, chain)
  }

  return { component: working, merged }
}

/** Longest chain of steps below the root — the chart's column count, less the ingredient column. */
function depthOf(component: Component): number {
  const cache = new Map<StepId, number>()
  const walk = (id: StepId): number => {
    const hit = cache.get(id)
    if (hit !== undefined) return hit
    const step = component.steps[id]
    let h = 0
    if (step) for (const child of childSteps(component, step)) h = Math.max(h, walk(child.id) + 1)
    cache.set(id, h)
    return h
  }
  return walk(component.root) + 1
}

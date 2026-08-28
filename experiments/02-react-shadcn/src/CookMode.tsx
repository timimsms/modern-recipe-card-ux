import {
  completedIn,
  completionAt,
  cookSchedule,
  isUnattended,
  resolveInputs,
  stepKey,
  type Component,
  type GridPlan,
  type Recipe,
} from '@recipe/core'
import { formatScaled, scaleQuantity, stepMinutes, stepsOf } from '@recipe/core'
import { MiniMap } from './MiniMap'
import { store, useCookState } from './useStore'

/**
 * Cook mode — one step at a time, for a phone propped against a canister.
 *
 * The same three things that keep track 01's version from being a numbered list: the mini-map, so
 * the tree stays visible; inputs resolved to *named* prior results rather than "the previous
 * step"; and a position counted across the whole recipe rather than within a component.
 *
 * Everything about *what* to show comes from `@recipe/core` — `cookSchedule` for the order,
 * `resolveInputs` for the inputs, `completionAt` for the ending. This component decides only how
 * it looks, which is the point of the bake-off.
 */

/** Every step of every component, flattened. Components are sequential; the pie eats the potatoes. */
function path(recipe: Recipe) {
  return recipe.components.flatMap((component, componentIndex) =>
    cookSchedule(component).order.map((stepId) => ({ componentIndex, stepId })),
  )
}

function progressByTime(recipe: Recipe, done: ReadonlySet<string>) {
  let total = 0
  let complete = 0
  for (const component of recipe.components) {
    for (const step of stepsOf(component)) {
      const minutes = stepMinutes(step)
      total += minutes
      if (done.has(stepKey(component, step.id))) complete += minutes
    }
  }
  return total === 0 ? 0 : complete / total
}

export function CookMode({
  recipe,
  plans,
  scale,
  at,
  onMove,
}: {
  recipe: Recipe
  plans: GridPlan[]
  scale: number
  at: number
  onMove: (index: number) => void
}) {
  const state = useCookState()
  const steps = path(recipe)
  const here = steps[Math.min(at, steps.length - 1)]!
  const component: Component = recipe.components[here.componentIndex]!
  const plan = plans[here.componentIndex]!
  const step = component.steps[here.stepId]!
  const key = stepKey(component, here.stepId)

  const done = completedIn(component, state)
  const inputs = resolveInputs(component, here.stepId)
  const completion = completionAt(recipe, here.componentIndex, state)
  const percent = Math.round(progressByTime(recipe, state.completedSteps) * 100)

  const next = () => {
    // Moving on *is* finishing: without this the mini-map never fills as you cook, which is the
    // one job it has.
    if (!state.completedSteps.has(key)) store.toggleStep(key)
    onMove(at + 1)
  }

  return (
    <article className="overflow-hidden rounded border border-hairline bg-surface" data-card>
      <header className="flex items-baseline gap-3 border-b border-hairline px-4 py-3 font-mono text-label text-ink-faint">
        <span data-count>
          {at + 1} of {steps.length}
        </span>
        {recipe.components.length > 1 && component.title && <span>{component.title}</span>}
        {/* Time-weighted, and it says so: 4 of 5 steps done is not 80% when the fifth is a
            three-hour braise. */}
        <span className="ms-auto" data-progress>
          {percent}% of the time
        </span>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <p className="m-0 text-2xl" data-step-text>
          {step.text}
        </p>
        {isUnattended(step.effort) && (
          <span className="w-fit rounded-full border border-clay px-2 py-0.5 font-mono text-label text-clay">
            ◷ {step.duration ? `${step.duration.min}${step.duration.unit}` : 'you can walk away'}
          </span>
        )}

        <ul className="m-0 flex list-none flex-col gap-1 border-t border-hairline p-0 pt-3">
          {inputs.map((input) =>
            input.kind === 'step' ? (
              <li key={input.id} className="text-rule italic underline">
                {input.name}
              </li>
            ) : (
              <li key={input.id}>
                <span className="font-mono">
                  {input.quantity ? formatScaled(scaleQuantity(input.quantity, scale)) : ''}
                </span>{' '}
                <span>
                  {'component' in input.leaf
                    ? (input.leaf.label ?? input.leaf.component)
                    : input.leaf.item}
                </span>
              </li>
            ),
          )}
        </ul>
      </div>

      {completion.kind !== 'none' && (
        <p
          className={`m-0 flex items-baseline gap-2 border-t border-hairline px-4 py-2.5 font-mono text-label ${
            completion.kind === 'all' ? 'bg-depth-3 text-rule-heavy' : 'bg-depth-4 text-ink-soft'
          }`}
          data-ending={completion.kind}
        >
          {/* Half-filled square for a part, filled for the whole — shape as well as fill, so it
              survives greyscale. */}
          <span
            aria-hidden
            className="inline-block size-[0.72em] rounded-[1px] border-[1.5px] border-current"
            style={{
              background:
                completion.kind === 'all'
                  ? 'currentColor'
                  : 'linear-gradient(to right, currentColor 0 50%, transparent 50%)',
            }}
          />
          {completion.kind === 'all' ? (
            <span>
              <b>All done.</b> {recipe.title} is finished.
            </span>
          ) : (
            <span>
              <b>{completion.component.title ?? 'This part'} done</b> — part {completion.index + 1}{' '}
              of {completion.of}. {completion.next.title ?? 'The next part'} is next, and its map
              starts empty.
            </span>
          )}
        </p>
      )}

      <div className="flex flex-col items-center gap-1.5 border-t border-hairline py-3.5">
        <MiniMap plan={plan} current={here.stepId} done={done} />
        {recipe.components.length > 1 && (
          <span className="font-mono text-[0.7rem] text-ink-faint">
            part {here.componentIndex + 1} of {recipe.components.length}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 border-t border-hairline">
        <button
          type="button"
          className="min-h-12 border-e border-hairline disabled:opacity-45"
          disabled={at === 0}
          onClick={() => onMove(at - 1)}
        >
          Back
        </button>
        <button
          type="button"
          className="min-h-12 border-e border-hairline bg-depth-4"
          data-done
          onClick={() => store.toggleStep(key)}
        >
          {state.completedSteps.has(key) ? 'Done ✓' : 'Mark done'}
        </button>
        <button
          type="button"
          className="min-h-12 disabled:opacity-45"
          data-next
          disabled={at >= steps.length - 1}
          onClick={next}
        >
          Next
        </button>
      </div>
    </article>
  )
}

import { For, Show } from 'solid-js'
import { completedIn, completionAt, isUnattended, resolveInputs } from '@recipe/core'
import { cookPath, inputParts, miniCells, progressByTime, stepKey } from '../shared.js'
import { cookState, store } from './store.js'

export function CookMode(props) {
  // Thunks throughout: Solid's reactivity lives in the accessor, so anything derived from a prop
  // has to be re-read rather than captured. Destructuring `props` here would render once and then
  // silently stop.
  const steps = () => cookPath(props.recipe)
  const here = () => steps()[Math.min(props.at, steps().length - 1)]
  const component = () => props.recipe.components[here().componentIndex]
  const plan = () => props.plans[here().componentIndex]
  const step = () => component().steps[here().stepId]
  const key = () => stepKey(component(), here().stepId)
  const done = () => completedIn(component(), cookState())
  const completion = () => completionAt(props.recipe, here().componentIndex, cookState())
  const percent = () => Math.round(progressByTime(props.recipe, cookState().completedSteps) * 100)

  const next = () => {
    // Moving on *is* finishing: otherwise the mini-map never fills as you cook.
    if (!cookState().completedSteps.has(key())) store.toggleStep(key())
    props.onMove(props.at + 1)
  }

  return (
    <article class="card" data-card>
      <header class="cm-head">
        <span data-count>
          {props.at + 1} of {steps().length}
        </span>
        <Show when={props.recipe.components.length > 1 && component().title}>
          <span>{component().title}</span>
        </Show>
        <span class="cm-progress" data-progress>
          {percent()}% of the time
        </span>
      </header>

      <div class="cm-body">
        <p class="cm-text" data-step-text>
          {step().text}
        </p>
        <Show when={isUnattended(step().effort)}>
          <span class="cm-mark">
            ◷{' '}
            {step().duration
              ? `${step().duration.min}${step().duration.unit}`
              : 'you can walk away'}
          </span>
        </Show>
        <ul class="inputs">
          <For each={resolveInputs(component(), here().stepId)}>
            {(input) => {
              const parts = () => inputParts(input, props.scale)
              return (
                <Show
                  when={parts().kind === 'ingredient'}
                  fallback={<li class="from-step">{parts().name}</li>}
                >
                  <li>
                    <span class="qty">{parts().quantity}</span>
                    <span>{parts().label}</span>
                  </li>
                </Show>
              )
            }}
          </For>
        </ul>
      </div>

      <Show when={completion().kind !== 'none'}>
        <p class={`ending ${completion().kind}`} data-ending={completion().kind}>
          <span
            class={`seal seal-${completion().kind === 'all' ? 'all' : 'part'}`}
            aria-hidden="true"
          />
          <Show
            when={completion().kind === 'all'}
            fallback={
              <span>
                <b>{completion().component?.title ?? 'This part'} done</b> — part{' '}
                {completion().index + 1} of {completion().of}.{' '}
                {completion().next?.title ?? 'The next part'} is next, and its map starts empty.
              </span>
            }
          >
            <span>
              <b>All done.</b> {props.recipe.title} is finished.
            </span>
          </Show>
        </p>
      </Show>

      <div class="cm-map">
        <div
          class="minimap"
          role="img"
          aria-label={`Recipe map: ${plan().linearization.length} steps, ${done().size} complete.`}
          style={`grid-template-columns:repeat(${plan().columnCount},9px);grid-auto-rows:9px`}
        >
          <For each={miniCells(plan(), here().stepId, done())}>
            {(cell) => <i class={cell.state} style={cell.style} />}
          </For>
        </div>
        <Show when={props.recipe.components.length > 1}>
          <span class="cm-part">
            part {here().componentIndex + 1} of {props.recipe.components.length}
          </span>
        </Show>
      </div>

      <div class="cm-nav">
        <button type="button" disabled={props.at === 0} onClick={() => props.onMove(props.at - 1)}>
          Back
        </button>
        <button type="button" class="cm-done" data-done onClick={() => store.toggleStep(key())}>
          {cookState().completedSteps.has(key()) ? 'Done ✓' : 'Mark done'}
        </button>
        <button type="button" data-next disabled={props.at >= steps().length - 1} onClick={next}>
          Next
        </button>
      </div>
    </article>
  )
}

<script>
  import {
    completedIn,
    completionAt,
    isUnattended,
    resolveInputs,
  } from '@recipe/core'
  import { cookPath, inputParts, miniCells, progressByTime, stepKey } from '../shared.js'
  import { cookState, store } from './store.svelte.js'

  let { recipe, plans, scale, at, onMove } = $props()

  const state = $derived(cookState())
  const steps = $derived(cookPath(recipe))
  const here = $derived(steps[Math.min(at, steps.length - 1)])
  const component = $derived(recipe.components[here.componentIndex])
  const plan = $derived(plans[here.componentIndex])
  const step = $derived(component.steps[here.stepId])
  const key = $derived(stepKey(component, here.stepId))
  const done = $derived(completedIn(component, state))
  const inputs = $derived(resolveInputs(component, here.stepId))
  const completion = $derived(completionAt(recipe, here.componentIndex, state))
  const percent = $derived(Math.round(progressByTime(recipe, state.completedSteps) * 100))

  function next() {
    // Moving on *is* finishing: otherwise the mini-map never fills as you cook.
    if (!state.completedSteps.has(key)) store.toggleStep(key)
    onMove(at + 1)
  }
</script>

<article class="card" data-card>
  <header class="cm-head">
    <span data-count>{at + 1} of {steps.length}</span>
    {#if recipe.components.length > 1 && component.title}<span>{component.title}</span>{/if}
    <span class="cm-progress" data-progress>{percent}% of the time</span>
  </header>

  <div class="cm-body">
    <p class="cm-text" data-step-text>{step.text}</p>
    {#if isUnattended(step.effort)}
      <span class="cm-mark"
        >◷ {step.duration ? `${step.duration.min}${step.duration.unit}` : 'you can walk away'}</span
      >
    {/if}
    <ul class="inputs">
      {#each inputs as input (input.id)}
        {@const parts = inputParts(input, scale)}
        {#if parts.kind === 'step'}
          <li class="from-step">{parts.name}</li>
        {:else}
          <li
            ><span class="qty">{parts.quantity}</span><span>{parts.label}</span></li
          >
        {/if}
      {/each}
    </ul>
  </div>

  {#if completion.kind !== 'none'}
    <p class="ending {completion.kind}" data-ending={completion.kind}>
      <span class="seal seal-{completion.kind === 'all' ? 'all' : 'part'}" aria-hidden="true"></span>
      {#if completion.kind === 'all'}
        <span><b>All done.</b> {recipe.title} is finished.</span>
      {:else}
        <span
          ><b>{completion.component.title ?? 'This part'} done</b> — part {completion.index + 1} of
          {completion.of}. {completion.next.title ?? 'The next part'} is next, and its map starts empty.</span
        >
      {/if}
    </p>
  {/if}

  <div class="cm-map">
    <div
      class="minimap"
      role="img"
      aria-label="Recipe map: {plan.linearization.length} steps, {done.size} complete."
      style="grid-template-columns:repeat({plan.columnCount},9px);grid-auto-rows:9px"
    >
      {#each miniCells(plan, here.stepId, done) as cellItem (cellItem.key)}
        <i class={cellItem.state} style={cellItem.style}></i>
      {/each}
    </div>
    {#if recipe.components.length > 1}
      <span class="cm-part">part {here.componentIndex + 1} of {recipe.components.length}</span>
    {/if}
  </div>

  <div class="cm-nav">
    <button type="button" disabled={at === 0} onclick={() => onMove(at - 1)}>Back</button>
    <button type="button" class="cm-done" data-done onclick={() => store.toggleStep(key)}>
      {state.completedSteps.has(key) ? 'Done ✓' : 'Mark done'}
    </button>
    <button type="button" data-next disabled={at >= steps.length - 1} onclick={next}>Next</button>
  </div>
</article>

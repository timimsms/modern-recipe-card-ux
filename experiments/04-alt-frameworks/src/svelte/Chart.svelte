<script>
  import {
    cellStyle,
    chartStyle,
    depthClass,
    ingredientKey,
    leafOf,
    leafParts,
    stepMark,
  } from '../shared.js'

  let { component, plan, scale, checked, onToggle } = $props()

  const preludeRows = $derived(plan.preludes.length > 0 ? 1 : 0)
</script>

<div class="scroller">
  <div class="chart" style={chartStyle(plan, preludeRows)}>
    {#each plan.preludes as prelude, i (prelude.ref)}
      <div class="cell prelude" style="grid-area:1/1/2/{plan.columnCount + 1}">
        {component.prelude[i]?.text}
      </div>
    {/each}

    {#each plan.cells as cell (cell.kind + cell.row + '/' + cell.col)}
      {#if cell.kind === 'ingredient'}
        {@const key = ingredientKey(component, cell.ref)}
        {@const parts = leafParts(leafOf(component, cell.ref), scale)}
        <label
          class="cell ing"
          class:checked={checked.has(key)}
          style={cellStyle(cell, preludeRows)}
          data-row={key}
        >
          <input
            type="checkbox"
            data-ing={key}
            checked={checked.has(key)}
            onchange={() => onToggle(key)}
          />
          <!-- No whitespace between these spans. Svelte keeps template whitespace and JSX
               strips it, so leaving it here rendered the same row 3.7px wider in Svelte than in
               Solid — a visible difference caused entirely by template syntax, in a track whose
               premise is that only the framework differs. -->
          <span class="ing-text"
            >{#if parts.quantity}<span class="qty">{parts.quantity}</span
              >{/if}<span>{parts.label}</span
            >{#if parts.note}<span class="note">{parts.note}</span>{/if}</span
          >
        </label>
      {:else if cell.kind === 'step'}
        {@const step = component.steps[cell.ref]}
        <div
          class="cell step {depthClass(cell.depth, plan.maxDepth)}"
          style={cellStyle(cell, preludeRows)}
          data-step={cell.ref}
        >
          <span>{step.text}</span>
          {#if stepMark(step)}<span class="mark">{stepMark(step)}</span>{/if}
        </div>
      {/if}
    {/each}
  </div>
</div>

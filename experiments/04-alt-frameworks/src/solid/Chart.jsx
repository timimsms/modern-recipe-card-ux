import { For, Show } from 'solid-js'
import {
  cellStyle,
  chartStyle,
  depthClass,
  ingredientKey,
  leafOf,
  leafParts,
  stepMark,
} from '../shared.js'

/**
 * The same chart, in Solid.
 *
 * `props` is deliberately not destructured: Solid's reactivity is carried by the property
 * accessors, and pulling `scale` out into a local would freeze it at first render. That is the
 * single sharpest ergonomic difference from React so far, and it is the kind of mistake that
 * looks like nothing and simply stops updating.
 */
export function Chart(props) {
  const preludeRows = () => (props.plan.preludes.length > 0 ? 1 : 0)

  return (
    <div class="scroller">
      <div class="chart" style={chartStyle(props.plan, preludeRows())}>
        <For each={props.plan.preludes}>
          {(prelude, i) => (
            <div
              class="cell prelude"
              style={`grid-area:1/1/2/${props.plan.columnCount + 1}`}
              data-prelude={prelude.ref}
            >
              {props.component.prelude[i()]?.text}
            </div>
          )}
        </For>

        <For each={props.plan.cells}>
          {(cell) => (
            <Show when={cell.kind !== 'filler'}>
              <Show
                when={cell.kind === 'ingredient'}
                fallback={
                  <div
                    class={`cell step ${depthClass(cell.depth, props.plan.maxDepth)}`}
                    style={cellStyle(cell, preludeRows())}
                    data-step={cell.ref}
                  >
                    <span>{props.component.steps[cell.ref].text}</span>
                    <Show when={stepMark(props.component.steps[cell.ref])}>
                      <span class="mark">{stepMark(props.component.steps[cell.ref])}</span>
                    </Show>
                  </div>
                }
              >
                {(() => {
                  const key = ingredientKey(props.component, cell.ref)
                  // A thunk, so the quantity re-reads `props.scale` on every change. This is the
                  // fine-grained update the phase doc wants measured: only the text node moves.
                  const parts = () => leafParts(leafOf(props.component, cell.ref), props.scale)
                  return (
                    <label
                      class="cell ing"
                      classList={{ checked: props.checked.has(key) }}
                      style={cellStyle(cell, preludeRows())}
                      data-row={key}
                    >
                      <input
                        type="checkbox"
                        data-ing={key}
                        checked={props.checked.has(key)}
                        onChange={() => props.onToggle(key)}
                      />
                      <span class="ing-text">
                        <Show when={parts().quantity}>
                          <span class="qty">{parts().quantity}</span>
                        </Show>
                        <span>{parts().label}</span>
                        <Show when={parts().note}>
                          <span class="note">{parts().note}</span>
                        </Show>
                      </span>
                    </label>
                  )
                })()}
              </Show>
            </Show>
          )}
        </For>
      </div>
    </div>
  )
}

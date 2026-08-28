import type { Component, GridPlan, Leaf, PlacedCell } from '@recipe/core'
import { formatScaled, ingredientKey, isUnattended, scaleQuantity, stepKey } from '@recipe/core'

/**
 * The wall chart, in React.
 *
 * Deliberately the *same* CSS Grid geometry as track 01 — one grid, cells placed by
 * `grid-area` from the plan's rows and columns. Phase 07 rule 5 says be idiomatic within the
 * track, and this is: the interesting difference between tracks 01 and 02 is the programming
 * model, not the layout technique. Rendering it a second way would confound the comparison with a
 * design choice.
 *
 * What *is* different is that this is a component tree with props rather than a string builder,
 * and every cell is a real element React owns — which is what makes the Phase 08 update-cost
 * measurement meaningful when a scale change touches every quantity at once.
 */

const edgeWidth = {
  none: '0px',
  hairline: '1px',
  rule: '1.5px',
  heavy: '2.5px',
} as const

/** Depth → one of the five ramp steps, scaled to this chart rather than used absolutely. */
function depthClass(depth: number, maxDepth: number): string {
  const ramp = ['bg-depth-0', 'bg-depth-1', 'bg-depth-2', 'bg-depth-3', 'bg-depth-4']
  if (maxDepth <= 0) return ramp[0]!
  const index = Math.min(ramp.length - 1, Math.round((depth / maxDepth) * (ramp.length - 1)))
  return ramp[index]!
}

function area(cell: PlacedCell, preludeRows: number) {
  const row = cell.row + preludeRows + 1
  const col = cell.col + 1
  return {
    gridArea: `${row}/${col}/${row + cell.rowSpan}/${col + cell.colSpan}`,
    borderTopWidth: edgeWidth[cell.edges.top],
    borderRightWidth: edgeWidth[cell.edges.right],
    borderBottomWidth: edgeWidth[cell.edges.bottom],
    borderLeftWidth: edgeWidth[cell.edges.left],
  }
}

function leafText(leaf: Leaf | undefined, scale: number) {
  if (!leaf) return { quantity: '', label: '', note: undefined }
  const label = 'component' in leaf ? (leaf.label ?? leaf.component) : leaf.item
  const quantity = leaf.quantity ? formatScaled(scaleQuantity(leaf.quantity, scale)) : ''
  return { quantity, label, note: leaf.note }
}

type Props = {
  component: Component
  plan: GridPlan
  scale: number
  checked: ReadonlySet<string>
  onToggle: (key: string) => void
}

export function Chart({ component, plan, scale, checked, onToggle }: Props) {
  const preludeRows = plan.preludes.length > 0 ? 1 : 0
  const leafById = new Map(component.ingredients.map((l) => [l.id, l]))

  return (
    <div className="overflow-x-auto px-4 pb-4">
      <div
        className="grid gap-[2px]"
        style={{
          gridTemplateColumns: `minmax(13rem, 22rem) repeat(${plan.columnCount - 1}, minmax(6.5rem, 20rem))`,
          gridTemplateRows: `repeat(${plan.rows + preludeRows}, auto)`,
        }}
      >
        {plan.preludes.map((prelude, i) => (
          <div
            key={prelude.ref}
            className="rounded-sm border border-hairline bg-depth-4 px-2 py-1.5 text-step font-semibold"
            style={{ gridArea: `1/1/2/${plan.columnCount + 1}` }}
          >
            {component.prelude[i]?.text}
          </div>
        ))}

        {plan.cells.map((cell) => {
          if (cell.kind === 'filler') return null

          if (cell.kind === 'ingredient') {
            const leaf = leafById.get(cell.ref)
            const { quantity, label, note } = leafText(leaf, scale)
            // Component-qualified: shepherd's pie has `salt` in both components, and a bare id
            // would tick the wrong row. The store's identity, borrowed by a track that does not
            // yet have the store.
            const key = ingredientKey(component, cell.ref)
            return (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-2 rounded-sm border-solid border-rule bg-surface px-2 py-1.5 text-ingredient"
                style={area(cell, preludeRows)}
                data-row={key}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-rule"
                  checked={checked.has(key)}
                  onChange={() => onToggle(key)}
                  data-ing={key}
                />
                <span className={checked.has(key) ? 'opacity-50' : undefined}>
                  {quantity && <span className="font-mono">{quantity} </span>}
                  <span>{label}</span>
                  {note && <span className="block text-ink-faint italic">{note}</span>}
                </span>
              </label>
            )
          }

          const step = component.steps[cell.ref]!
          return (
            <div
              key={stepKey(component, cell.ref)}
              className={`rounded-sm border-solid border-rule px-2 py-1.5 text-step font-medium ${depthClass(cell.depth, plan.maxDepth)}`}
              style={area(cell, preludeRows)}
              data-step={cell.ref}
            >
              <span className="block text-end">{step.text}</span>
              {isUnattended(step.effort) && (
                // R5: never colour alone. The glyph and the duration carry it too.
                <span className="mt-1 block text-end font-mono text-label text-clay">
                  ◷ {step.duration ? `${step.duration.min}${step.duration.unit}` : 'walk away'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

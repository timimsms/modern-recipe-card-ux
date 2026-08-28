import type { GridPlan } from '@recipe/core'

/**
 * The plan at thumbnail scale — the element PHASE-04 calls load-bearing, because stepping through
 * a tree one node at a time is a numbered list unless the reader can still see the tree.
 *
 * No text: at this size type is grey mush, and the information is shape and position.
 */
export function MiniMap({
  plan,
  current,
  done,
  cell = 9,
}: {
  plan: GridPlan
  current?: string
  done: ReadonlySet<string>
  cell?: number
}) {
  return (
    <div
      className="grid gap-px"
      role="img"
      aria-label={`Recipe map: ${plan.linearization.length} steps, ${done.size} complete.`}
      style={{
        gridTemplateColumns: `repeat(${plan.columnCount}, ${cell}px)`,
        gridAutoRows: `${cell}px`,
      }}
    >
      {plan.cells.map((c) => {
        if (c.kind === 'filler') return null
        const state =
          c.kind === 'ingredient'
            ? 'bg-hairline'
            : c.ref === current
              ? 'bg-clay'
              : done.has(c.ref)
                ? 'bg-rule'
                : 'bg-depth-3'
        return (
          <i
            key={`${c.kind}-${c.row}-${c.col}`}
            className={`rounded-[1px] ${state}`}
            data-mm={c.kind === 'step' ? c.ref : undefined}
            style={{
              gridArea: `${c.row + 1}/${c.col + 1}/${c.row + 1 + c.rowSpan}/${c.col + 1 + c.colSpan}`,
            }}
          />
        )
      })}
    </div>
  )
}

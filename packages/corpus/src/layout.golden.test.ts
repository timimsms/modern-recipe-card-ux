import { describe, expect, it } from 'vitest'
import { layout, type ColumnStrategy, type GridPlan } from '@recipe/core'
import { loadRecipes, loadValidFixtures } from './index.js'

const STRATEGIES: ColumnStrategy[] = ['right-packed', 'left-packed', 'stretch-to-merge']

/**
 * Golden files as text rather than JSON.
 *
 * A layout change should surface as a reviewable diff, and a diff of serialised objects is not
 * reviewable — you cannot see a cell move. This renders the grid, so a strategy change reads as
 * the shape changing, which is the thing anyone reviewing it actually cares about.
 */
function render(plan: GridPlan): string {
  const width = 22
  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n))

  const lines: string[] = []
  lines.push(`${plan.rows} rows × ${plan.columnCount} cols · ${plan.columns} · reuse=${plan.reuse}`)
  for (const p of plan.preludes) lines.push(`prelude[${p.order}] spans ${p.colSpan}`)

  // A cell is written on the row where it starts; rows it continues into show a bar, which is
  // what makes a rowspan visible in a text diff.
  const grid: string[][] = Array.from({ length: plan.rows }, () =>
    Array.from({ length: plan.columnCount }, () => ''),
  )
  for (const cell of plan.cells) {
    const label =
      cell.kind === 'filler'
        ? cell.leader
          ? `···· leader ${cell.colSpan}`
          : `···· ${cell.colSpan}`
        : `${cell.ref}${cell.colSpan > 1 ? ` ⇥${cell.colSpan}` : ''}`
    grid[cell.row]![cell.col] = label
    for (let r = cell.row + 1; r < cell.row + cell.rowSpan; r++) grid[r]![cell.col] = '│'
    for (let c = cell.col + 1; c < cell.col + cell.colSpan; c++) {
      for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
        if (grid[r]![c] === '') grid[r]![c] = '─'
      }
    }
  }
  for (const row of grid)
    lines.push(
      row
        .map((c) => pad(c, width))
        .join('')
        .trimEnd(),
    )

  lines.push('')
  lines.push(`linearization: ${plan.linearization.join(' → ')}`)
  lines.push(`criticalPath:  ${plan.criticalPath.join(' → ')}`)
  const t = plan.timing
  lines.push(
    `timing[${t.basis}]: one cook ${t.singleCook}m (idle ${t.idle}m) · critical path ` +
      `${t.criticalPathDuration}m · serial ${t.serialTotal}m · saved ${t.parallelSaving}m · ` +
      `hands-on ${t.handsOn}m · longest walk-away ${t.longestWalkAway}m` +
      (t.passiveTotal ? ` · passive ${t.passiveTotal}m` : ''),
  )
  for (const c of plan.connections) {
    lines.push(
      `connection[${c.kind}]: ${c.leaf} (row ${c.fromRow}) → ${c.to} (row ${c.toRow}, col ${c.toCol})`,
    )
  }
  return lines.join('\n')
}

const entries = [...loadRecipes(), ...loadValidFixtures()]

describe.each(STRATEGIES)('golden layouts — %s', (strategy) => {
  it.each(entries.map((e) => [e.slug, e] as const))('%s', (slug, entry) => {
    const rendered = entry.recipe.components
      .map(
        (component) =>
          `── ${slug} / ${component.id} ──\n${render(layout(component, { columns: strategy }))}`,
      )
      .join('\n\n')
    expect(rendered).toMatchSnapshot()
  })
})

describe('every corpus entry lays out under every strategy', () => {
  it.each(entries.map((e) => [e.slug, e] as const))('%s', (_slug, entry) => {
    for (const strategy of STRATEGIES) {
      for (const component of entry.recipe.components) {
        const plan = layout(component, { columns: strategy })
        expect(plan.rows).toBe(component.ingredients.length)
        expect(plan.columnCount).toBeGreaterThan(1)

        // No overlaps, no holes — the two invariants every renderer depends on.
        const seen = new Set<string>()
        for (const cell of plan.cells) {
          for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
            for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
              expect(seen.has(`${r},${c}`)).toBe(false)
              seen.add(`${r},${c}`)
            }
          }
        }
        expect(seen.size).toBe(plan.rows * plan.columnCount)
      }
    }
  })
})

/**
 * The format's own argument for existing, expressed as a number. Recorded across the whole
 * corpus because the answer turned out to be uncomfortable — see findings/Q1-column-assignment.md
 * and the Phase 02 note in STATE.md.
 */
describe('parallel saving across the corpus', () => {
  it('is recorded for every recipe', () => {
    const report = loadRecipes()
      .flatMap((entry) =>
        entry.recipe.components.map((component) => {
          const t = layout(component).timing
          const pct = t.serialTotal === 0 ? 0 : Math.round((t.parallelSaving / t.serialTotal) * 100)
          return `${entry.slug}/${component.id}: saves ${t.parallelSaving}m of ${t.serialTotal}m (${pct}%)`
        }),
      )
      .join('\n')
    expect(report).toMatchSnapshot()
  })

  /**
   * The critical path assumes unlimited hands. This records what one person can actually
   * achieve, because the difference turned out to be the entire claimed saving.
   */
  it('is compared against what a single cook can reach', () => {
    const report = loadRecipes()
      .flatMap((entry) =>
        entry.recipe.components.map((component) => {
          const t = layout(component).timing
          const gap = t.singleCook - t.criticalPathDuration
          const verdict = gap > 0 ? `unreachable alone by ${gap}m` : 'reachable alone'
          return `${entry.slug}/${component.id}: critical path ${t.criticalPathDuration}m · one cook ${t.singleCook}m — ${verdict}`
        }),
      )
      .join('\n')
    expect(report).toMatchSnapshot()
  })
})

import { describe, expect, it } from 'vitest'
import { condense, formatDiagnostic, layout, validateComponent } from '@recipe/core'
import { loadRecipes } from './index.js'

/**
 * Chain collapse trades columns for detail, and the trade is only acceptable if it costs no
 * *structure*. A merge point is the entire information content of this format; a column that
 * only says "and then" is not.
 */

const entries = loadRecipes().flatMap((entry) =>
  entry.recipe.components.map(
    (component, i) =>
      [
        `${entry.slug}/${component.id}`,
        component,
        // The validator needs to know which components came first, or a legitimate
        // cross-component reference reads as a forward reference (E6).
        new Set(entry.recipe.components.slice(0, i).map((c) => c.id)),
      ] as const,
  ),
)

describe.each(entries)('%s condensed', (_name, component, earlier) => {
  const full = layout(component)
  const { component: condensed, merged } = condense(component, {
    maxColumns: 6,
    keep: new Set(full.criticalPath),
  })
  const small = layout(condensed)

  it('is still a valid component', () => {
    const errors = validateComponent(condensed, earlier).filter((d) => d.severity === 'error')
    expect(errors.map(formatDiagnostic)).toEqual([])
  })

  it('reaches the target width', () => {
    expect(small.columnCount).toBeLessThanOrEqual(Math.max(6, 2))
  })

  it('never gets wider', () => {
    expect(small.columnCount).toBeLessThanOrEqual(full.columnCount)
  })

  it('keeps every ingredient row', () => {
    expect(small.rows).toBe(full.rows)
    expect([...small.rowOrder].sort()).toEqual([...full.rowOrder].sort())
  })

  /**
   * What collapsing actually costs, stated precisely.
   *
   * PHASE-04 predicted 11 columns to 6 "without losing a single merge point". Both halves
   * cannot hold: on this corpus almost every step adds ingredients, so the runs available to
   * collapse are runs *of merges*, and merging two merges leaves one. Shepherd's pie really
   * does reach six columns, and its merge count really does fall.
   *
   * What survives is that every ingredient still arrives at a labelled step, and the order it
   * arrived in is written inside the collapsed cell rather than drawn. The trade is spatial
   * ordering for width — not structure for width.
   */
  it('still consumes every ingredient', () => {
    const consumed = new Set(
      Object.values(condensed.steps).flatMap((s) =>
        s.inputs.filter((i) => i.kind === 'ingredient').map((i) => i.id),
      ),
    )
    for (const leaf of condensed.ingredients) expect(consumed.has(leaf.id)).toBe(true)
  })

  it('writes the collapsed order into the cell it kept', () => {
    for (const [survivor, parts] of merged) {
      if (parts.length < 2) continue
      const text = condensed.steps[survivor]?.text ?? ''
      for (const original of parts) {
        expect(text).toContain(component.steps[original]!.text)
      }
    }
  })

  it('accounts for every original step exactly once', () => {
    const accounted = [...merged.values()].flat().sort()
    expect(accounted).toEqual(Object.keys(component.steps).sort())
  })

  it('leaves the root reachable and the plan whole', () => {
    expect(condensed.steps[condensed.root]).toBeDefined()
    const covered = new Set<string>()
    for (const cell of small.cells) {
      for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
        for (let c = cell.col; c < cell.col + cell.colSpan; c++) covered.add(`${r},${c}`)
      }
    }
    expect(covered.size).toBe(small.rows * small.columnCount)
  })
})

describe('collapsing is proportionate', () => {
  it('sheds only the columns the target needs', () => {
    // Swallowing whole runs took the bread from ten columns to two — one cell containing the
    // entire recipe. Every recipe should land at the target, not below it.
    const widths = entries.map(([, component]: (typeof entries)[number]) => {
      const full = layout(component)
      const { component: condensed } = condense(component, {
        maxColumns: 6,
        keep: new Set(full.criticalPath),
      })
      return { before: full.columnCount, after: layout(condensed).columnCount }
    })
    for (const w of widths) {
      if (w.before > 6) expect(w.after).toBe(6)
      else expect(w.after).toBe(w.before)
    }
  })
})

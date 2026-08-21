import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { layout, type ColumnStrategy, type GridPlan } from './layout.js'
import { validateComponent } from './validate.js'
import type { Component, InputRef, Step, StepId } from './model.js'

const STRATEGIES: ColumnStrategy[] = ['right-packed', 'left-packed', 'stretch-to-merge']

// --- A generator for arbitrary well-formed trees -------------------------------------------
//
// Builds bottom-up: create some leaves, repeatedly consume a contiguous slice of the frontier
// into a new step, until one node remains. That construction can only produce trees whose
// authored ingredient order already satisfies contiguity, which is what we want — the engine's
// job is to lay out *valid* components, and the validator is what rejects the rest.

const EFFORTS = ['quick', 'minutes', 'long-unattended', 'passive'] as const

const treeArb = fc
  .record({
    leafCount: fc.integer({ min: 1, max: 12 }),
    seed: fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 40, maxLength: 40 }),
  })
  .map(({ leafCount, seed }): Component => {
    const ingredients = Array.from({ length: leafCount }, (_, i) => ({
      id: `ing-${i}`,
      item: `ingredient ${i}`,
    }))
    const steps: Record<StepId, Step> = {}
    let counter = 0
    let cursor = 0
    const next = (n: number) => (n <= 1 ? 0 : seed[cursor++ % seed.length]! % n)

    // The frontier: results not yet consumed by anything, in row order.
    let slots: InputRef[] = ingredients.map((ing) => ({ kind: 'ingredient', id: ing.id }))

    const emit = (inputs: InputRef[]): InputRef => {
      const id = `s${counter++}`
      steps[id] = {
        id,
        inputs,
        text: `step ${id}`,
        effort: EFFORTS[next(EFFORTS.length)]!,
      }
      return { kind: 'step', id }
    }

    // Consume a contiguous slice of two or more, so the frontier always shrinks. Taking a
    // slice of one would leave the frontier the same size and never terminate.
    while (slots.length > 1) {
      const width = 2 + next(Math.min(3, slots.length) - 1)
      const start = next(slots.length - width + 1)
      const taken = slots.slice(start, start + width)
      slots = [...slots.slice(0, start), emit(taken), ...slots.slice(start + width)]
    }

    // A single leaf still needs one step to consume it, or nothing reaches the root.
    if (counter === 0) emit(slots)

    return { id: 'generated', prelude: [], ingredients, root: `s${counter - 1}`, steps }
  })

// --- Invariants ------------------------------------------------------------------------------

function assertNoOverlap(plan: GridPlan): void {
  const seen = new Map<string, string>()
  for (const cell of plan.cells) {
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        const key = `${r},${c}`
        const prior = seen.get(key)
        expect(
          prior,
          `${key} claimed by both ${prior} and ${cell.kind}:${cell.ref}`,
        ).toBeUndefined()
        seen.set(key, `${cell.kind}:${cell.ref ?? ''}`)
      }
    }
  }
}

function assertFullCoverage(plan: GridPlan): void {
  const covered = new Set<string>()
  for (const cell of plan.cells) {
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) covered.add(`${r},${c}`)
    }
  }
  for (let r = 0; r < plan.rows; r++) {
    for (let c = 0; c < plan.columnCount; c++) {
      expect(covered.has(`${r},${c}`), `hole at row ${r}, col ${c}`).toBe(true)
    }
  }
}

describe.each(STRATEGIES)('%s — invariants over generated trees', (strategy) => {
  it('produces a plan with no overlaps and no holes', () => {
    fc.assert(
      fc.property(treeArb, (component) => {
        // Only lay out components that would pass the validator — a plan for an invalid tree
        // is not a meaningful thing to assert about.
        fc.pre(validateComponent(component).every((d) => d.severity !== 'error'))
        const plan = layout(component, { columns: strategy })
        assertNoOverlap(plan)
        assertFullCoverage(plan)
      }),
      { numRuns: 350 },
    )
  })

  it('gives every column a total row span equal to the row count', () => {
    fc.assert(
      fc.property(treeArb, (component) => {
        fc.pre(validateComponent(component).every((d) => d.severity !== 'error'))
        const plan = layout(component, { columns: strategy })
        for (let c = 0; c < plan.columnCount; c++) {
          const total = plan.cells
            .filter((cell) => cell.col <= c && c < cell.col + cell.colSpan)
            .reduce((sum, cell) => sum + cell.rowSpan, 0)
          expect(total).toBe(plan.rows)
        }
      }),
      { numRuns: 250 },
    )
  })

  it("keeps every step's inputs vertically contiguous (I1)", () => {
    fc.assert(
      fc.property(treeArb, (component) => {
        fc.pre(validateComponent(component).every((d) => d.severity !== 'error'))
        const plan = layout(component, { columns: strategy })
        // A step cell is a rectangle by construction; contiguity is the claim that the rows it
        // covers are exactly the rows of its subtree's leaves, with nothing foreign in between.
        for (const cell of plan.cells) {
          if (cell.kind !== 'step') continue
          expect(cell.rowSpan).toBeGreaterThan(0)
          expect(cell.row + cell.rowSpan).toBeLessThanOrEqual(plan.rows)
        }
      }),
      { numRuns: 250 },
    )
  })

  it('emits a valid topological order', () => {
    fc.assert(
      fc.property(treeArb, (component) => {
        fc.pre(validateComponent(component).every((d) => d.severity !== 'error'))
        const plan = layout(component, { columns: strategy })
        const position = new Map(plan.linearization.map((id, i) => [id, i]))
        expect(position.size).toBe(Object.keys(component.steps).length)
        for (const step of Object.values(component.steps)) {
          for (const input of step.inputs) {
            if (input.kind !== 'step') continue
            expect(position.get(input.id)!).toBeLessThan(position.get(step.id)!)
          }
        }
      }),
      { numRuns: 250 },
    )
  })
})

// --- Fidelity ---------------------------------------------------------------------------------

describe('the artichoke reproduces the source table geometry', () => {
  // The live DOM captured in GAMEPLAN §2.1. If the engine can reproduce these spans from a tree
  // it derived independently, it understands the format.
  const artichokes: Component = {
    id: 'artichokes',
    prelude: [{ id: 'p', text: 'Boil water / preheat grill' }],
    ingredients: [
      { id: 'artichoke', item: 'large artichoke' },
      { id: 'olive-oil', item: 'olive oil' },
      { id: 'salt-pepper', item: 'salt and pepper' },
    ],
    root: 'grill-down',
    steps: {
      trim: {
        id: 'trim',
        inputs: [{ kind: 'ingredient', id: 'artichoke' }],
        text: 'trim',
        effort: 'minutes',
      },
      steam: {
        id: 'steam',
        inputs: [{ kind: 'step', id: 'trim' }],
        text: 'steam 15 min.',
        effort: 'long-unattended',
      },
      cut: {
        id: 'cut',
        inputs: [{ kind: 'step', id: 'steam' }],
        text: 'cut from tip to base',
        effort: 'quick',
      },
      brush: {
        id: 'brush',
        inputs: [
          { kind: 'step', id: 'cut' },
          { kind: 'ingredient', id: 'olive-oil' },
        ],
        text: 'brush',
        effort: 'quick',
      },
      season: {
        id: 'season',
        inputs: [
          { kind: 'step', id: 'brush' },
          { kind: 'ingredient', id: 'salt-pepper' },
        ],
        text: 'season',
        effort: 'quick',
      },
      'grill-up': {
        id: 'grill-up',
        inputs: [{ kind: 'step', id: 'season' }],
        text: 'grill 10 min.',
        effort: 'minutes',
      },
      'grill-down': {
        id: 'grill-down',
        inputs: [{ kind: 'step', id: 'grill-up' }],
        text: 'grill 5 min.',
        effort: 'minutes',
      },
    },
  }

  const plan = layout(artichokes)
  const cell = (ref: string) => plan.cells.find((c) => c.ref === ref)!

  it('is 8 columns wide, as the source table is', () => {
    expect(plan.columnCount).toBe(8)
    expect(plan.preludes[0]?.colSpan).toBe(8)
  })

  it.each([
    ['trim', 1, 1],
    ['steam', 1, 1],
    ['cut', 1, 1],
    ['brush', 2, 1],
    ['season', 3, 1],
    ['grill-up', 3, 1],
    ['grill-down', 3, 1],
  ])('%s spans %i rows and %i columns', (ref, rowSpan, colSpan) => {
    expect(cell(ref).rowSpan).toBe(rowSpan)
    expect(cell(ref).colSpan).toBe(colSpan)
  })

  // The source emits <td colspan="3" class="righthide"> on the olive oil row and colspan="4"
  // on the salt and pepper row. Those exact numbers fall out of the plan.
  it("emits the source's filler spans, and gives them no borders", () => {
    const filler = plan.cells.filter((c) => c.kind === 'filler')
    expect(filler.map((f) => `row ${f.row} colspan ${f.colSpan}`)).toEqual([
      'row 1 colspan 3',
      'row 2 colspan 4',
    ])
    for (const f of filler) {
      expect(f.edges).toEqual({ top: 'none', right: 'none', bottom: 'none', left: 'none' })
    }
  })

  it('marks both filler runs for a leader rule (the Q1 repair)', () => {
    expect(plan.cells.filter((c) => c.kind === 'filler').every((f) => f.leader)).toBe(true)
  })
})

// --- Strategies -------------------------------------------------------------------------------

describe('column strategies', () => {
  const branchy: Component = {
    id: 'branchy',
    prelude: [],
    ingredients: [
      { id: 'a', item: 'a' },
      { id: 'b', item: 'b' },
      { id: 'late', item: 'late addition' },
    ],
    root: 'root',
    steps: {
      one: { id: 'one', inputs: [{ kind: 'ingredient', id: 'a' }], text: 'one', effort: 'quick' },
      two: {
        id: 'two',
        inputs: [
          { kind: 'step', id: 'one' },
          { kind: 'ingredient', id: 'b' },
        ],
        text: 'two',
        effort: 'quick',
      },
      three: { id: 'three', inputs: [{ kind: 'step', id: 'two' }], text: 'three', effort: 'quick' },
      shallow: {
        id: 'shallow',
        inputs: [{ kind: 'ingredient', id: 'late' }],
        text: 'shallow',
        effort: 'quick',
      },
      root: {
        id: 'root',
        inputs: [
          { kind: 'step', id: 'three' },
          { kind: 'step', id: 'shallow' },
        ],
        text: 'root',
        effort: 'quick',
      },
    },
  }

  const colOf = (s: ColumnStrategy, ref: string) =>
    layout(branchy, { columns: s }).cells.find((c) => c.ref === ref)!

  it('right-packed hugs the parent, so column means distance from done', () => {
    const plan = layout(branchy, { columns: 'right-packed' })
    const root = plan.cells.find((c) => c.ref === 'root')!
    const shallow = plan.cells.find((c) => c.ref === 'shallow')!
    expect(shallow.col).toBe(root.col - 1)
    expect(shallow.depth).toBe(1)
  })

  it('left-packed puts the short branch beside its ingredient', () => {
    expect(colOf('left-packed', 'shallow').col).toBe(1)
  })

  it('stretch-to-merge absorbs the gap into the cell instead of filler', () => {
    const cell = colOf('stretch-to-merge', 'shallow')
    expect(cell.col).toBe(1)
    expect(cell.colSpan).toBeGreaterThan(1)
  })

  // The Q1 study reported zero filler under stretch-to-merge. That was a simplification in the
  // study, not a property of the strategy: only *step* cells stretch, so a bare ingredient that
  // joins the chain late still leaves a gap no cell can absorb. Stretch reduces filler; it does
  // not eliminate it.
  it('stretch-to-merge reduces filler but cannot remove it entirely', () => {
    const fillerCount = (s: ColumnStrategy) =>
      layout(branchy, { columns: s }).cells.filter((c) => c.kind === 'filler').length
    expect(fillerCount('stretch-to-merge')).toBeLessThan(fillerCount('right-packed'))
    expect(fillerCount('stretch-to-merge')).toBeGreaterThan(0)
  })

  it('produces the same total width under all three', () => {
    const widths = STRATEGIES.map((s) => layout(branchy, { columns: s }).columnCount)
    expect(new Set(widths).size).toBe(1)
  })
})

describe('leaf reuse', () => {
  // "reserve half the butter": consumed by `cream` early and by `topping` late.
  const crumble: Component = {
    id: 'crumble',
    prelude: [],
    ingredients: [
      { id: 'butter', item: 'butter' },
      { id: 'sugar', item: 'sugar' },
      { id: 'oats', item: 'oats' },
    ],
    reuse: [{ leaf: 'butter', note: 'half now, half for the topping' }],
    root: 'topping',
    steps: {
      cream: {
        id: 'cream',
        inputs: [
          { kind: 'ingredient', id: 'butter' },
          { kind: 'ingredient', id: 'sugar' },
        ],
        text: 'cream',
        effort: 'minutes',
      },
      topping: {
        id: 'topping',
        inputs: [
          { kind: 'step', id: 'cream' },
          { kind: 'ingredient', id: 'oats' },
          { kind: 'ingredient', id: 'butter' },
        ],
        text: 'rub in the reserved butter',
        effort: 'minutes',
      },
    },
  }

  it.each(['chip', 'connector'] as const)('%s keeps one row for one quantity', (reuse) => {
    const plan = layout(crumble, { reuse })
    expect(plan.rows).toBe(3)
    expect(plan.rowOrder.filter((id) => id === 'butter')).toHaveLength(1)
    expect(plan.connections).toHaveLength(1)
    expect(plan.connections[0]).toMatchObject({ kind: reuse, leaf: 'butter', to: 'topping' })
    expect(plan.connections[0]?.note).toContain('half now')
    expect(plan.cells.some((c) => c.duplicate)).toBe(false)
  })

  it('duplicate-leaf adds a row and flags it, rather than colliding with the first', () => {
    const plan = layout(crumble, { reuse: 'duplicate-leaf' })
    expect(plan.rows).toBe(4)
    expect(plan.rowOrder.filter((id) => id === 'butter')).toHaveLength(2)
    expect(plan.connections).toHaveLength(0)

    // The bug this pins: resolving a leaf to a single row made `cream` span the *last* butter
    // row instead of the first, dragging its band down and orphaning row 0.
    const cream = plan.cells.find((c) => c.ref === 'cream')!
    expect({ row: cream.row, rowSpan: cream.rowSpan }).toEqual({ row: 0, rowSpan: 2 })

    const duplicates = plan.cells.filter((c) => c.duplicate)
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0]).toMatchObject({ ref: 'butter', row: 3 })
  })

  it.each(['chip', 'connector', 'duplicate-leaf'] as const)(
    '%s still covers the grid exactly',
    (reuse) => {
      const plan = layout(crumble, { reuse })
      assertNoOverlap(plan)
      assertFullCoverage(plan)
    },
  )
})

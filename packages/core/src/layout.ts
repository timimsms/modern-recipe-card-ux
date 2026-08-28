/**
 * The layout engine: `Component → GridPlan`.
 *
 * Pure. No DOM, no CSS, no pixels, no framework. This is the control variable for the whole
 * bake-off — every experiment track renders the *identical* plan, so differences in the output
 * are attributable to the rendering approach rather than to someone's better layout math.
 *
 * Two findings shaped what is here:
 *
 *  - **Q1** — columns are right-packed by default, unconditionally, because that is the only
 *    assignment where a column *means* something (steps remaining until done). Its one cost is a
 *    long blank run between an ingredient and its own step, and the repair is a leader rule, which
 *    is a rendering decision — so the plan marks which filler runs want one and stops there.
 *  - **I4** — node reuse is not a layout problem. When the shared thing is a preparation with its
 *    own method it becomes a component, resolved before layout ever runs. Only *leaf* reuse reaches
 *    this file, and it defaults to a reference chip: one row, one quantity.
 */

import { cookSchedule } from './cook.js'
import {
  childSteps,
  stepMinutes,
  isPassive,
  isUnattended,
  stepsOf,
  subtreeSteps,
  type Component,
  type ComponentId,
  type IngredientId,
  type PreludeId,
  type Step,
  type StepId,
} from './model.js'

// --- The plan ------------------------------------------------------------------------------

export type ColumnStrategy = 'right-packed' | 'left-packed' | 'stretch-to-merge'

/**
 * How a leaf consumed by more than one step is presented. `chip` is the default: it is the only
 * option that keeps one row for one quantity, which is what stops a cook reading the chart as
 * needing double the ingredient. `duplicate-leaf` is a genuine kitchen hazard and is never
 * selected automatically — see findings/I4-reuse.md.
 */
export type ReuseStrategy = 'chip' | 'connector' | 'duplicate-leaf'

export type LayoutOptions = {
  columns?: ColumnStrategy
  reuse?: ReuseStrategy
}

const DEFAULTS = { columns: 'right-packed', reuse: 'chip' } satisfies Required<LayoutOptions>

/** Border weight. Derived from structure — no renderer decides a border on its own (R1). */
export type Edge = 'none' | 'hairline' | 'rule' | 'heavy'

export type Edges = { top: Edge; right: Edge; bottom: Edge; left: Edge }

/** Where step text sits in its region. `bottom-right` implements jenelope1st's fix (R2). */
export type Anchor = 'center' | 'bottom-right' | 'top-left'

/**
 * Where one thing sits on the grid. Split by `kind` so `ref` is present exactly when it means
 * something.
 *
 * It used to be one shape with an optional `ref`, which every JavaScript track quietly relied on
 * and TypeScript would not accept: track 02 could not index `component.steps[cell.ref]` without a
 * cast, because a filler cell genuinely has no ref. Making it a discriminated union states what
 * was already true — filler has no reference, ingredient and step always do — and is the first
 * core change Phase 07 asked for. Requested by track 02; every track gets it.
 */
type Placed = {
  /** 0-based. Column 0 is always the ingredient column. */
  col: number
  row: number
  colSpan: number
  rowSpan: number
  /**
   * Distance from the **root**, not from the leaves, so a shading ramp reads as "how close to
   * done" rather than "how far from raw". Filler carries the depth of the cell it precedes.
   */
  depth: number
  edges: Edges
  anchor?: Anchor
}

export type PlacedCell =
  | (Placed & {
      kind: 'ingredient'
      ref: IngredientId
      /**
       * Only under `duplicate-leaf`: this row repeats a leaf already shown above. The renderer
       * **must** tie such rows together and make the division explicit — two rows that merely
       * look alike are a lie about the shopping list.
       */
      duplicate?: boolean
    })
  | (Placed & { kind: 'step'; ref: StepId })
  | (Placed & {
      kind: 'filler'
      ref?: undefined
      /**
       * True when the run is wide enough that the eye needs something to follow across it — the
       * Q1 repair. The plan says *where*; the renderer decides what a leader looks like.
       */
      leader?: boolean
    })

export type PlacedPrelude = {
  ref: PreludeId
  /** 0-based position within the prelude band, above the grid proper. */
  order: number
  colSpan: number
}

/**
 * A rectangular region covering a step's entire subtree — the direct fix for R4/R5. `index` is
 * stable across strategies so a shading ramp does not reshuffle when the column option changes.
 */
export type PlacedGroup = {
  ref: StepId
  index: number
  row: number
  col: number
  rowSpan: number
  colSpan: number
  depth: number
  /** True when this step binds two or more inputs — the case R4 asks to be made visible. */
  merge: boolean
}

/**
 * A dependency the grid cannot draw as adjacency. Raster and DOM tracks render `chip` as an
 * inline token; the SVG track may render `connector` as a real edge.
 */
export type Connection = {
  kind: ReuseStrategy
  leaf: IngredientId
  /** The step that consumes it without owning its row. */
  to: StepId
  fromRow: number
  toRow: number
  toCol: number
  /** Author's note from the component's `reuse` declaration, if any. */
  note?: string
}

export type TimingBasis = 'exact' | 'approx' | 'none'

export type TimingSummary = {
  /**
   * The longest chain, never the sum.
   *
   * **This assumes unlimited hands.** It is the right number for "how long is this recipe" in
   * the abstract and the wrong one for "when will I eat", because it lets two attended steps
   * happen at once. Prefer `singleCook` for anything shown to a person cooking alone.
   */
  criticalPathDuration: number
  /**
   * Start to finish for one cook: waits overlap hands-on work, but two hands-on steps never
   * overlap each other.
   *
   * Measured across the corpus this is *larger* than `criticalPathDuration` on exactly the four
   * components where `parallelSaving` is non-zero, by exactly the saving — so on this corpus
   * every minute the format claims to save requires a second person. See
   * findings/P02-parallel-saving.md.
   */
  singleCook: number
  /** Minutes the lone cook spends waiting with nothing else to do. */
  idle: number
  /** Σ all step durations — what a numbered list would cost. */
  serialTotal: number
  parallelSaving: number
  handsOn: number
  longestWalkAway: number
  /** Elapsed time in `passive` steps, excluded from bar scaling entirely (EDGE-CASES E2). */
  passiveTotal: number
  /** False if any step lacks authored duration data. */
  complete: boolean
  /**
   * `exact` — every step has an authored duration. `approx` — derived from Effort buckets, so the
   * figures are ordinal, not measured. `none` — no data; render counts only and no times.
   * Omit rather than estimate silently: a fabricated number in a summary bar will be trusted.
   */
  basis: TimingBasis
}

export type GridPlan = {
  component: ComponentId
  columns: ColumnStrategy
  reuse: ReuseStrategy
  /** Total grid width including the ingredient column. */
  columnCount: number
  /** Equals the number of rows in the ingredient column after any reuse expansion. */
  rows: number
  /**
   * Distance from the root to the furthest step. A renderer needs this to scale a depth-based
   * encoding to the chart it is actually drawing: an absolute ramp collapses on a long chain,
   * where more than half the cells end up in whichever bucket the scale bottoms out in.
   */
  maxDepth: number
  cells: PlacedCell[]
  preludes: PlacedPrelude[]
  groups: PlacedGroup[]
  /** A valid topological execution order — consumed by Phase 06's linearization. */
  linearization: StepId[]
  /** The longest dependency chain — consumed by Phase 04's cook mode. */
  criticalPath: StepId[]
  timing: TimingSummary
  connections: Connection[]
  /** The ingredient column, top to bottom, after reuse expansion. */
  rowOrder: IngredientId[]
}

// --- Analysis ------------------------------------------------------------------------------

type Analysis = {
  /**
   * The *rows* each step owns, not the leaf ids.
   *
   * Under `duplicate-leaf` one leaf legitimately occupies several rows, so a leaf→row map is
   * ambiguous — it silently resolves to whichever row was written last, which places every cell
   * that consumes the leaf against the wrong band. Rows are the identity here; leaves are not.
   */
  ownedRows: Map<StepId, number[]>
  parent: Map<StepId, StepId>
  depth: Map<StepId, number>
  height: Map<StepId, number>
  maxDepth: number
  /** Rightmost column index. Column 0 is the ingredient column, so this is the chart's depth. */
  maxColumn: number
  /** Row index → leaf id. Repeats under `duplicate-leaf`. */
  order: IngredientId[]
  /** First row each leaf appears on, for anchoring connections. */
  firstRowOf: Map<IngredientId, number>
  /** Rows that repeat a leaf already shown above — the rows a renderer must tie together. */
  duplicateRows: Set<number>
  connections: Connection[]
}

/**
 * Which step owns a shared leaf's row. The deepest consumer wins — it is the one that happens
 * first, so the row sits where the cook first reaches for it. Ties break on tree order.
 */
function resolveOwners(
  component: Component,
  depth: Map<StepId, number>,
): Map<IngredientId, StepId> {
  const consumers = new Map<IngredientId, StepId[]>()
  for (const step of stepsOf(component)) {
    for (const input of step.inputs) {
      if (input.kind !== 'ingredient') continue
      const list = consumers.get(input.id) ?? []
      list.push(step.id)
      consumers.set(input.id, list)
    }
  }

  const owners = new Map<IngredientId, StepId>()
  for (const [leaf, steps] of consumers) {
    let best = steps[0] as StepId
    for (const id of steps) {
      if ((depth.get(id) ?? 0) > (depth.get(best) ?? 0)) best = id
    }
    owners.set(leaf, best)
  }
  return owners
}

function analyse(component: Component, options: Required<LayoutOptions>): Analysis {
  const depth = new Map<StepId, number>()
  const parent = new Map<StepId, StepId>()

  const walkDown = (id: StepId, d: number): void => {
    if (depth.has(id)) return
    depth.set(id, d)
    const step = component.steps[id]
    if (!step) return
    for (const child of childSteps(component, step)) {
      parent.set(child.id, id)
      walkDown(child.id, d + 1)
    }
  }
  walkDown(component.root, 0)

  const owners = resolveOwners(component, depth)
  const duplicating = options.reuse === 'duplicate-leaf'

  // Leaves each step owns, in the step's own input order.
  const owned = new Map<StepId, IngredientId[]>()
  const connections: Connection[] = []
  for (const step of stepsOf(component)) {
    if (!depth.has(step.id)) continue
    const mine: IngredientId[] = []
    for (const input of step.inputs) {
      if (input.kind !== 'ingredient') continue
      if (duplicating || owners.get(input.id) === step.id) mine.push(input.id)
      else
        connections.push({
          kind: options.reuse,
          leaf: input.id,
          to: step.id,
          fromRow: -1,
          toRow: -1,
          toCol: -1,
        })
    }
    owned.set(step.id, mine)
  }

  // Height above the deepest leaf, for the left-packed and stretch strategies.
  const height = new Map<StepId, number>()
  const walkUp = (id: StepId): number => {
    const cached = height.get(id)
    if (cached !== undefined) return cached
    const step = component.steps[id]
    let h = 0
    if (step) for (const child of childSteps(component, step)) h = Math.max(h, walkUp(child.id) + 1)
    height.set(id, h)
    return h
  }
  walkUp(component.root)

  // The ingredient column: a depth-first walk of owned leaves. This is the canonical order and
  // the one the validator's E4 suggestion is built from. Rows are allocated as they are visited,
  // so each occurrence of a duplicated leaf gets its own identity.
  const order: IngredientId[] = []
  const ownedRows = new Map<StepId, number[]>()
  const firstRowOf = new Map<IngredientId, number>()
  const duplicateRows = new Set<number>()
  const seen = new Set<StepId>()

  const collect = (id: StepId): void => {
    if (seen.has(id)) return
    seen.add(id)
    const step = component.steps[id]
    if (!step) return
    const mine = new Set(owned.get(id) ?? [])
    const rows: number[] = []
    for (const input of step.inputs) {
      if (input.kind === 'step') {
        collect(input.id)
        continue
      }
      if (!mine.has(input.id)) continue
      const row = order.length
      order.push(input.id)
      rows.push(row)
      if (firstRowOf.has(input.id)) duplicateRows.add(row)
      else firstRowOf.set(input.id, row)
    }
    ownedRows.set(id, rows)
  }
  collect(component.root)

  for (const c of connections) {
    c.fromRow = firstRowOf.get(c.leaf) ?? -1
    const note = (component.reuse ?? []).find((r) => r.leaf === c.leaf)?.note
    if (note) c.note = note
  }

  return {
    ownedRows,
    parent,
    depth,
    height,
    maxDepth: Math.max(0, ...[...depth.values()]),
    maxColumn: Math.max(0, ...[...height.values()]) + 1,
    order,
    firstRowOf,
    duplicateRows,
    connections,
  }
}

/** The contiguous row band a step covers: every row owned anywhere in its subtree. */
function bandOf(component: Component, a: Analysis, id: StepId): { top: number; bottom: number } {
  const rows: number[] = []
  for (const stepId of subtreeSteps(component, id)) rows.push(...(a.ownedRows.get(stepId) ?? []))
  if (rows.length === 0) return { top: 0, bottom: 0 }
  return { top: Math.min(...rows), bottom: Math.max(...rows) }
}

// --- Column assignment ---------------------------------------------------------------------

type Span = { start: number; end: number }

function columnsFor(strategy: ColumnStrategy, a: Analysis, id: StepId): Span {
  // `maxColumn` is the rightmost column; the root always sits there.
  switch (strategy) {
    case 'right-packed': {
      // The default. `column = distance from done`, identically in every branch.
      const c = a.maxColumn - (a.depth.get(id) ?? 0)
      return { start: c, end: c }
    }
    case 'left-packed': {
      const c = (a.height.get(id) ?? 0) + 1
      return { start: c, end: c }
    }
    case 'stretch-to-merge': {
      const start = (a.height.get(id) ?? 0) + 1
      const p = a.parent.get(id)
      return { start, end: p === undefined ? a.maxColumn : (a.height.get(p) ?? 0) }
    }
  }
}

// --- Edges ------------------------------------------------------------------------------------

/**
 * Every border is derived from whether the cell actually bounds something on that side.
 *
 * The stray-vertical-line complaint (R1) exists because CFE's `righthide` class is a blunt
 * instrument applied by hand. Here filler has no borders at all, because filler is absence — and
 * on a CSS Grid substrate absence is expressible, which an HTML table cannot manage.
 */
function edgesForStep(step: Step, isRoot: boolean): Edges {
  if (isRoot) return { top: 'heavy', right: 'heavy', bottom: 'heavy', left: 'heavy' }
  // A merge binds two or more inputs into one region. Making that boundary heavier is exactly
  // jenelope1st's "added heavier lines to group the ingredients and their related instructions".
  const merge = step.inputs.length > 1
  return {
    top: merge ? 'heavy' : 'rule',
    right: 'rule',
    bottom: merge ? 'heavy' : 'rule',
    left: 'rule',
  }
}

const INGREDIENT_EDGES: Edges = {
  top: 'hairline',
  right: 'hairline',
  bottom: 'hairline',
  left: 'hairline',
}
const NO_EDGES: Edges = { top: 'none', right: 'none', bottom: 'none', left: 'none' }

// --- Timing -------------------------------------------------------------------------------------

function timingFor(component: Component, criticalPath: StepId[]): TimingSummary {
  const steps = stepsOf(component)
  const authored = steps.filter((s) => s.duration).length
  const basis: TimingBasis =
    steps.length === 0 ? 'none' : authored === steps.length ? 'exact' : 'approx'

  let serialTotal = 0
  let handsOn = 0
  let longestWalkAway = 0
  let passiveTotal = 0

  for (const step of steps) {
    const minutes = stepMinutes(step)
    serialTotal += minutes
    if (isPassive(step.effort)) passiveTotal += minutes
    if (!isUnattended(step.effort)) handsOn += minutes
    else longestWalkAway = Math.max(longestWalkAway, minutes)
  }

  const criticalPathDuration = criticalPath.reduce((sum, id) => {
    const step = component.steps[id]
    return sum + (step ? stepMinutes(step) : 0)
  }, 0)

  const schedule = cookSchedule(component)

  return {
    criticalPathDuration,
    singleCook: schedule.totalMinutes,
    idle: schedule.idleMinutes,
    serialTotal,
    parallelSaving: serialTotal - criticalPathDuration,
    handsOn,
    longestWalkAway,
    passiveTotal,
    complete: basis === 'exact',
    basis,
  }
}

/** The longest chain by elapsed time — not the sum, which is the standard error on recipe sites. */
function criticalPathOf(component: Component): StepId[] {
  const best = new Map<StepId, { total: number; path: StepId[] }>()

  const walk = (id: StepId): { total: number; path: StepId[] } => {
    const cached = best.get(id)
    if (cached) return cached
    const step = component.steps[id]
    if (!step) return { total: 0, path: [] }
    let deepest = { total: 0, path: [] as StepId[] }
    for (const child of childSteps(component, step)) {
      const r = walk(child.id)
      if (r.total > deepest.total) deepest = r
    }
    const result = { total: deepest.total + stepMinutes(step), path: [...deepest.path, id] }
    best.set(id, result)
    return result
  }

  return walk(component.root).path
}

/** Depth-first post-order: children before parents, so it is a valid execution order. */
function linearize(component: Component): StepId[] {
  const out: StepId[] = []
  const seen = new Set<StepId>()
  const walk = (id: StepId): void => {
    if (seen.has(id)) return
    seen.add(id)
    const step = component.steps[id]
    if (!step) return
    for (const child of childSteps(component, step)) walk(child.id)
    out.push(id)
  }
  walk(component.root)
  return out
}

// --- The engine ---------------------------------------------------------------------------------

/**
 * Turns a validated component into an abstract placement plan.
 *
 * The component must already validate clean — `layout` assumes references resolve, the tree is
 * acyclic, and the ingredient order satisfies contiguity. It does not re-check any of that.
 */
export function layout(component: Component, options: LayoutOptions = {}): GridPlan {
  const opts = { ...DEFAULTS, ...options }
  const a = analyse(component, opts)
  const maxColumn = a.maxColumn
  const rows = a.order.length
  const cells: PlacedCell[] = []
  const groups: PlacedGroup[] = []
  const occupied: Array<Set<number>> = Array.from({ length: rows }, () => new Set())

  a.order.forEach((leaf, row) => {
    cells.push({
      kind: 'ingredient',
      ref: leaf,
      col: 0,
      row,
      colSpan: 1,
      rowSpan: 1,
      depth: a.maxDepth + 1,
      edges: INGREDIENT_EDGES,
      ...(a.duplicateRows.has(row) ? { duplicate: true } : {}),
    })
  })

  const ordered = linearize(component)
  ordered.forEach((id, index) => {
    const step = component.steps[id]
    if (!step) return
    const { top, bottom } = bandOf(component, a, id)
    const span = columnsFor(opts.columns, a, id)
    const depth = a.depth.get(id) ?? 0

    cells.push({
      kind: 'step',
      ref: id,
      col: span.start,
      row: top,
      colSpan: span.end - span.start + 1,
      rowSpan: bottom - top + 1,
      depth,
      edges: edgesForStep(step, id === component.root),
      anchor: 'bottom-right',
    })

    groups.push({
      ref: id,
      index,
      row: top,
      col: 0,
      rowSpan: bottom - top + 1,
      colSpan: span.end + 1,
      depth,
      merge: step.inputs.length > 1,
    })

    for (let r = top; r <= bottom; r++) {
      for (let c = span.start; c <= span.end; c++) occupied[r]?.add(c)
    }
  })

  // Filler: every maximal run of unoccupied columns. It draws nothing — that is the R1 fix — but
  // runs of two or more are marked so the renderer can lead the eye across them (Q1).
  for (let r = 0; r < rows; r++) {
    let c = 1
    while (c <= maxColumn) {
      if (occupied[r]?.has(c)) {
        c++
        continue
      }
      let end = c
      while (end + 1 <= maxColumn && !occupied[r]?.has(end + 1)) end++
      cells.push({
        kind: 'filler',
        col: c,
        row: r,
        colSpan: end - c + 1,
        rowSpan: 1,
        depth: a.maxDepth + 1,
        edges: NO_EDGES,
        leader: end - c + 1 >= 2,
      })
      c = end + 1
    }
  }

  // Connections know their target's placement only once the steps are placed.
  const stepCells = new Map(cells.filter((c) => c.kind === 'step').map((c) => [c.ref as StepId, c]))
  for (const connection of a.connections) {
    const cell = stepCells.get(connection.to)
    connection.toRow = cell ? cell.row : -1
    connection.toCol = cell ? cell.col : -1
  }

  const criticalPath = criticalPathOf(component)

  return {
    component: component.id,
    columns: opts.columns,
    reuse: opts.reuse,
    columnCount: maxColumn + 1,
    rows,
    maxDepth: a.maxDepth,
    cells: cells.sort((x, y) => x.row - y.row || x.col - y.col),
    preludes: component.prelude.map((p, order) => ({
      ref: p.id,
      order,
      colSpan: maxColumn + 1,
    })),
    groups,
    linearization: ordered,
    criticalPath,
    timing: timingFor(component, criticalPath),
    connections: a.connections,
    rowOrder: a.order,
  }
}

/**
 * Reconstructs the `rowspan`/`colspan` geometry an HTML table would need for this plan.
 *
 * Used by the fidelity test: if the engine can reproduce the original CFE markup's span values
 * from a tree it derived independently, it understands the format. Also the basis for any track
 * that chooses a table substrate (Q3).
 */
export function toTableSpans(
  plan: GridPlan,
): Array<Array<{ ref?: string; kind: string; rowSpan: number; colSpan: number }>> {
  const rows: Array<Array<{ ref?: string; kind: string; rowSpan: number; colSpan: number }>> =
    Array.from({ length: plan.rows }, () => [])
  // A table emits a cell only on the row where it starts; every row it spans below is implied
  // by the rowspan. That is exactly the convention the CFE source uses.
  for (const cell of [...plan.cells].sort((x, y) => x.row - y.row || x.col - y.col)) {
    rows[cell.row]?.push({
      ...(cell.ref === undefined ? {} : { ref: cell.ref }),
      kind: cell.kind,
      rowSpan: cell.rowSpan,
      colSpan: cell.colSpan,
    })
  }
  return rows
}

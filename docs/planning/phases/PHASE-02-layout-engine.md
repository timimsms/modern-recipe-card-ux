# Phase 02 — Layout Engine

> `AssemblyTree → GridPlan`. Pure, framework-free, exhaustively tested. The keystone.

## Goal

One function that turns a validated `Component` into an abstract placement plan, with no
knowledge of DOM, CSS, pixels, or any rendering technology. Every experiment track consumes
its output unmodified.

## Why here

This is the control variable for the entire bake-off. If track 03 renders differently from
track 01 because it computed its own spans, Phase 08 measures nothing. It also has to be
*right* before any visual work starts — debugging a rendering bug that's actually a layout-math
bug is the most expensive mistake available in this project.

## Deliverables

### The plan format (`packages/core/src/layout.ts`)

```ts
type GridPlan = {
  columns: number             // total grid width including the ingredient column
  rows: number                // = ingredients.length
  cells: PlacedCell[]
  preludes: PlacedPrelude[]   // full-width bands
  groups: PlacedGroup[]       // subtree regions for R4/R5 shading and R1 border bounding
  linearization: StepId[]     // valid topological execution order — consumed by Phase 06
  criticalPath: StepId[]      // longest dependency chain — consumed by Phase 04
  timing: TimingSummary       // derived, never authored — feeds Phase 03's at-a-glance bar
}

type TimingSummary = {
  criticalPathDuration: number  // true wall clock, "start to finish"
  serialTotal: number           // Σ all step durations — what a numbered list would cost
  parallelSaving: number        // serialTotal − criticalPathDuration
  handsOn: number               // Σ where effort !== 'long-unattended'
  longestWalkAway: number       // max where effort === 'long-unattended'
  complete: boolean             // false if any step lacks duration data — suppresses time fields
}

type PlacedCell = {
  kind: 'ingredient' | 'step' | 'filler'
  ref?: IngredientId | StepId
  col: number                 // 0-based; 0 is always the ingredient column
  row: number
  colSpan: number
  rowSpan: number
  depth: number               // distance from root; drives shading ramps
  edges: { top: Edge; right: Edge; bottom: Edge; left: Edge }  // R1 — computed, never guessed
}

type Edge = 'none' | 'hairline' | 'rule' | 'heavy'
```

**The `edges` field is the direct fix for R1.** The stray-vertical-line complaint exists
because CFE's `righthide` class is a blunt instrument applied by hand. Here, every border is
derived from whether the cell actually bounds a subtree on that side. No renderer decides
borders on its own; they all read the plan.

**`groups` is the direct fix for R4/R5** — each is a rectangular region covering a step's
entire subtree, carrying a depth and a stable group index for shading.

### Column assignment strategies

Implement all three from `GAMEPLAN.md` §4.1 behind one option:

```ts
layout(component, { columns: 'left-packed' | 'right-packed' | 'stretch-to-merge' })
```

- **left-packed** — `col = depth from deepest leaf`; empty filler to the right of short chains.
- **right-packed** — `col(child) = col(parent) − 1`; filler to the left. This reproduces the
  artichoke source exactly, including the `colspan="3"` filler before `brush`.
- **stretch-to-merge** — no filler; the step cell's `colSpan` absorbs the gap. Reproduces
  "cut up into small pieces" spanning most of the Shepherd's pie chart.

Validate each against the transcribed sources and record which one each CFE recipe actually
used. **This resolves Q1**, and the answer may well be "right-packed by default, stretch when
a chain has exactly one step" — a heuristic, not a global setting.

### Instruction anchoring (R2)

The plan carries an `anchor` per step cell — `'center' | 'bottom-right' | 'top-left'` — with
`bottom-right` as the default, implementing jenelope1st's fix. Anchoring belongs in the plan
rather than in CSS because the mobile and SVG tracks need the same decision and can't inherit
a `vertical-align`.

### Reuse handling (I4)

`layout()` takes a `reuse: 'split-node' | 'duplicate-leaf' | 'connector'` option.
`connector` emits an additional `connections: Connection[]` array that raster/DOM tracks
may ignore and the SVG track renders as real edges. This is the deliberate seam that lets
track 03 do something the others structurally cannot.

### Testing

- **Golden files.** Each corpus recipe × each column strategy → a committed JSON snapshot.
  Any layout change surfaces as a reviewable diff.
- **Property tests** (fast-check) over generated trees:
  - Every ingredient row is covered by exactly one cell per column, or explicit filler.
  - `Σ rowSpan` over any column equals `rows`.
  - No two cells overlap.
  - Every step's inputs are vertically contiguous (**I1**).
  - `linearization` is a valid topological order of the tree.
- **Fidelity test.** Reconstruct the artichoke table's rowspan/colspan values from `GridPlan`
  and assert they match the live DOM captured in Phase 01. If the engine can reproduce the
  original byte-for-byte in structure, it understands the format.

## Technical notes

**Purity is enforceable, not aspirational.** The Phase 00 boundary lint keeps DOM types out.
Add a test that imports `core` in a Node context with no globals shimmed.

**Depth semantics.** `depth` in `PlacedCell` is distance from the *root*, not from leaves, so
shading ramps read as "how close to done" rather than "how far from raw." That's the more
useful encoding for R5 and it survives strategy changes.

**Critical path and timing.** Cheap to compute here and needed in two places: Phase 04's cook mode
wants to know which chain is the long pole, and Phase 03's at-a-glance bar renders `TimingSummary`
wholesale. Note that `criticalPathDuration` is the *longest chain*, not the sum — getting this
right is the difference between an honest "start to finish" figure and the inflated one every
recipe site publishes. `parallelSaving` is the format's own argument for existing, expressed as a
number; when it approaches zero the recipe is effectively linear, which Phase 04's cook mode can
act on.

**`complete` gates the time fields.** If any step lacks duration data the summary must say so
rather than estimating. Omit rather than estimate silently — a fabricated number in a summary bar
will be trusted.

**Do not optimize yet.** These are ~20-node trees. Clarity beats cleverness; the property
tests matter more than the constant factor.

## Acceptance criteria

- [ ] `layout()` has zero runtime dependencies and no DOM references.
- [ ] Every corpus recipe and stress fixture produces a valid plan under all three strategies.
- [ ] Golden snapshots committed for all combinations.
- [ ] Property tests pass over 1,000 generated trees.
- [ ] The artichoke plan reproduces the source table's exact span geometry.
- [ ] `deep-narrow.json` (depth 12) and `wide-shallow.json` (25 leaves) both layout without special-casing.
- [ ] `reuse-split.json` produces sensible output under all three reuse strategies.
- [ ] A written finding recorded for **Q1** with evidence from the corpus.

## Out of scope

Pixels, text measurement, column *widths*. The plan is topological. How wide a column should
be is a rendering concern and depends on the font — that's Phase 03's problem (**R9**).

## Open questions

- Should the plan carry suggested column *weights* (e.g. proportional to longest step text) as
  a hint, even though it can't know the font? A unitless hint may save every track from
  reinventing the same heuristic. Decide once Phase 03 hits the problem for real.
- Does `stretch-to-merge` interact badly with `bottom-right` anchoring? A stretched cell with
  bottom-right text may float far from its inputs. Test explicitly.

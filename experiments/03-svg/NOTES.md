# Track 03 — SVG dendrogram

> Written during the build. Phase 07 says retrospective notes are fiction, and it is right —
> everything below was written the day it happened, including the parts that make the track look
> worse.

## Where it is

Wall chart and cook mode, over all nine corpus recipes and all six valid stress fixtures. No
check-off, scaling, timers, or export yet.

**Core changes requested so far: none.** The `GridPlan` turned out to carry everything this track
needs for placement — `rowOrder`, per-cell `col` and `depth`, and the inputs on each step. That
was not a given: the plan was designed for a grid, and a dendrogram places nodes by a rule the
grid has no use for.

## What was easy

**The plan did the hard part.** Column assignment, ingredient row order and depth all came
straight from `layout()`. Rendering is `plan → geometry → string`, and the geometry module is
about 120 lines. The phase doc guessed that `d3-hierarchy` would be redundant given core, and on
this evidence it is: there is no tree layout left to do once the plan exists, only arithmetic.

**Drawn edges made the tree obvious.** Placing a node at the vertical centroid of its inputs and
joining them with flattened Béziers reads as a tree immediately, without the reader having to
learn that a tall rectangle means "spans these rows". Whether that is *better* is Phase 08's
question, but it is legible at a glance in a way the grid takes a moment to become.

## What fought back

### SVG has no auto-layout, and that is the whole cost

Track 01 hands CSS Grid a row and column index and the browser works out how tall a row must be
to fit its text. SVG has no such mechanism: every box needs an explicit x, y, width and height
*before* anything is drawn, and a row's height depends on how many lines its ingredient wraps to.

So this track has to measure text itself, wrap it itself, and feed the result back into the
layout. `canvas.measureText` does the measuring — no layout pass, no element in the tree — and the
measurer is injected so the geometry stays deterministic and unit-testable.

That last part is a genuine advantage in the other direction, and worth stating plainly: **track
03 has a layout module that can be unit-tested and track 01 does not.** CSS Grid's layout happens
in the browser and can only be checked in one. Nine geometry tests run in 4ms here; the equivalent
assurance in track 01 is a Playwright screenshot.

### `text-anchor` is a separate instruction from the x coordinate

The first render put every step label *outside* its own rectangle, running off to the right. The
code computed the correct right-hand x and never set `text-anchor="end"` — and an anchor of
`start` at a box's right edge is precisely that instruction, faithfully executed.

HTML has no equivalent mistake available: `text-align: end` moves text within a box that already
exists. This is the shape of most SVG bugs so far — the substrate does exactly what it was told,
having been told something slightly wrong, and there is no containing box to catch it.

Nothing clips by default either, so the failure is silent. There is now a test that walks every
label in every recipe and compares `getBBox()` against its rectangle.

## What is still unknown

- **Accessibility.** The drawing carries `role="img"`, a `<title>`, a `<desc>` and `role="list"`
  over the steps. That is close to all SVG gives for free, and Phase 06's structural narrative is
  going to carry disproportionate weight here, exactly as the phase doc predicted. Not yet
  audited.
- **R8 / mobile.** A fixed-size drawing scrolls rather than reflows. `deep-narrow` renders 2,198px
  wide. Track 01 answers this with the Phase 04 ladder; this track has nothing yet, and "zoom out"
  is not the same answer as "make it readable at 390px".
- **Print.** Untested.

## Cook mode: the mini-map is free here

The other three tracks each build a *second* renderer for the thumbnail — a grid of coloured
blocks, separate code, separate bugs. This track re-runs `layoutDendrogram` and hands the result
to the same `renderDendrogram`, with a `viewBox` doing the scaling and CSS hiding the text. The
map costs a width attribute and one class per node.

That is the one place so far where this substrate *removes* work rather than adding it, and the
phase doc called it: "Canvas variant for the mini-map specifically… likely SVG's clearest win."
It did not need canvas to get there.

Text is hidden rather than skipped, deliberately. Laying out again without it would move the
nodes, and a map whose shape disagreed with the chart it is a map *of* would be worse than no map.

The honest limitation: a dendrogram spreads horizontally, so the thumbnail is wide and short where
the grid tracks' maps are compact. Position is still legible, but it uses more width to say the
same thing.

## The store adapter

One line: `store.subscribe(() => draw())`.

With no framework there is no reactivity to adapt *to*. Worth putting beside the others rather
than treating as a non-result — React, Svelte and Solid each spend four to six lines teaching
their reactivity system about an external store, and the gap is the price of having one at all,
paid on the smallest possible surface.

## The thing it owns

`reuse-split.json` renders with **two real edges from one leaf**, one to `cream` and one arcing
past `beat in the flour` to `topping`. No grid track can draw that: a rectangle would have to span
everything in between, which is why track 01 offers a chip, a connector, or a duplicated row —
three workarounds for a shape the substrate cannot express.

That is I4 answered rather than mitigated, and it is this track's reason for existing.

# Q3 — table vs CSS Grid: provisional, and honest about why

**Status: provisional.** PHASE-06's acceptance criterion is a "substrate decision made from real
screen-reader testing" across VoiceOver/macOS, VoiceOver/iOS, NVDA+Firefox and JAWS+Chrome. **None
of that was run.** No screen reader was used at any point in producing this finding.

What was done: both substrates were built from the same `GridPlan`, and compared on what each puts
into the browser's accessibility tree. That is a real measurement and it is not the same question.
The distinction matters more here than usual, because the failure mode PHASE-06 names — "a chart
that's technically conformant and completely incomprehensible" — lives precisely in the gap
between the two.

## Method

`experiments/01-css-grid/src/table.js` renders the same plan as `<table>` with `rowspan`/`colspan`
and `scope="row"` on each ingredient. `substrate.visual.ts` walks `Accessibility.getFullAXTree`
over the card and counts roles. Identical topology, two substrates, so any difference is the
substrate.

## What the accessibility tree says

**espresso-brownies** (9 ingredients, 5 steps):

| | `<table>` | CSS Grid |
| --- | --- | --- |
| exposed nodes | 37 | 36 |
| **unnamed** nodes | **12** | **21** |
| relational roles | `table` 1, `row` 10, `rowheader` 10, `cell` 5 | none |
| step cells | `cell` × 5 | `button` × 5 |
| structural filler | — | `generic` × 8 |

**shepherds-pie** (20 ingredients, 15 steps): the same shape — table 82 nodes / 24 unnamed with
21 rows and 21 rowheaders; grid 71 nodes / 33 unnamed with 9 `generic` and no relational role at
all.

Three things follow.

**The grid exposes no relationships whatsoever.** Its steps are buttons, its ingredients are
checkboxes, and every structure holding them together — the row bands, the column progression,
the spans that *are* the recipe's tree — is `generic`. Everything R3 and R4 are about is visible
and unexposed.

**`scope="row"` does the thing the chart does by adjacency.** The ingredient becomes the header
of its row, so it is announced when the reader enters any step cell on that row. That is the
single most valuable sentence the format has, and the table gets it from the substrate rather
than from asserted ARIA.

**The table's cost is real and was halved by measuring it.** A table row must account for every
column, so a hole in the chart still needs a `<td>`. Left exposed, that meant **13 announced
cells for 5 real steps**, and 30 for 15 — more than half of what a reader crossed was blank.
Marking fillers `role="presentation"` takes both to exactly the number of real steps while `row`
and `rowheader` counts stay intact. A CSS Grid simply has no element where there is no cell; this
is the grid's one structural advantage, and it is recoverable.

## Provisional verdict: the table

On everything measurable the table wins, and it wins on the axis that matters most — the format's
content *is* the relationships, and only one substrate expresses them. The grid would need a full
ARIA grid pattern (`role="grid"`/`row`/`gridcell`/`rowheader`, `aria-rowindex`, `aria-colindex`)
to compete, which is a hand-built reimplementation of what `<table>` gives natively, and which
PHASE-06 already flags as inconsistently implemented.

## What could overturn this

Three things, in order of likelihood.

1. **`role="presentation"` on a spanning cell.** It removed the blanks from Chrome's tree. Whether
   real assistive tech still reports correct column positions across a presentational span is
   exactly the "inconsistently implemented" risk, and it is unverified. If it breaks column
   reporting, the table's blanks come back and the comparison narrows sharply.
2. **Narration of a sparse spanned table.** Chrome's tree says 5 cells. It does not say what JAWS
   reads out when crossing a 9-row `rowspan`, which is the shape every one of these charts has.
3. **Layout cost.** The table is not yet at parity with the grid's rendering — the responsive
   ladder, the depth ramp and the leader rule are all built against CSS Grid. Swapping substrates
   means re-testing Phase 04's four presentations, which is what PHASE-06 means by budgeting for
   backflow.

## The thing that changed the stakes

Building [the structural narrative](../findings/) first altered what this decision is worth.

PHASE-06 frames the substrate as *the* answer to "can a screen-reader user understand this chart".
But the narrative answers the two questions the phase sets as its criteria — "what feeds this
step?" and "what can I start now?" — directly, in order, in sentences, for every corpus recipe.
`narrate.ts` says "Takes the melted unsalted butter, ½ cup of all-purpose flour…" without any
substrate needing to convey it.

So the chart's job for a non-visual reader is smaller than the phase assumed. That does not make
the substrate irrelevant — a reader exploring the chart should get real structure, and the table
gives it — but it does mean **the decision is no longer load-bearing enough to justify swapping
the reference renderer on unverified evidence**.

## Recommendation

Keep CSS Grid as track 01's substrate for now. Keep `table.js` — it is complete, it renders every
corpus recipe from the same plan, and it is the swap PHASE-03's contained DOM-emitting module was
designed to make cheap. Revisit with real assistive tech before Phase 07 builds tracks 02–04
against a standard this finding cannot yet set.

Recorded this way rather than as a decision because a substrate choice justified by a Chromium
tree dump, presented as though screen readers had been consulted, is the kind of claim that gets
built on and is very hard to walk back.

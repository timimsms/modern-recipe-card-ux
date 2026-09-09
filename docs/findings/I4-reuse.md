# Finding — I4: How should the grid handle an ingredient or step used twice?

**Status:** resolved — design exploration, rendered and measured, not kitchen-tested.
**Rendered study:** [../design/i4-ingredient-reuse.html](../design/i4-ingredient-reuse.html)
**Local source:** [`../design/i4-ingredient-reuse.html`](../design/i4-ingredient-reuse.html)
**Prompt:** [`../planning/prompts/I4-ingredient-reuse-showcase.md`](../planning/prompts/I4-ingredient-reuse-showcase.md)
**Test cases:** a vinaigrette diamond (node reuse) and a divided stick of butter (leaf reuse).

## Answer

**Default to the reference chip.** It is the only strategy that is safe, compact, and renderable in
every track.

But the more useful result is that **the two cases want different answers**, and the thing that
decides which is *not* the shape of the graph.

## The two cases want different answers

Both cases look identical to a graph algorithm: one node, two consumers. They are not the same
problem, because the right answer depends on **what the shared thing is**.

| Case | What is shared | Right answer |
| --- | --- | --- |
| **Node reuse** — vinaigrette split between a marinade and a dressing | A preparation with its own five ingredients and its own method | **Promote it to a component.** Not a reuse mechanism at all — this is I5, which the model already has. |
| **Leaf reuse** — 4 oz butter, 3 oz melted and 1 oz for the skillet | One ingredient, portioned | **Reference chip.** Giving butter its own component table would be absurd. |

Promoting the vinaigrette makes the DAG disappear: both tables become trees again, every span is
contiguous, and the vinaigrette gets a visible method instead of being smuggled into a row label.
`ComponentRefLeaf` was built for cross-component references in Shepherd's pie; it turns out to be
the answer to half of I4 as well, at no additional cost.

**Consequence for Phase 02:** `layout()`'s `reuse` option only ever has to handle *leaf* reuse. Node
reuse is resolved before layout, in the model, by an authoring decision. That is a materially
smaller problem than the phase plan assumed.

## Measured

| Strategy | Node reuse | Leaf reuse | Can a cook read it as double? |
| --- | --- | --- | --- |
| 1 — Split node | 10 rows across 2 tables | 8 rows × 5 cols | No |
| 2 — Duplicate leaf | *cannot express* | 8 rows × 5 cols | **Yes** |
| 3 — Connector | 8 rows × 5 cols | 7 rows × 5 cols | No |
| 4 — Reference chip | 8 rows × 5 cols | 7 rows × 5 cols | No |
| 5 — Subtree duplication | 13 rows × 5 cols | *collapses to strategy 2* | **Yes** |

Two cells in the matrix are not renderable, and both are results rather than gaps:

- **Duplicate-leaf cannot express node reuse.** The reused thing is a step *output*. Duplicating the
  row without its upstream deletes the vinaigrette's recipe from the chart; duplicating it *with* its
  upstream is subtree duplication. There is no distinct strategy in between — duplicate-leaf is
  defined only for leaves.
- **Subtree duplication collapses into duplicate-leaf on leaf reuse**, cell for cell, because a
  leaf's upstream subtree is the leaf itself.

## Safety first, as the prompt asked

**Duplicate-leaf is dangerous and must never be the default.** Two rows that both read
`4 oz (115 g) butter` is a shopping-list error whose failure mode is silent — you find out when the
batter is wrong. Every available mitigation was applied in the rendering (a vertical bracket reading
"one 4 oz stick, divided", half-disc glyphs `◐`/`◑`, a heavier tied border, and an explicit portion
on each row) and it is *still* the strategy most likely to be misread, because all of those are
secondary marks on a primary signal that says "two rows, two quantities."

It survives the greyscale check — nothing depends on colour alone — and it is still the wrong
default. Keep it implemented for renderers with no better option, behind an explicit opt-in.

Subtree duplication carries the same hazard multiplied by five, and prints a 63% taller chart
(13 rows against 8). It should ship to nobody. It belongs in the Phase 08 harness as the baseline
number the other four are measured against.

## The connector does not justify the SVG track

This matters because the SVG experiment was largely justified by this case — GAMEPLAN §4.1 calls the
non-planar edge "a key differentiator for that experiment."

Rendered, the connector is the most *truthful* strategy: one row, one quantity, and the second
dependency drawn as a real edge rather than described. Toggling connectors off in the artifact shows
how much the line is carrying.

But it crosses unrelated cells to arrive, and in the cornbread it has to **bow around `stir in`** to
be visible at all — a rendering trick, not structure. Crossings multiply exactly as recipes get more
complex, which is the situation where the edge is most needed. At 390px it is unusable in a way the
others are merely cramped.

**Recommendation:** keep `connector` as an option only the SVG track implements, but **find that
track a better justification before Phase 07.** Arbitrary-scale print output and a true dendrogram
view are both stronger candidates. If non-planar edges are its only differentiator, the track is not
earning its place in the bake-off.

## What rendering changed — split-node's hidden cost

Split-node looks like the principled answer on paper: model the division as an explicit step, keep
the tree honest, add one cell. Drawing it exposed a cost that reasoning did not.

The two output lanes have to satisfy contiguity themselves, and **that forces their order.** In the
cornbread, the skillet-greasing lane must be listed *first*, above the batter lane — even though
greasing happens last — because any other order splits the batter's rows in two.

So split-node buys tree-purity by letting the layout dictate the reading order of the ingredient
column. That is the same class of error as the original format's: geometry driving meaning instead
of the other way round. It is still the right call for node reuse, where the "lanes" are a whole
component and the ordering question does not arise.

## The honest cost of the recommendation

The reference chip makes the dependency **textual rather than spatial**. The entire argument for this
format is that structure is spatial, and at exactly the point where the structure gets interesting,
the chip stops drawing it and writes it down instead.

That is a real loss and it should be recorded as one. It is accepted because the alternatives are
worse: the spatial answer (connector) does not survive contact with a phone, and the duplicating
answers are unsafe in a kitchen.

Mitigation already prototyped: the chip is a focusable control, and hovering or focusing it lights up
the row it points at. That recovers some of the spatial link on pointer and keyboard, though not in
print — which is where the wall-chart lives, and remains open.

## Consequences

- **Phase 02.** `reuse: 'duplicate-leaf' | 'connector' | 'chip'` — with `chip` as the default and
  node reuse out of scope entirely, resolved upstream as a component. `connectors: Connection[]` is
  still emitted for the SVG track.
- **Phase 01.** The `reuse` declaration on `Component` remains required for undeclared multi-consumed
  leaves (validator E5). `fixtures/valid/reuse-split.json` should gain a sibling that exercises node
  reuse via a component, to prove the promotion path.
- **Phase 07.** The SVG track needs a new primary justification. Raise this before building it.
- **Phase 03.** The chip needs a print fallback, since hover cannot exist on paper.

## Open

- Not tested with anyone cooking. The claim that duplicate-leaf is *dangerous* is a design judgement
  about a real hazard, but the size of the hazard is unmeasured — this is the highest-value question
  in the whole project to put in front of a real cook, and it belongs in Phase 08.
- The chip's print fallback is unsolved. A footnote marker with a key below the chart is the obvious
  candidate and has not been drawn.
- Both test cases have exactly one reuse edge. A recipe with three or four is where the chip's
  "read it and then go find the row" cost compounds, and none of the five was tested at that density.

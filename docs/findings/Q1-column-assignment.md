# Finding — Q1: Which column-assignment strategy should the layout engine default to?

**Status:** resolved — design exploration, rendered and measured, not user-tested.
**Artifact:** https://claude.ai/code/artifact/cfba9c97-ffb0-47f0-aeee-84ccd512d123
**Local source:** [`../design/q1-column-assignment.html`](../design/q1-column-assignment.html)
**Prompt:** [`../planning/prompts/Q1-column-assignment-showcase.md`](../planning/prompts/Q1-column-assignment-showcase.md)
**Test cases:** shepherd's pie (15 leaves, 12 steps, depth 10) and grilled artichokes (3 leaves, pure chain).

## Answer

**Right-packed, unconditionally.** No hybrid, no per-branch heuristic.

The cost that decision incurs — a long blank run between an ingredient and its own step — is
repaired in the *renderer* with a hairline leader rule across the gap, not in `GridPlan`.

## Why — the structural argument

Only one of the three makes column position mean something:

| Strategy | What a cell's column tells you |
| --- | --- |
| **Right-packed** | Steps remaining until the dish is done. Same meaning in every branch, every recipe. |
| Left-packed | How much prep has happened to the rawest thing in this cell — measured from a different origin in every branch, so two cells in the same column are not comparable. |
| Stretch-to-merge | A *range* of distances, because the cell spans several columns. |

PHASE-02 defines `PlacedCell.depth` as distance from the root specifically so shading ramps read
as "how close to done", and R5 wants grouping encoded with a redundant non-color channel. Under
right-packed, column position *is* that quantity — the encoding and the geometry agree for free.
Under the other two, any depth-driven encoding is either meaningless or needs a special case.

This is the same shape of argument that settled Q5: not a preference, a fact about what the axis
can carry.

## What rendering changed

Two of my predictions going in were wrong, and both corrections came from looking.

**PHASE-02 predicted stretch-to-merge would interact badly with bottom-right anchoring** — that a
stretched cell's text would "float far from its inputs". The opposite: the text lands at the merge
point, which is where you want it, and the cell *body* bridges the gap so the long-range dependency
is drawn rather than implied. It is the only strategy that makes that connection visible.

Its real failure is **weight**. A seven-column bar renders at nearly the visual weight of the
prelude band, so `cut up into small pieces` — the least consequential step on the chart — becomes
one of the most prominent things on it. That disqualifies it as a default. But the thing it was
doing well is worth keeping, which is where the leader rule comes from.

**The control case is not identical, quite.** All three render grilled artichokes with the same
step geometry, the same 8 columns and the same 1,847px width — every cell in the same place. The
only difference any measurement finds is that right- and left-packed emit two filler cells where
stretch emits none, and filler is invisible. The strategies can only diverge where one branch is
shorter than its sibling, so a pure chain offers no choice to make.

That has a practical consequence: **this decision cannot be validated on simple recipes.** It costs
nothing on most of the corpus and everything on the ones the format exists for.

## Measured

Identical widths across all three, on both cases. Compactness is not the discriminator.

| Strategy | Shepherd's pie | Artichokes | Filler cells (pie) | Butter row → its own step |
| --- | --- | --- | --- | --- |
| Right-packed | 11 cols / 2,664px | 8 cols / 1,847px | 11 | 6 columns away |
| Left-packed | 11 cols / 2,664px | 8 cols / 1,847px | 11 | adjacent |
| Stretch-to-merge | 11 cols / 2,664px | 8 cols / 1,847px | 10 | adjacent |

> **Correction.** The artifact reports zero filler under stretch-to-merge. That was a
> simplification in the study — it simply did not emit filler for that strategy. The real engine
> gives 10 against right-packed's 11, because only *step* cells stretch: a bare ingredient that
> joins the chain late still leaves a gap no cell can absorb. Stretch reduces filler by one cell
> here, it does not eliminate it. The conclusion is unaffected, and
> `packages/core/src/layout.test.ts` now pins the corrected behaviour.

## Why not the hybrid

The obvious rule — "stretch when a chain is exactly one step deep, otherwise right-pack" — was
rendered. It looks fine. It is still the wrong call:

- It fires on **exactly one cell in the entire corpus**.
- It would push a rendering concern into `GridPlan`, where column position would then mean
  "distance from done" for most cells and "a range of distances" for a few. Every depth-driven
  encoding downstream would carry that special case permanently.
- The benefit it buys — a visible connection across the gap — is available for one CSS rule.

Keep all three implemented behind the `columns` option. They are cheap, and golden files with three
variants catch more than golden files with one. But the default is right-packed with no conditions.

## Consequence for Phase 03

**The leader rule is now a Phase 03 deliverable, not a nice-to-have.** Right-packed's single real
weakness is that row alignment is the only thing linking an ingredient to a distant step, and row
alignment is invisible. The artifact's "Leader rules in the gaps" toggle shows the repair: a
hairline through filler runs of two or more columns.

Open sub-questions for Phase 03: whether the leader should be continuous or dotted, whether it
should strengthen on row hover, and whether it needs to survive print (it should — the wall-chart
is a print artifact as much as a screen one).

## Unplanned finding — the stray-border complaint is partly a table artifact

R1 ("the vertical border that extends from the prior instruction to the ones beneath") is the
most-cited complaint about the original format, and CFE's `righthide` class is a hand-applied patch
over it.

Toggling "Reveal filler cells" in the artifact shows why the problem exists: **an HTML table has no
way to say "nothing is here."** Every gap has to be a real `<td>`, and every `<td>` draws borders.
CSS Grid can leave a track genuinely empty — in all three renderings above, filler draws nothing
because it is not a box, it is unoccupied space.

So a meaningful part of the complaint that launched this project is an artifact of the 2004
substrate rather than of the format itself. **This is evidence for Q3**, which currently leaves open
whether a table might win on accessibility: whatever that test concludes, a table renderer has to
re-solve a problem the grid does not have.

## Open

- Not tested with anyone reading a chart to cook from. The claim that "steps remaining" is the
  useful reading of column position is well-argued but unvalidated — fold into Phase 08.
- The leader rule is proposed, not designed. It reads correctly at the tested weight but has not
  been checked against print, high-contrast mode, or a chart with many adjacent gaps.
- All three strategies are unusable at 390px, identically — 11 columns is 11 columns. Column
  assignment is not where the mobile problem gets solved; that is Phase 04's cook mode.

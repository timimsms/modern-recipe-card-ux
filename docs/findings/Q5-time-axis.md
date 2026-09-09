# Finding — Q5: Should column width encode step duration?

**Status:** provisional — design exploration, not user-tested.
**Rendered study:** [../design/q5-time-axis-variants.html](../design/q5-time-axis-variants.html)
**Prompt:** [`../planning/prompts/Q5-time-axis-showcase.md`](../planning/prompts/Q5-time-axis-showcase.md)
**Test recipe:** espresso brownies — 9 ingredients, 6 steps, ~7 min hands-on, 30–40 min unattended.

## Answer

**No. Width cannot encode duration.** Put time inside the cell as a glyph instead.

Ship **variant E + F**: an in-cell duration bar scaled to the recipe's longest step, with an
attended/unattended split encoded as solid vs. hatched fill. Keep variant A (topological, duration
as text) as the fallback — E+F collapses to exactly A when no durations are authored, which is the
common case.

Discard B (linear time-proportional) and C (compressed √ scale). Cut D (separate time rail).

## Why — the structural argument

This is not an aesthetic preference. Variants B, C, and D fail on a fact about the grid:

> **A column is shared by every parallel branch that reaches that depth, so it can carry only
> one width.**

In the test recipe, `mix` (1 min) and `sift together` (2 min) both sit at column 4. A
duration-proportional column has to resolve that with `max()`, at which point the axis is already
lying. Any recipe with parallel branches of differing length — which is most of them, and is the
entire reason this format exists — breaks the encoding before legibility enters the argument.

The horizontal axis is **already fully committed** to representing dependency depth. There is no
room in it for a second variable.

This reframes the question. It was never "should width encode duration" — width *cannot*, without
breaking the format. It was "where else can duration go," and the answer is inside the cell.

## Secondary finding — variant C is a trap

The compressed √ scale is the one to watch out for. It looks principled and measured, it keeps
everything readable, and it is the option most likely to survive a design review. It still breaks
on shared columns, still spends 55% of the chart on one step, and now misrepresents magnitude by a
square root — a 4× difference renders as 2×. A chart that is subtly wrong is worse than one that is
honestly silent.

## The missing-data constraint decided it

In the real source, **only the bake carries an authored duration.** Five of six steps have none.
Any variant requiring complete data is not a design, it's a data-entry mandate.

| Variant | Behavior with unknown duration |
| --- | --- |
| A | Invisible — duration was optional text |
| B, C | **Fail outright.** No width to assign; a default silently fabricates a quantitative claim |
| D | Step drops out of the rail; a rail with gaps is not a timeline |
| E | Degrades gracefully — dashed empty track reads as "not recorded", not "zero" |
| F | Still works — attended/unattended is knowable even when duration isn't, and is the more useful half |

## Consequence for the schema (Phase 01)

E and F don't need accurate minutes. They need **ordinal magnitude** and **one boolean**. A cook
reading a bar cannot distinguish 1 min from 2 min and doesn't need to. Requiring an authored
duration for every step is a large permanent authoring burden for precision the design cannot render.

**Proposal:** keep `duration` optional (used for timers, not layout) and add a cheap required field:

```ts
type Effort = 'quick' | 'minutes' | 'long-unattended'
```

| Bucket | Meaning | Renders as |
| --- | --- | --- |
| `quick` | under ~2 min, part of the flow | short bar |
| `minutes` | a few minutes, hands-on | medium solid bar |
| `long-unattended` | you can leave | full hatched bar + "walk away" |

Three ordinal buckets carry nearly all the decision-relevant signal at a fraction of the cost.
`long-unattended` is also exactly what Phase 04's cook-mode parallelism banner needs in order to
say *"while this bakes, you can…"* — so the field earns its keep twice.

Known limitation: the attended/unattended boolean flattens genuinely mixed steps (a 15-minute
simmer you stir occasionally). Accept for now; revisit if the corpus shows it's common.

## Follow-on — the at-a-glance bar

**Resolved card design:** [../design/resolved-card.html](../design/resolved-card.html)

Reviewing the comparison, the summary strip built as page furniture turned out to be a better idea
than the thing it was labelling. Promoted to a Phase 03 component: a horizontal bar between the
card title and the chart, answering *what am I signing up for?* before the reader parses anything.

Fields: **servings · ingredients · steps · start to finish · hands-on · longest walk-away ·
saved in parallel.**

Two properties make it worth building:

1. **Everything except `servings` is derived** from the assembly tree plus the `Effort` buckets
   above. Zero additional authoring cost.
2. **`start to finish` is the critical path, not the sum.** Summing durations is the standard error
   on recipe sites, and it inflates the figure by precisely the amount this format was invented to
   save. Requires `TimingSummary` on `GridPlan` — added to Phase 02.

**`saved in parallel` is the format arguing for itself.** The convergence grid's value has always
been implicit in its geometry; this states it as a number. It's also usefully self-critical:
brownies save ~2 min, shepherd's pie ~22 min. When the figure approaches zero the recipe is
effectively linear and the grid is doing little for the reader — a signal Phase 04's cook mode can
act on by stepping through in order.

**Degradation rule: omit rather than estimate.** No `Effort` data at all → counts only. Buckets but
no precise durations → ranges from bucket midpoints, labelled `approx`. A fabricated number in a
summary bar is worse than a missing one, because it will be trusted.

## Open

- Not validated with anyone actually cooking. The claim that "when can I walk away" beats raw
  duration is well-argued but untested — fold into Phase 08's user testing question.
- Bars are scaled per-recipe, so they aren't comparable across recipes. Probably fine; confirm.
- `hands-on` and `longest walk-away` don't sum to `start to finish` when branches overlap (brownies:
  7 + 35 = 42 vs. 40 start-to-finish). The 2-minute gap *is* the parallel saving, so the arithmetic
  is correct but looks wrong at a glance. Watch whether this reads as an error in user testing.

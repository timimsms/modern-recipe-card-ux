# Prompt — Q5: Does a time axis improve or destroy the convergence grid?

> **How to use:** everything below the horizontal rule is the prompt. It is deliberately
> self-contained — paste it into a fresh Claude conversation and ask for an artifact.
> Related: [`../GAMEPLAN.md`](../GAMEPLAN.md) §9 Q5, [`../phases/PHASE-04-responsive-and-cook-mode.md`](../phases/PHASE-04-responsive-and-cook-mode.md).

---

I need a visual comparison to settle a specific information-design question. Please build a
single self-contained HTML artifact that renders six variants of the same recipe chart side by
side, so the tradeoffs are visible rather than argued about.

## Background: the format

"Cooking For Engineers" recipe charts encode a recipe as a **convergence grid**. Ingredients
are rows in a left-hand column. Each cooking step is a cell to the right that spans exactly the
rows it consumes, and steps cascade rightward, merging into a single final cell. It's a
left-to-right dendrogram drawn as a table.

The format's whole value is that you can see **what happens in parallel and what converges**.
Any variant that loses that has failed, regardless of how good it looks.

## The question

**Column width currently encodes nothing.** It's driven by text length alone. A step that takes
30 seconds and a step that takes 40 minutes get the same width. The grid encodes *dependency*
but not *duration*.

Adding a time axis could be a real improvement on a 20-year-old format — or it could destroy
the compactness that makes the chart scannable in one glance. I want to see which.

## The test recipe (use exactly this data)

Espresso brownies. Nine ingredients, six steps.

**Ingredients, in row order:**

| # | Ingredient |
|---|---|
| 1 | 4 oz (115 g) unsalted butter |
| 2 | 1 cup (200 g) sugar |
| 3 | ¼ tsp (2.5 mL) vanilla extract |
| 4 | 1 shot (4 Tbs; 60 mL) fresh brewed espresso |
| 5 | 2 large (100 g) eggs |
| 6 | ½ cup (80 g) all-purpose flour |
| 7 | ⅓ cup (80 g) Hershey's cocoa powder |
| 8 | ¼ tsp (1.3 g) baking soda |
| 9 | ¼ tsp (1.5 g) table salt |

**Preludes** (full-width bands above the grid): "Butter and flour an 8×8-in pan" and
"Preheat oven to 350°F / 176°C".

**Step tree:**

| Step | Consumes | Rows | Duration | Attended? |
|---|---|---|---|---|
| `melt` | butter | 1 | 2 min | yes |
| `mix` | `melt` + sugar, vanilla, espresso | 1–4 | 1 min | yes |
| `mix` | previous `mix` + eggs | 1–5 | 1 min | yes |
| `sift together` | flour, cocoa, baking soda, salt | 6–9 | 2 min | yes |
| `fold in` | second `mix` + `sift together` | 1–9 | 1 min | yes |
| `bake 350°F / 176°C` | `fold in` | 1–9 | **30–40 min** | **no — unattended** |

Note the shape of this data, because it *is* the problem: roughly 7 minutes of hands-on work
followed by a 35-minute unattended bake. The bake is ~83% of wall-clock time and ~14% of the steps.

## The six variants

Render all six on the same data, stacked vertically, each with a heading and a short caption.

**A — Topological (control).** Current behavior. Column width from text content only; duration
appears as text inside the cell. This is the baseline everything else is judged against.

**B — Linear time-proportional.** Column width strictly ∝ duration. The bake should consume most
of the horizontal space and the quick steps should collapse to slivers. **Do not soften this** —
if it looks bad, that's the finding.

**C — Compressed time scale.** Width ∝ √duration (or log). Preserves ordering and relative
magnitude without letting the bake eat the page. Label which function you used.

**D — Time rail.** Keep topological columns exactly as in A, and add a separate proportional
timeline strip along the bottom, linked to the step cells by light leader lines. Time becomes an
annotation rather than the geometry.

**E — In-cell duration bar.** Topological columns, with a small horizontal bar inside each step
cell scaled against the recipe's longest step. Fully preserves A's compactness; duration becomes
a glyph.

**F — Attended vs. unattended.** Encode hands-on time as solid fill and unattended time as a
hatched or ghosted extension. Combine with C's compressed scale. The premise here is that
"how long until I can walk away" may matter more to a cook than raw duration.

## Constraints

1. **Handle missing durations.** In the real source, *only* the bake has an authored duration —
   every other number above is an estimate I supplied for this exercise. Each variant must show
   how it degrades when a step's duration is unknown. This is a hard requirement, not a footnote;
   a design that only works with complete data is not usable.
2. **Preserve the merge structure.** In every variant it must remain obvious that the wet chain
   and the dry chain run independently and converge at `fold in`.
3. **Bounded borders.** A step's rules must enclose exactly the rows it owns. No vertical line
   may extend past a step's own region into unrelated rows below — that's the single most common
   complaint about the original format.
4. **Consistent text anchoring.** Anchor step text bottom-right within its region in all variants,
   so the eye follows a predictable path.
5. **Greyscale-legible.** Any color encoding must be redundant with weight, fill pattern, or
   label. Include a greyscale rendering of your recommended variant to prove it.
6. **Note the mobile consequence.** Below each variant, state in one line what happens at 390px
   width. Variant B in particular has an obvious problem there.

## Output

- One self-contained HTML file. No external stylesheets, scripts, fonts, or images.
- All six variants visible on one page for direct comparison.
- Under each, a two-line caption: what it gains, what it costs.
- A closing **verdict** section: which variant you'd ship, which you'd discard outright, and
  whether any of them justify collecting duration data for every step — which is real authoring
  burden and the actual cost of this whole idea.

Be blunt in the captions. I'm trying to find out whether this idea is bad, and a mockup that
flatters all six options is useless to me. If variant B is unusable, make it look unusable.

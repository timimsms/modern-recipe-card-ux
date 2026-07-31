# Prompt — I4: How should the grid handle an ingredient or step used twice?

> **How to use:** everything below the horizontal rule is the prompt. It is deliberately
> self-contained — paste it into a fresh Claude conversation and ask for an artifact.
> Related: [`../GAMEPLAN.md`](../GAMEPLAN.md) §4.1 I4,
> [`../phases/PHASE-02-layout-engine.md`](../phases/PHASE-02-layout-engine.md),
> [`../phases/PHASE-07-experiment-tracks.md`](../phases/PHASE-07-experiment-tracks.md).

---

I need a visual comparison to settle a structural question. Please build a single self-contained
HTML artifact that renders the same two recipes under five different strategies for handling reuse.

## Background: the format

"Cooking For Engineers" recipe charts encode a recipe as a **convergence grid**. Ingredients are
rows in a left-hand column. Each cooking step is a cell to the right spanning exactly the rows it
consumes, and steps cascade rightward, merging into one final cell.

The format has one load-bearing assumption: **a step's inputs must occupy contiguous rows.** That
holds only if the recipe is a *tree* — every ingredient and every intermediate result feeds exactly
one downstream step.

## The problem

Real recipes are not trees. They're DAGs. The moment you write "reserve half for later," one node
feeds two consumers, they can't both be adjacent to it, and the grid's core assumption breaks.

The original format simply has no answer for this. I need to pick one.

## The two cases to test

### Case 1 — Node reuse (a diamond)

One *step's output* feeds two branches that later re-converge. This is the harder and more common case.

**Grilled chicken with lemon vinaigrette**

| # | Ingredient |
|---|---|
| 1 | ¼ cup (60 mL) olive oil |
| 2 | 2 Tbs (30 mL) lemon juice |
| 3 | 1 tsp (5 g) Dijon mustard |
| 4 | 1 clove garlic, minced |
| 5 | ½ tsp salt |
| 6 | 2 (450 g) chicken breasts |
| 7 | 4 cups (120 g) arugula |
| 8 | 2 Tbs (14 g) shaved parmesan |

| Step | Consumes | Note |
|---|---|---|
| `whisk` | oil, lemon juice, Dijon, garlic, salt | produces **vinaigrette** |
| `marinate 30 min` | chicken + **half the vinaigrette** | |
| `grill 6 min per side` | `marinate` | |
| `toss` | arugula + **the other half of the vinaigrette** | |
| `plate` | `grill` + `toss` + parmesan | the diamond closes here |

The `whisk` output splits, travels down two independent paths, and rejoins at `plate`.
No row ordering makes both consumers contiguous with it.

### Case 2 — Leaf reuse (a split ingredient)

One *ingredient* is consumed by two steps at different depths. Simpler, but very common.

**Skillet cornbread**

| # | Ingredient |
|---|---|
| 1 | **4 oz (115 g) butter** — 3 oz melted into the batter, 1 oz for the skillet |
| 2 | 1 cup (140 g) cornmeal |
| 3 | 1 cup (125 g) all-purpose flour |
| 4 | 1 Tbs (12 g) baking powder |
| 5 | 1 tsp (6 g) salt |
| 6 | 1 cup (240 mL) buttermilk |
| 7 | 2 large (100 g) eggs |

| Step | Consumes |
|---|---|
| `whisk together` | cornmeal, flour, baking powder, salt |
| `beat` | buttermilk, eggs |
| `melt 3 oz` | **part of the butter** |
| `stir in` | `whisk together` + `beat` + `melt 3 oz` |
| `grease hot skillet with remaining 1 oz` | **the same butter row** |
| `pour in and bake 425°F / 218°C 25 min` | `stir in` + `grease` |

## The five strategies

Render **both cases** under each of these. Where a strategy can't express a case, say so plainly
rather than inventing something.

**1 — Split node.** Model the division as an explicit step ("divide in half") that produces two
named outputs, each occupying its own row. Honest about the tree; adds a row and a step that
aren't really cooking actions.

**2 — Duplicate leaf.** Emit the reused thing twice as two adjacent rows ("vinaigrette, half" /
"vinaigrette, reserved"), with a visual tie between them. Preserves the grid perfectly; risks
reading as two separate quantities, which is a genuine safety problem in a recipe — someone
makes the vinaigrette twice.

**3 — Non-planar connector.** Keep one row and draw a real curved edge to the distant second
consumer, crossing over other cells. Only tractable in an SVG renderer. Truthful, but shows what
happens to legibility when edges cross the grid.

**4 — Reference chip.** Keep one row for the first consumer; the second consumer displays an
inline reference token in place of an input — something like `↑ vinaigrette (reserved half)` —
with hover/tap highlighting the origin. Compact; makes the dependency textual rather than spatial.

**5 — Subtree duplication.** Refuse to represent the DAG at all and duplicate the entire upstream
subtree under each consumer. Include this as the honest baseline for what "just keep it a tree"
actually costs on the page.

## Constraints

1. **Safety first.** A cook must never be able to misread the chart as requiring double the
   ingredient. Any strategy that risks this must show how it mitigates it, and the caption must
   say so directly. This outweighs elegance.
2. **Bounded borders.** A step's rules must enclose exactly the rows it owns. No vertical line may
   extend past a step's region into unrelated rows.
3. **Consistent text anchoring.** Anchor step text bottom-right within its region throughout.
4. **Same type, spacing, and color** across all renderings — the strategy is the only variable.
5. **Show chart dimensions** (rows × columns) for each strategy on each case. Strategy 5 in
   particular should be measured, not just described.
6. **Greyscale-legible.** Any color used to tie duplicated or referenced rows together must be
   redundant with a shape, weight, or label.
7. **Note the mobile consequence.** One line per strategy on what happens at 390px — strategy 3's
   crossing edges have an obvious problem there.

## Output

- One self-contained HTML file. No external stylesheets, scripts, fonts, or images.
- A matrix: five strategies × two cases, laid out so a column can be read down and compared.
- Under each cell, a two-line caption: what it gains, what it costs.
- A closing **verdict** covering three things:
  1. Which strategy should be the engine's default.
  2. Whether node reuse (case 1) and leaf reuse (case 2) want *different* answers — I suspect
     they might, and that would be a useful finding.
  3. Whether strategy 3 is compelling enough to justify building the SVG renderer specifically
     to support it, since that's currently its main reason to exist.

Be blunt. I want to know which of these is actually dangerous in a kitchen, not which is prettiest.

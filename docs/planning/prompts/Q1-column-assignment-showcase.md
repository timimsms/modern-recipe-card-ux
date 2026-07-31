# Prompt — Q1: Which column-assignment strategy should the layout engine default to?

> **How to use:** everything below the horizontal rule is the prompt. It is deliberately
> self-contained — paste it into a fresh Claude conversation and ask for an artifact.
> Related: [`../GAMEPLAN.md`](../GAMEPLAN.md) §4.1 I3 and §9 Q1,
> [`../phases/PHASE-02-layout-engine.md`](../phases/PHASE-02-layout-engine.md).

---

I need a visual comparison to settle a layout question. Please build a single self-contained HTML
artifact that renders the same recipe chart under three different column-assignment strategies,
so I can see which one reads better.

## Background: the format

"Cooking For Engineers" recipe charts encode a recipe as a **convergence grid**. Ingredients are
rows in a left-hand column. Each cooking step is a cell to the right spanning exactly the rows it
consumes, and steps cascade rightward, merging into one final cell. It's a left-to-right
dendrogram drawn as a table. The value of the format is seeing what runs in parallel and what
converges.

## The question

Row spans are fully determined — a step spans exactly the rows it consumes. **Column position is
not.** When a short prep chain feeds a step far to the right, there's a horizontal gap, and there
are three defensible ways to resolve it.

The original site is inconsistent about this: it uses different resolutions in different recipes,
which is why I need to look at them side by side rather than reason about it.

**Strategy A — Left-packed.** `column = depth from the deepest leaf`. Short chains sit far left
and the gap is empty filler cells on the *right*, before the merge.

**Strategy B — Right-packed.** `column(child) = column(parent) − 1`. Every step hugs its parent, so
the gap becomes empty filler on the *left*. This produces the characteristic staircase.
*The source used this for the artichoke recipe below — the olive oil row emits three empty padding
cells before its step.*

**Strategy C — Stretch-to-merge.** No filler at all. The step cell's own `colspan` absorbs the gap,
so a short prep step becomes a very wide cell reaching from the ingredient column to its merge point.
*The source used this for the butter row in the shepherd's pie below.*

## Test case 1 (primary): Shepherd's pie

This is the hard case — deep, unbalanced, with one branch that joins very late.

**Prelude band:** "Preheat oven to 400°F / 204°C"

**Ingredients, in row order:**

| # | Ingredient |
|---|---|
| 1 | 3 Tbs (45 mL) vegetable oil |
| 2 | 1 medium (110 g) onion |
| 3 | 1 medium (61 g) carrot |
| 4 | 1 medium (40 g) celery stalk |
| 5 | 1 pound (450 g) ground lamb |
| 6 | 1 Tbs (8 g) all-purpose flour |
| 7 | 1 tsp (1.2 g) dried rosemary |
| 8 | 1 tsp (1 g) dried thyme |
| 9 | 1 pinch ground nutmeg |
| 10 | 1 cup (235 mL) beef broth |
| 11 | salt |
| 12 | ground black pepper |
| 13 | 1¾ lb (800 g) mashed potatoes *(output of a separate component)* |
| 14 | 2 Tbs (28 g) butter |
| 15 | paprika |

**Step tree:**

| Step | Consumes | Rows |
|---|---|---|
| `heat` | oil | 1 |
| `dice` | onion, carrot, celery | 2–4 |
| `med-low until tender` | `heat` + `dice` | 1–4 |
| `cook until meat is no longer pink` | previous + lamb | 1–5 |
| `mix and cook` | previous + flour | 1–6 |
| `stir in and cook until liquid thickens` | previous + rosemary, thyme, nutmeg, broth | 1–10 |
| `season to taste` | previous + salt, pepper | 1–12 |
| `cover with potatoes and fluff with fork` | previous + mashed potatoes | 1–13 |
| **`cut up into small pieces`** | **butter** | **14** |
| `drop butter pieces on top` | previous main chain + `cut up into small pieces` | 1–14 |
| `cover with paprika` | previous + paprika | 1–15 |
| `bake 400°F / 205°C 30 min` | previous | 1–15 |

**Watch the `cut up into small pieces` cell.** It is one step deep but joins the main chain nine
columns in. It is the entire reason this question exists, and each strategy treats it completely
differently. Call it out visually in all three renderings.

## Test case 2 (control): Grilled artichokes

A trivial chain, to check whether the strategies even differ on simple recipes — and whether the
winner on case 1 makes case 2 worse.

**Prelude band:** "Boil 1 in (2.5 cm) water in pot with steamer attachment / Preheat grill"

| # | Ingredient |
|---|---|
| 1 | 1 large artichoke |
| 2 | 1 tsp (5 mL) olive oil |
| 3 | salt and pepper |

| Step | Consumes | Rows |
|---|---|---|
| `trim` | artichoke | 1 |
| `steam 15 min` | `trim` | 1 |
| `cut from tip to base` | `steam` | 1 |
| `brush` | `cut` + olive oil | 1–2 |
| `season` | `brush` + salt and pepper | 1–3 |
| `grill 10 min medium heat, cut side up` | `season` | 1–3 |
| `grill 5 min cut side down` | previous | 1–3 |

## Constraints

1. **Bounded borders.** A step's rules must enclose exactly the rows it owns. No vertical line may
   extend past a step's region into unrelated rows below. This is the single most common complaint
   about the original format, and strategies A and B are the ones most at risk of reintroducing it
   through their filler cells — show honestly whether they do.
2. **Filler cells must be visually silent.** Empty padding should read as absence, not as an empty box.
3. **Consistent text anchoring.** Anchor step text bottom-right within its region in all three.
4. **Same type, spacing, and color** across all three renderings. The only variable is column
   assignment. If they don't look identical apart from that, the comparison is void.
5. **Show total chart width** for each strategy on each test case, in columns and in pixels.
   Compactness is a real criterion — this chart has to fit on a screen.
6. **Note the mobile consequence.** One line per strategy on what happens at 390px width.

## Output

- One self-contained HTML file. No external stylesheets, scripts, fonts, or images.
- Test case 1 rendered three ways, stacked, each labeled with the strategy and its rule.
- Test case 2 rendered three ways below it.
- Under each rendering, a two-line caption: what it gains, what it costs.
- A closing **verdict**: which strategy to default to, and — importantly — whether the answer is
  the same for both test cases. If it isn't, propose the heuristic that picks between them
  (for example: "stretch when a chain is exactly one step deep, otherwise right-pack") and show
  what that hybrid produces on case 1.

Be blunt in the captions. I want to find the strategy that fails least, so make the failures
visible rather than smoothing them over.

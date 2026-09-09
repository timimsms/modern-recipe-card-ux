# GAMEPLAN — Modern Recipe Card UX

## 1. Premise

The Cooking For Engineers (CFE) recipe grid is one of the most-loved and most-criticized
information designs on the food web. Its core insight is genuinely great and genuinely rare:

> **A recipe is not a list. It is a tree of convergence.**
> Ingredients are leaves. Steps are internal nodes that consume leaves and other steps.
> The final dish is the root.

A linear numbered recipe destroys that structure. The CFE grid preserves it, which is why
you can look at one and instantly see *what happens in parallel*, *what waits*, and *what
merges into what*. That is the thing worth keeping.

Everything else about the artifact is a 2004 HTML table, and it shows. The viral Threads
discussion (screenshots reviewed during planning; not redistributed in this repo) is, read
carefully, a crowd-sourced usability audit —
and every complaint in it is a solvable rendering problem, not a flaw in the underlying idea.

**This project's thesis:** separate the *idea* (the assembly tree) from the *rendering*
(the grid), build the idea once as a rigorous shared core, then use it as a fixed control
variable to compare frontend approaches to the rendering problem.

---

## 2. Source analysis

### 2.1 What CFE actually emits

Pulled live from `sources/Cooking For Engineers - …Grilled-Artichokes.webloc`:

```html
<table><tbody>
  <tr><td colspan="8" align="center">Boil 1 in. (2.5 cm) water in pot with steamer attachment / Preheat grill</td></tr>
  <tr>
    <td>1 large artichoke</td>
    <td>trim</td><td>steam 15 min.</td><td>cut from tip to base</td>
    <td rowspan="2" class="vertical">brush</td>
    <td rowspan="3" class="vertical">season</td>
    <td rowspan="3" class="vertical">grill 10 min. medium heat with cut side up</td>
    <td rowspan="3" class="vertical">grill 5 min. cut side down</td>
  </tr>
  <tr><td>1 tsp. (5 mL) olive oil</td><td colspan="3" class="righthide"></td></tr>
  <tr><td>salt and pepper</td><td colspan="4" class="righthide"></td></tr>
</tbody></table>
```

Decoded conventions:

| Element | Meaning |
| --- | --- |
| One `<table>` per sub-recipe | Components are independent trees (see `sources` Shepherd's pie: "Mashed potatoes" then "Shepherd's pie") |
| Full-width `colspan` first row | **Prelude** — applies before/across the whole component (preheat, butter the pan) |
| Column 0 | Ingredient leaves, one per row, in a fixed order |
| `rowspan="n"` on a step cell | The step consumes exactly those `n` leaf rows |
| `class="righthide"` on empty `colspan` cells | Padding that suppresses its right border — CFE's own partial attempt at the stray-vertical-line problem |
| `class="vertical"` on step cells | Vertical centering |

**The critical observation:** there is no tree in the markup. The tree is *implied* by the
rowspan geometry, and recovering it is ambiguous and lossy. Our model must be **tree-first**,
with geometry derived from it — never the reverse.

### 2.2 The crowd audit → requirements

That thread is three people independently redesigning the same brownie
recipe. Each complaint maps to a hard requirement.

| Source | Complaint | Requirement |
| --- | --- | --- |
| `IMG_4226` — astrellenova | "the vertical border that extends from the prior instruction to the ones beneath" | **R1** Borders must bound exactly the subtree a step owns. No stray rules. |
| `IMG_4227` / `IMG_4228` — jenelope1st | "didn't like having to look up for the directions"; "fatigue looking for the instructions in a different vertical location each time" | **R2** Instruction text anchors consistently (their fix: bottom-right) so the eye tracks a predictable path. |
| `IMG_4228` — jenelope1st | "added missing instructions for the dry ingredients" | **R3** Every ingredient must reach the root through an *explicit, labeled* step. Implicit joins are a validation error. |
| `IMG_4228` — jenelope1st | "added heavier lines to group the ingredients and their related instructions" | **R4** Visible grouping that binds an ingredient run to the step that consumes it. |
| `IMG_4228` — jenelope1st | "ideally I would add color coded shading for the different groups" | **R5** Group encoding via color *plus* a redundant non-color channel. |
| `IMG_4228` — jenelope1st | "removed the space between the degree symbol and type of temperature scale… removed the parentheses to put Fahrenheit and Celsius on a more equal footing" | **R6** Typographic discipline: `350°F` not `350˚ F`; unit parity; tabular figures; unicode fractions. |
| `IMG_4230` — spreadsheet rebuild | Per-ingredient checkboxes; solid fill across each step's spanned area | **R7** Check-off state and spanned-region fill as first-class UI. |
| **All screenshots** | Every single one is a pinch-zoomed phone screenshot of a desktop table | **R8** The artifact is currently unusable on the device people actually read it on. This is the biggest open problem. |
| `IMG_4225` (brownies), `IMG_4231` (shepherd's pie), `IMG_4232` (stroganoff) | Long step text wraps badly; cells stretch to absurd widths | **R9** Text measure and column sizing are layout constraints, not afterthoughts. |

R8 deserves emphasis. The reason this format went viral as *images* rather than as *links*
is that nobody can use the real page on a phone. Solving that is the highest-value work here.

---

## 3. Vocabulary

Fixed terms, used consistently across all code and docs:

- **Assembly tree** — the data model. Leaves are ingredients; internal nodes are steps; the root is the finished component.
- **Convergence grid** — the classic 2D rendering of an assembly tree.
- **Component** — one sub-recipe = one tree (e.g. "Mashed potatoes" inside "Shepherd's pie").
- **Prelude** — a step that applies across a whole component rather than to specific inputs.
- **Run** — a contiguous set of ingredient rows consumed by one step.
- **Merge** — a step with two or more inputs.
- **Cook mode** — the mobile, one-step-at-a-time presentation.

---

## 4. The core technical problem

### 4.1 Layout invariants

**I1 — Leaf contiguity.** A step's inputs must occupy contiguous rows. Therefore the
ingredient order is not free: it must be a valid DFS leaf ordering of the tree. The engine
either derives the order from the tree or validates an author-supplied order against it.

**I2 — Row span.** `rows(step) = Σ leaves(subtree(step))`.

**I3 — Column assignment.** This is the interesting one. Naive `col = depth` breaks on
unbalanced branches, and the source corpus shows CFE itself using *two different* resolutions
for the same situation. Three strategies to implement and compare:

| Strategy | Behavior | Evidence |
| --- | --- | --- |
| **Left-packed** | `col = depth from leaf`; pad on the right with empty cells before the merge | — |
| **Right-packed** | `col(child) = col(parent) − 1`; pad on the *left* with `righthide` filler | Artichoke: olive oil row emits `<td colspan="3" class="righthide">` before `brush` |
| **Stretch-to-merge** | The step cell itself spans the gap instead of padding | Shepherd's pie: "cut up into small pieces" stretches from col 1 to the butter merge point |

Right-packed produces the characteristic staircase and keeps merges tight. Stretch-to-merge
reads better for short prep chains. Prototype both; the choice may be per-branch heuristic.

**I4 — Ingredient reuse (the hard case).** "Reserve half the butter for later" creates a leaf
consumed by two steps, which violates I1 — the tree becomes a DAG and the layout becomes
non-planar. Three escape hatches, each a schema-level decision:

- **Split node** — model the division explicitly as a step producing two outputs.
- **Duplicate leaf** — emit two rows ("2 Tbs butter", "2 Tbs butter, reserved") with a visual link.
- **Non-planar edge** — draw an actual connector. Only tractable in the SVG track; a key differentiator for that experiment.

**Resolved** — see [`../findings/I4-reuse.md`](../findings/I4-reuse.md). Two results change this
section. First, **node reuse is not a layout problem**: when the shared thing is a preparation with
its own method, it should be promoted to a component and referenced twice, which makes both tables
trees again. `layout()` therefore only has to handle *leaf* reuse. Second, the default is a
**reference chip**, not any of the three above — it is the only option that keeps one row for one
quantity while remaining renderable in every track. Duplicate-leaf is a genuine kitchen safety
hazard and must never be selected automatically. **The connector does not justify the SVG track on
its own**; that track needs a different primary justification before Phase 07.

**I5 — Cross-component reference.** Shepherd's pie consumes the *output* of the mashed
potatoes component as an ingredient row. Model as a first-class `ComponentRef` leaf, not a string.

### 4.2 Why this is the right factoring

The layout engine is pure: `AssemblyTree → GridPlan`. No DOM, no framework. That makes it
the control variable for the bake-off — every experiment track renders the *identical*
`GridPlan`, so differences in the output are attributable to the rendering approach rather
than to someone's better layout math.

---

## 5. Design principles

1. **Preserve parallelism at every breakpoint.** If a presentation can't answer "what else is
   happening right now?", it has thrown away the only reason to use this format.
2. **Predictable eye path.** R2 is not cosmetic. Consistent anchoring is the difference
   between scanning and hunting.
3. **Structure is the ornament.** Grouping, weight, and fill should come from the tree, not
   from decoration applied on top of it.
4. **Never color-only.** R5's color coding must be redundant with weight, fill pattern, or label.
5. **Built for a kitchen.** Wet hands, glances from across the counter, a phone propped against
   a canister, a timer already running. Large targets, high contrast, no hover-dependent affordances.
6. **The desktop wall-chart and the mobile cook mode are peers,** not an original and a
   degradation. The transition between them is its own design problem (Phase 4).

---

## 6. Architecture

```
packages/
  core/            # AssemblyTree schema, validator, layout engine → GridPlan. Zero deps, zero DOM.
  corpus/          # Transcribed recipes + stress fixtures as validated JSON.
  tokens/          # Design tokens (color, type, space, rules) emitted to CSS vars + TS + JSON.
  harness/         # Bake-off instrumentation: bundle size, perf, a11y, fidelity scoring.
experiments/
  01-css-grid/     # Vanilla HTML/CSS. Grid + subgrid + container queries. The reference renderer.
  02-react-shadcn/ # React + Tailwind + shadcn/ui + Radix primitives.
  03-svg/          # SVG/canvas dendrogram. Owns the non-planar-edge case (I4).
  04-alt-frameworks/ # Svelte / Solid / Vue on the identical GridPlan.
docs/planning/
  GAMEPLAN.md
  phases/
```

Hard rule: **no experiment may fork the model or the layout engine.** If a track needs
something the core doesn't expose, that's a core change benefiting all tracks — which is
itself a finding worth recording.

---

## 7. Success criteria

The project succeeds if, at the end:

- Every complaint in §2.2 (R1–R9) is demonstrably resolved in at least the reference renderer.
- The same recipe renders correctly across all four tracks from one unmodified `GridPlan`.
- A phone user can cook the Shepherd's pie recipe end-to-end without pinch-zooming once.
- The full corpus — including the reuse and cross-component stress cases — layouts without
  manual per-recipe tuning.
- A screen-reader user can obtain both the linear procedure *and* the parallelism structure.
- The bake-off produces a scorecard with defensible numbers, and a written recommendation
  for which approach to reach for and when.

---

## 8. Phase map

| Phase | Title | Produces |
| --- | --- | --- |
| [00](phases/PHASE-00-foundation.md) | Foundation & Scaffold | Monorepo, tooling, CI, empty package boundaries |
| [01](phases/PHASE-01-model-and-corpus.md) | Assembly Tree Model & Corpus | Schema, validator, transcribed recipes, stress fixtures |
| [02](phases/PHASE-02-layout-engine.md) | Layout Engine | `AssemblyTree → GridPlan`, column strategies, golden tests |
| [03](phases/PHASE-03-design-system-and-reference.md) | Design System & Reference Renderer | Tokens, R1–R7 fixes, CSS Grid wall-chart |
| [04](phases/PHASE-04-responsive-and-cook-mode.md) | Responsive Ladder & Cook Mode | Breakpoint ladder, cook mode, the transition |
| [05](phases/PHASE-05-interaction-and-kitchen-state.md) | Interaction & Kitchen State | Check-off, scaling, units, timers, wake lock, persistence |
| [06](phases/PHASE-06-accessibility.md) | Accessibility & Semantics | Linearization, SR narrative, roles, print/PDF |
| [07](phases/PHASE-07-experiment-tracks.md) | Experiment Tracks | React/shadcn, SVG, alt-framework implementations |
| [08](phases/PHASE-08-bakeoff-and-showcase.md) | Bake-off & Showcase | Harness results, scorecards, gallery, writeup |

Sequencing notes:

- **02 is the keystone.** Nothing visual is trustworthy until the `GridPlan` is right, and
  every later phase consumes it. Do not start 03 with a provisional engine.
- **03 and 04 are a pair.** Building the wall-chart without knowing where cook mode is going
  produces tokens that don't survive the transition. Sketch 04's cook mode before finalizing 03's tokens.
- **06 is deliberately late but not optional.** It needs a real renderer to audit, but its
  findings will push changes back into 02 (the core needs to emit a linearization order) and
  03. Budget for that backflow rather than treating 06 as a rubber stamp.
- **07 is parallelizable.** Once 03–06 have settled the reference renderer, the three
  remaining tracks are independent of one another.

---

## 9. Open questions

- **Q1** — ~~Is right-packed or stretch-to-merge the better default?~~ **Answered: right-packed,
  unconditionally.** It is the only strategy where a column *means* something — steps remaining until
  done — which is exactly what `PlacedCell.depth` and R5's shading rely on. No hybrid. The one cost
  (a long blank run between an ingredient and its own step) is repaired in the renderer with a leader
  rule, not in `GridPlan`. See [`../findings/Q1-column-assignment.md`](../findings/Q1-column-assignment.md).
- **Q2** — ~~Does cook mode preserve enough parallelism to be honest?~~ **Answered: it does not
  relinearize, but not for the reason expected.** The parallelism banner — PHASE-04's proposed
  defence — fires on **0 of 66 corpus steps**, because these recipes are chains and a lone cook
  has nothing to overlap. What keeps cook mode honest is the mini-map, inputs named as things
  rather than step numbers, and the tree staying one tap away. See
  [`../findings/Q2-cook-mode-honesty.md`](../findings/Q2-cook-mode-honesty.md).
- **Q3** — Is `<table>` with `rowspan`/`colspan` actually the most accessible substrate, given
  that assistive tech understands table navigation? Or does CSS Grid + explicit ARIA win?
  Phase 06 should test both against a real screen reader, not just axe.
- **Q4** — ~~Should authoring be JSON-only, or is a terse DSL needed?~~ **Answered.** JSON, plus a
  thin normalising layer — string fractions and bare input ids, resolved on load. No DSL; the flat
  `steps` record was reported as the right call even at ten deep. See
  [`../findings/Q4-authoring-ergonomics.md`](../findings/Q4-authoring-ergonomics.md), which also
  records the schema gaps transcription exposed and one unplanned validator rule (**W5**, the
  *labeled* implicit join that R3's existing check cannot see).
- **Q5** — ~~Where does step *duration* fit?~~ **Provisionally answered:** width *cannot* encode
  duration — a column is shared by every parallel branch at that depth, so it can carry only one
  width, and the horizontal axis is already fully committed to dependency. Time goes inside the
  cell as a glyph. See [`../findings/Q5-time-axis.md`](../findings/Q5-time-axis.md); this adds an
  `Effort` field to the Phase 01 schema.

Design prompts for the visual questions — run these before committing to the corresponding phase.
**All four are now run**; nothing gates Phase 02.

| Question | Prompt | Status |
| --- | --- | --- |
| Q1 — column assignment | [`prompts/Q1-column-assignment-showcase.md`](prompts/Q1-column-assignment-showcase.md) | **run** → [finding](../findings/Q1-column-assignment.md) |
| Q5 — time axis | [`prompts/Q5-time-axis-showcase.md`](prompts/Q5-time-axis-showcase.md) | **run** → [finding](../findings/Q5-time-axis.md) |
| I4 — ingredient/step reuse | [`prompts/I4-ingredient-reuse-showcase.md`](prompts/I4-ingredient-reuse-showcase.md) | **run** → [finding](../findings/I4-reuse.md) |
| Q4 — authoring ergonomics | answered by building, not by a showcase | **resolved** → [finding](../findings/Q4-authoring-ergonomics.md) |

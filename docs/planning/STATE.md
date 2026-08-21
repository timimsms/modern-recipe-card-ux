# Project state — handoff

> Read this first after a context clear. Current as of the close of the Phase 00–01 build session.

## Where things stand

**Phases 00 and 01 are built.** The monorepo exists with structurally enforced boundaries, the
assembly tree model and validator are written and tested, and the corpus is transcribed.
`pnpm check` runs typecheck, lint, boundary check, format check and 110 tests — green, in a few
seconds.

**Phase 02 — the layout engine — is built.** `layout(component, opts) → GridPlan` in
`packages/core/src/layout.ts`, with all three column strategies, all three reuse strategies,
derived edges, groups, linearization, critical path and `TimingSummary`. 200 tests pass, including
~3,300 generated trees and golden files for every corpus entry × strategy.

**Phase 03 is under way.** Tokens exist with contrast validated as a test, and
`experiments/01-css-grid` renders every corpus recipe from a `GridPlan` with no bundler and no
framework. 274 tests pass. **E1 — the item that gated the token freeze — is resolved.**

```sh
pnpm serve        # then open http://localhost:8731/experiments/01-css-grid/
```

```sh
pnpm install
pnpm check                                   # typecheck, lint, boundaries, format, tests
node scripts/check-recipe.mjs <file.json>    # one corpus file, ~1s
```

## What exists

| Package                                         | State                                                                                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`                                 | Model, validator, quantity parsing, authoring normaliser, **layout engine**. Zero deps, zero DOM — enforced by a lint rule, a dependency-cruiser rule, and a test that reads the manifest. |
| `packages/corpus`                               | 8 recipes, 6 valid stress fixtures, 8 invalid fixtures. All validate as intended, and all lay out under every strategy with committed golden files. |
| `packages/tokens`                               | Placeholder. Phase 03.                                                                                                                                                      |
| `packages/harness`                              | Placeholder. Phase 08.                                                                                                                                                      |
| `experiments/01-css-grid` … `04-alt-frameworks` | Package skeletons only. A cross-track import fails the boundary check — verified by introducing one, not assumed.                                                           |

The corpus covers all five source recipes plus the three edge-case additions `EDGE-CASES.md`
called for: `no-knead-bread` (E1 mostly-waiting, E2 overnight, E3 repeated folds),
`braised-short-ribs` (E1, E4 equipment contention) and `fennel-citrus-salad` (E5 garnish via a
`serve` step, no-cook, near-zero parallel saving).

## What's decided

| Decision                                                                   | Where                                 | Confidence                                    |
| -------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| Tree-first model; geometry derived, never reverse-engineered               | `GAMEPLAN.md` §2.1                    | High — the source markup has no tree in it    |
| Monorepo: pure `core` + four renderer tracks, no forking allowed           | `GAMEPLAN.md` §6                      | High — user-chosen, now structurally enforced |
| Desktop wall-chart and mobile cook mode as peers                           | `phases/PHASE-04`                     | High — user-chosen                            |
| Width cannot encode duration; time goes in-cell as a glyph                 | `findings/Q5-time-axis.md`            | High — structural argument, not taste         |
| `Effort` bucket required; precise `duration` optional                      | `packages/core/src/model.ts`          | High — held up across 8 transcriptions        |
| At-a-glance bar, fully derived from `GridPlan.timing`                      | `phases/PHASE-03`                     | High                                          |
| Raw JSON authoring plus a thin normalising layer. **No DSL.**              | `findings/Q4-authoring-ergonomics.md` | High — answered empirically, as planned       |
| Columns are **right-packed**, unconditionally — no hybrid                  | `findings/Q1-column-assignment.md`    | High — structural, and rendered               |
| Reuse defaults to a **reference chip**; node reuse is a component, not a layout case | `findings/I4-reuse.md`       | High — safety-led, and rendered               |
| Shorthand marks: `● 2m` / `◷ 30–40m`; label the exception, not the default | `phases/PHASE-03`                     | **Medium — see EDGE-CASES E1**                |

## Resolved artifacts

Sources are committed in [`../design/`](../design/) — self-contained HTML, open directly in a
browser, no build step. **Read those rather than fetching the published copies.**

| Local source                                                                   | Published                                                                        | What it is                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| [`../design/resolved-card.html`](../design/resolved-card.html)                 | [artifact](https://claude.ai/code/artifact/0e465102-73e3-4731-be14-60f22daa7df2) | **The current design.** Phase 03's visual target. |
| [`../design/q5-time-axis-variants.html`](../design/q5-time-axis-variants.html) | [artifact](https://claude.ai/code/artifact/8bedd288-18af-4b9d-a25a-5e2bd0c7b47f) | The six-variant study behind the Q5 finding.      |

The published artifacts are private to the user. To update one from a later session, pass its URL
to the `Artifact` tool as `url` — otherwise a new URL is minted instead of updating in place.

## Open questions, in priority order

1. **The SVG track needs a new justification.** I4 concluded that non-planar connectors — its stated
   differentiator — do not earn it a place in the bake-off. Decide before Phase 07 whether
   arbitrary-scale print output or a true dendrogram view replaces that rationale, or whether the
   track is cut.
2. **Q2 — does cook mode relinearize the tree?** Phase 04; the mini-map is the proposed answer.
3. **Q3 — table vs. CSS Grid substrate.** Deferred to Phase 06 by design; needs real screen readers.
   Q1 turned up evidence here: a table cannot express "nothing is here", which is part of why R1's
   stray-border complaint exists at all.
4. **Multi-component charts share no row rhythm.** Shepherd's pie renders mashed potatoes (4
   columns) above the pie (11), and the two grids align on nothing. PHASE-03 proposed `subgrid`;
   nothing has been tried.

**Resolved:** Q1 (`findings/Q1-column-assignment.md`), I4 (`findings/I4-reuse.md`),
Q4 (`findings/Q4-authoring-ergonomics.md`), Q5 (`findings/Q5-time-axis.md`),
E1 (`findings/E1-mostly-waiting.md`).

**New, and uncomfortable:** `findings/P02-parallel-saving.md`. Measured over the whole corpus, the
grid's parallel saving is **zero for five of nine components**, including the viral brownie recipe.
The format's headline claim is weak on this corpus, and Phase 03's at-a-glance bar has to render
that zero honestly rather than hide it. The brownies' zero is caused by the very implicit join
validator rule W5 flags — adding the missing `sift together` step takes the saving from 0 to 2
minutes, which is exactly the figure Q5 quoted.

Three smaller questions were opened by transcription and are recorded at the bottom of the Q4
finding: the size-adjective problem (`1 medium (110 g) onion`), `Temperature` having no
discriminant between `"med-low"` and `400°F`, and step text duplicating its own `duration`. The
mixed-attention step — "simmer 15 min, stirring occasionally" — has now appeared often enough
that EDGE-CASES' "revisit if common" condition is met; Phase 03 should answer it.

## Recommended next action

**Finish Phase 03.** The renderer works and the gate is cleared; what remains is the acceptance
list in `phases/PHASE-03`, most of which is unstarted:

Phase 03's acceptance list is now met apart from one item:

1. **A real print check.** Greyscale was verified by measuring rendered luminance and by a
   `filter: grayscale(1)` pass — both proxies. Nobody has produced a PDF and looked at it, and
   `print-color-adjust` behaviour is the kind of thing that only fails in the real pipeline.

Then **Phase 04** — the responsive ladder and cook mode. R8 is still the biggest unsolved problem
in the project: every screenshot in `images/` is a pinch-zoomed phone photo of a desktop table,
and the charts here are 1,000–2,700px wide.

Already done and not worth redoing: the leader rule is drawn from `PlacedCell.leader`; the
at-a-glance bar handles `parallelSaving: 0` by dropping the field and saying "nothing overlaps in
this recipe — the steps run in order"; check-off propagates with no JavaScript, via one generated
`:has()` rule per ingredient. Both of PHASE-03's own open questions are settled — the depth ramp
scales to `GridPlan.maxDepth` per chart, and it runs **darkest at the finished dish**.

R9 is met by capping the grid *tracks*, not the text. Capping the text inside an uncapped column
gave the worst of both: a 621px cell with its text wrapping in a 130px ribbon. With ceilings on
the tracks, `long-text.json` renders 996px wide instead of 1,749.

**Visual baselines are committed** under `experiments/01-css-grid/track01.visual.ts-snapshots/`
(19 images, 1.6 MB) and run with `pnpm test:visual` — deliberately *not* part of `pnpm check`,
because screenshot baselines are font-rendering dependent and a macOS baseline fails on a Linux
runner for reasons unrelated to the code. Playwright suffixes them by platform, so a Linux CI job
would generate its own set rather than fight over these. Regenerate with `--update-snapshots`
only when a change is *meant* to alter the rendering, and review the diff.

**Serve with `pnpm serve`,** not `python -m http.server`. The tracks have no build step and
nothing fingerprints filenames, so a plain server hands the browser a cached module or stylesheet
after every edit — this cost real time twice.

## Things a future session should not re-derive

- The CFE source markup is decoded in `GAMEPLAN.md` §2.1, including the live DOM sample. The site
  returns **403 to WebFetch and curl**; it was read via the Chrome browser tool. Don't retry curl.
- The Threads critique → requirements mapping (R1–R9) is in `GAMEPLAN.md` §2.2, with each row
  citing the specific screenshot in `images/`. The images don't need re-reading.
- **Every recipe in `images/` has been transcribed.** Don't re-read the photographs to check the
  corpus — the geometry was recovered at 2.5–4× zoom (twice, programmatically, by detecting grid
  rulings) and the judgement calls are recorded below.
- Q5's answer and its reasoning are settled. Don't re-litigate the time axis.
- Q4's answer is settled, with measurements. Don't rebuild the authoring layer as a DSL.

### Transcription decisions worth knowing about

- **Shepherd's pie, mashed potatoes component.** The source's `season to taste` cell does not
  actually span the salt and white pepper rows. Read literally, those two ingredients are consumed
  by nothing — an unrecoverable E1. Read instead as a `rowspan` bug in the 2004 HTML (the second
  table renders the same idiom correctly) and wired to consume them. This is the one place the
  corpus departs from literal cell geometry.
- **Beef stroganoff.** `simmer-beef` is a pure pass-through node consuming no new ingredient — it
  is the "return the beef to the pan" moment, and its cell being one row taller than its child's
  is what makes the grid close consistently.
- **Espresso brownies.** The four dry ingredients feed `fold in` with no `sift together` step.
  jenelope1st added one by hand; the corpus does **not**, because the source doesn't have it.
  Validator W5 flags it, which is the point.
- **Warnings in the corpus are deliberate.** The brownies' 103%-off vanilla metric pair, Shepherd's
  pie's `400°F (204°C)` / `400°F (205°C)` disagreement, and the skillet's two source typos
  ("thiny sliced", "pepperr") are all faithful. Don't fix them.

## User preferences observed

- No timelines, week numbers, or date anchors in planning docs (global instruction).
- Prefers seeing options rendered visually over described in prose — the two artifacts changed
  decisions that prose had not.
- Wants failure modes shown honestly rather than smoothed over.

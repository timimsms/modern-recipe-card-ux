# Project state — handoff

> Read this first after a context clear. Current as of the close of the Phase 07 cook-mode session.

## Where things stand

**Phases 00 through 06 are built; Phase 07 is under way.** 501 unit tests plus 157 browser tests, all green.

| Phase | State |
| --- | --- |
| 00 Foundation | Monorepo, structurally enforced boundaries, CI. |
| 01 Model & corpus | Schema, validator (E1–E8, W1–W5), 8 recipes + 14 fixtures. |
| 02 Layout engine | `layout(component, opts) → GridPlan`. Three column strategies, three reuse strategies, derived edges, groups, timing. Reproduces the 2004 source table's spans exactly. |
| 03 Design system & reference renderer | Tokens with contrast validated as a test; `experiments/01-css-grid` with no bundler and no framework; visual baselines; print verified as real PDFs. |
| 04 Responsive ladder & cook mode | All four presentations from one plan, plus the transition between them. |
| 05 Interaction & kitchen state | Headless store in core; serving-size scaling with a ladder that climbs and descends; concurrent timers that survive backgrounding; persistence, undo, wake lock, 48px check-off. |
| 07 Experiment tracks | **In progress.** All four tracks render the wall chart *and cook mode* from the same plan and the same store. Tracks 02 and 04 also do check-off and scaling. No condensed chart, timers, units or keyboard outside track 01, and no track but 01 has been audited for accessibility. |
| 06 Accessibility & semantics | Structural narrative in core, exposed as a mode; 2D keyboard movement plus edge traversal; two live regions; axe clean on every presentation; 400% zoom; forced-colors; print keeps every step region whole. Q3 answered **provisionally** — see below. |

```sh
pnpm install
pnpm check                # typecheck, lint, boundaries, format, 501 tests
pnpm serve                # then open http://localhost:8731/experiments/01-css-grid/
                          # running it twice is fine — it prints the URL and exits
pnpm test:visual          # builds tracks 02/04, then 157 browser tests + baselines
pnpm test:print           # renders the corpus to PDF and checks it survives paper (needs `pnpm serve`)
node scripts/check-recipe.mjs <file.json>
node scripts/progress-weighting.mjs      # why progress is time-weighted (R7)
node scripts/narrate.mjs --full          # the structural narrative, to read rather than trust
```

**R8 is answered.** Shepherd's pie is cookable end to end at 390px with **zero horizontal
overflow at every one of its 15 steps** and no target smaller than 48px. That was the biggest
unsolved problem in the project and the reason the format spreads as screenshots.

## What exists

| Package                                         | State                                                                                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`                                 | Model, validator, quantity parsing, authoring normaliser, **layout engine**, condense, cook schedule, **kitchen state store**, **scaling**. Zero deps, zero DOM — enforced by a lint rule, a dependency-cruiser rule, and a test that reads the manifest. |
| `packages/corpus`                               | 8 recipes, 6 valid stress fixtures, 8 invalid fixtures. All validate as intended, and all lay out under every strategy with committed golden files. |
| `packages/tokens`                               | Palette, depth ramp, spacing and type scale, with WCAG contrast checked as a test rather than by eye.                                                                        |
| `packages/harness`                              | Placeholder. Phase 08.                                                                                                                                                      |
| `experiments/01-css-grid`                       | The reference renderer, bound to the store. Four presentations, cook mode, timers, scaling, persistence. No bundler, no framework, no build step.                            |
| `experiments/02` … `04-alt-frameworks`          | Package skeletons only. A cross-track import fails the boundary check — verified by introducing one, not assumed.                                                           |

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
| [`../design/resolved-card.html`](../design/resolved-card.html)                 | | **The current design.** Phase 03's visual target. |
| [`../design/q5-time-axis-variants.html`](../design/q5-time-axis-variants.html) | | The six-variant study behind the Q5 finding.      |

The published artifacts are private to the user. To update one from a later session, pass its URL
to the `Artifact` tool as `url` — otherwise a new URL is minted instead of updating in place.

## Open questions, in priority order

1. **The SVG track needs a new justification.** I4 concluded that non-planar connectors — its stated
   differentiator — do not earn it a place in the bake-off. Decide before Phase 07 whether
   arbitrary-scale print output or a true dendrogram view replaces that rationale, or whether the
   track is cut.
2. **Q3 — table vs. CSS Grid substrate.** Deferred to Phase 06 by design; needs real screen readers.
   Q1 turned up evidence here: a table cannot express "nothing is here", which is part of why R1's
   stray-border complaint exists at all.
4. **Multi-component charts share no row rhythm.** Shepherd's pie renders mashed potatoes (4
   columns) above the pie (11), and the two grids align on nothing. PHASE-03 proposed `subgrid`;
   nothing has been tried.

**Resolved:** Q1 (`findings/Q1-column-assignment.md`), Q2 (`findings/Q2-cook-mode-honesty.md`),
I4 (`findings/I4-reuse.md`), Q4 (`findings/Q4-authoring-ergonomics.md`),
Q5 (`findings/Q5-time-axis.md`), E1 (`findings/E1-mostly-waiting.md`).

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

## Pre-publication status

The repo is prepared to go public; the strategy evaluation lives with the maintainer (open source
now, gallery-first Pages site, PR-validated recipe submissions; a hosted/private-books layer stays
possible later because core is MIT and the moat is ingestion, not code).

Done: history scrubbed of the scanned NYT PDF and third-party screenshots (`git filter-repo`;
originals preserved locally outside the repo; docs reworded to quote rather than point), MIT +
CC BY licensing in place, README rewritten against reality, private artifact links replaced with
the committed HTML, CONTRIBUTING + recipe-suggestion issue template + corpus-validation CI added.
Rewritten history is force-pushed to the still-private origin.

Before actually flipping public: **GitHub can retain force-push-orphaned objects until its own
GC runs**, so either ask GitHub support to purge them, or — simpler and certain — push the clean
history to a fresh repository and make *that* one public. Also still open: the Pages/gallery
workflow, and optionally publishing `@recipe/core` to npm.

## Recommended next action

Phase 07's own acceptance list is the best guide. Four of eight are met:

| | criterion | state |
| --- | --- | --- |
| ✓ | all tracks render every recipe and stress fixture | done |
| ✓ | zero forks of `core`, every change logged | **one** change, from track 02 |
| ✓ | track 03 renders `reuse-split` with real connectors | done |
| ✓ | `NOTES.md` per track, written during the build | done |
| ~ | full feature surface including cook mode | cook mode everywhere; see the matrix |
| ✗ | Phase 06's accessibility bar, or documented shortfall | **nothing outside track 01 audited** |
| ✗ | track 03 exports a shareable image | not started |
| ✗ | visual regression against Phase 03 baselines | each track has its own; no cross-track comparison |

Where the tracks stand:

| | chart | cook | check-off | scaling | condensed | timers | units | keyboard | a11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 CSS Grid | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 02 React | ● | ● | ● | ● | · | · | · | · | · |
| 03 SVG | ● | ● | · | · | · | · | · | · | · |
| 04 Svelte / Solid | ● | ● | ● | ● | · | · | · | · | · |

**Do the accessibility audit next.** It is the acceptance criterion with nothing done at all, the
infrastructure already exists (`experiments/01-css-grid/a11y.visual.ts` runs axe, 400% zoom and
forced-colors), and it is the one most likely to produce *findings* rather than just work. The
tracks should diverge sharply: 02 and 04 are ordinary semantic HTML and ought to start near where
track 01 does, while track 03 is a drawing whose accessibility rests almost entirely on
`role="img"` and Phase 06's narrative. That asymmetry is exactly what a scorecard should report,
and it is cheap to measure.

Then, in rough order of value per effort:

1. **The scale-change measurement.** All four tracks already emit `recipe:render` around a scale
   change — the interaction PHASE-07 calls "the sharpest test" and PHASE-08 calls the sharpest
   discriminator between reactivity models. It is instrumented and has never been read. That is
   the question track 04 exists to answer.
2. **Track 03's image export.** Small, unique to that track, and the format's actual distribution
   mechanism — the format spread as screenshots of a viral thread, which is why this project exists.
3. **Check-off and scaling in track 03**, which are the gaps that stop it being comparable on the
   feature surface.
4. **Timers and the condensed chart** everywhere else. Mechanical, and the least likely to teach
   anything.

Still carried forward, both cheap and both able to move the design:

- **Equipment contention (EDGE-CASES E4).** `Step.equipment` exists and nothing reads it. The BBQ
  pulled chicken now gives it a recipe where it matters — one Dutch oven, one oven, one measuring
  cup, all sequential.
- **Session splitting (EDGE-CASES E2).** `passive` steps mean bread and cures span days. Cook mode
  has no notion of putting a recipe down and coming back.

## What Phase 07 has shown so far

- **The plan is renderer-agnostic, and that is now evidence rather than hope.** A string builder, a
  component tree, a signal graph and a coordinate system have all consumed `GridPlan` unchanged.
  One core change requested across three new renderers: track 02's `PlacedCell` discriminated
  union, which TypeScript forced and which stated something already true.
- **The store held.** Adapters: SVG 1 line, React 2, Svelte 4, Solid 4. All four depend on the
  store handing out a fresh object on every change and the same one otherwise — a decision made in
  Phase 05 for one consumer that four now rest on.
- **Radix covers the shell, not the content.** A `ToggleGroup` for the view switcher arrives with
  its keyboard behaviour correct; the chart and mini-map use nothing, because there is no
  dependency-graph primitive. In an ordinary screen the shell is most of the app. Here it is the
  controls.
- **The mini-map is free in SVG.** Three tracks build a second thumbnail renderer; track 03 re-runs
  the same layout at a tenth the size. The one place that substrate removes work.
- **Bundles, gzipped, with cook mode:** tracks 01 and 03 ship **zero** JavaScript for a correct
  static chart; Solid 16 KB, Svelte 25 KB, React 77 KB.
- **Two process findings worth not losing.** Track 04's "identical except the framework" premise
  was false within an hour — Svelte keeps template whitespace and JSX strips it, so the same row
  rendered 3.7px wider — and only a measurement caught it; any such claim needs a test, not an eye.
  And rule 4 has a real cost: track 02 repeated a testing mistake track 01 had already fixed,
  because nothing is shared for the lesson to travel through.

Already done and not worth redoing: the leader rule is drawn from `PlacedCell.leader`; the
at-a-glance bar handles `parallelSaving: 0` by dropping the field and saying "nothing overlaps in
this recipe — the steps run in order"; check-off propagates with no JavaScript, via one generated
`:has()` rule per ingredient. Both of PHASE-03's own open questions are settled — the depth ramp
scales to `GridPlan.maxDepth` per chart, and it runs **darkest at the finished dish**.

R9 is met by capping the grid *tracks*, not the text. Capping the text inside an uncapped column
gave the worst of both: a 621px cell with its text wrapping in a 130px ribbon. With ceilings on
the tracks, `long-text.json` renders 996px wide instead of 1,749.

**All four ladder rungs exist**, from one unmodified plan: wall chart, condensed chart
(shepherd's pie 11 → 6 columns, collapsed runs rendered as a stack so each sub-step still sits
beside the ingredient it consumes), ingredient-led, and cook mode. Tapping a step cell expands it
into its cook-mode card; check-off is one model behind all of them.

**Visual baselines are committed** under `experiments/01-css-grid/track01.visual.ts-snapshots/`
and run with `pnpm test:visual` — deliberately *not* part of `pnpm check`,
because screenshot baselines are font-rendering dependent and a macOS baseline fails on a Linux
runner for reasons unrelated to the code. Playwright suffixes them by platform, so a Linux CI job
would generate its own set rather than fight over these. Regenerate with `--update-snapshots`
only when a change is *meant* to alter the rendering, and review the diff.

**The controls are in the URL.** `?recipe=bbq-pulled-chicken&view=cook` opens straight into cook
mode on that recipe, and the address bar tracks whatever you change, so a view can be linked to
rather than described. Only non-default values are written, the recipe takes a bare slug, and
`theme` is deliberately excluded — it is seeded from the viewer's OS preference, and a shared link
should not impose the sender's.

**Serve with `pnpm serve`,** not `python -m http.server`. The tracks have no build step and
nothing fingerprints filenames, so a plain server hands the browser a cached module or stylesheet
after every edit — this cost real time twice.

## Things a future session should not re-derive

- The CFE source markup is decoded in `GAMEPLAN.md` §2.1, including the live DOM sample. The site
  returns **403 to WebFetch and curl**; it was read via the Chrome browser tool. Don't retry curl.
- The Threads critique → requirements mapping (R1–R9) is in `GAMEPLAN.md` §2.2, with each row
  citing the specific source screenshot. The images were reviewed during planning and are not
  distributed in the repo; GAMEPLAN §2.2 preserves their substance.
- **Every recipe from the source screenshots has been transcribed.** Don't re-read them to check the
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

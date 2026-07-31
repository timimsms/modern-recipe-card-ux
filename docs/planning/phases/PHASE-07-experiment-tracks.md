# Phase 07 — Experiment Tracks

> The same `GridPlan`, rendered four ways. This is the experiment the repo is named for.

## Goal

Three additional implementations meeting the standard set by Phases 03–06, built independently
enough to be compared fairly and constrained enough that the comparison means something.

## Why here

Tracks 02–04 are independent of one another and can proceed in parallel once the reference
renderer has settled the requirements. Building them earlier would mean chasing a moving target;
building them later would leave no room to feed findings back.

## The rules

Non-negotiable, or Phase 08 measures nothing:

1. **No track may fork `core`.** Not the model, not the layout engine, not the store. If a track
   needs something core doesn't expose, it lands in core and every track gets it — and the
   request itself is recorded as a finding.
2. **Same corpus, same requirements.** Every track renders all five recipes and all stress
   fixtures, and meets R1–R9 plus Phase 06's accessibility bar.
3. **Same feature surface.** Wall chart, condensed chart, cook mode, check-off, scaling, timers.
   A track that skips cook mode isn't comparable.
4. **Tracks may not import each other.** Enforced by the Phase 00 boundary lint.
5. **Idiomatic within the track.** Use each stack the way its community actually would. A React
   track that avoids hooks to look like the vanilla track teaches nothing.
6. **Instrument from the start.** Phase 08's harness hooks are added as each track is built,
   not retrofitted.

## Track 02 — React + Tailwind + shadcn/ui

The mainstream production stack, and the baseline most teams would actually reach for.

- React with `useSyncExternalStore` binding to the core store.
- Tailwind, with `packages/tokens` as the theme source — not a parallel set of values. Getting
  design tokens into Tailwind's config cleanly is itself part of what's being evaluated.
- shadcn/ui + Radix primitives for the interactive shell: dialogs, sheets (cook mode on mobile),
  toggle groups (unit system), sliders (scaling), toasts (timers).
- **Key question:** do Radix's accessibility primitives handle the Phase 06 requirements better
  than hand-rolled ARIA, or does the grid's unusual 2D structure fall outside what they cover?
  Radix has no "dependency graph" primitive. Where does the component library stop helping?
- **Second question:** does shadcn's copy-in-source model help or hurt when the components need
  substantial modification for a non-standard layout?

## Track 03 — SVG / Canvas dendrogram

Treat it as a diagram-layout problem rather than a document-layout problem.

- Render the plan as an actual dendrogram with real drawn edges.
- **Owns the non-planar case.** This is the only track that can render `reuse-split.json` with a
  genuine connector from one ingredient to two distant steps (**I4**), because it isn't confined
  to a grid. That capability is the track's reason for existing — lead with it.
- Evaluate d3 (`d3-hierarchy` for layout, though our plan already handles placement) versus
  hand-rolled geometry. Likely finding: d3's layout is redundant given `core`, and only its
  path/curve utilities earn their weight.
- **Text is the hard part.** SVG has no text wrapping. Options: `<foreignObject>` (patchy print
  and a11y), manual measurement and `<tspan>` line-breaking, or hybrid HTML-over-SVG. This is
  the track's central cost and needs honest reporting.
- **Accessibility is the second hard part.** SVG accessibility is genuinely difficult; Phase 06's
  structural narrative may carry disproportionate weight here.
- Canvas variant for the Phase 04 mini-map specifically, where hundreds of tiny regions render
  and text isn't drawn at all — likely SVG's clearest win.
- Free benefits worth measuring: infinite zoom without reflow, trivially exportable to a shareable
  image (which is *how this format actually spreads* — see `images/`).

## Track 04 — Alt frameworks: Svelte / Solid / Vue

Same renderer design across three reactive frameworks, isolating authoring ergonomics and
runtime cost.

- Deliberately keep the visual output identical to track 01 so differences are attributable to
  the framework, not to design choices.
- Measure: store adapter size, component LOC, bundle size, update cost when scale changes and
  every quantity in the chart re-renders.
- **The scaling interaction is the sharpest test.** Changing serving size touches every quantity
  cell simultaneously — a fine-grained-reactivity showcase (Solid, Svelte 5 runes) versus VDOM
  diffing. Instrument it specifically.
- Scope control: if all three prove more than the finding is worth, ship Svelte and Solid — they
  bracket the interesting axis — and record Vue as unexplored rather than half-done.

## Cross-track deliverables

- Per-track `NOTES.md`: what was easy, what fought back, what had to be worked around, what
  core changes were requested. Written *during* the build. Retrospective notes are fiction.
- Harness instrumentation wired into each track.
- Identical Playwright visual-regression suites, scored against Phase 03 baselines.

## Acceptance criteria

- [ ] All three tracks render all five corpus recipes and all stress fixtures.
- [ ] All three implement the full feature surface, including cook mode.
- [ ] All three meet Phase 06's accessibility bar, or document precisely where and why they fall short.
- [ ] Zero forks of `core`; every core change benefits all tracks and is logged.
- [ ] Track 03 renders `reuse-split.json` with real connectors.
- [ ] Track 03 exports a shareable image of any recipe.
- [ ] Visual regression against Phase 03 baselines within an agreed tolerance.
- [ ] `NOTES.md` complete for each track.

## Out of scope

Scoring and synthesis — Phase 08.

## Open questions

- Should there be a fifth track for a "no-JS, server-rendered" approach (Astro, or plain
  server-side templating)? The static chart genuinely doesn't need JavaScript, and proving that
  would be a strong result. Add only if the first four land cleanly.
- Is a native/RN track worth it given R8's mobile emphasis? Probably out of scope for a frontend
  library experiment, but worth naming as the obvious follow-on.

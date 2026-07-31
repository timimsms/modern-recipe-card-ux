# Phase 06 — Accessibility & Semantics

> A 2D dependency diagram has no natural reading order. Solving that is the interesting part.

## Goal

Make the convergence grid genuinely usable non-visually — conveying not just the procedure but
the *parallelism*, which is the whole point — and settle the substrate question (**Q3**) with
evidence from real assistive tech.

## Why here

It needs a real renderer to audit. But it is explicitly **not** a rubber stamp: its findings
will push changes back into Phase 02 (the plan may need to emit richer linearization metadata)
and Phase 03 (the substrate may need to change). Budget for that backflow. Scheduling this
phase late is a dependency decision, not a priority statement.

## The core problem

A numbered list has an obvious reading order. A tree does not. A screen reader moving through
the grid linearly encounters a step cell *before* it has heard all the inputs feeding it, and
a cell with `rowspan="3"` announced once at the top gives no indication that it also governs
the next two rows.

Worse, the format's central value — "these things happen in parallel, then converge" — is
carried entirely by geometry. Geometry is not available. **Restating that structure in language
is the actual deliverable of this phase**, and it's a design problem, not a compliance checklist.

## Deliverables

### Substrate decision (Q3)

Build the reference chart on both substrates and test with real screen readers:

- **`<table>` with `rowspan`/`colspan`** — assistive tech has decades of table-navigation support.
  Users can move cell-to-cell, query row/column headers, and hear span relationships announced natively.
- **CSS Grid + ARIA** — full visual control, but every relationship must be asserted manually,
  and ARIA grid patterns are inconsistently implemented.

Test matrix: VoiceOver/macOS+Safari, VoiceOver/iOS+Safari, NVDA+Firefox, JAWS+Chrome.
**Axe passing is table stakes and proves almost nothing here** — the failure mode is a chart
that's technically conformant and completely incomprehensible. The real test is whether someone
can answer "what goes into the fold-in step?" and "what can I do while the brownies bake?"

Record the verdict and the reasoning in `docs/findings/`. If tables win, Phase 03's contained
DOM-emitting module gets swapped — which is why it was contained.

### Structural narrative

An alternate, non-visual presentation generated from the `GridPlan`:

- A prose summary of the tree: *"Nine ingredients converge in four stages. The wet ingredients
  — butter, sugar, vanilla, espresso — mix first; the dry ingredients sift together separately;
  the two are folded in and baked."*
- Per-step announcements naming inputs explicitly: *"Fold in. Takes: the mixed wet ingredients,
  the sifted dry ingredients. Produces: the batter."* This is where Phase 04's `outputName`
  pays off a second time.
- Explicit parallelism callouts: *"While this bakes for 30 to 40 minutes, nothing else is pending."*
  or *"Two branches are ready: dice the vegetables, or brown the beef."*

This is not a fallback. It is arguably a *better* interface for the format's core insight than
the chart, and it should be available to everyone — a "read it to me" mode, useful when your
hands are covered in flour.

### Keyboard navigation

- 2D arrow-key movement through the chart, mirroring the spatial structure.
- Jump-to-inputs and jump-to-consumer — traverse the tree along edges, not just the grid.
- Visible focus that respects the plan's region boundaries.
- Full cook-mode operation from the keyboard.

### Announcements & live regions

- Timer completion via a polite live region; expiry via assertive.
- Check-off confirmed with the resulting state, not just the action.
- Presentation changes across the Phase 04 ladder announced, so the layout doesn't silently
  change underneath a screen-reader user.

### Print & PDF

- Print stylesheet validated against **R5**'s non-color redundancy.
- Page-break rules that never split a step region across pages.
- A wide-chart strategy: rotate to landscape, or split by component.

### Other

- Reduced-motion honored throughout, especially Phase 04's FLIP transition.
- Forced-colors / Windows High Contrast: region fills must not be the only encoding.
- Zoom to 400% without loss of function (WCAG 1.4.10) — genuinely hard for a wide chart and a
  good forcing function for the Phase 04 ladder.

## Acceptance criteria

- [ ] Substrate decision made from real screen-reader testing, documented with reasoning.
- [ ] A screen-reader user can answer "what feeds this step?" and "what can I start now?" on
      every corpus recipe.
- [ ] Structural narrative generated for all corpus recipes and exposed as a user-facing mode.
- [ ] Full keyboard operation of chart and cook mode, including edge traversal.
- [ ] axe clean across all presentations (necessary, not sufficient).
- [ ] 400% zoom remains functional.
- [ ] Forced-colors mode preserves all encodings.
- [ ] Print output of `shepherds-pie` is legible and unsplit in greyscale.
- [ ] Any resulting changes to `core` are landed and re-goldened, not deferred.

## Out of scope

Auditing tracks 02–04 — they're built in Phase 07 against the standard set here, and scored in Phase 08.

## Open questions

- Does the structural narrative need authored prose hooks in the model, or is generation from
  `technique` + `outputName` + tree shape sufficient? Try generated first; the corpus will show
  where it reads robotically.
- Should the narrative be a separate mode or always present as visually-hidden text alongside the
  chart? Always-present is simpler and helps more people, but risks verbose double-announcement
  of content already in the DOM.

# Phase 04 — Responsive Ladder & Cook Mode

> The highest-value phase. Every screenshot in `images/` is a pinch-zoomed phone photo of a
> desktop table — that is the unsolved problem.

## Goal

Two peer presentations from one `GridPlan` — a desktop wall-chart and a mobile cook mode —
plus a deliberate, designed transition between them that preserves the user's spatial
understanding rather than teleporting them into a different artifact.

## Why here

R8 is the requirement with the most latent value and the least prior art. CFE has existed for
two decades and nobody has solved it; the format spreads as screenshots precisely because the
real thing doesn't survive contact with a phone.

The trap is obvious and worth naming up front: **the easy mobile answer is to relinearize into
a numbered list, which throws away the entire reason this format exists.** A numbered list is
not a solution. It is a surrender.

## The ladder

Four presentations, container-query driven, sharing one plan.

### 1. Wall chart (wide)

Phase 03's output, unchanged. Full grid, all parallelism visible at once.

### 2. Condensed chart (medium)

The grid survives, but deep single-child chains collapse. A run like
`heat → med-low until tender` becomes one cell containing a stacked micro-list, expandable in
place. Uses the plan's `criticalPath` to decide what stays expanded: the long pole keeps its
resolution, side branches condense first. Shepherd's pie goes from ~11 columns to ~6 without
losing a single merge point.

### 3. Ingredient-led (narrow, browsing)

Ingredient column becomes the spine at full width. Each ingredient row carries an inline
indicator of which step consumes it and how deep into the recipe that is. This is the
"what do I need to buy / do I have this" mode, not the cooking mode.

### 4. Cook mode (narrow, cooking)

One step at a time, and this is where the design problem actually lives.

**Each cook-mode card shows:**

- The step text, large — readable from arm's length with a phone propped against a canister.
- Its direct inputs, resolved: the actual ingredient rows it consumes, with quantities, and
  the named outputs of prior steps ("the browned beef", "the sifted dry ingredients"). Naming
  intermediate outputs is a genuine improvement over the original, which leaves them anonymous.
- **A mini-map** — the full `GridPlan` rendered tiny, with the current node highlighted and
  completed regions filled. This is the load-bearing element: it is what keeps cook mode from
  being a numbered list. The user always sees where they are in the tree.
- **A parallelism banner** — "while this simmers, you can: dice the onion." Derived from the
  plan by finding steps with no unmet dependencies that aren't on the current path. **This is
  the format's central insight, delivered actively rather than left for the user to infer from
  geometry.** Arguably it's better than the desktop chart at this one job.
- Its `duration`, wired to Phase 05's timers.

**Ordering.** Cook mode needs *a* sequence, but `linearization` from Phase 02 gives many valid
ones. Prefer the order that minimizes idle time — schedule long-duration steps early so their
waits overlap other work. That's a small scheduling problem over the tree, and it makes cook
mode genuinely smarter than reading the chart top-to-bottom.

## The transition (its own design problem)

Moving between wall chart and cook mode must preserve context.

- **Shared-element / FLIP animation.** Tapping a step cell in the chart expands *that cell* into
  the cook-mode card. Backing out collapses it to the same position. The user never loses their place.
- **The mini-map is the anchor.** It is a literal scaled copy of the chart the user came from,
  so the mapping between the two presentations is visible rather than asserted.
- **State is shared, not duplicated.** Checking off in cook mode fills the same regions in the
  chart. One model, two views.
- **Respect `prefers-reduced-motion`** with a cross-fade that keeps the positional relationship.

## Deliverables

- Container-query breakpoint ladder with all four presentations in track 01.
- Chain-collapse algorithm consuming `criticalPath`.
- Cook mode: card, resolved inputs, mini-map, parallelism banner.
- Intermediate-output naming — authored in the model (Phase 01 addendum: optional `Step.outputName`)
  with a generated fallback derived from `technique` + inputs.
- Idle-minimizing step scheduler over `linearization`.
- FLIP transition, with reduced-motion path.
- Landscape handling — a phone on its side in a kitchen is common and the chart may actually fit.

## Technical notes

**Container queries, not media queries.** The mode should depend on the space the card has, not
the viewport, so a card embedded in a sidebar behaves correctly.

**Mini-map rendering.** At mini-map scale, text is illegible and shouldn't be attempted — render
region fills and the current-node highlight only. This is a case where the SVG track (Phase 07)
may have a real advantage; note it for the bake-off.

**Q5 — the time axis. Provisionally resolved before this phase begins; see
[`../../findings/Q5-time-axis.md`](../../findings/Q5-time-axis.md).** Column width *cannot* encode
duration — a column is shared by every parallel branch at that depth, so it can carry only one
width, and the horizontal axis is already fully committed to dependency. Time lives inside the
cell as a glyph: a duration bar scaled to the recipe's longest step, with attended vs. unattended
as solid vs. hatched fill.

The prototyping budget originally reserved here is freed — spend it on the mini-map, which is the
riskier unknown. The `long-unattended` effort bucket added to the Phase 01 schema is what the
parallelism banner keys off; it's the difference between "this takes a while" and "you can leave."

## Acceptance criteria

- [ ] Shepherd's pie is cookable end-to-end on a 390px viewport with **zero pinch-zoom**.
- [ ] All four presentations derive from one unmodified `GridPlan`.
- [ ] Cook mode's parallelism banner is correct on every corpus recipe — verified against the
      plan, not eyeballed.
- [ ] The mini-map correctly highlights position and completion at every step.
- [ ] Chart ↔ cook mode transition preserves the tapped cell's identity.
- [ ] Check-off state is consistent across presentations.
- [ ] Reduced-motion path implemented and tested.
- [ ] A written verdict on **Q2** (does cook mode preserve parallelism honestly?) and **Q5**
      (does a time axis help?), with evidence.

## Out of scope

Timers, scaling, unit toggling, persistence — Phase 05. Cook mode surfaces `duration` here;
counting it down comes next.

## Open questions

- Should cook mode allow free navigation to any ready step, or enforce a suggested order?
  Free navigation is more honest about the tree; a suggested order is easier when your hands are full.
  Proposal: suggested order with visible, one-tap access to any other ready step.
- Does the ingredient-led presentation earn its place, or is it a shopping-list feature wearing
  a layout costume? Cut it if Phase 08 shows nobody uses it.

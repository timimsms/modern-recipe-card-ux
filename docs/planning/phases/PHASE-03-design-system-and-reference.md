# Phase 03 — Design System & Reference Renderer

> Tokens plus `experiments/01-css-grid`: the wall-chart that resolves R1–R7, built with no
> framework at all.

## Goal

Prove that a `GridPlan` renders into a beautiful, legible convergence grid using nothing but
HTML and CSS — and in doing so, fix every complaint from the Threads audit. This becomes the
visual reference all other tracks are compared against.

## Why here

Doing the design system inside the most constrained track keeps it honest. If the tokens only
work when there's a component library underneath, they aren't tokens. Starting frameworkless
also gives the bake-off a genuine floor: whatever tracks 02–04 add, they have to beat *this*.

**Coupling warning:** sketch Phase 04's cook mode on paper before finalizing tokens here.
Type scale and spacing chosen purely for a 1400px wall-chart will not survive the drop to a
390px phone, and discovering that in Phase 04 means redoing this work.

## Deliverables

### `packages/tokens`

- **Color.** A neutral surface ramp plus a group-encoding palette for R5. Constraints: every
  pair used for text-on-fill meets WCAG AA; the group palette is distinguishable under
  deuteranopia and protanopia; and it degrades to a single hue in print. Ship the palette with
  a contrast-validation test, not a promise.
- **Rule weights.** Four steps mapping to `Edge` from Phase 02: `none`, `hairline`, `rule`,
  `heavy`. jenelope1st's "heavier lines to group the ingredients" (**R4**) is literally this token.
- **Type.** A scale for ingredient text, step text, prelude, and component titles.
  **Tabular figures on, always** — quantities in a vertical column that don't align are the
  kind of detail this project exists to get right (**R6**).
- **Space.** Cell padding, grid gap, and a measure ceiling for step text.

### Typographic rules (R6)

Encoded in a `formatQuantity` / `formatTemperature` utility in `core`, not left to renderers:

- `350°F` — no space before the degree symbol, no space between symbol and scale letter.
- `350°F / 176°C` — slash-separated, equal weight. **No parentheses.** This is jenelope1st's
  point that parentheses demote Celsius to a footnote.
- Unicode fractions (`½`, `¼`, `⅓`) where they exist; `1½` not `1-1/2`.
- Non-breaking space between quantity and unit; never break `4 oz` across lines.
- Ranges with an en dash: `30–40 min`.

### At-a-glance bar

A horizontal summary strip between the card title and the chart, rendering `GridPlan.timing`
plus counts. **Design resolved — see [`../../findings/Q5-time-axis.md`](../../findings/Q5-time-axis.md)
and the [reference rendering](https://claude.ai/code/artifact/0e465102-73e3-4731-be14-60f22daa7df2).**

Fields: servings · ingredients · steps · start to finish · hands-on · longest walk-away ·
saved in parallel. Only `servings` is authored; everything else is derived, so the component
costs no additional data entry.

Two rules:

- **`start to finish` is the critical path, not the sum.** Summing step durations is the standard
  error on recipe sites and it inflates the number by exactly the amount the convergence grid was
  invented to save.
- **Omit rather than estimate.** When `timing.complete` is false, drop the time fields and keep the
  counts. A fabricated figure here will be trusted.

`saved in parallel` is the format arguing for itself in a single number — and it is usefully
self-critical: brownies save ~2 minutes, shepherd's pie ~22. A near-zero value means the recipe is
effectively linear, which Phase 04's cook mode can act on by simply stepping in order.

### `experiments/01-css-grid`

Vanilla ESM, no bundler, no framework. Consumes `GridPlan` and emits DOM.

**Layout technique.** CSS Grid with explicit `grid-row: span N` / `grid-column: span N` from
the plan. Evaluate `subgrid` for aligning ingredient rows across components in a multi-component
recipe like Shepherd's pie — where the mashed-potatoes table and the main table should share a
row rhythm. Container queries, not media queries, so a card is composable.

**How each requirement is met:**

| Req | Implementation |
| --- | --- |
| **R1** stray borders | Borders come *only* from `cell.edges`. No `border-collapse`, no inherited rules. Filler cells render as genuinely empty grid areas. |
| **R2** eye path | `align-content: end; justify-content: end` per the plan's `anchor`. Every step's text sits bottom-right of its region, so scanning down the chart follows a predictable diagonal. |
| **R3** missing steps | Already impossible — Phase 01's E1 makes it a build error. |
| **R4** grouping | `heavy` edges bound each `PlacedGroup`; ingredient runs get a shared left rule tying them to their consuming step. |
| **R5** color coding | Group fill from the palette, ramped by `depth`, **plus** rule weight and an optional technique label. Passes the "print it in greyscale" test. |
| **R6** typography | Tokens + the `format*` utilities above. |
| **R7** check-off | Per-ingredient checkbox in column 0; checking one dims its row and advances a fill across the regions it feeds — the animated version of what `IMG_4230` did statically in a spreadsheet. |
| **R9** measure | Column widths from `minmax()` with a max measure ceiling; long step text wraps within its region rather than forcing the column wide. Validated against `long-text.json`. |

### Visual regression

Playwright screenshots of every corpus recipe at a fixed desktop width, committed as baselines.
These become the fidelity reference that Phase 08 scores other tracks against.

## Technical notes

**Grid, not table, for the reference.** But **Q3** is still open — Phase 06 will test whether
this decision hurts screen-reader users enough to reverse it. Keep the DOM-emitting code in one
module so swapping the substrate is a contained change rather than a rewrite.

**Filler cells should not exist in the DOM.** CSS Grid places by coordinate, so the plan's
`filler` cells can simply be skipped. This is a structural advantage over the original `<table>`,
where filler `<td>`s had to exist and be neutralized with `righthide` — which is *why* the stray
lines appeared in the first place.

**Print stylesheet now, not later.** People print recipes. It's also a free forcing function
for R5's non-color redundancy.

## Acceptance criteria

- [ ] Track 01 runs from a static file server with no build step.
- [ ] At-a-glance bar renders for every corpus recipe, with `start to finish` verified as the
      critical path against a hand-computed value — not the sum.
- [ ] At-a-glance bar degrades to counts-only when duration data is incomplete.
- [ ] All five corpus recipes render, screenshot-compared against `images/` for structural fidelity.
- [ ] `espresso-brownies` visibly resolves R1, R2, R4, R5, and R6 relative to `IMG_4225`.
- [ ] Greyscale print output remains fully interpretable.
- [ ] Palette passes automated contrast checks and a simulated color-vision-deficiency check.
- [ ] `long-text.json` does not blow out column widths.
- [ ] Checking an ingredient propagates fill through its dependent regions.
- [ ] Zero JavaScript required for the static chart to be correct — JS only adds check-off.

## Out of scope

Responsive behavior below the wall-chart breakpoint, and all kitchen interactions beyond
check-off. Phases 04 and 05.

## Open questions

- Does `subgrid` have sufficient support for the multi-component alignment case, or is a
  shared explicit row template needed? Fallback should be decided here, not discovered later.
- Should depth-ramped fill get *lighter* or *darker* toward the root? Lighter-toward-root
  reads as "converging toward finished"; darker reads as "accumulating." Try both on
  `shepherds-pie`, which is deep enough for the difference to matter.

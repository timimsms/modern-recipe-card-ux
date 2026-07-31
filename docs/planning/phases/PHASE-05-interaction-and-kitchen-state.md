# Phase 05 — Interaction & Kitchen State

> Everything that makes the card usable by someone actually cooking, with one hand and a
> timer already running.

## Goal

A shared, framework-agnostic state layer plus the interactions that turn a static diagram into
a cooking instrument.

## Why here

These features are cross-cutting: scaling changes rendered quantities in every presentation,
check-off state must be consistent across the ladder from Phase 04, and every experiment track
in Phase 07 needs the same behavior to be comparable. Building it once as a headless store
keeps tracks from each reinventing it — and keeps the bake-off measuring rendering rather than
someone's state-management taste.

## Deliverables

### `packages/core/src/state.ts` — headless store

A minimal observable store with no framework dependency. Tracks:

```ts
type CookState = {
  checkedIngredients: Set<IngredientId>
  completedSteps: Set<StepId>
  currentStep: StepId | null
  scale: number                    // 1 = as authored
  unitSystem: 'imperial' | 'metric' | 'both'
  timers: Record<StepId, Timer>
}
```

Derived selectors, computed from the state plus the `GridPlan`:

- `readySteps` — steps whose inputs are all complete. Drives Phase 04's parallelism banner.
- `regionFill` — how much of each `PlacedGroup` is complete. Drives R7's progressive fill.
- `progress` — overall completion, weighted by the critical path rather than by step count,
  so a 40-minute bake doesn't read as "one step remaining, nearly done."

Each track adapts this with a thin binding (`useSyncExternalStore`, a Svelte store contract,
a Vue ref). **The adapter is a handful of lines. If a track's adapter grows large, that's a
finding for Phase 08.**

### Serving-size scaling

- Scale quantities from the structured `Quantity` model (Phase 01's reason for existing).
- **Round intelligently.** `1½ tsp × 3` should render `1 Tbs + 1½ tsp`, not `4.5 tsp`.
  Unit-laddering per measurement system, with a table of sane kitchen increments.
- **Do not scale everything.** Pan sizes, temperatures, and many durations don't scale linearly,
  and "1 pinch" doesn't triple. Mark scalable quantities explicitly in the model; flag steps
  containing an unscalable dimension with a note rather than silently lying.
- Common presets (½×, 2×, 3×) plus arbitrary input.

### Unit system toggle

Imperial / metric / both, honoring **R6** parity. `both` is the authored default since that's
what the sources do. Uses the *authored* metric pair (Phase 01) rather than converting.

### Timers

- Start from a step's `duration`, one per step, running concurrently — the whole point of a
  parallel recipe format.
- Visible in cook mode, and as a badge on the chart cell so a glance at the wall-chart shows
  what's running.
- Notification on completion where permitted; audible fallback. Assume the screen is off or
  the user is across the room.
- Ranges (`30–40 min`) alert at the low end and keep counting to the high end.

### Kitchen affordances

- **Screen Wake Lock** while in cook mode. Non-negotiable — a screen that sleeps mid-recipe is
  the single most common phone-in-kitchen complaint.
- **Large touch targets** — 48px minimum, generous on check-off, which is the most-used control.
- **No hover-dependent affordances anywhere.** Nothing that only reveals on hover may be
  necessary to complete a recipe.
- **Persistence** to `localStorage`, keyed by recipe, so closing the app mid-cook doesn't lose
  progress. Include a "start over" that's deliberate rather than easy to hit accidentally.
- **Undo for check-off.** Wet fingers mis-tap constantly.

## Technical notes

**Store stays in `core`.** It's pure logic over the plan, has no DOM dependency, and belongs
behind the same boundary as the layout engine.

**Scaling is a rendering-time transform, not a mutation.** Never modify corpus data. The store
holds a scale factor; formatters apply it. This keeps scale reversible and shareable.

**Timer accuracy.** Use timestamps and compute remaining time on each tick, never accumulate
`setInterval` drift. Timers must survive backgrounding — a 40-minute bake will absolutely be
backgrounded.

**Rounding needs tests with real examples.** Pull the awkward cases straight from the corpus:
`1-1/2 lb` at 0.5×, `1/4 tsp` at 3×, `1 shot (4 Tbs; 60 mL)` at 2×.

## Acceptance criteria

- [ ] Store is framework-free and lives in `core` with no added dependencies.
- [ ] Every track binds it in under ~20 lines.
- [ ] Scaling `espresso-brownies` to 2× and 0.5× produces quantities a cook would actually
      write, verified against a hand-computed table.
- [ ] Unscalable dimensions (pan size, temperature) are flagged, not silently scaled.
- [ ] Concurrent timers run correctly and survive a backgrounded tab.
- [ ] Wake lock holds throughout cook mode and releases on exit.
- [ ] Progress reflects time-weighting, not step count.
- [ ] State persists across reload and is consistent across all four presentations.
- [ ] Every interaction is reachable and completable one-handed on a phone.

## Out of scope

Accessibility of these controls — Phase 06 audits them. Build to the obvious standard here;
verify there.

## Open questions

- Should completing a step auto-check its input ingredients, or are those independent gestures?
  They mean different things ("I have it out" vs "I've used it"), but two check systems may be
  more ceremony than anyone wants. Prototype both.
- Do timers belong in the shared store, or does their side-effectful nature (notifications,
  wake lock) argue for keeping them in a per-track layer? Leaning shared, with effects injected.

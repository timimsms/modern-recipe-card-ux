# Track 02 — React + Tailwind + shadcn/ui

> Written during the build, per PHASE-07. The parts that make the track look worse are here too.

## Where it is

Wall chart, check-off and serving-size scaling, over all nine recipes and all six valid fixtures.
No cook mode, condensed chart, timers, units toggle, or keyboard navigation yet.

**No shadcn/ui or Radix component is used yet, and that is a finding rather than an omission.** A
wall chart is a grid of divs and labels. Nothing in it is a dialog, a sheet, a toggle group, a
slider or a toast — which are exactly the primitives the phase doc lists shadcn for. The component
library has had no opportunity to help, because the hardest thing this track has rendered so far
is a `<label>` wrapping a checkbox. That answers the doc's "where does the component library stop
helping?" from an unexpected direction: it has not started yet, and the chart is most of the
design.

## The number

```
dist/assets/index-*.js    207.80 kB │ gzip: 66.73 kB
dist/assets/index-*.css    13.91 kB │ gzip:  3.33 kB
```

Track 01 ships **zero** bytes of JavaScript for a static, correct chart. That is the comparison
Phase 08 exists to make, and it is worth stating before any of the ergonomics: this track is 67 KB
gzipped ahead on the scoreboard before it renders anything, and it currently does *less*.

It is also the first thing in the repo that needs building at all. Tracks 01 and 03 are served
from source; this one does not exist until `vite build` has run, which is why `pnpm test:visual`
now builds first.

## What was easy

**The plan is genuinely renderer-agnostic.** `GridPlan` came straight over: rows, columns, spans
and depth map onto `grid-area` and a class in a couple of lines each. Nothing about the plan
assumes a string builder, which was not obvious until a second consumer with a completely
different programming model used it unchanged.

**The tokens bridge is a non-event on Tailwind v4, which is the interesting part.** The phase doc
flags "getting design tokens into Tailwind's config cleanly is itself part of what's being
evaluated". The answer is one line per token:

```css
@import '../../../packages/tokens/tokens.css';

@theme {
  --color-ink: var(--ink);
  --color-rule: var(--rule);
}
```

The values stay *references*. `text-ink` compiles to `color: var(--color-ink)`, which resolves to
`var(--ink)`, which `tokens.css` switches by theme — so a theme change moves the utility colours
and a token change in `packages/tokens` reaches this track without anyone editing it. There is no
parallel set of values to drift. On v3 this would have been a `tailwind.config.js` mapping to the
same `var()`s: the same idea with more ceremony. There is a test that switches theme and asserts
the *computed* utility colours move, because a bridge that copied values instead of referencing
them would look identical until someone changed a token.

## What fought back

### TypeScript found a modelling looseness the JavaScript tracks had been living with

`PlacedCell.ref` was optional, because a filler cell genuinely has no reference. Tracks 01 and 03
are JavaScript and never noticed; this track could not index `component.steps[cell.ref]` without a
cast.

The right fix was not a cast. `PlacedCell` is now a discriminated union on `kind`, so `ref` is
required for ingredients and steps and absent for filler — which states what was already true.
**First core change of Phase 07, requested by this track, and every track gets it.** It also
tightened `duplicate` onto the ingredient arm, where it was always the only meaningful place for
it.

This is the argument for having a typed track at all, and it arrived within an hour of starting.

### The helper that hides the controls also hides the controls

The screenshot helper hid the control bar and the behavioural tests then timed out for thirty
seconds each trying to change a `<select>` inside it. Two helpers now — `open()` for driving,
`show()` for photographing.

Worth recording because **this is the second time**: track 01 made the identical mistake and it
was fixed there weeks ago. The lesson did not transfer, because there is nothing shared between
the tracks' test suites for it to transfer *through* — which is a direct consequence of rule 4,
and a real cost of the no-sharing constraint rather than an argument against it.

## Still unknown

- Cook mode, and with it the first genuine use for Radix. The doc's real question — do Radix
  primitives cover a 2D dependency grid — cannot be answered until something needs a dialog.
- Accessibility: unaudited. The chart is plain semantic HTML, so it should start from roughly
  where track 01 does, but nothing has been checked.
- Update cost on a scale change is instrumented (`recipe:render` around `setScale`) but not yet
  measured against anything.

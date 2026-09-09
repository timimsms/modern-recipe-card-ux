# Track 02 — React + Tailwind + shadcn/ui

> Written during the build, per PHASE-07. The parts that make the track look worse are here too.

## Where it is

Wall chart, cook mode, check-off and serving-size scaling, over all nine recipes and all six valid
fixtures. No condensed chart, timers, units toggle, or keyboard navigation yet.

The store adapter is `useSyncExternalStore(store.subscribe, store.get)` — two lines, against
PHASE-05's "handful". It works only because the core store hands out a fresh object on every
change and the same one otherwise; a getter that allocated would loop forever here. Three
adapters now rest on that guarantee.

**One Radix primitive is now used, and where it stops helping is the finding.**

The view switcher is a `ToggleGroup` — roving tabindex, roles and keyboard behaviour for free, and
exactly the sort of thing the library exists for. The chart and the mini-map use nothing, because
there is no dependency-graph primitive and never will be. So the answer to the doc's question is
shaped like this: **Radix covers the shell, not the content.** In an ordinary CRUD screen the
shell is most of the app; here it is the controls, and the part carrying the format's meaning is
hand-built either way.

Written before cook mode existed, and still true of the wall chart on its own: a wall chart is a
grid of divs and labels, and nothing in it is a dialog, a sheet, a toggle group, a slider or a
toast — which are exactly the primitives the phase doc lists shadcn for. Cook mode added a
switcher and therefore a use; it did not add a use for the parts that matter.

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

- Accessibility: unaudited. The chart is plain semantic HTML, so it should start from roughly
  where track 01 does, but nothing has been checked. The Radix switcher is the one part that
  arrives with its keyboard behaviour already correct.
- Condensed chart, timers, units toggle, keyboard navigation of the chart: not built.
- Update cost on a scale change is instrumented (`recipe:render` around `setScale`) but not yet
  measured against anything.

## Accessibility audit (Phase 07 criterion)

Audited against the cross-track floor in `experiments/tracks-a11y.visual.ts`: **axe clean on the
chart and in cook mode, no two-dimensional scrolling at the 400%-zoom-equivalent width, and all
20 check-off controls carry accessible names** (the label-wraps-checkbox pattern does this for
free).

Documented shortfall against track 01's full bar: no keyboard navigation of the chart (arrows,
edge traversal), no live-region announcements, no narrative mode, and forced-colors is untested.
The chart itself is ordinary semantic HTML, so the floor came at no extra cost — the gap is the
interaction layer that was never built, not the markup.

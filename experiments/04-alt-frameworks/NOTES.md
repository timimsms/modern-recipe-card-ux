# Track 04 — Svelte / Solid

> Written during the build, per PHASE-07.

## Where it is

Two apps, one design: wall chart, cook mode, check-off and serving-size scaling, over all nine
recipes and all six valid fixtures.

The adapters, in full:

```js
// Svelte
let snapshot = $state(store.get())
$effect.root(() => store.subscribe(() => (snapshot = store.get())))

// Solid
const [snapshot, setSnapshot] = createSignal(store.get(), { equals: false })
store.subscribe(() => setSnapshot(store.get()))
```

Four lines each. Solid needs `equals: false` because the store already hands out a new object on
every change, so the default identity check would be redoing work core has done. Same shared stylesheet, same `shared.js`, same Vite config — so what
differs between them is the reactivity model and nothing else. That equivalence is tested, not
assumed (see below).

**Vue is not built, and is recorded as unexplored rather than half-done.** The doc offers that
scope control explicitly: Svelte and Solid bracket the interesting axis — compiled reactivity
versus fine-grained signals — and a third VDOM-adjacent framework would mostly restate what
track 02 already shows.

**Core changes requested: none.** The second and third consumers of `GridPlan` both took it
unchanged.

## The numbers

Gzipped, as served:

| track | JS | CSS |
| --- | --- | --- |
| 01 CSS Grid | **0** (no build) | 6 KB |
| 03 SVG | **0** (no build) | 2 KB |
| 04 Solid | 7 + 6 shared = **13 KB** | 1 KB |
| 04 Svelte | 16 + 6 shared = **22 KB** | 1 KB |
| 02 React | **64 KB** | 3 KB |

The 6 KB shared chunk is `@recipe/core` plus this track's `shared.js`, so Solid and Svelte carry
identical payloads apart from their runtimes. React is **5× Solid** for the same chart with the
same features.

First render of espresso-brownies, single unthrottled samples on a desktop — indicative only,
and Phase 08 will do this properly on a throttled profile:

```
Solid   10.2ms
Svelte  23.8ms
React   41.9ms
SVG     26.6ms   (different work: measures and lays out its own text)
```

## What fought back

### Template whitespace is a rendering difference

Svelte preserves whitespace between elements; JSX strips it. The same ingredient row rendered
**3.7px wider in Svelte than in Solid** — from nothing but the newlines in the source.

That is precisely the failure this track cannot afford: Phase 08 would have attributed a
template-syntax artefact to the reactivity model. The gap after a quantity is now CSS
(`margin-inline-end`) and the Svelte template has its whitespace stripped by hand, so both are
correct by construction. There is a test that measures every row and step in both variants and
asserts the geometry is identical.

Worth stating plainly: **the equivalence premise of this track was false within an hour of
starting, and only a measurement caught it.** Looking at the two pages side by side would not
have.

### Solid props must not be destructured

`function Chart({ scale })` compiles and renders and then never updates, because Solid's
reactivity lives in the property accessor. Reading `props.scale` at the point of use is the rule,
and a quantity that needs to re-read it has to be a thunk rather than a value.

This is the sharpest ergonomic difference from React so far. React's rule is "props are a
snapshot, re-render to see new ones"; Solid's is "props are live, don't copy them". Both are
coherent; holding both in your head while writing two variants of the same component in one
sitting is where the mistakes come from.

### Svelte 5 runes made the `Set` update shape explicit

`$state(new Set())` tracks reassignment, not mutation, so `checked.add(key)` does nothing
visible. Replacing the Set on every toggle is the fix — and it happens to be exactly what the
React and Solid variants already do, so the three now share an update shape and the comparison
is about the framework rather than about who mutated in place.

## What was easy

**`createResource` deleted code.** Solid's resource primitive tracks its source signal and
discards a response whose request is no longer current — the stale-fetch guard that tracks 01,
02 and Svelte each wrote by hand. It is the one place in this track where a framework removed
work rather than rearranging it.

**Neither framework needed anything from core.** Rule 1 has now been exercised by three
independent renderers and asked for exactly one change (track 02's `PlacedCell` union).

## Still unknown

- Timers, units, keyboard, accessibility: none built.
- The update-cost measurement is instrumented (`recipe:render` around a scale change) but not yet
  measured against anything. That comparison is the reason this track exists and it belongs in
  Phase 08 with a throttled profile, not in a single desktop sample here.

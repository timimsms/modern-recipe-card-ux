# P03 — the sharpest discriminator discriminates nothing at corpus scale

**Question.** PHASE-07 calls the scale change "the sharpest test"; PHASE-08 calls it "the
sharpest discriminator between reactivity models." One control touches every quantity cell at
once — fine-grained signals (Solid), compiled reactivity (Svelte 5), VDOM diffing (React), and a
full string rebuild (track 01) should come apart here if they come apart anywhere. Every track
has been instrumented for it since it was built. This reads the answer.

**Method.** `scripts/measure-scale.mjs`: black-box and identical for every track — clock starts
immediately before dispatching `change` on `#scale`, stops at the second `requestAnimationFrame`,
so script, style, layout and paint are all inside the number. CPU throttled via CDP (4× ≈ the
mid-tier Android profile PHASE-08 specifies). Shepherd's pie — 20 quantity cells across two
components, the widest corpus chart. n=21, alternating 2×/1× so every sample changes every cell.

## The instrument lied first

The first run reported ~32ms medians for *all four* tracks — suspiciously exactly two 60Hz frame
intervals — while React's own `recipe:render` marks said its work was **1.5ms**. The double-rAF
was measuring the display's refresh cadence, not the frameworks. Same lesson as
[M1](M1-baselines-measured-the-harness.md): when an instrument reports uniformity, check what it
would have looked like had the thing varied. The script now measures the vsync floor with no
dispatch at all and reports the delta.

## Result

```
CPU 4× (mid-tier Android profile), shepherds-pie, n=21
01-css-grid (full redraw)   total 32.6ms − floor 32.6ms = work ~0.0ms
02-react                    total 32.3ms − floor 32.5ms = work ~0.0ms   (own marks: 1.4ms)
04-svelte                   total 32.7ms − floor 32.4ms = work ~0.3ms
04-solid                    total 32.6ms − floor 32.3ms = work ~0.3ms

CPU 20× (far below any phone worth naming)
01-css-grid (full redraw)   work ~11.6ms
02-react / svelte / solid   work ~0.0ms   (React's own marks: 9.5ms, still under a frame)
```

**At the profile that matters, every approach is under a frame — including rebuilding the whole
chart as a string and assigning `innerHTML`.** The user-felt cost of a scale change is the vsync
interval on every track, indistinguishably. At 20× throttle — a slowdown no real device
justifies — only the full redraw pokes above the floor, by two-thirds of one frame.

## Reading

This is [P02](P02-parallel-saving.md) and [Q2](Q2-cook-mode-honesty.md) again, from the
performance side: **the corpus keeps deflating the dramatic claim.** Twenty quantity cells is
simply not enough work for reactivity granularity to matter. The interaction would discriminate
at 500 cells; a recipe card does not have 500 cells, and an honest bake-off has to say that the
sharpest test came back blunt *for this workload* rather than quietly swapping in a synthetic one
that flatters the fine-grained frameworks.

What actually separated the tracks in Phase 07 was never update cost. It was: bytes shipped
(0 / 16 / 25 / 77 KB for the same chart), whether the layout is unit-testable, what the substrate
gives assistive tech for free, and where each framework's traps are. Phase 08's scorecard should
weight accordingly.

**Caveats.** One machine, emulated throttling, one browser; `n=21` per cell. The per-track marks
corroborate the ranking but not the absolute values (they bracket different spans). None of that
changes the conclusion's shape: the differences would have to be ~30× larger before a cook could
feel them.

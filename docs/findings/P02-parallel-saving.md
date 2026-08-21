# Finding — the convergence grid saves less time than the project assumed

**Status:** measured, from `GridPlan.timing` over the whole corpus. Not a design judgement.
**Source:** `packages/corpus/src/__snapshots__/layout.golden.test.ts.snap`, "parallel saving across
the corpus". Regenerate with `pnpm test`.

## The number

`parallelSaving = serialTotal − criticalPathDuration` — what the grid buys you over cooking the
same recipe as a numbered list. Across every component in the corpus:

| Component | Saves | Of total | % |
| --- | --- | --- | --- |
| fennel-citrus-salad / salad | 7m | 24m | **29%** |
| beef-stroganoff / stroganoff | 12m | 61m | **20%** |
| shepherds-pie / shepherds-pie | 4m | 76m | 5% |
| braised-short-ribs / ribs | 5m | 274m | 2% |
| espresso-brownies / brownies | 0m | 52m | **0%** |
| grilled-artichokes / artichokes | 0m | 42m | **0%** |
| no-knead-bread / loaf | 0m | 1,352m | **0%** |
| shepherds-pie / mashed-potatoes | 0m | 23m | **0%** |
| spinach-artichoke-skillet / skillet | 0m | 27m | **0%** |

**Five of nine components save nothing at all.** The viral brownie recipe — the one this project
exists because of — saves zero.

## Why this matters

GAMEPLAN's premise is that the format's value is showing "what happens in parallel, what waits, and
what merges into what", and Q5 promoted `saved in parallel` to the at-a-glance bar specifically as
"the format arguing for itself, expressed as a number."

Measured on the actual source corpus, that argument is weak. Most CFE recipes, as written, are
**chains**: each step consumes the previous one plus some raw ingredients. A chain has no
parallelism to reveal, so the grid is doing nothing a numbered list would not.

This does not invalidate the format. Convergence structure is still worth showing — *what merges
into what* and *when you can walk away* are real, and `longestWalkAway` is large in exactly the
recipes where `parallelSaving` is zero (bread: 0 minutes saved, but 18 hours of walking away).
It does mean the headline claim needs to be the honest one.

## The connection to W5 — this is partly a data problem, not a format problem

The brownies save 0 minutes **because of the defect validator rule W5 already flags.**

As transcribed, four dry ingredients feed the `fold in` cell directly with no combining step —
the labeled implicit join. jenelope1st's redesign adds a `sift together` over exactly those four
rows, captioned "added missing instructions for the dry ingredients."

Adding that one step and re-measuring:

```
brownies as transcribed:  saves 0m of 52m
brownies with `sift`:     saves 2m of 54m
```

The missing step **was** the parallelism. Sifting the dry ingredients is something you do while the
butter melts; with no cell for it, the grid cannot say so. Q5's prose figure of "brownies save
~2 min" turns out to have been computed on jenelope1st's corrected tree rather than the source —
the two now agree exactly, which is a useful confirmation that both are measuring the same thing.

So W5 is not a style warning. **An implicit join destroys the recipe's only claim on the format**,
and the validator now catches it before a chart is ever drawn.

## Consequences

- **Phase 03's at-a-glance bar must handle a zero honestly.** Rendering "saved in parallel: 0 min"
  on the reference recipe is the correct behaviour and should not be hidden. The design should
  probably lead with `longest walk-away` instead, which is non-zero everywhere it matters.
- **Phase 04's cook mode already has the rule it needs.** Q5 noted that when the saving approaches
  zero the recipe is effectively linear and cook mode can step through in order. That is not an
  edge case — it is the majority of the corpus, so the linear path is the *default* cook mode and
  the parallel banner is the exception.
- **Phase 08 should report this.** A bake-off that measures rendering approaches while quietly
  omitting that the underlying format saves a median of zero minutes would be dishonest.
- **The corpus may be unrepresentative.** All five source recipes come from one site with one
  house style. Recipes written to be parallel — a roast dinner, a stir-fry with prepped
  components — would score differently. Worth testing before concluding anything about the format
  in general, rather than about CFE's corpus.

## What this does not say

`serialTotal` and `criticalPathDuration` are `basis: 'approx'` for seven of nine components,
because most steps have no authored duration and fall back to Effort-bucket midpoints. The
*ranking* is trustworthy — a chain saves zero whatever numbers you put in it — but the individual
minute figures are ordinal, not measured. `fennel-citrus-salad` is the only entry with
`basis: 'exact'`.

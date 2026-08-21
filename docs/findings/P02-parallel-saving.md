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

## Worse than that: the saving needs a second person

Added during Phase 04, when the cook-mode scheduler made it measurable.

`criticalPathDuration` is the longest dependency chain, which is the right answer to "how long
is this recipe" and the **wrong** answer to "when will I eat". A critical path assumes unlimited
hands: it happily runs `dice the onion` and `slice the mushrooms` at the same instant. One cook
cannot. Waits overlap work — a braise proceeds without you — but two hands-on steps never
overlap each other.

`cookSchedule` computes what one person can actually achieve. Comparing the two:

| Component | Critical path | One cook | |
| --- | --- | --- | --- |
| beef-stroganoff | 49m | 61m | **unreachable alone by 12m** |
| fennel-citrus-salad | 17m | 24m | **unreachable alone by 7m** |
| braised-short-ribs | 269m | 274m | **unreachable alone by 5m** |
| shepherds-pie | 72m | 76m | **unreachable alone by 4m** |
| the other five | — | — | reachable alone |

**The gap equals `parallelSaving` exactly, on every recipe where either is non-zero.** That is
not a coincidence — it is the same quantity seen from two directions. Every minute this format
claims to save is a minute that requires somebody else in the kitchen.

So the earlier finding understates the problem. It is not that the saving is small; on this
corpus, for one cook, **the saving is zero everywhere**.

What survives unharmed: convergence structure, `longestWalkAway`, and the mini-map. Knowing that
a bread has eighteen hours of waiting in it, or that a step's inputs are two prior results rather
than raw ingredients, does not depend on any of this.

### What changed as a result

- `TimingSummary` gained `singleCook` and `idle`. The at-a-glance bar's **start to finish now
  reports `singleCook`**, because a summary bar is read by one person deciding whether to begin.
- "Saved in parallel" is **no longer a field**. It is a sentence, and it names its condition:
  *"12 min of this could be saved with a second pair of hands."* A number in a bar reads as a
  promise; that sentence is a conditional, which is what it always was.

## And the banner never fires

The third measurement of the same fact, taken when cook mode was built.

PHASE-04 calls the parallelism banner *"the format's central insight, delivered actively rather
than left for the user to infer from geometry"* and suggests it may be **better than the desktop
chart at this one job**. It is the reason cook mode was expected not to be a numbered list.

`whileThisRuns` offers work only when it is genuinely available: the step you are on must be one
you can walk away from, the offered step must not be something the current step already depends
on (you cannot be baking a pie you have not assembled), and it must not be the step the current
one is blocking (during a thirty-minute autolyse, "fold the dough" is precisely what the waiting
prevents).

Under those rules, across the whole corpus:

```
0 of 66 steps show a parallelism banner
```

Not a low number — none. The code is right: a synthetic recipe with a thirty-minute braise and
two minutes of unrelated chopping produces the banner and shortens the schedule from 33 minutes
to 31. The corpus simply has no such structure.

This is the same fact as the two above, seen a third way: **these recipes are chains, and a lone
cook has nothing to overlap.**

### What cook mode leans on instead

The banner stays — it is correct, and a recipe written for parallelism would use it — but nothing
in the design may depend on it appearing. What actually keeps cook mode from being a numbered
list is:

1. **The mini-map.** Position and progress in the tree, at all times.
2. **Named inputs.** "the seasoned filling" and "mashed potatoes 1-3/4 lb. (800 g)", not "step 9".
3. **One-tap access to any outstanding step**, so the order is a suggestion rather than a rail.

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

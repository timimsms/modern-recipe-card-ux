# R7 — a step-count progress bar overstates by up to 62 points

**Question.** PHASE-05 specifies that `progress` be weighted by time rather than by step count,
"so a 40-minute bake doesn't read as 'one step remaining, nearly done.'" Is that a real problem in
this corpus, or a plausible-sounding rule protecting against something that never happens?

Asking is not idle. Two Phase 04 features had their justification evaporate on contact with the
corpus — the parallelism banner fires on [0 of 66 steps](Q2-cook-mode-honesty.md), and parallel
saving is [0 for 5 of 9 components](P02-parallel-saving.md). Both were correct code answering a
question the recipes don't ask. This one gets measured before every track binds it.

**Method.** `scripts/progress-weighting.mjs` walks each component in `cookSchedule` order, and at
each step computes completion both ways: `done / total` steps, and `doneMinutes / totalMinutes`
using the same `stepMinutes` the layout engine and cook schedule use. It reports the point of
maximum divergence.

## Result

```
  component                          steps   total   at      by count   by time   gap
  braised-short-ribs/ribs              9    274m  7/9      78%       16%      62%
  espresso-brownies/brownies           5     52m  4/5      80%       23%      57%
  no-knead-bread/loaf                  9   1352m  4/9      44%        7%      37%
  shepherds-pie/shepherds-pie         12     76m  11/12    92%       61%      31%
  spinach-artichoke-skillet/skillet    6     27m  4/6      67%       48%      19%
  grilled-artichokes/artichokes        7     42m  5/7      71%       64%       7%
  fennel-citrus-salad/salad            5     24m  3/5      60%       54%       6%
  beef-stroganoff/stroganoff          10     61m  5/10     50%       49%       1%
  shepherds-pie/mashed-potatoes        3     23m  —         0%        0%       0%

  mean worst-case overstatement:   24%
  overstates by ≥20% somewhere:   4/9
  overstates by ≥40% somewhere:   2/9
```

**The rule holds.** At its worst, the short ribs sit 7 steps of 9 complete — a step-count bar
reads 78%, three-quarters done, nearly there. The clock says 16%. Four hours of braising are the
recipe; the seven steps before it are twenty minutes of knife work.

This is the same structural fact [E1](E1-mostly-waiting.md) found from the other direction: these
recipes are mostly waiting. A step-count bar measures the part that isn't the recipe.

## Where it doesn't matter

Four of nine components diverge by under 20%, and two are within a point. The pattern is not
"long recipes diverge" — the bread is 1,352 minutes and diverges 37%, the stroganoff is 61 minutes
and diverges 1%. What matters is whether the long step sits at the *end*:

- **Divergent** — one dominant step, last: braise, bake, rise. The step-count bar is most wrong
  exactly when the cook most wants to know, at 4/5 with the oven still running.
- **Flat** — effort spread evenly across steps, or the long step early enough that finishing it
  moves both numbers together. The stroganoff's simmer is step 6 of 10.
- **`mashed-potatoes` never diverges at all** (gap 0%) — three steps of comparable length. With
  the mean pulled up by two outliers, "24% mean overstatement" oversells a bimodal result: this is
  a fix for half the corpus, and inert on the other half.

Inert is the right failure mode. Time-weighting is never *worse* than step-counting — where they
agree, the reader loses nothing.

## Consequences

1. `progress` in `packages/core/src/state.ts` weights by `stepMinutes`. Confirmed.
2. `progressByStepCount` is exported alongside it. Not for use in a track — so the difference can
   be *shown* in the Phase 08 showcase rather than argued, on the short ribs, where it is 62
   points.
3. `stepMinutes` moved to `model.ts`. It had been copy-pasted into `layout.ts` and `cook.ts`, and
   this would have been the third copy. The timing summary, the cook schedule and the progress bar
   have to agree to the minute or the card contradicts itself; three definitions guaranteed they
   eventually wouldn't. The 58 golden layout snapshots passed unchanged after consolidating, which
   is what confirms the three copies hadn't drifted *yet*.

## Open

A time-weighted bar that jumps 0% → 84% when the braise finishes is accurate and may still feel
broken. The honest alternative is a bar that advances *during* a running timer, which needs the
timer state from 05c — deferred there rather than guessed at here.

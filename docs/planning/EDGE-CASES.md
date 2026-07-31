# Edge cases

> Enumerated against the settled design. Split by whether a case **changes the design**, merely
> **stresses** it, or is already **covered**. Only the first group should delay building.

---

## A. Cases that could change the settled design

### E1 — Mostly-waiting recipes

**Breaks:** "label the exception, not the default" — the rule the mark vocabulary rests on.

Sourdough: autolyse 1 h → bulk ferment 4 h → shape → proof 2 h → bake 45 min. Roughly 95%
unattended. Every step earns a clay clock, so the accent becomes the field and the one thing the
mark was designed to make findable is no longer findable. Same for braises, cold brew, yogurt,
cured meats, most bread.

**Proposed resolution.** Make the marking rule *relative*, not absolute: mark whichever state is in
the minority within a given recipe, and let the at-a-glance bar state the polarity
(`46m hands-on` vs `5h 45m walk away`). Falls out of `TimingSummary`, which already has both totals.
Needs verification that a flipped legend doesn't confuse someone moving between two recipes.

**Cheap test.** Add one long-ferment recipe to the corpus and render it. Do this before Phase 03
tokens are finalized.

### E2 — Overnight and multi-day durations

**Breaks:** the duration bar's scale, and "start to finish" as a single number.

"Refrigerate 8 hours", "cure 3 days", "marinate overnight". Scaled against a 3-day step, a 30-minute
bake is a sub-pixel sliver — variant B's failure reappearing inside variant E's glyph. And a 3-day
"start to finish" is true but useless; the cook wants *active sessions*, not elapsed time.

**Proposed resolution.** A `passive` effort tier above `long-unattended`, excluded from bar scaling
entirely and rendered as a distinct mark (`⏸ 8h`). `TimingSummary` reports "3 days elapsed ·
50 min active across 2 sessions". Session-splitting is a real feature for this class of recipe and
is probably a Phase 04 concern (cook mode has to be resumable across days).

### E3 — Repeated steps and loops

**Breaks:** the model. There is no loop construct in the assembly tree.

"Fold every 30 minutes for 2 hours" (4×). "Baste every 20 min." "Turn the dough three times."
Extremely common in bread and roasting. Currently only expressible by duplicating the step four
times, which is both ugly and wrong — it's one instruction with a cadence.

**Proposed resolution.** `Step.repeat?: { times: number; every: Duration }`, rendered as a single
cell with a repeat mark. Cook mode expands it into timed prompts. Layout treats it as one node —
the tree shape is unchanged, which is why this is cheap.

### E4 — Equipment contention

**Breaks:** the parallelism banner, potentially with bad advice.

The tree says two branches are independent. The kitchen says they both need the only large skillet,
or the oven is already at a different temperature, or you have two burners and three pots. Phase 04's
banner would cheerfully suggest starting a step the cook physically cannot start.

**Proposed resolution.** `Step.equipment[]` already exists in the schema. Have `readySteps` filter
out steps whose equipment is in use by an in-progress step, and surface the reason ("skillet busy").
This makes the banner substantially more trustworthy and is the kind of thing the original format
cannot do at all — a genuine argument for the digital version.

**Note:** this is the deepest item here. It converts the parallelism claim from "topologically
possible" to "actually possible", which is the difference between a diagram and a tool.

### E5 — Garnish and serve-with

**Breaks:** validator rule E1 (orphan ingredient), which would reject valid recipes.

"Chopped parsley, to serve." "Serve over rice." These never merge into the root — they're consumed
after the dish is finished. The strict orphan check flags them as authoring errors.

**Proposed resolution.** Either a `serve` root step that consumes the dish plus garnishes, or an
explicit `Ingredient.role: 'garnish' | 'accompaniment'` exempting them from the reachability check.
Prefer the `serve` step — it keeps the tree total and gives the garnish a place in cook mode, which
is where people forget it.

---

## B. Cases that stress the design without changing it

| Case | Stresses | Handling |
| --- | --- | --- |
| Mixed-attention steps — "simmer 15 min, stirring occasionally" | The attended boolean flattens it | Known, accepted. Revisit if the corpus shows it's common. |
| Doneness-by-condition — "bake until a toothpick comes out clean, 30–40 min" | Duration is secondary to the test | Step text already carries the condition; the mark carries the estimate. Fine. |
| Hot-when-used constraints — mashed potatoes must be hot at assembly | Dependency graph has no temporal *proximity* constraint | Real but rare. Note in step text for now. |
| No-cook recipes — salads, cocktails | Glance bar's time fields near-empty; `saved` ≈ 0 | Degrades correctly. The near-zero saving honestly reports that the grid isn't earning much here. |
| Final rest — "rest 10 min before slicing" | An unattended step after the apparent finish | Just another node. Confirms the root isn't always the last thing you do. |
| Scaling that needs more pans | 2× may require two batches, not a bigger pan | Phase 05 already flags unscalable dimensions; extend the flag to equipment. |

---

## C. Already covered

Wide-shallow (25 ingredients), deep-narrow (depth 12), long step text, unicode fractions and RTL,
degenerate single-step, missing durations, ingredient reuse (I4, prompt written), cross-component
references (I5), unit-pair rounding discrepancies in the source.

All have fixtures specified in `phases/PHASE-01-model-and-corpus.md`.

---

## Corpus additions this implies

Three recipes to transcribe alongside the existing five:

| Recipe | Exercises |
| --- | --- |
| **Sourdough or no-knead bread** | E1 (mostly-waiting), E2 (overnight), E3 (repeated folds) |
| **Braised short ribs or a stew** | E1, E4 (oven + pot contention), long unattended block |
| **A composed salad or grain bowl** | E5 (garnish/serve-with), no-cook, near-zero parallel saving |

Between them they cover every item in group A. That's the cheapest way to test the design against
these cases: build the corpus entry, render it, look.

---

## Recommendation

**E1 is the only item that should gate Phase 03**, because it could invalidate the mark vocabulary
about to be written into tokens, and testing it costs one corpus entry.

E2–E5 are schema and behavior additions, not design reversals. Fold them into Phase 01 (E3, E5) and
Phase 04/05 (E2, E4) as they come up. None require rethinking the card.

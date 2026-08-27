# Q8 — ingesting a recipe as the cook actually makes it

The tenth corpus recipe is the first that did not come from a printed source alone. It is a NYT
slow-cooker recipe plus a set of kitchen notes that change it substantially: oven instead of slow
cooker, the sauce mixed separately in a measuring cup, thighs only, three additions that are not
in the printed recipe at all, and a correction to the preheat instruction.

That is a more realistic ingestion than the first nine, and it found five things. Four were
fixed on the spot; the fifth — the reuse-split gap below — took a model change.

## What the transcription had to decide

Three of the notes' ambiguities changed the shape of the tree rather than its details, so they
were asked rather than assumed: whether the shredding step and the reserved ½ cup of sauce
survive the adaptation, whether breasts stay in, and how to record additions given with no
amounts. Everything else — the preheat as a `prelude`, the vessels as `equipment`, "2 packs"
recorded as said rather than converted to the printed 1½–2 lb — was decidable from the notes.

The result validates clean with one warning: **W2, temperature in one scale only.** The note said
325°F and nothing else, and the model's rule is that metric pairs are authored, never computed.
Converting to silence the warning would be inventing a number the cook did not give.

## 1. A reuse split has one quantity and several portions, and the model recorded only the total

The barbecue sauce is 1½ cups: 1 cup into the mixture, ½ cup stirred through after shredding. One
row on the shopping list, two consumers in the tree — which is exactly what `reuse` exists for,
and which the `reuse-split` fixture was written to test.

Read out loud, both consumers claimed the full 1½ cups. Wrong at both ends.

`ReuseDeclaration` carries a `leaf` and a `note`; there is nowhere for each consumer's share to
live. **The chart never had to face this**, because a quantity sits in the ingredient column once,
beside the ingredient rather than beside a step — so the gap survived the very fixture built to
exercise this shape. Same pattern as [R10](R10-saying-the-tree-out-loud.md): the chart is a
self-supplying context, and the gap only appears when something has to *name* a per-step amount.

**Fixed.** `InputRef` for an ingredient now carries an optional `portion`: the leaf keeps the
total, because that is what you shop for, and each consuming step carries its share, because that
is what you measure. The share belongs to the *consumption*, not to the declaration — putting it
on `ReuseDeclaration` would mean restating step ids that `inputs` already lists and keeping the two
in step.

Two checks came with it, both derived from `LADDERS` so the unit arithmetic has one source of
truth:

- **E9** — portions totalling more than the recipe calls for. An error rather than a warning: a
  cook following it runs out. Converts across a ladder, so `¼ cup + 7 Tbs` out of `½ cup` is
  caught while `¼ cup + 2 Tbs` passes.
- **W7** — a split leaf that has a quantity but whose consumers do not say how much they take.
  Silent for a leaf with no quantity, because salt seasoned twice has nothing to divide.

Where a share genuinely is not recorded, the narrator still says "part of the 1½ cups" — vague and
true beats a share it would be guessing at. Cook mode shows the portion, and portions scale with
everything else: at 2× the reserved ½ cup becomes 1 cup.

## 2. Nowhere to record that a recipe is an adaptation

The most important fact about this file — it is cooked in a Dutch oven, not the slow cooker its
source specifies — has no structured home. `Recipe` has `title`, `yield`, `servings`, `components`
and `source`; `Step` has no free-text note at all.

It ended up appended to `source.name`, which is overloading a field meant for attribution. Worth a
`note` on `Recipe` and on `Step`: provenance, substitutions and "last time I made it I added…" are
ordinary recipe content, and the corpus has now met all three.

## 3. A reuse chip painted over its neighbour

`.chip` was `white-space: nowrap`, which was fine while every reuse chip in the corpus said
"butter". This recipe reuses "tomato-based barbecue sauce" — 204px of chip in a 138px cell,
overhanging 76px onto an unrelated step. Fixed by wrapping rather than truncating, for the same
reason [R9](../planning/GAMEPLAN.md) caps grid tracks instead of clamping text: the ingredient name
is the entire content of the chip, and half of it identifies nothing.

## 4. "2 pack of chicken thighs"

Units outside the spoken table got no plural. The known units are in the table precisely because
their spoken forms are irregular, so an unknown one can take a naive `-s`.

## 5. `shred` was not a technique

Added, for the same reason `shape` was during Phase 06: the closed vocabulary met a real recipe
that needed it, and this one is named after the action.

## What it adds to the corpus

- The **tenth** recipe, and the first with two reuse declarations in one component (the sauce, and
  salt and pepper — seasoned before the braise and again to taste).
- The first with **ingredients that have no quantity at all** because the cook does them by eye,
  sitting beside ingredients that do.
- Another data point for [P02](P02-parallel-saving.md): **saves 0m of 196m**. Ten recipes, and the
  parallel-saving claim is still zero on every one where a single cook is doing the work.
- Equipment on three steps, which nothing reads yet — [EDGE-CASES E4](../planning/EDGE-CASES.md) is
  still open, and there is now a recipe where it matters (one Dutch oven, one oven, one measuring
  cup, all sequential).

# Q7 — gathering and using are different gestures, and only one needs a checkbox

**PHASE-05's open question.** "Should completing a step auto-check its input ingredients, or are
those independent gestures? They mean different things ('I have it out' vs 'I've used it'), but
two check systems may be more ceremony than anyone wants. **Prototype both.**"

Both are built, behind the `check-off` control in track 01. `independent` is the default.

## What the prototype showed

Cook each recipe straight through, touching nothing but **Next**, then look at the ingredient
column:

| recipe            | ingredients | ticked by linked check-off |
| ----------------- | ----------- | -------------------------- |
| shepherds-pie     | 20          | 20                         |
| no-knead-bread    | 4           | 4                          |
| braised-short-ribs| 10         | 10                         |
| beef-stroganoff   | 10          | 8                          |

**Linked check-off ends with everything ticked, and that is the problem.** Cooking a recipe uses
all of its ingredients — that is what a recipe is. So by the end the ingredient column carries no
information the step state did not already have: it is a second, slower rendering of "I finished
the steps". A checkbox that is guaranteed to end full is not tracking anything.

Worse, it is full at exactly the wrong time. The ingredient checkbox earns its keep *before* the
cooking starts — shopping, then mise en place, the "have I got everything out" pass. Linked mode
gives nothing during that phase and completes itself afterwards, when the answer no longer
matters. It also destroys the one distinction worth having: an unticked box could mean "still in
the cupboard" or "not bought", and after linking it just means "step not reached".

**So: independent, and the default stays.** The two gestures mean different things, and the one
that needs a control is the one the cook makes before the stove is on.

## The 8-of-10

Stroganoff's `dill-weed` and `salt-pepper` stayed unticked after every step had been walked. They
are inputs to `add-dill`, the last step in cook order — and **Next** cannot complete the final
step, because completing-and-advancing has nowhere to advance to.

Left as it is. Next means "finished this, moving on"; at the end there is no moving on, and the
explicit **Mark done** is the honest control for a recipe whose last step is usually a bake that
has not finished yet. It is worth knowing that a straight walk-through leaves the recipe at
n−1 steps rather than complete, so nothing downstream should treat "all steps done" as reachable
by navigation alone.

## What the losing prototype was good for

Linked mode doubles as a **corpus diagnostic**: anything left unticked after a full walk is either
the last step's inputs or an ingredient no step consumes, and the second kind is a modelling
error. Across all eight recipes there are none of the second kind — because `validate.ts` already
rejects them as **E1, orphan ingredient**, an error rather than a warning, so one could never
reach the corpus.

Which makes the prototype's diagnostic value nil, and that is the useful part of the answer: the
check it would have performed is already a build gate. Worth stating plainly rather than adding a
second, weaker version of a rule that exists — the temptation was to add a warning for exactly
the condition E1 already fails the build on.

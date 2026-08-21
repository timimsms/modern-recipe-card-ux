# Finding — Q2: does cook mode preserve parallelism honestly, or silently relinearize?

**Status:** answered by building it and measuring, not by inspection.
**Reproduce:** `pnpm serve`, open `experiments/01-css-grid/`, pick a recipe, choose **cook mode**.
**Related:** [`P02-parallel-saving.md`](P02-parallel-saving.md), which this completes.

## The question

GAMEPLAN Q2 asks whether stepping through a tree one node at a time throws away the parallelism
the format exists to show. PHASE-04 names the trap directly: *"the easy mobile answer is to
relinearize into a numbered list, which throws away the entire reason this format exists. A
numbered list is not a solution. It is a surrender."*

The proposed defence was the **parallelism banner** — "while this simmers, you can…" — described
as *"the format's central insight, delivered actively"* and *"arguably better than the desktop
chart at this one job"*.

## Answer

**Cook mode does not relinearize — but the banner is not what saves it, because the banner never
fires.**

Across the corpus the banner appears on **0 of 66 steps**. What keeps cook mode honest is the
mini-map, named inputs, and the tree staying reachable.

## Why the banner never fires

`whileThisRuns` offers work only when it is genuinely available. The current step must be one you
can walk away from; the offered step must not be something the current step already depends on;
and it must not be the step the current one is blocking.

Each of those clauses was added because the version without it lied:

| Missing clause | What cook mode said |
| --- | --- |
| Dependencies are settled | Standing at the oven with shepherd's pie in it: *"you can: heat, dice, cut up into small pieces"* — a dozen minutes behind |
| The current step is not settled | During the bread's 30-minute autolyse: *"you can: fold the dough"* — precisely what the waiting prevents |
| Only unattended steps offer work | Suggesting a second task mid-sear, which is how you get two burnt things instead of one |

With all three, the corpus yields nothing. The code is right: a synthetic recipe with a
30-minute braise and two minutes of unrelated chopping produces the banner and shortens the
schedule from 33 minutes to 31. **These recipes simply have no such structure.**

That agrees with the two measurements in P02 — five of nine components save zero minutes, and
where the saving is non-zero it is exactly the amount that requires a second pair of hands. Three
different instruments, one fact: **CFE recipes are chains, and a lone cook has nothing to
overlap.**

## What actually keeps it honest

1. **The mini-map.** The whole `GridPlan` at thumbnail scale, current step in clay, completed
   regions filled. The reader always sees the shape of the tree and their position in it. Judged
   with a filmstrip — one frame per step — because a single frame always looks fine and the
   question is whether position reads across a whole recipe. It does, and the clearest evidence
   is step 9 of 12 of shepherd's pie, where `cut up into small pieces` appears as a *detached*
   block below the main mass: the mini-map correctly saying "side branch, not the main chain".
2. **Named inputs.** Each step's inputs resolve to things you can fetch — *"the seasoned
   filling"*, *"mashed potatoes 1-3/4 lb. (800 g)"* — never "step 9". A numbered list cannot do
   this; it is the one place cook mode is genuinely better than the chart, and it is the thing
   PHASE-04 expected the banner to be.
3. **The tree stays reachable.** The order is a suggestion. Every outstanding step is one tap
   away, from a chip or from the mini-map itself, which makes the alternative route *spatial*
   rather than a list to read.

## The honest caveat

On a pure chain — brownies, artichokes, bread, the skillet — cook mode **is** a sequence of
cards, and no amount of design changes that, because the recipe genuinely has no branch to show.
What the mini-map adds there is not parallelism but *proportion*: how much is left, and how the
remaining work is shaped.

That is a smaller claim than PHASE-04 made, and it is the true one. Cook mode is not a surrender
because it never discards structure that exists — but on most of this corpus, there is less
structure to preserve than the project assumed.

## Measured

- Shepherd's pie, all 15 steps across both components, at a 390px viewport: **zero horizontal
  overflow at every step**. No pinch-zoom anywhere.
- Smallest navigation target: **48px**, above the 44px kitchen-hands floor.
- All four presentations render from one unmodified `GridPlan`.
- Check-off is shared: a step finished in cook mode is ticked in the chart, an ingredient
  gathered in the chart survives the round trip.

## Open

- Untested with anyone cooking. The claim that the mini-map carries orientation is well
  evidenced in rendering and unvalidated with a reader — Phase 08.
- The banner has never been seen firing on a real recipe, only on a synthetic one. A corpus
  entry written for parallelism (a roast dinner, a stir-fry with prepped components) would test
  both the banner and the claim that this corpus is unrepresentative.

# R10 — saying the tree out loud found four bugs the chart was hiding

PHASE-06 frames the structural narrative as an accessibility deliverable: a 2D dependency diagram
has no natural reading order, so restate it in language. That is true and it is not the most
useful thing that came out of building it.

**The chart had been concealing errors in the model by supplying context.** Every relationship the
chart draws by adjacency, the narrative has to name — and naming things is where wrongness becomes
visible. Four bugs, none of which any prior phase's tests could have caught, because every prior
phase rendered the tree next to itself.

## 1. Four of nine components branch, and the summary said none did

The first summary described the *root's* step inputs, on the reasoning that the root is the final
convergence. Run over the corpus it called all nine components "one strand of work".

That is false — four of them branch. **No root in the corpus has two step inputs**, so the one
place the summary looked was the one place branching never happens. Reading every join instead
gives:

```
beef-stroganoff/stroganoff     2 joins   [2+1] and [4+1] steps
braised-short-ribs/ribs        1 join    [2+1]
fennel-citrus-salad/salad      1 join    [1+1+1]
shepherds-pie/shepherds-pie    2 joins   [1+1] and [8+1]
```

And the shape of those joins is itself the finding: they are almost always **one prepared thing
meeting a long spine** — `[8+1]`, `[2+1]` — not two substantial branches converging. Only the
fennel salad has three comparable strands meeting.

This is the same structural fact [P02](P02-parallel-saving.md) found in the timing (parallel saving
is 0 for 5 of 9) and [Q2](Q2-cook-mode-honesty.md) found in the banner (fires on 0 of 66 steps),
arriving now from the topology. The convergence grid's famous shape is, in this corpus, a caterpillar
with prep hanging off it.

## 2. `describeOutput` is unambiguous only because the chart supplies position

Read aloud, it collides. The no-knead bread produced "the rested mixture" twice and "the baked
mixture" twice; a listener tracking "the rested mixture" has no way to know which one.

Measured across the corpus: **5 of 9 components had a name collision**, 6 names in total. Now
validator warning **W6**, and the corpus carries explicit `outputName`s. On the chart none of this
mattered, because the input a step refers to is the cell physically touching it.

## 3. A no-knead bread that kneads

The bread's shaping step was tagged `technique: knead` — for want of anything better, since the
closed vocabulary had no `shape`. So `describeOutput` called its output "the kneaded mixture", in a
recipe named No-Knead Bread.

Exactly the failure mode `describeOutput` was rewritten to avoid, sitting undetected in the corpus
because the chart never says the word. `shape` is in the vocabulary now.

## 4. A number that scaling could not see

Shepherd's pie kept "1-3/4 lb. (800 g)" of mashed potatoes in `note` — which is precisely what
`ComponentRefLeaf.quantity`'s own doc comment warns against: *"Without this field the number has
nowhere to live but `note`, where Phase 05's scaling cannot see it."*

So a doubled shepherd's pie asked for 3½ lb of everything and 1¾ lb of mashed potatoes. Phase 05's
scaling had been silently inapplicable to the one multi-component recipe in the corpus. It is a
real quantity now; 2× gives `3½ lb / 1.6 kg`.

**And fixing it exposed a second bug.** `renderLeaf` returned early for a component reference and
never rendered a quantity at all — harmless while the number lived in `note`, a silent loss the
moment it moved. The chart row printed as just "mashed potatoes". That went into a screenshot
baseline that I approved; reading the printed PDF is what caught it, one commit later.

## The pattern

Each of these survived because **the chart is a self-supplying context**. An input needs no name
when it is the cell you are touching. An output needs no distinct name when its position
distinguishes it. A quantity in `note` looks the same as a quantity in `quantity` when both are
just text in a column.

Rendering the same model into a medium with *no* spatial context — one sentence after another —
removes every one of those supports at once. That is what makes the narrative worth having beyond
its accessibility case: it is the strictest reader the model has.

Worth generalising: when a model is only ever rendered one way, the renderer's conventions become
load-bearing without anyone deciding they should be. A second renderer with different affordances
is a test of the model, not just of the renderer.

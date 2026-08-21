# Finding — Q4: Is raw JSON authoring tolerable, or does the corpus need a DSL?

**Status:** resolved empirically, as PHASE-01 intended — by transcribing the corpus and seeing what hurt.
**Evidence:** seven recipes and fourteen fixtures, transcribed by four people working independently
from the same schema and one worked example.

## Answer

**Raw JSON is tolerable. No DSL.** But two specific frictions showed up in _every_ independent
report, and both are fixed by a thin normalisation layer rather than a new language:

1. **Amounts may be written as the source prints them** — `"1-1/2"`, `"1/3"`, `"30 to 40"`.
2. **`inputs` may be bare ids** — `"inputs": ["brown", "onion"]`.

Both are normalised at load by `normalizeRecipe()` in
[`packages/core/src/authoring.ts`](../../packages/core/src/authoring.ts). The runtime model in
`model.ts` is unchanged: everything downstream of the loader sees the strict shape, so this
costs the layout engine nothing.

## Why not a DSL

PHASE-01 pre-authorised one: _"if it's miserable — and it likely will be for Shepherd's pie's
ten-deep chain — that answers Q4 and a terse indentation-based DSL becomes a Phase 01
deliverable."_

Shepherd's pie was duly transcribed, ten deep, across two components with a cross-component
reference. The verdict from that transcription was _"tolerable but not pleasant"_ — and
critically, the part that was unpleasant was not the nesting. The flat `steps` record was
reported as **the right call**: the file diffs cleanly and no subtree ever had to be re-indented.

An indentation DSL would have fixed the verbosity while giving back the two things flat storage
buys — clean diffs, and cross-component references that are just ids. That is a bad trade for a
corpus this size, and it would put a compiler between the author and the error message.

## The two frictions, and why they were worth fixing

### Fractions become decimals

The sources print `1-1/2 lb.` and `1/3 cup`. Strict JSON forces `1.5` and
`0.3333333333333333`.

Reported independently by three transcribers; one called it _"the single biggest friction in
raw-JSON authoring here."_ The reason is not aesthetics — it is that **you cannot proofread a
transcription against a photograph when the numbers no longer look like the numbers**, and
dropping one `3` silently changes the amount in a way nothing downstream can detect.

### `inputs` is mostly boilerplate

`{ "kind": "step", "id": "cover-with-potatoes" }` is 45 characters to express one edge. The
corpus has **228 of them**. Two transcribers independently estimated the boilerplate at roughly
40% of a component's line count.

Measured across the whole committed corpus, the authoring form is **37% smaller** than the same
data in the strict form (54,825 vs 87,270 bytes).

## What was deliberately _not_ changed

- **The strict form still works.** `{ "kind": …, "id": … }` passes through untouched, which is
  what lets `fixtures/invalid/dangling-reference.json` still trigger validator E7 — a bare typo'd
  id is caught earlier, by the normaliser, so that fixture stays in the long form on purpose.
- **Nothing guesses.** A bare id that matches no step and no ingredient throws, naming the
  component and step. An id that names _both_ a step and an ingredient throws rather than picking.
  An unreadable amount throws. This follows the same rule the ingredient-line parser now
  follows — see below.

## Related defect found the same way

`ingredientFromLine()` was written as a transcription aid and, on the first real recipe, was
caught **failing quietly**: `"2 large (100 g) eggs"` came back as
`{ amount: 2, unit: 'count', item: 'large (100 g) eggs' }`, silently discarding the authored
metric pair, and `"1 shot (4 Tbs; 60 mL) espresso"` swallowed the entire measurement chain. Both
returned plausible objects. Neither was right.

It now tracks an `unparsed` field and the strict constructor throws. **A parser that degrades
into a plausible wrong answer is worse than one that refuses**, because Phase 05 will scale the
wrong number without complaint and nothing downstream can tell the difference.

## Schema changes this phase forced

| Change                      | Why                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ComponentRefLeaf.quantity` | Shepherd's pie calls for "1-3/4 lb. (800 g) mashed potatoes" — a real, scalable, metric-paired quantity. Without the field it lands in `note`, invisible to Phase 05's scaling and to the W4 metric check.                             |
| `Effort` gains `passive`    | EDGE-CASES E2. Overnight and multi-day rests are excluded from bar scaling; a 12–18 h bulk ferment would make a 30-minute bake a sub-pixel sliver.                                                                                     |
| `Step.repeat`               | EDGE-CASES E3. "Fold every 30 min., 3 times" is one instruction with a cadence, not three steps. Layout treats it as one node, so the tree shape is unchanged.                                                                         |
| `Ingredient.role`           | EDGE-CASES E5, but presentational only. Garnishes still have to reach the root — through a `serve` step, which is the convention `fennel-citrus-salad.json` demonstrates.                                                              |
| `Quantity.of`               | "2 15.5 oz cans of beans" is a count _and_ a size. Without it the size lives in `note`, so Phase 05 would scale the cans and leave the ounces beside them as a stale string. Two of sixteen ingredients in the skillet recipe need it. |
| `Quantity.amount` optional  | "large pinch of nutmeg" has a unit and no number. Distinct from `approximate`, which says the number is a gesture; this says there is no number, and the rule against inventing one is absolute.                                       |
| Validator **W5**            | New. See below.                                                                                                                                                                                                                        |

## Unplanned finding — W5, the labeled implicit join

R3 says every ingredient must reach the root through an _explicit, labeled_ step, and W3 catches
merges with no text at all. Transcription showed that is not enough.

In the brownies, four dry ingredients feed the `fold in` cell directly with no combining step.
jenelope1st's redesign inserts a `sift together` over exactly those four rows, captioned "added
missing instructions for the dry ingredients." The step _is_ labeled, so W3 cannot see it.
Shepherd's pie has the identical defect: rosemary, thyme, nutmeg and broth all enter one cell.

**W5 fires when a step folds ≥4 raw ingredients into an already-prepared input.** The
"already-prepared" clause matters — whisking a vinaigrette from oil, lemon, honey and salt is one
honest action and must not warn. Both real occurrences in the corpus are left in place: they are
faithful to the source, and they are the finding.

## Open

- The size-adjective problem has no answer. `"1 medium (110 g) onion"` and `"1 large artichoke"`
  both lose their printed word order, becoming `unit: 'count'` plus an item string. Reported by
  three transcribers. The same collision makes the known unit `clove` unusable — `"5 large garlic
cloves"` as `{ amount: 5, unit: 'clove' }` renders as "5 cloves large garlic", so the corpus
  falls back to `count` and the unit sits unused. It affects R6 typography and needs a decision
  before Phase 03.
- **The mixed-attention step is now showing up repeatedly.** Q5 recorded flattening
  "simmer 15 min, stirring occasionally" into one attended/unattended bit as a known, accepted
  limitation, and EDGE-CASES group B says to revisit if the corpus shows it is common. It does:
  stroganoff's 15-minute mushroom sauté and the skillet's 10–12-minute stir both landed in a
  bucket that misrepresents them, and both transcribers flagged it unprompted. Not a Phase 01
  change — but the "revisit" condition has been met, and Phase 03's mark vocabulary should
  answer it rather than inherit it.
- `Temperature.label` and `Temperature.f`/`c` are the same field, so `"med-low"` and
  `400°F (204°C)` are structurally identical. R6's rules will have to key off presence-of-`f`
  rather than a type discriminant.
- Nothing checks that a duration written into `step.text` ("cook until liquid evaporates,
  15 min.") agrees with the `duration` field beside it. Faithful transcription means writing the
  number twice.

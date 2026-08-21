# Fixtures

Synthetic recipes. Nothing here is food; each one exists to push on exactly one property of
the model or the layout engine.

## `valid/`

Extremes the engine must handle without special-casing. All of these validate clean, and
Phase 02 must produce a plan for each under every column strategy.

| File                | Pushes on                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `degenerate.json`   | One ingredient, one step. The smallest possible tree.                                          |
| `wide-shallow.json` | 25 ingredients, depth 2. Tall and narrow.                                                      |
| `deep-narrow.json`  | 3 ingredients, depth 12. Short and very wide.                                                  |
| `long-text.json`    | Step text far beyond the W1 threshold (R9, text measure).                                      |
| `unicode.json`      | Unicode fractions, degree signs, accented ingredients, an RTL title.                           |
| `reuse-split.json`  | A leaf consumed by two steps, declared (I4). Exercises all three reuse strategies in Phase 02. |

## `invalid/`

One file per validator diagnostic. These exist **to fail** — `packages/corpus/src/validate.test.ts`
asserts each produces its specific code, and the E4 case asserts the suggested reordering.

| File                          | Code                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `orphan-ingredient.json`      | E1 — an ingredient no step consumes (R3)                    |
| `unreachable-step.json`       | E2 — a step outside the root's subtree                      |
| `cycle.json`                  | E3 — steps referencing each other                           |
| `non-contiguous-run.json`     | E4 — ingredient order violates leaf contiguity (I1)         |
| `undeclared-reuse.json`       | E5 — a multi-consumed leaf with no `reuse` declaration (I4) |
| `dangling-component-ref.json` | E6 — a forward reference to a later component (I5)          |
| `dangling-reference.json`     | E7 — an input naming an id that does not exist              |
| `duplicate-id.json`           | E8 — two rows sharing one id                                |

Warnings (W1–W5) are asserted against the real corpus rather than fixtures, because their
whole point is that they fire on faithfully transcribed source material.

`dangling-reference.json` is the one file still written in the long `{ "kind": …, "id": … }`
input form. In the authoring form a typo'd bare id is caught earlier, by `normalizeRecipe`, so
the long form is what still reaches the validator as E7. See
[Q4](../../../docs/findings/Q4-authoring-ergonomics.md).

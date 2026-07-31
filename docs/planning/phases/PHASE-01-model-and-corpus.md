# Phase 01 — Assembly Tree Model & Corpus

> Define the data structure, then prove it by transcribing every recipe in `images/` and
> `sources/` into it.

## Goal

A schema expressive enough to hold every recipe in the source material — including the ones
that break the naive model — plus a validator that catches the errors the original format
allows silently.

## Why here

Transcription is the cheapest possible test of a schema. Every awkwardness discovered while
hand-encoding the Shepherd's pie is an awkwardness the layout engine would otherwise inherit.
Do this before Phase 02, and Phase 02 gets a fixed target.

## Deliverables

### Schema (`packages/core/src/model.ts`)

```ts
type Recipe = {
  id: string
  title: string
  yield?: string              // "serves 4 when served over noodles or rice" (IMG_4232)
  components: Component[]     // ordered; later components may reference earlier ones
  source?: { name: string; url?: string }
}

type Component = {
  id: string
  title?: string              // omitted for single-component recipes
  prelude: Prelude[]          // full-width rows: "Preheat oven to 400°F", "Butter and flour an 8x8-in pan"
  ingredients: Ingredient[]   // leaf order — validated against the tree (I1)
  root: StepId                // the tree is stored flat and referenced by id
  steps: Record<StepId, Step>
}

type Ingredient = {
  id: IngredientId
  quantity?: Quantity         // structured, NOT a string — Phase 05 needs to scale it
  item: string                // "unsalted butter"
  note?: string               // "drained, chopped" / "Cento"
  optional?: boolean
}

type Quantity = {
  amount: number | Range      // 30 to 40 → Range
  unit: Unit
  metric?: { amount: number | Range; unit: Unit }  // authored pair, not computed (R6)
  approximate?: boolean       // "1 pinch", "salt and pepper" → quantity omitted entirely
}

type Step = {
  id: StepId
  inputs: InputRef[]          // IngredientRef | StepRef | ComponentRef  (I5)
  text: string                // "cook until meat is no longer pink"
  effort: Effort              // required, cheap — drives the duration glyph. See findings/Q5-time-axis.md
  duration?: Duration         // { min: 30, max: 40, unit: 'min' } — optional; timers only, NOT layout
  temperature?: Temperature   // { f: 350, c: 176 }  — rendered per R6
  technique?: string          // controlled vocabulary: mix | fold | sift | brown | simmer | …
  equipment?: string[]
  group?: GroupId             // explicit grouping hint for R4/R5 shading
}
```

```ts
// Resolved by findings/Q5-time-axis.md. Precise durations are rare in the source — only the
// bake in the brownies recipe has one — and the glyph that renders them can't resolve 1 min
// from 2 min anyway. Three ordinal buckets carry the decision-relevant signal at a fraction
// of the authoring cost. `long-unattended` also drives Phase 04's parallelism banner.
type Effort = 'quick' | 'minutes' | 'long-unattended'
```

### Validator (`packages/core/src/validate.ts`)

Errors:

- **E1 Orphan ingredient** — an ingredient no step consumes. This is exactly jenelope1st's
  "missing instructions for the dry ingredients" complaint (**R3**), promoted from a design
  critique to a build failure.
- **E2 Unreachable step** — a step not in the root's subtree.
- **E3 Cycle** — steps referencing each other.
- **E4 Non-contiguous run** — the authored ingredient order violates leaf contiguity (**I1**).
  Error message must include the *suggested* reordering, since that's always what the author wants.
- **E5 Multi-consumed leaf** — an ingredient consumed by more than one step without an explicit
  reuse strategy declared (**I4**).
- **E6 Dangling component ref** — referencing a component defined later or not at all.

Warnings:

- **W1** Step text longer than a threshold (drives the Phase 03 measure problem, **R9**).
- **W2** Temperature given in only one scale (**R6** parity).
- **W3** Unlabeled merge — a step with 2+ inputs whose `text` is empty.

### Corpus (`packages/corpus/recipes/`)

Transcribed from the source material:

| File | Source | Why it's in the corpus |
| --- | --- | --- |
| `grilled-artichokes.json` | `sources/` (live DOM) | Pure chain, prelude row, 3 leaves. The trivial case. |
| `espresso-brownies.json` | `IMG_4225`, `IMG_4226` | **The viral one.** Two preludes, three-way merge, wet/dry group split. The reference recipe for all UX work. |
| `beef-stroganoff.json` | `IMG_4232` | Per-ingredient prep steps at varying depth; unbalanced branches. Stresses column assignment (**I3**). |
| `shepherds-pie.json` | `IMG_4231` | Two components with a cross-component ref (**I5**); depth ~10; the widest chart in the corpus. |
| `spinach-artichoke-skillet.json` | `IMG_4230` | 15 ingredients, long chain, very long step text. Stresses vertical scale and **R9**. |

Stress fixtures (`packages/corpus/fixtures/`), synthetic:

- `reuse-split.json` — "reserve half the butter" — exercises all three **I4** strategies.
- `wide-shallow.json` — 25 ingredients, depth 2. Tall and narrow.
- `deep-narrow.json` — 3 ingredients, depth 12. Short and very wide.
- `long-text.json` — step text far beyond **W1**.
- `unicode.json` — ¼ ½ ⅓ fractions, °, accented ingredient names, an RTL title.
- `degenerate.json` — single ingredient, single step.

### Authoring ergonomics

Transcribe the first two recipes in raw JSON. If it's miserable — and it likely will be for
Shepherd's pie's ten-deep chain — that answers **Q4** and a terse indentation-based DSL with a
JSON compile step becomes a Phase 01 deliverable rather than a Phase 04 nice-to-have.

## Technical notes

**Structured quantities, not strings.** `"1-1/2 lb. (700 g) russet potatoes"` must decompose.
Phase 05's serving-size scaling is impossible otherwise, and R6's typographic control over
unit rendering requires knowing which part is the number.

**Authored metric pairs.** Do not compute `°C` from `°F`. The sources round deliberately and
inconsistently (`350°F (170°C)` in `IMG_4225` and `IMG_4228`; `400°F (204°C)` and
`400°F (205°C)` *in the same recipe* in `IMG_4231`). Preserving the author's rounding is more
faithful than being arithmetically correct, and the discrepancy is worth surfacing as a warning.

**Flat step storage with ids.** A nested tree literal is nicer to read but painful to reference
across components and to diff. Flat + ids, with a helper to build it from a nested literal for
authoring convenience.

## Acceptance criteria

- [ ] All five transcribed recipes validate clean.
- [ ] Each of E1–E6 has a fixture that triggers it and a test asserting the message.
- [ ] E4's error message includes a concrete suggested ingredient order.
- [ ] `espresso-brownies.json` round-trips to a structure that visibly matches `IMG_4225`.
- [ ] `shepherds-pie.json` resolves its mashed-potatoes reference through `ComponentRef`, not a string.
- [ ] Quantity parsing handles `1-1/2`, `1/4`, `30 to 40`, `1 pinch`, and bare `salt and pepper`.

## Out of scope

Layout. The model describes structure and content only — no columns, no spans, no geometry.

## Open questions

- Should `technique` be a closed vocabulary? A closed set enables icons and color-coding by
  technique (a possible answer to **R5**) but fights the free-text reality of recipes.
  Proposal: optional closed `technique` *alongside* required free `text`.
- Do preludes need ordering relative to each other, or is a set sufficient? `IMG_4225` shows
  two ("butter and flour the pan", "preheat oven") where order is immaterial. Assume ordered,
  cheap to relax.

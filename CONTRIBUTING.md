# Contributing

## Adding a recipe

Recipes live in `packages/corpus/recipes/` as JSON in the authoring form documented in
[`packages/corpus/README.md`](packages/corpus/README.md). The short version: read the tree off
the recipe first (a step's inputs must be contiguous ingredient rows), transcribe faithfully,
never invent a quantity or a temperature, and run the validator until it is clean:

```sh
node scripts/check-recipe.mjs packages/corpus/recipes/your-recipe.json
```

Its errors (E1–E9) and warnings (W1–W7) name the file and step, and the same check runs in CI on
every pull request that touches the corpus. Add your recipe to the pickers in
`experiments/*/src/main.*` and to `scripts/print-check.mjs` if you want it in the print gate.

Not comfortable with JSON? **Open a recipe-suggestion issue instead** — link or describe the
recipe, say where it comes from and what you change when you cook it. Transcription is a
maintainer act; the notes about how you actually make it are the valuable part (see
[Q8](docs/findings/Q8-ingesting-a-cooks-version.md) for why).

### Provenance rules (load-bearing, not paperwork)

- **Credit the source** in the file's `source` field. Adaptations must say what changed.
- **Facts and structure only.** Ingredients, quantities, step topology, timings, temperatures.
  Do not paste a source's expressive prose — rephrase step text in your own terse words.
- **No scans, photos or PDFs of published recipes** in the repo or in issues.
- Warnings are findings, not chores: if your source prints `1/4 tsp. (2.5 mL)` and that earns a
  W4, keep it. Do not "correct" the source to silence the validator.

## Code

- `pnpm check` must pass: typecheck, lint, package boundaries, format, unit tests.
- Two machine-enforced rules: **no experiment may fork `core`** (if a track needs something, it
  lands in core and the request is recorded as a finding), and **no track may import another**.
- Tracks are idiomatic within their stack; the shared surface is the `GridPlan`, the store, and
  the conventions in `packages/harness/src/protocol.ts` (which tracks may not import).
- Visual baselines are macOS-rendered; regenerate with `pnpm test:visual --update-snapshots` only
  when a change is *meant* to alter rendering, and read the diff before committing.

# @recipe/corpus

Transcribed recipes and stress fixtures, as validated JSON.

Transcription is the cheapest possible test of a schema. Every awkwardness discovered while
hand-encoding Shepherd's pie is one the layout engine would otherwise have inherited — see
[Q4](../../docs/findings/Q4-authoring-ergonomics.md) for what this corpus taught the model.

## Layout

```
recipes/    transcribed from the source material — must all validate clean
fixtures/   synthetic; see fixtures/README.md
```

Source material that is not a web page lives in `docs/sources/`.

Nine of the ten recipes are transcribed from a printed source alone. `bbq-pulled-chicken` is not:
it is a printed recipe plus a cook's notes that change the method substantially, and the notes
win where they disagree. See [Q8](../../docs/findings/Q8-ingesting-a-cooks-version.md) for what
that first non-pristine ingestion found — including a reuse split whose per-consumer portions the
model still cannot record.

## The authoring form

Files are stored in a slightly looser form than the runtime model and normalised on load by
`normalizeRecipe()`. Two conveniences, both earned during transcription:

```jsonc
"quantity": { "amount": "1-1/2", "unit": "cup" }   // as the source prints it, not 1.5
"inputs": ["whisk-dry", "water"]                   // bare ids, resolved by lookup
```

The strict forms (`1.5`, `{ "kind": "step", "id": "whisk-dry" }`) still work and pass through
untouched. Nothing is guessed: an unreadable amount, an id that matches nothing, or an id that
names both a step and an ingredient all throw, naming the file and step.

`scripts/terse-corpus.mjs` converts committed files into this form. It is idempotent, emits
Prettier-shaped output, and verifies each rewrite by normalising before and after and comparing
with `deepStrictEqual` — a transcription checked by eye against a photograph is not something to
reformat on trust.

## Working on a recipe

```sh
node scripts/check-recipe.mjs packages/corpus/recipes/espresso-brownies.json
```

Prints errors and warnings for one file in about a second. `pnpm test` is the authority.

**Warnings are findings, not chores.** The corpus deliberately keeps every warning its sources
earn: the brownies' `1/4 tsp. (2.5 mL)` vanilla is 103% off, Shepherd's pie prints both
`400°F (204°C)` and `400°F (205°C)`, and two recipes fold four raw ingredients into a prepared
mixture with no combining step (W5 — the implicit join jenelope1st fixed by hand). Do not
"correct" the source to silence them.

## Adding a recipe

1. Read the tree off the grid before writing anything: a step cell's vertical extent is exactly
   the set of ingredient rows it consumes.
2. Order `ingredients` to match the source's column, then check contiguity — a step's inputs must
   be adjacent rows. E4 will tell you the order that works.
3. Transcribe faithfully. Never invent a quantity, a temperature, or a step. Authored metric
   pairs are copied as printed, even where the conversion is wrong.
4. `effort` is required and is a judgement call; `duration` is optional and only goes in when the
   source printed one.
5. Where a cook's notes disagree with the printed recipe, the notes are the source. Record what
   the printed version said in a `note` on the ingredient or in the step text — it is provenance,
   not a correction to make silently.

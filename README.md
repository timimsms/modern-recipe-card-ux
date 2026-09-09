# Modern Recipe Card UX

A lab for rebuilding the [Cooking For Engineers](https://www.cookingforengineers.com/) recipe grid
— and for using that rebuild as a fixed control variable to compare frontend approaches.

The format's insight is that **a recipe is not a list, it's a tree of convergence.** Ingredients
are leaves, steps are internal nodes that consume leaves and other steps, the finished dish is the
root. A numbered recipe destroys that structure; the grid preserves it, which is why one glance
tells you what runs in parallel and what waits on what.

The original is a 2004 HTML table, and it shows. The premise here is to separate the idea from the
rendering: build the idea once as a rigorous shared core, then render it four independent ways and
measure what each approach actually costs.

## Status

**Phases 00–06 are built; Phase 07 (the four-track bake-off) is under way.**
501 unit tests, 169 browser tests, a 7/7 print pipeline, all green.

- `@recipe/core` — the model, validator (E1–E9, W1–W7), layout engine
  (`AssemblyTree → GridPlan`), kitchen state store, serving-size scaling with unit ladders, and a
  structural-narrative generator that says the tree out loud. Zero dependencies, zero DOM,
  loadable straight from `dist/` in a browser.
- A nine-recipe corpus plus stress fixtures, in a documented JSON authoring form with a validator
  whose errors name the file and step.
- Four renderers over the identical plan:

| track | stack | ships | state |
| --- | --- | --- | --- |
| `01-css-grid` | no framework, no bundler | **0 KB JS** for a correct static chart | full feature surface, accessibility-audited |
| `02-react-shadcn` | React, Tailwind v4, Radix | 77 KB gz | chart, cook mode, check-off, scaling |
| `03-svg` | no framework — a drawn dendrogram | **0 KB JS** static | chart, cook mode; owns the non-planar reuse case with real connectors |
| `04-alt-frameworks` | Svelte 5 and Solid, one shared design | 25 / 16 KB gz | chart, cook mode, check-off, scaling |

The interesting output is as much the **findings** as the code: 15 written findings in
[`docs/findings/`](docs/findings/), several of which overturned the project's own assumptions —
the format's headline "parallel saving" is zero for a lone cook on every recipe measured
([P02](docs/findings/P02-parallel-saving.md)), and saying the tree out loud found four bugs the
chart had been hiding ([R10](docs/findings/R10-saying-the-tree-out-loud.md)).

## Try it

```sh
pnpm install
pnpm build                # compiles core (the no-bundler tracks load its dist/ directly)
pnpm serve                # → http://localhost:8731/experiments/01-css-grid/
```

Deep links work: `?recipe=bbq-pulled-chicken&view=cook` opens cook mode on that recipe.

```sh
pnpm check                # typecheck, lint, package boundaries, format, unit tests
pnpm test:visual          # builds tracks 02/04, then Playwright suites + screenshot baselines
pnpm test:print           # renders the corpus to PDF and checks it survives paper
node scripts/check-recipe.mjs packages/corpus/recipes/<file>.json
```

## Where to start

| If you want to… | Read |
| --- | --- |
| Pick up where the last session left off | **[`docs/planning/STATE.md`](docs/planning/STATE.md)** |
| Understand the thesis and architecture | [`docs/planning/GAMEPLAN.md`](docs/planning/GAMEPLAN.md) |
| Read what the build actually taught | [`docs/findings/`](docs/findings/) |
| See each track's honest build diary | `experiments/*/NOTES.md` |
| Work a specific phase | [`docs/planning/phases/`](docs/planning/phases/) |
| Add a recipe | [`packages/corpus/README.md`](packages/corpus/README.md) |

## Source material

The format spread as screenshots of a viral Threads discussion — effectively a crowd-sourced
usability audit, mapped to requirements R1–R9 in [`GAMEPLAN.md` §2.2](docs/planning/GAMEPLAN.md).
Third-party screenshots and scanned source recipes were reviewed during planning and are **not
redistributed in this repo**; the docs preserve their substance as short attributed quotes.
Recipe data is transcribed as facts and structure (ingredients, quantities, step topology), with
sources credited in each corpus file.

## The rules

```
packages/
  core/       schema, validator, layout engine, store, narrator. No deps, no DOM.
  corpus/     recipes and stress fixtures as validated JSON
  tokens/     design tokens → CSS vars, TS, JSON — contrast-validated by test
  harness/    bake-off instrumentation (tracks may not import it)
experiments/
  01-css-grid/       the reference renderer
  02-react-shadcn/   the mainstream production stack
  03-svg/            a drawn dendrogram — owns the non-planar reuse case
  04-alt-frameworks/ Svelte and Solid on one shared design
```

Two hard rules, both machine-enforced: **no experiment may fork `core`** — if a track needs
something, it lands in core, every track gets it, and the request is recorded as a finding — and
**no track may import another**, so the Phase 08 comparison measures rendering rather than
sharing.

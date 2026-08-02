# Modern Recipe Card UX

A lab for rebuilding the [Cooking For Engineers](https://www.cookingforengineers.com/) recipe grid
— and for using that rebuild as a fixed control variable to compare frontend approaches.

The format's insight is that **a recipe is not a list, it's a tree of convergence.** Ingredients
are leaves, steps are internal nodes that consume leaves and other steps, the finished dish is the
root. A numbered recipe destroys that structure; the grid preserves it, which is why one glance
tells you what runs in parallel and what waits on what.

Everything else about the original is a 2004 HTML table, and it shows. The premise here is to
separate the idea from the rendering, build the idea once as a rigorous shared core, then swap
renderers against it.

## Status

**Planning complete, nothing built yet.** Phase 00 (scaffold) has not started.

Two design questions are resolved; the layout engine's shape is still open pending two more.

## Where to start

| If you want to… | Read |
| --- | --- |
| Pick up where the last session left off | **[`docs/planning/STATE.md`](docs/planning/STATE.md)** |
| Understand the thesis and architecture | [`docs/planning/GAMEPLAN.md`](docs/planning/GAMEPLAN.md) |
| See the current reference design | [`docs/design/`](docs/design/) — open the HTML directly, no build needed |
| Work a specific phase | [`docs/planning/phases/`](docs/planning/phases/) |
| Know what might still break the design | [`docs/planning/EDGE-CASES.md`](docs/planning/EDGE-CASES.md) |
| Resolve an open design question | [`docs/planning/prompts/`](docs/planning/prompts/) |

## Source material

- `images/` — screenshots of the viral Threads thread, which is effectively a crowd-sourced
  usability audit of the format. Mapped to requirements R1–R9 in
  [`GAMEPLAN.md` §2.2](docs/planning/GAMEPLAN.md).
- `sources/` — links to the original site. Its table markup is decoded in
  [`GAMEPLAN.md` §2.1](docs/planning/GAMEPLAN.md); the site returns **403** to `curl` and
  scripted fetches, so it was read via browser automation.

## Planned shape

```
packages/
  core/       schema, validator, layout engine (AssemblyTree → GridPlan). No deps, no DOM.
  corpus/     recipes and stress fixtures as validated JSON
  tokens/     design tokens → CSS vars, TS, JSON
  harness/    bake-off instrumentation
experiments/
  01-css-grid/       vanilla HTML + CSS Grid — the reference renderer
  02-react-shadcn/   React + Tailwind + shadcn/ui
  03-svg/            SVG/canvas dendrogram — owns the non-planar reuse case
  04-alt-frameworks/ Svelte / Solid / Vue on the identical GridPlan
```

One hard rule: **no experiment may fork `core`.** If a track needs something core doesn't expose,
it lands in core and every track gets it — and the request itself is a finding.

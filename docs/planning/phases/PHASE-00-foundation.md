# Phase 00 — Foundation & Scaffold

> Establish the monorepo and the package boundaries that keep the bake-off honest.

## Goal

Get to a repo where `packages/core` can be imported by four different frontend toolchains
without any of them being able to quietly fork it. Nothing renders yet; the point is that the
boundaries exist before anyone is tempted to cross them.

## Why here

The single biggest failure mode for this project is experiment tracks drifting apart —
one gets a hand-tuned layout tweak, another gets a different ingredient order, and the
comparison in Phase 08 becomes meaningless. The boundary has to be structural, not a
promise made in a README.

## Deliverables

- pnpm workspace monorepo, TypeScript project references, shared `tsconfig.base.json`.
- Package skeletons with enforced boundaries:
  - `packages/core` — **zero runtime dependencies, zero DOM references.**
  - `packages/corpus` — depends on `core` only (for validated types).
  - `packages/tokens` — no dependencies; build step emits CSS/TS/JSON.
  - `packages/harness` — dev-only.
  - `experiments/*` — may depend on `core`, `corpus`, `tokens`. **May not depend on each other.**
- Lint rule enforcing the dependency graph (`eslint-plugin-import` `no-restricted-paths`, or
  `dependency-cruiser`). A track importing another track's component must fail CI.
- Vitest configured at the root, running per-package.
- CI: typecheck, lint, test, boundary check. Fast — this runs constantly.
- `.editorconfig`, Prettier, `.gitignore`, and a `.nvmrc`/`engines` pin.

## Technical notes

**Build tooling per track.** Each experiment owns its own bundler config, because bundler
choice *is* part of what's being compared. Don't unify them. `01-css-grid` should have
essentially no build step beyond a static server — that's the point of the track.

**Core must stay portable.** `packages/core` will be consumed by a vanilla ESM `<script type="module">`
in track 01 with no bundler at all. That means: no path aliases in its emitted output, explicit
`.js` extensions in relative imports, and a `dist/` that a browser can load directly.

**Node version.** Pin it. A layout engine with golden-file tests is exactly the kind of thing
that produces spurious diffs across Node versions if number formatting drifts.

## Acceptance criteria

- [ ] `pnpm install && pnpm build && pnpm test` succeeds from a clean clone.
- [ ] Importing `experiments/02-react-shadcn` from `experiments/03-svg` fails lint.
- [ ] Adding any dependency to `packages/core/package.json` fails CI.
- [ ] `packages/core/dist/index.js` loads in a browser via a bare `<script type="module">`.
- [ ] CI completes in under a minute on an empty repo.

## Out of scope

Any rendering, any tokens with real values, any recipe data. Placeholder exports only.

## Open questions

- Does `packages/tokens` need a real build step (Style Dictionary) or is a hand-written TS
  file that exports both a CSS string and typed objects sufficient at this scale? Start hand-written;
  revisit if Phase 03 finds it unmanageable.

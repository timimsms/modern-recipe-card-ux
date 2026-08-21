/**
 * @recipe/core — the assembly tree model, its validator, and the layout engine.
 *
 * Hard constraints, enforced by tests in `src/purity.test.ts`:
 *   - zero runtime dependencies
 *   - zero DOM references (the `lib` in tsconfig omits DOM, so a slip fails typecheck)
 *   - loadable directly in a browser via `<script type="module">` from `dist/`
 */

export * from './authoring.js'
export * from './layout.js'
export * from './model.js'
export * from './quantity.js'
export * from './validate.js'

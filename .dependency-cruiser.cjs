/**
 * Structural enforcement of the architecture in GAMEPLAN.md §6.
 *
 * The point of Phase 00 is that the package boundaries are enforced rather than promised.
 * The single biggest failure mode for this project is experiment tracks quietly drifting
 * apart; by Phase 08 that would make the bake-off measure nothing.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports make the layout engine impossible to reason about.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-is-pure',
      severity: 'error',
      comment:
        'packages/core must have zero runtime dependencies — not even Node builtins. It is ' +
        'consumed by a bare <script type="module"> in track 01 with no bundler at all.',
      from: { path: '^packages/core/src/' },
      to: { pathNot: '^packages/core/src/' },
    },
    {
      name: 'corpus-depends-on-core-only',
      severity: 'error',
      from: { path: '^packages/corpus/src/' },
      to: {
        pathNot: ['^packages/corpus/', '^packages/core/', 'node_modules/@recipe/core/'],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'tokens-has-no-deps',
      severity: 'error',
      comment: 'Tokens are a leaf. They emit CSS/TS/JSON and know nothing about the model.',
      from: { path: '^packages/tokens/src/' },
      to: { pathNot: '^packages/tokens/src/' },
    },
    {
      name: 'no-cross-experiment',
      severity: 'error',
      comment:
        'No experiment track may import another. Sharing a component would make the ' +
        'Phase 08 comparison meaningless. If two tracks need the same thing, it belongs in core.',
      from: { path: '^experiments/([^/]+)/' },
      to: { path: '^experiments/([^/]+)/', pathNot: '^experiments/$1/' },
    },
    {
      name: 'experiments-may-not-import-harness',
      severity: 'error',
      comment: 'The harness measures the tracks. A track that imports it is measuring itself.',
      from: { path: '^experiments/' },
      to: { path: '^packages/harness/' },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Entry points are exempt; anything else unreachable is dead weight.',
      from: {
        orphan: true,
        pathNot: [
          '^packages/[^/]+/src/index\\.ts$',
          '^experiments/[^/]+/src/main\\.js$',
          '\\.d\\.ts$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Build output is a copy of src; cruising it double-reports every module.
    exclude: { path: ['\\.test\\.ts$', '/dist/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.mjs', '.ts', '.mts'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}

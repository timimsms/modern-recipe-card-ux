import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'sources/**', 'docs/design/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Repo scripts are Node programs, not library code. Declared explicitly rather than
    // pulling in `globals` for six names.
    files: ['scripts/**/*.mjs', '*.config.js', '*.cjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        module: 'writable',
        require: 'readonly',
        // Scripts that drive a browser pass callbacks to `page.evaluate`, whose bodies run in
        // the page rather than in Node. They are browser code that merely lives in a Node file.
        document: 'readonly',
        window: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
  },
  {
    // The experiment tracks run in a browser with no bundler, so they legitimately reach for
    // browser globals. Declared explicitly rather than pulling in `globals` for a handful.
    files: ['experiments/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Event: 'readonly',
        Element: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        queueMicrotask: 'readonly',
        requestAnimationFrame: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        Notification: 'readonly',
        CSS: 'readonly',
      },
    },
  },
  {
    // packages/core is consumed unbundled in a browser. `no-undef` with no globals declared
    // is a cheap second line of defence behind tsconfig's DOM-free `lib`.
    files: ['packages/core/src/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'packages/core must not reference the DOM.' },
        { name: 'window', message: 'packages/core must not reference the DOM.' },
        { name: 'process', message: 'packages/core must not reference Node.' },
      ],
    },
  },
)

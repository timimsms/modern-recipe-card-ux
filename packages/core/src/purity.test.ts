import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')

/**
 * PHASE-00 acceptance: "Adding any dependency to packages/core/package.json fails CI."
 *
 * The dependency-cruiser `core-is-pure` rule catches imports; this catches the manifest,
 * which is the thing a well-meaning contributor edits first.
 */
describe('packages/core is dependency-free', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as Record<
    string,
    unknown
  >

  it.each(['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'])(
    'declares no %s',
    (field) => {
      expect(pkg[field] ?? {}).toEqual({})
    },
  )
})

describe('packages/core references no host environment', () => {
  const sources = readdirSync(join(pkgRoot, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => ({ file: f, text: readFileSync(join(pkgRoot, 'src', f), 'utf8') }))

  it('has sources to check', () => {
    expect(sources.length).toBeGreaterThan(0)
  })

  // Track 01 loads dist/ straight into a browser with no bundler; the harness and the Node
  // test runner load the same files. Neither environment may be assumed.
  it.each(['document', 'window', 'globalThis.document', 'process.', 'require('])(
    'never mentions %s',
    (needle) => {
      const offenders = sources.filter((s) => s.text.includes(needle)).map((s) => s.file)
      expect(offenders).toEqual([])
    },
  )

  it('imports nothing outside itself', () => {
    const importPattern = /(?:^|\n)\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g
    const offenders: string[] = []
    for (const { file, text } of sources) {
      for (const [, spec] of text.matchAll(importPattern)) {
        if (spec && !spec.startsWith('./') && !spec.startsWith('../')) {
          offenders.push(`${file} → ${spec}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  // Relative imports must carry explicit .js extensions, or dist/ will not load from a
  // bare <script type="module">. NodeNext enforces this at compile time; this asserts it
  // at the level the acceptance criterion is written in.
  it('uses explicit .js extensions in relative imports', () => {
    const relativePattern = /from\s*['"](\.[^'"]+)['"]/g
    const offenders: string[] = []
    for (const { file, text } of sources) {
      for (const [, spec] of text.matchAll(relativePattern)) {
        if (spec && !spec.endsWith('.js')) offenders.push(`${file} → ${spec}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

/**
 * PHASE-00 acceptance: "packages/core/dist/index.js loads in a browser via a bare
 * <script type="module">."
 *
 * A browser has no bare-specifier resolution and no import maps unless the page supplies
 * one, so every specifier in the emitted output has to be a relative path ending in `.js`.
 * The suite runs against `src` (see vitest.config.ts), so this is the one place `dist` is
 * checked — skipped rather than failed when the build has not run, since `pnpm ci` builds first.
 */
const distDir = join(pkgRoot, 'dist')

describe.skipIf(!existsSync(distDir))('packages/core/dist is browser-loadable', () => {
  const emitted = readdirSync(distDir).filter((f) => f.endsWith('.js'))

  it('emits JavaScript', () => {
    expect(emitted).toContain('index.js')
  })

  it('contains only relative, extension-qualified specifiers', () => {
    // Anchored to the start of a line: `from "..."` also occurs in prose inside the JSDoc
    // that tsc carries through to the emitted output.
    const specifierPattern = /^\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]/gm
    const offenders: string[] = []
    for (const file of emitted) {
      const text = readFileSync(join(distDir, file), 'utf8')
      for (const [, spec] of text.matchAll(specifierPattern)) {
        if (!spec) continue
        const relative = spec.startsWith('./') || spec.startsWith('../')
        if (!relative || !spec.endsWith('.js')) offenders.push(`${file} → ${spec}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('actually evaluates, with the public API intact', async () => {
    const mod = (await import(join(distDir, 'index.js'))) as Record<string, unknown>
    expect(typeof mod.validateRecipe).toBe('function')
    expect(typeof mod.leafOrder).toBe('function')
  })
})

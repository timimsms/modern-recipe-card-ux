#!/usr/bin/env node
/**
 * Rewrites committed corpus files into the authoring form: bare input ids and fraction
 * strings instead of `{ "kind": …, "id": … }` objects and long decimals.
 *
 * Safe by construction — each file is normalised before and after the rewrite and the two
 * results are compared with `deepStrictEqual`. If they differ at all, the original is put
 * back and the file is reported. A transcription that four people checked by eye against
 * photographs is not something to reformat on trust.
 *
 *   node scripts/terse-corpus.mjs            # rewrite
 *   node scripts/terse-corpus.mjs --check    # report what would change, write nothing
 */
import { deepStrictEqual } from 'node:assert'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { normalizeRecipe } from '../packages/core/dist/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const corpus = join(root, 'packages', 'corpus')
const dirs = [
  join(corpus, 'recipes'),
  join(corpus, 'fixtures', 'valid'),
  join(corpus, 'fixtures', 'invalid'),
]

const checkOnly = process.argv.includes('--check')

/** Denominators the sources actually print. Anything else stays a decimal. */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 16]

function toFractionString(value) {
  if (typeof value !== 'number' || Number.isInteger(value) || value <= 0) return undefined
  const whole = Math.floor(value)
  const remainder = value - whole
  for (const den of DENOMINATORS) {
    const num = Math.round(remainder * den)
    if (num === 0 || num === den) continue
    if (Math.abs(remainder - num / den) < 1e-9) {
      return whole === 0 ? `${num}/${den}` : `${whole}-${num}/${den}`
    }
  }
  return undefined
}

function terseAmount(amount) {
  if (amount && typeof amount === 'object' && 'from' in amount) {
    return Number.isInteger(amount.from) && Number.isInteger(amount.to)
      ? `${amount.from} to ${amount.to}`
      : amount
  }
  return toFractionString(amount) ?? amount
}

function terseQuantity(quantity) {
  if (!quantity) return quantity
  const out = { ...quantity, amount: terseAmount(quantity.amount) }
  if (quantity.metric) {
    out.metric = { ...quantity.metric, amount: terseAmount(quantity.metric.amount) }
  }
  return out
}

function terseComponent(component) {
  const leafIds = new Set(component.ingredients.map((l) => l.id))
  const stepIds = new Set(Object.keys(component.steps))
  const ambiguous = [...stepIds].some((id) => leafIds.has(id))

  const steps = {}
  for (const [key, step] of Object.entries(component.steps)) {
    steps[key] = {
      ...step,
      // Already-terse inputs pass through; the script has to be idempotent because it is
      // the thing that keeps the corpus in one form.
      inputs: step.inputs.map((input) =>
        typeof input === 'string' || ambiguous ? input : input.id,
      ),
    }
  }

  return {
    ...component,
    ingredients: component.ingredients.map((leaf) =>
      leaf.quantity ? { ...leaf, quantity: terseQuantity(leaf.quantity) } : leaf,
    ),
    steps,
  }
}

/**
 * JSON.stringify puts every object on its own set of lines, which turns `{"min": 30, "unit":
 * "min"}` into four. Prettier's `objectWrap: preserve` then keeps that choice, so the corpus
 * ends up longer than the hand-written files it replaced. These are documents people proofread
 * against photographs — keep short objects on one line.
 *
 * Output is Prettier-shaped (spaces inside braces, 100-column budget) so `format:check` passes
 * without Prettier re-expanding everything on the next run.
 */
const PRINT_WIDTH = 100

/** `column` is where this value starts on its line, so nesting can't overflow the budget. */
function print(value, indent, column) {
  // Primitives are never split — a 346-character step text is one line however long it is.
  if (value === null || typeof value !== 'object') return JSON.stringify(value)

  const inline = inlineOf(value)
  // +1 for the trailing comma Prettier counts against the same line.
  if (column + inline.length + 1 <= PRINT_WIDTH) return inline

  const pad = ' '.repeat(indent)
  const innerIndent = indent + 2
  const inner = ' '.repeat(innerIndent)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => inner + print(v, innerIndent, innerIndent))
    return `[\n${items.join(',\n')}\n${pad}]`
  }

  const entries = Object.entries(value).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return '{}'
  const body = entries.map(([k, v]) => {
    const key = `${JSON.stringify(k)}: `
    return `${inner}${key}${print(v, innerIndent, innerIndent + key.length)}`
  })
  return `{\n${body.join(',\n')}\n${pad}}`
}

function inlineOf(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(inlineOf).join(', ')}]`
  const entries = Object.entries(value).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return '{}'
  return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inlineOf(v)}`).join(', ')} }`
}

let changed = 0
let reverted = 0

for (const dir of dirs) {
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const path = join(dir, name)
    const original = readFileSync(path, 'utf8')
    const parsed = JSON.parse(original)

    let before
    try {
      before = normalizeRecipe(parsed)
    } catch {
      // Fixtures that exist to fail may not normalise; leave them exactly as authored.
      continue
    }

    const rewritten = { ...parsed, components: parsed.components.map(terseComponent) }
    const text = print(rewritten, 0, 0) + '\n'
    if (text === original) continue

    try {
      deepStrictEqual(normalizeRecipe(JSON.parse(text)), before)
    } catch (error) {
      console.log(`! ${name} — rewrite would change meaning, left alone\n    ${error.message}`)
      reverted++
      continue
    }

    if (!checkOnly) writeFileSync(path, text)
    const delta = text.split('\n').length - original.split('\n').length
    console.log(`${checkOnly ? 'would rewrite' : 'rewrote'} ${name} (${delta} lines)`)
    changed++
  }
}

console.log(`\n${changed} file(s) ${checkOnly ? 'would change' : 'rewritten'}, ${reverted} skipped`)

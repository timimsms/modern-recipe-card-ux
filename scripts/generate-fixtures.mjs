#!/usr/bin/env node
/**
 * Emits the two mechanical stress fixtures.
 *
 * These are generated rather than hand-written because their whole content is a repeated
 * pattern, and because "25 ingredients" and "depth 12" are the parameters — a reviewer should
 * be able to see the shape at a glance instead of counting rows in a diff. The output is
 * committed, so nothing at test time depends on this script.
 *
 *   node scripts/generate-fixtures.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const validDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages',
  'corpus',
  'fixtures',
  'valid',
)

const write = (name, recipe) => {
  writeFileSync(join(validDir, name), JSON.stringify(recipe, null, 2) + '\n')
  console.log(`wrote ${name}`)
}

// --- wide-shallow: 25 leaves, depth 2. Tall and narrow. --------------------------------
{
  const GROUPS = 5
  const PER_GROUP = 5
  const ingredients = []
  const steps = {}
  const rootInputs = []

  for (let g = 0; g < GROUPS; g++) {
    const groupInputs = []
    for (let i = 0; i < PER_GROUP; i++) {
      const id = `ing-${g + 1}-${i + 1}`
      ingredients.push({
        id,
        quantity: { amount: i + 1, unit: 'Tbs' },
        item: `ingredient ${g + 1}.${i + 1}`,
      })
      groupInputs.push({ kind: 'ingredient', id })
    }
    const stepId = `combine-${g + 1}`
    steps[stepId] = {
      id: stepId,
      inputs: groupInputs,
      text: `combine group ${g + 1}`,
      effort: 'quick',
      technique: 'mix',
      group: `g${g + 1}`,
    }
    rootInputs.push({ kind: 'step', id: stepId })
  }

  steps['assemble'] = {
    id: 'assemble',
    inputs: rootInputs,
    text: 'stir everything together',
    effort: 'minutes',
    technique: 'assemble',
  }

  write('wide-shallow.json', {
    id: 'wide-shallow',
    title: 'Wide Shallow',
    yield: `${GROUPS * PER_GROUP} ingredients, depth 2 — tall and narrow`,
    servings: 4,
    components: [{ id: 'only', prelude: [], ingredients, root: 'assemble', steps }],
  })
}

// --- deep-narrow: 3 leaves, depth 12. Short and very wide. ------------------------------
{
  const DEPTH = 12
  const ingredients = [
    { id: 'base', quantity: { amount: 1, unit: 'cup' }, item: 'base' },
    { id: 'middle', quantity: { amount: 1, unit: 'tsp' }, item: 'midway addition' },
    {
      id: 'finish',
      quantity: { amount: 1, unit: 'pinch' },
      item: 'finishing salt',
      approximate: true,
    },
  ]
  const steps = {}

  // A single chain. The two extra leaves join partway along, so every step but the first has
  // exactly one step input — the worst case for column assignment, and the widest chart.
  for (let d = 1; d <= DEPTH; d++) {
    const inputs =
      d === 1 ? [{ kind: 'ingredient', id: 'base' }] : [{ kind: 'step', id: `step-${d - 1}` }]
    if (d === Math.ceil(DEPTH / 2)) inputs.push({ kind: 'ingredient', id: 'middle' })
    if (d === DEPTH) inputs.push({ kind: 'ingredient', id: 'finish' })
    steps[`step-${d}`] = {
      id: `step-${d}`,
      inputs,
      text: `stage ${d}`,
      effort: d % 4 === 0 ? 'long-unattended' : 'quick',
      ...(d % 4 === 0 ? { duration: { min: 10, unit: 'min' } } : {}),
    }
  }

  write('deep-narrow.json', {
    id: 'deep-narrow',
    title: 'Deep Narrow',
    yield: `3 ingredients, depth ${DEPTH} — short and very wide`,
    servings: 1,
    components: [{ id: 'only', prelude: [], ingredients, root: `step-${DEPTH}`, steps }],
  })
}

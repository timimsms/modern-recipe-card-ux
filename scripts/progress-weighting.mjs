#!/usr/bin/env node
/**
 * Measures the claim the store is built on: that weighting progress by time rather than by step
 * count tells the cook something different.
 *
 * It is easy to assert. Phase 04 already caught two features whose justification evaporated on
 * contact with the corpus (the parallelism banner fires on 0 of 66 steps; parallel saving is 0
 * for 5 of 9 components), so this one gets measured before it gets built into every track.
 *
 * Walks each component in cook-schedule order and reports both figures at every step.
 *
 *   node scripts/progress-weighting.mjs
 *   node scripts/progress-weighting.mjs --verbose   # every step of every component
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cookSchedule, normalizeRecipe, stepMinutes, stepsOf } from '../packages/core/dist/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const recipeDir = join(root, 'packages', 'corpus', 'recipes')
const verbose = process.argv.includes('--verbose')

const pct = (n) => `${Math.round(n * 100)}%`.padStart(4)

const rows = []
let worst = null

for (const file of readdirSync(recipeDir)
  .filter((f) => f.endsWith('.json'))
  .sort()) {
  const recipe = normalizeRecipe(JSON.parse(readFileSync(join(recipeDir, file), 'utf8')))

  for (const component of recipe.components) {
    const steps = stepsOf(component)
    const total = steps.reduce((sum, s) => sum + stepMinutes(s), 0)
    if (steps.length === 0 || total === 0) continue

    const order = cookSchedule(component).order
    const done = new Set()
    let peak = { gap: 0 }

    for (const id of order) {
      done.add(id)
      const byCount = done.size / steps.length
      const byTime =
        steps.filter((s) => done.has(s.id)).reduce((sum, s) => sum + stepMinutes(s), 0) / total
      const gap = byCount - byTime

      if (verbose) {
        console.log(
          `  ${file.replace('.json', '')}/${component.id} ${String(done.size).padStart(2)}/${steps.length}` +
            `  count ${pct(byCount)}  time ${pct(byTime)}  overstates by ${pct(gap)}`,
        )
      }
      if (gap > peak.gap) peak = { gap, at: done.size, of: steps.length, byCount, byTime }
    }

    const label = `${file.replace('.json', '')}/${component.id}`
    rows.push({ label, steps: steps.length, minutes: total, ...peak })
    if (!worst || peak.gap > worst.gap) worst = { label, ...peak }
  }
}

rows.sort((a, b) => b.gap - a.gap)

console.log('\nWorst overstatement per component — where a step-count bar is most misleading:\n')
console.log('  component                          steps   total   at      by count   by time   gap')
for (const r of rows) {
  console.log(
    `  ${r.label.padEnd(33)} ${String(r.steps).padStart(4)}  ${String(Math.round(r.minutes)).padStart(5)}m  ` +
      `${r.at ? `${r.at}/${r.of}`.padEnd(6) : '—'.padEnd(6)}  ${pct(r.byCount ?? 0)}      ${pct(r.byTime ?? 0)}     ${pct(r.gap)}`,
  )
}

const gaps = rows.map((r) => r.gap)
const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
const over20 = rows.filter((r) => r.gap >= 0.2).length
const over40 = rows.filter((r) => r.gap >= 0.4).length

console.log(`\n  components measured:            ${rows.length}`)
console.log(`  mean worst-case overstatement:  ${pct(mean)}`)
console.log(`  overstates by ≥20% somewhere:   ${over20}/${rows.length}`)
console.log(`  overstates by ≥40% somewhere:   ${over40}/${rows.length}`)
console.log(
  `  worst:                          ${worst.label} at ${worst.at}/${worst.of} — ` +
    `a step-count bar says ${pct(worst.byCount)}, the clock says ${pct(worst.byTime)}\n`,
)

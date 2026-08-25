#!/usr/bin/env node
/**
 * Prints the structural narrative for the corpus, so it can be *read*.
 *
 * PHASE-06 says to try generated prose first and let the corpus show where it reads robotically.
 * That only works if someone looks at all of it — `describeOutput` produced three confident
 * falsehoods on this corpus and every one of them was fluent enough to pass a spot check.
 *
 *   node scripts/narrate.mjs                      # summaries only
 *   node scripts/narrate.mjs --full               # every step of every recipe
 *   node scripts/narrate.mjs shepherds-pie --full
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { narrate, normalizeRecipe } from '../packages/core/dist/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const recipeDir = join(root, 'packages', 'corpus', 'recipes')

const args = process.argv.slice(2)
const full = args.includes('--full')
const only = args.find((a) => !a.startsWith('--'))

const files = readdirSync(recipeDir)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => !only || f.startsWith(only))
  .sort()

const wrap = (text, width = 92, indent = '  ') =>
  text
    .split(' ')
    .reduce(
      (lines, word) => {
        const last = lines[lines.length - 1]
        if ((last + ' ' + word).length > width) lines.push(word)
        else lines[lines.length - 1] = last === '' ? word : last + ' ' + word
        return lines
      },
      [''],
    )
    .map((line) => indent + line)
    .join('\n')

for (const file of files) {
  const recipe = normalizeRecipe(JSON.parse(readFileSync(join(recipeDir, file), 'utf8')))
  const narration = narrate(recipe)

  console.log(`\n${'='.repeat(94)}\n${file.replace('.json', '')}\n${'='.repeat(94)}`)
  console.log(wrap(narration.summary))

  if (!full) continue
  console.log()
  for (const step of narration.steps) console.log(wrap(step.spoken) + '\n')
}

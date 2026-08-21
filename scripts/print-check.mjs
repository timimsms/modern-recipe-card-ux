#!/usr/bin/env node
/**
 * Prints every corpus recipe to PDF through Chromium's real print pipeline.
 *
 * People print recipes, and the wall-chart is a print artifact as much as a screen one. Every
 * greyscale check so far has been a proxy — a `filter: grayscale(1)` pass or a luminance
 * calculation — and neither exercises `print-color-adjust`, page breaks, or the print
 * stylesheet. This does.
 *
 *   node scripts/print-check.mjs            # writes to the scratch dir and reports
 *   node scripts/print-check.mjs --out dir
 *
 * Output is deliberately not committed: PDFs are large, binary, and the thing worth keeping is
 * the assertion, not the artifact.
 */
import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
// @playwright/test re-exports the browser API, so this needs no extra dependency.
import { chromium } from '@playwright/test'

const outIndex = process.argv.indexOf('--out')
const outDir = outIndex === -1 ? join(process.cwd(), '.print-check') : process.argv[outIndex + 1]
const base = process.env.BASE_URL ?? 'http://localhost:8731'

const SLUGS = [
  'recipes/espresso-brownies',
  'recipes/no-knead-bread',
  'recipes/shepherds-pie',
  'recipes/beef-stroganoff',
  'recipes/spinach-artichoke-skillet',
  'fixtures/valid/long-text',
]

mkdirSync(outDir, { recursive: true })

/**
 * A4 landscape at 96dpi, less 10mm margins each side: (297 − 20)mm ≈ 1047px wide, 190mm ≈ 718px
 * tall. Emulating print media in a 1400px window is not a print check — the chart measures
 * itself against the window, so it "fits" right up until it reaches paper.
 */
const PRINTABLE = { width: 1047, height: 718 }

const browser = await chromium.launch()
const page = await browser.newPage({ colorScheme: 'light', viewport: PRINTABLE })
let failures = 0

for (const slug of SLUGS) {
  await page.goto(`${base}/experiments/01-css-grid/`)
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  await page.selectOption('#recipe', slug)
  await page.waitForSelector('.card')

  // What the print stylesheet is actually asked to preserve: the depth ramp is information, and
  // browsers drop backgrounds when printing unless told otherwise.
  await page.emulateMedia({ media: 'print' })
  const printed = await page.evaluate(() => {
    const step = document.querySelector('.step')
    const controls = document.querySelector('.controls')
    return {
      colorAdjust:
        getComputedStyle(step).printColorAdjust || getComputedStyle(step).webkitPrintColorAdjust,
      stepBackground: getComputedStyle(step).backgroundColor,
      controlsHidden: getComputedStyle(controls).display === 'none',
      ticksHidden: getComputedStyle(document.querySelector('.tick')).display === 'none',
      scrollerVisible:
        getComputedStyle(document.querySelector('.scroller')).overflowX === 'visible',
      widest: Math.max(...[...document.querySelectorAll('.chart')].map((c) => c.scrollWidth)),
      cardOverflows: document.querySelector('.card').scrollWidth > window.innerWidth + 1,
    }
  })
  await page.emulateMedia({ media: null })

  const file = join(outDir, `${slug.replace(/\//g, '-')}.pdf`)
  await page.pdf({
    path: file,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
  })
  const bytes = statSync(file).size

  const problems = []
  if (!printed.controlsHidden) problems.push('control bar is not hidden')
  if (!printed.ticksHidden) problems.push('check-off boxes are not hidden')
  if (!printed.scrollerVisible)
    problems.push('chart is still in a scroll container, so it will be clipped')
  if (printed.stepBackground === 'rgba(0, 0, 0, 0)')
    problems.push('step fill is transparent — the depth ramp is gone')
  // Anything past the page edge is simply gone on paper — there is nothing to scroll.
  if (printed.widest > PRINTABLE.width + 1) {
    problems.push(
      `chart runs off the page: ${printed.widest}px wide on a ${PRINTABLE.width}px sheet`,
    )
  }
  if (printed.cardOverflows) problems.push('card is wider than the sheet')

  // A blank leading page means something asked not to be broken and could not fit.
  const pages =
    (await import('node:fs'))
      .readFileSync(file)
      .toString('latin1')
      .match(/\/Type\s*\/Page\b/g)?.length ?? 0
  if (pages === 0) problems.push('no pages rendered')

  const mark = problems.length === 0 ? '✓' : '✗'
  console.log(`${mark} ${slug.padEnd(34)} ${String(Math.round(bytes / 1024)).padStart(4)} KB`)
  for (const problem of problems) console.log(`    ${problem}`)
  if (problems.length) failures++
}

await browser.close()
console.log(`\n${SLUGS.length - failures}/${SLUGS.length} print clean · PDFs in ${outDir}`)
process.exit(failures ? 1 : 0)

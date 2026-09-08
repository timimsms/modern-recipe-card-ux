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
  'recipes/bbq-pulled-chicken',
  'fixtures/valid/long-text',
]

mkdirSync(outDir, { recursive: true })

/**
 * A4 landscape at 96dpi, less 10mm margins each side: (297 − 20)mm ≈ 1047px wide, 190mm ≈ 718px
 * tall. Emulating print media in a 1400px window is not a print check — the chart measures
 * itself against the window, so it "fits" right up until it reaches paper.
 */
const PRINTABLE = { width: 1047, height: 718 }

/**
 * This drives the *served* page, so the server has to be up.
 *
 * Without this check the failure is a Playwright navigation stack trace, which reads like the
 * print stylesheet broke rather than like nothing was listening — and that is a confusing five
 * minutes for whoever runs it next after a restart.
 */
try {
  const response = await fetch(`${base}/experiments/01-css-grid/`, {
    signal: AbortSignal.timeout(2000),
  })
  if (!response.ok) throw new Error(String(response.status))
} catch {
  console.error(`Nothing is serving ${base}.\n`)
  console.error('  pnpm serve        # in another terminal, then run this again')
  process.exit(1)
}

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
  const printed = await page.evaluate((pageHeight) => {
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

      /**
       * PHASE-06: "page-break rules that never split a step region across pages".
       *
       * Checked as the *precondition* rather than the outcome, deliberately.
       *
       * A root step spans every ingredient row, so its cell is exactly as tall as its chart —
       * which makes "no region is split" equivalent to "every component fits on one page". With
       * `break-inside: avoid` set, a component that fits is kept whole by the browser; one that
       * does not is split silently, because the property is advisory.
       *
       * The first version of this check measured element positions against page arithmetic in a
       * continuously scrolled viewport. That reads the layout *before* pagination moves anything,
       * so it reported splits that the break rules had already prevented — an instrument
       * measuring the wrong thing and reporting failures with total confidence. Verifying the
       * paginated result properly would mean parsing page geometry out of the PDF; the
       * precondition is the honest thing to check without that, and it is the part that silently
       * breaks when a recipe gains an ingredient.
       */
      tall: [...document.querySelectorAll('.component')]
        .map((c) => ({
          title: (c.querySelector('.component-title')?.textContent ?? 'the chart').trim(),
          height: Math.round(c.getBoundingClientRect().height),
        }))
        .filter((c) => c.height > pageHeight),

      /**
       * R5 in print: with the hue gone, adjacent depth steps must still be told apart. The ramp
       * is luminance-only by construction, so this measures the thing that actually matters —
       * the relative luminance gap between the shades that end up next to each other.
       */
      shades: [
        ...new Set(
          [...document.querySelectorAll('.cell.step')].map(
            (c) => getComputedStyle(c).backgroundColor,
          ),
        ),
      ],
    }
  }, PRINTABLE.height)
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

  for (const component of printed.tall) {
    problems.push(
      `"${component.title}" is ${component.height}px tall on a ${PRINTABLE.height}px sheet, ` +
        `so break-inside cannot keep it whole and a step region will be split`,
    )
  }

  // Greyscale legibility, measured rather than eyeballed: the depth ramp is a luminance ramp, so
  // convert each shade the printer will see and check adjacent steps stay apart. Chrome reports
  // `color(srgb …)` for `color-mix`, which an earlier digit-regex version of this check parsed as
  // integers and scored a contrast ratio of ten million.
  const luminances = printed.shades
    .map((c) => {
      const nums = c.match(/[\d.]+/g)?.map(Number) ?? []
      if (nums.length < 3) return undefined
      // srgb form is 0–1, rgb() form is 0–255.
      const scale = c.startsWith('color(') ? 1 : 1 / 255
      const [r, g, b] = nums.slice(0, 3).map((n) => {
        const v = n * scale
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    })
    .filter((l) => l !== undefined)
    .sort((a, b) => a - b)

  for (let i = 1; i < luminances.length; i++) {
    const gap = luminances[i] - luminances[i - 1]
    // 0.02 in relative luminance is roughly where two greys stop being separable on paper.
    if (gap < 0.02) {
      problems.push(
        `two depth shades are ${gap.toFixed(3)} apart in luminance — indistinguishable in greyscale`,
      )
      break
    }
  }

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

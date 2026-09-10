#!/usr/bin/env node
/**
 * The scale-change measurement — PHASE-07 calls it "the sharpest test", PHASE-08 "the sharpest
 * discriminator between reactivity models". Every framework track has emitted marks for it since
 * it was built; this reads the answer.
 *
 * Method: black-box and identical for every track, rather than each track's own marks. The clock
 * starts immediately before dispatching the change event on `#scale` and stops at the second
 * requestAnimationFrame after it — i.e. after the next frame has painted. That captures script,
 * style, layout and paint together, which is what a cook's thumb experiences, and it cannot be
 * gamed by where a track happened to place its instrumentation. (The in-page `recipe:render`
 * marks corroborate; they are reported when present.)
 *
 * CPU is throttled 4x via CDP to approximate the mid-tier Android profile PHASE-08 specifies.
 * Recipe: shepherds-pie — 20 quantity cells across two components, the widest corpus chart.
 *
 *   node scripts/measure-scale.mjs            # needs `pnpm serve` running
 */
import { chromium } from '@playwright/test'

const base = process.env.BASE_URL ?? 'http://localhost:8731'
const SAMPLES = 21
const THROTTLE = Number(process.env.THROTTLE ?? 4)

const TARGETS = [
  { id: '01-css-grid (full redraw)', entry: '/experiments/01-css-grid/', ready: '.chart' },
  { id: '02-react', entry: '/experiments/02-react-shadcn/dist/', ready: '[data-row]' },
  {
    id: '04-svelte',
    entry: '/experiments/04-alt-frameworks/dist/svelte.html',
    ready: '[data-row]',
  },
  { id: '04-solid', entry: '/experiments/04-alt-frameworks/dist/solid.html', ready: '[data-row]' },
]

try {
  const probe = await fetch(`${base}/experiments/01-css-grid/`, {
    signal: AbortSignal.timeout(2000),
  })
  if (!probe.ok) throw new Error(String(probe.status))
} catch {
  console.error(
    `Nothing is serving ${base}.\n\n  pnpm serve        # in another terminal, then run this again`,
  )
  process.exit(1)
}

const browser = await chromium.launch()
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const at = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))]
  return { median: at(0.5), p75: at(0.75), max: s[s.length - 1] }
}

console.log(
  `scale change → next painted frame, CPU ${THROTTLE}x throttled, shepherds-pie, n=${SAMPLES}\n`,
)
const results = []

for (const target of TARGETS) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })

  await page.goto(`${base}${target.entry}`)
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  await page.selectOption('#recipe', 'recipes/shepherds-pie')
  await page.waitForSelector(`[data-recipe="recipes/shepherds-pie"]`)
  await page.waitForSelector(target.ready)
  await page.evaluate(() => document.fonts.ready)

  /**
   * The vsync floor, measured rather than assumed.
   *
   * A double-rAF costs up to two frame intervals even when nothing happens: the first run of
   * this script reported ~32ms for *every* track — almost exactly 2×16.7ms — while React's own
   * marks said the work was 1.5ms. The instrument was measuring the display's refresh cadence,
   * not the frameworks. So the same double-rAF is timed with no dispatch at all, and the number
   * that matters is the delta.
   */
  const floor = []
  for (let i = 0; i < SAMPLES; i++) {
    floor.push(
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const start = performance.now()
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(performance.now() - start)),
            )
          }),
      ),
    )
  }

  const durations = []
  for (let i = 0; i < SAMPLES; i++) {
    const value = i % 2 === 0 ? '2' : '1' // alternate so every sample changes every quantity
    durations.push(
      await page.evaluate(
        ([v]) =>
          new Promise((resolve) => {
            const select = document.getElementById('scale')
            const start = performance.now()
            select.value = v
            select.dispatchEvent(new Event('change', { bubbles: true }))
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(performance.now() - start)),
            )
          }),
        [value],
      ),
    )
  }

  // Corroboration: what the track's own marks say, where it emits them.
  const marks = await page.evaluate(() => {
    const m = performance.getEntriesByName('recipe:render').map((e) => e.duration)
    return m.length ? m : null
  })

  const s = stats(durations)
  const f = stats(floor)
  const work = Math.max(0, s.median - f.median)
  results.push({ id: target.id, work, ...s })
  const own = marks
    ? `own marks ${stats(marks).median.toFixed(1)}ms×${marks.length}`
    : 'no marks: predates protocol'
  console.log(
    `${target.id.padEnd(28)} total ${s.median.toFixed(1).padStart(6)}ms − floor ${f.median
      .toFixed(1)
      .padStart(5)}ms = work ~${work.toFixed(1).padStart(5)}ms   (${own})`,
  )
  await page.close()
}

console.log(
  '\n(work = total − vsync floor; below ~a frame it is bounded by paint, not the framework)',
)

await browser.close()

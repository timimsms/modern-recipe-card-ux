import { expect, test, type Page } from '@playwright/test'

/**
 * Track 03's baselines.
 *
 * Deliberately *not* compared against track 01's images. Phase 08 scores fidelity, but a
 * dendrogram is not a near-miss of a grid — it is a different drawing of the same tree, and
 * expecting pixel similarity would score this track on how well it imitates the one it exists to
 * differ from. What is compared is whether it renders the same *plan*, on every recipe.
 */

const RECIPES = [
  'recipes/espresso-brownies',
  'recipes/shepherds-pie',
  'recipes/no-knead-bread',
  'recipes/bbq-pulled-chicken',
]

const FIXTURES = [
  'fixtures/valid/long-text',
  'fixtures/valid/wide-shallow',
  'fixtures/valid/deep-narrow',
  'fixtures/valid/reuse-split',
  'fixtures/valid/degenerate',
]

const HIDE_CONTROLS = '.controls{display:none!important}'

async function show(page: Page, slug: string) {
  await page.goto('/experiments/03-svg/')
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  await page.selectOption('#recipe', slug)
  await page.waitForSelector(`#cards[data-recipe="${slug}"]`)
  // The layout is computed from measured text, so it is only correct once the real font is in.
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: HIDE_CONTROLS })
  return page.locator('[data-card]')
}

const name = (slug: string) => slug.replace(/\//g, '-')

test.describe('track 03 — the drawing', () => {
  for (const slug of [...RECIPES, ...FIXTURES]) {
    test(slug, async ({ page }) => {
      const card = await show(page, slug)
      await expect(card).toHaveScreenshot(`${name(slug)}.png`)
    })
  }
})

/**
 * The acceptance criterion this track owns: `reuse-split` with genuine connectors.
 *
 * A grid cannot draw this. Under `chip` track 01 prints a label saying where the leaf went; under
 * `duplicate-leaf` it repeats the row. Both are workarounds for a rectangle that would otherwise
 * have to span everything in between — which is exactly what I4 is about.
 */
test('draws a real connector from one leaf to two distant steps (I4)', async ({ page }) => {
  await show(page, 'fixtures/valid/reuse-split')

  const edges = page.locator('.edge[data-leaf="butter"]')
  await expect(edges).toHaveCount(2)

  const targets = await edges.evaluateAll((nodes) =>
    nodes.map((n) => (n as SVGElement).dataset.step),
  )
  expect(targets.sort()).toEqual(['cream', 'topping'])

  // Two edges that arrive in different places, rather than one drawn twice.
  const ends = await edges.evaluateAll((nodes) =>
    nodes.map(
      (n) => (n as SVGPathElement).getPointAtLength((n as SVGPathElement).getTotalLength()).x,
    ),
  )
  expect(new Set(ends.map(Math.round)).size).toBe(2)
})

/**
 * Text is this track's central cost: SVG does not wrap, so every line is measured and placed by
 * `geometry.js`. A label escaping its own box is the failure mode, and it is silent — SVG clips
 * nothing by default.
 */
test.describe('measured text stays in its box', () => {
  for (const slug of [...RECIPES, ...FIXTURES]) {
    test(slug, async ({ page }) => {
      await show(page, slug)
      const escapes = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.step, .leaf'))
          .map((g) => {
            const rect = (g.querySelector('rect') as SVGGraphicsElement).getBBox()
            const text = (g.querySelector('text') as SVGGraphicsElement).getBBox()
            return {
              id: (g as SVGElement).dataset.step ?? (g as SVGElement).dataset.leaf,
              right: text.x + text.width - (rect.x + rect.width),
              bottom: text.y + text.height - (rect.y + rect.height),
            }
          })
          // A pixel of slack for antialiasing; anything more is a label outside its box.
          .filter((e) => e.right > 1 || e.bottom > 1),
      )
      expect(escapes).toEqual([])
    })
  }
})

test('emits the harness marks by name', async ({ page }) => {
  await show(page, 'recipes/shepherds-pie')
  // Convention, not import — a track that imports the harness is measuring itself.
  const measures = await page.evaluate(() =>
    performance.getEntriesByType('measure').map((m) => m.name),
  )
  expect(measures).toContain('recipe:first-render')
})

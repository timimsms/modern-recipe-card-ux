import { expect, test, type Page } from '@playwright/test'

/**
 * The fidelity reference for the bake-off.
 *
 * Phase 08 scores tracks 02–04 against how closely they reproduce track 01, so these baselines
 * are the thing "reproduce it" means. They capture the card element rather than the page so the
 * control bar — a harness affordance, not part of the design — cannot cause a diff.
 */

const RECIPES = [
  'recipes/espresso-brownies',
  'recipes/no-knead-bread',
  'recipes/shepherds-pie',
  'recipes/beef-stroganoff',
  'recipes/grilled-artichokes',
  'recipes/spinach-artichoke-skillet',
  'recipes/braised-short-ribs',
  'recipes/fennel-citrus-salad',
]

/** The fixtures that exist to break layout, which is exactly why they need baselines. */
const FIXTURES = [
  'fixtures/valid/long-text',
  'fixtures/valid/wide-shallow',
  'fixtures/valid/deep-narrow',
  'fixtures/valid/unicode',
  'fixtures/valid/reuse-split',
  'fixtures/valid/degenerate',
]

async function show(page: Page, slug: string, options: Record<string, string> = {}) {
  await page.goto('/experiments/01-css-grid/')
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  for (const [id, value] of Object.entries({ recipe: slug, ...options })) {
    await page.selectOption(`#${id}`, value)
  }
  const card = page.locator('.card')
  await expect(card).toBeVisible()
  // The chart is laid out entirely by CSS Grid from static markup, so once the card is in the
  // DOM there is nothing further to settle — but fonts still have to land.
  await page.evaluate(() => document.fonts.ready)
  return card
}

const name = (slug: string) => slug.replace(/\//g, '-')

test.describe('track 01 — recipes', () => {
  for (const slug of RECIPES) {
    test(slug, async ({ page }) => {
      const card = await show(page, slug)
      await expect(card).toHaveScreenshot(`${name(slug)}.png`)
    })
  }
})

test.describe('track 01 — stress fixtures', () => {
  for (const slug of FIXTURES) {
    test(slug, async ({ page }) => {
      const card = await show(page, slug)
      await expect(card).toHaveScreenshot(`${name(slug)}.png`)
    })
  }
})

test.describe('track 01 — options that change the rendering', () => {
  // One recipe per option, rather than the cross product. The engine's own golden files already
  // cover every recipe × strategy; what these add is proof the *renderer* honours the option.
  test('shepherds-pie / left-packed', async ({ page }) => {
    const card = await show(page, 'recipes/shepherds-pie', { strategy: 'left-packed' })
    await expect(card).toHaveScreenshot('shepherds-pie-left-packed.png')
  })

  test('shepherds-pie / stretch-to-merge', async ({ page }) => {
    const card = await show(page, 'recipes/shepherds-pie', { strategy: 'stretch-to-merge' })
    await expect(card).toHaveScreenshot('shepherds-pie-stretch.png')
  })

  test('reuse-split / duplicate-leaf', async ({ page }) => {
    const card = await show(page, 'fixtures/valid/reuse-split', { reuse: 'duplicate-leaf' })
    await expect(card).toHaveScreenshot('reuse-split-duplicate-leaf.png')
  })

  // EDGE-CASES E1: the rule that was rejected, kept under test so the comparison stays honest.
  test('no-knead-bread / relative marks', async ({ page }) => {
    const card = await show(page, 'recipes/no-knead-bread', { markrule: 'relative' })
    await expect(card).toHaveScreenshot('no-knead-bread-relative-marks.png')
  })
})

test.describe('track 01 — themes', () => {
  test('espresso-brownies / dark', async ({ page }) => {
    const card = await show(page, 'recipes/espresso-brownies', { theme: 'dark' })
    await expect(card).toHaveScreenshot('espresso-brownies-dark.png')
  })
})

/**
 * Not a screenshot: R7 is behaviour, and a picture of a checked box proves nothing about whether
 * the fill propagated to the right regions.
 */
test('check-off propagates to exactly the regions an ingredient feeds', async ({ page }) => {
  await show(page, 'recipes/espresso-brownies')
  await page.locator('.tick[data-ing="flour"]').check()

  const started = await page.$$eval('.step', (steps) =>
    steps.map((s) => ({
      fed: (s as HTMLElement).dataset.fedBy?.split(' ').includes('flour') ?? false,
      started: getComputedStyle(s).getPropertyValue('--started').trim(),
    })),
  )

  // Flour reaches `fold in` and `bake`, and nothing upstream of it.
  expect(started.filter((s) => s.started === '1')).toHaveLength(2)
  expect(started.every((s) => (s.fed ? s.started === '1' : s.started === '0'))).toBe(true)
  await expect(page.locator('[data-row="flour"]')).toHaveCSS('opacity', '0.5')
})

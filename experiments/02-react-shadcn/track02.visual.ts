import { expect, test, type Page } from '@playwright/test'

/**
 * Track 02's baselines.
 *
 * This track deliberately uses the *same* CSS Grid geometry as track 01, so unlike track 03 its
 * images should be close to track 01's — but they are still its own files. Phase 08 reports
 * per-track divergence with an explanation for each intentional difference, and that needs two
 * sets of pixels to compare, not one shared set that hides them.
 */

const RECIPES = ['recipes/espresso-brownies', 'recipes/shepherds-pie', 'recipes/bbq-pulled-chicken']

const FIXTURES = [
  'fixtures/valid/long-text',
  'fixtures/valid/reuse-split',
  'fixtures/valid/degenerate',
]

/**
 * A stable hook rather than the Tailwind class that happens to be on the bar today. Hiding
 * `.sticky` would break the moment someone changed the positioning, and would take any other
 * sticky element with it.
 */
const HIDE_CONTROLS = '[data-controls]{display:none!important}'

/** Behaviour tests drive the controls, so they must not be hidden. */
async function open(page: Page, slug: string) {
  await page.goto('/experiments/02-react-shadcn/dist/')
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  await page.selectOption('#recipe', slug)
  await page.selectOption('#theme', 'light')
  await page.waitForSelector(`[data-recipe="${slug}"]`)
  // The chart is CSS Grid over static markup, but the type still has to land before anything is
  // measured or photographed.
  await page.evaluate(() => document.fonts.ready)
}

/**
 * Screenshot setup: the same, plus hiding the control bar.
 *
 * Two helpers rather than one, because a single helper that hides the controls makes every
 * behavioural test time out trying to click them — which is exactly what happened here, and had
 * already happened once in track 01.
 */
async function show(page: Page, slug: string) {
  await open(page, slug)
  await page.addStyleTag({ content: HIDE_CONTROLS })
  return page.locator('[data-card]')
}

const name = (slug: string) => slug.replace(/\//g, '-')

test.describe('track 02 — the chart', () => {
  for (const slug of [...RECIPES, ...FIXTURES]) {
    test(slug, async ({ page }) => {
      const card = await show(page, slug)
      await expect(card).toHaveScreenshot(`${name(slug)}.png`)
    })
  }
})

/**
 * The tokens bridge is the thing PHASE-07 singles out as "part of what's being evaluated", so it
 * is tested rather than asserted: Tailwind's `@theme` maps to `var(--ink)` and friends, which
 * means a theme switch has to move the *utility* colours, not just the raw variables.
 */
test('Tailwind utilities resolve through the design tokens, both themes', async ({ page }) => {
  await open(page, 'recipes/espresso-brownies')

  const read = () =>
    page.evaluate(() => {
      const card = document.querySelector('[data-card]')!
      const step = document.querySelector('[data-step]')!
      return {
        surface: getComputedStyle(card).backgroundColor,
        stepFill: getComputedStyle(step).backgroundColor,
        border: getComputedStyle(step).borderTopColor,
      }
    })

  const light = await read()
  await page.selectOption('#theme', 'dark')
  const dark = await read()

  // Every one of these comes from `packages/tokens` through `@theme`. If the bridge were a copy
  // of the values rather than a reference, the dark theme would look identical.
  expect(dark.surface).not.toBe(light.surface)
  expect(dark.stepFill).not.toBe(light.stepFill)
  expect(dark.border).not.toBe(light.border)
})

test('renders the same plan: one cell per ingredient and per step', async ({ page }) => {
  await show(page, 'recipes/espresso-brownies')
  await expect(page.locator('[data-row]')).toHaveCount(9)
  await expect(page.locator('[data-step]')).toHaveCount(5)
})

test('check-off is component-qualified, as the store requires', async ({ page }) => {
  await open(page, 'recipes/shepherds-pie')
  // Shepherd's pie has `salt` in both components; a bare id would tick the wrong row.
  const salts = page.locator('input[data-ing$="/salt"]')
  await expect(salts).toHaveCount(2)

  await salts.first().check()
  await expect(salts.first()).toBeChecked()
  await expect(salts.nth(1)).not.toBeChecked()
})

test('scaling reaches every quantity at once', async ({ page }) => {
  await open(page, 'recipes/espresso-brownies')
  const butter = page.locator('[data-row$="/butter"]')
  await expect(butter).toContainText('4 oz')

  await page.selectOption('#scale', '2')
  await expect(butter).toContainText('½ lb')
})

test('emits the harness marks by name', async ({ page }) => {
  await show(page, 'recipes/espresso-brownies')
  const measures = await page.evaluate(() =>
    performance.getEntriesByType('measure').map((m) => m.name),
  )
  expect(measures).toContain('recipe:first-render')
})

/**
 * Cook mode, and with it the first real test of PHASE-05's claim that every track binds the *same*
 * store. The adapter is `useSyncExternalStore` over `createStore()` — two lines, well inside the
 * "handful" the phase budgeted.
 */
test.describe('cook mode', () => {
  const enter = async (page: Page, slug: string) => {
    await open(page, slug)
    await page.click('#view-cook')
    await page.waitForSelector('[data-step-text]')
  }

  test('walks the recipe, naming inputs and counting across components', async ({ page }) => {
    await enter(page, 'recipes/shepherds-pie')
    await expect(page.locator('[data-count]')).toHaveText('1 of 15')

    // Position is counted across the whole recipe: "1 of 12" after three steps of mashed
    // potatoes would be a lie.
    for (let i = 0; i < 10; i++) await page.click('[data-next]')
    await expect(page.locator('[data-count]')).toHaveText('11 of 15')
    // An input resolved to a named prior result, not "the previous step".
    await expect(page.locator('li').first()).toContainText('the seasoned filling')
  })

  /** R7: four of five steps done is not 80% when the fifth is a forty-minute bake. */
  test('progress is time-weighted and disagrees with the step count on purpose', async ({
    page,
  }) => {
    await enter(page, 'recipes/espresso-brownies')
    for (let i = 0; i < 4; i++) await page.click('[data-next]')
    await expect(page.locator('[data-count]')).toHaveText('5 of 5')
    await expect(page.locator('[data-progress]')).toHaveText('23% of the time')
  })

  /** The seal vocabulary: a part finished is not the dish finished. */
  test('names the end of a part, and the end of the dish', async ({ page }) => {
    await enter(page, 'recipes/shepherds-pie')
    for (let i = 0; i < 2; i++) await page.click('[data-next]')
    await page.click('[data-done]')
    await expect(page.locator('[data-ending="part"]')).toContainText('Mashed potatoes done')
  })

  /**
   * One model, every view — PHASE-04's rule. The store is the shared one from core, so a step
   * finished in cook mode is filled in the chart and an ingredient ticked in the chart survives
   * the detour.
   */
  test('shares its state with the chart', async ({ page }) => {
    await open(page, 'recipes/espresso-brownies')
    await page.locator('input[data-ing$="/flour"]').check()

    await page.click('#view-cook')
    await page.click('[data-next]')
    await expect(page.locator('[data-count]')).toHaveText('2 of 5')

    await page.click('#view-chart')
    await expect(page.locator('input[data-ing$="/flour"]')).toBeChecked()

    await page.click('#view-cook')
    // The place in the recipe survived the round trip too.
    await expect(page.locator('[data-count]')).toHaveText('2 of 5')
  })

  test('screenshot', async ({ page }) => {
    await enter(page, 'recipes/shepherds-pie')
    for (let i = 0; i < 10; i++) await page.click('[data-next]')
    await page.addStyleTag({ content: HIDE_CONTROLS })
    await expect(page.locator('[data-card]')).toHaveScreenshot('cookmode-shepherds-pie.png')
  })
})

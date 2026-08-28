import { expect, test, type Page } from '@playwright/test'

/**
 * Track 04's suite, run twice — once per framework.
 *
 * The premise of this track is that the two variants are the *same renderer* and differ only in
 * reactivity model, so the interesting assertions are not "does Svelte work" but "do these two
 * agree". The identical-output requirement is tested rather than asserted, because it is exactly
 * the kind of thing that drifts silently: template whitespace alone rendered the same ingredient
 * row 3.7px wider in Svelte than in Solid before it was caught here.
 */

const VARIANTS = [
  { id: 'svelte', page: '/experiments/04-alt-frameworks/dist/svelte.html' },
  { id: 'solid', page: '/experiments/04-alt-frameworks/dist/solid.html' },
] as const

const RECIPES = ['recipes/espresso-brownies', 'recipes/shepherds-pie']
const FIXTURES = ['fixtures/valid/reuse-split', 'fixtures/valid/degenerate']

const HIDE_CONTROLS = '[data-controls]{display:none!important}'

/** Behaviour tests drive the controls, so they must not be hidden. */
async function open(page: Page, entry: string, slug: string) {
  await page.goto(entry)
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  await page.selectOption('#recipe', slug)
  await page.selectOption('#theme', 'light')
  await page.waitForSelector(`[data-recipe="${slug}"]`)
  await page.evaluate(() => document.fonts.ready)
}

async function show(page: Page, entry: string, slug: string) {
  await open(page, entry, slug)
  await page.addStyleTag({ content: HIDE_CONTROLS })
  return page.locator('[data-card]')
}

const name = (slug: string) => slug.replace(/\//g, '-')

for (const variant of VARIANTS) {
  test.describe(`track 04 — ${variant.id}`, () => {
    for (const slug of [...RECIPES, ...FIXTURES]) {
      test(slug, async ({ page }) => {
        const card = await show(page, variant.page, slug)
        await expect(card).toHaveScreenshot(`${variant.id}-${name(slug)}.png`)
      })
    }

    test('renders the same plan', async ({ page }) => {
      await show(page, variant.page, 'recipes/espresso-brownies')
      await expect(page.locator('[data-row]')).toHaveCount(9)
      await expect(page.locator('[data-step]')).toHaveCount(5)
    })

    /** Phase 08's sharpest discriminator: one change that touches every quantity at once. */
    test('scaling reaches every quantity', async ({ page }) => {
      await open(page, variant.page, 'recipes/espresso-brownies')
      const butter = page.locator('[data-row$="/butter"]')
      await expect(butter).toContainText('4 oz')
      await page.selectOption('#scale', '2')
      await expect(butter).toContainText('½ lb')
      // Every other quantity moved too, not just the one being watched.
      await expect(page.locator('[data-row$="/sugar"]')).toContainText('2 cup')
    })

    test('check-off is component-qualified', async ({ page }) => {
      await open(page, variant.page, 'recipes/shepherds-pie')
      const salts = page.locator('input[data-ing$="/salt"]')
      await expect(salts).toHaveCount(2)
      await salts.first().check()
      await expect(salts.first()).toBeChecked()
      await expect(salts.nth(1)).not.toBeChecked()
    })

    test('emits the harness marks by name', async ({ page }) => {
      await show(page, variant.page, 'recipes/espresso-brownies')
      const measures = await page.evaluate(() =>
        performance.getEntriesByType('measure').map((m) => m.name),
      )
      expect(measures).toContain('recipe:first-render')
    })
  })
}

/**
 * The premise, enforced.
 *
 * If these two ever disagree on geometry, Phase 08 would be attributing a template-syntax
 * difference to the reactivity model — which is the one mistake this track cannot afford.
 */
test('the two variants render identical geometry', async ({ page }) => {
  const measure = async (entry: string) => {
    await open(page, entry, 'recipes/espresso-brownies')
    return page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-row], [data-step]')).map((el) => {
        const box = el.getBoundingClientRect()
        return {
          id: (el as HTMLElement).dataset.row ?? (el as HTMLElement).dataset.step,
          w: Math.round(box.width),
          h: Math.round(box.height),
        }
      }),
    )
  }

  const svelte = await measure(VARIANTS[0].page)
  const solid = await measure(VARIANTS[1].page)
  expect(solid).toEqual(svelte)
})

/**
 * Cook mode, and the point of the whole track: the *same* core store, bound two ways.
 *
 * Svelte's adapter is `$state` plus `$effect.root`; Solid's is a signal with `equals: false`.
 * Both are about four lines, which is what PHASE-05 budgeted and what PHASE-08 counts.
 */
for (const variant of VARIANTS) {
  test.describe(`cook mode — ${variant.id}`, () => {
    const enter = async (page: Page, slug: string) => {
      await open(page, variant.page, slug)
      await page.selectOption('#view', 'cook')
      await page.waitForSelector('[data-step-text]')
    }

    test('walks the recipe and counts across components', async ({ page }) => {
      await enter(page, 'recipes/shepherds-pie')
      await expect(page.locator('[data-count]')).toHaveText('1 of 15')
      for (let i = 0; i < 10; i++) await page.click('[data-next]')
      await expect(page.locator('[data-count]')).toHaveText('11 of 15')
      // Named prior result, not "the previous step".
      await expect(page.locator('.from-step').first()).toContainText('the seasoned filling')
    })

    /** R7 again: 5 of 5 steps and 23% of the time, disagreeing on purpose. */
    test('progress is time-weighted', async ({ page }) => {
      await enter(page, 'recipes/espresso-brownies')
      for (let i = 0; i < 4; i++) await page.click('[data-next]')
      await expect(page.locator('[data-count]')).toHaveText('5 of 5')
      await expect(page.locator('[data-progress]')).toHaveText('23% of the time')
    })

    test('names the end of a part', async ({ page }) => {
      await enter(page, 'recipes/shepherds-pie')
      for (let i = 0; i < 2; i++) await page.click('[data-next]')
      await page.click('[data-done]')
      await expect(page.locator('[data-ending="part"]')).toContainText('Mashed potatoes done')
    })

    /** One model, every view — the store is shared, so the chart sees cook mode's work. */
    test('shares its state with the chart', async ({ page }) => {
      await open(page, variant.page, 'recipes/espresso-brownies')
      await page.locator('input[data-ing$="/flour"]').check()

      await page.selectOption('#view', 'cook')
      await page.click('[data-next]')
      await expect(page.locator('[data-count]')).toHaveText('2 of 5')

      await page.selectOption('#view', 'chart')
      await expect(page.locator('input[data-ing$="/flour"]')).toBeChecked()

      await page.selectOption('#view', 'cook')
      await expect(page.locator('[data-count]')).toHaveText('2 of 5')
    })
  })
}

/** The equivalence premise, extended to cook mode. */
test('both variants agree in cook mode too', async ({ page }) => {
  const read = async (entry: string) => {
    await open(page, entry, 'recipes/shepherds-pie')
    await page.selectOption('#view', 'cook')
    await page.waitForSelector('[data-step-text]')
    for (let i = 0; i < 10; i++) await page.click('[data-next]')
    return page.evaluate(() => ({
      count: document.querySelector('[data-count]')?.textContent,
      step: document.querySelector('[data-step-text]')?.textContent,
      progress: document.querySelector('[data-progress]')?.textContent,
      inputs: Array.from(document.querySelectorAll('.inputs li')).map((li) =>
        (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
      mapCells: document.querySelectorAll('.minimap i').length,
    }))
  }
  const svelte = await read(VARIANTS[0].page)
  const solid = await read(VARIANTS[1].page)
  expect(solid).toEqual(svelte)
})

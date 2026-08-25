import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 06's conformance floor.
 *
 * PHASE-06 is blunt about what this is worth: **"axe passing is table stakes and proves almost
 * nothing here — the failure mode is a chart that's technically conformant and completely
 * incomprehensible."** A clean run means no missing label, no unreachable control, no contrast
 * failure. It says nothing about whether anyone can answer "what goes into the fold-in step?",
 * which is the question the format exists to answer and which the keyboard and narrative tests
 * cover instead.
 *
 * So: a floor, tested on every presentation, and not mistaken for the ceiling.
 */

const PRESENTATIONS = ['chart', 'condensed', 'ingredients', 'cook', 'narrative'] as const

/** Two of nine — the deepest chart and the only multi-component recipe. */
const RECIPES = ['recipes/shepherds-pie', 'recipes/espresso-brownies']

async function show(page: Page, slug: string, view: string) {
  await page.goto('/experiments/01-css-grid/')
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  await page.selectOption('#recipe', slug)
  await page.waitForSelector(`#cards[data-recipe="${slug}"]`)
  await page.selectOption('#view', view)
  await page.waitForSelector('.card, .cookmode')
}

/** Only the parts of an axe result these assertions read. The package ships no exported type. */
type Violation = { id: string; nodes: unknown[] }

const audit = (page: Page): Promise<{ violations: Violation[] }> =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The control bar is harness, not design. Auditing it would report on scaffolding that no
    // track ships, and Phase 08 scores the card.
    .exclude('.controls')
    .analyze()

test.describe('axe — the floor, not the ceiling', () => {
  for (const slug of RECIPES) {
    for (const view of PRESENTATIONS) {
      test(`${slug} / ${view}`, async ({ page }) => {
        await show(page, slug, view)
        const results = await audit(page)
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([])
      })
    }
  }

  test('dark theme, where the contrast checks bite differently', async ({ page }) => {
    await show(page, 'recipes/shepherds-pie', 'chart')
    await page.selectOption('#theme', 'dark')
    const results = await audit(page)
    expect(results.violations.map((v) => v.id)).toEqual([])
  })

  test('mid-cook, with a timer running and progress recorded', async ({ page }) => {
    await show(page, 'recipes/espresso-brownies', 'cook')
    for (let i = 0; i < 4; i++) await page.click('.cm-next')
    await page.click('.cm-timer-start')
    const results = await audit(page)
    expect(results.violations.map((v) => v.id)).toEqual([])
  })
})

/**
 * WCAG 1.4.10, and genuinely hard for a wide chart — which is exactly why PHASE-06 calls it a
 * good forcing function for the Phase 04 ladder.
 *
 * 400% zoom at 1280px wide is equivalent to a 320px viewport. The requirement is no loss of
 * function and no *two-dimensional* scrolling: content may scroll one way, and for a wall chart
 * that way is horizontal, inside the chart's own scroller rather than the page.
 */
test.describe('400% zoom (WCAG 1.4.10)', () => {
  test.use({ viewport: { width: 320, height: 512 } })

  for (const slug of RECIPES) {
    test(slug, async ({ page }) => {
      await show(page, slug, 'chart')

      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        card: Array.from(document.querySelectorAll('.card')).some(
          (c) => c.scrollWidth > c.clientWidth + 1,
        ),
      }))
      // The page itself must not scroll sideways. The chart may, inside `.scroller`, which is
      // the one-direction allowance the criterion makes.
      expect(overflow.page).toBe(false)
      expect(overflow.card).toBe(false)

      // Every control still operable at this size — "no loss of function" is the actual rule.
      await expect(page.locator('.tick').first()).toBeVisible()
      await page.locator('.tick').first().check()
      await expect(page.locator('.tick').first()).toBeChecked()
    })
  }

  test('cook mode stays operable', async ({ page }) => {
    await show(page, 'recipes/shepherds-pie', 'cook')
    await page.click('.cm-next')
    await expect(page.locator('.cm-count')).toContainText('of 15')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflow).toBe(false)
  })
})

/**
 * Forced colors — Windows High Contrast.
 *
 * The system replaces every colour, so the depth ramp, the region fills and the completion seals
 * all collapse to the same two colours. R5 says colour is never the only encoding; this is where
 * that claim is actually tested, because here it is not merely *hard* to see the difference, the
 * difference has been deleted.
 */
test.describe('forced colors', () => {
  // Set on the context rather than via `test.use`, which does not accept it here.
  test.use({ contextOptions: { forcedColors: 'active' } })

  test('every encoding survives having its colours taken away', async ({ page }) => {
    await show(page, 'recipes/espresso-brownies', 'chart')

    // Depth is encoded as fill. With fills gone, the borders that separate regions must remain —
    // they are drawn from `PlacedCell.edges`, which is geometry rather than palette.
    const borders = await page.$$eval(
      '.cell.step',
      (cells) =>
        cells.map((c) => getComputedStyle(c).borderTopWidth).filter((w) => parseFloat(w) > 0)
          .length,
    )
    expect(borders).toBeGreaterThan(0)

    // The unattended mark is a glyph plus text, never a colour.
    await expect(page.locator('.mark .glyph').first()).toBeVisible()

    const results = await audit(page)
    expect(results.violations.map((v) => v.id)).toEqual([])
  })

  test('the completion seals differ in shape, not only in fill', async ({ page }) => {
    await show(page, 'recipes/shepherds-pie', 'cook')
    for (let i = 0; i < 2; i++) await page.click('.cm-next')
    await page.click('.cm-done')

    // Half-filled versus filled is a shape difference, so it survives. The words beside it are
    // the belt to that braces.
    await expect(page.locator('.ending .seal-part')).toBeVisible()
    await expect(page.locator('.ending')).toContainText('Mashed potatoes done')
  })
})

/**
 * The assumption `cardGrounds` rests on.
 *
 * The token test holds faint ink to AA against paper and surface only, on the grounds that faint
 * ink carries labels and captions which never sit inside a shaded cell. That is a claim about the
 * renderer, not about the palette, so it is checked in the renderer — otherwise the day someone
 * puts a caption inside a step region, the contrast gate stays green and is wrong.
 */
test.describe('faint ink stays off the shaded cells', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(theme, async ({ page }) => {
      await show(page, 'recipes/shepherds-pie', 'chart')
      await page.selectOption('#theme', theme)

      const offenders = await page.evaluate(() => {
        const faint = getComputedStyle(document.documentElement)
          .getPropertyValue('--ink-faint')
          .trim()
          .toLowerCase()
        const asRgb = (hex: string) => {
          const v = hex.replace('#', '')
          return `rgb(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)})`
        }
        const target = asRgb(faint)
        return (
          Array.from(document.querySelectorAll('#cards *'))
            .filter((el) => el.textContent?.trim() && el.children.length === 0)
            .filter((el) => getComputedStyle(el).color === target)
            // A depth fill is the only ground the token test stopped checking against.
            .filter((el) => el.closest('.cell.step') !== null)
            .map((el) => (el.className || el.tagName).toString())
        )
      })
      expect(offenders).toEqual([])
    })
  }
})

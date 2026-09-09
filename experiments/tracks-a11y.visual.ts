import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 07's accessibility criterion, applied to tracks 02–04: meet Phase 06's bar, or document
 * precisely where and why they fall short.
 *
 * This file is the cross-track *floor* — axe on chart and cook mode, no sideways page scroll at
 * the 400%-zoom-equivalent width, named check-off controls, and the shape of what each substrate
 * exposes. Track 01's own suite (`01-css-grid/a11y.visual.ts`) remains the full bar; the gap
 * between that file and this one is the documented shortfall, recorded per track in NOTES.md.
 *
 * One deliberate exception below, and it is a finding rather than a pass: the SVG track's chart
 * is a drawing, and what it exposes is a *list* rebuilt from the tree — not the geometry. Phase
 * 06's prediction that the narrative would carry disproportionate weight for this substrate is
 * how it turned out.
 */

const TARGETS = [
  { id: '02-react', entry: '/experiments/02-react-shadcn/dist/', cook: 'radix', checkoff: true },
  { id: '03-svg', entry: '/experiments/03-svg/', cook: 'select', checkoff: false },
  {
    id: '04-svelte',
    entry: '/experiments/04-alt-frameworks/dist/svelte.html',
    cook: 'select',
    checkoff: true,
  },
  {
    id: '04-solid',
    entry: '/experiments/04-alt-frameworks/dist/solid.html',
    cook: 'select',
    checkoff: true,
  },
] as const

async function show(page: Page, entry: string, slug: string) {
  await page.goto(entry)
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  await page.selectOption('#recipe', slug)
  await page.waitForSelector(`[data-recipe="${slug}"]`)
}

async function enterCook(page: Page, target: (typeof TARGETS)[number]) {
  if (target.cook === 'radix') await page.click('#view-cook')
  else await page.selectOption('#view', 'cook')
  await page.waitForSelector('[data-step-text]')
}

const audit = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()

for (const target of TARGETS) {
  test.describe(`a11y floor — ${target.id}`, () => {
    test('axe clean on the chart and in cook mode', async ({ page }) => {
      await show(page, target.entry, 'recipes/shepherds-pie')
      let results = await audit(page)
      expect(results.violations.map((v) => `${v.id} x${v.nodes.length}`)).toEqual([])

      await enterCook(page, target)
      results = await audit(page)
      expect(results.violations.map((v) => `${v.id} x${v.nodes.length}`)).toEqual([])
    })

    /** WCAG 1.4.10: at the 400%-zoom-equivalent width, the page itself must not scroll sideways. */
    test('no two-dimensional scrolling at 320px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 512 })
      await show(page, target.entry, 'recipes/shepherds-pie')
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      expect(sideways).toBe(false)
    })

    if (target.checkoff) {
      /** A checkbox with no name is announced as "checkbox" and nothing else. */
      test('every check-off control has an accessible name', async ({ page }) => {
        await show(page, target.entry, 'recipes/shepherds-pie')
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Accessibility.enable')
        const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
          nodes: Array<{ ignored?: boolean; role?: { value?: string }; name?: { value?: string } }>
        }
        const boxes = nodes.filter((n) => !n.ignored && n.role?.value === 'checkbox')
        // Shepherd's pie: 5 mashed-potato + 15 pie ingredient rows. (Track 01 would show 21
        // here — its control bar adds a greyscale checkbox these tracks do not have.)
        expect(boxes.length).toBe(20)
        expect(boxes.filter((n) => !n.name?.value)).toEqual([])
      })
    }
  })
}

/**
 * What the SVG chart exposes, pinned so it cannot silently regress.
 *
 * The first version was `role="img"` with `role="list"` children — contradictory, since an img
 * is a leaf and promises there is nothing inside. Chromium exposed the children anyway, which is
 * the worst of both: other assistive tech is entitled to prune them. Only reading the tree found
 * it, because axe has no rule for non-interactive children of an img. It is a `group` holding
 * two labelled lists now, and the mini-map — which genuinely is a picture — keeps `img` with its
 * children hidden.
 */
test('the SVG chart is a group of lists, not an image with secrets', async ({ page }) => {
  await show(page, '/experiments/03-svg/', 'recipes/espresso-brownies')

  const root = page.locator('svg.dendrogram')
  await expect(root).toHaveAttribute('role', 'group')
  await expect(page.locator('svg [role="list"]')).toHaveCount(2)
  // Every ingredient and every step is a named listitem — the tree, rebuilt as a list.
  await expect(page.locator('svg [role="listitem"]')).toHaveCount(14)

  // A scrollable drawing a keyboard cannot reach is content a keyboard user cannot see.
  await expect(page.locator('section.component').first()).toHaveAttribute('tabindex', '0')

  await page.selectOption('#view', 'cook')
  await page.waitForSelector('[data-step-text]')
  await expect(page.locator('svg.minimap')).toHaveAttribute('role', 'img')
})

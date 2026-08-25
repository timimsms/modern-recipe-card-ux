import { expect, test, type Page } from '@playwright/test'

/**
 * Q3, measured: the same `GridPlan` rendered on CSS Grid and on a `<table>`, compared by what
 * each one puts in the browser's accessibility tree.
 *
 * **This is not the whole answer.** PHASE-06 asks for VoiceOver, NVDA and JAWS, and how a screen
 * reader *narrates* a tree is not the same question as what is in it — see
 * docs/findings/Q3-substrate.md, which records exactly what was and was not verified. What this
 * file does is make the measurable half reproducible, and catch a regression in it.
 */

type AxNode = {
  nodeId: string
  ignored?: boolean
  role?: { value?: string }
  name?: { value?: string }
  childIds?: string[]
}

async function show(page: Page, slug: string, view: string) {
  await page.goto('/experiments/01-css-grid/')
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  await page.selectOption('#recipe', slug)
  await page.waitForSelector(`#cards[data-recipe="${slug}"]`)
  await page.selectOption('#view', view)
  await page.waitForSelector('.card')
}

/** Roles inside the card, counted. Text leaves are identical on both and would swamp it. */
async function roles(page: Page, slug: string, view: string) {
  await show(page, slug, view)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Accessibility.enable')
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AxNode[] }

  const byId = new Map(nodes.map((n) => [n.nodeId, n]))
  const cardId = nodes.find((n) => n.role?.value === 'article')?.nodeId
  const count: Record<string, number> = {}
  let unnamed = 0

  const walk = (id: string) => {
    const n = byId.get(id)
    if (!n) return
    if (!n.ignored) {
      const role = n.role?.value ?? '?'
      if (role !== 'StaticText' && role !== 'InlineTextBox') {
        count[role] = (count[role] ?? 0) + 1
        if (!n.name?.value) unnamed++
      }
    }
    for (const c of n.childIds ?? []) walk(c)
  }
  if (cardId) walk(cardId)
  return { count, unnamed }
}

test.describe('Q3 — what each substrate exposes', () => {
  /**
   * The table's case. A grid gives assistive tech no relationship at all: its steps are buttons,
   * its ingredients are checkboxes, and everything holding them together is `generic`.
   */
  test('only the table exposes the relationships the chart draws', async ({ page }) => {
    const table = await roles(page, 'recipes/espresso-brownies', 'table')
    expect(table.count.table).toBe(1)
    expect(table.count.row).toBe(10)
    // `scope="row"` — the ingredient is announced with every cell on its row, which is exactly
    // the adjacency the chart conveys by being next to it.
    expect(table.count.rowheader).toBe(10)

    const grid = await roles(page, 'recipes/espresso-brownies', 'chart')
    expect(grid.count.table ?? 0).toBe(0)
    expect(grid.count.row ?? 0).toBe(0)
    expect(grid.count.rowheader ?? 0).toBe(0)
    // The structure a sighted reader sees is `generic` to everyone else.
    expect(grid.count.generic ?? 0).toBeGreaterThan(0)
  })

  /**
   * The grid's case, and the table's cost: a table row must account for every column, so a hole
   * in the chart still needs a `<td>`. Left exposed those doubled what a reader hears.
   */
  test('the table announces exactly the real steps, no blanks', async ({ page }) => {
    for (const [slug, steps] of [
      ['recipes/espresso-brownies', 5],
      ['recipes/shepherds-pie', 15],
    ] as const) {
      const table = await roles(page, slug, 'table')
      const grid = await roles(page, slug, 'chart')
      // Was 13 and 30 before the filler cells were made presentational.
      expect(table.count.cell).toBe(steps)
      expect(grid.count.button).toBe(steps)
    }
  })

  /** Fewer anonymous nodes is the clearest single number in the comparison. */
  test('the table leaves less unnamed', async ({ page }) => {
    const table = await roles(page, 'recipes/shepherds-pie', 'table')
    const grid = await roles(page, 'recipes/shepherds-pie', 'chart')
    expect(table.unnamed).toBeLessThan(grid.unnamed)
  })

  test('both substrates render the same plan', async ({ page }) => {
    // Identical topology is what makes the comparison about the substrate. The table is emitted
    // row by row from absolute positions, and a browser silently *repairs* a malformed table by
    // shifting cells — so this checks the spans survived the transformation.
    await show(page, 'recipes/espresso-brownies', 'table')
    const spans = await page.$$eval('.t-chart tr', (rows) =>
      rows.map((r) =>
        Array.from((r as HTMLTableRowElement).cells)
          .map((c) => `${c.rowSpan}x${c.colSpan}`)
          .join(' '),
      ),
    )
    // The convergence shape: successive steps spanning 4, 5, 9 and 9 ingredient rows.
    expect(spans[1]).toBe('1x1 1x1 4x1 5x1 9x1 9x1')
  })
})

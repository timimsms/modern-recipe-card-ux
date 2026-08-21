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

/**
 * The control bar is hidden outright before every screenshot, and that is load-bearing.
 *
 * It is `position: sticky`, and a card is usually taller than the viewport; when Playwright
 * scrolls to stitch a tall element it takes the sticky bar with it. That painted the harness
 * over the first set of baselines, and unsticking it fixed the visible symptom.
 *
 * It did not fix the underlying one. The bar still occupied space, so the card's *offset* moved
 * whenever a control was added — and a card 269.95px tall rounds to 270px or 271px depending on
 * where its top edge falls on the pixel grid. Adding two buttons shifted twelve baselines by
 * exactly one pixel while the card itself was byte-identical.
 *
 * Removing the bar from flow entirely puts the card at a fixed offset, so the baselines answer
 * "did the design change" instead of "did the harness".
 */
const HIDE_CONTROLS = '.controls{display:none!important}'
async function show(page: Page, slug: string, options: Record<string, string> = {}) {
  await page.goto('/experiments/01-css-grid/')
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  for (const [id, value] of Object.entries({ recipe: slug, ...options })) {
    await page.selectOption(`#${id}`, value)
  }
  await page.addStyleTag({ content: HIDE_CONTROLS })
  const card = page.locator('.card')
  await expect(card).toBeVisible()
  // The chart is laid out entirely by CSS Grid from static markup, so once the card is in the
  // DOM there is nothing further to settle — but fonts still have to land.
  await page.evaluate(() => document.fonts.ready)
  return card
}

/**
 * The same setup for behaviour tests, which drive the controls and so cannot have them hidden.
 * `show()` is the screenshot helper; this one is for everything that clicks.
 */
async function open(page: Page, slug: string) {
  await page.goto('/experiments/01-css-grid/')
  await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
  await page.selectOption('#recipe', slug)
  await page.waitForSelector('.card')
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
 * The narrow rung. Phase 04 is entirely about this width, and the tokens were finalised before
 * anything had been tested here — which is how the at-a-glance bar shipped clipping its headline
 * figure to "1 hr 12 mi" on a phone. These exist so that cannot happen twice.
 */
test.describe('track 01 — 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const slug of [
    'recipes/shepherds-pie',
    'recipes/espresso-brownies',
    'recipes/no-knead-bread',
  ]) {
    test(slug, async ({ page }) => {
      const card = await show(page, slug)
      await expect(card).toHaveScreenshot(`${name(slug)}-390.png`)
    })
  }
})

/**
 * The mini-map, tested as behaviour rather than as fifteen screenshots. What matters is that it
 * always says where you are and how far you have got — a picture of one frame cannot show that,
 * and a picture of every frame is a 15-image baseline that will churn on any styling change.
 */
test.describe('mini-map', () => {
  test('marks exactly one current step and fills the ones behind it', async ({ page }) => {
    await page.goto('/experiments/01-css-grid/')
    await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
    await page.selectOption('#recipe', 'recipes/shepherds-pie')
    await page.selectOption('#view', 'filmstrip')
    await page.waitForSelector('.minimap')

    const frames = await page.$$eval('.frame', (nodes) =>
      nodes.map((f) => ({
        now: f.querySelectorAll('.mm-now').length,
        done: f.querySelectorAll('.mm-done').length,
        label: f.querySelector('.minimap')?.getAttribute('aria-label') ?? '',
      })),
    )

    expect(frames.length).toBeGreaterThan(10)
    for (const frame of frames) expect(frame.now).toBe(1)

    // Progress only ever goes forward, and it resets at a component boundary — shepherd's pie
    // has two, so the count drops back to zero once.
    const resets = frames.filter((f, i) => i > 0 && f.done < frames[i - 1]!.done).length
    expect(resets).toBe(1)
    expect(frames.at(-1)!.label).toContain('step 12 of 12')
  })

  test('scales every component of a recipe to one cell size', async ({ page }) => {
    await page.goto('/experiments/01-css-grid/')
    await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
    await page.selectOption('#recipe', 'recipes/shepherds-pie')
    await page.selectOption('#view', 'filmstrip')
    await page.waitForSelector('.minimap')

    // Sized per-plan, the four-column component drew 34px cells and the eleven-column one 29px,
    // so the map changed size as the cook crossed between them.
    const cellWidths = await page.$$eval('.minimap', (maps) =>
      maps.map((m) => {
        const cols = getComputedStyle(m).gridTemplateColumns.split(' ')
        return Math.round(parseFloat(cols[0]!))
      }),
    )
    expect(new Set(cellWidths).size).toBe(1)
  })
})

test.describe('the ladder', () => {
  const pick = async (page: Page, slug: string, view: string) => {
    await page.goto('/experiments/01-css-grid/')
    await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
    await page.selectOption('#recipe', slug)
    await page.selectOption('#view', view)
    await page.waitForSelector('.card')
    await page.addStyleTag({ content: HIDE_CONTROLS })
  }

  test('condensed chart', async ({ page }) => {
    await pick(page, 'recipes/shepherds-pie', 'condensed')
    await expect(page.locator('.card')).toHaveScreenshot('condensed-shepherds-pie.png')
  })

  test('ingredient-led', async ({ page }) => {
    await pick(page, 'recipes/shepherds-pie', 'ingredients')
    await expect(page.locator('.card')).toHaveScreenshot('ingredient-led-shepherds-pie.png')
  })

  test('condensing narrows the chart without dropping an ingredient row', async ({ page }) => {
    await pick(page, 'recipes/shepherds-pie', 'chart')
    const before = await page.$$eval('.chart', (c) =>
      c.map((n) => getComputedStyle(n).gridTemplateColumns.split(' ').length),
    )
    const rowsBefore = await page.locator('.ing').count()

    await pick(page, 'recipes/shepherds-pie', 'condensed')
    const after = await page.$$eval('.chart', (c) =>
      c.map((n) => getComputedStyle(n).gridTemplateColumns.split(' ').length),
    )
    expect(Math.max(...after)).toBeLessThan(Math.max(...before))
    expect(Math.max(...after)).toBeLessThanOrEqual(6)
    expect(await page.locator('.ing').count()).toBe(rowsBefore)
  })

  /**
   * The point of the stacked micro-list. Joining a collapsed run into one paragraph saved the
   * same columns but put `ground lamb` a long way from "cook until meat is no longer pink",
   * giving back exactly what R3 and R4 establish.
   */
  test('a collapsed run keeps each sub-step beside the ingredient it consumes', async ({
    page,
  }) => {
    await pick(page, 'recipes/shepherds-pie', 'condensed')
    const aligned = await page.evaluate(() => {
      const lamb = Array.from(document.querySelectorAll('.ing')).find((e) =>
        e.textContent?.includes('ground lamb'),
      )
      const part = Array.from(document.querySelectorAll('.micro-part')).find((e) =>
        e.textContent?.includes('no longer pink'),
      )
      if (!lamb || !part) return null
      const a = lamb.getBoundingClientRect()
      const b = part.getBoundingClientRect()
      // Same row band: their vertical centres should be within a line of each other.
      return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2))
    })
    expect(aligned).not.toBeNull()
    expect(aligned!).toBeLessThan(24)
  })

  /**
   * The bar is the only thing this view has that a shopping list does not, so it has to be
   * right. Components are sequential: the last step of the mashed potatoes is halfway through
   * the dish, and tagging its salt "at the end" is backwards.
   */
  test('ingredient-led measures depth across the recipe, not the component', async ({ page }) => {
    await pick(page, 'recipes/shepherds-pie', 'ingredients')
    const late = await page.$$eval('.il-row.late .item', (nodes) =>
      nodes.map((n) => n.textContent ?? ''),
    )
    expect(late).toEqual(['paprika'])
  })
})

test.describe('cook mode', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  const open = async (page: Page, slug: string) => {
    await page.goto('/experiments/01-css-grid/')
    await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
    await page.selectOption('#recipe', slug)
    await page.selectOption('#view', 'cook')
    await page.waitForSelector('.cookmode')
  }

  test('shepherds-pie, mid-recipe', async ({ page }) => {
    await open(page, 'recipes/shepherds-pie')
    for (let i = 0; i < 10; i++) await page.click('.cm-next')
    await page.addStyleTag({ content: HIDE_CONTROLS })
    await expect(page.locator('.cookmode')).toHaveScreenshot('cookmode-shepherds-pie.png')
  })

  /**
   * Components are sequential — the pie eats the potatoes — so navigation has to cross between
   * them. Confined to one component, a cook finishes the mashed potatoes and is stranded.
   */
  test('walks every step of every component', async ({ page }) => {
    await open(page, 'recipes/shepherds-pie')
    const seen: string[] = []
    for (let i = 0; i < 30; i++) {
      seen.push((await page.locator('.cookmode').getAttribute('data-step')) ?? '')
      if (await page.locator('.cm-next').isDisabled()) break
      await page.click('.cm-next')
    }
    expect(seen).toHaveLength(15)
    expect(seen.slice(0, 3)).toEqual(['boil', 'mash', 'season'])
    expect(seen.at(-1)).toBe('bake')
    await expect(page.locator('.cm-count')).toHaveText('15 of 15')
  })

  test('accumulates progress on the mini-map as you go', async ({ page }) => {
    await open(page, 'recipes/shepherds-pie')
    expect(await page.locator('.mm-done').count()).toBe(0)
    for (let i = 0; i < 10; i++) await page.click('.cm-next')
    // Moving on is finishing: without that the map never fills and its one job goes undone.
    expect(await page.locator('.mm-done').count()).toBeGreaterThan(5)
    expect(await page.locator('.mm-now').count()).toBe(1)
  })

  /**
   * The bug this pins: cook mode at the oven with shepherd's pie in it offered "heat" and
   * "dice", a dozen minutes behind. A step's own dependencies have necessarily happened.
   */
  test('never offers work that is already behind you', async ({ page }) => {
    await open(page, 'recipes/shepherds-pie')
    for (let i = 0; i < 10; i++) await page.click('.cm-next')
    const offered = await page.$$eval('.cm-jumps .jump, .banner .jump', (nodes) =>
      nodes.map((n) => n.textContent ?? ''),
    )
    expect(offered).not.toContain('heat')
    expect(offered).not.toContain('dice')
  })

  test('resolves inputs to named results and real quantities', async ({ page }) => {
    await open(page, 'recipes/shepherds-pie')
    for (let i = 0; i < 10; i++) await page.click('.cm-next')
    const inputs = await page.$$eval('.inputs li', (nodes) =>
      nodes.map((n) => (n.textContent ?? '').replace(/\s+/g, ' ').trim()),
    )
    // Not "step 9" — a name you could say out loud, and a quantity you can measure.
    expect(inputs[0]).toBe('the seasoned filling')
    expect(inputs[1]).toContain('mashed potatoes')
    expect(inputs[1]).toContain('800 g')
  })
})

/**
 * The transition, and the thing it depends on: one model behind two views.
 *
 * These were separate before — the chart tracked gathered ingredients, cook mode tracked
 * finished steps, and switching views silently discarded your progress.
 */
test.describe('chart ↔ cook mode', () => {
  const chart = async (page: Page) => {
    await page.goto('/experiments/01-css-grid/')
    await page.waitForFunction(() => document.querySelectorAll('#recipe option').length > 0)
    await page.selectOption('#recipe', 'recipes/espresso-brownies')
    await page.waitForSelector('.chart')
  }

  test('a step cell opens cook mode at that step', async ({ page }) => {
    await chart(page)
    await page.locator('.step[data-step="fold-in"]').click()
    await expect(page.locator('.cookmode')).toHaveAttribute('data-step', 'fold-in')
  })

  test('the keyboard reaches it too', async ({ page }) => {
    await chart(page)
    await page.locator('.step[data-step="melt"]').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.cookmode')).toHaveAttribute('data-step', 'melt')
  })

  test('progress survives the round trip in both directions', async ({ page }) => {
    await chart(page)
    await page.locator('.tick[data-ing="brownies/flour"]').check()

    await page.locator('.step[data-step="fold-in"]').click()
    await page.click('.cm-next')
    await page.click('.cm-back')
    await page.waitForSelector('.chart')

    // Finished in cook mode, filled in the chart.
    await expect(page.locator('.step.complete')).toHaveAttribute('data-step', 'fold-in')
    // Gathered in the chart, still gathered after the detour.
    await expect(page.locator('.tick[data-ing="brownies/flour"]')).toBeChecked()
  })

  test('animates the cell into the card, and cross-fades under reduced motion', async ({
    page,
  }) => {
    const capture = async (reduced: boolean) => {
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
      await chart(page)
      await page.evaluate(() => {
        ;(window as unknown as { __kf: string[] }).__kf = []
        const original = Element.prototype.animate
        Element.prototype.animate = function (this: Element, frames, opts) {
          ;(window as unknown as { __kf: string[] }).__kf.push(JSON.stringify(frames))
          return original.call(this, frames, opts)
        } as typeof Element.prototype.animate
      })
      await page.locator('.step[data-step="fold-in"]').click()
      await page.waitForSelector('.cookmode')
      return page.evaluate(() => (window as unknown as { __kf: string[] }).__kf.join(' '))
    }

    // Moving something across the screen is exactly what reduced motion asks you not to do,
    // but the positional relationship still has to survive — hence a fade in place, not a jump.
    expect(await capture(false)).toContain('transform')
    expect(await capture(true)).not.toContain('transform')
  })
})

/**
 * Phase 05 behaviour, all of it found by driving the page rather than by reading the code.
 */
test.describe('kitchen state', () => {
  /**
   * Switching view used to re-run `show()`, which resets the store — so going from cook mode to
   * the chart to see where you were threw away your place, your timers and your check-offs.
   */
  test('switching view keeps your place, your ticks and a running timer', async ({ page }) => {
    await open(page, 'recipes/espresso-brownies')
    await page.locator('.tick[data-ing="brownies/flour"]').check()

    await page.selectOption('#view', 'cook')
    for (let i = 0; i < 4; i++) await page.click('.cm-next')
    await expect(page.locator('.cookmode')).toHaveAttribute('data-step', 'bake')
    await page.click('.cm-timer-start')

    await page.selectOption('#view', 'chart')
    // The chart cell carries the countdown too, so one glance says what is in the oven.
    await expect(page.locator('.step[data-step="bake"] .cell-timer')).toBeVisible()
    await expect(page.locator('.tick[data-ing="brownies/flour"]')).toBeChecked()

    await page.selectOption('#view', 'cook')
    await expect(page.locator('.cookmode')).toHaveAttribute('data-step', 'bake')
    await expect(page.locator('.cm-timer')).toBeVisible()
  })

  /**
   * Undo restored a whole state snapshot, which carried `timers` with it — so undoing a
   * mis-tapped checkbox also stopped a running forty-minute bake.
   */
  test('undo takes back a tick without stopping the timer', async ({ page }) => {
    await open(page, 'recipes/espresso-brownies')
    await page.selectOption('#view', 'cook')
    for (let i = 0; i < 4; i++) await page.click('.cm-next')
    await page.click('.cm-timer-start')
    await expect(page.locator('.cm-timer')).toBeVisible()

    await page.click('#undo')
    await expect(page.locator('.cm-timer')).toBeVisible()
  })

  test('progress is time-weighted, and disagrees with the step count on purpose', async ({
    page,
  }) => {
    await open(page, 'recipes/espresso-brownies')
    await page.selectOption('#view', 'cook')
    for (let i = 0; i < 4; i++) await page.click('.cm-next')

    // Four of five steps done, and a forty-minute bake still to go: 80% by count, 23% by clock.
    await expect(page.locator('.cm-count')).toHaveText('5 of 5')
    await expect(page.locator('.cm-progress-text')).toHaveText('23% of the time')
  })

  test('scaling reaches every quantity, and refuses the ones that do not scale', async ({
    page,
  }) => {
    await open(page, 'recipes/espresso-brownies')
    await page.selectOption('#scale', '2')

    const rows = page.locator('.ing-text')
    // 4 oz climbs to ½ lb, and 4 Tbs to ½ cup — one scoop rather than eight.
    await expect(rows.filter({ hasText: 'unsalted butter' })).toContainText('½ lb')
    await expect(rows.filter({ hasText: 'unsalted butter' })).toContainText('230 g')
    await expect(rows.filter({ hasText: 'espresso' })).toContainText('½ cup')

    // A pinch does not double.
    await open(page, 'recipes/shepherds-pie')
    await page.selectOption('#scale', '3')
    await expect(page.locator('.ing-text').filter({ hasText: 'nutmeg' })).toContainText(
      'does not scale',
    )
  })

  test('an arbitrary factor works, is clamped, and clears the preset menu', async ({ page }) => {
    await open(page, 'recipes/espresso-brownies')
    await page.fill('#scale-any', '2.75')
    await page.locator('#scale-any').dispatchEvent('change')

    await expect(page.locator('.ing-text').filter({ hasText: 'all-purpose flour' })).toContainText(
      '1⅓ cup',
    )
    // No preset matches 2.75, and leaving the menu on "double" beside a 2.75× card is a lie.
    await expect(page.locator('#scale')).toHaveValue('')

    await page.fill('#scale-any', '100')
    await page.locator('#scale-any').dispatchEvent('change')
    await expect(page.locator('#scale-any')).toHaveValue('8')
  })

  test('progress survives a reload, keyed by recipe', async ({ page }) => {
    await open(page, 'recipes/espresso-brownies')
    await page.locator('.tick[data-ing="brownies/flour"]').check()

    await page.reload()
    await page.waitForSelector('.chart')
    await expect(page.locator('.tick[data-ing="brownies/flour"]')).toBeChecked()

    // Start over is two taps, so a stray one cannot clear an hour of cooking.
    await page.click('#startover')
    await expect(page.locator('#startover')).toHaveText('Tap again to clear')
    await page.click('#startover')
    await expect(page.locator('.tick[data-ing="brownies/flour"]')).not.toBeChecked()
  })

  /** PHASE-05's 48px rule, on the control that gets used most and with the wettest hands. */
  test('every check-off target clears 48px on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page, 'recipes/shepherds-pie')

    const heights = await page.$$eval('label.cell.ing, .step[data-step]', (nodes) =>
      nodes.map((n) => n.getBoundingClientRect().height),
    )
    expect(heights.length).toBeGreaterThan(10)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(48)
  })
})

/**
 * Not a screenshot: R7 is behaviour, and a picture of a checked box proves nothing about whether
 * the fill propagated to the right regions.
 */
test('check-off propagates to exactly the regions an ingredient feeds', async ({ page }) => {
  await show(page, 'recipes/espresso-brownies')
  await page.locator('.tick[data-ing="brownies/flour"]').check()

  const started = await page.$$eval('.step', (steps) =>
    steps.map((s) => ({
      // Component-qualified: shepherd's pie has `salt` in both components, so a bare id here
      // would dim the wrong row — see `ingredientKey`.
      fed: (s as HTMLElement).dataset.fedBy?.split(' ').includes('brownies/flour') ?? false,
      started: getComputedStyle(s).getPropertyValue('--started').trim(),
    })),
  )

  // Flour reaches `fold in` and `bake`, and nothing upstream of it.
  expect(started.filter((s) => s.started === '1')).toHaveLength(2)
  expect(started.every((s) => (s.fed ? s.started === '1' : s.started === '0'))).toBe(true)
  await expect(page.locator('[data-row="brownies/flour"]')).toHaveCSS('opacity', '0.5')
})

import { useEffect, useLayoutEffect, useState } from 'react'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { layout, normalizeRecipe, type GridPlan, type Recipe } from '@recipe/core'
import { Chart } from './Chart'
import { CookMode } from './CookMode'
import { store, useCookState } from './useStore'

const RECIPES = [
  'espresso-brownies',
  'no-knead-bread',
  'shepherds-pie',
  'beef-stroganoff',
  'grilled-artichokes',
  'spinach-artichoke-skillet',
  'braised-short-ribs',
  'fennel-citrus-salad',
  'bbq-pulled-chicken',
]

const FIXTURES = [
  'long-text',
  'unicode',
  'wide-shallow',
  'deep-narrow',
  'reuse-split',
  'degenerate',
]

const SCALES = [
  ['0.5', 'half'],
  ['1', 'as written'],
  ['2', 'double'],
  ['3', 'triple'],
] as const

type Loaded = { slug: string; recipe: Recipe; plans: GridPlan[] }

/**
 * The corpus is fetched at runtime rather than bundled.
 *
 * Every track loads the same JSON over the same static server, so Phase 08's bundle numbers
 * measure the renderer rather than how much of the corpus each track happened to inline.
 */
async function load(slug: string): Promise<Loaded> {
  const response = await fetch(`/packages/corpus/${slug}.json`)
  if (!response.ok) throw new Error(`${slug} → ${response.status}`)
  const recipe = normalizeRecipe(await response.json())
  return { slug, recipe, plans: recipe.components.map((c) => layout(c)) }
}

export function App() {
  const [slug, setSlug] = useState('recipes/espresso-brownies')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [scale, setScale] = useState(1)
  const [view, setView] = useState<'chart' | 'cook'>('chart')
  const [at, setAt] = useState(0)
  // Check-off lives in the shared store now, not in component state — one model, every view, so a
  // step finished in cook mode is filled in the chart.
  const cook = useCookState()
  // Seeded in `main.tsx` from the OS preference, so a control that read "light" on a dark page
  // would be worse than no control.
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') ?? 'light',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    let live = true
    // The same stale-response guard track 01 needed: a slow fetch must not overwrite a newer one.
    load(slug)
      .then((next) => {
        if (!live) return
        setLoaded(next)
        setAt(0)
        store.reset()
        setError(null)
      })
      .catch((cause) => live && setError(cause as Error))
    return () => {
      live = false
    }
  }, [slug])

  const toggleMeasured = (key: string) => {
    performance.mark('recipe:check-off:start')
    store.toggleIngredient(key)
  }

  if (error) {
    return (
      <pre className="m-4 rounded-sm bg-clay-soft p-4 font-mono text-label whitespace-pre-wrap">
        {error.stack ?? error.message}
      </pre>
    )
  }

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
      <div
        data-controls
        className="sticky top-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-2 rounded border border-hairline bg-surface px-3.5 py-3 font-mono text-label"
      >
        <label className="flex cursor-pointer items-center gap-1.5">
          recipe
          <select
            id="recipe"
            className="font-inherit px-1 py-0.5"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          >
            <optgroup label="recipes">
              {RECIPES.map((name) => (
                <option key={name} value={`recipes/${name}`}>
                  {name}
                </option>
              ))}
            </optgroup>
            <optgroup label="fixtures">
              {FIXTURES.map((name) => (
                <option key={name} value={`fixtures/valid/${name}`}>
                  {name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-1.5">
          servings
          <select
            id="scale"
            className="font-inherit px-1 py-0.5"
            value={String(scale)}
            onChange={(e) => {
              // Phase 08's sharpest discriminator between reactivity models: one change that
              // touches every quantity cell at once.
              performance.mark('recipe:render:start')
              setScale(Number(e.target.value))
            }}
          >
            {SCALES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {/*
          The first genuine job for a Radix primitive in this track: a roving-tabindex toggle
          group with the right roles and keyboard behaviour, for free.

          It is also where the answer to the doc's question starts to show. Radix covers the
          *shell* — this switcher, and later a sheet for cook mode on a phone. It has nothing for
          the chart or the mini-map, which are the parts carrying the format's meaning, because
          there is no "dependency graph" primitive and never will be. The component library helps
          exactly as much as the app is made of ordinary widgets.
        */}
        <ToggleGroup.Root
          type="single"
          value={view}
          onValueChange={(next) => next && setView(next as 'chart' | 'cook')}
          aria-label="presentation"
          className="flex overflow-hidden rounded border border-hairline"
        >
          {(['chart', 'cook'] as const).map((option) => (
            <ToggleGroup.Item
              key={option}
              value={option}
              id={`view-${option}`}
              className="px-2.5 py-1 data-[state=on]:bg-depth-3"
            >
              {option === 'chart' ? 'wall chart' : 'cook mode'}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>

        <label className="flex cursor-pointer items-center gap-1.5">
          theme
          <select
            id="theme"
            className="font-inherit px-1 py-0.5"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
      </div>

      {loaded && (
        <Card
          loaded={loaded}
          view={view}
          at={at}
          onMove={setAt}
          scale={scale}
          checked={cook.checkedIngredients}
          onToggle={toggleMeasured}
        />
      )}
    </main>
  )
}

function Card({
  loaded,
  view,
  at,
  onMove,
  scale,
  checked,
  onToggle,
}: {
  loaded: Loaded
  view: 'chart' | 'cook'
  at: number
  onMove: (index: number) => void
  scale: number
  checked: ReadonlySet<string>
  onToggle: (key: string) => void
}) {
  const { recipe, plans, slug } = loaded

  /**
   * The harness marks, emitted from a layout effect so "painted" means the DOM is committed
   * rather than the render function having returned.
   *
   * Plain `performance.mark` by convention — a track that imports the harness is measuring
   * itself, and dependency-cruiser enforces it. See `packages/harness/src/protocol.ts`.
   */
  useLayoutEffect(() => {
    performance.mark('recipe:render:end')
    const first = performance.getEntriesByName('recipe:first-render').length === 0
    try {
      performance.measure(
        first ? 'recipe:first-render' : 'recipe:render',
        'recipe:render:start',
        'recipe:render:end',
      )
    } catch {
      // The start mark is set by `main.tsx` before the first paint and by the change handlers
      // after; a render with neither is not one Phase 08 is asking about.
    }
    if (performance.getEntriesByName('recipe:check-off:start').length > 0) {
      performance.measure('recipe:check-off', 'recipe:check-off:start', 'recipe:render:end')
      performance.clearMarks('recipe:check-off:start')
    }
    document.title = `${recipe.title} — track 02`
  })

  if (view === 'cook') {
    return (
      <div data-recipe={slug}>
        <CookMode recipe={recipe} plans={plans} scale={scale} at={at} onMove={onMove} />
      </div>
    )
  }

  return (
    <article className="overflow-hidden rounded border border-hairline bg-surface" data-card>
      <header className="border-b border-hairline px-4 pt-4 pb-3">
        <h2 className="font-display text-card-title font-semibold">{recipe.title}</h2>
        {recipe.source && (
          <p className="mt-1 font-mono text-label text-ink-faint">{recipe.source.name}</p>
        )}
      </header>

      <div data-recipe={slug}>
        {recipe.components.map((component, i) => (
          <section key={component.id}>
            {recipe.components.length > 1 && component.title && (
              <h3 className="mt-3.5 mb-1 px-4 font-display text-component-title font-semibold">
                {component.title}
              </h3>
            )}
            <Chart
              component={component}
              plan={plans[i]!}
              scale={scale}
              checked={checked}
              onToggle={onToggle}
            />
          </section>
        ))}
      </div>
    </article>
  )
}

import { For, Show, createEffect, createResource, createSignal } from 'solid-js'
import { FIXTURES, RECIPES, SCALES, load, markEnd, markStart } from '../shared.js'
import { Chart } from './Chart'
import { CookMode } from './CookMode'
import { cookState, store } from './store.js'

export function App() {
  const [slug, setSlug] = createSignal('recipes/espresso-brownies')
  const [scale, setScale] = createSignal(1)
  const [view, setView] = createSignal('chart')
  const [at, setAt] = createSignal(0)
  // Check-off lives in the shared store — one model, every view.
  const checked = () => cookState().checkedIngredients
  const [theme, setTheme] = createSignal(
    document.documentElement.getAttribute('data-theme') ?? 'light',
  )

  /**
   * `createResource` handles the stale-response problem the other three tracks each solved by
   * hand — it tracks the source signal and discards a response whose request is no longer
   * current. Worth recording: it is the one piece of this app where the framework removed code
   * rather than rearranged it.
   */
  const [loaded] = createResource(slug, load)

  createEffect(() => document.documentElement.setAttribute('data-theme', theme()))

  createEffect(() => {
    const data = loaded()
    if (!data) return
    document.title = `${data.recipe.title} — track 04 solid`
    markEnd()
  })

  const toggle = (key) => store.toggleIngredient(key)

  createEffect(() => {
    // A new recipe is a fresh start; the store is shared, so it has to be told.
    loaded()
    setAt(0)
    store.reset()
  })

  return (
    <main class="page">
      <div class="controls" data-controls>
        <label>
          recipe
          <select
            id="recipe"
            value={slug()}
            onChange={(e) => {
              markStart()
              setSlug(e.currentTarget.value)
            }}
          >
            <optgroup label="recipes">
              <For each={RECIPES}>
                {(name) => <option value={`recipes/${name}`}>{name}</option>}
              </For>
            </optgroup>
            <optgroup label="fixtures">
              <For each={FIXTURES}>
                {(name) => <option value={`fixtures/valid/${name}`}>{name}</option>}
              </For>
            </optgroup>
          </select>
        </label>

        <label>
          servings
          <select
            id="scale"
            value={String(scale())}
            onChange={(e) => {
              markStart()
              setScale(Number(e.currentTarget.value))
            }}
          >
            <For each={SCALES}>{([value, label]) => <option value={value}>{label}</option>}</For>
          </select>
        </label>

        <label>
          view
          <select id="view" value={view()} onChange={(e) => setView(e.currentTarget.value)}>
            <option value="chart">wall chart</option>
            <option value="cook">cook mode</option>
          </select>
        </label>

        <label>
          theme
          <select id="theme" value={theme()} onChange={(e) => setTheme(e.currentTarget.value)}>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
      </div>

      <Show when={loaded.error}>
        <pre class="failure">{loaded.error?.stack ?? loaded.error?.message}</pre>
      </Show>

      <Show when={loaded() && view() === 'cook'}>
        <div data-recipe={loaded().slug}>
          <CookMode
            recipe={loaded().recipe}
            plans={loaded().plans}
            scale={scale()}
            at={at()}
            onMove={setAt}
          />
        </div>
      </Show>

      <Show when={loaded() && view() === 'chart'}>
        {() => (
          <article class="card" data-card>
            <header class="cardhead">
              <h2 class="card-title">{loaded().recipe.title}</h2>
              <Show when={loaded().recipe.source}>
                <p class="src">{loaded().recipe.source.name}</p>
              </Show>
            </header>
            <div data-recipe={loaded().slug}>
              <For each={loaded().recipe.components}>
                {(component, i) => (
                  <section>
                    <Show when={loaded().recipe.components.length > 1 && component.title}>
                      <h3 class="component-title">{component.title}</h3>
                    </Show>
                    <Chart
                      component={component}
                      plan={loaded().plans[i()]}
                      scale={scale()}
                      checked={checked()}
                      onToggle={toggle}
                    />
                  </section>
                )}
              </For>
            </div>
          </article>
        )}
      </Show>
    </main>
  )
}

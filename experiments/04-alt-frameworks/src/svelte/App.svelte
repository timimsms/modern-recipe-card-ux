<script>
  import { FIXTURES, RECIPES, SCALES, load, markEnd, markStart } from '../shared.js'
  import Chart from './Chart.svelte'
  import CookMode from './CookMode.svelte'
  import { cookState, store } from './store.svelte.js'

  /**
   * Svelte 5 runes. `$state` for what changes, `$derived` for what follows from it, `$effect` for
   * the two things that reach outside the component — loading and the harness mark.
   *
   * The scaling interaction is the measurement PHASE-07 cares most about: changing `scale` has to
   * reach every quantity cell at once, and how much work that costs is the framework difference
   * the whole track exists to isolate.
   */
  let slug = $state('recipes/espresso-brownies')
  let loaded = $state(null)
  let error = $state(null)
  let scale = $state(1)
  let view = $state('chart')
  let at = $state(0)
  // Check-off lives in the shared store now — one model, every view, so a step finished in cook
  // mode is filled in the chart.
  const checked = $derived(cookState().checkedIngredients)
  let theme = $state(document.documentElement.getAttribute('data-theme') ?? 'light')

  $effect(() => {
    const wanted = slug
    let live = true
    load(wanted)
      .then((next) => {
        // The same stale-response guard every track needed: a slow fetch must not overwrite a
        // newer one.
        if (!live) return
        loaded = next
        at = 0
        store.reset()
        error = null
      })
      .catch((cause) => live && (error = cause))
    return () => {
      live = false
    }
  })

  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  })

  $effect(() => {
    if (!loaded) return
    document.title = `${loaded.recipe.title} — track 04 svelte`
    markEnd()
  })

  const toggle = (key) => store.toggleIngredient(key)
</script>

<main class="page">
  <div class="controls" data-controls>
    <label>
      recipe
      <select id="recipe" bind:value={slug} onchange={markStart}>
        <optgroup label="recipes">
          {#each RECIPES as name (name)}<option value="recipes/{name}">{name}</option>{/each}
        </optgroup>
        <optgroup label="fixtures">
          {#each FIXTURES as name (name)}
            <option value="fixtures/valid/{name}">{name}</option>
          {/each}
        </optgroup>
      </select>
    </label>

    <label>
      servings
      <select
        id="scale"
        value={String(scale)}
        onchange={(e) => {
          markStart()
          scale = Number(e.currentTarget.value)
        }}
      >
        {#each SCALES as [value, label] (value)}<option {value}>{label}</option>{/each}
      </select>
    </label>

    <label>
      view
      <select id="view" bind:value={view}>
        <option value="chart">wall chart</option>
        <option value="cook">cook mode</option>
      </select>
    </label>

    <label>
      theme
      <select id="theme" bind:value={theme}>
        <option value="light">light</option>
        <option value="dark">dark</option>
      </select>
    </label>
  </div>

  {#if error}
    <pre class="failure">{error.stack ?? error.message}</pre>
  {:else if loaded}
    {#if view === 'cook'}
      <div data-recipe={loaded.slug}>
        <CookMode
          recipe={loaded.recipe}
          plans={loaded.plans}
          {scale}
          {at}
          onMove={(i) => (at = i)}
        />
      </div>
    {:else}
      <article class="card" data-card>
        <header class="cardhead">
          <h2 class="card-title">{loaded.recipe.title}</h2>
          {#if loaded.recipe.source}<p class="src">{loaded.recipe.source.name}</p>{/if}
        </header>
        <div data-recipe={loaded.slug}>
          {#each loaded.recipe.components as component, i (component.id)}
            <section>
              {#if loaded.recipe.components.length > 1 && component.title}
                <h3 class="component-title">{component.title}</h3>
              {/if}
              <Chart {component} plan={loaded.plans[i]} {scale} {checked} onToggle={toggle} />
            </section>
          {/each}
        </div>
      </article>
    {/if}
  {/if}
</main>

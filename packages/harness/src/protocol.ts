/**
 * The contract between a track and the thing that measures it.
 *
 * A track **may not import this file** — `.dependency-cruiser.cjs` fails the build if it does,
 * on the grounds that a track importing the harness is measuring itself. So this is a
 * *convention*, not a library: the names live here, both sides agree on them, and a track emits
 * two lines of plain `performance.mark()` with no dependency at all.
 *
 * That constraint is doing real work. It means the instrumentation cannot grow into a framework
 * that tracks end up building against, and it keeps the "never shipped by a track" promise
 * literally true rather than approximately.
 */

// --- What a track is ------------------------------------------------------------------------

/**
 * The feature surface Phase 07 requires. A track that is missing one is not disqualified — it is
 * a finding, and the scorecard says so — but it has to be *declared*, because a silent gap is the
 * thing that makes a comparison meaningless.
 */
export type TrackFeature =
  | 'chart'
  | 'condensed'
  | 'ingredient-led'
  | 'cook'
  | 'narrative'
  | 'check-off'
  | 'scaling'
  | 'units'
  | 'timers'
  | 'keyboard'
  | 'export'

export type TrackManifest = {
  /** Directory name under `experiments/`, and the value of `<html data-track>`. */
  id: string
  name: string
  /** How it is built, in a phrase. Part of what Phase 08 reports. */
  stack: string
  /** Path `pnpm serve` answers on, relative to the repo root. */
  entry: string
  /**
   * The script that has to run before `entry` exists. Absent for tracks that need no build —
   * and whether a track needs one is itself a measurement, so absence is data.
   */
  build?: string
  features: TrackFeature[]
}

/**
 * Every track, and what it currently claims.
 *
 * Kept here rather than discovered from the filesystem so that a half-built track is visible as a
 * short feature list instead of being silently absent from the comparison.
 */
export const TRACKS: readonly TrackManifest[] = [
  {
    id: '01-css-grid',
    name: 'CSS Grid',
    stack: 'no framework, no bundler',
    entry: '/experiments/01-css-grid/',
    features: [
      'chart',
      'condensed',
      'ingredient-led',
      'cook',
      'narrative',
      'check-off',
      'scaling',
      'units',
      'timers',
      'keyboard',
    ],
  },
  {
    id: '02-react-shadcn',
    name: 'React + Tailwind + shadcn',
    stack: 'React, Tailwind, shadcn/ui, Radix, Vite',
    entry: '/experiments/02-react-shadcn/dist/',
    build: 'vite build',
    features: [],
  },
  {
    id: '03-svg',
    name: 'SVG dendrogram',
    stack: 'no framework, no bundler',
    entry: '/experiments/03-svg/',
    features: ['chart'],
  },
  {
    id: '04-alt-frameworks',
    name: 'Svelte / Solid',
    stack: 'Svelte, Solid, Vite',
    entry: '/experiments/04-alt-frameworks/dist/',
    build: 'vite build',
    features: [],
  },
]

export const trackById = (id: string): TrackManifest | undefined =>
  TRACKS.find((track) => track.id === id)

// --- What a track emits ---------------------------------------------------------------------

/**
 * `performance.measure` names. A track emits these; the harness reads them back.
 *
 * Phase 08 names the four interactions worth timing, and they are here rather than left to each
 * track to invent: first render of the widest chart, check-off (the most-used interaction), a
 * scale change (which touches every quantity cell at once and is the sharpest discriminator
 * between reactivity models), and a cook-mode step transition.
 */
export const MEASURE = {
  /** From module evaluation to the first chart on screen. */
  firstRender: 'recipe:first-render',
  /** Any subsequent redraw. */
  render: 'recipe:render',
  /** Tick to painted. */
  checkOff: 'recipe:check-off',
  /** Serving-size change to painted — every quantity in the chart at once. */
  scale: 'recipe:scale',
  /** One step to the next in cook mode, transition included. */
  step: 'recipe:step',
} as const

export type MeasureName = (typeof MEASURE)[keyof typeof MEASURE]

/** Every name a track may emit, for the harness to filter `performance.getEntries()` by. */
export const MEASURE_NAMES: readonly string[] = Object.values(MEASURE)

/**
 * The DOM a track has to expose, and deliberately nothing more.
 *
 * Rule 5 says each track should be idiomatic, so this does not dictate class names or structure —
 * a React track should look like React. These three are the minimum a screenshot suite, an axe
 * run and a driver need to find their way around, and they are `data-` attributes precisely so
 * they cannot be confused with styling hooks that a track might reasonably want to change.
 */
export const DOM = {
  /** On `<html>`: which track this page is. */
  track: 'data-track',
  /** On the render root: which corpus recipe is currently on screen, or absent while loading. */
  recipe: 'data-recipe',
  /** On the element a screenshot captures — the card, not the page chrome. */
  card: 'data-card',
} as const

export const selector = {
  root: `[${DOM.recipe}]`,
  card: `[${DOM.card}]`,
  rendered: (slug: string) => `[${DOM.recipe}="${slug}"]`,
} as const

/**
 * @recipe/harness — bake-off instrumentation. Dev-only; never shipped by a track.
 *
 * A track cannot import this: `.dependency-cruiser.cjs` fails the build if one does, because a
 * track importing the harness is measuring itself. What lives here is therefore the *contract* —
 * names both sides agree on — and, from Phase 08, the code that reads the results back.
 */

export * from './protocol.js'

export type Scorecard = Record<string, never>

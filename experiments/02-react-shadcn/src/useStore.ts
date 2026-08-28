import { useSyncExternalStore } from 'react'
import { createStore, type CookState, type Store } from '@recipe/core'

/**
 * The store adapter — the thing PHASE-05 budgeted at "a handful of lines" and PHASE-08 measures.
 *
 * `useSyncExternalStore` is what React provides for exactly this shape: an external mutable
 * source with a subscribe function and a snapshot getter. The core store already exposes both, so
 * the adapter is the two lines below and nothing else.
 *
 * The one thing that matters here is that `get()` returns a *new object* on every change and the
 * same object otherwise. `useSyncExternalStore` compares snapshots by identity and will loop
 * forever if the getter allocates — which is why the store clones on write rather than on read.
 */
export const store: Store = createStore()

export function useCookState(): CookState {
  return useSyncExternalStore(store.subscribe, store.get)
}

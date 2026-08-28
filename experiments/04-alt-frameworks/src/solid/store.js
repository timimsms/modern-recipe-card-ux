import { createSignal } from 'solid-js'
import { store } from '../shared.js'

/**
 * The Solid adapter, in full.
 *
 * A signal seeded with the snapshot and pushed on every change. `equals: false` because the store
 * hands out a new object each time and Solid's default identity check would be doing work the
 * store has already done.
 */
const [snapshot, setSnapshot] = createSignal(store.get(), { equals: false })
store.subscribe(() => setSnapshot(store.get()))

export const cookState = snapshot
export { store }

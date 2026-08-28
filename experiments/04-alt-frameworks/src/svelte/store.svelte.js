import { store } from '../shared.js'

/**
 * The Svelte adapter, in full.
 *
 * `$state` holds the snapshot, `$effect.root` keeps the subscription alive outside any component,
 * and the store's own guarantee — a fresh object on every change — is what makes reassignment
 * enough. Four lines of behaviour.
 */
let snapshot = $state(store.get())
$effect.root(() => store.subscribe(() => (snapshot = store.get())))

export const cookState = () => snapshot
export { store }

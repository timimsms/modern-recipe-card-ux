/**
 * Keyboard navigation for the chart.
 *
 * The chart's meaning is carried by two structures at once, and they are not the same structure:
 *
 *   - the **grid**, which is what you see — cells beside and above one another;
 *   - the **tree**, which is what the recipe is — a step's inputs may sit several rows away, and
 *     under `right-packed` a leaf can be a long blank run from the step that consumes it.
 *
 * Tab order gives you neither: it walks the DOM, which is grid order, one cell at a time. So
 * arrows move spatially and `i` / `o` move along the edges. Without the second pair a keyboard
 * user can reach every cell and still never learn what feeds what, which is the entire point of
 * the format.
 *
 * Everything here is progressive: the chart is complete, correct and operable with this file
 * absent, which is the constraint PHASE-03 set for the reference renderer and Phase 06 must not
 * quietly break.
 */

const focusables = (root) => [...root.querySelectorAll('[data-at]')]

const posOf = (node) => {
  const [row, col, rowSpan, colSpan] = node.dataset.at.split(',').map(Number)
  return { row, col, rowSpan, colSpan, node }
}

/** Cell centres, so a tall cell is judged by its middle rather than its top edge. */
const centre = (p) => ({ row: p.row + (p.rowSpan - 1) / 2, col: p.col + (p.colSpan - 1) / 2 })

/**
 * The nearest cell in a direction.
 *
 * Distance is deliberately lopsided: movement *along* the axis you asked for counts for little,
 * movement across it counts for a lot. Straight Euclidean distance made Right from a tall
 * ingredient cell jump diagonally to whatever happened to be closest, which reads as the focus
 * wandering rather than stepping.
 */
function nearest(from, candidates, axis, sign) {
  let best
  let bestCost = Infinity
  const here = centre(from)

  for (const candidate of candidates) {
    if (candidate.node === from.node) continue
    const there = centre(candidate)
    const along = axis === 'col' ? there.col - here.col : there.row - here.row
    const across = axis === 'col' ? there.row - here.row : there.col - here.col
    if (Math.sign(along) !== sign) continue

    const cost = Math.abs(along) + Math.abs(across) * 8
    if (cost < bestCost) {
      bestCost = cost
      best = candidate
    }
  }
  return best?.node
}

/**
 * Focus a cell and say where it went.
 *
 * Moving focus silently is the failure this whole phase is about: a sighted user sees the ring
 * move, and a screen-reader user hears the new cell but not the *relationship* that got them
 * there. `why` supplies that relationship.
 */
function go(node, announce, why) {
  if (!node) return false
  node.focus()
  if (why) announce(why)
  return true
}

/**
 * What to call a cell out loud. Exported because check-off announces the same thing, and two
 * copies of it drifted immediately — the second said "½ cup / 80 gall-purpose flour".
 */
export const describeCell = (node) => {
  if (node.dataset.step) {
    const text = node.getAttribute('aria-label')?.split('.')[0] ?? node.dataset.step
    const produces = node.dataset.produces
    // "mix" is ambiguous in a recipe with two of them; "mix, producing the wet mixture" is not.
    return produces ? `${text}, producing ${produces}` : text
  }
  // Read the quantity and the item as separate phrases. Taking `textContent` off the wrapper
  // concatenates the spans and says "1 cup / 200 gsugar".
  const label = node.closest('label')
  const clean = (selector) =>
    label?.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  const item = clean('.item')
  const qty = clean('.qty')
  return [item, qty].filter(Boolean).join(', ') || node.dataset.ing
}

const describe = describeCell

/**
 * @param {Element} root       the container the chart is drawn into
 * @param {(text: string) => void} announce  pushes a sentence to the live region
 */
export function installKeyboard(root, announce) {
  root.addEventListener('keydown', (event) => {
    const node = event.target instanceof Element ? event.target.closest('[data-at]') : null
    if (!node) return
    // Never swallow a shortcut the browser or the assistive tech owns.
    if (event.metaKey || event.ctrlKey || event.altKey) return

    const cells = focusables(root).map(posOf)
    const from = posOf(node)

    const arrows = {
      ArrowRight: ['col', 1],
      ArrowLeft: ['col', -1],
      ArrowDown: ['row', 1],
      ArrowUp: ['row', -1],
    }

    if (arrows[event.key]) {
      const [axis, sign] = arrows[event.key]
      const target = nearest(from, cells, axis, sign)
      // Only claim the key if there was somewhere to go, so at the edge of the chart the page
      // scrolls as it normally would rather than the focus appearing stuck.
      if (target) {
        event.preventDefault()
        go(target, announce, describe(target))
      }
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const onRow = cells.filter((c) => c.row <= from.row && from.row < c.row + c.rowSpan)
      const sorted = onRow.sort((a, b) => a.col - b.col)
      const target = (event.key === 'Home' ? sorted[0] : sorted.at(-1))?.node
      go(target, announce, target ? describe(target) : '')
      return
    }

    // --- Edge traversal: the tree rather than the grid ---------------------------------------

    if (event.key === 'i' || event.key === 'I') {
      event.preventDefault()
      const refs = (node.dataset.inputs ?? '').split(' ').filter(Boolean)
      if (refs.length === 0) {
        announce('Nothing feeds this step.')
        return
      }
      // Cycle, so a step with four inputs is reachable by pressing `i` four times rather than
      // needing four different keys.
      const seen = Number(node.dataset.inputCursor ?? '-1')
      const index = (seen + 1) % refs.length
      node.dataset.inputCursor = String(index)
      const ref = refs[index]
      const target = ref.startsWith('step:')
        ? root.querySelector(`[data-step="${CSS.escape(ref.slice(5))}"]`)
        : root.querySelector(`[data-ing="${CSS.escape(ref.slice(4))}"]`)
      go(
        target,
        announce,
        target ? `Input ${index + 1} of ${refs.length}: ${describe(target)}.` : '',
      )
      return
    }

    if (event.key === 'o' || event.key === 'O') {
      event.preventDefault()
      const feeds = node.dataset.feeds
      if (!feeds) {
        announce('This is the last step; nothing consumes it.')
        return
      }
      const target = root.querySelector(`[data-step="${CSS.escape(feeds)}"]`)
      go(target, announce, target ? `Feeds into ${describe(target)}.` : '')
    }
  })
}

/**
 * The shortcuts, for a help panel. Kept beside the handler so the two cannot drift — a keyboard
 * feature nobody can discover is not a keyboard feature.
 */
export const SHORTCUTS = [
  ['Arrow keys', 'move between cells'],
  ['Home / End', 'first or last cell in the row'],
  ['i', 'jump to what feeds this step (press again to cycle)'],
  ['o', 'jump to the step this feeds into'],
  ['Enter / Space', 'open the step in cook mode'],
]

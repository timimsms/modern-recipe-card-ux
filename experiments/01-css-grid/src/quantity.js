/**
 * The one place this track turns a `Quantity` into text.
 *
 * There were three copies of this — in `render.js`, `cookmode.js` and `ingredientled.js` — each
 * with its own fraction-glyph table and its own idea of where the non-breaking space goes. They
 * happened to agree. Adding serving-size scaling would have meant adding it three times and
 * hoping they kept agreeing, so they now all call this, which calls core.
 *
 * Scale and unit system live in the store, so a quantity rendered anywhere on the card reflects
 * the same factor.
 */

import { formatScaled, scaleQuantity } from '../../../packages/core/dist/index.js'

/**
 * @param {object} quantity - as authored
 * @param {{ scale?: number, unitSystem?: 'imperial' | 'metric' | 'both' }} [options]
 */
export function formatQuantity(quantity, options = {}) {
  if (!quantity) return ''
  const scaled = scaleQuantity(quantity, options.scale ?? 1)
  return formatScaled(scaled, options.unitSystem ?? 'both')
}

/**
 * The warning that comes with a quantity that could not follow the factor — a pinch, a splash,
 * anything the model marked approximate.
 *
 * Returned separately rather than folded into the string because it is not a quantity: it needs
 * to render as a note, and a renderer that concatenates it into the amount produces
 * "1 pinch to taste — does not scale" in a 6ch column.
 */
export function unscalableNote(quantity, scale = 1) {
  if (!quantity || scale === 1) return ''
  return scaleQuantity(quantity, scale).unscalable ?? ''
}

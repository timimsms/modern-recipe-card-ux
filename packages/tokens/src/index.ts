/**
 * @recipe/tokens — design tokens.
 *
 * Placeholder until Phase 03. Per PHASE-00's open question this starts hand-written:
 * one source of truth exported as typed objects plus a CSS custom-property string.
 * Revisit Style Dictionary only if Phase 03 finds this unmanageable.
 */

export const tokens = {} as const

export function toCss(): string {
  return ':root {\n}\n'
}

/**
 * What is within reach.
 *
 * A hundred-odd things and four to start from is a lot of pairs, and most of
 * them make nothing. Being stuck in a combining game is not a puzzle, it is
 * a search — so the game can tell you how many new things your discoveries
 * could make right now, and, if you ask, point at one: first only one of its
 * two ingredients, then the other.
 *
 * Pure functions over the recipe table, so scripts/check-fusion.mjs can prove
 * the count is honest: it reaches zero exactly when the tree is finished.
 */
import { RECIPES } from './fusion-recipes.js'

/** Recipes whose ingredients are both discovered and whose result is not. */
export function within(found) {
  const have = new Set([...found].map((s) => s.toLowerCase()))
  const seen = new Set()
  const out = []
  for (const [a, b, text] of RECIPES) {
    const key = text.toLowerCase()
    if (have.has(key) || seen.has(key) || !have.has(a) || !have.has(b)) continue
    seen.add(key)
    out.push({ a, b, text })
  }
  return out
}

/** How many steps from the four starters each element is, at the least. */
export function depths(seed) {
  const d = new Map(seed.map((s) => [s.toLowerCase(), 0]))
  for (let changed = true; changed; ) {
    changed = false
    for (const [a, b, text] of RECIPES) {
      if (!d.has(a) || !d.has(b)) continue
      const n = Math.max(d.get(a), d.get(b)) + 1
      const k = text.toLowerCase()
      if (!d.has(k) || d.get(k) > n) { d.set(k, n); changed = true }
    }
  }
  return d
}

/**
 * A hint: the nearest thing you could make now — the one fewest steps from
 * the start, so hints lead outwards in order instead of jumping to the end.
 */
export function hint(found, seed) {
  const options = within(found)
  if (!options.length) return null
  const d = depths(seed)
  options.sort((x, y) => (d.get(x.text.toLowerCase()) ?? 99) - (d.get(y.text.toLowerCase()) ?? 99) || x.text.localeCompare(y.text))
  return options[0]
}

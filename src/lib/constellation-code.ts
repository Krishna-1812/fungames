/**
 * Encoding a user's own drawn constellation into a URL, and back.
 *
 * A drawing is a list of strokes, each stroke an ordered chain of real star
 * ids (the same ids `star-catalog.ts` uses) that got connected as the
 * visitor clicked. The code is deliberately keyed on those real, permanent
 * catalogue ids rather than screen positions or an index into "whatever
 * order this session happened to load stars in" — the same reasoning
 * `mix-code.ts` documents for Ambient Mix, and for the same failure mode:
 * anything positional silently breaks every link already shared the moment
 * the data changes shape.
 *
 * Format: strokes joined by `_`, ids within a stroke joined by `.`, each id
 * written in base 36 (HYG ids run past 100,000; base 36 keeps most of them
 * to 3 characters rather than 6). A star id of 0 cannot occur (the real
 * HYG id 0 is the Sun, excluded from this catalogue entirely), so 0 is not
 * reserved for anything special here.
 */

export interface Stroke {
  starIds: number[]
}

/** Strokes with fewer than two stars draw nothing and are dropped rather
 *  than encoded, matching what mostRecentQualifying-style code elsewhere on
 *  this site does with a value that cannot produce anything real. */
export function encodeStrokes(strokes: Stroke[]): string {
  return strokes
    .filter((s) => s.starIds.length >= 2)
    .map((s) => s.starIds.map((id) => id.toString(36)).join('.'))
    .join('_')
}

export function decodeStrokes(code: string): Stroke[] {
  if (!code) return []
  const strokes: Stroke[] = []
  for (const part of code.split('_')) {
    if (!part) continue
    const starIds = part
      .split('.')
      .map((s) => parseInt(s, 36))
      .filter((id) => Number.isFinite(id) && id > 0)
    if (starIds.length >= 2) strokes.push({ starIds })
  }
  return strokes
}

/** A fixed, named palette rather than a raw colour in the URL — stable
 *  across a redesign of the palette itself, same reasoning as mix-code's
 *  per-layer letters. */
export const DRAW_COLORS = [
  { key: 'y', css: '#ffd94a' },
  { key: 'c', css: '#6ee7ff' },
  { key: 'p', css: '#d99bff' },
  { key: 'g', css: '#7dffb0' },
  { key: 'o', css: '#ff9a5c' },
  { key: 'r', css: '#ff6b6b' },
] as const
export type DrawColorKey = (typeof DRAW_COLORS)[number]['key']

export const colorCss = (key: string): string => DRAW_COLORS.find((c) => c.key === key)?.css ?? DRAW_COLORS[0].css

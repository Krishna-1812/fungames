/**
 * A real seven-segment display, not a monospace font standing in for one.
 *
 * Segment lettering is the standard one used on every real digital counter:
 *
 *      _a_
 *     |   |
 *    f|   |b
 *     |_g_|
 *     |   |
 *    e|   |c
 *     |___|
 *       d
 *
 * Every digit cell always renders all seven segments — the "off" ones stay
 * in the DOM at low opacity rather than being removed, which is what makes
 * an unlit position look like a real LED/LCD odometer window (a dim ghost
 * "8") instead of empty space. `scripts/check-seven-segment.mjs` re-derives
 * this table independently (by literally tracing which strokes a real
 * seven-segment digit needs) and checks it against what's exported here, and
 * separately confirms all ten digits render as ten visually distinct
 * on/off patterns.
 */

export const SEGMENT_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const
export type SegmentKey = (typeof SEGMENT_KEYS)[number]

/** [a, b, c, d, e, f, g] */
export const SEGMENTS: Record<string, readonly boolean[]> = {
  '0': [true, true, true, true, true, true, false],
  '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true],
  '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true],
  '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true],
  '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true],
  '9': [true, true, true, true, false, true, true],
  '-': [false, false, false, false, false, false, true],
  ' ': [false, false, false, false, false, false, false],
}

export function segmentsFor(ch: string): readonly boolean[] {
  return SEGMENTS[ch] ?? SEGMENTS[' ']
}

/** Static markup for one digit cell — seven segments, always present. */
export function digitCellHTML(extraClass = ''): string {
  const segs = SEGMENT_KEYS.map((k) => `<i class="seg seg-${k}"></i>`).join('')
  return `<span class="digit${extraClass ? ' ' + extraClass : ''}">${segs}</span>`
}

/** Right-aligns/truncates a raw string to `width` characters of display, pad with spaces (unlit). */
export function fitWidth(raw: string, width: number): string {
  if (raw.length >= width) return raw.slice(raw.length - width)
  return raw.padStart(width, ' ')
}

/*
 * The island's solid boxes by the tile they stand on: what is near a point, or
 * along a line, found without going through all of them (several thousand) each
 * time. On a phone the walk looked through every box a few thousand times a second
 * (your feet, the walls round you, the camera's line to you, the sun's line past
 * the hill, each raindrop's splash); now it looks through a handful.
 *
 * Each box is listed in every tile it reaches into, and in those within PAD of it,
 * so anything asked about with a margin up to PAD finds it from the one tile the
 * point is in.
 */
import type { Box } from './drive'

const PAD = 0.32
const NONE: readonly Box[] = []

export function boxGrid<B extends Box>(boxes: B[]) {
  let cells = new Map<number, B[]>()
  const key = (i: number, j: number) => (i + 64) * 4096 + (j + 64)
  const build = () => {
    cells = new Map()
    for (const b of boxes) {
      for (let i = Math.floor(b.i0 - PAD); i <= Math.floor(b.i1 + PAD); i++) for (let j = Math.floor(b.j0 - PAD); j <= Math.floor(b.j1 + PAD); j++) {
        const k = key(i, j)
        let c = cells.get(k)
        if (!c) cells.set(k, (c = []))
        c.push(b)
      }
    }
  }
  build()
  // (A stamp per box, so a box in several tiles is given once.)
  const seen = new WeakMap<B, number>()
  let stamp = 0
  const out: B[] = []
  return {
    /** The boxes at a point (and within PAD of it). */
    at: (x: number, z: number): readonly B[] => cells.get(key(Math.floor(z), Math.floor(x))) ?? (NONE as readonly B[]),
    /** The boxes in a rectangle (each once). The array is reused: use it before asking again. */
    within(x0: number, z0: number, x1: number, z1: number): readonly B[] {
      out.length = 0; stamp++
      for (let i = Math.floor(Math.min(z0, z1)); i <= Math.floor(Math.max(z0, z1)); i++) for (let j = Math.floor(Math.min(x0, x1)); j <= Math.floor(Math.max(x0, x1)); j++) {
        const c = cells.get(key(i, j)); if (!c) continue
        for (const b of c) if (seen.get(b) !== stamp) { seen.set(b, stamp); out.push(b) }
      }
      return out
    },
    /** After boxes are added (the street's furniture). */
    rebuild: build,
    get size() { return boxes.length },
  }
}

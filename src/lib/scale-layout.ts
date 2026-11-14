/**
 * Where each of Scale's things stands.
 *
 * They used to share one centre, every one of them, which is how a person came
 * to be standing inside a car inside a whale on a football pitch with four
 * captions printed through each other. Only some of that nesting is true: a
 * proton really is at the middle of a hydrogen atom, and the Sun really is at
 * the middle of the Earth's orbit. A whale is not inside a pitch.
 *
 * So things that are genuinely concentric stay on the origin, and everything
 * else stands beside it, on alternating sides, a little way off — a distance
 * proportional to its own size, so the whole arrangement is the same picture
 * at every zoom and things arrive from the edge and gather towards the middle
 * as the screen widens.
 *
 * Pure, and in metres, so `check-scale-art.mjs` can prove nothing overlaps.
 */

export type Box = {
  /** Real width and height in metres. */
  w: number
  h: number
  /** True for things that belong on the origin. */
  centred?: boolean
  /** True for things with no body to collide with: rings, clouds, waves. */
  open?: boolean
}
export type Place = { x: number; y: number }

/** A neighbour this many times smaller is a speck and may be drawn over. */
export const NEAR = 40

const overlaps = (a: Box, pa: Place, b: Box, pb: Place) => {
  const gap = 0.06 * Math.min(Math.max(a.w, a.h), Math.max(b.w, b.h))
  return Math.abs(pa.x - pb.x) < (a.w + b.w) / 2 + gap && Math.abs(pa.y - pb.y) < (a.h + b.h) / 2 + gap
}

/**
 * Place every box. `boxes` must be in ascending order of size, which is the
 * order the registry is in. In a tall window things go below and above the
 * origin first; in a wide one, right and left.
 */
export function layout(boxes: Box[], portrait: boolean): Place[] {
  const out: Place[] = []
  let turn = 0
  boxes.forEach((b, i) => {
    if (b.centred) return void out.push({ x: 0, y: 0 })
    const long = Math.max(b.w, b.h)
    const sides = portrait
      ? [[0, -1], [0, 1], [1, 0], [-1, 0]]
      : [[1, 0], [-1, 0], [0, -1], [0, 1]]
    if (turn++ % 2) sides.splice(0, 2, sides[1], sides[0])
    // Something solid that sits on the origin and is not much bigger than this
    // — the Sun, to Jupiter — has to be stood clear of, though it comes later.
    let clear0 = 0
    for (let j = i + 1; j < boxes.length; j++) {
      const o = boxes[j]
      if (o.centred && !o.open && Math.max(o.w, o.h) < long * NEAR) clear0 = Math.max(clear0, Math.max(o.w, o.h) * 0.56)
    }
    const at = (s: number[], g: number): Place => ({
      x: s[0] * (Math.max(g * long, clear0) + b.w / 2),
      y: s[1] * (Math.max(g * long, clear0) + b.h / 2),
    })
    let best: Place | null = null
    // The two sides the window is long in, pushed further out if need be,
    // before the two it is short in.
    search: for (const pair of [sides.slice(0, 2), sides.slice(2)]) for (const g of [0.1, 0.22, 0.4, 0.7, 1.1]) {
      for (const s of pair) {
        const p = at(s, g)
        let clear = true
        for (let j = 0; j < i && clear; j++) {
          const o = boxes[j]
          if (o.open || Math.max(o.w, o.h) * NEAR < long) continue
          if (overlaps(b, p, o, out[j])) clear = false
        }
        if (clear) { best = p; break search }
      }
    }
    out.push(best ?? at(sides[0], 1.1))
  })
  return out
}

/**
 * Steady Hand's four shapes and the geometry that scores them.
 *
 * The scoring used to live in the page and only knew about a straight line.
 * It is here now because a suite needs one scorer that is fair across four
 * different shapes, and "fair" is a claim worth testing rather than asserting:
 * scripts/check-steady.mjs feeds it paths whose right answer is known, and
 * checks the properties the score is supposed to have.
 *
 * ## Nothing is traced
 *
 * Every shape is drawn freehand and anchored by dots, never by an outline you
 * follow. Two dots make a line unambiguous; one centre dot makes a circle
 * unambiguous *except for its radius*, which is then fitted to whatever you
 * drew, so you are scored on roundness rather than on guessing a size. Four
 * corners fix a square, and a centre plus an outer mark fixes a spiral. Showing
 * the target and asking you to trace it would be a different game, and an
 * easier one.
 *
 * ## What a score is made of
 *
 *     score = accuracy × coverage × economy
 *
 * **Accuracy** is the arc-length-weighted mean distance from your stroke to
 * the ideal, divided by the shape's size, against a fixed tolerance. Weighting
 * by arc length rather than by sample is what stops a slow, densely sampled
 * corner from counting for more than a fast, sparse one.
 *
 * **Coverage** is how much of the ideal you actually got near. Without it,
 * half a circle drawn beautifully scores full marks, because every point you
 * did draw was in the right place.
 *
 * **Economy** is the ideal's length over yours. Without it, scribbling back
 * and forth along the line covers everything accurately and scores full marks.
 *
 * All three are needed, and the checker demonstrates each by removing it.
 *
 * ## Size is normalised, so difficulty does not change with the window
 *
 * Every shape reports a `size`, and the tolerance is a fraction of that. The
 * size is twice the greatest distance from the shape's centroid, which is the
 * segment length for a line and the diameter for a circle, and — unlike a
 * bounding box — does not change when the shape is rotated.
 */

export type Pt = { x: number; y: number }
export type Box = { w: number; h: number }

/** Average deviation of this fraction of a shape's size scores zero. */
export const TOLERANCE = 0.06
/** How much longer than the ideal a stroke may be before economy bites. */
const SLACK = 1.08
/** A target point counts as covered if the stroke came this near, in sizes. */
const COVER = TOLERANCE * 1.5

export type Dot = { x: number; y: number; label: string }

export type Shape = {
  id: string
  name: string
  /** What you have to do, on the card. */
  brief: string
  /** The anchors drawn on the board. */
  dots(box: Box, rot: number): Dot[]
  /**
   * The ideal, as a dense polyline.
   *
   * Given the stroke, because a shape may fix only part of itself: the circle
   * fixes its centre and takes its radius from what you drew.
   */
  target(box: Box, rot: number, stroke: Pt[]): Pt[]
  /** True when the stroke has to come back to where it started. */
  closed: boolean
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                   */
/* -------------------------------------------------------------------------- */

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

const centre = (box: Box): Pt => ({ x: box.w / 2, y: box.h / 2 })
/** Keeps every shape clear of the HUD along the bottom. */
export const radiusOf = (box: Box) => Math.min(box.w, box.h * 0.86) * 0.36

const rotate = (p: Pt, c: Pt, rot: number): Pt => {
  const s = Math.sin(rot), co = Math.cos(rot)
  const dx = p.x - c.x, dy = p.y - c.y
  return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co }
}

/** Total length of a polyline. */
export function pathLength(p: Pt[]): number {
  let n = 0
  for (let i = 1; i < p.length; i++) n += dist(p[i - 1], p[i])
  return n
}

/** The mass-free centroid of a point list. */
export function centroid(p: Pt[]): Pt {
  let x = 0, y = 0
  for (const q of p) { x += q.x; y += q.y }
  return p.length ? { x: x / p.length, y: y / p.length } : { x: 0, y: 0 }
}

/**
 * Twice the greatest distance from the centroid.
 *
 * A bounding-box diagonal would have done, except that it changes when the
 * shape is rotated — a square measures s√2 square-on and 2s at forty-five
 * degrees — which would quietly make the same square harder at some angles.
 */
export function sizeOf(p: Pt[]): number {
  const c = centroid(p)
  let m = 0
  for (const q of p) m = Math.max(m, dist(q, c))
  return 2 * m
}

/** Shortest distance from a point to a segment, clamped to the segment. */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const L2 = dx * dx + dy * dy
  if (L2 === 0) return dist(p, a)
  let u = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2
  u = u < 0 ? 0 : u > 1 ? 1 : u
  return Math.hypot(p.x - (a.x + dx * u), p.y - (a.y + dy * u))
}

/** Shortest distance from a point to a polyline. */
export function distToPath(p: Pt, path: Pt[]): number {
  let m = Infinity
  for (let i = 1; i < path.length; i++) {
    const d = distToSegment(p, path[i - 1], path[i])
    if (d < m) m = d
  }
  return path.length === 1 ? dist(p, path[0]) : m
}

/* -------------------------------------------------------------------------- */
/* The shapes                                                                 */
/* -------------------------------------------------------------------------- */

const SAMPLES = 360

export const SHAPES: Shape[] = [
  {
    id: 'line',
    name: 'Line',
    brief: 'One stroke from A to B. No ruler.',
    closed: false,
    dots(box, rot) {
      const c = centre(box), R = radiusOf(box)
      const a = rotate({ x: c.x - R, y: c.y }, c, rot)
      const b = rotate({ x: c.x + R, y: c.y }, c, rot)
      return [{ ...a, label: 'A' }, { ...b, label: 'B' }]
    },
    target(box, rot) {
      const [a, b] = this.dots(box, rot)
      const out: Pt[] = []
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      }
      return out
    },
  },
  {
    id: 'circle',
    name: 'Circle',
    brief: 'Go all the way round the dot and back to where you started.',
    closed: true,
    dots(box) {
      const c = centre(box)
      return [{ ...c, label: '' }]
    },
    /**
     * The centre is fixed and the radius is not: it is the mean distance from
     * the centre to your stroke. So this measures how round your circle was,
     * not how well you guessed a size nobody told you.
     */
    target(box, _rot, stroke) {
      const c = centre(box)
      const R = stroke.length
        ? stroke.reduce((s, p) => s + dist(p, c), 0) / stroke.length
        : radiusOf(box)
      const out: Pt[] = []
      for (let i = 0; i <= SAMPLES; i++) {
        const a = (i / SAMPLES) * Math.PI * 2
        out.push({ x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R })
      }
      return out
    },
  },
  {
    id: 'square',
    name: 'Square',
    brief: 'Round all four corners and back to the first. The corners are the hard part.',
    closed: true,
    dots(box, rot) {
      const c = centre(box), R = radiusOf(box) * 0.82
      return [
        { x: -R, y: -R }, { x: R, y: -R }, { x: R, y: R }, { x: -R, y: R },
      ].map((p, i) => ({
        ...rotate({ x: c.x + p.x, y: c.y + p.y }, c, rot),
        label: String(i + 1),
      }))
    },
    target(box, rot) {
      const d = this.dots(box, rot)
      const out: Pt[] = []
      const per = Math.round(SAMPLES / 4)
      for (let e = 0; e < 4; e++) {
        const a = d[e], b = d[(e + 1) % 4]
        for (let i = 0; i < per; i++) {
          const t = i / per
          out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
        }
      }
      out.push({ ...d[0] })
      return out
    },
  },
  {
    id: 'spiral',
    name: 'Spiral',
    brief: 'Two turns, from the middle out to the mark. Keep the gap even.',
    closed: false,
    dots(box, rot) {
      const c = centre(box), R = radiusOf(box)
      return [
        { ...c, label: '' },
        { ...rotate({ x: c.x + R, y: c.y }, c, rot), label: '' },
      ]
    },
    /** Archimedean: the radius grows in step with the angle, so the gap between
     *  successive turns is constant. That constancy is what is being measured. */
    target(box, rot) {
      const c = centre(box), R = radiusOf(box)
      const turns = 2
      const out: Pt[] = []
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES
        const a = rot + t * turns * Math.PI * 2
        const r = t * R
        out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r })
      }
      return out
    },
  },
]

export const SHAPE_IDS = SHAPES.map((s) => s.id)
export const shapeById = (id: string) => SHAPES.find((s) => s.id === id)

/* -------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* -------------------------------------------------------------------------- */

export type Score = {
  /** 0..100, the number shown. */
  score: number
  /** How close you were, 0..1. */
  accuracy: number
  /** How much of the shape you got near, 0..1. */
  coverage: number
  /** The ideal's length over yours, 0..1. */
  economy: number
  /** Mean deviation as a fraction of the shape's size. */
  drift: number
  /** The ideal that was scored against, for drawing afterwards. */
  target: Pt[]
  /** The size everything was normalised by, so the page can draw the band. */
  size: number
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

export function scoreStroke(shape: Shape, box: Box, rot: number, stroke: Pt[]): Score {
  const target = shape.target(box, rot, stroke)
  const size = sizeOf(target) || 1
  const empty: Score = {
    score: 0, accuracy: 0, coverage: 0, economy: 0, drift: 1, target, size,
  }
  if (stroke.length < 2) return empty

  // Accuracy, weighted by arc length so sampling density does not matter.
  let weighted = 0, strokeLen = 0
  let prevD = distToPath(stroke[0], target)
  for (let i = 1; i < stroke.length; i++) {
    const seg = dist(stroke[i - 1], stroke[i])
    const d = distToPath(stroke[i], target)
    weighted += ((prevD + d) / 2) * seg
    strokeLen += seg
    prevD = d
  }
  if (strokeLen === 0) return empty
  const drift = weighted / strokeLen / size
  const accuracy = clamp01(1 - drift / TOLERANCE)

  // Coverage: how much of the ideal came within reach of the stroke.
  const reach = COVER * size
  let seen = 0
  for (const t of target) {
    let near = false
    for (let i = 1; i < stroke.length && !near; i++) {
      if (distToSegment(t, stroke[i - 1], stroke[i]) <= reach) near = true
    }
    if (near) seen++
  }
  const coverage = target.length ? seen / target.length : 0

  const economy = clamp01((pathLength(target) * SLACK) / strokeLen)

  return {
    score: 100 * accuracy * coverage * economy,
    accuracy, coverage, economy, drift, target, size,
  }
}

/* -------------------------------------------------------------------------- */
/* The suite                                                                  */
/* -------------------------------------------------------------------------- */

export type Bests = Record<string, number>

/**
 * The combined rating: your best on every shape, averaged, and only once you
 * have attempted them all. A mean over the two you happen to be good at is not
 * a steadiness rating.
 */
export function rating(bests: Bests): number | null {
  const all = SHAPES.map((s) => bests[s.id])
  if (all.some((v) => typeof v !== 'number')) return null
  return all.reduce((a, b) => a + b, 0) / all.length
}

export function verdictFor(score: number): string {
  return score >= 99 ? 'Suspicious.'
    : score >= 92 ? 'Genuinely steady.'
    : score >= 80 ? 'Solid. Human.'
    : score >= 62 ? 'A bit of a wobble.'
    : score >= 35 ? 'That is a banana.'
    : 'That is not the shape.'
}

export function ratingName(r: number): string {
  return r >= 90 ? 'Surgeon'
    : r >= 78 ? 'Draughtsman'
    : r >= 62 ? 'Steady enough'
    : r >= 42 ? 'Ordinarily human'
    : 'Caffeinated'
}

/**
 * How much your drawing looks like the real thing.
 *
 * From Memory never had a score, and the shell needs one — but a number that
 * is not measuring anything would be worse than none. This measures two real
 * things, in the 200x140 space both drawings already share:
 *
 *   coverage  — how much of the real shape has some of your ink near it
 *   precision — how much of your ink lies near some part of the real shape
 *
 * and the likeness is their harmonic mean (an F-score), so neither a single
 * tidy line nor a scribble over the whole box can score well: the line misses
 * most of the shape, the scribble puts most of its ink where nothing is.
 *
 * "Near" is forgiving on purpose — full credit within NEAR units, fading to
 * none at FAR — because this is about what you remembered, not how steady
 * your hand is. And because nobody draws from memory in exactly the right
 * place, your drawing is also tried lined up with the real one (bounding box
 * to bounding box, with the aspect ratio allowed to bend only a little), and
 * the better of the two placements counts.
 *
 * Everything here is pure and runs headless: scripts/check-memory.mjs traces
 * every reference and checks the numbers come out the way they should.
 */

export type P = { x: number; y: number }

/** Full credit this close to the line, in 200x140 units (1.5% of the width). */
export const NEAR = 3
/** No credit this far away. */
export const FAR = 7
/** How far apart sample points sit along every line. */
const STEP = 1.5
/**
 * Ink allowed before it starts to cost, as a multiple of the reference's own
 * length. Drawing the spokes on a bicycle is fine; covering the box is not.
 * Without this a scribble scored 70-plus, because at any forgiving distance
 * the lines of a big drawing reach most of a 200x140 box.
 */
export const INK_ALLOWANCE = 1.6
/** Less ink than this (in units of length) is not a drawing yet. */
export const MIN_INK = 20

/* ---- sampling ---------------------------------------------------------- */

function line(out: P[], a: P, b: P) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / STEP))
  for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
}

function curve(out: P[], f: (t: number) => P, approxLen: number) {
  const n = Math.max(2, Math.ceil(approxLen / STEP))
  for (let k = 1; k <= n; k++) out.push(f(k / n))
}

function ellipse(out: P[], cx: number, cy: number, rx: number, ry: number) {
  const n = Math.max(8, Math.ceil((Math.PI * 2 * Math.max(rx, ry)) / STEP))
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2
    out.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) })
  }
}

/** The SVG endpoint-to-centre arc conversion, sampled. */
function arc(out: P[], x1: number, y1: number, rx: number, ry: number, rotDeg: number, fa: number, fs: number, x2: number, y2: number) {
  if (!rx || !ry) return line(out, { x: x1, y: y1 }, { x: x2, y: y2 })
  rx = Math.abs(rx); ry = Math.abs(ry)
  const phi = (rotDeg * Math.PI) / 180
  const cosP = Math.cos(phi), sinP = Math.sin(phi)
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
  const x1p = cosP * dx + sinP * dy
  const y1p = -sinP * dx + cosP * dy
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lam > 1) { const k = Math.sqrt(lam); rx *= k; ry *= k }
  const sign = fa !== fs ? 1 : -1
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const co = den === 0 ? 0 : sign * Math.sqrt(Math.max(0, num / den))
  const cxp = (co * rx * y1p) / ry
  const cyp = (-co * ry * x1p) / rx
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const d = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))
    const a = Math.acos(Math.min(1, Math.max(-1, d)))
    return ux * vy - uy * vx < 0 ? -a : a
  }
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!fs && dt > 0) dt -= 2 * Math.PI
  if (fs && dt < 0) dt += 2 * Math.PI
  curve(out, (t) => {
    const a = t1 + dt * t
    return { x: cx + rx * Math.cos(a) * cosP - ry * Math.sin(a) * sinP, y: cy + rx * Math.cos(a) * sinP + ry * Math.sin(a) * cosP }
  }, Math.abs(dt) * Math.max(rx, ry))
}

function path(out: P[], d: string) {
  const tokens = d.match(/[MmLlHhVvCcQqSsTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || []
  let i = 0, cmd = ''
  let x = 0, y = 0, sx = 0, sy = 0
  let cx2 = 0, cy2 = 0 // last control point, for S and T
  let last = ''
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) { cmd = tokens[i++]; if (/[Zz]/.test(cmd)) { line(out, { x, y }, { x: sx, y: sy }); x = sx; y = sy; last = 'Z' } continue }
    const rel = cmd === cmd.toLowerCase()
    const X = (v: number) => (rel ? x + v : v)
    const Y = (v: number) => (rel ? y + v : v)
    const U = cmd.toUpperCase()
    if (U === 'M') {
      x = X(num()); y = Y(num()); sx = x; sy = y; out.push({ x, y })
      cmd = rel ? 'l' : 'L' // later pairs are implicit lines
    } else if (U === 'L') { const nx = X(num()), ny = Y(num()); line(out, { x, y }, { x: nx, y: ny }); x = nx; y = ny }
    else if (U === 'H') { const nx = rel ? x + num() : num(); line(out, { x, y }, { x: nx, y }); x = nx }
    else if (U === 'V') { const ny = rel ? y + num() : num(); line(out, { x, y }, { x, y: ny }); y = ny }
    else if (U === 'C' || U === 'S') {
      let c1x: number, c1y: number
      if (U === 'C') { c1x = X(num()); c1y = Y(num()) }
      else if (last === 'C' || last === 'S') { c1x = 2 * x - cx2; c1y = 2 * y - cy2 }
      else { c1x = x; c1y = y }
      const c2x = X(num()), c2y = Y(num()), ex = X(num()), ey = Y(num())
      const x0 = x, y0 = y
      curve(out, (t) => {
        const m = 1 - t
        return { x: m * m * m * x0 + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * ex, y: m * m * m * y0 + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * ey }
      }, Math.hypot(c1x - x0, c1y - y0) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(ex - c2x, ey - c2y))
      cx2 = c2x; cy2 = c2y; x = ex; y = ey
    } else if (U === 'Q' || U === 'T') {
      let qx: number, qy: number
      if (U === 'Q') { qx = X(num()); qy = Y(num()) }
      else if (last === 'Q' || last === 'T') { qx = 2 * x - cx2; qy = 2 * y - cy2 }
      else { qx = x; qy = y }
      const ex = X(num()), ey = Y(num())
      const x0 = x, y0 = y
      curve(out, (t) => {
        const m = 1 - t
        return { x: m * m * x0 + 2 * m * t * qx + t * t * ex, y: m * m * y0 + 2 * m * t * qy + t * t * ey }
      }, Math.hypot(qx - x0, qy - y0) + Math.hypot(ex - qx, ey - qy))
      cx2 = qx; cy2 = qy; x = ex; y = ey
    } else if (U === 'A') {
      const rx = num(), ry = num(), rot = num(), fa = num(), fs = num()
      const ex = X(num()), ey = Y(num())
      arc(out, x, y, rx, ry, rot, fa, fs, ex, ey)
      x = ex; y = ey
    } else { i++; continue }
    last = U
  }
}

const attr = (tag: string, k: string) => {
  const m = tag.match(new RegExp(`\\s${k}="(-?[\\d.]+)"`))
  return m ? Number(m[1]) : NaN
}

/** Every line of a reference drawing, as evenly spaced points. */
export function refPoints(svg: string): P[] {
  const out: P[] = []
  for (const m of svg.matchAll(/<circle[^>]*>/g)) {
    const cx = attr(m[0], 'cx'), cy = attr(m[0], 'cy'), r = attr(m[0], 'r')
    if (![cx, cy, r].some(Number.isNaN)) ellipse(out, cx, cy, r, r)
  }
  for (const m of svg.matchAll(/<ellipse[^>]*>/g)) {
    const cx = attr(m[0], 'cx'), cy = attr(m[0], 'cy'), rx = attr(m[0], 'rx'), ry = attr(m[0], 'ry')
    if ([cx, cy, rx, ry].some(Number.isNaN)) continue
    // A rotated ellipse would need its transform; none of the references rotate one.
    ellipse(out, cx, cy, rx, ry)
  }
  for (const m of svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)) path(out, m[1])
  return out
}

/** A drawing's strokes, resampled to the same spacing as the reference. */
export function inkPoints(strokes: P[][]): { pts: P[]; length: number } {
  const pts: P[] = []
  let length = 0
  for (const s of strokes) {
    if (!s.length) continue
    pts.push({ x: s[0].x, y: s[0].y })
    for (let k = 1; k < s.length; k++) {
      length += Math.hypot(s[k].x - s[k - 1].x, s[k].y - s[k - 1].y)
      line(pts, s[k - 1], s[k])
    }
  }
  return { pts, length }
}

/* ---- scoring ----------------------------------------------------------- */

const credit = (d: number) => (d <= NEAR ? 1 : d >= FAR ? 0 : 1 - (d - NEAR) / (FAR - NEAR))

/** Mean credit of every point in `from` against its nearest point in `to`. */
function reach(from: P[], to: P[]) {
  if (!from.length || !to.length) return 0
  // A coarse grid keyed on FAR, so each lookup only scans neighbouring cells.
  const cell = FAR
  const grid = new Map<string, P[]>()
  for (const p of to) {
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`
    const list = grid.get(k)
    if (list) list.push(p)
    else grid.set(k, [p])
  }
  let sum = 0
  for (const p of from) {
    const gx = Math.floor(p.x / cell), gy = Math.floor(p.y / cell)
    let best = Infinity
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++) {
        const list = grid.get(`${gx + ox},${gy + oy}`)
        if (!list) continue
        for (const q of list) {
          const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2
          if (d < best) best = d
        }
      }
    sum += credit(Math.sqrt(best))
  }
  return sum / from.length
}

type Box = { x: number; y: number; w: number; h: number }
function box(pts: P[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }
}

/**
 * Your drawing moved and scaled onto the reference's bounding box. The two
 * axes may scale differently, but only by up to 35%: squashing a circle into
 * an ellipse is forgivable, turning a line into a square is not.
 */
function align(pts: P[], onto: Box): { pts: P[]; scale: number } {
  const b = box(pts)
  let sx = onto.w / b.w
  let sy = onto.h / b.h
  const g = Math.sqrt(sx * sy)
  const lim = 1.35
  sx = Math.min(g * lim, Math.max(g / lim, sx))
  sy = Math.min(g * lim, Math.max(g / lim, sy))
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const tx = onto.x + onto.w / 2, ty = onto.y + onto.h / 2
  return { pts: pts.map((p) => ({ x: tx + (p.x - cx) * sx, y: ty + (p.y - cy) * sy })), scale: Math.sqrt(sx * sy) }
}

export type Likeness = {
  /** 0–100. */
  score: number
  /** How much of the real shape you drew, 0–1. */
  coverage: number
  /** How much of your ink was on the real shape, 0–1. */
  precision: number
  /** Whether lining your drawing up with the reference is what scored. */
  aligned: boolean
}

function fscore(ref: P[], ink: P[], inkLen: number) {
  const coverage = reach(ref, ink)
  const refLen = ref.length * STEP
  const excess = Math.min(1, (INK_ALLOWANCE * refLen) / Math.max(inkLen, 1e-6))
  const precision = reach(ink, ref) * excess
  const f = coverage + precision ? (2 * coverage * precision) / (coverage + precision) : 0
  return { f, coverage, precision }
}

export function likeness(ref: P[], strokes: P[][]): Likeness {
  const { pts, length } = inkPoints(strokes)
  if (length < MIN_INK || !ref.length) return { score: 0, coverage: 0, precision: 0, aligned: false }
  const inPlace = fscore(ref, pts, length)
  const a = align(pts, box(ref))
  const moved = fscore(ref, a.pts, length * a.scale)
  const best = moved.f > inPlace.f ? moved : inPlace
  return {
    score: Math.round(best.f * 100),
    coverage: best.coverage,
    precision: best.precision,
    aligned: moved.f > inPlace.f,
  }
}

/**
 * A word for the number, kind at every level. The bands are set against what
 * scripts/check-memory.mjs measures: the reference traced with a 5-unit wobble
 * averages mid-80s, an 8-unit wobble high-60s, a perfectly drawn *different*
 * object mid-30s, and a random line of the right length under 30 — which is
 * why that is where "from another planet" ends.
 */
export const BANDS = [
  [80, 'Uncanny'],
  [60, 'Close'],
  [45, 'Recognisable'],
  [30, 'Loosely'],
  [0, 'From another planet'],
] as const
export function verdictFor(score: number) {
  return BANDS.find(([min]) => score >= min)![1]
}

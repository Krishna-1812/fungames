/**
 * Playing CSS animations without a browser's help: timing functions,
 * iterations and directions, fill modes, and transform lists eased function
 * by function, the way CSS does it. Shared by the build (to know how far
 * each moving thing ever reaches) and the engine (to draw it every frame).
 */
import type { Anim, Fn, Keyframes, M, Stop } from './scene'

/* ---- matrices ---------------------------------------------------------- */

export const ID: M = [1, 0, 0, 1, 0, 0]
/** a then b: the matrix that applies b first and then a (a · b). */
export function mul(a: M, b: M): M {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}
/** The same, written into `out` (no allocation), which may be a or b. */
export function mulTo(out: M, a: M, b: M): M {
  const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5]
  const b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5]
  out[0] = a0 * b0 + a2 * b1; out[1] = a1 * b0 + a3 * b1
  out[2] = a0 * b2 + a2 * b3; out[3] = a1 * b2 + a3 * b3
  out[4] = a0 * b4 + a2 * b5 + a4; out[5] = a1 * b4 + a3 * b5 + a5
  return out
}
export const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
export function invert(m: M): M {
  const det = m[0] * m[3] - m[1] * m[2]
  if (!det) return [...ID] as M
  const i = 1 / det
  return [m[3] * i, -m[1] * i, -m[2] * i, m[0] * i, (m[2] * m[5] - m[3] * m[4]) * i, (m[1] * m[4] - m[0] * m[5]) * i]
}
const rad = (d: number) => (d * Math.PI) / 180
/** One transform function as a matrix; percentages against `ref`. */
export function fnMatrix(f: Fn, ref: [number, number]): M {
  switch (f[0]) {
    case 't': return [1, 0, 0, 1, f[1] + (f[3] * ref[0]) / 100, f[2] + (f[4] * ref[1]) / 100]
    case 's': return [f[1], 0, 0, f[2], 0, 0]
    case 'r': { const c = Math.cos(rad(f[1])), s = Math.sin(rad(f[1])); return [c, s, -s, c, 0, 0] }
    case 'kx': return [1, 0, Math.tan(rad(f[1])), 1, 0, 0]
    case 'ky': return [1, Math.tan(rad(f[1])), 0, 1, 0, 0]
  }
}
/** A CSS transform list round an origin: translate(o) · f1 · f2 … · translate(-o). */
export function fnsMatrix(fns: Fn[] | null | undefined, ref: [number, number], org: [number, number]): M {
  let m: M = [1, 0, 0, 1, org[0], org[1]]
  for (const f of fns ?? []) m = mul(m, fnMatrix(f, ref))
  return mul(m, [1, 0, 0, 1, -org[0], -org[1]])
}

/** An SVG transform attribute, as a matrix. */
export function parseSvgTransform(s: string | undefined | null): M {
  let m: M = [...ID] as M
  if (!s) return m
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
  let r: RegExpExecArray | null
  while ((r = re.exec(s))) {
    const a = r[2].split(/[\s,]+/).filter(Boolean).map(Number)
    let n: M
    switch (r[1]) {
      case 'matrix': n = [a[0], a[1], a[2], a[3], a[4], a[5]]; break
      case 'translate': n = [1, 0, 0, 1, a[0], a[1] ?? 0]; break
      case 'scale': n = [a[0], 0, 0, a[1] ?? a[0], 0, 0]; break
      case 'rotate': {
        const c = Math.cos(rad(a[0])), sn = Math.sin(rad(a[0]))
        n = [c, sn, -sn, c, 0, 0]
        if (a.length === 3) n = mul(mul([1, 0, 0, 1, a[1], a[2]], n), [1, 0, 0, 1, -a[1], -a[2]])
        break
      }
      case 'skewX': n = [1, 0, Math.tan(rad(a[0])), 1, 0, 0]; break
      default: n = [1, Math.tan(rad(a[0])), 0, 1, 0, 0]
    }
    m = mul(m, n)
  }
  return m
}

/* ---- timing functions -------------------------------------------------- */

export type Ease = (p: number) => number
const bezier = (x1: number, y1: number, x2: number, y2: number): Ease => {
  // Newton's method on x(t), falling back to bisection, as browsers do.
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const X = (t: number) => ((ax * t + bx) * t + cx) * t, Y = (t: number) => ((ay * t + by) * t + cy) * t
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (p) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    let t = p
    for (let i = 0; i < 8; i++) { const e = X(t) - p; if (Math.abs(e) < 1e-6) return Y(t); const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d }
    let lo = 0, hi = 1; t = p
    for (let i = 0; i < 30; i++) { const x = X(t); if (Math.abs(x - p) < 1e-6) break; if (x < p) lo = t; else hi = t; t = (lo + hi) / 2 }
    return Y(t)
  }
}
const cache = new Map<string, Ease>()
/** A CSS timing function, from its text. */
export function ease(src: string): Ease {
  const hit = cache.get(src)
  if (hit) return hit
  let f: Ease
  const s = src.trim()
  const named: Record<string, [number, number, number, number]> = { ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] }
  if (s === 'linear') f = (p) => p
  else if (named[s]) f = bezier(...named[s])
  else if (s.startsWith('cubic-bezier(')) { const a = s.slice(13, -1).split(',').map(Number); f = bezier(a[0], a[1], a[2], a[3]) }
  else if (s === 'step-start') f = steps(1, 'start')
  else if (s === 'step-end') f = steps(1, 'end')
  else if (s.startsWith('steps(')) { const a = s.slice(6, -1).split(',').map((x) => x.trim()); f = steps(Number(a[0]), a[1] ?? 'end') }
  else throw new Error(`timing function not understood: ${src}`)
  cache.set(src, f)
  return f
}
/** CSS steps(): jump-start/start, jump-end/end, jump-none, jump-both. */
function steps(n: number, pos: string): Ease {
  const jumps = pos === 'jump-none' ? n - 1 : pos === 'jump-both' ? n + 1 : n
  const startsHigh = pos === 'start' || pos === 'jump-start' || pos === 'jump-both'
  return (p) => {
    let step = Math.floor(p * n)
    if (startsHigh) step += 1
    if (p >= 0 && step < 0) step = 0
    if (p <= 1 && step > jumps) step = jumps
    if (p >= 1) step = jumps
    return step / jumps
  }
}

/* ---- one animation at one moment --------------------------------------- */

/**
 * Where an animation is at a time (seconds since it began, its delay not yet
 * counted): which iteration's progress to read, after direction, or null
 * where it has no effect (before or after it, with no fill that holds it).
 */
export function progress(a: Anim, t: number): number | null {
  const local = t - a.delay
  const total = a.iter * a.dur
  let p: number, iter: number
  if (local < 0) {
    if (a.fill !== 2 && a.fill !== 3) return null
    p = 0; iter = 0
  } else if (local >= total) {
    if (a.fill !== 1 && a.fill !== 3) return null
    // Ended exactly on an iteration's end: hold that end, not the next start.
    iter = Math.max(0, Math.ceil(a.iter) - 1)
    p = a.iter - Math.floor(a.iter) || 1
  } else {
    iter = Math.floor(local / a.dur)
    p = (local - iter * a.dur) / a.dur
  }
  const rev = a.dir === 1 || (a.dir === 2 && iter % 2 === 1) || (a.dir === 3 && iter % 2 === 0)
  return rev ? 1 - p : p
}

export type Pose = { tf?: Fn[] | null; op?: number; fill?: string; doff?: number }
type Prop = 'tf' | 'op' | 'fill' | 'doff'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const hex = (c: string): [number, number, number] => {
  const v = c.replace('#', '')
  const full = v.length === 3 ? v.split('').map((x) => x + x).join('') : v
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}
function mixColor(a: string, b: string, t: number): string {
  if (t <= 0) return a
  if (t >= 1) return b
  const A = hex(a), B = hex(b)
  return '#' + A.map((x, i) => Math.round(lerp(x, B[i], t)).toString(16).padStart(2, '0')).join('')
}
const ident = (f: Fn): Fn => (f[0] === 't' ? ['t', 0, 0, 0, 0] : f[0] === 's' ? ['s', 1, 1] : [f[0], 0] as Fn)
function mixFns(a: Fn[] | null | undefined, b: Fn[] | null | undefined, t: number): Fn[] {
  const A = a ?? [], B = b ?? []
  const n = Math.max(A.length, B.length), out: Fn[] = []
  for (let i = 0; i < n; i++) {
    const x = A[i] ?? ident(B[i]), y = B[i] ?? ident(A[i])
    if (x[0] !== y[0]) throw new Error('transform lists do not line up')
    const r = x.map((v, k) => (k === 0 ? v : lerp(v as number, y[k] as number, t))) as Fn
    out.push(r)
  }
  return out
}

/**
 * One property of a keyframe set at progress p, easing each interval with
 * `easeFn`; `base` is the value the element has without the animation,
 * which fills in for a missing 0% or 100% stop.
 */
export function sampleProp<P extends Prop>(kf: Keyframes, prop: P, p: number, easeFn: Ease, base: Pose[P]): Pose[P] {
  let prev: Stop | null = null, next: Stop | null = null
  for (const s of kf) {
    if (s[prop] === undefined) continue
    if (s.at <= p) prev = s
    if (s.at >= p) { next = s; break }
  }
  const pa = prev ? prev.at : 0, pv = prev ? prev[prop] : base
  const na = next ? next.at : 1, nv = next ? next[prop] : base
  if (pv === undefined && nv === undefined) return base
  if (na === pa) return (next ? nv : pv) as Pose[P]
  const t = easeFn((p - pa) / (na - pa))
  if (prop === 'op' || prop === 'doff') return lerp((pv ?? base ?? (prop === 'op' ? 1 : 0)) as number, (nv ?? base ?? (prop === 'op' ? 1 : 0)) as number, t) as Pose[P]
  if (prop === 'fill') return mixColor((pv ?? base) as string, (nv ?? base) as string, t) as Pose[P]
  return mixFns(pv as Fn[] | null, nv as Fn[] | null, t) as Pose[P]
}

/** The props a keyframe set touches. */
export function touches(kf: Keyframes): Set<Prop> {
  const s = new Set<Prop>()
  for (const st of kf) for (const k of ['tf', 'op', 'fill', 'doff'] as Prop[]) if (st[k] !== undefined) s.add(k)
  return s
}

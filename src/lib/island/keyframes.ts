/**
 * Reading CSS keyframes into data the engine can play (scene.ts Stop), at
 * build time. Only what the island writes is understood: from/to/percent
 * stops, and in them transform, opacity, fill and stroke-dashoffset. Anything
 * else is an error, so a keyframe the engine cannot play fails the build
 * instead of quietly standing still.
 */
import type { Fn, Keyframes, Stop } from './scene'

const num = (s: string, what: string) => {
  const v = Number(s)
  if (!Number.isFinite(v)) throw new Error(`keyframes: not a number in ${what}: "${s}"`)
  return v
}

/** A length: px or a bare number, or a percentage (returned as [0, pct]). */
function len(s: string, what: string): [number, number] {
  s = s.trim()
  if (s.endsWith('%')) return [0, num(s.slice(0, -1), what)]
  if (s.endsWith('px')) return [num(s.slice(0, -2), what), 0]
  return [num(s, what), 0]
}
function deg(s: string, what: string): number {
  s = s.trim()
  if (s.endsWith('deg')) return num(s.slice(0, -3), what)
  if (s.endsWith('turn')) return num(s.slice(0, -4), what) * 360
  if (s.endsWith('rad')) return (num(s.slice(0, -3), what) * 180) / Math.PI
  return num(s, what)
}

/** A transform list, each function normalised to its primitive (translate, scale, rotate, skew). */
export function parseTransform(src: string): Fn[] | null {
  src = src.trim()
  if (src === 'none') return null
  const out: Fn[] = []
  const re = /([a-zA-Z]+)\(([^)]*)\)/g
  let m: RegExpExecArray | null, last = 0
  while ((m = re.exec(src))) {
    if (src.slice(last, m.index).trim()) throw new Error(`transform: cannot read "${src}"`)
    last = re.lastIndex
    const [, name, body] = m
    const a = body.split(/\s*,\s*|\s+/).filter(Boolean)
    switch (name) {
      case 'translate': { const [x, xp] = len(a[0], src), [y, yp] = a[1] ? len(a[1], src) : [0, 0]; out.push(['t', x, y, xp, yp]); break }
      case 'translateX': { const [x, xp] = len(a[0], src); out.push(['t', x, 0, xp, 0]); break }
      case 'translateY': { const [y, yp] = len(a[0], src); out.push(['t', 0, y, 0, yp]); break }
      case 'scale': out.push(['s', num(a[0], src), a[1] ? num(a[1], src) : num(a[0], src)]); break
      case 'scaleX': out.push(['s', num(a[0], src), 1]); break
      case 'scaleY': out.push(['s', 1, num(a[0], src)]); break
      case 'rotate': out.push(['r', deg(a[0], src)]); break
      case 'skewX': out.push(['kx', deg(a[0], src)]); break
      case 'skewY': out.push(['ky', deg(a[0], src)]); break
      default: throw new Error(`transform: ${name}() is not something the island's engine plays (in "${src}")`)
    }
  }
  if (src.slice(last).trim()) throw new Error(`transform: cannot read "${src}"`)
  return out
}

/** Every @keyframes block in some CSS. */
export function parseKeyframes(css: string): Record<string, Keyframes> {
  const out: Record<string, Keyframes> = {}
  const re = /@keyframes\s+([\w-]+)\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const name = m[1]
    // Find the matching close brace.
    let depth = 1, i = re.lastIndex
    for (; i < css.length && depth; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth-- }
    const body = css.slice(re.lastIndex, i - 1)
    re.lastIndex = i
    const stops = new Map<number, Stop>()
    for (const b of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sels = b[1].split(',').map((s) => s.trim())
      const decl: Omit<Stop, 'at'> = {}
      for (const d of b[2].split(';')) {
        const k = d.indexOf(':'); if (k < 0) { if (d.trim()) throw new Error(`keyframes ${name}: cannot read "${d}"`); continue }
        const prop = d.slice(0, k).trim(), val = d.slice(k + 1).trim()
        if (prop === 'transform') decl.tf = parseTransform(val)
        else if (prop === 'opacity') decl.op = num(val, `${name} opacity`)
        else if (prop === 'fill') decl.fill = val
        else if (prop === 'stroke-dashoffset') decl.doff = len(val, `${name} stroke-dashoffset`)[0]
        else throw new Error(`keyframes ${name}: the engine does not animate ${prop}`)
      }
      for (const s of sels) {
        const at = s === 'from' ? 0 : s === 'to' ? 1 : s.endsWith('%') ? num(s.slice(0, -1), `${name} stop`) / 100 : NaN
        if (!Number.isFinite(at)) throw new Error(`keyframes ${name}: cannot read the stop "${s}"`)
        stops.set(at, { ...(stops.get(at) ?? { at }), ...decl, at })
      }
    }
    out[name] = [...stops.values()].sort((a, b) => a.at - b.at)
  }
  return out
}

/**
 * Whether two transform lists can be eased one into the other function by
 * function (CSS's rule when the functions line up, the shorter padded with
 * identities). The island never needs the matrix fallback, and the build
 * checks that it never will.
 */
export function compatible(a: Fn[] | null, b: Fn[] | null): boolean {
  const A = a ?? [], B = b ?? []
  const n = Math.min(A.length, B.length)
  for (let i = 0; i < n; i++) if (A[i][0] !== B[i][0]) return false
  return true
}

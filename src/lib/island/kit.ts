/**
 * Tiny Island — the drawing kit.
 *
 * Everything on the island is drawn with this, at build time, into plain SVG
 * markup: a tiny tree of nodes serialised to a string, so the homepage ships
 * the finished picture and needs no script to show it.
 *
 * Ground is in tile units (x, y); height is in pixels (z). One outline, one
 * light: tops lit, +x faces a little darker, +y faces in shade. Every call
 * that places a point also grows the pen's bounds, which is how each
 * landmark knows its own box (for the camera, and for its card below the
 * map) without a browser to measure it.
 */

export const S = 64
export const INK = '#1b2340'
export const OUT = 1.6

export const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * S / 2, (x + y) * S / 4 - z]

type Attr = string | number | undefined | null
export type Attrs = Record<string, Attr>

const f = (v: number) => Math.round(v * 10) / 10
// Attributes keep three places below one: a stroke drawn in tile units (a
// road's centre line, a field's rows) is a few hundredths wide, and one
// decimal place would round it away to nothing.
const fa = (v: number) => (Math.abs(v) < 1 ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export class N {
  kids: (N | string)[] = []
  tag: string
  attrs: Attrs
  constructor(tag: string, attrs: Attrs = {}) { this.tag = tag; this.attrs = attrs }
  add<T extends N | string>(k: T): T { this.kids.push(k); return k }
  text(s: string) { this.kids.push(esc(s)); return this }
}

/**
 * A path's data, written shorter: every absolute line-to becomes a relative
 * one (a step of a few pixels instead of two four-digit coordinates), and
 * the numbers drop what SVG lets them drop: a leading zero, the space before
 * a minus. The island draws thousands of short segments, so this is most of
 * a hundred kilobytes. Anything it cannot follow is left exactly as it was.
 */
export function minPath(d: string): string {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g)
  if (!toks) return d
  const K = 1000, q = (s: string) => Math.round(Number(s) * K)
  const num = (v: number) => { let s = String(v / K); if (s.startsWith('0.')) s = s.slice(1); else if (s.startsWith('-0.')) s = '-' + s.slice(2); return s }
  const out: string[] = []
  const push = (cmd: string, vals: number[]) => {
    let s = cmd
    vals.forEach((v, i) => { const t = num(v); s += i === 0 || t.startsWith('-') || (t.startsWith('.') && /\.\d*$/.test(s) && !/[a-zA-Z]$/.test(s)) ? t : ' ' + t })
    out.push(s)
  }
  const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = ''
  try {
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++]
      else if (!cmd) return d
      const C = cmd.toUpperCase(), rel = cmd !== C, n = ARGS[C]
      if (n === undefined) return d
      if (n === 0) { out.push(cmd); cx = sx; cy = sy; if (i < toks.length && !/[a-zA-Z]/.test(toks[i])) return d; continue }
      const v = toks.slice(i, i + n).map(q); i += n
      if (v.length < n || v.some((x) => !Number.isFinite(x))) return d
      if (C === 'M') {
        if (rel) { cx += v[0]; cy += v[1] } else { cx = v[0]; cy = v[1] }
        push(rel ? 'm' : 'M', v); sx = cx; sy = cy; cmd = rel ? 'l' : 'L'; continue
      }
      if (C === 'L') {
        const dx = rel ? v[0] : v[0] - cx, dy = rel ? v[1] : v[1] - cy
        push('l', [dx, dy]); cx += dx; cy += dy; continue
      }
      push(cmd, v)
      if (C === 'H') cx = rel ? cx + v[0] : v[0]
      else if (C === 'V') cy = rel ? cy + v[0] : v[0]
      else { const ex = v[n - 2], ey = v[n - 1]; if (rel) { cx += ex; cy += ey } else { cx = ex; cy = ey } }
    }
  } catch { return d }
  // Repeated commands of one kind run together: "l1 2l3 4" is "l1 2 3 4".
  let s = '', last = ''
  for (const t of out) {
    const c = t[0]
    if (c === last && c !== 'M' && c !== 'm' && c !== 'Z' && c !== 'z') { const rest = t.slice(1); s += rest.startsWith('-') ? rest : ' ' + rest }
    else s += t
    last = c
  }
  return s
}

/** Groups that set round joins for everything drawn inside them. */
const joinRoots = new WeakSet<N>()
/**
 * Artwork printed on something Unity builds (a board's pinned papers, a
 * poster, a painted emblem): drawn here in its own units, w by h screen
 * pixels from its top left, and rasterised for Unity by
 * scripts/export-island.mjs into one sheet (unity/Assets/Island/Data/prints.png),
 * which Unity lays on the model's face (Buildings: Print). Never lettering:
 * the page draws that itself, live, in its own font.
 */
export const printsWanted = new Map<string, { w: number; h: number; svg: string }>()
export function print(name: string, w: number, h: number, art: N): string {
  printsWanted.set(name, { w, h, svg: render(art) })
  return name
}

/**
 * Shading for what stays drawn on the realistic island because it moves (a
 * planet going round, a puff of steam, a falling rock): a radial gradient put
 * in `parent`, for fill="url(#id)". A ball is lit as Unity lights the island
 * (from behind on the right: bright up on its right, falling to its shadowed
 * left and its rim); a puff is its colour at its heart, fading to nothing.
 */
export function ballShade(parent: N, id: string, colour: string): string {
  const g = parent.add(new N('radialGradient', { id, cx: 0.62, cy: 0.34, r: 0.78, fx: 0.66, fy: 0.28 }))
  for (const [o, c] of [[0, mix(colour, '#ffffff', 0.55)], [0.18, mix(colour, '#ffffff', 0.18)], [0.55, colour], [0.85, shade(colour, 0.62)], [1, shade(colour, 0.48)]] as [number, string][]) g.add(new N('stop', { offset: o, 'stop-color': c }))
  return `url(#${id})`
}
export function puffShade(parent: N, id: string, colour: string, core = 0.9): string {
  const g = parent.add(new N('radialGradient', { id }))
  for (const [o, op] of [[0, core], [0.45, core * 0.7], [0.8, core * 0.22], [1, 0]]) g.add(new N('stop', { offset: o, 'stop-color': colour, 'stop-opacity': op }))
  return `url(#${id})`
}

export const joinRoot = <T extends N>(n: T) => { joinRoots.add(n); return n }

export function render(n: N | string): string {
  if (typeof n === 'string') return n
  // A polygon goes out as the same shape in path data, which can be written
  // relative, and so is a good deal shorter.
  let tag = n.tag, attrs = n.attrs
  if (tag === 'polygon' && typeof attrs.points === 'string') {
    const { points, ...rest } = attrs
    tag = 'path'; attrs = { d: 'M' + (points as string).split(' ').map((q) => q.replace(',', ' ')).join('L') + 'Z', ...rest }
  }
  let a = ''
  for (const k in attrs) {
    const v = attrs[k]
    if (v === undefined || v === null || v === '') continue
    // Round joins are inherited from the layer (and each building's art), so
    // a shape saying so again is just bytes.
    if (k === 'stroke-linejoin' && v === 'round' && !joinRoots.has(n)) continue
    a +=` ${k}="${typeof v === 'number' ? fa(v) : esc(k === 'd' ? minPath(v) : v)}"`
  }
  return n.kids.length ? `<${tag}${a}>${n.kids.map(render).join('')}</${tag}>` : `<${tag}${a}/>`
}

export class Bounds {
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity
  add(x: number, y: number) { if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y }
  get w() { return this.x1 - this.x0 }
  get h() { return this.y1 - this.y0 }
}

/* ---- colour ---------------------------------------------------------- */
const rgb = (h: string) => { const v = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) }
const hx = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
export const shade = (h: string, k: number) => hx(rgb(h).map((c) => c * k))
export const mix = (a: string, b: string, t: number) => { const A = rgb(a), B = rgb(b); return hx(A.map((c, i) => c + (B[i] - c) * t)) }

export const C = {
  ink: INK, white: '#ffffff', paper: '#f4f6fc', cloud: '#eef1fa',
  cobalt: '#5b82ff', mint: '#4fe3c1', sky: '#8ccbff', lilac: '#b8a1ff', rasp: '#ff4f6e',
  stone: '#d5d9ea', stone2: '#c3c8de', rock: '#a49dcf', rockDark: '#7d74b8', slate: '#2c355e',
  glass: '#9fd4ff', glassHi: '#d8eeff', grass: '#4fe3c1', leaf: '#2bb99a', leaf2: '#1f9e82', bloom: '#8f7be0',
  wood: '#9b8bd6', bill: '#8fe0bf', water: '#8ccbff', deep: '#3b5bc4',
}

/* A box, for the helpers that decorate its faces. */
export type Box = { x: number; y: number; w: number; d: number; z0: number; h: number }

export type Draw = { fill?: string; stroke?: string; sw?: number; op?: number; cls?: string; id?: string; style?: string }

/**
 * A light for the night: where it shines, the shape that gives it off, and
 * the colour that shape glows when it is lit (null: a halo only, the shape
 * keeps its own colour, as a dark LED panel does).
 */
/**
 * A light: where it is on screen, what gives it off, its glow; and where it is
 * in the world (tile i, j and height z: Unity lights the island at night from
 * there), and for a window, the face it looks out of.
 */
export type Light = [number, number] & { el?: N; glow?: string | null; w?: [number, number, number]; face?: 'x' | 'y' }

/**
 * Things that give off light of their own (neon, a screen, a ring of bulbs),
 * drawn again above the night's veil so they stay bright after dark. Each is
 * a group placed in screen space by itself (a painted face carries its own
 * transform), so a copy of it lands in the same place.
 */
export const glows: N[] = []
export function glow<T extends N>(n: T): T { glows.push(n); return n }

/**
 * The solids a building is made of, for Unity (unity/Assets/Island/Editor/
 * Buildings.cs): every box, roof, cylinder, dome, window and door its pen
 * draws, every line between two points (a post, a mast, a cable: a rod), and
 * the pieces modelled in Unity by name (Pen.model: a lighthouse, a wheel), in the world's own units (tiles, and the site's heights), in runs:
 * a run is the solids drawn one after another with nothing else between, so
 * a picture of a run, put where the run began, keeps the painting's order
 * (anything drawn between two runs stays between their pictures). With
 * `draw` off (the realistic island), the solids draw nothing themselves:
 * `place` puts each run's picture in, and a window leaves an invisible pane
 * behind for the night's lights to find.
 */
export type Solid = { k: string; [key: string]: unknown }
export class Solids {
  runs: Solid[][] = []
  open = false
  depth = 0
  real: N | null = null
  draw: boolean
  place?: (g: N, run: number) => void
  constructor(draw = true, place?: (g: N, run: number) => void) { this.draw = draw; this.place = place }
}

export class Pen {
  g: N; ox: number; oy: number; oz: number; b: Bounds; lights: Light[]; sink?: Solids
  constructor(g: N, ox = 0, oy = 0, oz = 0, b: Bounds = new Bounds(), lights: Light[] = [], sink?: Solids) { this.g = g; this.ox = ox; this.oy = oy; this.oz = oz; this.b = b; this.lights = lights; this.sink = sink }

  /**
   * Drawing a solid: written down (unless it is inside another, or moves:
   * `rec` null), and drawn, or with the sink's `draw` off drawn into
   * nothing (its bounds still count).
   */
  private solid<T>(rec: Solid | null, fn: () => T, push = true): T {
    const s = this.sink
    if (!s || !rec) return fn()
    if (s.depth === 0 && push) {
      if (!s.open) { s.runs.push([]); s.open = true; s.place?.(this.g, s.runs.length - 1) }
      s.runs[s.runs.length - 1].push(rec)
    }
    if (s.draw) { s.depth++; try { return fn() } finally { s.depth-- } }
    const g = this.g
    if (s.depth === 0) s.real = g
    this.g = new N('g')
    s.depth++
    try { return fn() } finally { s.depth--; this.g = g; if (s.depth === 0) s.real = null }
  }
  /** Whether this pen's solids are Unity's pictures (the realistic island), not drawn. */
  get real() { return !!this.sink && !this.sink.draw }
  /** A point in the world's units, for the record. */
  private w3(p: [number, number, number]): [number, number, number] { return [p[0] + this.ox, p[1] + this.oy, p[2] + this.oz] }
  /**
   * A piece modelled in Unity by name (Buildings.cs, Model), standing at a
   * point, with what else it needs to know (`half`: rendered as a square
   * that many pixels each way round the point, for a piece that turns about
   * it); `fn` draws it on the flat island.
   */
  model<T>(name: string, at: [number, number, number], o: Record<string, unknown>, fn: () => T): T {
    const [x, y, z] = this.w3(at)
    return this.solid({ k: 'model', name, x, y, z, ...o }, fn)
  }
  /** A box in the world's units, for the record. */
  private wb(b: Box) { return { x: b.x + this.ox, y: b.y + this.oy, w: b.w, d: b.d, z0: b.z0 + this.oz, h: b.h } }

  at(x: number, y: number, z = 0): [number, number] {
    const p = P(x + this.ox, y + this.oy, z + this.oz)
    this.b.add(p[0], p[1])
    return p
  }
  /**
   * A light for the night layer, at a screen point, given off by `el` (a
   * window pane, a lamp's bulb). The element is tagged with the light's
   * number, so the island can find out at build time whether anything drawn
   * in front of it hides it (see occlusion in world.ts).
   */
  light(pt: [number, number], el: N, glowWith: string | null = '#ffe6a1', h = 0, face?: 'x' | 'y') {
    el.attrs['data-l'] = this.lights.length
    // Its area on screen, so the test can tell how much of it is hidden.
    const at = el.attrs
    let area = 0
    if (typeof at.points === 'string') {
      const p = at.points.split(' ').map((s) => s.split(',').map(Number))
      for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; area += x1 * y2 - x2 * y1 }
      area = Math.abs(area) / 2
    } else if (typeof at.r === 'number') area = Math.PI * at.r * at.r
    else if (typeof at.width === 'number' && typeof at.height === 'number') area = at.width * at.height
    el.attrs['data-la'] = Math.round(area * 10) / 10
    // Where it is in the world: on screen x = (i - j) * 32, y = (i + j) * 16 - z, at h above the pen's own height.
    const z = this.oz + h, sum = (pt[1] + z) / 16, diff = pt[0] / 32
    this.lights.push(Object.assign([pt[0], pt[1]] as [number, number], { el, glow: glowWith, w: [(sum + diff) / 2, (sum - diff) / 2, z] as [number, number, number], face }))
  }
  /** Grow the bounds round a screen-space shape drawn relative to a point. */
  grow(x0: number, y0: number, x1: number, y1: number) { this.b.add(x0, y0); this.b.add(x1, y1) }

  el(tag: string, attrs: Attrs = {}, parent: N = this.g): N {
    // Anything but a solid ends the solids' run.
    if (this.sink && this.sink.depth === 0) this.sink.open = false
    return parent.add(new N(tag, attrs))
  }
  group(cls?: string, attrs: Attrs = {}): Pen { return new Pen(this.el('g', { class: cls, ...attrs }), this.ox, this.oy, this.oz, this.b, this.lights, this.sink) }
  /** A pen moved to another spot, drawing into the same group. */
  move(dx: number, dy: number, dz = 0): Pen { return new Pen(this.g, this.ox + dx, this.oy + dy, this.oz + dz, this.b, this.lights, this.sink) }

  private sty(o: Draw, fill: string) {
    return { fill, stroke: o.stroke ?? INK, 'stroke-width': o.sw ?? OUT, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: o.op, class: o.cls, id: o.id, style: o.style }
  }
  poly(pts: [number, number, number][], fill: string, o: Draw = {}): N {
    return this.solid(o.cls || o.id ? null : { k: 'poly', pts: pts.map(([x, y, z]) => [x + this.ox, y + this.oy, z + this.oz]), fill }, () => this.polyDrawn(pts, fill, o))
  }
  private polyDrawn(pts: [number, number, number][], fill: string, o: Draw = {}) {
    // A polygon is closed, so it has no ends to cap: leaving the attribute
    // off changes nothing on screen and saves a few dozen kilobytes.
    const sty: Attrs = this.sty(o, fill)
    delete sty['stroke-linecap']
    return this.el('polygon', { points: pts.map((p) => this.at(...p).map(f).join(',')).join(' '), ...sty })
  }
  /** A path in screen space; its points grow the bounds. */
  path(d: string, fill: string, o: Draw = {}) { pathBounds(d, this.b); return this.el('path', { d, ...this.sty(o, fill) }) }
  line(a: [number, number, number], b: [number, number, number], o: Draw = {}) {
    const dash = (o as { dash?: string }).dash
    const rec = o.cls || o.id || dash || o.op !== undefined || o.stroke === 'none' ? null : { k: 'rod', pts: [this.w3(a), this.w3(b)], r: (o.sw ?? OUT) / 2, fill: o.stroke ?? INK }
    // A line drawn twice, thick in ink and then thin in a colour, is one rod in that colour.
    const s = this.sink
    if (rec && s && s.depth === 0 && s.open) {
      const run = s.runs[s.runs.length - 1], q = run[run.length - 1] as Solid & { pts?: number[][]; r?: number }
      if (q?.k === 'rod' && JSON.stringify(q.pts) === JSON.stringify(rec.pts)) {
        q.fill = rec.fill; q.r = Math.max(q.r ?? 0, rec.r)
        return this.solid(rec, () => this.lineDrawn(a, b, o), false)
      }
    }
    return this.solid(rec, () => this.lineDrawn(a, b, o))
  }
  private lineDrawn(a: [number, number, number], b: [number, number, number], o: Draw = {}) {
    const [x1, y1] = this.at(...a), [x2, y2] = this.at(...b)
    return this.el('line', { x1, y1, x2, y2, stroke: o.stroke ?? INK, 'stroke-width': o.sw ?? OUT, 'stroke-linecap': 'round', class: o.cls, opacity: o.op, 'stroke-dasharray': (o as { dash?: string }).dash })
  }
  circle(x: number, y: number, z: number, r: number, fill: string, o: Draw = {}) {
    const [cx, cy] = this.at(x, y, z); this.grow(cx - r, cy - r, cx + r, cy + r)
    return this.el('circle', { cx, cy, r, ...this.sty(o, fill) })
  }
  text(x: number, y: number, z: number, s: string, o: { size?: number; fill?: string; weight?: number; anchor?: string; font?: string; cls?: string; dx?: number; dy?: number } = {}) {
    const [tx, ty] = this.at(x, y, z)
    return this.el('text', { x: tx + (o.dx ?? 0), y: ty + (o.dy ?? 0), 'text-anchor': o.anchor ?? 'middle', 'font-family': o.font ?? 'Fredoka, system-ui, sans-serif', 'font-weight': o.weight ?? 700, 'font-size': o.size ?? 9, fill: o.fill ?? INK, class: o.cls }).text(s)
  }

  /* ---- solids ---------------------------------------------------------- */

  box(x: number, y: number, w: number, d: number, h: number, o: Draw & { z0?: number; top?: string; left?: string; right?: string; trim?: string } = {}): Box {
    const z0 = o.z0 ?? 0
    return this.solid(o.cls ? null : { k: 'box', ...this.wb({ x, y, w, d, z0, h }), fill: o.fill ?? C.white, top: o.top, trim: o.trim }, () => this.boxDrawn(x, y, w, d, h, o))
  }
  private boxDrawn(x: number, y: number, w: number, d: number, h: number, o: Draw & { z0?: number; top?: string; left?: string; right?: string; trim?: string } = {}): Box {
    const z0 = o.z0 ?? 0, c = o.fill ?? C.white
    const top = o.top ?? c, right = o.right ?? shade(c, 0.93), left = o.left ?? shade(c, 0.8)
    const g = o.cls ? this.group(o.cls) : this
    const s = { sw: o.sw, stroke: o.stroke }
    g.poly([[x + w, y, z0], [x + w, y + d, z0], [x + w, y + d, z0 + h], [x + w, y, z0 + h]], right, s)
    g.poly([[x, y + d, z0], [x + w, y + d, z0], [x + w, y + d, z0 + h], [x, y + d, z0 + h]], left, s)
    g.poly([[x, y, z0 + h], [x + w, y, z0 + h], [x + w, y + d, z0 + h], [x, y + d, z0 + h]], top, s)
    const b = { x, y, w, d, z0, h }
    if (o.trim) this.band(b, h - 3, h, o.trim)
    return b
  }
  /** A quad on a box face: face 'x' runs along y, face 'y' along x. u in 0..1. */
  quad(b: Box, face: 'x' | 'y', u0: number, u1: number, z0: number, z1: number, fill: string, o: Draw = {}): N {
    return this.solid(o.cls || o.id ? null : { k: 'quad', b: this.wb(b), face, u0, u1, z0, z1, fill }, () => this.quadDrawn(b, face, u0, u1, z0, z1, fill, o))
  }
  private quadDrawn(b: Box, face: 'x' | 'y', u0: number, u1: number, z0: number, z1: number, fill: string, o: Draw = {}) {
    const Z0 = b.z0 + z0, Z1 = b.z0 + z1
    if (face === 'x') return this.poly([[b.x + b.w, b.y + u0 * b.d, Z0], [b.x + b.w, b.y + u1 * b.d, Z0], [b.x + b.w, b.y + u1 * b.d, Z1], [b.x + b.w, b.y + u0 * b.d, Z1]], fill, o)
    return this.poly([[b.x + u0 * b.w, b.y + b.d, Z0], [b.x + u1 * b.w, b.y + b.d, Z0], [b.x + u1 * b.w, b.y + b.d, Z1], [b.x + u0 * b.w, b.y + b.d, Z1]], fill, o)
  }
  /** A coloured band right round both visible faces. */
  band(b: Box, z0: number, z1: number, fill: string) {
    this.solid({ k: 'band', b: this.wb(b), z0, z1, fill }, () => this.bandDrawn(b, z0, z1, fill))
  }
  private bandDrawn(b: Box, z0: number, z1: number, fill: string) {
    this.quad(b, 'x', 0, 1, z0, z1, shade(fill, 0.93), { sw: 1.1 })
    this.quad(b, 'y', 0, 1, z0, z1, shade(fill, 0.8), { sw: 1.1 })
  }
  /**
   * A grid of framed windows on a face: a frame, a pane with a glint, and a
   * sill. `lit` windows glow at night; their centres are kept for the lights.
   */
  windows(b: Box, face: 'x' | 'y', o: { rows?: number; cols?: number; z0?: number; h?: number; gap?: number; wide?: number; pane?: string; frame?: string; lit?: boolean; cls?: string } = {}) {
    // (Windows the page lights itself, by a class, are Unity's too: only their panes are the page's.)
    const rec = { k: 'win', b: this.wb(b), face, rows: o.rows ?? 1, cols: o.cols ?? 2, z0: o.z0 ?? 8, h: o.h ?? 10, gap: o.gap ?? 8, wide: o.wide ?? 0.5, pane: o.pane ?? C.glass, frame: o.frame ?? C.white }
    this.solid(rec, () => this.windowsDrawn(b, face, o))
  }
  private windowsDrawn(b: Box, face: 'x' | 'y', o: { rows?: number; cols?: number; z0?: number; h?: number; gap?: number; wide?: number; pane?: string; frame?: string; lit?: boolean; cls?: string } = {}) {
    const rows = o.rows ?? 1, cols = o.cols ?? 2, h = o.h ?? 10, gap = o.gap ?? 8, wide = o.wide ?? 0.5
    const pane = o.pane ?? C.glass, frame = o.frame ?? C.white
    const len = face === 'x' ? b.d : b.w
    const slot = 1 / cols, ww = slot * wide
    const dark = face === 'x' ? 0.95 : 0.84
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const u = slot * (c + 0.5), z = (o.z0 ?? 8) + r * (h + gap)
      const fu = 1.6 / (S * len)
      this.quad(b, face, u - ww / 2 - fu, u + ww / 2 + fu, z - 1.5, z + h + 1.5, shade(frame, dark), { sw: 1 })
      const glass = this.quad(b, face, u - ww / 2, u + ww / 2, z, z + h, shade(pane, dark), { sw: 0.8, cls: o.cls ?? 'win' })
      this.quad(b, face, u - ww / 2, u - ww / 2 + ww * 0.35, z + h * 0.45, z + h, shade(C.glassHi, dark), { sw: 0, op: 0.7 })
      this.quad(b, face, u - ww / 2 - fu * 2, u + ww / 2 + fu * 2, z - 2.5, z - 1, shade(frame, dark * 0.9), { sw: 0.8 })
      if (o.lit !== false) {
        const Z = b.z0 + z + h / 2
        this.light(face === 'x' ? P(b.x + b.w + this.ox, b.y + u * b.d + this.oy, Z + this.oz) : P(b.x + u * b.w + this.ox, b.y + b.d + this.oy, Z + this.oz), glass, '#ffe6a1', Z, face)
        // Drawn into nothing (the realistic island: Unity draws the window), its pane stays, unseen,
        // where it was: for the night to light, and to find whether anything stands in front of it.
        const real = this.sink?.real
        // One the page lights (a class) is there unfilled, for the page to fill with light and empty again.
        if (real) real.add(new N(glass.tag, o.cls ? { ...glass.attrs, fill: 'none', stroke: 'none' } : { ...glass.attrs, opacity: 0 }))
      }
    }
  }
  door(b: Box, face: 'x' | 'y', u: number, o: { w?: number; h?: number; fill?: string; step?: boolean } = {}) {
    this.solid({ k: 'door', b: this.wb(b), face, u, w: o.w ?? 0.22, h: o.h ?? 16, fill: o.fill ?? C.cobalt }, () => this.doorDrawn(b, face, u, o))
  }
  private doorDrawn(b: Box, face: 'x' | 'y', u: number, o: { w?: number; h?: number; fill?: string; step?: boolean } = {}) {
    const len = face === 'x' ? b.d : b.w
    const w = (o.w ?? 0.22) / len, h = o.h ?? 16
    const fill = o.fill ?? C.cobalt
    this.quad(b, face, u - w / 2 - 0.02 / len, u + w / 2 + 0.02 / len, 0, h + 2, C.white, { sw: 1 })
    this.quad(b, face, u - w / 2, u + w / 2, 0, h, shade(fill, face === 'x' ? 0.95 : 0.82), { sw: 1 })
    this.quad(b, face, u - w / 2 + w * 0.12, u - w / 2 + w * 0.42, h * 0.45, h * 0.85, C.glassHi, { sw: 0.6, op: 0.8 })
  }
  /** A striped awning sticking out from a face. */
  awning(b: Box, face: 'x' | 'y', u0: number, u1: number, z: number, out: number, colours: string[]) {
    this.solid({ k: 'awning', b: this.wb(b), face, u0, u1, z, out, colours }, () => this.awningDrawn(b, face, u0, u1, z, out, colours))
  }
  private awningDrawn(b: Box, face: 'x' | 'y', u0: number, u1: number, z: number, out: number, colours: string[]) {
    const n = colours.length * 2
    for (let k = 0; k < n; k++) {
      const a = u0 + ((u1 - u0) * k) / n, c = u0 + ((u1 - u0) * (k + 1)) / n, fill = colours[k % colours.length]
      const Z = b.z0 + z
      if (face === 'y') this.poly([[b.x + a * b.w, b.y + b.d, Z], [b.x + c * b.w, b.y + b.d, Z], [b.x + c * b.w, b.y + b.d + out, Z - 7], [b.x + a * b.w, b.y + b.d + out, Z - 7]], fill, { sw: 1 })
      else this.poly([[b.x + b.w, b.y + a * b.d, Z], [b.x + b.w, b.y + c * b.d, Z], [b.x + b.w + out, b.y + c * b.d, Z - 7], [b.x + b.w + out, b.y + a * b.d, Z - 7]], fill, { sw: 1 })
    }
  }
  pyramid(x: number, y: number, w: number, d: number, z: number, h: number, fill: string, o: Draw = {}) {
    this.solid(o.cls ? null : { k: 'pyramid', x: x + this.ox, y: y + this.oy, w, d, z: z + this.oz, h, fill }, () => this.pyramidDrawn(x, y, w, d, z, h, fill, o))
  }
  private pyramidDrawn(x: number, y: number, w: number, d: number, z: number, h: number, fill: string, o: Draw = {}) {
    const ax = x + w / 2, ay = y + d / 2
    this.poly([[x + w, y, z], [x + w, y + d, z], [ax, ay, z + h]], shade(fill, 0.95), o)
    this.poly([[x, y + d, z], [x + w, y + d, z], [ax, ay, z + h]], shade(fill, 0.8), o)
  }
  /** A pitched roof; ridge along x ('x') or y ('y'), with tile lines. */
  gable(x: number, y: number, w: number, d: number, z: number, h: number, fill: string, axis: 'x' | 'y' = 'x', o: Draw & { lines?: number; over?: number } = {}) {
    this.solid(o.cls ? null : { k: 'gable', x: x + this.ox, y: y + this.oy, w, d, z: z + this.oz, h, fill, axis, over: o.over ?? 0.06 }, () => this.gableDrawn(x, y, w, d, z, h, fill, axis, o))
  }
  private gableDrawn(x: number, y: number, w: number, d: number, z: number, h: number, fill: string, axis: 'x' | 'y' = 'x', o: Draw & { lines?: number; over?: number } = {}) {
    const e = o.over ?? 0.06
    x -= e; y -= e; w += e * 2; d += e * 2
    const lines = o.lines ?? 3
    // Three tones: the gable end in shade, the long slope, and along its
    // ridge a lighter band where the sun catches the top of it.
    const lit = mix(fill, '#ffffff', 0.24), r = 0.3
    if (axis === 'x') {
      const my = y + d / 2
      this.poly([[x + w, y, z], [x + w, y + d, z], [x + w, my, z + h]], shade(fill, 0.84), o)
      this.poly([[x, y + d, z], [x + w, y + d, z], [x + w, my, z + h], [x, my, z + h]], fill, o)
      this.poly([[x, my, z + h], [x + w, my, z + h], [x + w, my + (d / 2) * r, z + h * (1 - r)], [x, my + (d / 2) * r, z + h * (1 - r)]], lit, { sw: 0 })
      for (let k = 1; k <= lines; k++) { const t = k / (lines + 1); this.line([x, my + (d / 2) * t, z + h * (1 - t)], [x + w, my + (d / 2) * t, z + h * (1 - t)], { sw: 0.8, stroke: shade(fill, 0.75) }) }
      this.line([x, my, z + h], [x + w, my, z + h], { sw: o.sw ?? OUT, stroke: o.stroke ?? INK })
    } else {
      const mx = x + w / 2
      this.poly([[x + w, y, z], [x + w, y + d, z], [mx, y + d, z + h], [mx, y, z + h]], shade(fill, 0.96), o)
      this.poly([[mx, y, z + h], [mx, y + d, z + h], [mx + (w / 2) * r, y + d, z + h * (1 - r)], [mx + (w / 2) * r, y, z + h * (1 - r)]], mix(shade(fill, 0.96), '#ffffff', 0.24), { sw: 0 })
      this.poly([[x, y + d, z], [x + w, y + d, z], [mx, y + d, z + h]], shade(fill, 0.8), o)
      for (let k = 1; k <= lines; k++) { const t = k / (lines + 1); this.line([mx + (w / 2) * t, y, z + h * (1 - t)], [mx + (w / 2) * t, y + d, z + h * (1 - t)], { sw: 0.8, stroke: shade(fill, 0.8) }) }
      this.line([mx, y, z + h], [mx, y + d, z + h], { sw: o.sw ?? OUT, stroke: o.stroke ?? INK })
    }
  }
  cyl(cx: number, cy: number, r: number, z0: number, h: number, fill: string, o: Draw & { top?: string; side?: string; bands?: [number, number, string][] } = {}): Pen | this {
    return this.solid(o.cls ? null : { k: 'cyl', cx: cx + this.ox, cy: cy + this.oy, r, z0: z0 + this.oz, h, fill, top: o.top, side: o.side, bands: o.bands }, () => this.cylDrawn(cx, cy, r, z0, h, fill, o))
  }
  private cylDrawn(cx: number, cy: number, r: number, z0: number, h: number, fill: string, o: Draw & { top?: string; side?: string; bands?: [number, number, string][] } = {}) {
    const [x, y] = this.at(cx, cy, z0), rx = r * S * 0.707, ry = r * S * 0.354
    this.grow(x - rx, y - h - ry, x + rx, y + ry)
    const g = o.cls ? this.group(o.cls) : this
    g.path(`M${f(x - rx)} ${f(y - h)}L${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)}L${f(x + rx)} ${f(y - h)}Z`, o.side ?? shade(fill, 0.86), { sw: o.sw })
    for (const [z1, z2, c] of o.bands ?? []) g.path(`M${f(x - rx)} ${f(y - z2)}L${f(x - rx)} ${f(y - z1)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y - z1)}L${f(x + rx)} ${f(y - z2)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x - rx)} ${f(y - z2)}Z`, c, { sw: 1 })
    // A soft vertical highlight down the lit side.
    g.path(`M${f(x - rx * 0.55)} ${f(y - h + ry * 0.9)}L${f(x - rx * 0.55)} ${f(y + ry * 0.7)}`, 'none', { stroke: '#ffffff', sw: 2.5, op: 0.35 })
    g.el('ellipse', { cx: x, cy: y - h, rx, ry, fill: o.top ?? fill, stroke: o.stroke ?? INK, 'stroke-width': o.sw ?? OUT })
    return g
  }
  disc(cx: number, cy: number, r: number, z: number, fill: string, o: Draw & { dash?: string } = {}): N {
    return this.solid(o.cls || o.dash || o.op !== undefined ? null : { k: 'disc', cx: cx + this.ox, cy: cy + this.oy, r, z: z + this.oz, fill }, () => this.discDrawn(cx, cy, r, z, fill, o))
  }
  private discDrawn(cx: number, cy: number, r: number, z: number, fill: string, o: Draw & { dash?: string } = {}) {
    const [x, y] = this.at(cx, cy, z), rx = r * S * 0.707, ry = r * S * 0.354
    this.grow(x - rx, y - ry, x + rx, y + ry)
    return this.el('ellipse', { cx: x, cy: y, rx, ry, fill, stroke: o.stroke ?? INK, 'stroke-width': o.sw ?? OUT, class: o.cls, opacity: o.op, 'stroke-dasharray': o.dash })
  }
  sphere(cx: number, cy: number, z: number, r: number, fill: string, o: Draw = {}): Pen | this {
    return this.solid(o.cls ? null : { k: 'sphere', cx: cx + this.ox, cy: cy + this.oy, z: z + this.oz, r, fill }, () => this.sphereDrawn(cx, cy, z, r, fill, o))
  }
  private sphereDrawn(cx: number, cy: number, z: number, r: number, fill: string, o: Draw = {}) {
    const [x, y] = this.at(cx, cy, z)
    this.grow(x - r, y - r, x + r, y + r)
    const g = o.cls ? this.group(o.cls) : this
    g.el('circle', { cx: x, cy: y, r, fill, stroke: o.stroke ?? INK, 'stroke-width': o.sw ?? OUT })
    g.el('path', { d: `M${f(x + r * 0.2)} ${f(y + r * 0.95)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r * 0.95)} ${f(y + r * 0.2)}A${f(r * 1.2)} ${f(r * 1.2)} 0 0 1 ${f(x + r * 0.2)} ${f(y + r * 0.95)}Z`, fill: shade(fill, 0.78), opacity: 0.8 })
    g.el('ellipse', { cx: x - r * 0.35, cy: y - r * 0.42, rx: r * 0.3, ry: r * 0.18, fill: '#fff', opacity: 0.7, transform: `rotate(-30 ${f(x - r * 0.35)} ${f(y - r * 0.42)})` })
    return g
  }
  cone(cx: number, cy: number, r: number, z0: number, h: number, fill: string, o: Draw = {}) {
    this.solid(o.cls ? null : { k: 'cone', cx: cx + this.ox, cy: cy + this.oy, r, z0: z0 + this.oz, h, fill }, () => this.coneDrawn(cx, cy, r, z0, h, fill, o))
  }
  private coneDrawn(cx: number, cy: number, r: number, z0: number, h: number, fill: string, o: Draw = {}) {
    const [x, y] = this.at(cx, cy, z0), rx = r * S * 0.707, ry = r * S * 0.354
    this.grow(x - rx, y - h, x + rx, y + ry)
    this.path(`M${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)}L${f(x)} ${f(y - h)}Z`, fill, o)
    this.path(`M${f(x)} ${f(y - h)}L${f(x + rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x + rx * 0.2)} ${f(y + ry * 0.98)}Z`, shade(fill, 0.82), { sw: 0, op: 0.9 })
  }
  dome(cx: number, cy: number, r: number, z0: number, fill: string, o: Draw = {}): Pen | this {
    return this.solid(o.cls ? null : { k: 'dome', cx: cx + this.ox, cy: cy + this.oy, r, z0: z0 + this.oz, fill }, () => this.domeDrawn(cx, cy, r, z0, fill, o))
  }
  private domeDrawn(cx: number, cy: number, r: number, z0: number, fill: string, o: Draw = {}) {
    const [x, y] = this.at(cx, cy, z0), rx = r * S * 0.707, ry = r * S * 0.354
    this.grow(x - rx, y - rx, x + rx, y + ry)
    const g = o.cls ? this.group(o.cls) : this
    g.path(`M${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)}A${f(rx)} ${f(rx)} 0 0 0 ${f(x - rx)} ${f(y)}Z`, fill, o)
    g.path(`M${f(x + rx * 0.1)} ${f(y + ry)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)}A${f(rx)} ${f(rx)} 0 0 0 ${f(x + rx * 0.35)} ${f(y - rx * 0.92)}A${f(rx * 0.9)} ${f(rx * 1.05)} 0 0 1 ${f(x + rx * 0.1)} ${f(y + ry)}Z`, shade(fill, 0.8), { sw: 0, op: 0.85 })
    g.el('ellipse', { cx: x - rx * 0.4, cy: y - rx * 0.55, rx: rx * 0.22, ry: rx * 0.12, fill: '#fff', opacity: 0.6, transform: `rotate(-35 ${f(x - rx * 0.4)} ${f(y - rx * 0.55)})` })
    return g
  }
  /**
   * A group painted onto a box face: a sign, a poster, a mural. Inside it,
   * x runs left to right along the face in screen pixels (a tile is 32) and
   * y runs down, from the point (u, z) on the face, so a plain rect or a line
   * of text drawn there lies flat on the wall instead of facing the camera.
   */
  face(b: Box, face: 'x' | 'y', u: number, z: number, o: { cls?: string; w?: number; h?: number } = {}): N {
    const [sx, sy] = face === 'x' ? this.at(b.x + b.w, b.y + u * b.d, b.z0 + z) : this.at(b.x + u * b.w, b.y + b.d, b.z0 + z)
    const w = o.w ?? 0, h = o.h ?? 0
    this.grow(sx - w / 2, sy - h - w / 4, sx + w / 2, sy + h + w / 4)
    return this.el('g', { transform: `translate(${f(sx)} ${f(sy)}) skewY(${face === 'x' ? -26.565 : 26.565})`, class: o.cls })
  }
  /**
   * A board facing the viewer, bottom-centred on (x, y, z), w by h screen
   * pixels. Unity builds it (Models.cs, Plaque): a panel a little thick, edged
   * in `edge`, with `art` (drawn in its own w by h from its top left) printed
   * on its face, on two posts down to `foot` (the height they stand on) if
   * given. `drawn` draws it on the flat island. Its lettering is the page's,
   * drawn after it, over it.
   */
  plaque(name: string, x: number, y: number, z: number, w: number, h: number, art: N, o: { foot?: number; depth?: number; edge?: string }, drawn: () => void) {
    this.model('plaque', [x, y, z], { w, h, d: o.depth, foot: o.foot === undefined ? undefined : o.foot + this.oz, side: o.edge, prints: [print(name, w, h, art)] }, drawn)
  }
  /**
   * What is drawn on a box's face (with `face`, at u along it and z up it)
   * printed there by Unity instead (Models.cs, Decal): call this before
   * drawing on the face, so the print lies under anything the page draws over
   * it, and `printFace` after. `r` is the drawing's extent in the face's own
   * units, [x0, y0, x1, y1] (x across the face to the right, y down it).
   */
  decal(name: string, b: Box, face: 'x' | 'y', u: number, z: number, r: [number, number, number, number]) {
    this.model('decal', [0, 0, 0], { b: this.wb(b), face, u, z, dx: r[0], dy: r[1], w: r[2] - r[0], h: r[3] - r[1], prints: [name] }, () => null)
  }
  /**
   * The face's drawing given to its decal: everything in it but its words and
   * what moves or changes (anything with a class) printed (kit.ts, print); on
   * the realistic island, taken out of the page's drawing, those left where
   * they were.
   */
  printFace(g: N, name: string, r: [number, number, number, number]) {
    const art = new N('g', { transform: `translate(${f(-r[0])} ${f(-r[1])})` })
    const live = (n: N) => n.tag === 'text' || !!n.attrs.class
    const words = (n: N): boolean => live(n) || n.kids.some((k) => typeof k !== 'string' && words(k))
    const copy = (n: N): N | null => {
      if (live(n)) return null
      const m = new N(n.tag, { ...n.attrs })
      // Printed, not drawn: no ink outlines, only the paper's own edge.
      if (m.attrs.stroke === INK) { m.attrs.stroke = '#aab2c8'; m.attrs['stroke-width'] = Math.round(Number(m.attrs['stroke-width'] ?? 1) * 50) / 100 }
      for (const k of n.kids) { if (typeof k === 'string') m.kids.push(k); else { const q = copy(k); if (q) m.add(q) } }
      return m
    }
    for (const k of g.kids) if (typeof k !== 'string') { const q = copy(k); if (q) art.add(q) }
    print(name, r[2] - r[0], r[3] - r[1], art)
    if (!this.real) return
    // Keep only the words, and the groups that hold them.
    const keep = (n: N) => { n.kids = n.kids.filter((k) => typeof k === 'string' || words(k)); for (const k of n.kids) if (typeof k !== 'string') keep(k) }
    keep(g)
  }
  /** A flat sign facing the viewer, bottom-centred on a point. */
  sign(x: number, y: number, z: number, w: number, h: number, fill: string, label?: string, o: { size?: number; ink?: string; rx?: number; cls?: string; font?: string } = {}) {
    const [sx, sy] = this.at(x, y, z)
    this.grow(sx - w / 2, sy - h, sx + w / 2, sy)
    const g = this.group(o.cls)
    const art = new N('rect', { x: 0, y: 0, width: w, height: h, rx: o.rx ?? 3, fill })
    g.plaque(`sign-${fill.slice(1)}-${w}x${h}-${o.rx ?? 3}`, x, y, z, w, h, art, { edge: fill }, () => g.el('rect', { x: sx - w / 2, y: sy - h, width: w, height: h, rx: o.rx ?? 3, fill, stroke: INK, 'stroke-width': OUT }))
    if (label) g.el('text', { x: sx, y: sy - h / 2 + (o.size ?? 8) * 0.36, 'text-anchor': 'middle', 'font-family': o.font ?? 'Fredoka, system-ui, sans-serif', 'font-weight': 700, 'font-size': o.size ?? 8, fill: o.ink ?? INK }).text(label)
    return g
  }
  /** A flat group laid on the ground, drawn in tile units. */
  plane(x: number, y: number, z = 0, cls?: string): N {
    const [sx, sy] = this.at(x, y, z)
    return this.el('g', { transform: `translate(${f(sx)} ${f(sy)}) matrix(${S / 2} ${S / 4} ${-S / 2} ${S / 4} 0 0)`, class: cls })
  }
}

/**
 * Every point a path passes through (and its control points), so a hand-drawn
 * curve counts towards its landmark's bounds. Arcs count their end point and
 * a radius's worth either side, which is loose but never too tight.
 */
export function pathBounds(d: string, b: Bounds) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = 'M'
  const num = () => Number(toks[i++])
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++]
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase()
    const pt = (x: number, y: number) => { const X = rel ? cx + x : x, Y = rel ? cy + y : y; b.add(X, Y); return [X, Y] }
    if (C === 'Z') { cx = sx; cy = sy; continue }
    if (C === 'M' || C === 'L' || C === 'T') { const [x, y] = pt(num(), num()); cx = x; cy = y; if (C === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L' } }
    else if (C === 'H') { const x = num(); cx = rel ? cx + x : x; b.add(cx, cy) }
    else if (C === 'V') { const y = num(); cy = rel ? cy + y : y; b.add(cx, cy) }
    else if (C === 'C') { pt(num(), num()); pt(num(), num()); const [x, y] = pt(num(), num()); cx = x; cy = y }
    else if (C === 'S' || C === 'Q') { pt(num(), num()); const [x, y] = pt(num(), num()); cx = x; cy = y }
    else if (C === 'A') { const rx = num(), ry = num(); num(); num(); num(); const [x, y] = pt(num(), num()); b.add(x - rx, y - ry); b.add(x + rx, y + ry); cx = x; cy = y }
    else i++
  }
}

/** A deterministic random stream, so the island is the same island every build. */
export function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** One game's building: its footprint in tiles, and how to draw it from (0, 0). */
export type Landmark = { size: [number, number]; water?: boolean; draw: (p: Pen) => void }

/** Screen-space helpers shared by the landmark files. */
export const r1 = (v: number) => Math.round(v * 10) / 10

/** A line of lettering inside a group (a painted sign, say): centred on x by default. */
export function letter(g: N, x: number, y: number, s: string, o: { size?: number; fill?: string; weight?: number; anchor?: string; font?: string; ls?: number; cls?: string; stroke?: string; sw?: number; op?: number } = {}) {
  return g.add(new N('text', {
    x, y, 'text-anchor': o.anchor ?? 'middle', 'font-family': o.font ?? 'Fredoka, system-ui, sans-serif', 'font-weight': o.weight ?? 700,
    'font-size': o.size ?? 8, fill: o.fill ?? INK, 'letter-spacing': o.ls, class: o.cls, stroke: o.stroke, 'stroke-width': o.sw, 'stroke-linejoin': o.stroke ? 'round' : undefined, opacity: o.op,
  })).text(s)
}

/**
 * Neon lettering: a soft wide glow under a bright tube with a white-hot
 * core, so it reads as light by day and properly glows by night.
 */
export function neon(g: N, x: number, y: number, s: string, c: string, o: { size?: number; font?: string; cls?: string; anchor?: string; ls?: number } = {}) {
  const t = g.add(new N('g', { class: o.cls ?? 'neon' }))
  const base = { size: o.size ?? 8, font: o.font, anchor: o.anchor, ls: o.ls, weight: 700 }
  letter(t, x, y, s, { ...base, fill: 'none', stroke: c, sw: 3.4, op: 0.35 })
  letter(t, x, y, s, { ...base, fill: c, stroke: c, sw: 0.6 })
  letter(t, x, y, s, { ...base, fill: '#ffffff', op: 0.55, size: base.size })
  return t
}

/**
 * Movement along a path, as plain CSS keyframes rather than SMIL. SMIL's
 * animateMotion makes Chrome re-lay-out the whole island every frame; a
 * keyframed transform only repaints the thing that moved. `back` runs the
 * path there and back; `rotate` turns the mover to face along it.
 */
export const motionCss: string[] = []
/** A path's keyframes: when (%) it reaches each point, and where. Returned for whoever needs to know which way it is heading. */
export type MotionFrame = [number, number, number, number]
export function motionPath(name: string, pts: [number, number][], o: { back?: boolean; rotate?: boolean; closed?: boolean } = {}): MotionFrame[] {
  const P2 = o.closed ? [...pts, pts[0]] : pts
  const seg = P2.slice(1).map((p, i) => Math.hypot(p[0] - P2[i][0], p[1] - P2[i][1]))
  const total = seg.reduce((a, b) => a + b, 0) || 1
  const span = o.back ? 50 : 100
  const frames: [number, number, number, number][] = []
  let run = 0
  P2.forEach((p, i) => {
    const a = i < seg.length ? Math.atan2(P2[i + 1][1] - p[1], P2[i + 1][0] - p[0]) : Math.atan2(p[1] - P2[i - 1][1], p[0] - P2[i - 1][0])
    frames.push([(run / total) * span, p[0], p[1], (a * 180) / Math.PI])
    if (i < seg.length) run += seg[i]
  })
  if (o.back) for (let i = frames.length - 2; i >= 0; i--) frames.push([100 - frames[i][0], frames[i][1], frames[i][2], frames[i][3]])
  const tr = (x: number, y: number, a: number) => `transform:translate(${r1(x)}px,${r1(y)}px)${o.rotate ? ` rotate(${Math.round(a)}deg)` : ''}`
  motionCss.push(`@keyframes ${name}{${frames.map(([t, x, y, a]) => `${Math.round(t * 100) / 100}%{${tr(x, y, a)}}`).join('')}}`)
  return frames
}

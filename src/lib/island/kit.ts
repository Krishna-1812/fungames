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

export function render(n: N | string): string {
  if (typeof n === 'string') return n
  let a = ''
  for (const k in n.attrs) {
    const v = n.attrs[k]
    if (v === undefined || v === null || v === '') continue
    a += ` ${k}="${typeof v === 'number' ? fa(v) : esc(v)}"`
  }
  return n.kids.length ? `<${n.tag}${a}>${n.kids.map(render).join('')}</${n.tag}>` : `<${n.tag}${a}/>`
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

export class Pen {
  g: N; ox: number; oy: number; oz: number; b: Bounds; lights: [number, number][]
  constructor(g: N, ox = 0, oy = 0, oz = 0, b: Bounds = new Bounds(), lights: [number, number][] = []) { this.g = g; this.ox = ox; this.oy = oy; this.oz = oz; this.b = b; this.lights = lights }

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
  light(pt: [number, number], el: N) {
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
    this.lights.push(pt)
  }
  /** Grow the bounds round a screen-space shape drawn relative to a point. */
  grow(x0: number, y0: number, x1: number, y1: number) { this.b.add(x0, y0); this.b.add(x1, y1) }

  el(tag: string, attrs: Attrs = {}, parent: N = this.g): N { return parent.add(new N(tag, attrs)) }
  group(cls?: string, attrs: Attrs = {}): Pen { return new Pen(this.el('g', { class: cls, ...attrs }), this.ox, this.oy, this.oz, this.b, this.lights) }
  /** A pen moved to another spot, drawing into the same group. */
  move(dx: number, dy: number, dz = 0): Pen { return new Pen(this.g, this.ox + dx, this.oy + dy, this.oz + dz, this.b, this.lights) }

  private sty(o: Draw, fill: string) {
    return { fill, stroke: o.stroke ?? INK, 'stroke-width': o.sw ?? OUT, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: o.op, class: o.cls, id: o.id, style: o.style }
  }
  poly(pts: [number, number, number][], fill: string, o: Draw = {}) {
    // A polygon is closed, so it has no ends to cap: leaving the attribute
    // off changes nothing on screen and saves a few dozen kilobytes.
    const sty: Attrs = this.sty(o, fill)
    delete sty['stroke-linecap']
    return this.el('polygon', { points: pts.map((p) => this.at(...p).map(f).join(',')).join(' '), ...sty })
  }
  /** A path in screen space; its points grow the bounds. */
  path(d: string, fill: string, o: Draw = {}) { pathBounds(d, this.b); return this.el('path', { d, ...this.sty(o, fill) }) }
  line(a: [number, number, number], b: [number, number, number], o: Draw = {}) {
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
  quad(b: Box, face: 'x' | 'y', u0: number, u1: number, z0: number, z1: number, fill: string, o: Draw = {}) {
    const Z0 = b.z0 + z0, Z1 = b.z0 + z1
    if (face === 'x') return this.poly([[b.x + b.w, b.y + u0 * b.d, Z0], [b.x + b.w, b.y + u1 * b.d, Z0], [b.x + b.w, b.y + u1 * b.d, Z1], [b.x + b.w, b.y + u0 * b.d, Z1]], fill, o)
    return this.poly([[b.x + u0 * b.w, b.y + b.d, Z0], [b.x + u1 * b.w, b.y + b.d, Z0], [b.x + u1 * b.w, b.y + b.d, Z1], [b.x + u0 * b.w, b.y + b.d, Z1]], fill, o)
  }
  /** A coloured band right round both visible faces. */
  band(b: Box, z0: number, z1: number, fill: string) {
    this.quad(b, 'x', 0, 1, z0, z1, shade(fill, 0.93), { sw: 1.1 })
    this.quad(b, 'y', 0, 1, z0, z1, shade(fill, 0.8), { sw: 1.1 })
  }
  /**
   * A grid of framed windows on a face: a frame, a pane with a glint, and a
   * sill. `lit` windows glow at night; their centres are kept for the lights.
   */
  windows(b: Box, face: 'x' | 'y', o: { rows?: number; cols?: number; z0?: number; h?: number; gap?: number; wide?: number; pane?: string; frame?: string; lit?: boolean; cls?: string } = {}) {
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
        this.light(face === 'x' ? P(b.x + b.w + this.ox, b.y + u * b.d + this.oy, Z + this.oz) : P(b.x + u * b.w + this.ox, b.y + b.d + this.oy, Z + this.oz), glass)
      }
    }
  }
  door(b: Box, face: 'x' | 'y', u: number, o: { w?: number; h?: number; fill?: string; step?: boolean } = {}) {
    const len = face === 'x' ? b.d : b.w
    const w = (o.w ?? 0.22) / len, h = o.h ?? 16
    const fill = o.fill ?? C.cobalt
    this.quad(b, face, u - w / 2 - 0.02 / len, u + w / 2 + 0.02 / len, 0, h + 2, C.white, { sw: 1 })
    this.quad(b, face, u - w / 2, u + w / 2, 0, h, shade(fill, face === 'x' ? 0.95 : 0.82), { sw: 1 })
    this.quad(b, face, u - w / 2 + w * 0.12, u - w / 2 + w * 0.42, h * 0.45, h * 0.85, C.glassHi, { sw: 0.6, op: 0.8 })
  }
  /** A striped awning sticking out from a face. */
  awning(b: Box, face: 'x' | 'y', u0: number, u1: number, z: number, out: number, colours: string[]) {
    const n = colours.length * 2
    for (let k = 0; k < n; k++) {
      const a = u0 + ((u1 - u0) * k) / n, c = u0 + ((u1 - u0) * (k + 1)) / n, fill = colours[k % colours.length]
      const Z = b.z0 + z
      if (face === 'y') this.poly([[b.x + a * b.w, b.y + b.d, Z], [b.x + c * b.w, b.y + b.d, Z], [b.x + c * b.w, b.y + b.d + out, Z - 7], [b.x + a * b.w, b.y + b.d + out, Z - 7]], fill, { sw: 1 })
      else this.poly([[b.x + b.w, b.y + a * b.d, Z], [b.x + b.w, b.y + c * b.d, Z], [b.x + b.w + out, b.y + c * b.d, Z - 7], [b.x + b.w + out, b.y + a * b.d, Z - 7]], fill, { sw: 1 })
    }
  }
  pyramid(x: number, y: number, w: number, d: number, z: number, h: number, fill: string, o: Draw = {}) {
    const ax = x + w / 2, ay = y + d / 2
    this.poly([[x + w, y, z], [x + w, y + d, z], [ax, ay, z + h]], shade(fill, 0.95), o)
    this.poly([[x, y + d, z], [x + w, y + d, z], [ax, ay, z + h]], shade(fill, 0.8), o)
  }
  /** A pitched roof; ridge along x ('x') or y ('y'), with tile lines. */
  gable(x: number, y: number, w: number, d: number, z: number, h: number, fill: string, axis: 'x' | 'y' = 'x', o: Draw & { lines?: number; over?: number } = {}) {
    const e = o.over ?? 0.06
    x -= e; y -= e; w += e * 2; d += e * 2
    const lines = o.lines ?? 3
    if (axis === 'x') {
      const my = y + d / 2
      this.poly([[x + w, y, z], [x + w, y + d, z], [x + w, my, z + h]], shade(fill, 0.84), o)
      this.poly([[x, y + d, z], [x + w, y + d, z], [x + w, my, z + h], [x, my, z + h]], fill, o)
      for (let k = 1; k <= lines; k++) { const t = k / (lines + 1); this.line([x, my + (d / 2) * t, z + h * (1 - t)], [x + w, my + (d / 2) * t, z + h * (1 - t)], { sw: 0.8, stroke: shade(fill, 0.75) }) }
    } else {
      const mx = x + w / 2
      this.poly([[x + w, y, z], [x + w, y + d, z], [mx, y + d, z + h], [mx, y, z + h]], shade(fill, 0.96), o)
      this.poly([[x, y + d, z], [x + w, y + d, z], [mx, y + d, z + h]], shade(fill, 0.8), o)
      for (let k = 1; k <= lines; k++) { const t = k / (lines + 1); this.line([mx + (w / 2) * t, y, z + h * (1 - t)], [mx + (w / 2) * t, y + d, z + h * (1 - t)], { sw: 0.8, stroke: shade(fill, 0.8) }) }
    }
  }
  cyl(cx: number, cy: number, r: number, z0: number, h: number, fill: string, o: Draw & { top?: string; side?: string; bands?: [number, number, string][] } = {}) {
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
  disc(cx: number, cy: number, r: number, z: number, fill: string, o: Draw & { dash?: string } = {}) {
    const [x, y] = this.at(cx, cy, z), rx = r * S * 0.707, ry = r * S * 0.354
    this.grow(x - rx, y - ry, x + rx, y + ry)
    return this.el('ellipse', { cx: x, cy: y, rx, ry, fill, stroke: o.stroke ?? INK, 'stroke-width': o.sw ?? OUT, class: o.cls, opacity: o.op, 'stroke-dasharray': o.dash })
  }
  sphere(cx: number, cy: number, z: number, r: number, fill: string, o: Draw = {}) {
    const [x, y] = this.at(cx, cy, z)
    this.grow(x - r, y - r, x + r, y + r)
    const g = o.cls ? this.group(o.cls) : this
    g.el('circle', { cx: x, cy: y, r, fill, stroke: o.stroke ?? INK, 'stroke-width': o.sw ?? OUT })
    g.el('path', { d: `M${f(x + r * 0.2)} ${f(y + r * 0.95)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r * 0.95)} ${f(y + r * 0.2)}A${f(r * 1.2)} ${f(r * 1.2)} 0 0 1 ${f(x + r * 0.2)} ${f(y + r * 0.95)}Z`, fill: shade(fill, 0.78), opacity: 0.8 })
    g.el('ellipse', { cx: x - r * 0.35, cy: y - r * 0.42, rx: r * 0.3, ry: r * 0.18, fill: '#fff', opacity: 0.7, transform: `rotate(-30 ${f(x - r * 0.35)} ${f(y - r * 0.42)})` })
    return g
  }
  cone(cx: number, cy: number, r: number, z0: number, h: number, fill: string, o: Draw = {}) {
    const [x, y] = this.at(cx, cy, z0), rx = r * S * 0.707, ry = r * S * 0.354
    this.grow(x - rx, y - h, x + rx, y + ry)
    this.path(`M${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)}L${f(x)} ${f(y - h)}Z`, fill, o)
    this.path(`M${f(x)} ${f(y - h)}L${f(x + rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x + rx * 0.2)} ${f(y + ry * 0.98)}Z`, shade(fill, 0.82), { sw: 0, op: 0.9 })
  }
  dome(cx: number, cy: number, r: number, z0: number, fill: string, o: Draw = {}) {
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
  /** A flat sign facing the viewer, bottom-centred on a point. */
  sign(x: number, y: number, z: number, w: number, h: number, fill: string, label?: string, o: { size?: number; ink?: string; rx?: number; cls?: string; font?: string } = {}) {
    const [sx, sy] = this.at(x, y, z)
    this.grow(sx - w / 2, sy - h, sx + w / 2, sy)
    const g = this.group(o.cls)
    g.el('rect', { x: sx - w / 2, y: sy - h, width: w, height: h, rx: o.rx ?? 3, fill, stroke: INK, 'stroke-width': OUT })
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
export function motionPath(name: string, pts: [number, number][], o: { back?: boolean; rotate?: boolean; closed?: boolean } = {}) {
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
}

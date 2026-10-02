/**
 * Tiny Island — the living things and the wild ones: plants that suit each
 * district, rocks worth looking at, farm fields, and the animals.
 *
 * Every function draws at a ground point (x, y) with the pen's own height as
 * its floor, like props.ts. Anything that moves on its own carries the class
 * `amb` and its screen box in `data-b`, so the camera can pause it when it is
 * off screen or far from the middle (see cull() in camera.ts).
 */
import { C, INK, OUT, N, Pen, shade, S, motionPath } from './kit'

const f = (v: number) => Math.round(v * 10) / 10
const box = (x0: number, y0: number, x1: number, y1: number) => `${f(x0)} ${f(y0)} ${f(x1)} ${f(y1)}`
const blob = (x: number, y: number, rx: number, ry: number) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`

const SHADOW = { fill: INK, opacity: 0.12 }

/* ---- plants ------------------------------------------------------------ */

/** A pine with snow lying on every tier. */
export function snowPine(p: Pen, x: number, y: number, c = C.leaf, k = 1) {
  const [bx, by] = p.at(x, y)
  p.el('ellipse', { cx: bx, cy: by + 1, rx: 12 * k, ry: 5 * k, ...SHADOW })
  p.path(`M${f(bx)} ${f(by)}L${f(bx)} ${f(by - 8 * k)}`, 'none', { sw: 3 * k, stroke: C.wood })
  for (const [z, r, h] of [[6, 0.24, 20], [16, 0.19, 18], [25, 0.13, 16]] as const) {
    p.cone(x, y, r * k, z * k, h * k, c)
    // The snow: the top of each tier, with a scalloped hem.
    const [tx, ty] = p.at(x, y, (z + h) * k)
    const w = r * k * S * 0.707 * 0.62, d = h * k * 0.45
    p.path(`M${f(tx)} ${f(ty)}L${f(tx + w)} ${f(ty + d)}q${f(-w * 0.25)} ${f(3 * k)} ${f(-w * 0.5)} 0q${f(-w * 0.25)} ${f(3.5 * k)} ${f(-w * 0.5)} 0q${f(-w * 0.25)} ${f(3 * k)} ${f(-w * 0.5)} 0q${f(-w * 0.25)} ${f(3.5 * k)} ${f(-w * 0.5)} 0Z`, '#ffffff', { sw: 1.1 })
  }
}

/** A saguaro, arms up; sometimes in flower. */
export function cactus(p: Pen, x: number, y: number, k = 1, flower = false) {
  const [bx, by] = p.at(x, y)
  const c = '#3fbf8f', hi = '#7fe0bb'
  p.el('ellipse', { cx: bx, cy: by + 1, rx: 9 * k, ry: 3.6 * k, ...SHADOW })
  const trunk = `M${f(bx - 4 * k)} ${f(by)}V${f(by - 30 * k)}a${f(4 * k)} ${f(4 * k)} 0 0 1 ${f(8 * k)} 0V${f(by)}Z`
  const armL = `M${f(bx - 4 * k)} ${f(by - 12 * k)}H${f(bx - 9 * k)}a${f(2.5 * k)} ${f(2.5 * k)} 0 0 1 ${f(-2.5 * k)} ${f(-2.5 * k)}V${f(by - 21 * k)}a${f(2.5 * k)} ${f(2.5 * k)} 0 0 1 ${f(5 * k)} 0V${f(by - 17 * k)}H${f(bx - 4 * k)}Z`
  const armR = `M${f(bx + 4 * k)} ${f(by - 17 * k)}H${f(bx + 8 * k)}V${f(by - 26 * k)}a${f(2.5 * k)} ${f(2.5 * k)} 0 0 1 ${f(5 * k)} 0V${f(by - 16 * k)}a${f(2.5 * k)} ${f(2.5 * k)} 0 0 1 ${f(-2.5 * k)} ${f(2.5 * k)}H${f(bx + 4 * k)}Z`
  p.path(armL, c, { sw: 1.4 }); p.path(armR, c, { sw: 1.4 }); p.path(trunk, c, { sw: 1.5 })
  p.path(`M${f(bx - 1.5 * k)} ${f(by - 2)}V${f(by - 29 * k)}`, 'none', { stroke: hi, sw: 1.4 })
  p.path(`M${f(bx + 1.8 * k)} ${f(by - 2)}V${f(by - 28 * k)}`, 'none', { stroke: shade(c, 0.78), sw: 1.2 })
  if (flower) p.el('circle', { cx: bx, cy: by - 34 * k, r: 2.6 * k, fill: '#ff8fb0', stroke: INK, 'stroke-width': 1 })
}

/** A round barrel cactus, ribbed. */
export function barrelCactus(p: Pen, x: number, y: number, k = 1) {
  const [bx, by] = p.at(x, y)
  p.el('ellipse', { cx: bx, cy: by + 1, rx: 8 * k, ry: 3 * k, ...SHADOW })
  p.path(blob(bx, by - 6 * k, 6.5 * k, 6.5 * k), '#46c99a', { sw: 1.4 })
  p.path(`M${f(bx - 3 * k)} ${f(by - 11 * k)}q-1 5 0 10M${f(bx + 3 * k)} ${f(by - 11 * k)}q1 5 0 10M${f(bx)} ${f(by - 12.5 * k)}v12`, 'none', { stroke: shade('#46c99a', 0.75), sw: 1 })
  p.el('circle', { cx: bx, cy: by - 12.5 * k, r: 1.8 * k, fill: '#ff8fb0', stroke: INK, 'stroke-width': 0.8 })
}

/** A cattail or three, for a bank. */
export function reeds(p: Pen, x: number, y: number, k = 1) {
  const [bx, by] = p.at(x, y)
  let stems = '', heads = ''
  for (const [dx, h, lean] of [[-4, 18, -2], [0, 22, 0.5], [4, 16, 2.5], [-1.5, 13, -3]]) {
    stems += `M${f(bx + dx * k)} ${f(by)}q${f(lean * 0.4 * k)} ${f(-h * 0.5 * k)} ${f(lean * k)} ${f(-h * k)}`
    heads += `M${f(bx + (dx + lean) * k)} ${f(by - h * k)}l0 ${f(-6 * k)}`
  }
  p.path(stems, 'none', { stroke: '#2f9e7f', sw: 1.4 * k })
  p.path(heads, 'none', { stroke: '#6d5bb8', sw: 3.2 * k })
  p.grow(bx - 8 * k, by - 30 * k, bx + 8 * k, by)
}

/** A clipped hedge running between two ground points. */
export function hedge(p: Pen, x0: number, y0: number, x1: number, y1: number, h = 9) {
  const c = '#2fbf98'
  const along = Math.abs(x1 - x0) > Math.abs(y1 - y0)
  const t = 0.14
  const b = along ? p.box(Math.min(x0, x1), y0 - t / 2, Math.abs(x1 - x0), t, h, { fill: c, top: '#5ad8b2', sw: 1.2 }) : p.box(x0 - t / 2, Math.min(y0, y1), t, Math.abs(y1 - y0), h, { fill: c, top: '#5ad8b2', sw: 1.2 })
  // Little dots of light on the clipped top.
  const n = Math.max(2, Math.round((along ? b.w : b.d) / 0.18))
  let d = ''
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n
    const [sx, sy] = along ? p.at(b.x + u * b.w, b.y + t / 2, h) : p.at(b.x + t / 2, b.y + u * b.d, h)
    d += blob(sx, sy - 0.5, 1.4, 0.8)
  }
  p.path(d, '#a9f0d8', { sw: 0 })
}

/** A topiary ball in a pot. */
export function topiary(p: Pen, x: number, y: number, k = 1) {
  const [bx, by] = p.at(x, y)
  p.el('ellipse', { cx: bx, cy: by + 1, rx: 7 * k, ry: 3 * k, ...SHADOW })
  p.path(`M${f(bx - 4.5 * k)} ${f(by - 6 * k)}h${f(9 * k)}l${f(-1.2 * k)} ${f(6 * k)}h${f(-6.6 * k)}z`, C.lilac, { sw: 1.2 })
  p.path(`M${f(bx)} ${f(by - 6 * k)}v${f(-6 * k)}`, 'none', { stroke: C.wood, sw: 1.6 })
  p.el('circle', { cx: bx, cy: by - 17 * k, r: 6.5 * k, fill: '#2fbf98', stroke: INK, 'stroke-width': OUT })
  p.el('circle', { cx: bx - 2.2 * k, cy: by - 19.5 * k, r: 2 * k, fill: '#ffffff', opacity: 0.35 })
  p.grow(bx - 7 * k, by - 24 * k, bx + 7 * k, by + 2)
}

/** A ring of toadstools on the forest floor. */
export function toadstools(p: Pen, x: number, y: number) {
  const [bx, by] = p.at(x, y)
  let stems = '', caps = '', dots = ''
  for (const [dx, dy, s] of [[-5, 0, 1], [1, -2, 0.8], [5, 1, 1.1], [-1, 3, 0.7]]) {
    const cx = bx + dx, cy = by + dy
    stems += `M${f(cx - 1 * s)} ${f(cy)}v${f(-3.5 * s)}h${f(2 * s)}v${f(3.5 * s)}z`
    caps += `M${f(cx - 3.4 * s)} ${f(cy - 3.2 * s)}a${f(3.4 * s)} ${f(3 * s)} 0 0 1 ${f(6.8 * s)} 0z`
    dots += blob(cx - 1 * s, cy - 4.6 * s, 0.7 * s, 0.6 * s)
  }
  p.path(stems, '#ffffff', { sw: 0.8 }); p.path(caps, C.rasp, { sw: 1 }); p.path(dots, '#ffffff', { sw: 0 })
  p.grow(bx - 9, by - 8, bx + 9, by + 4)
}

/* ---- rock ------------------------------------------------------------ */

/** A standing arch of red-banded rock, as the desert makes. */
export function arch(p: Pen, x: number, y: number) {
  const rock = { fill: '#b9a9e6', sw: 1.4 }
  const band = (b: ReturnType<Pen['box']>, z0: number, z1: number) => p.band(b, z0, z1, '#9887d3')
  const a = p.box(x - 0.42, y - 0.12, 0.22, 0.24, 30, rock); band(a, 10, 14); band(a, 22, 25)
  const b = p.box(x + 0.2, y - 0.12, 0.22, 0.24, 30, rock); band(b, 10, 14); band(b, 22, 25)
  const t = p.box(x - 0.46, y - 0.15, 0.92, 0.3, 11, { ...rock, z0: 30, top: '#cfc3f0' }); band(t, 4, 7)
}

/** A tall, flat-topped butte: sloping sides, a band of strata every few metres, scree at its foot. */
export function butte(p: Pen, x: number, y: number, h = 34) {
  const r0 = 0.36, r1 = 0.24, fill = '#b5a6e4'
  const at = (t: number) => r0 + (r1 - r0) * t
  const [sx, sy] = p.at(x, y)
  p.el('ellipse', { cx: sx, cy: sy + 4, rx: 30, ry: 11, fill: INK, opacity: 0.1 })
  p.poly([[x + r0, y - r0, 0], [x + r0, y + r0, 0], [x + r1, y + r1, h], [x + r1, y - r1, h]], shade(fill, 0.93), { sw: 1.4 })
  p.poly([[x - r0, y + r0, 0], [x + r0, y + r0, 0], [x + r1, y + r1, h], [x - r1, y + r1, h]], shade(fill, 0.8), { sw: 1.4 })
  p.poly([[x - r1, y - r1, h], [x + r1, y - r1, h], [x + r1, y + r1, h], [x - r1, y + r1, h]], '#cfc4f1', { sw: 1.4 })
  // Strata: a darker band round both faces every nine pixels or so.
  for (let z = 6; z < h - 4; z += 9) {
    const t0 = z / h, t1 = (z + 3) / h, a0 = at(t0), a1 = at(t1)
    p.poly([[x + a0, y - a0, z], [x + a0, y + a0, z], [x + a1, y + a1, z + 3], [x + a1, y - a1, z + 3]], '#9d8cd8', { sw: 0 })
    p.poly([[x - a0, y + a0, z], [x + a0, y + a0, z], [x + a1, y + a1, z + 3], [x - a1, y + a1, z + 3]], '#8a78cc', { sw: 0 })
  }
  // The edges again over the bands, and a few fallen stones.
  p.poly([[x + r0, y - r0, 0], [x + r0, y + r0, 0], [x + r1, y + r1, h], [x + r1, y - r1, h]], 'none', { sw: 1.4 })
  p.poly([[x - r0, y + r0, 0], [x + r0, y + r0, 0], [x + r1, y + r1, h], [x - r1, y + r1, h]], 'none', { sw: 1.4 })
  for (const [u, v, r] of [[0.45, 0.2, 3], [0.2, 0.46, 2.4], [0.5, 0.42, 2]]) { const [rx, ry] = p.at(x + u, y + v); p.path(`M${f(rx - r)} ${f(ry)}l${f(r * 0.6)} ${f(-r)}l${f(r)} 0l${f(r * 0.6)} ${f(r)}z`, '#a596dc', { sw: 1 }) }
  // A tuft of something hardy on top.
  const [tx, ty] = p.at(x, y, h)
  p.path(`M${f(tx - 4)} ${f(ty)}q1 -4 0 -6M${f(tx)} ${f(ty)}v-7M${f(tx + 4)} ${f(ty)}q-1 -4 0 -6`, 'none', { stroke: '#3fbf8f', sw: 1.4 })
}

/* ---- the farm ------------------------------------------------------------ */

/**
 * A field laid flat on the ground: crop rows in tile units. `kind` is
 * 'lavender' (purple rows), 'wheat' (pale rows) or 'greens'.
 */
export function field(p: Pen, x: number, y: number, w: number, d: number, kind: 'lavender' | 'wheat' | 'greens') {
  const g = p.plane(x, y)
  const soil = kind === 'lavender' ? '#a99be0' : '#b7aee0'
  const row = kind === 'lavender' ? '#8b6fe0' : kind === 'wheat' ? '#f3ecd4' : '#36c79c'
  const hi = kind === 'lavender' ? '#c3b0ff' : kind === 'wheat' ? '#ffffff' : '#8eedcf'
  g.add(new N('rect', { x: 0.06, y: 0.06, width: w - 0.12, height: d - 0.12, rx: 0.08, fill: soil, stroke: INK, 'stroke-width': 0.035 }))
  let rows = '', his = ''
  for (let u = 0.2; u < w - 0.12; u += 0.2) { rows += `M${f(u * 100) / 100} 0.16V${f((d - 0.16) * 100) / 100}`; his += `M${f((u - 0.03) * 100) / 100} 0.18V${f((d - 0.18) * 100) / 100}` }
  g.add(new N('path', { d: rows, stroke: row, 'stroke-width': 0.11, 'stroke-linecap': 'round', fill: 'none' }))
  g.add(new N('path', { d: his, stroke: hi, 'stroke-width': 0.03, 'stroke-linecap': 'round', fill: 'none', opacity: 0.8 }))
  p.at(x, y); p.at(x + w, y + d)
}

/** A round hay bale. */
export function bale(p: Pen, x: number, y: number) {
  p.cyl(x, y, 0.09, 0, 8, '#f1e7c8', { sw: 1.2, top: '#f8f1dc', bands: [[3.5, 4.5, '#ddd0a8']] })
}

/** A windmill whose sails turn. */
export function windmill(p: Pen, x: number, y: number) {
  const [bx, by] = p.at(x, y)
  p.el('ellipse', { cx: bx, cy: by + 2, rx: 22, ry: 9, ...SHADOW })
  // The tower, narrowing, with a door and a window.
  p.path(`M${f(bx - 13)} ${f(by)}L${f(bx - 8)} ${f(by - 46)}H${f(bx + 8)}L${f(bx + 13)} ${f(by)}Z`, '#ffffff', { sw: OUT })
  p.path(`M${f(bx + 1)} ${f(by)}L${f(bx + 1)} ${f(by - 46)}H${f(bx + 8)}L${f(bx + 13)} ${f(by)}Z`, '#e6e9f6', { sw: 0 })
  p.path(`M${f(bx - 13)} ${f(by)}L${f(bx - 8)} ${f(by - 46)}H${f(bx + 8)}L${f(bx + 13)} ${f(by)}Z`, 'none', { sw: OUT })
  p.path(`M${f(bx - 4)} ${f(by)}v-10a4 4 0 0 1 8 0v10z`, C.cobalt, { sw: 1.2 })
  p.path(`M${f(bx - 2.5)} ${f(by - 30)}h5v6h-5z`, C.glass, { sw: 1 })
  p.path(`M${f(bx - 11)} ${f(by - 45)}L${f(bx)} ${f(by - 58)}L${f(bx + 11)} ${f(by - 45)}Z`, C.rasp, { sw: OUT })
  // The sails, round a hub, turning.
  const cx = bx, cy = by - 47
  const sails = p.el('g', { class: 'mill-sails amb', 'data-b': box(cx - 36, cy - 36, cx + 36, cy + 36) })
  for (const a of [0, 90, 180, 270]) {
    const sg = sails.add(new N('g', { transform: `rotate(${a} ${f(cx)} ${f(cy)})` }))
    sg.add(new N('path', { d: `M${f(cx)} ${f(cy)}V${f(cy - 34)}`, stroke: INK, 'stroke-width': 1.8 }))
    sg.add(new N('path', { d: `M${f(cx + 1)} ${f(cy - 8)}h8v-25h-8z`, fill: '#ffffff', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
    sg.add(new N('path', { d: `M${f(cx + 1)} ${f(cy - 16)}h8M${f(cx + 1)} ${f(cy - 24)}h8M${f(cx + 5)} ${f(cy - 8)}v-25`, stroke: shade('#ffffff', 0.75), 'stroke-width': 0.8 }))
  }
  sails.add(new N('circle', { cx: f(cx), cy: f(cy), r: 3, fill: C.slate, stroke: INK, 'stroke-width': 1 }))
  p.grow(cx - 36, cy - 36, cx + 36, by + 4)
}

/* ---- animals --------------------------------------------------------------- */

/** A sheep, grazing; now and then its head comes up. */
export function sheep(p: Pen, x: number, y: number, flip = false, delay = 0) {
  const [bx, by] = p.at(x, y)
  const s = flip ? -1 : 1
  const g = p.el('g', { class: 'sheep amb', 'data-b': box(bx - 10, by - 12, bx + 10, by + 2), transform: flip ? `translate(${f(bx * 2)} 0) scale(-1 1)` : undefined })
  g.add(new N('ellipse', { cx: f(bx), cy: f(by + 0.5), rx: 8, ry: 2.6, fill: INK, opacity: 0.13 }))
  g.add(new N('path', { d: `M${f(bx - 4)} ${f(by)}v-4M${f(bx + 3)} ${f(by)}v-4`, stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' }))
  g.add(new N('path', { d: `M${f(bx - 7)} ${f(by - 6)}a3 3 0 0 1 3 -4a3.4 3.4 0 0 1 6 -0.5a3 3 0 0 1 4.5 2.5a2.6 2.6 0 0 1 -1 5h-10.5a2.6 2.6 0 0 1 -2 -3z`, fill: '#ffffff', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
  const head = g.add(new N('g', { class: 'sheep-head', style: `animation-delay:${f(-delay)}s` }))
  head.add(new N('ellipse', { cx: f(bx + 8), cy: f(by - 4.5), rx: 2.6, ry: 3.2, fill: C.slate, stroke: INK, 'stroke-width': 1, transform: `rotate(35 ${f(bx + 8)} ${f(by - 4.5)})` }))
  head.add(new N('path', { d: `M${f(bx + 6.5)} ${f(by - 7.5)}l-2 -1`, stroke: INK, 'stroke-width': 1.4, 'stroke-linecap': 'round' }))
  void s
  p.grow(bx - 10, by - 12, bx + 11, by + 2)
}

/** A duck going round the pond, along a closed path of screen points. */
export function duck(pts: [number, number][], name: string, dur: number, delay: number, body = '#ffffff'): N {
  motionPath(name, pts, { closed: true })
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
  const g = new N('g', { class: 'mover amb', 'data-b': box(Math.min(...xs) - 8, Math.min(...ys) - 10, Math.max(...xs) + 8, Math.max(...ys) + 4), style: `animation:${name} ${dur}s linear infinite ${f(-delay)}s` })
  g.add(new N('ellipse', { cx: 0, cy: 1, rx: 7, ry: 2.2, fill: '#ffffff', opacity: 0.5 }))
  g.add(new N('path', { d: 'M-6 -1q0 4 6 4q7 0 7 -5q-3 1 -6 0q-5 -2 -7 1z', fill: body, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }))
  g.add(new N('path', { d: 'M-3 -1.5q2 -1.5 5 0', fill: 'none', stroke: shade(body, 0.8), 'stroke-width': 1 }))
  g.add(new N('circle', { cx: 4.5, cy: -4.5, r: 2.6, fill: body === '#ffffff' ? '#ffffff' : '#2bb99a', stroke: INK, 'stroke-width': 1 }))
  g.add(new N('path', { d: 'M6.8 -4.6l2.6 0.6l-2.6 0.9z', fill: '#ff8f6b', stroke: INK, 'stroke-width': 0.7, 'stroke-linejoin': 'round' }))
  return g
}

/** A crab, scuttling sideways along a beach, there and back. */
export function crab(p: Pen, x: number, y: number, delay = 0) {
  const [bx, by] = p.at(x, y)
  const g = p.el('g', { class: 'crab amb', 'data-b': box(bx - 16, by - 8, bx + 16, by + 3), style: `animation-delay:${f(-delay)}s` })
  g.add(new N('ellipse', { cx: f(bx), cy: f(by + 0.5), rx: 5, ry: 1.6, fill: INK, opacity: 0.15 }))
  g.add(new N('path', { d: `M${f(bx - 4)} ${f(by - 1)}l-2 2M${f(bx - 3)} ${f(by)}l-1 2M${f(bx + 4)} ${f(by - 1)}l2 2M${f(bx + 3)} ${f(by)}l1 2`, stroke: INK, 'stroke-width': 1, 'stroke-linecap': 'round' }))
  g.add(new N('path', { d: `M${f(bx - 4.5)} ${f(by - 1)}a4.5 3.4 0 0 1 9 0z`, fill: C.rasp, stroke: INK, 'stroke-width': 1.1 }))
  g.add(new N('path', { d: `M${f(bx - 5)} ${f(by - 3)}q-3 -1 -2 -4l1.5 1.2l0.5 -1.6q1.6 2 0 4.4zM${f(bx + 5)} ${f(by - 3)}q3 -1 2 -4l-1.5 1.2l-0.5 -1.6q-1.6 2 0 4.4z`, fill: C.rasp, stroke: INK, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }))
  g.add(new N('path', { d: `M${f(bx - 1.5)} ${f(by - 4)}v-2M${f(bx + 1.5)} ${f(by - 4)}v-2`, stroke: INK, 'stroke-width': 0.9 }))
  p.grow(bx - 16, by - 8, bx + 16, by + 3)
}

/** A dolphin that leaps out of the sea and back in. Drawn at a sea point. */
export function dolphin(x: number, y: number, delay: number, flip = false): N {
  const g = new N('g', { class: 'amb', 'data-b': box(x - 50, y - 50, x + 50, y + 10) })
  g.add(new N('ellipse', { cx: f(x), cy: f(y + 2), rx: 18, ry: 4, fill: '#ffffff', class: 'dol-ring', opacity: 0, style: `animation-delay:${f(-delay)}s` }))
  const jump = g.add(new N('g', { class: 'dolphin', style: `animation-delay:${f(-delay)}s`, transform: flip ? `translate(${f(x * 2)} 0) scale(-1 1)` : undefined }))
  const inner = jump.add(new N('g', { transform: `translate(${f(x)} ${f(y)})` }))
  inner.add(new N('path', { d: 'M-16 2q4 -9 16 -9q9 0 14 5l4 -1l-3 3q-2 3 -8 3q-10 1 -15 3l-3 4l-1 -4q-3 -1 -4 -4z', fill: '#6e8de8', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
  inner.add(new N('path', { d: 'M-2 -7l3 -5l3 5', fill: '#6e8de8', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
  inner.add(new N('path', { d: 'M-10 2q8 -1 20 -3', fill: 'none', stroke: '#d8e4ff', 'stroke-width': 2, 'stroke-linecap': 'round' }))
  inner.add(new N('circle', { cx: 9, cy: -3, r: 1, fill: INK }))
  return g
}

/** A whale's back in the open sea, now and then blowing. */
export function whale(x: number, y: number): N {
  const g = new N('g', { class: 'amb', 'data-b': box(x - 60, y - 60, x + 60, y + 14) })
  g.add(new N('ellipse', { cx: f(x), cy: f(y + 3), rx: 52, ry: 11, fill: '#ffffff', opacity: 0.45 }))
  g.add(new N('path', { d: `M${f(x - 44)} ${f(y + 3)}q14 -20 44 -20q30 0 40 20z`, fill: '#5a74c9', stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round', class: 'whale-back' }))
  g.add(new N('path', { d: `M${f(x - 30)} ${f(y - 4)}q20 -10 46 -4`, fill: 'none', stroke: '#8fa6ef', 'stroke-width': 2.4, 'stroke-linecap': 'round' }))
  g.add(new N('path', { d: `M${f(x + 30)} ${f(y + 3)}q14 -4 18 -14q2 6 -4 12q8 -2 12 2q-12 4 -26 0z`, fill: '#5a74c9', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
  const spout = g.add(new N('g', { class: 'whale-spout' }))
  spout.add(new N('path', { d: `M${f(x - 12)} ${f(y - 16)}q-2 -14 -12 -20M${f(x - 12)} ${f(y - 16)}q0 -16 0 -24M${f(x - 12)} ${f(y - 16)}q2 -14 12 -20`, fill: 'none', stroke: '#ffffff', 'stroke-width': 3, 'stroke-linecap': 'round' }))
  for (const [dx, dy] of [[-26, -36], [0, -42], [2, -36], [-14, -40]]) spout.add(new N('circle', { cx: f(x + dx), cy: f(y + dy), r: 2.4, fill: '#ffffff', stroke: INK, 'stroke-width': 0.8 }))
  return g
}

/** A gull standing on something, drawn at a screen point. */
export function gullStanding(x: number, y: number, flip = false): N {
  const g = new N('g', { transform: flip ? `translate(${f(x * 2)} 0) scale(-1 1)` : undefined })
  g.add(new N('path', { d: `M${f(x - 1)} ${f(y)}v-3M${f(x + 1.5)} ${f(y)}v-3`, stroke: '#ff8f6b', 'stroke-width': 1, 'stroke-linecap': 'round' }))
  g.add(new N('path', { d: `M${f(x - 6)} ${f(y - 6)}q3 -4 9 -3q3 1 4 4q-5 3 -13 -1z`, fill: '#ffffff', stroke: INK, 'stroke-width': 1, 'stroke-linejoin': 'round' }))
  g.add(new N('path', { d: `M${f(x - 6)} ${f(y - 6)}q4 -1 7 0`, fill: 'none', stroke: '#a7b4d6', 'stroke-width': 1.6 }))
  g.add(new N('circle', { cx: f(x + 4), cy: f(y - 8.5), r: 2.3, fill: '#ffffff', stroke: INK, 'stroke-width': 1 }))
  g.add(new N('path', { d: `M${f(x + 6)} ${f(y - 8.5)}l2.5 0.6l-2.5 0.6z`, fill: '#ffb36b', stroke: INK, 'stroke-width': 0.6 }))
  return g
}

/** Gulls wheeling round a point in the sky, along a loop of screen points. */
export function gullsCircling(cx: number, cy: number, rx: number, ry: number, name: string, dur: number): N {
  const pts: [number, number][] = []
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]) }
  motionPath(name, pts, { closed: true })
  const g = new N('g', { class: 'amb', 'data-b': box(cx - rx - 12, cy - ry - 12, cx + rx + 12, cy + ry + 12) })
  ;[0, -dur / 3, (-dur * 2) / 3].forEach((d, n) => {
    const m = g.add(new N('g', { class: 'mover', style: `animation:${name} ${dur}s linear infinite ${f(d + n * 0.7)}s` }))
    m.add(new N('path', { class: 'flap', d: 'M-8 0q4 -6 8 0q4 -6 8 0', fill: 'none', stroke: INK, 'stroke-width': 1.8, 'stroke-linecap': 'round' }))
    m.add(new N('path', { d: 'M-6 -0.5q3 -3.5 6 0q3 -3.5 6 0', fill: 'none', stroke: '#ffffff', 'stroke-width': 0.9, 'stroke-linecap': 'round' }))
  })
  return g
}

/** A butterfly flitting in a little loop over a meadow. */
/**
 * A hoodoo: a thin, weathered spire of soft rock, banded, wider at the
 * foot, with a flat cap of harder stone balanced on top that keeps the rain
 * off. Two or three stand together.
 */
export function hoodoo(p: Pen, x: number, y: number, h = 40, k = 1) {
  const fill = '#bfaee6', band = '#a28fda', cap = '#9b8ad0'
  const [sx, sy] = p.at(x, y)
  p.el('ellipse', { cx: sx - 6 * k, cy: sy + 2, rx: 14 * k, ry: 5 * k, fill: INK, opacity: 0.12 })
  const w0 = 7.5 * k, w1 = 3.6 * k
  // The column: a wobbling taper, its lit and shaded halves.
  const xs = (t: number) => w0 + (w1 - w0) * t + Math.sin(t * 9 + x * 3) * 1.1 * k
  let l = '', r = ''
  for (let q = 0; q <= 8; q++) { const t = q / 8, z = t * h; l += `${q ? 'L' : 'M'}${f(sx - xs(t))} ${f(sy - z)}`; r = `L${f(sx + xs(t))} ${f(sy - z)}` + r }
  p.path(l + r + 'Z', fill, { sw: 1.3 })
  let rr = `M${f(sx)} ${f(sy)}`
  for (let q = 0; q <= 8; q++) { const t = q / 8; rr += `L${f(sx + xs(t))} ${f(sy - t * h)}` }
  p.path(rr + `L${f(sx)} ${f(sy - h)}Z`, shade(fill, 0.84), { sw: 0, op: 0.9 })
  for (let z = 7; z < h - 4; z += 8) { const t = z / h; p.path(`M${f(sx - xs(t))} ${f(sy - z)}q${f(xs(t))} ${f(2.4 * k)} ${f(xs(t) * 2)} 0`, 'none', { stroke: band, sw: 1.6 * k }) }
  p.path(l + r + 'Z', 'none', { sw: 1.3 })
  // The cap.
  p.el('ellipse', { cx: sx, cy: sy - h - 1, rx: 7.5 * k, ry: 3.4 * k, fill: cap, stroke: INK, 'stroke-width': 1.3 })
  p.el('path', { d: `M${f(sx - 7.5 * k)} ${f(sy - h - 1)}a${f(7.5 * k)} ${f(3.4 * k)} 0 0 0 ${f(15 * k)} 0v-3a${f(7.5 * k)} ${f(3.4 * k)} 0 0 1 ${f(-15 * k)} 0z`, fill: cap, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' })
  p.el('ellipse', { cx: sx, cy: sy - h - 4, rx: 7.5 * k, ry: 3.4 * k, fill: '#c9bdf0', stroke: INK, 'stroke-width': 1.3 })
  p.grow(sx - 16 * k, sy - h - 9 * k, sx + 10 * k, sy + 4)
}

/** A heap of round boulders, the big one cracked, gravel at their feet. */
export function boulders(p: Pen, x: number, y: number, k = 1) {
  const [sx, sy] = p.at(x, y)
  p.el('ellipse', { cx: sx - 6 * k, cy: sy + 2, rx: 20 * k, ry: 6 * k, fill: INK, opacity: 0.12 })
  for (const [dx, dy, r, c] of [[-8, -1, 7, '#b4a6e2'], [6, -3, 9.5, '#bfb2ea'], [-1, 3, 5.5, '#aa9bdc'], [14, 3, 4, '#b4a6e2']] as [number, number, number, string][]) {
    const X = sx + dx * k, Y = sy + dy * k, R0 = r * k
    p.el('path', { d: `M${f(X - R0)} ${f(Y)}a${f(R0)} ${f(R0 * 0.82)} 0 0 1 ${f(R0 * 2)} 0q0 ${f(R0 * 0.5)} ${f(-R0)} ${f(R0 * 0.55)}q${f(-R0)} 0 ${f(-R0)} ${f(-R0 * 0.55)}z`, fill: c, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' })
    p.el('path', { d: `M${f(X + R0 * 0.1)} ${f(Y + R0 * 0.55)}q${f(R0 * 0.9)} 0 ${f(R0 * 0.9)} ${f(-R0 * 0.55)}a${f(R0)} ${f(R0 * 0.82)} 0 0 0 ${f(-R0 * 0.5)} ${f(-R0 * 0.7)}q${f(R0 * 0.2)} ${f(R0 * 0.7)} ${f(-R0 * 0.4)} ${f(R0 * 1.25)}z`, fill: shade(c, 0.8), opacity: 0.75 })
    p.el('path', { d: `M${f(X - R0 * 0.55)} ${f(Y - R0 * 0.35)}q${f(R0 * 0.2)} ${f(-R0 * 0.35)} ${f(R0 * 0.55)} ${f(-R0 * 0.45)}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.6 })
  }
  p.el('path', { d: `M${f(sx + 6 * k)} ${f(sy - 12 * k)}l1.5 4l-2 3l1 3`, fill: 'none', stroke: INK, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.6 })
  for (const [dx, dy] of [[-15, 4], [-12, 6], [19, 5], [2, 8], [9, 7]]) p.el('circle', { cx: sx + dx * k, cy: sy + dy * k, r: 1.1 * k, fill: '#a59ad3', stroke: INK, 'stroke-width': 0.5 })
  p.grow(sx - 18 * k, sy - 16 * k, sx + 20 * k, sy + 9 * k)
}

export function butterfly(p: Pen, x: number, y: number, z: number, c: string, delay: number) {
  const [bx, by] = p.at(x, y, z)
  const g = p.el('g', { class: 'bfly amb', 'data-b': box(bx - 18, by - 16, bx + 18, by + 10), style: `animation-delay:${f(-delay)}s` })
  const w = g.add(new N('g', { transform: `translate(${f(bx)} ${f(by)})` }))
  const wings = w.add(new N('g', { class: 'bfly-wings' }))
  wings.add(new N('path', { d: 'M0 0q-6 -7 -7 -1q0 3 7 1zM0 0q6 -7 7 -1q0 3 -7 1zM0 0q-5 5 -2 6zM0 0q5 5 2 6z', fill: c, stroke: INK, 'stroke-width': 0.8, 'stroke-linejoin': 'round' }))
  w.add(new N('path', { d: 'M0 -2v5', stroke: INK, 'stroke-width': 1.2, 'stroke-linecap': 'round' }))
  p.grow(bx - 18, by - 16, bx + 18, by + 10)
}

/** A deer, grazing at the forest edge; it lifts its head to look about. */
export function deer(p: Pen, x: number, y: number, flip = false, delay = 0) {
  const [bx, by] = p.at(x, y)
  const g = p.el('g', { transform: flip ? `translate(${f(bx * 2)} 0) scale(-1 1)` : undefined })
  const c = '#b49be8', c2 = '#9b80dc'
  g.add(new N('ellipse', { cx: f(bx), cy: f(by + 0.5), rx: 9, ry: 2.6, fill: INK, opacity: 0.13 }))
  g.add(new N('path', { d: `M${f(bx - 5)} ${f(by)}l0.5 -8M${f(bx - 3)} ${f(by)}l0 -8M${f(bx + 4)} ${f(by)}l-0.5 -8M${f(bx + 6)} ${f(by)}l-1 -8`, stroke: INK, 'stroke-width': 1.5, 'stroke-linecap': 'round' }))
  g.add(new N('path', { d: `M${f(bx - 7)} ${f(by - 9)}q0 -5 6 -5h6q4 0 4 4q0 3 -3 3h-11q-2 0 -2 -2z`, fill: c, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
  g.add(new N('path', { d: `M${f(bx - 3)} ${f(by - 11)}h1M${f(bx + 1)} ${f(by - 12)}h1M${f(bx - 1)} ${f(by - 9.5)}h1`, stroke: '#ffffff', 'stroke-width': 1.3, 'stroke-linecap': 'round' }))
  const head = g.add(new N('g', { class: 'deer-head amb', 'data-b': box(bx - 10, by - 28, bx + 16, by), style: `animation-delay:${f(-delay)}s` }))
  head.add(new N('path', { d: `M${f(bx + 7)} ${f(by - 12)}l3 -8`, stroke: c2, 'stroke-width': 3.6, 'stroke-linecap': 'round' }))
  head.add(new N('path', { d: `M${f(bx + 9)} ${f(by - 22)}q2 -3 6 -1q1 3 -3 3.5z`, fill: c, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }))
  head.add(new N('path', { d: `M${f(bx + 10)} ${f(by - 23)}l-2 -5l-2 1M${f(bx + 10)} ${f(by - 25.5)}l2 -2`, fill: 'none', stroke: C.wood, 'stroke-width': 1.3, 'stroke-linecap': 'round' }))
  p.grow(bx - 10, by - 30, bx + 16, by + 2)
}

/** A tumbleweed rolling across the Badlands and back. */
export function tumbleweed(p: Pen, x: number, y: number, delay = 0) {
  const [bx, by] = p.at(x, y)
  const g = p.el('g', { class: 'tumble amb', 'data-b': box(bx - 50, by - 16, bx + 50, by + 4), style: `animation-delay:${f(-delay)}s` })
  const ball = g.add(new N('g', { class: 'tumble-ball', style: `animation-delay:${f(-delay)}s` }))
  ball.add(new N('circle', { cx: f(bx), cy: f(by - 6), r: 6, fill: 'none', stroke: '#9d8fd0', 'stroke-width': 1.3 }))
  ball.add(new N('path', { d: `M${f(bx - 5)} ${f(by - 8)}q5 -3 10 3M${f(bx - 4)} ${f(by - 3)}q4 -7 8 -6M${f(bx - 2)} ${f(by - 11)}q3 6 -1 10`, fill: 'none', stroke: '#9d8fd0', 'stroke-width': 1, 'stroke-linecap': 'round' }))
  p.grow(bx - 50, by - 16, bx + 50, by + 4)
}

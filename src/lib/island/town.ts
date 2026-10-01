/**
 * Tiny Island — town life: the little houses between the big ones, the
 * street furniture, the piers and the beach, a playground, a campsite on the
 * peaks, and the traffic.
 *
 * Like props.ts, everything draws at a ground point (x, y) with the pen's
 * height as its floor. Anything that moves on its own carries `amb` and its
 * screen box in `data-b`, so the camera can pause it (cull() in camera.ts).
 */
import { C, INK, OUT, N, Pen, shade, S, motionCss, r1 } from './kit'

const f = (v: number) => Math.round(v * 10) / 10
const box = (x0: number, y0: number, x1: number, y1: number) => `${f(x0)} ${f(y0)} ${f(x1)} ${f(y1)}`
const blob = (x: number, y: number, rx: number, ry: number) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`
const SKIN = ['#f1d9c6', '#e0b899', '#c99a78', '#8f6650']

/* ---- houses ---------------------------------------------------------------- */

/**
 * A cottage: walls, a pitched roof, a door on the side that faces the road,
 * windows with boxes of flowers, a chimney that sometimes smokes.
 */
export function cottage(p: Pen, x: number, y: number, o: { wall?: string; roof?: string; door: 'x' | 'y'; smoke?: boolean; w?: number; d?: number; h?: number }) {
  const w = o.w ?? 0.5, d = o.d ?? 0.46, h = o.h ?? 15
  const wall = o.wall ?? '#ffffff', roof = o.roof ?? C.rasp
  const x0 = x - w / 2, y0 = y - d / 2
  const [sx, sy] = p.at(x, y)
  p.el('ellipse', { cx: sx, cy: sy + 4, rx: 24, ry: 9, fill: INK, opacity: 0.1 })
  const b = p.box(x0, y0, w, d, h, { fill: wall })
  p.band(b, 0, 2.5, shade(wall, 0.8))
  p.door(b, o.door, 0.5, { w: 0.13, h: 9, fill: o.door === 'x' ? C.cobalt : C.mint })
  const other = o.door === 'x' ? 'y' : 'x'
  p.windows(b, other, { rows: 1, cols: 2, z0: 7, h: 5, wide: 0.42 })
  p.windows(b, o.door, { rows: 1, cols: 2, z0: 6, h: 4.5, wide: 0.22, lit: true })
  // Window boxes of flowers on the side without the door.
  const [fx1, fy1] = o.door === 'x' ? p.at(x0 + w * 0.25, y0 + d + 0.01, 3.6) : p.at(x0 + w + 0.01, y0 + d * 0.25, 3.6)
  const [fx2, fy2] = o.door === 'x' ? p.at(x0 + w * 0.75, y0 + d + 0.01, 3.6) : p.at(x0 + w + 0.01, y0 + d * 0.75, 3.6)
  for (const [fx, fy] of [[fx1, fy1], [fx2, fy2]]) {
    p.el('rect', { x: fx - 4, y: fy - 1.5, width: 8, height: 3, rx: 1, fill: C.wood, stroke: INK, 'stroke-width': 0.8 })
    p.path(blob(fx - 2, fy - 2, 1.4, 1.2) + blob(fx + 1.5, fy - 2.2, 1.4, 1.2), '#ff9fb2', { sw: 0.6 })
  }
  // The roof, ridge across the face without the door so the gable shows.
  p.gable(x0, y0, w, d, h, 11, roof, o.door === 'x' ? 'y' : 'x', { lines: 2, over: 0.05 })
  // A chimney.
  const cx = x0 + w * 0.72, cy = y0 + d * 0.3
  p.box(cx - 0.05, cy - 0.05, 0.1, 0.1, 9, { z0: h + 4, fill: '#d5d9ea', trim: shade('#d5d9ea', 0.8) })
  if (o.smoke) {
    const [mx, my] = p.at(cx, cy, h + 14)
    const g = p.el('g', { class: 'amb', 'data-b': box(mx - 14, my - 50, mx + 20, my) })
    for (const dl of [0, 1, 2]) g.add(new N('circle', { cx: f(mx), cy: f(my - 2), r: 3.4, fill: '#ffffff', stroke: INK, 'stroke-width': 0.8, class: 'puff', style: `animation-delay:${dl}s` }))
  }
}

/** A post box. */
export function postbox(p: Pen, x: number, y: number) {
  p.cyl(x, y, 0.045, 0, 11, C.rasp, { sw: 1.1, top: shade(C.rasp, 1.1) })
  const [bx, by] = p.at(x, y, 8)
  p.path(`M${f(bx - 2)} ${f(by)}h3.4`, 'none', { sw: 1, stroke: INK })
}

/** A fingerpost at a crossroads, its arms pointing off along the roads. */
export function signpost(p: Pen, x: number, y: number, arms: { dx: number; dy: number; c: string }[]) {
  const [bx, by] = p.at(x, y)
  p.path(`M${f(bx)} ${f(by)}V${f(by - 30)}`, 'none', { sw: 2.4, stroke: C.wood })
  p.path(`M${f(bx)} ${f(by)}V${f(by - 30)}`, 'none', { sw: 0.8, stroke: shade(C.wood, 1.2) })
  arms.forEach((a, n) => {
    const z = 27 - n * 6
    const [tx, ty] = p.at(x + a.dx * 0.32, y + a.dy * 0.32, z)
    const [ox, oy] = p.at(x, y, z)
    const ang = Math.atan2(ty - oy, tx - ox)
    const ex = ox + Math.cos(ang) * 15, ey = oy + Math.sin(ang) * 15
    const nx = -Math.sin(ang) * 2.4, ny = Math.cos(ang) * 2.4
    p.path(`M${f(ox + nx)} ${f(oy + ny)}L${f(ex + nx)} ${f(ey + ny)}L${f(ex + Math.cos(ang) * 3)} ${f(ey + Math.sin(ang) * 3)}L${f(ex - nx)} ${f(ey - ny)}L${f(ox - nx)} ${f(oy - ny)}Z`, a.c, { sw: 1.1 })
  })
  p.el('circle', { cx: bx, cy: by - 31, r: 1.8, fill: C.wood, stroke: INK, 'stroke-width': 1 })
}

/** Zebra stripes across a road, laid flat in tile units. */
export function crossing(p: Pen, x: number, y: number, axis: 'x' | 'y') {
  const g = p.plane(x, y)
  let d = ''
  for (let k = -2; k <= 2; k++) d += axis === 'x' ? `M${k * 0.1 - 0.03} -0.22h0.06v0.44h-0.06z` : `M-0.22 ${k * 0.1 - 0.03}h0.44v0.06h-0.44z`
  g.add(new N('path', { d, fill: '#ffffff', stroke: '#c9cfe6', 'stroke-width': 0.012 }))
}

/** A bus stop: a little glass shelter, a bench inside, a sign on a pole. */
export function busStop(p: Pen, x: number, y: number) {
  const b = p.box(x - 0.2, y - 0.07, 0.4, 0.14, 1, { fill: '#d5d9ea', sw: 1 })
  p.box(x - 0.2, y - 0.07, 0.4, 0.02, 15, { z0: 1, fill: C.glassHi, sw: 1, op: 0.85 } as never)
  p.box(x - 0.16, y - 0.04, 0.32, 0.06, 2, { z0: 5, fill: C.wood, sw: 0.9 })
  p.box(x - 0.24, y - 0.1, 0.48, 0.2, 2, { z0: 16, fill: C.cobalt, top: shade(C.cobalt, 1.15), sw: 1.1 })
  void b
  const [sx, sy] = p.at(x + 0.28, y + 0.06)
  p.path(`M${f(sx)} ${f(sy)}V${f(sy - 24)}`, 'none', { sw: 1.8 })
  p.el('circle', { cx: sx, cy: sy - 26, r: 4.2, fill: C.mint, stroke: INK, 'stroke-width': 1.2 })
  p.text(x + 0.28, y + 0.06, 24.5, 'B', { size: 5.5, dy: 0 })
}

/** A fountain: a round basin, a column, and water falling from a bowl. */
export function fountain(p: Pen, x: number, y: number) {
  p.cyl(x, y, 0.3, 0, 5, '#d5d9ea', { sw: 1.3, top: '#9fdcff' })
  p.disc(x, y, 0.22, 5, '#8fd3ff', { sw: 0.8 })
  p.cyl(x, y, 0.05, 5, 14, '#e6e9f4', { sw: 1.1 })
  p.cyl(x, y, 0.13, 19, 3, '#d5d9ea', { sw: 1.1, top: '#9fdcff' })
  const [bx, by] = p.at(x, y, 22)
  const g = p.el('g', { class: 'amb', 'data-b': box(bx - 26, by - 14, bx + 26, by + 24) })
  for (const s of [-1, 1]) g.add(new N('path', { d: `M${f(bx + s * 4)} ${f(by)}q${f(s * 9)} -4 ${f(s * 14)} 14`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-dasharray': '3 4', class: 'fount' }))
  g.add(new N('path', { d: `M${f(bx)} ${f(by - 2)}v-8`, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-linecap': 'round', class: 'fount-up' }))
}

/* ---- people at leisure -------------------------------------------------------- */

/** Someone sitting on the ground: legs out, a hand back. */
export function sitter(p: Pen, x: number, y: number, shirt: string, skin = SKIN[0], flip = false) {
  const [bx, by] = p.at(x, y)
  const s = flip ? -1 : 1
  p.el('path', { d: `M${f(bx)} ${f(by - 1)}h${f(s * 8)}`, stroke: INK, 'stroke-width': 2.2, 'stroke-linecap': 'round' })
  p.el('rect', { x: bx - 3.2, y: by - 10, width: 6.4, height: 9, rx: 2.6, fill: shirt, stroke: INK, 'stroke-width': 1.1 })
  p.el('circle', { cx: bx, cy: by - 13.2, r: 3.2, fill: skin, stroke: INK, 'stroke-width': 1.1 })
  p.grow(bx - 8, by - 17, bx + 9, by + 1)
}

/** A picnic: a blanket laid flat, a basket, and two people on it. */
export function picnic(p: Pen, x: number, y: number, shirts: [string, string], cloth = C.rasp) {
  const g = p.plane(x - 0.28, y - 0.22)
  g.add(new N('rect', { x: 0, y: 0, width: 0.56, height: 0.44, fill: '#ffffff', stroke: INK, 'stroke-width': 0.03 }))
  let d = ''
  for (let k = 0; k < 4; k++) d += `M${f(k * 0.14)} 0h0.07v0.44h-0.07z`
  for (let k = 0; k < 3; k++) d += `M0 ${f(k * 0.15)}h0.56v0.075h-0.56z`
  g.add(new N('path', { d, fill: cloth, opacity: 0.55 }))
  p.box(x + 0.02, y - 0.05, 0.12, 0.08, 5, { fill: C.wood, sw: 1 })
  sitter(p, x - 0.12, y + 0.08, shirts[0], SKIN[1])
  sitter(p, x + 0.14, y + 0.14, shirts[1], SKIN[0], true)
}

/** Someone flying a kite: the line runs up to a kite that sways in the wind. */
export function kiteFlyer(p: Pen, x: number, y: number, shirt: string, kite: string, delay = 0) {
  const [bx, by] = p.at(x, y)
  p.el('ellipse', { cx: bx, cy: by + 0.5, rx: 4.5, ry: 1.8, fill: INK, opacity: 0.15 })
  p.el('path', { d: `M${f(bx - 1.8)} ${f(by)}v-6M${f(bx + 1.8)} ${f(by)}v-6`, stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' })
  p.el('rect', { x: bx - 3.4, y: by - 14, width: 6.8, height: 9, rx: 2.6, fill: shirt, stroke: INK, 'stroke-width': 1.2 })
  p.el('path', { d: `M${f(bx + 3)} ${f(by - 12)}l4 -5`, stroke: INK, 'stroke-width': 1.8, 'stroke-linecap': 'round' })
  p.el('circle', { cx: bx, cy: by - 17.5, r: 3.4, fill: SKIN[2], stroke: INK, 'stroke-width': 1.2 })
  const hx = bx + 7, hy = by - 17, kx = bx + 46, ky = by - 92
  const g = p.el('g', { class: 'kite amb', 'data-b': box(hx, ky - 26, kx + 24, hy), style: `animation-delay:${f(-delay)}s` })
  g.add(new N('path', { d: `M${f(hx)} ${f(hy)}Q${f(hx + 30)} ${f(hy - 30)} ${f(kx)} ${f(ky + 12)}`, fill: 'none', stroke: INK, 'stroke-width': 0.8 }))
  g.add(new N('path', { d: `M${f(kx)} ${f(ky - 12)}l9 12l-9 12l-9 -12z`, fill: kite, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
  g.add(new N('path', { d: `M${f(kx)} ${f(ky - 12)}v24M${f(kx - 9)} ${f(ky)}h18`, stroke: shade(kite, 0.7), 'stroke-width': 0.9 }))
  g.add(new N('path', { d: `M${f(kx)} ${f(ky + 12)}q-4 6 2 10q5 4 -1 10`, fill: 'none', stroke: INK, 'stroke-width': 0.9 }))
  for (const [dx, dy] of [[-1, 18], [1, 25]]) g.add(new N('path', { d: `M${f(kx + dx - 2.5)} ${f(ky + dy - 1.5)}l5 3m0 -3l-5 3`, stroke: C.rasp, 'stroke-width': 1.6, 'stroke-linecap': 'round' }))
  p.grow(bx - 6, ky - 14, kx + 10, by + 2)
}

/** A swing set with one swing going, and a slide. */
export function playground(p: Pen, x: number, y: number) {
  const g = p.plane(x - 0.42, y - 0.42)
  g.add(new N('rect', { x: 0, y: 0, width: 0.84, height: 0.84, rx: 0.12, fill: '#ffd9c2', stroke: INK, 'stroke-width': 0.03, opacity: 0.85 }))
  // Swing frame: an A at each end and a bar across.
  const a0: [number, number] = [x - 0.25, y - 0.2], a1: [number, number] = [x + 0.25, y - 0.2]
  for (const [ax, ay] of [a0, a1]) {
    p.line([ax, ay - 0.08, 0], [ax, ay, 26], { sw: 2, stroke: C.cobalt }); p.line([ax, ay + 0.08, 0], [ax, ay, 26], { sw: 2, stroke: C.cobalt })
  }
  p.line([a0[0], a0[1], 26], [a1[0], a1[1], 26], { sw: 2.4, stroke: C.cobalt })
  const [hx, hy] = p.at(x, y - 0.2, 26)
  const sw = p.el('g', { class: 'swing amb', 'data-b': box(hx - 20, hy - 4, hx + 20, hy + 26) })
  sw.add(new N('path', { d: `M${f(hx - 4)} ${f(hy)}v18M${f(hx + 4)} ${f(hy)}v18`, stroke: INK, 'stroke-width': 0.9 }))
  sw.add(new N('rect', { x: f(hx - 5.5), y: f(hy + 17), width: 11, height: 2.4, rx: 1, fill: C.rasp, stroke: INK, 'stroke-width': 0.9 }))
  sw.add(new N('rect', { x: f(hx - 2.8), y: f(hy + 7.5), width: 5.6, height: 8, rx: 2.2, fill: C.mint, stroke: INK, 'stroke-width': 1 }))
  sw.add(new N('circle', { cx: f(hx), cy: f(hy + 4.6), r: 2.8, fill: SKIN[0], stroke: INK, 'stroke-width': 1 }))
  // The slide.
  p.box(x + 0.12, y + 0.08, 0.12, 0.12, 18, { fill: C.lilac, sw: 1.1 })
  p.poly([[x + 0.12, y + 0.2, 18], [x + 0.24, y + 0.2, 18], [x + 0.24, y + 0.5, 1], [x + 0.12, y + 0.5, 1]], C.sky, { sw: 1.1 })
  p.line([x + 0.24, y + 0.08, 18], [x + 0.24, y + 0.08, 26], { sw: 1.4 })
}

/* ---- the beach ----------------------------------------------------------------- */

export function umbrella(p: Pen, x: number, y: number, c: string) {
  const [bx, by] = p.at(x, y)
  p.el('ellipse', { cx: bx + 3, cy: by + 1, rx: 16, ry: 6, fill: INK, opacity: 0.12 })
  p.path(`M${f(bx)} ${f(by)}L${f(bx + 2)} ${f(by - 26)}`, 'none', { sw: 1.6 })
  const tx = bx + 2, ty = by - 30
  let d = ''
  for (let k = 0; k < 6; k++) {
    const a0 = Math.PI * (k / 6), a1 = Math.PI * ((k + 1) / 6)
    const p0 = [tx - Math.cos(a0) * 17, ty + 6 + Math.sin(a0) * 2], p1 = [tx - Math.cos(a1) * 17, ty + 6 + Math.sin(a1) * 2]
    if (k % 2 === 0) d += `M${f(tx)} ${f(ty - 3)}L${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}Z`
  }
  p.path(`M${f(tx - 17)} ${f(ty + 6)}Q${f(tx - 10)} ${f(ty - 5)} ${f(tx)} ${f(ty - 3)}Q${f(tx + 10)} ${f(ty - 5)} ${f(tx + 17)} ${f(ty + 6)}Q${f(tx)} ${f(ty + 10)} ${f(tx - 17)} ${f(ty + 6)}Z`, '#ffffff', { sw: 1.3 })
  p.path(d, c, { sw: 0 })
  p.path(`M${f(tx - 17)} ${f(ty + 6)}Q${f(tx - 10)} ${f(ty - 5)} ${f(tx)} ${f(ty - 3)}Q${f(tx + 10)} ${f(ty - 5)} ${f(tx + 17)} ${f(ty + 6)}Q${f(tx)} ${f(ty + 10)} ${f(tx - 17)} ${f(ty + 6)}Z`, 'none', { sw: 1.3 })
  p.grow(tx - 18, ty - 4, tx + 18, by + 2)
}

/** A towel laid flat, striped. */
export function towel(p: Pen, x: number, y: number, c: string, axis: 'x' | 'y' = 'x') {
  const w = axis === 'x' ? 0.34 : 0.16, d = axis === 'x' ? 0.16 : 0.34
  const g = p.plane(x - w / 2, y - d / 2)
  g.add(new N('rect', { x: 0, y: 0, width: w, height: d, rx: 0.02, fill: '#ffffff', stroke: INK, 'stroke-width': 0.025 }))
  let s = ''
  for (let k = 0; k < 3; k++) s += axis === 'x' ? `M${f(0.04 + k * 0.11)} 0h0.05v${d}h-0.05z` : `M0 ${f(0.04 + k * 0.11)}h${w}v0.05h-${w}z`
  g.add(new N('path', { d: s, fill: c }))
}

export function sandcastle(p: Pen, x: number, y: number) {
  const sand = '#efe2c0'
  p.box(x - 0.12, y - 0.12, 0.24, 0.24, 6, { fill: sand, sw: 1.1 })
  for (const [u, v] of [[-0.09, -0.09], [0.09, -0.09], [0.09, 0.09], [-0.09, 0.09]]) p.cyl(x + u, y + v, 0.045, 6, 6, sand, { sw: 1 })
  p.cyl(x, y, 0.06, 6, 11, sand, { sw: 1 })
  const [fx, fy] = p.at(x, y, 17)
  p.path(`M${f(fx)} ${f(fy)}v-8`, 'none', { sw: 1 })
  p.path(`M${f(fx)} ${f(fy - 8)}l6 2l-6 2z`, C.rasp, { sw: 0.8 })
}

/** A lifeguard's chair on stilts, with its flag. */
export function lifeguard(p: Pen, x: number, y: number) {
  for (const [u, v] of [[-0.12, -0.12], [0.12, -0.12], [0.12, 0.12], [-0.12, 0.12]]) p.line([x + u, y + v, 0], [x + u * 0.7, y + v * 0.7, 22], { sw: 1.8, stroke: '#ffffff' })
  p.box(x - 0.14, y - 0.14, 0.28, 0.28, 2, { z0: 22, fill: '#ffffff', sw: 1.1 })
  const b = p.box(x - 0.13, y - 0.13, 0.26, 0.26, 12, { z0: 24, fill: C.rasp, sw: 1.2 })
  p.windows(b, 'y', { rows: 1, cols: 1, z0: 4, h: 5, wide: 0.6, lit: false })
  p.pyramid(x - 0.17, y - 0.17, 0.34, 0.34, 36, 9, '#ffffff', { sw: 1.2 })
  const [fx, fy] = p.at(x, y, 45)
  p.path(`M${f(fx)} ${f(fy)}v-12`, 'none', { sw: 1.3 })
  p.path(`M${f(fx)} ${f(fy - 12)}l10 3l-10 4z`, C.rasp, { sw: 1, cls: 'flutter' })
}

export function surfboard(p: Pen, x: number, y: number, c: string) {
  const [bx, by] = p.at(x, y)
  p.path(`M${f(bx - 3)} ${f(by)}Q${f(bx - 5)} ${f(by - 14)} ${f(bx)} ${f(by - 26)}Q${f(bx + 5)} ${f(by - 14)} ${f(bx + 3)} ${f(by)}Z`, c, { sw: 1.2 })
  p.path(`M${f(bx)} ${f(by - 2)}V${f(by - 23)}`, 'none', { stroke: '#ffffff', sw: 1 })
}

/* ---- the water's edge ------------------------------------------------------------ */

/**
 * A pier of planks running out from the shore along a list of ground points,
 * standing on posts in the water, with a fisher at the end.
 */
export function pier(p: Pen, pts: [number, number][], z: number, fisher: string | null) {
  const w = 0.24
  for (let n = 0; n < pts.length - 1; n++) {
    const [a, b] = [pts[n], pts[n + 1]]
    const along = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1])
    const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1])
    const len = along ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1])
    // Posts first, so the deck sits on them.
    for (let t = 0; t <= len + 0.001; t += 0.3) {
      for (const side of [-1, 1]) {
        const px = along ? x0 + t : a[0] + side * w * 0.45, py = along ? a[1] + side * w * 0.45 : y0 + t
        p.line([px, py, z - 12], [px, py, z], { sw: 2.4, stroke: shade(C.wood, 0.75) })
      }
    }
    const bx = along ? x0 : a[0] - w / 2, by = along ? a[1] - w / 2 : y0
    const bw = along ? len : w, bd = along ? w : len
    const deck = p.box(bx, by, bw, bd, 2.5, { z0: z, fill: '#c6b6ee', top: '#d6caf3', sw: 1.2 })
    // Plank lines across the deck.
    for (let t = 0.08; t < len; t += 0.08) along ? p.line([bx + t, by, z + 2.5], [bx + t, by + bd, z + 2.5], { sw: 0.6, stroke: shade('#c6b6ee', 0.82) }) : p.line([bx, by + t, z + 2.5], [bx + bw, by + t, z + 2.5], { sw: 0.6, stroke: shade('#c6b6ee', 0.82) })
    void deck
  }
  if (!fisher) return
  const [ex, ey] = pts[pts.length - 1]
  const [bx2, by2] = p.at(ex, ey, z + 2.5)
  sitter(p.move(0, 0, z + 2.5), ex, ey, fisher, SKIN[3])
  // The rod, and the line down to a float that bobs.
  const tipX = bx2 + 26, tipY = by2 - 30
  p.path(`M${f(bx2 + 2)} ${f(by2 - 8)}L${f(tipX)} ${f(tipY)}`, 'none', { sw: 1.4, stroke: C.wood })
  const g = p.el('g', { class: 'amb', 'data-b': box(tipX - 6, tipY, tipX + 10, by2 + 30) })
  g.add(new N('path', { d: `M${f(tipX)} ${f(tipY)}L${f(tipX + 3)} ${f(by2 + 22)}`, stroke: INK, 'stroke-width': 0.6 }))
  const fl = g.add(new N('g', { class: 'bobber' }))
  fl.add(new N('ellipse', { cx: f(tipX + 3), cy: f(by2 + 24), rx: 6, ry: 2.2, fill: '#ffffff', opacity: 0.6 }))
  fl.add(new N('circle', { cx: f(tipX + 3), cy: f(by2 + 22), r: 2.3, fill: C.rasp, stroke: INK, 'stroke-width': 0.8 }))
}

/** A rowing boat moored at a point on the water, bobbing on its rope. */
export function rowboat(x: number, y: number, c: string): N {
  const g = new N('g', { class: 'moored amb', 'data-b': box(x - 20, y - 12, x + 20, y + 8) })
  g.add(new N('ellipse', { cx: f(x), cy: f(y + 3), rx: 18, ry: 4.5, fill: '#ffffff', opacity: 0.5 }))
  g.add(new N('path', { d: `M${f(x - 15)} ${f(y - 4)}Q${f(x)} ${f(y - 1)} ${f(x + 15)} ${f(y - 6)}L${f(x + 10)} ${f(y + 3)}Q${f(x)} ${f(y + 5)} ${f(x - 11)} ${f(y + 2)}Z`, fill: c, stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
  g.add(new N('path', { d: `M${f(x - 12)} ${f(y - 3.5)}Q${f(x)} ${f(y - 0.5)} ${f(x + 12)} ${f(y - 5)}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.2 }))
  g.add(new N('path', { d: `M${f(x - 3)} ${f(y - 2)}l-7 9M${f(x + 3)} ${f(y - 2.5)}l7 9`, stroke: C.wood, 'stroke-width': 1.6, 'stroke-linecap': 'round' }))
  return g
}

/** A buoy, red and white, bobbing. */
export function buoy(x: number, y: number, delay: number): N {
  const g = new N('g', { class: 'moored amb', 'data-b': box(x - 10, y - 20, x + 10, y + 5), style: `animation-delay:${f(-delay)}s` })
  g.add(new N('ellipse', { cx: f(x), cy: f(y + 2), rx: 9, ry: 3, fill: '#ffffff', opacity: 0.55 }))
  g.add(new N('path', { d: `M${f(x - 5)} ${f(y)}L${f(x - 3)} ${f(y - 12)}h6L${f(x + 5)} ${f(y)}Z`, fill: '#ffffff', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
  g.add(new N('path', { d: `M${f(x - 4.2)} ${f(y - 5)}h8.4l0.5 -3.5h-9.4z`, fill: C.rasp }))
  g.add(new N('circle', { cx: f(x), cy: f(y - 14), r: 2, fill: C.rasp, stroke: INK, 'stroke-width': 0.9 }))
  return g
}

/* ---- the campsite ------------------------------------------------------------------ */

export function tent(p: Pen, x: number, y: number, c: string) {
  const w = 0.36, d = 0.3, h = 16
  const [sx, sy] = p.at(x, y)
  p.el('ellipse', { cx: sx, cy: sy + 3, rx: 18, ry: 6, fill: INK, opacity: 0.12 })
  // A ridge tent: ridge along y, the open end facing +x.
  p.poly([[x - w / 2, y + d / 2, 0], [x + w / 2, y + d / 2, 0], [x + w / 2, y, h], [x - w / 2, y, h]], shade(c, 0.82), { sw: 1.3 })
  p.poly([[x + w / 2, y - d / 2, 0], [x + w / 2, y + d / 2, 0], [x + w / 2, y, h]], c, { sw: 1.3 })
  p.poly([[x + w / 2, y - d / 4, 0], [x + w / 2, y + d / 4, 0], [x + w / 2, y, h * 0.6]], INK, { sw: 0.8, op: 0.75 })
}

/** A campfire: stones, logs, a flame that flickers and sparks that rise. */
export function campfire(p: Pen, x: number, y: number) {
  const [bx, by] = p.at(x, y)
  let st = ''
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; st += blob(bx + Math.cos(a) * 8, by + Math.sin(a) * 3.6, 2.4, 1.6) }
  p.path(st, '#c3c8de', { sw: 0.9 })
  p.path(`M${f(bx - 7)} ${f(by + 1)}l13 -4M${f(bx - 6)} ${f(by - 3)}l12 4`, 'none', { sw: 2.6, stroke: C.wood })
  const g = p.el('g', { class: 'amb', 'data-b': box(bx - 10, by - 40, bx + 10, by + 2) })
  const fl = g.add(new N('g', { class: 'flame' }))
  fl.add(new N('path', { d: `M${f(bx - 5)} ${f(by - 1)}q-2 -8 3 -13q0 5 3 6q1 -4 -1 -7q7 5 4 14z`, fill: '#ff8f6b', stroke: INK, 'stroke-width': 1, 'stroke-linejoin': 'round' }))
  fl.add(new N('path', { d: `M${f(bx - 2)} ${f(by - 1)}q-1 -5 2 -7q1 4 2 7z`, fill: '#ffe08a' }))
  for (const dl of [0, 0.9, 1.7]) g.add(new N('circle', { cx: f(bx + (dl - 0.9) * 3), cy: f(by - 12), r: 1, fill: '#ffb36b', class: 'spark', style: `animation-delay:${dl}s` }))
}

/* ---- the traffic -------------------------------------------------------------------- */

/**
 * A car, a bus or a bike going up and down one straight stretch of road. It
 * is drawn side-on and slanted to lie along the road, and turned round at
 * each end. `a` and `b` are screen points; the road runs along x or y.
 */
export function shuttle(kind: 'car' | 'bus' | 'bike', body: string, a: [number, number], b: [number, number], axis: 'x' | 'y', name: string, dur: number, delay: number): N {
  // Along x the road climbs to the right on screen; along y it climbs to the left.
  const skew = axis === 'x' ? 26.57 : -26.57
  const fwd = Math.sign(b[0] - a[0]) || 1
  const pose = (x: number, y: number, dir: number) => `transform:translate(${r1(x)}px,${r1(y)}px) skewY(${skew}deg) scaleX(${dir * fwd})`
  motionCss.push(`@keyframes ${name}{0%{${pose(a[0], a[1], 1)}}46%{${pose(b[0], b[1], 1)}}50%{${pose(b[0], b[1], -1)}}96%{${pose(a[0], a[1], -1)}}100%{${pose(a[0], a[1], 1)}}}`)
  const g = new N('g', { class: 'mover amb', 'data-b': box(Math.min(a[0], b[0]) - 26, Math.min(a[1], b[1]) - 24, Math.max(a[0], b[0]) + 26, Math.max(a[1], b[1]) + 8), style: `animation:${name} ${dur}s linear infinite ${f(-delay)}s` })
  g.add(new N('ellipse', { cx: 0, cy: 1, rx: kind === 'bus' ? 20 : kind === 'bike' ? 7 : 13, ry: 3.5, fill: INK, opacity: 0.15 }))
  if (kind === 'car') {
    g.add(new N('path', { d: 'M-12 -2L-9 -8Q-7 -10 -4 -10H5Q8 -10 9 -8L12 -2V2H-12Z', fill: body, stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
    g.add(new N('path', { d: 'M-6 -8.5L-4.5 -12.5H4L6 -8.5Z', fill: C.glassHi, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }))
    g.add(new N('path', { d: 'M-12 -1H-9M12 -1H9', stroke: '#ffffff', 'stroke-width': 1.4 }))
    g.add(new N('path', { d: 'M10.5 -4.5h1.5', stroke: '#ffe08a', 'stroke-width': 2, 'stroke-linecap': 'round' }))
    for (const wx of [-7, 7]) g.add(new N('circle', { cx: wx, cy: 2, r: 2.8, fill: INK }))
  } else if (kind === 'bus') {
    g.add(new N('path', { d: 'M-20 -15H17Q20 -15 20 -12V2H-20Z', fill: body, stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
    g.add(new N('path', { d: 'M-17 -12H14v5H-17Z', fill: C.glassHi, stroke: INK, 'stroke-width': 1 }))
    g.add(new N('path', { d: 'M-10 -12v5M-3 -12v5M4 -12v5M11 -12v5', stroke: INK, 'stroke-width': 0.9 }))
    g.add(new N('path', { d: 'M-20 -3H20', stroke: '#ffffff', 'stroke-width': 1.6 }))
    for (const wx of [-12, 12]) g.add(new N('circle', { cx: wx, cy: 2, r: 3, fill: INK }))
  } else {
    for (const wx of [-5, 5]) g.add(new N('circle', { cx: wx, cy: -1, r: 3.6, fill: 'none', stroke: INK, 'stroke-width': 1.3 }))
    g.add(new N('path', { d: 'M-5 -1L-1 -7H4L5 -1M-1 -7L1 -1', fill: 'none', stroke: body, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }))
    g.add(new N('rect', { x: -2.6, y: -17, width: 5.6, height: 8, rx: 2.4, fill: C.mint, stroke: INK, 'stroke-width': 1 }))
    g.add(new N('circle', { cx: 0.5, cy: -19.5, r: 2.8, fill: SKIN[1], stroke: INK, 'stroke-width': 1 }))
    g.add(new N('path', { d: 'M-1 -9L0 -3', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' }))
  }
  return g
}

export { S }

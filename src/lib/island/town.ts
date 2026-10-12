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
import { person, tree } from './props'
import { vehicleUse, boatUse, actorUse, who, type Facing } from './actors'

const f = (v: number) => Math.round(v * 10) / 10
const box = (x0: number, y0: number, x1: number, y1: number) => `${f(x0)} ${f(y0)} ${f(x1)} ${f(y1)}`
const blob = (x: number, y: number, rx: number, ry: number) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`
const SKIN = ['#f1d9c6', '#e0b899', '#c99a78', '#8f6650']

/** A speech bubble over something you can poke, shown when you do (see .pk-say). */
export function sayBubble(w: N, x: number, y: number, text: string) {
  const b = w.add(new N('g', { class: 'pk-say' }))
  const wd = text.length * 4.4 + 12
  b.add(new N('path', { d: `M${f(x - wd / 2)} ${f(y - 12)}h${f(wd)}v11h${f(-wd / 2 + 3)}l-3 4l-3 -4h${f(-wd / 2 + 3)}z`, fill: '#ffffff', stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }))
  b.add(new N('text', { x: f(x), y: f(y - 4.2), 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 7, fill: INK }).text(text))
  return b
}

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
/**
 * The noticeboard: a little roofed board on two posts, papers pinned to it,
 * WHAT'S ON along the top. Poking it opens the island's timetable (the page's).
 */
export function noticeboard(p: Pen, x: number, y: number) {
  const [bx, by] = p.at(x, y)
  const w = p.el('g', { 'data-poke': 'notice', class: 'pk pk-notice' })
  w.add(new N('circle', { cx: f(bx), cy: f(by - 18), r: 22, fill: 'transparent' }))
  const q = new Pen(w, p.ox, p.oy, p.oz, p.b, p.lights)
  q.el('ellipse', { cx: f(bx - 3), cy: f(by + 1), rx: 17, ry: 5, fill: INK, opacity: 0.13 })
  // The posts.
  for (const dx of [-12, 12]) { q.el('path', { d: `M${f(bx + dx)} ${f(by + (dx < 0 ? -1 : 1) * 1.5)}v-30`, stroke: INK, 'stroke-width': 3.6, 'stroke-linecap': 'round' }); q.el('path', { d: `M${f(bx + dx)} ${f(by + (dx < 0 ? -1 : 1) * 1.5)}v-30`, stroke: C.wood, 'stroke-width': 1.8, 'stroke-linecap': 'round' }) }
  // The board, facing the road, and its frame.
  const g = q.el('g', { transform: `translate(${f(bx)} ${f(by - 19)}) skewY(-6)` })
  g.add(new N('rect', { x: -15, y: -11, width: 30, height: 19, rx: 1.6, fill: '#d9cdb8', stroke: INK, 'stroke-width': 1.3 }))
  g.add(new N('rect', { x: -13.5, y: -9.5, width: 27, height: 16, rx: 0.8, fill: '#cbbd9f' }))
  // Papers pinned up, each with a pin.
  const papers: [number, number, number, number, string, number][] = [[-12, -8.6, 8.4, 9.6, '#ffffff', -4], [-2.6, -9, 7.6, 6.8, '#c9f7ea', 3], [5.6, -8.2, 6.6, 8.8, '#ffd1da', -2], [-3.2, -1, 8.6, 6.2, '#e3e9ff', 2]]
  for (const [px, py, pw, ph, c, r] of papers) {
    const pg = g.add(new N('g', { transform: `rotate(${r} ${f(px + pw / 2)} ${f(py)})` }))
    pg.add(new N('rect', { x: px, y: py, width: pw, height: ph, fill: c, stroke: INK, 'stroke-width': 0.55 }))
    for (let k = 1; k < Math.floor(ph / 2); k++) pg.add(new N('path', { d: `M${f(px + 1.2)} ${f(py + k * 2)}h${f(pw - 2.4)}`, stroke: '#9aa6c8', 'stroke-width': 0.5 }))
    pg.add(new N('circle', { cx: f(px + pw / 2), cy: f(py + 0.9), r: 0.9, fill: C.rasp, stroke: INK, 'stroke-width': 0.35 }))
  }
  // The roof, and its sign.
  q.el('path', { d: `M${f(bx - 19)} ${f(by - 29.5)}L${f(bx)} ${f(by - 38)}L${f(bx + 19)} ${f(by - 33.5)}L${f(bx + 19)} ${f(by - 31)}L${f(bx)} ${f(by - 35.4)}L${f(bx - 19)} ${f(by - 27)}Z`, fill: C.cobalt, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' })
  q.el('rect', { x: f(bx - 11), y: f(by - 45), width: 22, height: 7, rx: 1.5, fill: '#ffffff', stroke: INK, 'stroke-width': 1 })
  q.el('text', { x: f(bx), y: f(by - 39.8), 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 4.6, fill: INK }).text("WHAT'S ON")
  p.grow(bx - 22, by - 47, bx + 22, by + 6)
}

/**
 * The square the pigeons live on: a round of paving, crumbs scattered on it,
 * and the old man on his bench who feeds them. (The pigeons themselves are
 * the page's: they fly off when you come near. See lib/island/play.ts.)
 */
export function pigeonSquare(p: Pen, x: number, y: number, ground: Pen) {
  // The paving is ground, under everything that walks or stands on it.
  const g = ground.plane(x, y)
  g.add(new N('ellipse', { cx: 0, cy: 0, rx: 0.47, ry: 0.47, fill: '#e3e6f2', stroke: '#c3c8dd', 'stroke-width': 0.025 }))
  g.add(new N('ellipse', { cx: 0, cy: 0, rx: 0.34, ry: 0.34, fill: 'none', stroke: '#d3d7e8', 'stroke-width': 0.02 }))
  let d = ''
  for (let k = 0; k < 18; k++) { const a = k * 2.4, r = 0.06 + (k % 6) * 0.045; d += `M${f2(Math.cos(a) * r)} ${f2(Math.sin(a) * r)}h0.012` }
  g.add(new N('path', { d, stroke: '#c9a27a', 'stroke-width': 0.022, 'stroke-linecap': 'round' }))
  const [bx, by] = p.at(x - 0.36, y + 0.3)
  // The bench, and him on it, a bag of crumbs.
  p.el('path', { d: `M${f(bx - 9)} ${f(by - 4)}h18M${f(bx - 8)} ${f(by - 4)}v4M${f(bx + 8)} ${f(by - 4)}v4`, stroke: INK, 'stroke-width': 1.4, 'stroke-linecap': 'round' })
  p.el('path', { d: `M${f(bx - 9)} ${f(by - 5)}h18`, stroke: C.wood, 'stroke-width': 2.6, 'stroke-linecap': 'round' })
  p.el('path', { d: `M${f(bx - 9)} ${f(by - 12)}h18`, stroke: C.wood, 'stroke-width': 2.2, 'stroke-linecap': 'round' })
  p.el('path', { d: `M${f(bx - 2)} ${f(by - 4)}h6v4`, stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' })
  p.el('rect', { x: f(bx - 5), y: f(by - 14.5), width: 6.4, height: 9.5, rx: 2.6, fill: '#8f9bc0', stroke: INK, 'stroke-width': 1.1 })
  p.el('circle', { cx: f(bx - 1.8), cy: f(by - 17.6), r: 3.2, fill: SKIN[1], stroke: INK, 'stroke-width': 1.1 })
  p.el('path', { d: `M${f(bx - 5.2)} ${f(by - 18.4)}a3.4 2.6 0 0 1 6.8 0z`, fill: '#5b6488', stroke: INK, 'stroke-width': 0.9 })
  p.el('path', { d: `M${f(bx + 1.4)} ${f(by - 10)}l4 1.2`, stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' })
  p.el('rect', { x: f(bx + 4.6), y: f(by - 10.2), width: 3.4, height: 3.8, rx: 0.6, fill: '#efe2c8', stroke: INK, 'stroke-width': 0.7 })
  p.grow(bx - 12, by - 22, bx + 12, by + 2)
}
const f2 = (v: number) => Math.round(v * 1000) / 1000

/** The shape each district stamps its passport in, small, for a signpost's board (see passport-art). */
export type Emblem = 'ring' | 'rope' | 'rosette' | 'hex' | 'shield' | 'ticket' | 'oval'
function emblem(g: N, shape: Emblem, ink: string) {
  const cx = 0
  const w = { fill: 'none', stroke: '#ffffff', 'stroke-width': 1.05, 'stroke-linejoin': 'round' }
  const at = (d: string) => g.add(new N('path', { d, ...w }))
  if (shape === 'ring') { g.add(new N('circle', { cx: f(cx), cy: 0, r: 2.7, ...w })); g.add(new N('circle', { cx: f(cx), cy: 0, r: 1.2, fill: '#ffffff' })) }
  else if (shape === 'rope') g.add(new N('circle', { cx: f(cx), cy: 0, r: 2.6, ...w, 'stroke-width': 1.5, 'stroke-dasharray': '1.1 0.75' }))
  else if (shape === 'rosette') {
    let d = ''
    for (let k = 0; k < 16; k++) { const r = k % 2 ? 2.05 : 2.95, t = (k / 16) * Math.PI * 2; d += `${k ? 'L' : 'M'}${f(cx + Math.cos(t) * r)} ${f(Math.sin(t) * r)}` }
    g.add(new N('path', { d: d + 'Z', fill: '#ffffff' }))
    g.add(new N('circle', { cx: f(cx), cy: 0, r: 1, fill: ink }))
  } else if (shape === 'hex') {
    let d = ''
    for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2 + Math.PI / 6; d += `${k ? 'L' : 'M'}${f(cx + Math.cos(t) * 2.9)} ${f(Math.sin(t) * 2.9)}` }
    at(d + 'Z')
  } else if (shape === 'shield') at(`M${f(cx - 2.4)} -2.7h4.8v1.9c0 2-1.1 3.1-2.4 3.9c-1.3-0.8-2.4-1.9-2.4-3.9z`)
  else if (shape === 'ticket') at(`M${f(cx - 2.2)} -2.2h4.4l0.9 0.9v2.6l-0.9 0.9h-4.4l-0.9-0.9v-2.6z`)
  else g.add(new N('ellipse', { cx: f(cx), cy: 0, rx: 3.1, ry: 2.15, ...w }))
}

/**
 * A signpost at a crossroads: a board for each road out, painted in the ink
 * of the district that road leads to, with that district's passport stamp
 * shape at the post end and its name along the rest (the names are only
 * drawn close enough to read them: see sign-words in the engine). Each board
 * points along its road; it is drawn on the road's own slant, and always
 * reads left to right, so a board pointing left has its arrow at its left.
 */
export function signpost(p: Pen, x: number, y: number, arms: { dx: number; dy: number; ink: string; name: string; shape: Emblem }[]) {
  const [bx, by] = p.at(x, y)
  const TOP = 36, L = 32, HB = 3.7
  // The foot: its shadow, thrown back to the left.
  p.el('ellipse', { cx: f(bx), cy: f(by + 0.5), rx: 6, ry: 2.6, fill: INK, opacity: 0.12 })
  p.el('path', { d: `M${f(bx - 1.5)} ${f(by)}l-11 5.5`, stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.08 })
  const board = (a: (typeof arms)[number], n: number) => {
    const z = TOP - 5 - n * 8.2
    const [ox, oy] = p.at(x, y, z), [tx, ty] = p.at(x + a.dx, y + a.dy, z)
    const ex = tx - ox, ey = ty - oy
    const s = ex >= 0 ? 1 : -1, skew = ex * ey > 0 ? 26.565 : -26.565
    p.grow(ox - L - 2, oy - L * 0.5 - HB - 2, ox + L + 2, oy + L * 0.5 + HB + 2)
    const g = p.el('g', { transform: `translate(${f(ox)} ${f(oy)}) skewY(${skew})` })
    const x0 = s * 1.2, x1 = s * (L - 4.6), x2 = s * L
    // The board, a strip of its edge lit, and a nail.
    g.add(new N('path', { d: `M${f(x0)} ${-HB}L${f(x1)} ${-HB}L${f(x2)} 0L${f(x1)} ${HB}L${f(x0)} ${HB}Z`, fill: a.ink, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }))
    g.add(new N('path', { d: `M${f(x0 + s * 1.3)} ${-HB + 1.1}L${f(x1 - s * 0.6)} ${-HB + 1.1}`, stroke: '#ffffff', 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: 0.32 }))
    g.add(new N('circle', { cx: f(s * 2.8), cy: 0, r: 0.7, fill: INK, opacity: 0.55 }))
    emblem(g.add(new N('g', { transform: `translate(${f(s * 7.2)} 0) scale(0.82)` })), a.shape, a.ink)
    g.add(new N('g', { class: 'sign-words' })).add(new N('text', { x: f((s * (L + 7.6)) / 2), y: 1.6, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 4.5, 'letter-spacing': 0.15, fill: '#ffffff' })).text(a.name)
  }
  // Boards pointing away from us are behind the post, the others in front.
  const all = arms.map((a, n) => ({ a, n }))
  for (const { a, n } of all) if (a.dx + a.dy < 0) board(a, n)
  p.path(`M${f(bx)} ${f(by)}V${f(by - TOP)}`, 'none', { sw: 4.2, stroke: INK })
  p.path(`M${f(bx)} ${f(by - 0.6)}V${f(by - TOP + 0.6)}`, 'none', { sw: 2.2, stroke: C.wood })
  p.path(`M${f(bx + 0.55)} ${f(by - 1.5)}V${f(by - TOP + 2)}`, 'none', { sw: 0.7, stroke: shade(C.wood, 1.22) })
  p.el('path', { d: `M${f(bx - 2.6)} ${f(by - TOP)}l2.6 -2.4l2.6 2.4z`, fill: shade(C.wood, 0.85), stroke: INK, 'stroke-width': 1, 'stroke-linejoin': 'round' })
  for (const { a, n } of all) if (a.dx + a.dy >= 0) board(a, n)
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
  {
    const u = actorUse(who(shirt, (x + p.ox) * 3.1 + (y + p.oy) * 7.7, { skin }), 'ground', flip ? 'sw' : 'se', 0, { transform: `translate(${f(bx)} ${f(by)})` })
    if (u) { p.el('g').add(u); p.grow(bx - 30, by - 20, bx + 12, by + 8); return }
  }
  const s = flip ? -1 : 1
  p.el('path', { d: `M${f(bx)} ${f(by - 1)}h${f(s * 8)}`, stroke: INK, 'stroke-width': 2.2, 'stroke-linecap': 'round' })
  p.el('rect', { x: bx - 3.2, y: by - 10, width: 6.4, height: 9, rx: 2.6, fill: shirt, stroke: INK, 'stroke-width': 1.1 })
  p.el('circle', { cx: bx, cy: by - 13.2, r: 3.2, fill: skin, stroke: INK, 'stroke-width': 1.1 })
  p.grow(bx - 8, by - 17, bx + 9, by + 1)
}

/** A picnic: a blanket laid flat, a basket, and two people on it. */
export function picnic(p: Pen, x: number, y: number, shirts: [string, string], cloth = C.rasp) {
  const g = p.plane(x - 0.28, y - 0.22)
  g.add(new N('rect', { x: 0, y: 0, width: 0.56, height: 0.44, fill: '#ffffff', stroke: p.real ? 'none' : INK, 'stroke-width': 0.03 }))
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
  {
    const u = actorUse(who(shirt, (x + p.ox) * 5.3 + (y + p.oy) * 2.9), 'kite', 'sw', 0, { transform: `translate(${f(bx)} ${f(by)})` })
    // The kite is modelled whether or not it is drawn yet: the export lists it for Unity.
    if (!u && p.sink) {
      const kx = bx + 46, ky = by - 92, raise = 120, gi = (kx / 32 + (ky + raise + p.oz) / 16) / 2 - p.ox, gj = ((ky + raise + p.oz) / 16 - kx / 32) / 2 - p.oy
      const kp = new Pen(new N('g'), p.ox, p.oy, p.oz, p.b, p.lights, p.sink)
      kp.model('kite', [gi, gj, raise], { fill: kite }, () => null)
    }
    if (u) {
      p.el('g').add(u)
      // The line, fine and pale against the sky, up to the kite, which sways.
      const hx = bx - 5, hy = by - 19, kx = bx + 46, ky = by - 92
      const g = p.el('g', { class: 'kite amb', 'data-b': box(hx, ky - 30, kx + 30, hy), style: `animation-delay:${f(-delay)}s` })
      g.add(new N('path', { d: `M${f(hx)} ${f(hy)}Q${f(hx + 30)} ${f(hy - 34)} ${f(kx)} ${f(ky + 12)}`, fill: 'none', stroke: '#eef0f7', 'stroke-width': 0.6, opacity: 0.85 }))
      const kp = new Pen(g, p.ox, p.oy, p.oz, p.b, p.lights, p.sink)
      // The kite itself is modelled where it flies: at the screen point (kx, ky), so a model at the ground point under it, raised.
      const raise = 120, gi = (kx / 32 + (ky + raise + p.oz) / 16) / 2 - p.ox, gj = ((ky + raise + p.oz) / 16 - kx / 32) / 2 - p.oy
      kp.model('kite', [gi, gj, raise], { fill: kite }, () => null)
      p.grow(bx - 30, ky - 30, kx + 30, by + 8)
      return
    }
  }
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
  g.add(new N('rect', { x: 0, y: 0, width: 0.84, height: 0.84, rx: 0.12, fill: p.real ? '#c9bfd6' : '#ffd9c2', stroke: p.real ? 'none' : INK, 'stroke-width': 0.03, opacity: 0.85 }))
  // Swing frame: an A at each end and a bar across.
  const a0: [number, number] = [x - 0.25, y - 0.2], a1: [number, number] = [x + 0.25, y - 0.2]
  for (const [ax, ay] of [a0, a1]) {
    p.line([ax, ay - 0.08, 0], [ax, ay, 26], { sw: 2, stroke: C.cobalt }); p.line([ax, ay + 0.08, 0], [ax, ay, 26], { sw: 2, stroke: C.cobalt })
  }
  p.line([a0[0], a0[1], 26], [a1[0], a1[1], 26], { sw: 2.4, stroke: C.cobalt })
  const [hx, hy] = p.at(x, y - 0.2, 26)
  const sw = p.el('g', { class: 'swing amb', 'data-b': box(hx - 30, hy - 4, hx + 20, hy + 30) })
  const child = actorUse(who(C.mint, (x + p.ox) * 4.4 + (y + p.oy) * 1.3), 'sit', 'se', 0, { transform: `translate(${f(hx)} ${f(hy + 21)}) scale(0.72)` })
  if (child) {
    // Chains, a seat, and a child on it, swinging.
    sw.add(new N('path', { d: `M${f(hx - 4)} ${f(hy)}v18M${f(hx + 4)} ${f(hy)}v18`, stroke: '#9aa3b8', 'stroke-width': 0.6 }))
    sw.add(new N('rect', { x: f(hx - 5.5), y: f(hy + 17), width: 11, height: 1.8, rx: 0.6, fill: '#c64c66' }))
    sw.add(child)
  } else {
  sw.add(new N('path', { d: `M${f(hx - 4)} ${f(hy)}v18M${f(hx + 4)} ${f(hy)}v18`, stroke: INK, 'stroke-width': 0.9 }))
  sw.add(new N('rect', { x: f(hx - 5.5), y: f(hy + 17), width: 11, height: 2.4, rx: 1, fill: C.rasp, stroke: INK, 'stroke-width': 0.9 }))
  sw.add(new N('rect', { x: f(hx - 2.8), y: f(hy + 7.5), width: 5.6, height: 8, rx: 2.2, fill: C.mint, stroke: INK, 'stroke-width': 1 }))
  sw.add(new N('circle', { cx: f(hx), cy: f(hy + 4.6), r: 2.8, fill: SKIN[0], stroke: INK, 'stroke-width': 1 }))
  }
  // The slide.
  p.box(x + 0.12, y + 0.08, 0.12, 0.12, 18, { fill: C.lilac, sw: 1.1 })
  p.poly([[x + 0.12, y + 0.2, 18], [x + 0.24, y + 0.2, 18], [x + 0.24, y + 0.5, 1], [x + 0.12, y + 0.5, 1]], C.sky, { sw: 1.1 })
  p.line([x + 0.24, y + 0.08, 18], [x + 0.24, y + 0.08, 26], { sw: 1.4 })
}

/* ---- the beach ----------------------------------------------------------------- */

export function umbrella(p: Pen, x: number, y: number, c: string) {
  const [bx, by] = p.at(x, y)
  if (p.sink) { p.model('umbrella', [x, y, 0], { fill: c }, () => umbrellaDrawn(p, bx, by, c)); p.grow(bx - 20, by - 36, bx + 22, by + 4); return }
  umbrellaDrawn(p, bx, by, c)
}
function umbrellaDrawn(p: Pen, bx: number, by: number, c: string) {
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
  g.add(new N('rect', { x: 0, y: 0, width: w, height: d, rx: 0.02, fill: '#ffffff', stroke: p.real ? 'none' : INK, 'stroke-width': 0.025 }))
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
  if (p.sink) { p.model('surfboard', [x, y, 0], { fill: c }, () => surfDrawn(p, bx, by, c)); p.grow(bx - 6, by - 28, bx + 6, by + 2); return }
  surfDrawn(p, bx, by, c)
}
function surfDrawn(p: Pen, bx: number, by: number, c: string) {
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
  // Unity's, bobbing at its painter (lib/island/actors.ts).
  const real = boatUse('row', c, 'sw', { transform: `translate(${f(x)} ${f(y)})` })
  if (real) { const g = new N('g', { class: 'moored amb', 'data-b': box(x - 40, y - 30, x + 20, y + 20) }); g.add(real); return g }
  const g = new N('g', { class: 'moored amb', 'data-b': box(x - 20, y - 12, x + 20, y + 8) })
  g.add(new N('path', { d: `M${f(x - 11)} ${f(y + 3)}Q${f(x)} ${f(y + 6)} ${f(x + 10)} ${f(y + 3)}L${f(x + 13)} ${f(y + 9)}Q${f(x)} ${f(y + 11)} ${f(x - 13)} ${f(y + 7)}Z`, fill: c, opacity: 0.18 }))
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
/**
 * A car, bus or bike up and down one straight road. Given `stops` (a point
 * short of a zebra crossing each way), it pulls up there for a moment on
 * each trip: the returned times say when, so someone can cross.
 */
export function shuttle(kind: 'car' | 'bus' | 'bike', body: string, a: [number, number], b: [number, number], axis: 'x' | 'y', name: string, dur: number, delay: number, stops?: [[number, number], [number, number]]): N & { holds?: [number, number][] } {
  // Along x the road climbs to the right on screen; along y it climbs to the left.
  const skew = axis === 'x' ? 26.57 : -26.57
  const fwd = Math.sign(b[0] - a[0]) || 1
  // Unity's (lib/island/actors.ts): the way it faces going out, and coming back.
  const out: Facing = axis === 'x' ? (fwd > 0 ? 'se' : 'nw') : fwd > 0 ? 'ne' : 'sw'
  const home: Facing = ({ se: 'nw', nw: 'se', ne: 'sw', sw: 'ne' } as const)[out]
  const goOut = vehicleUse(kind, body, out), goHome = vehicleUse(kind, body, home)
  const real = !!(goOut && goHome)
  const pose = (x: number, y: number, dir: number) => real ? `transform:translate(${r1(x)}px,${r1(y)}px)` : `transform:translate(${r1(x)}px,${r1(y)}px) skewY(${skew}deg) scaleX(${dir * fwd})`
  let holds: [number, number][] | undefined
  if (!stops) motionCss.push(`@keyframes ${name}{0%{${pose(a[0], a[1], 1)}}46%{${pose(b[0], b[1], 1)}}50%{${pose(b[0], b[1], -1)}}96%{${pose(a[0], a[1], -1)}}100%{${pose(a[0], a[1], 1)}}}`)
  else {
    const [s1, s2] = stops, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const t1 = (42 * Math.hypot(s1[0] - a[0], s1[1] - a[1])) / L, t2 = 50.2 + (42 * Math.hypot(s2[0] - b[0], s2[1] - b[1])) / L
    const p2 = (v: number) => Math.round(v * 100) / 100
    holds = [[p2(t1), p2(t1 + 8)], [p2(t2), p2(t2 + 8)]]
    motionCss.push(`@keyframes ${name}{0%{${pose(a[0], a[1], 1)}}${p2(t1)}%,${p2(t1 + 8)}%{${pose(s1[0], s1[1], 1)}}50%{${pose(b[0], b[1], 1)}}50.2%{${pose(b[0], b[1], -1)}}${p2(t2)}%,${p2(t2 + 8)}%{${pose(s2[0], s2[1], -1)}}99.8%{${pose(a[0], a[1], -1)}}100%{${pose(a[0], a[1], 1)}}}`)
  }
  const reach = kind === 'bus' ? 84 : 40
  const g = new N('g', { class: 'mover amb', 'data-b': box(Math.min(a[0], b[0]) - reach, Math.min(a[1], b[1]) - reach * 0.66, Math.max(a[0], b[0]) + reach * 0.62, Math.max(a[1], b[1]) + reach * 0.45), style: `animation:${name} ${dur}s linear infinite ${f(-delay)}s` })
  if (real) {
    // Out for the first half of the loop, back for the second: each facing shown for its half.
    const turn = stops ? 50.1 : 48
    motionCss.push(`@keyframes ${name}-o{0%,${turn - 0.1}%{opacity:1}${turn}%,99.9%{opacity:0}100%{opacity:1}}`)
    motionCss.push(`@keyframes ${name}-h{0%,${turn - 0.1}%{opacity:0}${turn}%,99.9%{opacity:1}100%{opacity:0}}`)
    g.add(new N('g', { style: `animation:${name}-o ${dur}s linear infinite ${f(-delay)}s` })).add(goOut!)
    g.add(new N('g', { style: `animation:${name}-h ${dur}s linear infinite ${f(-delay)}s` })).add(goHome!)
    return Object.assign(g, { holds })
  }
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
  return Object.assign(g, { holds })
}
/**
 * A market stall on the promenade: a counter under a striped awning on four
 * poles, its goods on top, and the stallholder behind it.
 */
export function stall(p: Pen, x: number, y: number, kind: 'fruit' | 'fish' | 'flowers' | 'ices' | 'books', stripe: string) {
  const w = 0.5, d = 0.3, x0 = x - w / 2, y0 = y - d / 2
  // The stallholder first: they stand behind the counter.
  person(p, x - 0.02, y0 + 0.02, [C.cobalt, C.lilac, C.mint, C.rasp, C.sky][stripe.length % 5], { hat: kind === 'fish' ? '#ffffff' : undefined, pose: kind === 'ices' ? 'wave' : 'stand' })
  for (const [px, py] of [[x0 + 0.03, y0 + 0.03], [x0 + w - 0.03, y0 + 0.03]] as const) p.line([px, py, 0], [px, py, 25], { sw: 1.4 })
  const c = p.box(x0, y0 + 0.08, w, d - 0.08, 9, { fill: C.wood, top: shade(C.wood, 1.18), sw: 1.1 })
  p.quad(c, 'y', 0.06, 0.94, 2, 7, shade(C.wood, 0.7), { sw: 0.7 })
  // The goods, along the top of the counter.
  const [gx, gy] = p.at(x, y0 + 0.08 + (d - 0.08) / 2, 9)
  if (kind === 'fruit') for (let k = 0; k < 7; k++) p.el('circle', { cx: gx - 9 + k * 3, cy: gy - 1 + (k % 2) * 1.5, r: 1.7, fill: [C.rasp, '#ffb3c2', C.mint, C.lilac][k % 4], stroke: INK, 'stroke-width': 0.5 })
  if (kind === 'fish') { p.el('path', { d: `M${f(gx - 10)} ${f(gy)}h20l-2 2h-16z`, fill: '#e6f4ff', stroke: INK, 'stroke-width': 0.6 }); for (let k = 0; k < 4; k++) p.el('path', { d: `M${f(gx - 8 + k * 5)} ${f(gy - 0.5)}q2 -2 4 0q-2 2 -4 0zm4 0l1.5 -1v2z`, fill: '#b9c6e8', stroke: INK, 'stroke-width': 0.5 }) }
  if (kind === 'flowers') for (let k = 0; k < 4; k++) { const bx = gx - 7.5 + k * 5; p.el('path', { d: `M${f(bx - 1.6)} ${f(gy + 1)}h3.2l-0.4 -3h-2.4z`, fill: C.cobalt, stroke: INK, 'stroke-width': 0.5 }); for (const [dx, dy] of [[-1.2, -4], [1, -4.6], [0, -5.6]]) p.el('circle', { cx: bx + dx, cy: gy + dy, r: 1.2, fill: ['#ff9fb2', '#ffffff', C.lilac, '#ffd1da'][k], stroke: INK, 'stroke-width': 0.4 }) }
  if (kind === 'ices') { p.cyl(x - 0.1, y0 + 0.2, 0.07, 9, 4, '#ffffff', { sw: 0.8 }); p.el('path', { d: `M${f(gx + 3)} ${f(gy - 1)}l2 6l2 -6z`, fill: '#e3c9a0', stroke: INK, 'stroke-width': 0.6 }); p.el('circle', { cx: gx + 5, cy: gy - 2.4, r: 2.2, fill: '#ffd1da', stroke: INK, 'stroke-width': 0.6 }) }
  if (kind === 'books') for (let k = 0; k < 6; k++) p.el('rect', { x: gx - 9 + k * 3, y: gy - 4 + (k % 3), width: 2.4, height: 4 - (k % 3), fill: [C.cobalt, C.rasp, C.mint, C.lilac][k % 4], stroke: INK, 'stroke-width': 0.4 })
  // The front poles, then the awning over it all.
  for (const [px, py] of [[x0 + 0.03, y0 + d], [x0 + w - 0.03, y0 + d]] as const) p.line([px, py, 0], [px, py, 25], { sw: 1.4 })
  const n = 6
  const aw = ['', '']
  for (let k = 0; k < n; k++) {
    const a = x0 - 0.04 + ((w + 0.08) * k) / n, b = x0 - 0.04 + ((w + 0.08) * (k + 1)) / n
    aw[k % 2] += 'M' + [p.at(a, y0 - 0.02, 29), p.at(b, y0 - 0.02, 29), p.at(b, y0 + d + 0.08, 23), p.at(a, y0 + d + 0.08, 23)].map(([u, v]) => `${f(u)} ${f(v)}`).join('L') + 'Z'
  }
  p.path(aw[0], stripe, { sw: 0.9 }); p.path(aw[1], '#ffffff', { sw: 0.9 })
  // A scalloped valance along the front.
  let v = ''
  for (let k = 0; k < n; k++) { const [ax, ay] = p.at(x0 - 0.04 + ((w + 0.08) * k) / n, y0 + d + 0.08, 23), [bx, by] = p.at(x0 - 0.04 + ((w + 0.08) * (k + 1)) / n, y0 + d + 0.08, 23); v += `M${f(ax)} ${f(ay)}Q${f((ax + bx) / 2)} ${f((ay + by) / 2 + 5)} ${f(bx)} ${f(by)}` }
  p.path(v, 'none', { stroke: INK, sw: 3.4 })
  p.path(v, 'none', { stroke: stripe, sw: 2 })
}

/** Lights strung between two points on poles, sagging a little; each bulb glows at night. */
export function stringLights(p: Pen, a: [number, number], b: [number, number], z = 30) {
  const [ax, ay] = p.at(a[0], a[1], z), [bx, by] = p.at(b[0], b[1], z)
  const mx = (ax + bx) / 2, my = (ay + by) / 2 + 9
  p.path(`M${f(ax)} ${f(ay)}Q${f(mx)} ${f(my)} ${f(bx)} ${f(by)}`, 'none', { sw: 0.8 })
  for (let k = 1; k < 8; k++) {
    const t = k / 8, x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx, y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by
    const c = ['#ffffff', '#ffd1da', '#d6ecff', '#d8f7ec'][k % 4]
    p.light([x, y + 2], p.el('circle', { cx: x, cy: y + 2, r: 1.5, fill: c, stroke: INK, 'stroke-width': 0.5, class: 'bulb' }), c)
  }
}

/** A little passenger ferry, drawn at the origin, facing left: white hull, a cabin with windows, a funnel. */
export function ferry(): string {
  return `<path d="M-30 6L30 6L26 14L-26 14Z" fill="${C.deep}" opacity="0.16"/>` +
    `<path d="M-34 2q-12 3 -24 2M34 2q12 3 24 2" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>` +
    `<ellipse cx="0" cy="3" rx="34" ry="5.5" fill="#ffffff" opacity="0.5"/>` +
    `<path d="M-32 -6L30 -6L26 5L-26 5Z" fill="#ffffff" stroke="${INK}" stroke-width="${OUT}" stroke-linejoin="round"/>` +
    `<path d="M-31 -2H29" stroke="${C.cobalt}" stroke-width="3"/>` +
    `<path d="M-20 -6V-18H18V-6Z" fill="#f4f6fc" stroke="${INK}" stroke-width="${OUT}" stroke-linejoin="round"/>` +
    `<path d="M-23 -18H21" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` +
    [-15, -8, -1, 6, 13].map((x) => `<rect x="${x}" y="-15" width="4.6" height="5" rx="1" fill="${C.glass}" stroke="${INK}" stroke-width="0.8"/>`).join('') +
    `<path d="M6 -18V-27H13V-18Z" fill="${C.rasp}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M6 -24H13" stroke="#ffffff" stroke-width="1.4"/>` +
    `<path d="M-28 -6V-12M-28 -12L-20 -10" fill="none" stroke="${INK}" stroke-width="1.1"/>`
}

/** A fishing boat at anchor: a wheelhouse, a mast with nets, gulls hoping. */
export function fishingBoat(x: number, y: number, hull: string, delay: number): N {
  // Unity's, riding at anchor.
  const real = boatUse('fishing', hull, delay > 1 ? 'e' : 'w', { transform: `translate(${f(x)} ${f(y)})` })
  if (real) { const g = new N('g', { class: 'moored amb', 'data-b': box(x - 90, y - 90, x + 70, y + 40), style: `animation-delay:${f(-delay)}s` }); g.add(real); return g }
  const g = new N('g', { class: 'moored amb', 'data-b': box(x - 30, y - 40, x + 30, y + 14), style: `animation-delay:${f(-delay)}s` })
  g.add(new N('path', { d: `M${f(x - 18)} ${f(y + 4)}L${f(x + 18)} ${f(y + 4)}L${f(x + 14)} ${f(y + 12)}L${f(x - 14)} ${f(y + 12)}Z`, fill: hull, opacity: 0.18 }))
  g.add(new N('ellipse', { cx: f(x), cy: f(y + 3), rx: 24, ry: 4.5, fill: '#ffffff', opacity: 0.5 }))
  g.add(new N('path', { d: `M${f(x - 22)} ${f(y - 6)}L${f(x + 20)} ${f(y - 4)}L${f(x + 15)} ${f(y + 4)}L${f(x - 16)} ${f(y + 4)}Z`, fill: hull, stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
  g.add(new N('path', { d: `M${f(x - 21)} ${f(y - 3)}L${f(x + 19)} ${f(y - 1)}`, stroke: '#ffffff', 'stroke-width': 1.4 }))
  g.add(new N('path', { d: `M${f(x + 2)} ${f(y - 5)}v-11h11v11z`, fill: '#ffffff', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
  g.add(new N('rect', { x: f(x + 5), y: f(y - 13), width: 5, height: 4, fill: C.glass, stroke: INK, 'stroke-width': 0.8 }))
  g.add(new N('path', { d: `M${f(x - 9)} ${f(y - 5)}V${f(y - 30)}M${f(x - 9)} ${f(y - 28)}L${f(x + 14)} ${f(y - 6)}M${f(x - 9)} ${f(y - 28)}L${f(x - 20)} ${f(y - 7)}`, fill: 'none', stroke: INK, 'stroke-width': 1.2, 'stroke-linecap': 'round' }))
  g.add(new N('path', { d: `M${f(x - 19)} ${f(y - 8)}q4 -10 9 -18v14z`, fill: '#cfd6ec', stroke: INK, 'stroke-width': 0.8, opacity: 0.9 }))
  g.add(new N('path', { d: `M${f(x - 9)} ${f(y - 30)}l7 2.5l-7 2.5z`, fill: C.rasp, stroke: INK, 'stroke-width': 0.8 }))
  return g
}

/** A speedboat, drawn at the origin, facing left, with a big white wake behind it. */
export function speedboat(hull: string): string {
  return `<path d="M12 1q16 2 32 0q-16 6 -32 4zM12 -1q12 -3 26 -6q-12 7 -26 9z" fill="#ffffff" opacity="0.8"/>` +
    `<ellipse cx="0" cy="2" rx="16" ry="3.5" fill="#ffffff" opacity="0.55"/>` +
    `<path d="M-16 -2Q-14 -6 -6 -6H12L13 2H-10Q-14 2 -16 -2Z" fill="${hull}" stroke="${INK}" stroke-width="${OUT}" stroke-linejoin="round"/>` +
    `<path d="M-3 -6L1 -11H7L8 -6Z" fill="${C.glassHi}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<path d="M-14 -2H12" stroke="#ffffff" stroke-width="1.2"/>` +
    `<circle cx="4" cy="-12" r="2.4" fill="#f1d9c6" stroke="${INK}" stroke-width="0.9"/>`
}

/**
 * A little islet out at sea, with a secret: someone has been living here a
 * while (a hut, SOS written in the sand, a wave for anyone passing), and
 * beside an X, half dug up, a chest that glints.
 */
export function secretIslet(p: Pen, x: number, y: number) {
  const [sx, sy] = p.at(x, y, -12)
  p.el('ellipse', { cx: sx, cy: sy + 4, rx: 96, ry: 40, fill: '#cdf1f4', opacity: 0.8 })
  p.el('ellipse', { cx: sx, cy: sy + 4, rx: 96, ry: 40, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, opacity: 0.8 })
  p.el('ellipse', { cx: sx, cy: sy + 3, rx: 66, ry: 27, fill: '#ffffff', opacity: 0.75 })
  // The mound: a sand bank all round, then the top.
  p.el('path', { d: `M${f(sx - 58)} ${f(sy - 5)}v5a58 23 0 0 0 116 0v-5z`, fill: '#e3d7ba', stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' })
  p.el('ellipse', { cx: sx, cy: sy - 5, rx: 58, ry: 23, fill: '#f6f0e1', stroke: INK, 'stroke-width': OUT })
  p.el('path', { d: `M${f(sx - 50)} ${f(sy - 1)}a52 19 0 0 0 100 0`, fill: 'none', stroke: '#dccfae', 'stroke-width': 4, 'stroke-linecap': 'round' })
  // A dune in the middle, so it is a mound of sand and not a plate.
  p.el('ellipse', { cx: sx - 4, cy: sy - 10, rx: 34, ry: 12, fill: '#fbf7ec' })
  p.el('path', { d: `M${f(sx - 36)} ${f(sy - 7)}q32 9 64 -2`, fill: 'none', stroke: '#e9dfc6', 'stroke-width': 2, 'stroke-linecap': 'round' })
  for (const [dx, dy, c] of [[-40, -2, '#ffffff'], [30, 4, '#ffc9d6'], [44, -4, '#ffffff'], [-22, 8, '#ffc9d6']] as [number, number, string][]) p.el('path', { d: `M${f(sx + dx - 2)} ${f(sy + dy)}q2 -3.5 4 0z`, fill: c, stroke: INK, 'stroke-width': 0.5 })
  // SOS in the sand, and an X with a chest beside it.
  const sand = p.plane(x - 0.05, y + 0.62, -7)
  sand.add(new N('text', { x: 0, y: 0, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 0.32, fill: '#d2c39f', 'letter-spacing': 0.04 })).text('SOS')
  const xm = p.plane(x + 0.62, y + 0.32, -7)
  xm.add(new N('path', { d: 'M-0.1 -0.1L0.1 0.1M0.1 -0.1L-0.1 0.1', stroke: C.rasp, 'stroke-width': 0.05, 'stroke-linecap': 'round' }))
  const z = -7
  const tr = p.el('g', { 'data-poke': 'treasure', class: 'pk pk-treasure' })
  const [hx, hy] = p.at(x + 0.74, y + 0.11, z)
  tr.add(new N('circle', { cx: f(hx), cy: f(hy - 4), r: 13, fill: 'transparent' }))
  const tp = new Pen(tr, p.ox, p.oy, p.oz, p.b, p.lights)
  const ch = tp.box(x + 0.66, y + 0.05, 0.16, 0.11, 5, { z0: z, fill: C.wood, sw: 1 })
  tp.band(ch, 1.5, 2.6, '#ffd98a')
  tp.poly([[x + 0.66, y + 0.05, z + 5], [x + 0.82, y + 0.05, z + 5], [x + 0.82, y + 0.05, z + 10], [x + 0.66, y + 0.05, z + 10]], shade(C.wood, 1.1), { sw: 1 })
  const [gx, gy] = p.at(x + 0.74, y + 0.11, z + 6)
  tp.el('path', { d: `M${f(gx)} ${f(gy - 5)}l1.2 3.8l3.8 1.2l-3.8 1.2l-1.2 3.8l-1.2 -3.8l-3.8 -1.2l3.8 -1.2z`, fill: '#ffffff', stroke: '#ffd98a', 'stroke-width': 0.6, class: 'twinkle' })
  sayBubble(tr, gx, gy - 12, 'treasure!')
  // The castaway's hut: driftwood and a leaf roof.
  const h = p.box(x - 0.15, y - 0.45, 0.34, 0.26, 13, { z0: z, fill: '#c9b8e8', sw: 1.2 })
  p.door(h, 'y', 0.5, { w: 0.1, h: 8, fill: shade(C.wood, 0.7) })
  p.gable(x - 0.15, y - 0.45, 0.34, 0.26, z + 13, 9, C.leaf2, 'y', { lines: 2, over: 0.08 })
  tree(p.move(0, 0, z), x - 0.55, y - 0.3, 'palm', C.leaf, 1)
  tree(p.move(0, 0, z), x + 0.62, y - 0.42, 'palm', C.leaf, 0.75)
  const cw = p.el('g', { 'data-poke': 'castaway', class: 'pk pk-castaway' })
  const [qx, qy] = p.at(x - 0.42, y + 0.18, z)
  cw.add(new N('circle', { cx: f(qx), cy: f(qy - 9), r: 13, fill: 'transparent' }))
  person(new Pen(cw, p.ox, p.oy, p.oz + z, p.b, p.lights), x - 0.42, y + 0.18, '#ffffff', { pose: 'wave', skin: '#e0b899' })
  sayBubble(cw, qx, qy - 26, 'help!')
  // A message in a bottle, bobbing in towards the island: the twelfth of them (lib/bottles).
  const [bx, by] = p.at(x - 1.6, y + 1.2, -12)
  const bw = p.el('g', { 'data-poke': 'bottle', 'data-n': 12, class: 'pk pk-bottle' })
  bw.add(new N('circle', { cx: f(bx), cy: f(by - 2), r: 12, fill: 'transparent' }))
  const b = bw.add(new N('g', { class: 'bob' }))
  b.add(new N('ellipse', { cx: f(bx), cy: f(by + 1), rx: 7, ry: 2, fill: '#ffffff', opacity: 0.6 }))
  b.add(new N('path', { d: `M${f(bx - 6)} ${f(by - 1)}q0 -4 4 -4h5l2 -1.6v4.2l-2 -1h-5q-4 0 -4 -4z`, fill: '#bdf0da', stroke: INK, 'stroke-width': 0.9, opacity: 0.95 }))
  b.add(new N('path', { d: `M${f(bx - 3)} ${f(by - 3)}h4`, stroke: '#ffffff', 'stroke-width': 1.4 }))
  p.grow(sx - 100, sy - 60, sx + 100, sy + 46)
}



/**
 * A message in a bottle, washed up on a beach: pale glass on the wet sand, a
 * cork, a rolled note inside tied with a ribbon, and a glint of sun on it now
 * and then so it catches the eye. A thing to poke, with its number, which the
 * page counts (lib/bottles).
 */
export function beachBottle(p: Pen, x: number, y: number, n: number, glass: string, flip: boolean) {
  const [sx, sy] = p.at(x, y)
  const w = p.el('g', { 'data-poke': 'bottle', 'data-n': n, class: 'pk pk-bottle' })
  w.add(new N('circle', { cx: f(sx), cy: f(sy - 2), r: 13, fill: 'transparent' }))
  // Wet sand round it, and its shadow.
  w.add(new N('ellipse', { cx: f(sx), cy: f(sy + 1.4), rx: 12.5, ry: 4.4, fill: '#cdbf9c', opacity: 0.55 }))
  w.add(new N('ellipse', { cx: f(sx - 1.5), cy: f(sy + 1.6), rx: 9.5, ry: 2.6, fill: INK, opacity: 0.13 }))
  const k = flip ? -1 : 1
  const g = w.add(new N('g', { transform: `translate(${f(sx)} ${f(sy - 2.6)}) rotate(${k * -9}) scale(${k * 1.04} 1.04)` }))
  g.add(new N('path', { d: 'M-8 -3.3h9q2.6 0 3.7 1.85h3.3v-0.45h1.1v3.8h-1.1v-0.45h-3.3q-1.1 1.85-3.7 1.85h-9a3.3 3.3 0 0 1 0-6.6z', fill: glass, stroke: INK, 'stroke-width': 1, 'stroke-linejoin': 'round' }))
  // The note inside, rolled and tied.
  g.add(new N('rect', { x: -6.4, y: -1.75, width: 7.2, height: 3.5, rx: 1.4, fill: '#fffdf7', stroke: '#9aa6c8', 'stroke-width': 0.45 }))
  g.add(new N('path', { d: 'M-2.6 -1.75v3.5', stroke: C.rasp, 'stroke-width': 0.9 }))
  // The cork.
  g.add(new N('rect', { x: 9.1, y: -1.45, width: 2.4, height: 2.9, rx: 0.7, fill: '#c69f78', stroke: INK, 'stroke-width': 0.75 }))
  // Light on the glass.
  g.add(new N('path', { d: 'M-7 -2.15h6.4', stroke: '#ffffff', 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.85 }))
  g.add(new N('path', { d: 'M5.2 -0.6h2.2', stroke: '#ffffff', 'stroke-width': 0.8, 'stroke-linecap': 'round', opacity: 0.7 }))
  // The glint, a star of light that comes and goes.
  const gx = sx + k * 3.2, gy = sy - 7.6
  w.add(new N('path', { d: `M${f(gx)} ${f(gy - 4.6)}l1.1 3.5l3.5 1.1l-3.5 1.1l-1.1 3.5l-1.1 -3.5l-3.5 -1.1l3.5 -1.1z`, fill: '#ffffff', stroke: '#8fd3ff', 'stroke-width': 0.6, class: 'twinkle', style: `animation-delay:${f(-((n * 0.77) % 2.4))}s` }))
  p.grow(sx - 14, sy - 14, sx + 14, sy + 6)
  return w
}

/**
 * The 32nd building: a hobbit-hole of a house dug into the back of Sky
 * Peaks, a round blue door, a lamp, a chimney, and a sign that says only 32.
 * It is not a game. Not yet.
 */
export function house32(p: Pen, x: number, y: number) {
  const [sx, sy] = p.at(x, y)
  p.el('ellipse', { cx: sx - 6, cy: sy + 2, rx: 24, ry: 7, fill: INK, opacity: 0.12 })
  p.dome(x, y, 0.36, 0, '#3fcf9f')
  const [dx, dy] = p.at(x + 0.1, y + 0.28, 0)
  p.el('path', { d: `M${f(dx - 6)} ${f(dy)}v-6a6 6 0 0 1 12 0v6z`, fill: C.cobalt, stroke: INK, 'stroke-width': 1.2 })
  p.el('circle', { cx: dx, cy: dy - 6, r: 1.2, fill: '#ffd98a', stroke: INK, 'stroke-width': 0.5 })
  const [wx, wy] = p.at(x + 0.32, y + 0.05, 7)
  p.el('circle', { cx: wx, cy: wy, r: 3.2, fill: C.glass, stroke: INK, 'stroke-width': 1 })
  p.light([wx, wy], p.el('circle', { cx: wx, cy: wy, r: 2, fill: C.glassHi }), '#ffe6a1')
  p.box(x - 0.12, y - 0.16, 0.08, 0.08, 9, { z0: 15, fill: C.stone2, sw: 1 })
  // The sign, on its post.
  const [px, py] = p.at(x + 0.42, y + 0.42)
  p.el('path', { d: `M${f(px)} ${f(py)}v-13`, stroke: C.wood, 'stroke-width': 1.6 })
  p.el('rect', { x: px - 6, y: py - 19, width: 12, height: 7, rx: 1.5, fill: '#ffffff', stroke: INK, 'stroke-width': 1 })
  p.el('text', { x: px, y: py - 13.6, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 5.4, fill: INK }).text('32')
  p.grow(sx - 26, sy - 30, sx + 26, sy + 6)
}

export { S }

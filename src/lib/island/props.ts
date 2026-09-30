/**
 * Tiny Island — the small things: trees, people, lamps, benches, fences,
 * flowers, crates, boats, cars, birds and flags. Each is drawn at a ground
 * point (x, y) with the pen's own height as its floor.
 */
import { C, INK, OUT, N, Pen, shade, S } from './kit'

const f = (v: number) => Math.round(v * 10) / 10

export type TreeKind = 'round' | 'pine' | 'palm' | 'cypress' | 'bush' | 'rock' | 'snag' | 'blossom'

export function tree(p: Pen, x: number, y: number, kind: TreeKind, c = C.leaf, k = 1) {
  const [bx, by] = p.at(x, y)
  if (kind === 'rock') {
    p.path(`M${f(bx - 11 * k)} ${f(by + 2)}L${f(bx - 8 * k)} ${f(by - 9 * k)}L${f(bx + 1 * k)} ${f(by - 14 * k)}L${f(bx + 10 * k)} ${f(by - 6 * k)}L${f(bx + 11 * k)} ${f(by + 2)}Z`, C.rock)
    p.path(`M${f(bx + 1 * k)} ${f(by - 14 * k)}L${f(bx + 10 * k)} ${f(by - 6 * k)}L${f(bx + 11 * k)} ${f(by + 2)}L${f(bx + 2 * k)} ${f(by + 2)}Z`, C.rockDark, { sw: 0, op: 0.55 })
    return
  }
  p.el('ellipse', { cx: bx, cy: by + 1, rx: 12 * k, ry: 5 * k, fill: INK, opacity: 0.12 })
  if (kind === 'bush') {
    for (const [dx, dy, r] of [[-5, -4, 6], [4, -5, 6.5], [0, -9, 6]]) p.el('circle', { cx: bx + dx * k, cy: by + dy * k, r: r * k, fill: c, stroke: INK, 'stroke-width': OUT })
    p.grow(bx - 12 * k, by - 16 * k, bx + 12 * k, by)
    return
  }
  const trunk = kind === 'palm' ? 26 : kind === 'cypress' ? 6 : 10
  if (kind === 'palm') p.path(`M${f(bx)} ${f(by)}q${f(-3 * k)} ${f(-13 * k)} ${f(3 * k)} ${f(-26 * k)}`, 'none', { sw: 3.2 * k, stroke: C.wood })
  else p.path(`M${f(bx)} ${f(by)}L${f(bx)} ${f(by - trunk * k)}`, 'none', { sw: 3 * k, stroke: C.wood })
  if (kind === 'pine') {
    for (const [z, r, h] of [[6, 0.24, 20], [16, 0.19, 18], [25, 0.13, 16]] as const) p.move(0, 0).cone(x, y, r * k, z * k, h * k, c)
    return
  }
  if (kind === 'cypress') {
    p.path(`M${f(bx)} ${f(by - 44 * k)}C${f(bx + 11 * k)} ${f(by - 34 * k)} ${f(bx + 10 * k)} ${f(by - 10 * k)} ${f(bx)} ${f(by - 5 * k)}C${f(bx - 10 * k)} ${f(by - 10 * k)} ${f(bx - 11 * k)} ${f(by - 34 * k)} ${f(bx)} ${f(by - 44 * k)}Z`, c)
    p.path(`M${f(bx + 2 * k)} ${f(by - 40 * k)}C${f(bx + 10 * k)} ${f(by - 30 * k)} ${f(bx + 9 * k)} ${f(by - 12 * k)} ${f(bx + 1 * k)} ${f(by - 6 * k)}`, 'none', { sw: 2.5 * k, stroke: shade(c, 0.8) })
    return
  }
  if (kind === 'palm') {
    const tx = bx + 3 * k, ty = by - 26 * k
    for (const [dx, dy, qx, qy] of [[-20, 6, -10, -8], [20, 6, 10, -8], [-15, -8, -8, -14], [15, -8, 8, -14], [0, -14, 2, -16]]) p.path(`M${f(tx)} ${f(ty)}q${f(qx * k)} ${f(qy * k)} ${f(dx * k)} ${f(dy * k)}`, 'none', { sw: 4.5 * k, stroke: C.leaf2 })
    p.el('circle', { cx: tx, cy: ty + 2, r: 2.5 * k, fill: C.wood, stroke: INK, 'stroke-width': 1 })
    p.grow(tx - 22 * k, ty - 18 * k, tx + 22 * k, by)
    return
  }
  if (kind === 'snag') {
    p.path(`M${f(bx)} ${f(by - 10 * k)}l${f(-8 * k)} ${f(-10 * k)}M${f(bx)} ${f(by - 12 * k)}l${f(7 * k)} ${f(-12 * k)}M${f(bx + 4 * k)} ${f(by - 18 * k)}l${f(5 * k)} ${f(-2 * k)}`, 'none', { sw: 2.4 * k, stroke: C.wood })
    return
  }
  // Round and blossom: three overlapping blobs with a lit edge.
  const top = by - trunk * k - 9 * k
  const blobs: [number, number, number][] = [[-6, 2, 8], [6, 1, 8.5], [0, -6, 9.5]]
  for (const [dx, dy, r] of blobs) p.el('circle', { cx: bx + dx * k, cy: top + dy * k, r: r * k, fill: c, stroke: INK, 'stroke-width': OUT })
  p.el('circle', { cx: bx - 3 * k, cy: top - 8 * k, r: 3.2 * k, fill: '#ffffff', opacity: 0.35 })
  if (kind === 'blossom') for (const [dx, dy] of [[-7, -1], [4, -7], [8, 3], [-2, 4]]) p.el('circle', { cx: bx + dx * k, cy: top + dy * k, r: 1.8 * k, fill: '#ffd1da', stroke: INK, 'stroke-width': 0.6 })
  p.grow(bx - 16 * k, top - 17 * k, bx + 16 * k, by)
}

/** A person standing: head, body, legs. `pose` 'wave' raises an arm. */
export function person(p: Pen, x: number, y: number, shirt: string, o: { skin?: string; hat?: string; pose?: 'stand' | 'wave' | 'look'; k?: number; cls?: string } = {}) {
  const [bx, by] = p.at(x, y)
  const k = o.k ?? 1, skin = o.skin ?? '#f1d9c6'
  const g = p.group(o.cls)
  g.el('ellipse', { cx: bx, cy: by + 0.5, rx: 4.5 * k, ry: 1.8 * k, fill: INK, opacity: 0.15 })
  g.el('path', { d: `M${f(bx - 1.8 * k)} ${f(by)}v${f(-6 * k)}M${f(bx + 1.8 * k)} ${f(by)}v${f(-6 * k)}`, stroke: INK, 'stroke-width': 2 * k, 'stroke-linecap': 'round', fill: 'none' })
  g.el('rect', { x: bx - 3.4 * k, y: by - 14 * k, width: 6.8 * k, height: 9 * k, rx: 2.6 * k, fill: shirt, stroke: INK, 'stroke-width': 1.2 })
  if (o.pose === 'wave') g.el('path', { d: `M${f(bx + 3 * k)} ${f(by - 12 * k)}l${f(4 * k)} ${f(-5 * k)}`, stroke: INK, 'stroke-width': 1.8 * k, 'stroke-linecap': 'round', class: 'wave-arm' })
  g.el('circle', { cx: bx, cy: by - 17.5 * k, r: 3.4 * k, fill: skin, stroke: INK, 'stroke-width': 1.2 })
  if (o.hat) g.el('path', { d: `M${f(bx - 3.6 * k)} ${f(by - 18.5 * k)}a${f(3.6 * k)} ${f(3.2 * k)} 0 0 1 ${f(7.2 * k)} 0z`, fill: o.hat, stroke: INK, 'stroke-width': 1 })
  p.grow(bx - 6 * k, by - 22 * k, bx + 8 * k, by + 2)
  return g
}

/** The figure a walker carries along its path, drawn at the origin. */
export function walkerFigure(shirt: string, k = 1): string {
  const s = (v: number) => f(v * k)
  return `<ellipse cx="0" cy="0.5" rx="${s(4.5)}" ry="${s(1.8)}" fill="${INK}" opacity="0.15"/>` +
    `<g class="legs"><path d="M${s(-1.8)} 0v${s(-6)}" stroke="${INK}" stroke-width="${s(2)}" stroke-linecap="round" class="leg-a"/><path d="M${s(1.8)} 0v${s(-6)}" stroke="${INK}" stroke-width="${s(2)}" stroke-linecap="round" class="leg-b"/></g>` +
    `<rect x="${s(-3.4)}" y="${s(-14)}" width="${s(6.8)}" height="${s(9)}" rx="${s(2.6)}" fill="${shirt}" stroke="${INK}" stroke-width="1.2"/>` +
    `<circle cx="0" cy="${s(-17.5)}" r="${s(3.4)}" fill="#f1d9c6" stroke="${INK}" stroke-width="1.2"/>`
}

export function lamp(p: Pen, x: number, y: number, h = 26) {
  const [bx, by] = p.at(x, y)
  p.path(`M${f(bx)} ${f(by)}L${f(bx)} ${f(by - h)}`, 'none', { sw: 2.2 })
  p.path(`M${f(bx)} ${f(by - h)}q0 -4 5 -4`, 'none', { sw: 2 })
  p.el('circle', { cx: bx + 5.5, cy: by - h - 2, r: 3.2, fill: '#f4f6fc', stroke: INK, 'stroke-width': 1.2, class: 'lamp-bulb' })
  p.lights.push([bx + 5.5, by - h - 2])
  p.grow(bx - 3, by - h - 7, bx + 9, by)
}

export function bench(p: Pen, x: number, y: number, axis: 'x' | 'y' = 'x') {
  const w = 0.34, d = 0.1
  const b = axis === 'x' ? p.box(x - w / 2, y - d / 2, w, d, 2, { z0: 4, fill: C.wood, sw: 1 }) : p.box(x - d / 2, y - w / 2, d, w, 2, { z0: 4, fill: C.wood, sw: 1 })
  if (axis === 'x') p.box(b.x, b.y - 0.03, b.w, 0.03, 6, { z0: 6, fill: C.wood, sw: 1 })
  else p.box(b.x - 0.03, b.y, 0.03, b.d, 6, { z0: 6, fill: C.wood, sw: 1 })
}

export function flowers(p: Pen, x: number, y: number, cols: string[] = ['#ff9fb2', C.lilac, '#ffffff']) {
  const [bx, by] = p.at(x, y)
  p.el('ellipse', { cx: bx, cy: by, rx: 11, ry: 5, fill: C.leaf, stroke: INK, 'stroke-width': 1.2 })
  ;[[-6, -1], [-1, -3], [4, -1], [7, 1], [0, 1.5], [-4, 2]].forEach(([dx, dy], i) => p.el('circle', { cx: bx + dx, cy: by + dy - 1, r: 1.8, fill: cols[i % cols.length], stroke: INK, 'stroke-width': 0.6 }))
  p.grow(bx - 11, by - 6, bx + 11, by + 5)
}

export function fence(p: Pen, pts: [number, number][], h = 7, c = '#ffffff') {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2))
    for (let k = 0; k <= n; k++) { const t = k / n; p.line([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0], [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, h], { sw: 1.4 }) }
    p.line([a[0], a[1], h - 1.5], [b[0], b[1], h - 1.5], { sw: 2.6 })
    p.line([a[0], a[1], h - 1.5], [b[0], b[1], h - 1.5], { sw: 1.2, stroke: c })
  }
}

export function crate(p: Pen, x: number, y: number, s = 0.16, c = C.wood) {
  const b = p.box(x - s / 2, y - s / 2, s, s, s * S * 0.45, { fill: c, sw: 1.1 })
  p.line([b.x, b.y + b.d, 0], [b.x + b.w, b.y + b.d, b.h], { sw: 0.8, stroke: shade(c, 0.6) })
}

export function barrel(p: Pen, x: number, y: number, c = C.cobalt) {
  p.cyl(x, y, 0.07, 0, 10, c, { sw: 1.1, bands: [[2, 3.5, shade(c, 0.7)], [7, 8.5, shade(c, 0.7)]] })
}

export function flag(p: Pen, x: number, y: number, z: number, c: string, h = 22, cls = 'flutter') {
  const [bx, by] = p.at(x, y, z)
  p.path(`M${f(bx)} ${f(by)}L${f(bx)} ${f(by - h)}`, 'none', { sw: 1.8 })
  p.path(`M${f(bx)} ${f(by - h)}l14 4l-14 5z`, c, { sw: 1.2, cls })
  p.grow(bx - 2, by - h - 2, bx + 16, by)
}

/** A sailboat, drawn at the origin, for a boat that moves along a path. */
export function sailboat(hull: string, sail = '#ffffff', k = 1): string {
  const s = (v: number) => f(v * k)
  return `<ellipse cx="0" cy="${s(3)}" rx="${s(24)}" ry="${s(5)}" fill="#ffffff" opacity="0.45"/>` +
    `<path d="M${s(-20)} ${s(-3)}L${s(20)} ${s(-3)}L${s(13)} ${s(6)}L${s(-14)} ${s(6)}Z" fill="${hull}" stroke="${INK}" stroke-width="${OUT}" stroke-linejoin="round"/>` +
    `<path d="M${s(-20)} ${s(-3)}L${s(20)} ${s(-3)}" stroke="#ffffff" stroke-width="1.4"/>` +
    `<path d="M${s(1)} ${s(-4)}L${s(1)} ${s(-34)}L${s(17)} ${s(-7)}Z" fill="${sail}" stroke="${INK}" stroke-width="${OUT}" stroke-linejoin="round" class="sail"/>` +
    `<path d="M${s(-1)} ${s(-6)}L${s(-1)} ${s(-26)}L${s(-13)} ${s(-7)}Z" fill="${shade(sail, 0.9)}" stroke="${INK}" stroke-width="${OUT}" stroke-linejoin="round"/>`
}

/** A small car, drawn at the origin. */
export function carFigure(body: string): string {
  return `<ellipse cx="0" cy="1" rx="13" ry="5" fill="${INK}" opacity="0.15"/>` +
    `<path d="M-12 -2L-8 -9L7 -9L12 -2L12 2L-12 2Z" fill="${body}" stroke="${INK}" stroke-width="${OUT}" stroke-linejoin="round"/>` +
    `<path d="M-6 -8L-4 -13L4 -13L6 -8Z" fill="#d8eeff" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<circle cx="-7" cy="2" r="3" fill="${INK}"/><circle cx="7" cy="2" r="3" fill="${INK}"/>`
}

/** A flock of three, for a sky layer. */
export function birds(): string {
  return [[0, 0], [16, 8], [-14, 10]].map(([x, y]) => `<path class="flap" d="M${x - 7} ${y}q3.5 -5 7 0q3.5 -5 7 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`).join('')
}

/** A cloud, drawn at the origin; its shadow is drawn separately on the ground. */
export function cloudShape(k = 1): string {
  const parts: [number, number, number][] = [[0, 0, 26], [30, 8, 20], [-28, 9, 18], [10, -16, 20], [-12, -12, 17]]
  return `<g>` + parts.map(([x, y, r]) => `<circle cx="${f(x * k)}" cy="${f(y * k)}" r="${f(r * k)}" fill="#ffffff" stroke="${INK}" stroke-width="${OUT}"/>`).join('') +
    parts.map(([x, y, r]) => `<circle cx="${f(x * k)}" cy="${f(y * k)}" r="${f(r * k - 1.2)}" fill="#ffffff"/>`).join('') +
    `<path d="M${f(-44 * k)} ${f(16 * k)}q${f(44 * k)} ${f(14 * k)} ${f(92 * k)} ${f(-2 * k)}" fill="none" stroke="${C.cloud}" stroke-width="${f(8 * k)}" stroke-linecap="round"/></g>`
}

export { N }

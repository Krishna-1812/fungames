/**
 * Tiny Island — the small things: trees, people, lamps, benches, fences,
 * flowers, crates, boats, cars, birds and flags. Each is drawn at a ground
 * point (x, y) with the pen's own height as its floor.
 */
import { C, INK, OUT, N, Pen, shade, mix, S } from './kit'
import type { FigureSet } from './figures'
import { who, actorUse, creatureUse } from './actors'
import { folk, drawFolk, drawDog, FOLK, type FolkPose } from './folk'

const f = (v: number) => Math.round(v * 10) / 10

export type TreeKind = 'round' | 'pine' | 'palm' | 'cypress' | 'bush' | 'rock' | 'snag' | 'blossom'

/* ---- figures: what grows, as Unity renders it ----------------------------
 * Every tree, rock and cactus has a name: what it is, its colour's kind of
 * tree (the leaf green, the purple of a jacaranda in flower, the blue-green
 * of a eucalyptus) and one of a few of each, chosen by where it stands. Each
 * one drawn is written down (`planted`, in the world's own units), so Unity
 * can grow the same one in the same place (scripts/export-island.mjs) and
 * cast its shadow on the ground. Given the figures (setFigures), each is
 * drawn as Unity's picture of it in place of the drawing here. */
export type Planted = { name: string; x: number; y: number; z: number; k: number }
export const planted: Planted[] = []
/** The figures drawn, for the island's definitions (world.ts). */
export const figuresUsed = new Set<string>()
let figs: FigureSet | null = null
export function setFigures(set: FigureSet | null) { figs = set; planted.length = 0; figuresUsed.clear() }

const pick = (x: number, y: number, seed: number, n: number) => Math.floor(Math.abs(Math.sin(x * 12.99 + y * 78.23 + seed) * 437.5)) % n
export const colourKind = (c: string) => (c === C.bloom ? 'bloom' : c === C.leafB ? 'teal' : 'leaf')

/** A figure at a ground point: written down, and drawn if Unity has made it (true), or left to the drawing (false). */
export function figure(p: Pen, x: number, y: number, name: string, k: number): boolean {
  planted.push({ name, x: f(x + p.ox), y: f(y + p.oy), z: p.oz, k: Math.round(k * 100) / 100 })
  const it = figs?.items[name]
  if (!it) return false
  const [bx, by] = p.at(x, y)
  figuresUsed.add(name)
  // (Its own size on a set piece, as people are: figFeet.)
  const g = p.el('g')
  figFeet.set(g, [bx, by])
  g.add(new N('use', { href: `#fig-${name}`, transform: `translate(${f(bx)} ${f(by)}) scale(${Math.round(k * 1000) / 1000})` }))
  p.grow(bx - it.ax * k, by - it.ay * k, bx + (it.w - it.ax) * k, by + (it.h - it.ay) * k)
  return true
}
/** A figure's picture, if Unity has made it. */
export function figureItem(name: string) { return figs?.items[name] }
/** The definitions the figures drawn refer to: one picture each, however many times it is drawn. */
export function figureDefs(): N | null {
  if (!figs || !figuresUsed.size) return null
  const d = new N('defs')
  for (const name of [...figuresUsed].sort()) {
    const it = figs.items[name]
    d.add(new N('image', { id: `fig-${name}`, href: it.href, x: -it.ax, y: -it.ay, width: it.w, height: it.h, preserveAspectRatio: 'none' }))
  }
  return d
}

export function treeName(kind: TreeKind, c: string, x: number, y: number): string {
  if (kind === 'rock') return `rock${pick(x, y, 0, 3)}`
  if (kind === 'palm' || kind === 'blossom') return `${kind}${pick(x, y, 1, 3)}`
  if (kind === 'snag') return `snag${pick(x, y, 1, 2)}`
  return `${kind}-${colourKind(c)}${pick(x, y, 1, 3)}`
}

export function tree(p: Pen, x: number, y: number, kind: TreeKind, c = C.leaf, k = 1) {
  if (figure(p, x, y, treeName(kind, c, x, y), k)) return
  const [bx, by] = p.at(x, y)
  if (kind === 'rock') {
    const v = Math.floor(Math.abs(Math.sin(x * 12.99 + y * 78.23) * 437.5)) % 3
    p.el('ellipse', { cx: bx - 4 * k, cy: by + 2, rx: 12 * k, ry: 3.6 * k, fill: INK, opacity: 0.1 })
    if (v === 1) {
      p.path(`M${f(bx - 10 * k)} ${f(by + 2)}Q${f(bx - 11 * k)} ${f(by - 11 * k)} ${f(bx)} ${f(by - 12 * k)}Q${f(bx + 11 * k)} ${f(by - 11 * k)} ${f(bx + 10 * k)} ${f(by + 2)}Z`, C.rock)
      p.path(`M${f(bx + 1 * k)} ${f(by - 12 * k)}Q${f(bx + 11 * k)} ${f(by - 11 * k)} ${f(bx + 10 * k)} ${f(by + 2)}L${f(bx + 2 * k)} ${f(by + 2)}Q${f(bx + 6 * k)} ${f(by - 6 * k)} ${f(bx + 1 * k)} ${f(by - 12 * k)}Z`, C.rockDark, { sw: 0, op: 0.5 })
      p.path(`M${f(bx - 6 * k)} ${f(by - 6 * k)}q2 -3 5 -4`, 'none', { stroke: '#ffffff', sw: 1.3, op: 0.6 })
      return
    }
    if (v === 2) {
      p.path(`M${f(bx - 7 * k)} ${f(by + 2)}L${f(bx - 6 * k)} ${f(by - 17 * k)}L${f(bx - 1 * k)} ${f(by - 19 * k)}L${f(bx)} ${f(by + 2)}Z`, C.rock)
      p.path(`M${f(bx + 1 * k)} ${f(by + 2)}L${f(bx + 2 * k)} ${f(by - 13 * k)}L${f(bx + 8 * k)} ${f(by - 11 * k)}L${f(bx + 9 * k)} ${f(by + 2)}Z`, shade(C.rock, 0.86))
      p.path(`M${f(bx - 6 * k)} ${f(by - 9 * k)}h5M${f(bx + 2 * k)} ${f(by - 5 * k)}h6`, 'none', { sw: 0.9, op: 0.4 })
      return
    }
    p.path(`M${f(bx - 11 * k)} ${f(by + 2)}L${f(bx - 8 * k)} ${f(by - 9 * k)}L${f(bx + 1 * k)} ${f(by - 14 * k)}L${f(bx + 10 * k)} ${f(by - 6 * k)}L${f(bx + 11 * k)} ${f(by + 2)}Z`, C.rock)
    p.path(`M${f(bx + 1 * k)} ${f(by - 14 * k)}L${f(bx + 10 * k)} ${f(by - 6 * k)}L${f(bx + 11 * k)} ${f(by + 2)}L${f(bx + 2 * k)} ${f(by + 2)}Z`, C.rockDark, { sw: 0, op: 0.55 })
    return
  }
  // A soft shadow, cast to the front left as every other is: a faint wide one round a darker core.
  p.el('ellipse', { cx: bx - 7 * k, cy: by + 1.5, rx: 17 * k, ry: 5.8 * k, fill: INK, opacity: 0.06 })
  p.el('ellipse', { cx: bx - 5 * k, cy: by + 1.2, rx: 11 * k, ry: 3.8 * k, fill: INK, opacity: 0.09 })
  if (kind === 'bush') {
    foliage(p, c, [[-5, -4, 6], [4, -5, 6.5], [0, -9, 6]].map(([dx, dy, r]) => [bx + dx * k, by + dy * k, r * k] as [number, number, number]))
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
    // A tall Italian cypress: a narrow flame of foliage in tufts, widest a
    // third of the way up, shaded down its right side.
    const q = (x0: number, y0: number) => `${f(bx + x0 * k)} ${f(by + y0 * k)}`
    const left = `M${q(0, -5)}Q${q(-7, -6)} ${q(-7.5, -13)}Q${q(-9.5, -19)} ${q(-7, -25)}Q${q(-8.5, -31)} ${q(-5.5, -36)}Q${q(-5.5, -42)} ${q(-2.5, -45)}Q${q(-1, -50)} ${q(0, -51)}`
    const right = `Q${q(1, -50)} ${q(2.5, -45)}Q${q(5.5, -42)} ${q(5.5, -36)}Q${q(8.5, -31)} ${q(7, -25)}Q${q(9.5, -19)} ${q(7.5, -13)}Q${q(7, -6)} ${q(0, -5)}Z`
    p.path(left + right, c)
    p.path(`M${q(0.5, -50)}` + right.replace(/Z$/, '') + `Q${q(3, -20)} ${q(0.5, -50)}Z`, shade(c, 0.78), { sw: 0, op: 0.85 })
    // Tufts: little lit scallops down the left side.
    for (const [x0, y0] of [[-4, -40], [-5.5, -29], [-6, -18], [-3, -10]]) p.path(`M${q(x0, y0)}q${f(2 * k)} ${f(-3 * k)} ${f(4.5 * k)} ${f(-1 * k)}`, 'none', { sw: 1.1, stroke: shade(c, 1.25) })
    p.path(left + right, 'none')
    p.grow(bx - 10 * k, by - 52 * k, bx + 10 * k, by)
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
  foliage(p, c, blobs.map(([dx, dy, r]) => [bx + dx * k, top + dy * k, r * k] as [number, number, number]))
  if (kind === 'blossom') for (const [dx, dy] of [[-7, -1], [4, -7], [8, 3], [-2, 4]]) p.el('circle', { cx: bx + dx * k, cy: top + dy * k, r: 1.8 * k, fill: '#ffd1da', stroke: INK, 'stroke-width': 0.6 })
  p.grow(bx - 16 * k, top - 17 * k, bx + 16 * k, by)
}

/**
 * Leaves in clumps, lit as the island is (the sun high on the right): each
 * clump outlined in its shade, its body moved up towards the light, a lit
 * cap on top, and a few leaves' edges picked out in the shade's colour, so a
 * crown reads as round and full rather than as three flat discs.
 */
export function foliage(p: Pen, c: string, blobs: [number, number, number][]) {
  const dark = shade(c, 0.74), lit = mix(c, '#e6f5c4', 0.32)
  for (const [x, y, r] of blobs) p.el('circle', { cx: f(x), cy: f(y), r: f(r), fill: dark, stroke: INK, 'stroke-width': OUT })
  for (const [x, y, r] of blobs) p.el('circle', { cx: f(x + r * 0.13), cy: f(y - r * 0.17), r: f(r * 0.78), fill: c })
  for (const [x, y, r] of blobs) p.el('circle', { cx: f(x + r * 0.3), cy: f(y - r * 0.4), r: f(r * 0.38), fill: lit })
  let d = ''
  for (const [x, y, r] of blobs) d += `M${f(x - r * 0.62)} ${f(y + r * 0.1)}q${f(r * 0.2)} ${f(r * 0.26)} ${f(r * 0.46)} ${f(r * 0.12)}M${f(x - r * 0.05)} ${f(y + r * 0.42)}q${f(r * 0.2)} ${f(r * 0.2)} ${f(r * 0.42)} ${f(r * 0.02)}`
  p.el('path', { d, fill: 'none', stroke: dark, 'stroke-width': 1.1, 'stroke-linecap': 'round' })
}

/**
 * Where each person drawn stands on screen, by their group: a set piece is
 * drawn bigger than life (world.ts, HERO), and the people at it are put back
 * to their own size, standing where they stood.
 */
export const figFeet = new WeakMap<N, [number, number]>()

/** A person standing: head, body, legs. `pose` 'wave' raises an arm. */
export function person(p: Pen, x: number, y: number, shirt: string, o: { skin?: string; hat?: string; pose?: 'stand' | 'wave' | 'look' | 'phone'; k?: number; cls?: string; dog?: boolean } = {}) {
  const [bx, by] = p.at(x, y)
  const k = o.k ?? 1, skin = o.skin ?? '#f1d9c6'
  // Unity's, on the realistic island: turned towards us, one way or the other.
  {
    const seed = (x + p.ox) * 7.31 + (y + p.oy) * 3.17
    const w = who(shirt, seed, { skin: o.skin, hat: o.hat ?? null })
    const u = actorUse(w, o.pose === 'phone' ? 'look' : o.pose ?? 'stand', pick(x + p.ox, y + p.oy, 5, 2) ? 'se' : 'sw', 0, { transform: `translate(${f(bx)} ${f(by)})${k !== 1 ? ` scale(${Math.round(k * 1000) / 1000})` : ''}` })
    if (u) {
      const g = p.group(o.cls)
      figFeet.set(g.g, [bx, by])
      g.g.add(u)
      p.grow(bx - 30 * k, by - 24 * k, bx + 12 * k, by + 8 * k)
      return g
    }
  }
  // Drawn: someone of their own (folk.ts), the same one wherever this spot is drawn.
  const g = p.group(o.cls)
  figFeet.set(g.g, [bx, by])
  const seed = (x + p.ox) * 7.31 + (y + p.oy) * 3.17
  const who1 = folk(seed, { skin: o.skin, hat: o.hat ?? null })
  const K = k * FOLK * who1.h
  const pose: FolkPose = o.pose === 'wave' ? 'wave' : o.pose === 'phone' ? 'phone' : 'stand'
  const body = g.el('g', { transform: `translate(${f(bx)} ${f(by)}) scale(${Math.round(K * 1000) / 1000})` })
  if (o.dog) drawDog(g.el('g', { transform: `translate(${f(bx + 9 * k)} ${f(by + 2.5 * k)}) scale(${Math.round(k * FOLK * 1000) / 1000})` }), seed, [-2.3, -10.1])
  drawFolk(body, who1, shirt, pose)
  p.grow(bx - 8 * K, by - 26 * K, bx + 18 * k, by + 4)
  return g
}

/** The figure a walker carries along its path, drawn at the origin. */
export function walkerFigure(shirt: string, k = 1, seed = 0): N {
  const p = folk(seed * 5.71 + 3.3)
  const K = Math.round(k * FOLK * p.h * 1000) / 1000
  const g = new N('g', { transform: `scale(${K})` })
  drawFolk(g, p, shirt, 'stand', true)
  return g
}

export function lamp(p: Pen, x: number, y: number, h = 26) {
  const [bx, by] = p.at(x, y)
  // The post and its arm: Unity's on the realistic island (Models.cs, Lamp), else drawn.
  p.model('lamp', [x, y, 0], { h }, () => {
    p.path(`M${f(bx)} ${f(by)}L${f(bx)} ${f(by - h)}`, 'none', { sw: 2.2 })
    p.path(`M${f(bx)} ${f(by - h)}q0 -4 5 -4`, 'none', { sw: 2 })
  })
  // The bulb, for the night's light to find: unseen by day on the realistic island (the lantern is the model's).
  p.light([bx + 5.5, by - h - 2], p.el('circle', { cx: bx + 5.5, cy: by - h - 2, r: 3.2, fill: '#f4f6fc', stroke: INK, 'stroke-width': 1.2, class: 'lamp-bulb', opacity: p.real ? 0 : undefined }), '#fff6dc', h + 2)
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
  if (p.sink) { p.model('flowers', [x, y, 0], { fill: cols[0], top: cols[1] }, () => flowersDrawn(p, bx, by, cols)); p.grow(bx - 12, by - 8, bx + 12, by + 6); return }
  flowersDrawn(p, bx, by, cols)
}
function flowersDrawn(p: Pen, bx: number, by: number, cols: string[]) {
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
  // The pole: a line (a steel rod on the realistic island), the same either way, so its building's runs line up.
  p.line([x, y, z], [x, y, z + h + 1], { sw: p.real ? 1.4 : 1.8, stroke: p.real ? '#c9cde0' : undefined })
  if (p.real) {
    // The cloth on it: lit on its near half, shadowed in the fold.
    const fl = p.el('g', { class: cls })
    fl.add(new N('path', { d: `M${f(bx)} ${f(by - h)}l14 4l-14 5z`, fill: c }))
    fl.add(new N('path', { d: `M${f(bx)} ${f(by - h + 4.5)}l14 -0.5l-14 5z`, fill: shade(c, 0.78) }))
    p.grow(bx - 2, by - h - 2, bx + 16, by)
    return
  }
  p.path(`M${f(bx)} ${f(by - h)}l14 4l-14 5z`, c, { sw: 1.2, cls })
  p.grow(bx - 2, by - h - 2, bx + 16, by)
}

/**
 * A sailboat, drawn at the origin, for a boat that moves along a path: its
 * sails reflected faintly in the water under it, and a wake spreading out
 * either side, since it sails both ways round.
 */
export function sailboat(hull: string, sail = '#ffffff', k = 1): string {
  const s = (v: number) => f(v * k)
  return `<path d="M${s(1)} ${s(7)}L${s(1)} ${s(30)}L${s(14)} ${s(9)}ZM${s(-1)} ${s(7)}L${s(-1)} ${s(23)}L${s(-11)} ${s(8)}Z" fill="${sail}" opacity="0.22"/>` +
    `<path d="M${s(-14)} ${s(6)}L${s(13)} ${s(6)}L${s(10)} ${s(11)}L${s(-11)} ${s(11)}Z" fill="${hull}" opacity="0.18"/>` +
    `<path d="M${s(-22)} ${s(4)}q${s(-12)} ${s(3)} ${s(-26)} ${s(2)}M${s(22)} ${s(4)}q${s(12)} ${s(3)} ${s(26)} ${s(2)}M${s(-18)} ${s(8)}q${s(-9)} ${s(3)} ${s(-18)} ${s(3)}M${s(18)} ${s(8)}q${s(9)} ${s(3)} ${s(18)} ${s(3)}" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/>` +
    `<ellipse cx="0" cy="${s(3)}" rx="${s(24)}" ry="${s(5)}" fill="#ffffff" opacity="0.45"/>` +
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

/**
 * A cloud, drawn at the origin: soft and a little see-through, with no ink
 * outline, so it floats over the map rather than sitting on it. A shaded
 * base, then the lit puffs on top. Its shadow is drawn separately below it.
 */
/** A cloud, Unity's (one of five cumulus), drawn at the origin; null if it has not been made. */
export function cloudModel(n: number, k = 1): N | null {
  return creatureUse('cloud', '#fbfcff', `c${n % 5}`, 'se', { transform: k !== 1 ? `scale(${Math.round(k * 100) / 100})` : undefined, opacity: 0.96 })
}

export function cloudShape(k = 1): string {
  const parts: [number, number, number][] = [[0, 0, 26], [30, 8, 20], [-28, 9, 18], [10, -16, 20], [-12, -12, 17]]
  return '<g class="cloud-body" opacity="0.9">' +
    `<ellipse cx="${f(2 * k)}" cy="${f(17 * k)}" rx="${f(46 * k)}" ry="${f(11 * k)}" fill="#d9e2f6" class="cloud-base"/>` +
    parts.map(([x, y, r]) => `<circle cx="${f(x * k)}" cy="${f(y * k)}" r="${f(r * k)}" fill="#ffffff" class="cloud-puff"/>`).join('') +
    `<path d="M${f(-40 * k)} ${f(14 * k)}q${f(42 * k)} ${f(10 * k)} ${f(86 * k)} 0" fill="none" stroke="#e6ecfa" stroke-width="${f(6 * k)}" stroke-linecap="round" class="cloud-base"/>` +
    `<ellipse cx="${f(-6 * k)}" cy="${f(-18 * k)}" rx="${f(12 * k)}" ry="${f(6 * k)}" fill="#ffffff" opacity="0.9"/></g>`
}

export { N }

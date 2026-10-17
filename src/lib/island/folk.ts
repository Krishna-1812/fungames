/**
 * The cartoon island's people, drawn: each one their own person, chosen by a
 * seed (where they stand, or which walker they are), so the same spot always
 * has the same person in it.
 *
 * A person is built from their skin, their hair (a style and a colour), what
 * they wear (the shirt the caller gives, trousers or a skirt below), their
 * build and height, and sometimes a bag or a backpack; and stands, waves or
 * looks at a phone. Drawn at the origin with their feet on it, a little
 * bigger than the island's first people (who were hard to see), and lit as
 * everything on the island is: from the right.
 *
 * The realistic island's people are Unity's (actors.ts); this is only ever
 * the drawing.
 */
import { INK, N, shade, mix } from './kit'

const f = (v: number) => Math.round(v * 100) / 100
const hash = (a: number, b: number) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v) }
const pickOf = <T,>(xs: T[], seed: number, salt: number) => xs[Math.floor(hash(seed, salt) * xs.length) % xs.length]

/** How much bigger than the first people everyone is drawn. */
export const FOLK = 1.04

const SKINS = ['#f1d9c6', '#e8c4a8', '#d3a27f', '#a8714e', '#7a4b32', '#563626']
const HAIR = ['#2b2220', '#3d2b22', '#5a3d2b', '#7b5a42', '#8d8f98', '#1e1c26', '#5c2f2c', '#d9d4cc']
const LEGS = ['#3b4a6b', '#2f3340', '#5d6470', '#4f5d48', '#6d5b4d', '#46557d', '#3a3a3f']
const BAGS = ['#8c6e5a', '#3f4a66', '#a14f5c', '#4f7d68', '#6b5d8f']

export type Folk = { skin: string; hair: number; hairC: string; legs: string; skirt: boolean; w: number; h: number; bag: 0 | 1 | 2; bagC: string; hat: string | null }
export type FolkPose = 'stand' | 'wave' | 'phone'

/** Someone, from a seed: the shirt is the caller's (and a skin or a hat, if it has one in mind). */
export function folk(seed: number, o: { skin?: string; hat?: string | null } = {}): Folk {
  const hairR = hash(seed, 3)
  return {
    skin: o.skin ?? pickOf(SKINS, seed, 1),
    // 0 short, 1 side-swept, 2 long, 3 a bun, 4 curls, 5 a cap, 6 none
    hair: hairR < 0.22 ? 0 : hairR < 0.38 ? 1 : hairR < 0.6 ? 2 : hairR < 0.72 ? 3 : hairR < 0.84 ? 4 : hairR < 0.94 ? 5 : 6,
    hairC: pickOf(HAIR, seed, 4),
    legs: pickOf(LEGS, seed, 5),
    skirt: hash(seed, 6) < 0.2,
    w: 0.9 + hash(seed, 7) * 0.26,
    h: 0.93 + hash(seed, 8) * 0.14,
    bag: hash(seed, 9) < 0.18 ? 1 : hash(seed, 9) < 0.3 ? 2 : 0,
    bagC: pickOf(BAGS, seed, 10),
    hat: o.hat ?? null,
  }
}

/** Ovals at the points, as one path. */
const dots = (pts: [number, number][], rx: number, ry = rx) => pts.map(([x, y]) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`).join('')
const el = (g: N, tag: string, a: Record<string, string | number | undefined>) => g.add(new N(tag, a))
const line = (c: string) => ({ stroke: INK, 'stroke-width': 1.05, 'stroke-linejoin': 'round' as const })

/**
 * Draw someone into `g`, feet at its origin, in their own units (scale it
 * with the group). Walking, their legs are the walker's to move (leg-a, leg-b).
 */
export function drawFolk(g: N, p: Folk, shirt: string, pose: FolkPose = 'stand', walking = false) {
  const w = p.w
  const lit = mix(shirt, '#ffffff', 0.24), dim = shade(shirt, 0.8)
  // Their shadow on the ground, thrown away from the sun.
  el(g, 'ellipse', { cx: -1.8, cy: 0.5, rx: 5.4 * w, ry: 1.9, fill: INK, opacity: 0.15 })
  // A backpack, behind them.
  if (p.bag === 2) el(g, 'rect', { x: f(-5.6 * w), y: -14.6, width: f(3 * w), height: 7, rx: 1.4, fill: p.bagC, ...line(p.bagC) })
  // Legs: trousers, or a skirt and bare legs; shoes.
  const legC = p.skirt ? shade(p.skin, 0.9) : p.legs, shoe = '#2a2730'
  const legs = el(g, 'g', { class: walking ? 'legs' : undefined, fill: 'none', stroke: legC, 'stroke-width': p.skirt ? 1.7 : 2.5, 'stroke-linecap': 'round' })
  const leg = (x: number) => `M${f(x * w)} -0.6v${p.skirt ? -5 : -7.6}`
  if (walking) for (const [x, cls] of [[-1.7, 'leg-a'], [1.7, 'leg-b']] as [number, string][]) el(legs, 'path', { d: leg(x), class: cls })
  else {
    el(legs, 'path', { d: leg(-1.7) + leg(1.7) })
    el(g, 'path', { d: dots([[-1.7 * w + 0.4, -0.2], [1.7 * w + 0.4, -0.2]], 1.5, 0.85), fill: shoe })
  }
  if (p.skirt) el(g, 'path', { d: `M${f(-3.4 * w)} -8.2L${f(3.4 * w)} -8.2L${f(4.4 * w)} -4.4L${f(-4.4 * w)} -4.4Z`, fill: p.legs, ...line(p.legs) })
  // The body: the shirt, lit on its right and in shade on its left.
  const x0 = -3.7 * w, x1 = 3.7 * w
  el(g, 'rect', { x: f(x0), y: -15.6, width: f(x1 - x0), height: 9.2, rx: 2.7, fill: shirt, ...line(shirt) })
  el(g, 'path', { d: `M${f(x1 - 0.6)} -14.2v6.4q0 0.9 -0.9 0.9h-${f(1.5 * w)}v-8.6q1.6 0 2.4 1.3z`, fill: lit, opacity: 0.85 })
  el(g, 'path', { d: `M${f(x0 + 0.6)} -14.2v6.4q0 0.9 0.9 0.9h${f(1.4 * w)}v-8.6q-1.5 0 -2.3 1.3z`, fill: dim, opacity: 0.8 })
  // Arms, and hands.
  const arms = el(g, 'g', { fill: 'none', stroke: shade(shirt, 0.9), 'stroke-width': 2, 'stroke-linecap': 'round' })
  const left = `M${f(x0 - 0.1)} -14l-0.9 5.4`
  if (pose === 'wave') {
    el(arms, 'path', { d: left })
    el(arms, 'path', { d: `M${f(x1 - 0.2)} -13.6l3.6 -5.6`, class: 'wave-arm' })
    el(g, 'path', { d: dots([[x0 - 1, -8.2]], 1.05), fill: p.skin })
  } else if (pose === 'phone') {
    el(arms, 'path', { d: `${left}M${f(x1)} -14l0.4 3.4l-2.6 0.6` })
    el(g, 'path', { d: dots([[x0 - 1, -8.2]], 1.05), fill: p.skin })
    el(g, 'rect', { x: f(x1 - 4.2), y: -13.6, width: 2.2, height: 3.2, rx: 0.5, fill: '#252a3d' })
    el(g, 'rect', { x: f(x1 - 3.8), y: -13.2, width: 1.4, height: 1.6, fill: '#9fd4ff' })
  } else {
    el(arms, 'path', { d: `${left}M${f(x1 + 0.1)} -14l0.9 5.4` })
    el(g, 'path', { d: dots([[x0 - 1, -8.2], [x1 + 1, -8.2]], 1.05), fill: p.skin })
  }
  // A bag on a strap, across them.
  if (p.bag === 1) {
    el(g, 'path', { d: `M${f(x0 + 1.2)} -15.2L${f(x1 + 0.2)} -9`, stroke: shade(p.bagC, 0.7), 'stroke-width': 0.8, fill: 'none' })
    el(g, 'rect', { x: f(x1 - 0.6), y: -10, width: 3.2, height: 3, rx: 0.8, fill: p.bagC, ...line(p.bagC) })
  }
  // Long hair falls behind the head.
  if (p.hair === 2) el(g, 'rect', { x: -4.4, y: -23.4, width: 8.8, height: 9.4, rx: 3.6, fill: p.hairC, ...line(p.hairC) })
  // The head, and a face.
  el(g, 'circle', { cx: 0, cy: -19.4, r: 3.8, fill: p.skin, ...line(p.skin) })
  el(g, 'path', { d: dots([[-0.9, -19.4], [1.5, -19.4]], 0.48), fill: '#2a2730' })
  // Their hair, or a cap.
  const cap = p.hat ?? (p.hair === 5 ? shade(shirt, 0.75) : null)
  const top = `M-3.95 -19.6a3.95 3.95 0 0 1 7.9 0`
  if (cap) {
    el(g, 'path', { d: `${top}q-1.6 -1.1 -3.95 -1.1q-2.3 0 -3.95 1.1z`, fill: cap, ...line(cap) })
    el(g, 'path', { d: `M1.6 -20.6l4.4 0.6`, stroke: shade(cap, 0.7), 'stroke-width': 1.3, 'stroke-linecap': 'round', fill: 'none' })
  } else if (p.hair === 4) {
    el(g, 'path', { d: dots([[-2.6, -21.4], [-0.6, -22.9], [1.6, -22.6], [3, -20.8], [-3.4, -19.4]], 1.75), fill: p.hairC, ...line(p.hairC) })
  } else if (p.hair !== 6) {
    el(g, 'path', { d: `${top}q-1.2 -0.4 -2.6 -1.4q-1 1.3 -5.3 1.4z`, fill: p.hairC, ...line(p.hairC) })
    if (p.hair === 1) el(g, 'path', { d: `M-3.6 -20.2q2.2 -3.2 6.4 -2.4q-2.4 0.4 -3.6 2.2z`, fill: p.hairC })
    if (p.hair === 3) el(g, 'circle', { cx: 0.8, cy: -23.9, r: 1.9, fill: p.hairC, ...line(p.hairC) })
  } else el(g, 'path', { d: `M0.6 -22.2q1.3 -0.3 2.1 0.5`, stroke: '#ffffff', 'stroke-width': 0.7, opacity: 0.6, 'stroke-linecap': 'round', fill: 'none' })
}

/**
 * A dog, at the origin (its feet), facing right: a body, a head, ears, legs
 * and a tail, in one of a few coats; on a lead to a hand at (hx, hy), if given.
 */
export function drawDog(g: N, seed: number, lead?: [number, number]) {
  const coat = pickOf(['#8c6e5a', '#2f2b2e', '#d9d1c4', '#a77b5a', '#6b6670'], seed, 11)
  const dark = shade(coat, 0.72)
  el(g, 'ellipse', { cx: -0.6, cy: 0.4, rx: 4.6, ry: 1.3, fill: INK, opacity: 0.14 })
  for (const x of [-2.6, -1.2, 1.4, 2.6]) el(g, 'path', { d: `M${x} -0.2v-2.6`, stroke: x < 0 ? dark : coat, 'stroke-width': 1.2, 'stroke-linecap': 'round', fill: 'none' })
  el(g, 'path', { d: `M-3.4 -4.6q-1.8 -1.8 -1.2 -3.4`, stroke: coat, 'stroke-width': 1.1, 'stroke-linecap': 'round', fill: 'none' })
  el(g, 'rect', { x: -3.6, y: -5.6, width: 7, height: 3.4, rx: 1.7, fill: coat, ...line(coat) })
  el(g, 'circle', { cx: 3.8, cy: -6.4, r: 2, fill: coat, ...line(coat) })
  el(g, 'ellipse', { cx: 5.4, cy: -5.9, rx: 1.1, ry: 0.8, fill: coat, ...line(coat) })
  el(g, 'path', { d: 'M2.6 -7.6q-0.6 1.6 0.4 2.6', stroke: dark, 'stroke-width': 1.1, 'stroke-linecap': 'round', fill: 'none' })
  el(g, 'circle', { cx: 6.3, cy: -6, r: 0.45, fill: '#1e1c26' })
  if (lead) el(g, 'path', { d: `M3 -4.6Q${f((lead[0] + 3) / 2)} ${f(lead[1] / 2 + 1)} ${f(lead[0])} ${f(lead[1])}`, stroke: '#a14f5c', 'stroke-width': 0.7, fill: 'none' })
}

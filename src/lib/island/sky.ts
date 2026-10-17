/**
 * Tiny Island — things in the air: hot-air balloons drifting over, and a
 * little plane towing a banner across. Both are drawn at the origin of their
 * own group and moved by a CSS keyframe path (motionPath in kit.ts).
 */
import { C, INK, OUT, N, shade, motionPath } from './kit'
import { creatureUse } from './actors'
import { folk, drawBust } from './folk'

const f = (v: number) => Math.round(v * 10) / 10

/**
 * The things in the sky are above the night's veil, so they would stay in
 * daylight. They are dimmed by a shade of the veil's own blue over their
 * silhouette, shown only after dark. (A CSS brightness filter did the same
 * and took the map from 36 frames a second to 13: a filter on something
 * moving is drawn again, filter and all, every frame.)
 */
const nightDim = (d: string) => new N('path', { d, class: 'night-dim', fill: '#111a58', opacity: 0.42 })

/** A striped balloon with a basket and two people in it, drifting round a slow loop. */
export function hotAirBalloon(x: number, y: number, a: string, b: string, name: string, dur: number, delay: number): N {
  const pts: [number, number][] = []
  for (let k = 0; k < 16; k++) { const t = (k / 16) * Math.PI * 2; pts.push([x + Math.cos(t) * 90, y + Math.sin(t) * 30 + Math.sin(t * 2) * 10]) }
  motionPath(name, pts, { closed: true })
  const g = new N('g', { class: 'mover amb hab', 'data-b': `${f(x - 140)} ${f(y - 140)} ${f(x + 140)} ${f(y + 80)}`, style: `animation:${name} ${dur}s linear infinite ${f(-delay)}s` })
  const bob = g.add(new N('g', { class: 'bob' }))
  // Its shadow is far below on the sea or the land; a soft one just under it reads better.
  const env = 'M-30 -56a30 32 0 1 1 60 0c0 17-12 26-19 33h-22c-7-7-19-16-19-33z'
  // Unity's (Creatures.cs), dimmed at night by the same veil.
  const real = creatureUse('balloon', a, 'stand', 'se', {}, b)
  if (real) { bob.add(real); bob.add(nightDim(`${env}M-13 -23h26v25h-26z`)); return g }
  bob.add(new N('path', { d: env, fill: a, stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }))
  // Gores: stripes down the envelope in the second colour.
  bob.add(new N('path', { d: 'M-10 -86q-12 30 -1 63h8q-8 -33 3 -63zM10 -86q12 30 1 63h-8q8 -33 -3 -63z', fill: b, opacity: 0.95 }))
  bob.add(new N('path', { d: env, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }))
  bob.add(new N('path', { d: 'M-22 -70q4 -14 14 -18', fill: 'none', stroke: '#ffffff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.6 }))
  bob.add(new N('path', { d: 'M-10 -23l-2 13M10 -23l2 13M-1 -23v13', stroke: INK, 'stroke-width': 1.1 }))
  bob.add(new N('path', { d: 'M-12 -10h24l-2 11h-20z', fill: C.wood, stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
  bob.add(new N('path', { d: 'M-11 -6h22', stroke: shade(C.wood, 0.75), 'stroke-width': 1 }))
  // Two passengers (folk.ts), heads and shoulders over the rim: drawn before it, so it hides the rest of them.
  for (const [px, c, seed] of [[-5, C.sky, 31.7], [5, C.rasp, 47.3]] as [number, string, number][]) {
    drawBust(bob.add(new N('g', { transform: `translate(${px} -5) scale(0.7)` })), folk(seed), c)
  }
  bob.add(nightDim(`${env}M-13 -23h26v25h-26z`))
  return g
}

/** A small plane towing a striped banner, crossing the whole sky now and then. */
export function plane(name: string): N {
  void name
  const g = new N('g', { class: 'isl-plane' })
  const body = g.add(new N('g'))
  // The banner first, trailing behind (to the left), on a towline.
  body.add(new N('path', { d: 'M-34 -2L-62 -2', stroke: INK, 'stroke-width': 1 }))
  const flag = body.add(new N('g', { class: 'tow' }))
  flag.add(new N('path', { d: 'M-62 -10h-86q6 8 0 16h86z', fill: '#ffffff', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }))
  for (const [x0, c] of [[-80, C.rasp], [-104, C.mint], [-128, C.cobalt]] as [number, string][]) flag.add(new N('path', { d: `M${x0} -10h-10v16h10z`, fill: c }))
  flag.add(new N('path', { d: 'M-62 -10h-86q6 8 0 16h86z', fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }))
  // The plane: Unity's, nose to the right.
  const real = creatureUse('plane', C.rasp, 'stand', 'e')
  if (real) {
    body.add(new N('g', { transform: 'translate(-4 -2)' })).add(real)
    body.add(nightDim('M-62 -11h-87q6 9 0 18h87zM-36 -12h64v22h-64z'))
    return g
  }
  body.add(new N('path', { d: 'M-34 -4q0 -6 10 -6h32q10 0 14 6q-4 6 -14 6h-32q-10 0 -10 -6z', fill: '#ffffff', stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
  body.add(new N('path', { d: 'M-30 -9l-6 -10h6l8 9z', fill: C.rasp, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
  body.add(new N('path', { d: 'M-8 -2l-10 14h7l13 -14z', fill: C.rasp, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
  body.add(new N('path', { d: 'M8 -8h8q4 0 6 3h-14z', fill: C.glassHi, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }))
  body.add(new N('path', { d: 'M23 -11v14', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round', class: 'prop' }))
  body.add(nightDim('M-62 -11h-87q6 9 0 18h87zM-35 -4q0 -7 11 -7h32q11 0 15 7q-4 7 -15 7h-32q-11 0 -11 -7zM-31 -9l-6 -11h7l9 10zM-8 -2l-11 15h8l14 -15z'))
  return g
}

/**
 * A flying saucer, hovering, its beam lifting a very surprised sheep. It
 * only comes at three in the morning.
 */
export function ufo(x: number, y: number, ground: number): N {
  const g = new N('g', { class: 'ufo' })
  const defs = g.add(new N('defs')).add(new N('linearGradient', { id: 'isl-ufo-beam', x1: 0, y1: 0, x2: 0, y2: 1 }))
  defs.add(new N('stop', { offset: 0, 'stop-color': '#d8f7ec', 'stop-opacity': 0.7 }))
  defs.add(new N('stop', { offset: 1, 'stop-color': '#d8f7ec', 'stop-opacity': 0.08 }))
  g.add(new N('ellipse', { cx: f(x), cy: f(ground), rx: 34, ry: 11, fill: '#d8f7ec', opacity: 0.35 }))
  g.add(new N('path', { d: `M${f(x - 12)} ${f(y + 4)}L${f(x - 34)} ${f(ground)}h68L${f(x + 12)} ${f(y + 4)}Z`, fill: 'url(#isl-ufo-beam)', class: 'ufo-beam' }))
  // The sheep, on its way up.
  const s = g.add(new N('g', { class: 'ufo-sheep' }))
  const sy = (y + ground) / 2 + 10
  s.add(new N('path', { d: `M${f(x - 7)} ${f(sy)}a4 4 0 0 1 3 -6a4 4 0 0 1 7 0a4 4 0 0 1 4 6z`, fill: '#ffffff', stroke: INK, 'stroke-width': 1 }))
  s.add(new N('ellipse', { cx: f(x + 8), cy: f(sy - 3), rx: 2.6, ry: 2.2, fill: INK }))
  s.add(new N('path', { d: `M${f(x - 4)} ${f(sy)}v3M${f(x + 3)} ${f(sy)}v3`, stroke: INK, 'stroke-width': 1.2, 'stroke-linecap': 'round' }))
  const bob = g.add(new N('g', { class: 'bob' }))
  bob.add(new N('path', { d: `M${f(x - 11)} ${f(y - 4)}a11 10 0 0 1 22 0z`, fill: C.glassHi, stroke: INK, 'stroke-width': OUT }))
  bob.add(new N('path', { d: `M${f(x - 6)} ${f(y - 8)}q2 -4 6 -5`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }))
  bob.add(new N('ellipse', { cx: f(x), cy: f(y - 2), rx: 28, ry: 8, fill: '#c9d2ee', stroke: INK, 'stroke-width': OUT }))
  bob.add(new N('ellipse', { cx: f(x), cy: f(y + 1), rx: 14, ry: 3.6, fill: '#9aa8d8', stroke: INK, 'stroke-width': 1 }))
  for (let k = 0; k < 6; k++) bob.add(new N('circle', { cx: f(x - 20 + k * 8), cy: f(y - 2 + (k === 0 || k === 5 ? -1 : 0.6)), r: 1.8, fill: [C.mint, C.rasp, '#ffffff'][k % 3], class: 'chase', style: `animation-delay:${k * 0.15}s` }))
  return g
}

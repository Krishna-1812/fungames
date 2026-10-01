/**
 * Tiny Island — things in the air: hot-air balloons drifting over, and a
 * little plane towing a banner across. Both are drawn at the origin of their
 * own group and moved by a CSS keyframe path (motionPath in kit.ts).
 */
import { C, INK, OUT, N, shade, motionPath } from './kit'

const f = (v: number) => Math.round(v * 10) / 10

/** A striped balloon with a basket and two people in it, drifting round a slow loop. */
export function hotAirBalloon(x: number, y: number, a: string, b: string, name: string, dur: number, delay: number): N {
  const pts: [number, number][] = []
  for (let k = 0; k < 16; k++) { const t = (k / 16) * Math.PI * 2; pts.push([x + Math.cos(t) * 90, y + Math.sin(t) * 30 + Math.sin(t * 2) * 10]) }
  motionPath(name, pts, { closed: true })
  const g = new N('g', { class: 'mover amb hab', 'data-b': `${f(x - 140)} ${f(y - 140)} ${f(x + 140)} ${f(y + 80)}`, style: `animation:${name} ${dur}s linear infinite ${f(-delay)}s` })
  const bob = g.add(new N('g', { class: 'bob' }))
  // Its shadow is far below on the sea or the land; a soft one just under it reads better.
  const env = 'M-30 -56a30 32 0 1 1 60 0c0 17-12 26-19 33h-22c-7-7-19-16-19-33z'
  bob.add(new N('path', { d: env, fill: a, stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }))
  // Gores: stripes down the envelope in the second colour.
  bob.add(new N('path', { d: 'M-10 -86q-12 30 -1 63h8q-8 -33 3 -63zM10 -86q12 30 1 63h-8q8 -33 -3 -63z', fill: b, opacity: 0.95 }))
  bob.add(new N('path', { d: env, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }))
  bob.add(new N('path', { d: 'M-22 -70q4 -14 14 -18', fill: 'none', stroke: '#ffffff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.6 }))
  bob.add(new N('path', { d: 'M-10 -23l-2 13M10 -23l2 13M-1 -23v13', stroke: INK, 'stroke-width': 1.1 }))
  bob.add(new N('path', { d: 'M-12 -10h24l-2 11h-20z', fill: C.wood, stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
  bob.add(new N('path', { d: 'M-11 -6h22', stroke: shade(C.wood, 0.75), 'stroke-width': 1 }))
  for (const [px, c] of [[-5, C.sky], [5, C.rasp]] as [number, string][]) {
    bob.add(new N('rect', { x: px - 2.6, y: -16, width: 5.2, height: 6, rx: 2, fill: c, stroke: INK, 'stroke-width': 1 }))
    bob.add(new N('circle', { cx: px, cy: -18.5, r: 2.6, fill: '#f1d9c6', stroke: INK, 'stroke-width': 1 }))
  }
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
  // The plane.
  body.add(new N('path', { d: 'M-34 -4q0 -6 10 -6h32q10 0 14 6q-4 6 -14 6h-32q-10 0 -10 -6z', fill: '#ffffff', stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
  body.add(new N('path', { d: 'M-30 -9l-6 -10h6l8 9z', fill: C.rasp, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
  body.add(new N('path', { d: 'M-8 -2l-10 14h7l13 -14z', fill: C.rasp, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
  body.add(new N('path', { d: 'M8 -8h8q4 0 6 3h-14z', fill: C.glassHi, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }))
  body.add(new N('path', { d: 'M23 -11v14', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round', class: 'prop' }))
  return g
}

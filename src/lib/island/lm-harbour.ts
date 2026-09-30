/** The Harbour: the deep, the shore, the waves and the signals. */
import { C, INK, N, OUT, shade, r1 as f, type Landmark, type Pen } from './kit'
import { person, crate, barrel, tree, flag, lamp } from './props'

const planks = (p: Pen, x: number, y: number, w: number, d: number, z: number, along: 'x' | 'y') => {
  const b = p.box(x, y, w, d, 4, { z0: z, fill: '#b3acd9', sw: 1.2 })
  const n = Math.round((along === 'x' ? w : d) / 0.12)
  for (let k = 1; k < n; k++) {
    const t = k / n
    if (along === 'x') p.line([x + w * t, y, z + 4], [x + w * t, y + d, z + 4], { sw: 0.7, stroke: shade('#b3acd9', 0.78) })
    else p.line([x, y + d * t, z + 4], [x + w, y + d * t, z + 4], { sw: 0.7, stroke: shade('#b3acd9', 0.78) })
  }
  return b
}

export const harbour: Record<string, Landmark> = {
  'deep-sea': { size: [2, 2], water: true, draw(p) {
    // The trench: the one dark patch of sea on the map.
    p.disc(1.35, 1.3, 0.78, -12, '#4d6fd6', { sw: 0, op: 0.6 })
    p.disc(1.35, 1.3, 0.5, -12, '#2c3f9e', { sw: 0, op: 0.7 })
    p.disc(1.35, 1.3, 0.24, -12, '#1b2a70', { sw: 0, op: 0.8 })
    for (const [x, y, d] of [[1.0, 1.6, 0], [1.7, 1.0, 1.8]] as const) {
      const [fx, fy] = p.at(x, y, -12)
      p.el('path', { d: `M${f(fx - 7)} ${f(fy)}q7 -5 14 0q-7 5 -14 0zM${f(fx + 7)} ${f(fy)}l5 -3v6z`, fill: '#8f9bd0', opacity: 0.8, class: 'swim', style: `animation-delay:${d}s` })
    }
    for (const [x, y] of [[0.08, 0.45], [0.08, 0.95], [1.12, 0.45], [1.12, 0.95], [0.6, 0.45], [0.6, 0.95]] as const) p.line([x, y, -14], [x, y, 6], { sw: 3.5, stroke: C.wood })
    planks(p, 0, 0.4, 1.25, 0.6, 4, 'x')
    // A lattice crane.
    const cx = 0.35, cy = 0.7
    p.line([cx - 0.06, cy, 8], [cx - 0.06, cy, 84], { sw: 2.2 }); p.line([cx + 0.06, cy, 8], [cx + 0.06, cy, 84], { sw: 2.2 })
    for (let z = 12; z < 84; z += 12) p.line([cx - 0.06, cy, z], [cx + 0.06, cy, z + 12], { sw: 1 })
    p.box(cx - 0.12, cy - 0.12, 0.24, 0.24, 12, { z0: 70, fill: C.rasp })
    p.line([cx, cy, 86], [1.35, 1.3, 84], { sw: 3 }); p.line([cx, cy, 86], [-0.25, 0.3, 80], { sw: 3 })
    p.box(-0.35, 0.2, 0.2, 0.2, 10, { z0: 70, fill: C.slate })
    p.line([cx, cy, 104], [1.35, 1.3, 86], { sw: 1 }); p.line([cx, cy, 82], [cx, cy, 104], { sw: 1.8 })
    const drop = p.group('ds-drop')
    drop.line([1.35, 1.3, 84], [1.35, 1.3, 26], { sw: 1.3 })
    drop.sphere(1.35, 1.3, 18, 14, '#ffffff')
    const [bx, by] = p.at(1.35, 1.3, 18)
    drop.el('circle', { cx: bx + 3, cy: by + 1, r: 5.5, fill: C.glass, stroke: INK, 'stroke-width': 1.6 })
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; drop.el('circle', { cx: bx + Math.cos(a) * 11, cy: by + Math.sin(a) * 11, r: 1, fill: INK }) }
    for (let k = 0; k < 5; k++) { const [x, y] = p.at(1.35 + (k - 2) * 0.1, 1.3, -4); p.el('circle', { cx: x, cy: y, r: 2.5 + (k % 2), fill: 'none', stroke: '#ffffff', 'stroke-width': 1.4, class: 'bubble', style: `animation-delay:${k * 0.55}s` }) }
    // A buoy and a diving flag.
    const buoy = p.group('bob')
    buoy.cyl(1.85, 0.4, 0.08, -6, 12, C.rasp, { bands: [[3, 6, '#ffffff']] })
    flag(p.move(0, 0, 8), 1.1, 0.5, 0, C.cobalt, 18)
    crate(p.move(0, 0, 8), 0.8, 0.8); barrel(p.move(0, 0, 8), 0.95, 0.55, C.mint)
    person(p.move(0, 0, 8), 0.7, 0.55, C.rasp, { hat: '#ffffff' })
  } },

  'ambient-mix': { size: [2, 2], draw(p) {
    p.cyl(1, 1, 0.64, 0, 5, '#ffffff', { bands: [[1, 2.5, C.lilac]] })
    const posts: [number, number][] = Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2 + 0.5; return [1 + Math.cos(a) * 0.55, 1 + Math.sin(a) * 0.55] })
    const back = posts.filter(([x, y]) => x + y < 2), front = posts.filter(([x, y]) => x + y >= 2)
    for (const [x, y] of back) p.line([x, y, 5], [x, y, 38], { sw: 3.2 })
    p.box(0.86, 0.86, 0.28, 0.28, 16, { z0: 5, fill: C.slate })
    const [sx, sy] = p.at(1, 1.14, 13)
    p.el('circle', { cx: sx - 3, cy: sy, r: 3.5, fill: '#1b2340', stroke: '#8f9bd0', 'stroke-width': 1 })
    for (let k = 0; k < 3; k++) p.el('circle', { cx: sx, cy: sy, r: 10, fill: 'none', stroke: C.lilac, 'stroke-width': 2, class: 'am-ring', style: `animation-delay:${k * 0.8}s` })
    for (const [x, y] of front) p.line([x, y, 5], [x, y, 38], { sw: 3.2 })
    p.cone(1, 1, 0.78, 38, 24, C.lilac)
    p.line([1, 1, 62], [1, 1, 72], { sw: 1.5 })
    const [fx, fy] = p.at(1, 1, 72); p.path(`M${f(fx)} ${f(fy)}l10 3l-10 4z`, C.mint, { sw: 1, cls: 'flutter' })
    // Its own rain cloud.
    const [cx, cy] = p.at(1, 1, 130)
    const cloud = p.group('drift')
    for (const [dx, dy, r] of [[-16, 0, 14], [4, -7, 17], [22, 2, 12], [-2, 5, 12]]) cloud.el('circle', { cx: cx + dx, cy: cy + dy, r, fill: '#e3e8f5', stroke: INK, 'stroke-width': OUT })
    cloud.el('ellipse', { cx: cx + 2, cy: cy + 6, rx: 26, ry: 8, fill: '#e3e8f5' })
    for (let k = 0; k < 9; k++) p.el('path', { d: `M${f(cx - 24 + k * 6)} ${f(cy + 18)}l-3 8`, stroke: C.cobalt, 'stroke-width': 1.8, 'stroke-linecap': 'round', class: 'rain', style: `animation-delay:${(k % 3) * 0.27}s` })
    p.grow(cx - 34, cy - 26, cx + 36, cy + 30)
    // The beach: an umbrella, two deckchairs, a towel and a ball.
    p.line([1.8, 0.3, 0], [1.8, 0.3, 30], { sw: 2 })
    p.cone(1.8, 0.3, 0.34, 26, 12, C.mint)
    const [ux, uy] = p.at(1.8, 0.3, 26)
    for (const a of [-0.6, 0.2]) p.path(`M${f(ux)} ${f(uy - 12)}L${f(ux + Math.cos(a) * 22)} ${f(uy + Math.sin(a) * 6)}`, 'none', { stroke: '#ffffff', sw: 3 })
    for (const x of [1.45, 1.75]) { p.poly([[x, 0.62, 3], [x + 0.18, 0.62, 3], [x + 0.18, 0.92, 3], [x, 0.92, 3]], C.rasp, { sw: 1 }); p.poly([[x, 0.92, 3], [x + 0.18, 0.92, 3], [x + 0.18, 0.98, 12], [x, 0.98, 12]], shade(C.rasp, 0.85), { sw: 1 }) }
    p.plane(0.2, 1.4, 0.5).add(new N('rect', { width: 0.34, height: 0.5, fill: C.sky, stroke: INK, 'stroke-width': 0.038 }))
    p.sphere(0.6, 1.85, 5, 5, C.rasp)
    person(p, 0.3, 0.5, C.cobalt, { pose: 'wave' })
  } },

  'share-this-page': { size: [2, 2], draw(p) {
    for (const [x, y, k] of [[0.6, 0.6, 1.3], [1.4, 0.7, 1.1], [0.7, 1.5, 1.2], [1.5, 1.5, 1]] as const) tree(p, x, y, 'rock', C.rock, k)
    // The keeper's cottage.
    const h = p.box(0.1, 0.2, 0.6, 0.55, 18, { fill: C.white })
    p.gable(0.1, 0.2, 0.6, 0.55, 18, 12, C.cobalt, 'x', { lines: 2 })
    p.windows(h, 'x', { cols: 1, z0: 6, h: 6, wide: 0.4 })
    p.door(h, 'y', 0.5, { w: 0.16, h: 11, fill: C.rasp })
    // The tower, tapering, in stripes.
    const [x, y] = p.at(1.1, 1.1, 2)
    const stripes: [number, number, string][] = [[0, 24, '#ffffff'], [24, 44, C.rasp], [44, 66, '#ffffff'], [66, 86, C.rasp]]
    const wAt = (z: number) => 17 - z * 0.075
    for (const [z1, z2, c] of stripes) p.path(`M${f(x - wAt(z1))} ${f(y - z1)}L${f(x - wAt(z2))} ${f(y - z2)}L${f(x + wAt(z2))} ${f(y - z2)}L${f(x + wAt(z1))} ${f(y - z1)}Z`, c, { sw: 1.4 })
    p.path(`M${f(x + 3)} ${f(y - 4)}L${f(x + 3)} ${f(y - 84)}`, 'none', { stroke: '#000', sw: 10, op: 0.06 })
    p.path(`M${f(x - 4)} ${f(y)}v-12a4 4 0 0 1 8 0v12`, C.slate, { sw: 1.2 })
    for (const z of [34, 56, 76]) p.path(`M${f(x - 2.5)} ${f(y - z)}h5v-6h-5z`, C.glass, { sw: 1 })
    // Gallery, lantern, cap.
    p.el('ellipse', { cx: x, cy: y - 88, rx: 19, ry: 6, fill: C.slate, stroke: INK, 'stroke-width': OUT })
    for (let k = -3; k <= 3; k++) p.path(`M${f(x + k * 5.5)} ${f(y - 86 + Math.abs(k))}v-8`, 'none', { sw: 1.2 })
    p.path(`M${f(x - 18)} ${f(y - 94)}a19 5 0 0 0 36 0`, 'none', { sw: 1.4 })
    const beam = p.group('stp-beam')
    beam.path(`M${f(x)} ${f(y - 102)}L${f(x + 190)} ${f(y - 140)}L${f(x + 190)} ${f(y - 72)}Z`, '#ffffff', { sw: 0, op: 0.65 })
    beam.path(`M${f(x)} ${f(y - 102)}L${f(x - 190)} ${f(y - 140)}L${f(x - 190)} ${f(y - 72)}Z`, '#ffffff', { sw: 0, op: 0.65 })
    p.el('rect', { x: x - 11, y: y - 112, width: 22, height: 20, rx: 3, fill: C.glass, stroke: INK, 'stroke-width': 2, class: 'stp-lamp' })
    p.lights.push([x, y - 102])
    p.path(`M${f(x - 4)} ${f(y - 108)}h8v12h-8z`, '#ffffff', { sw: 1, cls: 'stp-lamp' })
    p.path(`M${f(x - 14)} ${f(y - 112)}Q${f(x)} ${f(y - 132)} ${f(x + 14)} ${f(y - 112)}Z`, C.slate)
    p.path(`M${f(x)} ${f(y - 124)}v-10M${f(x - 6)} ${f(y - 130)}h12`, 'none', { sw: 1.4 })
    for (let k = 0; k < 3; k++) p.path(`M${f(x + 22 + k * 8)} ${f(y - 118 - k * 5)}q9 11 0 22`, 'none', { stroke: C.cobalt, sw: 2.4, cls: 'stp-arc', style: `animation-delay:${k * 0.3}s` })
    p.grow(x - 40, y - 140, x + 60, y)
    person(p, 0.9, 1.9, C.mint, { pose: 'wave' })
    lamp(p, 0.2, 1.0, 22)
  } },

  'paper-folds': { size: [2, 1], water: true, draw(p) {
    const b = p.group('bob')
    const [x, y] = b.at(1, 0.5, -6)
    b.el('ellipse', { cx: x, cy: y + 6, rx: 60, ry: 9, fill: '#ffffff', opacity: 0.4 })
    b.path(`M${f(x - 56)} ${f(y - 18)}L${f(x + 56)} ${f(y - 18)}L${f(x + 36)} ${f(y + 6)}L${f(x - 36)} ${f(y + 6)}Z`, '#ffffff')
    b.path(`M${f(x - 56)} ${f(y - 18)}L${f(x)} ${f(y - 5)}L${f(x + 56)} ${f(y - 18)}M${f(x)} ${f(y - 5)}L${f(x)} ${f(y + 6)}`, 'none', { sw: 1.2, stroke: '#9aa3c0' })
    b.path(`M${f(x - 30)} ${f(y - 18)}L${f(x)} ${f(y - 84)}L${f(x + 30)} ${f(y - 18)}Z`, '#f4f6fc')
    b.path(`M${f(x)} ${f(y - 84)}L${f(x + 30)} ${f(y - 18)}L${f(x + 8)} ${f(y - 18)}Z`, '#dfe4f5')
    b.path(`M${f(x)} ${f(y - 84)}L${f(x)} ${f(y - 18)}M${f(x - 16)} ${f(y - 50)}L${f(x)} ${f(y - 40)}`, 'none', { sw: 1, stroke: '#9aa3c0' })
    // The dotted line, forty-two folds up, to a moon.
    const [mx, my] = p.at(1.7, 0.1, 170)
    p.el('path', { d: `M${f(x + 4)} ${f(y - 90)}Q${f(x + 40)} ${f(y - 140)} ${f(mx - 10)} ${f(my + 6)}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-dasharray': '3 6' })
    p.circle(1.7, 0.1, 170, 11, '#ffffff')
    p.el('circle', { cx: mx + 3, cy: my - 2, r: 2.5, fill: '#dfe4f5' })
    // Two paper cranes on the wind.
    for (const [dx, dy, d] of [[-50, -110, 0], [-80, -80, 1.4]]) p.el('path', { d: `M${f(x + dx)} ${f(y + dy)}l8 -6l2 6l8 -2l-8 5z`, fill: '#ffffff', stroke: INK, 'stroke-width': 1.1, class: 'glide', style: `animation-delay:${d}s` })
    p.grow(x - 90, my - 14, x + 60, y + 10)
  } },
}

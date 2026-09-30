/** The Proving Grounds: tests of the actual you. */
import { C, INK, N, OUT, shade, r1 as f, motionPath, type Landmark } from './kit'
import { person, tree, lamp, fence, flag } from './props'


export const proving: Record<string, Landmark> = {
  trolley: { size: [3, 2], draw(p) {
    const g = p.plane(0, 0, 0)
    const main = 'M0 1.5L1.2 1.5', up = 'M1.2 1.5C1.8 1.5 2.1 0.6 3 0.55', down = 'M1.2 1.5L3 1.5'
    for (const d of [main, up, down]) {
      g.add(new N('path', { d, fill: 'none', stroke: '#b3acd9', 'stroke-width': 0.34, 'stroke-linecap': 'round' }))
      g.add(new N('path', { d, fill: 'none', stroke: shade('#b3acd9', 0.75), 'stroke-width': 0.344, 'stroke-dasharray': '0.06 0.16' }))
      g.add(new N('path', { d, fill: 'none', stroke: '#e3e8f7', 'stroke-width': 0.05, transform: 'translate(0 -0.05)' }))
      g.add(new N('path', { d, fill: 'none', stroke: '#e3e8f7', 'stroke-width': 0.05, transform: 'translate(0 0.05)' }))
    }
    p.grow(...p.at(0, 0), ...p.at(3, 2))
    const cart = g.add(new N('g', {}))
    cart.add(new N('rect', { x: -0.24, y: -0.15, width: 0.48, height: 0.3, rx: 0.05, fill: C.rasp, stroke: INK, 'stroke-width': 0.05 }))
    cart.add(new N('rect', { x: -0.14, y: -0.09, width: 0.2, height: 0.18, fill: '#ffffff', stroke: INK, 'stroke-width': 0.031 }))
    // Along the straight, then round the fork: a cubic, sampled.
    const pts: [number, number][] = [[0, 1.5], [0.6, 1.5], [1.2, 1.5]]
    for (let q = 1; q <= 10; q++) { const t = q / 10, u = 1 - t; pts.push([u ** 3 * 1.2 + 3 * u * u * t * 1.8 + 3 * u * t * t * 2.1 + t ** 3 * 3, u ** 3 * 1.5 + 3 * u * u * t * 1.5 + 3 * u * t * t * 0.6 + t ** 3 * 0.55]) }
    motionPath('tr-cart', pts, { rotate: true })
    cart.attrs.class = 'mover'; cart.attrs.style = 'animation:tr-cart 6s ease-in infinite'
    // The lever house at the fork, and its lever.
    const lh = p.box(1.05, 0.75, 0.32, 0.32, 16, { fill: C.white, trim: C.rasp })
    p.windows(lh, 'x', { cols: 1, z0: 6, h: 6, wide: 0.5 })
    p.gable(1.05, 0.75, 0.32, 0.32, 16, 8, C.rasp, 'y', { lines: 1 })
    p.line([1.25, 1.2, 0], [1.42, 1.1, 22], { sw: 3, cls: 'tr-lever' })
    p.circle(1.42, 1.1, 22, 3, C.rasp, { sw: 1.2 })
    // A signal: red, and a go light.
    p.line([0.5, 1.9, 0], [0.5, 1.9, 30], { sw: 2.2 })
    p.box(0.44, 1.84, 0.12, 0.12, 14, { z0: 22, fill: C.slate, sw: 1.2 })
    p.circle(0.5, 1.96, 31, 2.5, C.rasp, { sw: 0.8, cls: 'blink' }); p.circle(0.5, 1.96, 25, 2.5, C.mint, { sw: 0.8 })
    // Five on one track, one on the other.
    for (let k = 0; k < 5; k++) person(p, 2.35 + k * 0.12, 1.62, [C.lilac, C.sky, C.mint, C.cobalt, C.lilac][k], { k: 0.9 })
    person(p, 2.8, 0.66, C.rasp, { pose: 'wave', k: 0.9 })
    tree(p, 0.3, 0.3, 'round'); tree(p, 2.7, 1.95, 'bush')
  } },

  'not-a-robot': { size: [2, 2], draw(p) {
    // The checkbox, big enough to read from the other end of the island.
    p.line([0.35, 0.35, 0], [0.35, 0.35, 44], { sw: 2.6 }); p.line([0.95, 0.35, 0], [0.95, 0.35, 44], { sw: 2.6 })
    const [bx, by] = p.at(0.65, 0.35, 44)
    p.path(`M${f(bx - 46)} ${f(by - 36)}h92v36h-92z`, '#ffffff', { sw: 2.2 })
    p.path(`M${f(bx - 38)} ${f(by - 27)}h18v18h-18z`, '#ffffff', { sw: 2 })
    p.el('path', { d: `M${f(bx - 34)} ${f(by - 18)}l4.5 5.5l9 -11`, fill: 'none', stroke: '#11a887', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'nar-tick' })
    p.el('text', { x: bx + 12, y: by - 15, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 600, 'font-size': 8, fill: INK }).text("I'm not a robot")
    p.el('circle', { cx: bx + 36, cy: by - 26, r: 4, fill: 'none', stroke: C.cobalt, 'stroke-width': 1.4 })
    // The booth and its barrier.
    const bo = p.box(1.25, 0.2, 0.55, 0.55, 30, { fill: C.white, trim: C.cobalt })
    p.windows(bo, 'y', { cols: 1, z0: 12, h: 12, wide: 0.7 })
    p.windows(bo, 'x', { cols: 1, z0: 12, h: 12, wide: 0.7 })
    p.box(1.2, 0.15, 0.65, 0.65, 5, { z0: 30, fill: C.cobalt })
    person(p.move(0, 0, 0), 1.52, 0.5, C.slate, { hat: C.slate, k: 0.9 })
    p.box(1.2, 0.95, 0.12, 0.12, 20, { fill: C.stone2, sw: 1.2 })
    const [px, py] = p.at(1.26, 1.01, 17)
    const bar = p.group('nar-bar', { style: `transform-origin:${f(px)}px ${f(py)}px` })
    bar.path(`M${f(px)} ${f(py - 3)}l-92 14v7l92 -14z`, '#ffffff', { sw: 1.6 })
    for (let k = 0; k < 4; k++) bar.path(`M${f(px - 12 - k * 21)} ${f(py - 1 + (12 + k * 21) * 0.152)}l-10 1.5v6l10 -1.5z`, C.rasp, { sw: 0 })
    p.grow(px - 96, py - 50, px, py + 20)
    // Lights: stop and go.
    p.line([1.9, 1.1, 0], [1.9, 1.1, 30], { sw: 2.2 })
    p.box(1.84, 1.04, 0.12, 0.12, 14, { z0: 22, fill: C.slate, sw: 1.2 })
    p.circle(1.9, 1.16, 31, 2.5, C.rasp, { sw: 0.8, cls: 'nar-stop' }); p.circle(1.9, 1.16, 25, 2.5, C.mint, { sw: 0.8, cls: 'nar-go' })
    // The queue: a person, and a robot doing its best impression of one.
    person(p, 0.95, 1.55, C.mint)
    const [rx, ry] = p.at(0.6, 1.75)
    const r = p.group('robot')
    r.el('ellipse', { cx: rx, cy: ry + 1, rx: 8, ry: 3, fill: INK, opacity: 0.15 })
    r.path(`M${f(rx - 4)} ${f(ry)}v-8M${f(rx + 4)} ${f(ry)}v-8`, 'none', { sw: 2.6 })
    r.path(`M${f(rx - 10)} ${f(ry - 30)}h20v22h-20z`, C.sky, { sw: 1.8 })
    r.path(`M${f(rx - 6)} ${f(ry - 22)}h12v6h-12z`, '#ffffff', { sw: 1 })
    r.path(`M${f(rx - 8)} ${f(ry - 46)}h16v14h-16z`, '#dfe4f5', { sw: 1.8 })
    r.path(`M${f(rx)} ${f(ry - 46)}v-7`, 'none', { sw: 1.6 })
    r.el('circle', { cx: rx, cy: ry - 54, r: 2.6, fill: C.rasp, class: 'blink' })
    r.el('circle', { cx: rx - 3.5, cy: ry - 40, r: 1.8, fill: INK }); r.el('circle', { cx: rx + 3.5, cy: ry - 40, r: 1.8, fill: INK })
    r.path(`M${f(rx - 3)} ${f(ry - 35)}h6`, 'none', { sw: 1.2 })
    r.path(`M${f(rx + 10)} ${f(ry - 26)}l6 -6`, 'none', { sw: 2.2, cls: 'wave-arm' })
    lamp(p, 0.1, 1.9)
    void OUT
  } },

  'steady-hand': { size: [3, 1], draw(p) {
    // A safety net that nobody trusts.
    const net = p.plane(0.3, 0.3, 14)
    net.add(new N('rect', { width: 2.4, height: 0.4, fill: '#ffffff', 'fill-opacity': 0.4, stroke: INK, 'stroke-width': 0.038 }))
    for (let k = 1; k < 12; k++) net.add(new N('line', { x1: k * 0.2, y1: 0, x2: k * 0.2, y2: 0.4, stroke: INK, 'stroke-width': 0.6, opacity: 0.5 }))
    p.grow(...p.at(0.3, 0.3, 14), ...p.at(2.7, 0.7, 14))
    for (const x of [0.2, 2.8]) {
      p.cyl(x, 0.5, 0.1, 0, 76, '#ffffff', { bands: [[20, 26, C.rasp], [48, 54, C.rasp]] })
      p.box(x - 0.16, 0.34, 0.32, 0.32, 3, { z0: 72, fill: C.wood, sw: 1.2 })
      const [sx, sy] = p.at(x, 0.5, 80); p.path(`M${f(sx - 8)} ${f(sy)}l8 -12l8 12z`, C.rasp)
      for (let z = 8; z < 72; z += 9) p.line([x + 0.12, 0.62, z], [x + 0.12, 0.38, z], { sw: 1 })
    }
    p.line([0.2, 0.5, 76], [2.8, 0.5, 76], { sw: 2 })
    const [wx, wy] = p.at(1.5, 0.5, 76)
    const walker = p.group('sh-walk', { style: `transform-origin:${f(wx)}px ${f(wy)}px` })
    walker.path(`M${f(wx - 34)} ${f(wy - 20)}q34 -6 68 0`, 'none', { sw: 2.4 })
    walker.el('circle', { cx: wx - 34, cy: wy - 20, r: 2.2, fill: C.rasp }); walker.el('circle', { cx: wx + 34, cy: wy - 20, r: 2.2, fill: C.rasp })
    walker.path(`M${f(wx)} ${f(wy - 30)}v-2M${f(wx)} ${f(wy - 8)}l-5 8M${f(wx)} ${f(wy - 8)}l5 8`, 'none', { sw: 2.4 })
    walker.path(`M${f(wx - 4)} ${f(wy - 30)}h8v22h-8z`, C.mint, { sw: 1.4 })
    walker.el('circle', { cx: wx, cy: wy - 35, r: 5, fill: '#f1d9c6', stroke: INK, 'stroke-width': 1.3 })
    p.grow(wx - 50, wy - 50, wx + 50, wy)
    // A crowd holding its breath.
    for (let k = 0; k < 4; k++) person(p, 0.9 + k * 0.35, 0.98, [C.sky, C.lilac, C.rasp, C.cobalt][k], { pose: k === 1 ? 'wave' : 'look' })
    flag(p, 2.8, 0.5, 80, C.mint, 16)
    void fence; void tree
  } },
}

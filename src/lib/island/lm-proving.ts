/** The Proving Grounds: tests of the actual you. */
import { C, INK, N, OUT, shade, r1 as f, motionPath, letter, type Landmark } from './kit'
import { person, tree, lamp, fence, flag } from './props'
import { actorUse, creatureUse, who } from './actors'


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
    // A border checkpoint for humans: a lane, a canopy, a booth, a barrier,
    // and at the front of the queue a robot in a hat and a stuck-on moustache.
    tree(p, 1.85, 0.22, 'round', C.leaf, 0.85)
    const lane = p.plane(0, 0.75, 0)
    lane.add(new N('rect', { width: 2, height: 0.62, fill: '#cfd3e6', stroke: INK, 'stroke-width': 0.031 }))
    lane.add(new N('path', { d: 'M0.08 0.04H1.92M0.08 0.58H1.92', stroke: '#ffffff', 'stroke-width': 0.03 }))
    lane.add(new N('rect', { x: 1.12, y: 0.06, width: 0.06, height: 0.5, fill: '#ffffff' }))
    lane.add(new N('text', { x: 1.32, y: 0.31, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 0.16, fill: '#ffffff', transform: 'rotate(-90 1.32 0.31)' })).text('STOP')
    p.grow(...p.at(0, 0.75), ...p.at(2, 1.37))
    for (const x of [0.16, 0.86]) p.box(x - 0.04, 0.6, 0.08, 0.08, 34, { fill: '#e3e8f7', sw: 1.1 })
    // The booth, and the officer with a clipboard.
    const bo = p.box(1.12, 0.12, 0.46, 0.44, 26, { fill: C.white, trim: C.cobalt })
    p.windows(bo, 'y', { cols: 1, z0: 9, h: 11, wide: 0.7 })
    p.windows(bo, 'x', { cols: 1, z0: 9, h: 11, wide: 0.6 })
    p.box(1.08, 0.08, 0.54, 0.52, 3, { z0: 26, fill: C.cobalt })
    const [ox, oy] = p.at(1.76, 0.5)
    person(p, 1.76, 0.5, C.slate, { hat: C.slate })
    p.el('rect', { x: ox + 2.5, y: oy - 14, width: 5, height: 6.5, rx: 0.8, fill: '#ffffff', stroke: INK, 'stroke-width': 1, transform: `rotate(12 ${f(ox + 5)} ${f(oy - 11)})` })
    // The barrier, from its post by the booth across the lane.
    p.box(1.0, 0.6, 0.1, 0.1, 15, { fill: C.stone2, sw: 1.1 })
    const [px, py] = p.at(1.05, 0.65, 13)
    const [ex, ey] = p.at(1.05, 1.42, 13)
    const bar = p.group('nar-bar', { style: `transform-origin:${f(px)}px ${f(py)}px` })
    bar.path(`M${f(px)} ${f(py)}L${f(ex)} ${f(ey)}`, 'none', { sw: 4.6 })
    bar.path(`M${f(px)} ${f(py)}L${f(ex)} ${f(ey)}`, 'none', { sw: 2.8, stroke: '#ffffff' })
    bar.el('path', { d: `M${f(px)} ${f(py)}L${f(ex)} ${f(ey)}`, stroke: C.rasp, 'stroke-width': 2.8, 'stroke-dasharray': '4 4', fill: 'none' })
    p.grow(ex - 4, py - 40, px + 4, ey + 4)
    // The queue: a robot doing its best impression of a person, and a person.
    const [rx, ry] = p.at(1.4, 1.04)
    const r = p.group('robot')
    const bot = creatureUse('robot', '#8ccbff', 'stand', 'se', { transform: `translate(${f(rx)} ${f(ry)})` })
    if (bot) r.g.add(bot)
    else {
    r.el('ellipse', { cx: rx, cy: ry + 0.5, rx: 6, ry: 2.2, fill: INK, opacity: 0.15 })
    r.path(`M${f(rx - 2.5)} ${f(ry)}v-5M${f(rx + 2.5)} ${f(ry)}v-5`, 'none', { sw: 2 })
    r.path(`M${f(rx - 6)} ${f(ry - 15)}h12v10h-12z`, C.sky, { sw: 1.3 })
    r.path(`M${f(rx - 3.5)} ${f(ry - 12)}h7v3.5h-7z`, '#ffffff', { sw: 0.8 })
    r.path(`M${f(rx - 5)} ${f(ry - 24)}h10v8.5h-10z`, '#dfe4f5', { sw: 1.3 })
    r.el('circle', { cx: rx - 2.2, cy: ry - 21, r: 1.2, fill: INK }); r.el('circle', { cx: rx + 2.2, cy: ry - 21, r: 1.2, fill: INK })
    r.path(`M${f(rx - 3.4)} ${f(ry - 18.2)}q1.7 -1.6 3.4 0q1.7 -1.6 3.4 0`, 'none', { sw: 1.3 })
    r.path(`M${f(rx - 5.6)} ${f(ry - 24.5)}a5.6 4 0 0 1 11.2 0z`, C.slate, { sw: 1 })
    r.path(`M${f(rx - 7.5)} ${f(ry - 24.5)}h15`, 'none', { sw: 1.4 })
    r.path(`M${f(rx + 6)} ${f(ry - 13)}l4 -4`, 'none', { sw: 1.6, cls: 'wave-arm' })
    }
    p.grow(rx - 9, ry - 30, rx + 11, ry + 2)
    person(p, 1.8, 0.98, C.mint)
    // The front posts, then the canopy, its name painted round the fascia.
    for (const x of [0.16, 0.86]) p.box(x - 0.04, 1.38, 0.08, 0.08, 34, { fill: '#e3e8f7', sw: 1.1 })
    const cn = p.box(0.06, 0.52, 0.88, 1.02, 9, { z0: 34, fill: C.white, top: '#f4f6fc' })
    p.band(cn, 0.6, 8.4, C.cobalt)
    p.poly([[0.12, 0.6, 43], [0.88, 0.6, 43], [0.88, 1.46, 43], [0.12, 1.46, 43]], '#e9edf8', { sw: 0.8 })
    const fx = p.face(cn, 'x', 0.5, 2.6, { w: 36, h: 8 })
    letter(fx, 0, 0, 'HUMANS ONLY', { size: 5, fill: '#ffffff', ls: 0.3 })
    const fy = p.face(cn, 'y', 0.5, 2.4, { w: 28, h: 8 })
    fy.add(new N('rect', { x: -12, y: -5, width: 5, height: 5, rx: 0.9, fill: '#ffffff', stroke: INK, 'stroke-width': 0.7 }))
    fy.add(new N('path', { d: 'M-11 -2.6l1.3 1.5l2.6 -3.2', fill: 'none', stroke: '#11a887', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'nar-tick' }))
    letter(fy, 2.6, -0.2, 'HUMAN', { size: 4.8, fill: '#ffffff', ls: 0.3 })
    // Stop and go, facing the queue.
    p.line([1.1, 1.5, 0], [1.1, 1.5, 30], { sw: 2.2 })
    p.box(1.04, 1.44, 0.12, 0.12, 14, { z0: 22, fill: C.slate, sw: 1.2 })
    p.circle(1.16, 1.5, 31, 2.4, C.rasp, { sw: 0.8, cls: 'nar-stop' }); p.circle(1.16, 1.5, 25.5, 2.4, C.mint, { sw: 0.8, cls: 'nar-go' })
    lamp(p, 1.9, 1.9)
  } },

  'steady-hand': { size: [3, 1], draw(p) {
    // A safety net that nobody trusts.
    const net = p.plane(0.3, 0.3, 14)
    net.add(new N('rect', { width: 2.4, height: 0.4, fill: '#ffffff', 'fill-opacity': 0.4, stroke: INK, 'stroke-width': 0.038 }))
    for (let k = 1; k < 12; k++) net.add(new N('line', { x1: k * 0.2, y1: 0, x2: k * 0.2, y2: 0.4, stroke: INK, 'stroke-width': 0.02, opacity: 0.5 }))
    for (let k = 1; k < 4; k++) net.add(new N('line', { x1: 0, y1: k * 0.1, x2: 2.4, y2: k * 0.1, stroke: INK, 'stroke-width': 0.02, opacity: 0.5 }))
    p.grow(...p.at(0.3, 0.3, 14), ...p.at(2.7, 0.7, 14))
    for (const [x, y] of [[0.3, 0.3], [2.7, 0.3], [0.3, 0.7], [2.7, 0.7]] as const) p.line([x, y, 0], [x, y, 14], { sw: 1.2 })
    // Two towers: striped masts, a platform and rail on each, a ladder up.
    for (const x of [0.2, 2.8]) {
      p.cyl(x, 0.5, 0.09, 0, 72, '#ffffff', { bands: [[18, 24, C.rasp], [42, 48, C.rasp]] })
      for (let z = 6; z < 72; z += 7) p.line([x + 0.12, 0.62, z], [x + 0.12, 0.42, z], { sw: 0.9 })
      p.line([x + 0.12, 0.62, 0], [x + 0.12, 0.62, 72], { sw: 1 }); p.line([x + 0.12, 0.42, 0], [x + 0.12, 0.42, 72], { sw: 1 })
      p.box(x - 0.18, 0.32, 0.36, 0.36, 3, { z0: 72, fill: C.wood, sw: 1.2 })
      for (const [a, b] of [[[x - 0.18, 0.68], [x + 0.18, 0.68]], [[x + 0.18, 0.32], [x + 0.18, 0.68]]] as const) {
        p.line([a[0], a[1], 75], [a[0], a[1], 84], { sw: 1 }); p.line([b[0], b[1], 75], [b[0], b[1], 84], { sw: 1 })
        p.line([a[0], a[1], 84], [b[0], b[1], 84], { sw: 1.3 })
      }
    }
    p.line([0.2, 0.5, 78], [2.8, 0.5, 78], { sw: 1.8 })
    // The walker, the same size as everyone watching, with a long pole.
    const [wx, wy] = p.at(1.5, 0.5, 78)
    const walker = p.group('sh-walk', { style: `transform-origin:${f(wx)}px ${f(wy)}px` })
    const funambulist = actorUse(who(C.mint, 4.21, { hat: C.rasp }), 'balance', 'se', 0, { transform: `translate(${f(wx)} ${f(wy)})` })
    if (funambulist) {
      // Unity's walker, arms out, and the long pole across them, its weighted ends.
      walker.el('path', { d: `M${f(wx - 26)} ${f(wy - 9)}q26 -5 52 0`, fill: 'none', stroke: '#5b5157', 'stroke-width': 0.8, 'stroke-linecap': 'round' })
      walker.el('circle', { cx: wx - 26, cy: wy - 9, r: 1.4, fill: '#c64c66' }); walker.el('circle', { cx: wx + 26, cy: wy - 9, r: 1.4, fill: '#c64c66' })
      walker.g.add(funambulist)
    } else {
    walker.path(`M${f(wx - 26)} ${f(wy - 9)}q26 -5 52 0`, 'none', { sw: 1.6 })
    walker.el('circle', { cx: wx - 26, cy: wy - 9, r: 1.6, fill: C.rasp }); walker.el('circle', { cx: wx + 26, cy: wy - 9, r: 1.6, fill: C.rasp })
    walker.path(`M${f(wx - 1.8)} ${f(wy)}l0.6 -6M${f(wx + 1.8)} ${f(wy)}l-0.6 -6`, 'none', { sw: 2 })
    walker.path(`M${f(wx - 3.4)} ${f(wy - 14)}h6.8v8.5h-6.8z`, C.mint, { sw: 1.2 })
    walker.path(`M${f(wx - 3)} ${f(wy - 12)}l-6 2.5M${f(wx + 3)} ${f(wy - 12)}l6 2.5`, 'none', { sw: 1.5 })
    walker.el('circle', { cx: wx, cy: wy - 17.5, r: 3.4, fill: '#f1d9c6', stroke: INK, 'stroke-width': 1.2 })
    walker.path(`M${f(wx - 3.6)} ${f(wy - 18.5)}a3.6 3.2 0 0 1 7.2 0z`, C.rasp, { sw: 1 })
    }
    p.grow(wx - 50, wy - 30, wx + 50, wy)
    // A crowd holding its breath.
    for (let k = 0; k < 4; k++) person(p, 0.9 + k * 0.35, 0.98, [C.sky, C.lilac, C.rasp, C.cobalt][k], { pose: k === 1 ? 'wave' : 'look' })
    flag(p, 2.8, 0.5, 84, C.mint, 14)
    void fence; void tree
  } },
}

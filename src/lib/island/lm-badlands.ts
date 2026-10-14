/** The Badlands: impacts, quakes, deep time and the elements. */
import { C, INK, N, OUT, P, shade, mix, ballShade, puffShade, r1 as f, type Landmark, type Pen } from './kit'
import { person, crate, barrel, tree, flag } from './props'

export const badlands: Record<string, Landmark> = {
  asteroid: { size: [2, 2], draw(p) {
    // The crater: a raised rim, a scorched floor, a glowing heart.
    p.disc(1.1, 1.05, 0.9, 0, '#b3acd9')
    p.disc(1.1, 1.05, 0.72, 2, '#c9c3e8', { sw: 1.2 })
    p.disc(1.1, 1.05, 0.58, 0, '#7d74b8')
    p.disc(1.1, 1.05, 0.36, 0, '#5b528f', { sw: 1.2 })
    p.disc(1.1, 1.05, 0.14, 0, C.rasp, { sw: 1, cls: 'pulse' })
    const ring = p.plane(1.1, 1.05, 0); ring.add(new N('circle', { r: 0.55, fill: 'none', stroke: p.real ? '#d9535f' : C.rasp, 'stroke-width': p.real ? 0.045 : 0.094, opacity: p.real ? 0.75 : undefined, class: 'ast-ring' }))
    for (const [x, y] of [[0.3, 0.4], [1.9, 0.5], [1.8, 1.8], [0.5, 1.85]] as const) tree(p, x, y, 'rock', C.rock, 0.7)
    const [cx, cy] = p.at(1.1, 1.05)
    const m = p.group('ast-meteor')
    const trail = m.el('defs')
    for (const [id, c] of [['ast-tail', C.rasp], ['ast-core', '#ffffff']] as const) {
      const lg = trail.add(new N('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: f(cx - 6), y1: f(cy - 5), x2: f(cx - 76), y2: f(cy - 104) }))
      lg.add(new N('stop', { offset: 0, 'stop-color': c, 'stop-opacity': 0.75 }))
      lg.add(new N('stop', { offset: 1, 'stop-color': c, 'stop-opacity': 0 }))
    }
    m.path(`M${f(cx - 6)} ${f(cy - 5)}L${f(cx - 80)} ${f(cy - 100)}L${f(cx - 64)} ${f(cy - 108)}Z`, 'url(#ast-tail)', { sw: 0 })
    m.path(`M${f(cx - 4)} ${f(cy - 4)}L${f(cx - 50)} ${f(cy - 66)}L${f(cx - 42)} ${f(cy - 70)}Z`, 'url(#ast-core)', { sw: 0 })
    m.path(`M${f(cx - 10)} ${f(cy - 2)}l3 -9l9 -3l8 5l1 9l-7 6l-10 -1z`, m.real ? ballShade(trail, 'ast-rock', '#6d6a86') : C.rockDark, { sw: m.real ? 0 : 2 })
    // The launch rail and its control hut.
    const hut = p.box(0.05, 1.4, 0.45, 0.45, 16, { fill: C.white, trim: C.rasp })
    p.windows(hut, 'x', { cols: 1, z0: 6, h: 6, wide: 0.5 })
    p.line([0.28, 1.62, 16], [0.28, 1.62, 30], { sw: 1.5 })
    p.circle(0.28, 1.62, 31, 2.5, C.rasp, { cls: 'blink' })
    p.line([0.6, 0.35, 0], [0.25, 0.1, 44], { sw: 5 })
    p.line([0.6, 0.35, 0], [0.25, 0.1, 44], { sw: 2, stroke: C.stone })
    p.line([0.55, 0.45, 0], [0.55, 0.45, 20], { sw: 2.5 })
    p.sign(1.9, 1.95, 16, 38, 11, '#ffffff', 'IMPACT ZONE', { size: 5.5, ink: C.rasp })
    p.line([1.9, 1.95, 0], [1.9, 1.95, 16], { sw: 1.8 })
    person(p, 0.75, 1.8, C.mint, { hat: '#ffffff', pose: 'look' })
  } },

  'days-since-incident': { size: [2, 2], draw(p) {
    const q = p.group('dsi-quake')
    const w = q.box(0.1, 0.35, 1.75, 1.3, 30, { fill: '#e3e8f7' })
    for (let k = 1; k < 12; k++) q.quad(w, 'y', k / 12 - 0.004, k / 12 + 0.004, 1, 29, '#b9c0d8', { sw: 0 })
    for (let k = 1; k < 9; k++) q.quad(w, 'x', k / 9 - 0.005, k / 9 + 0.005, 1, 29, '#c9cfe6', { sw: 0 })
    q.gable(0.1, 0.35, 1.75, 1.3, 30, 16, '#9fb1e6', 'x', { lines: 4 })
    // A roller door on the side.
    q.quad(w, 'x', 0.25, 0.75, 0, 20, '#8f9bd0', { sw: 1.2 })
    for (let k = 1; k < 6; k++) q.quad(w, 'x', 0.25, 0.75, k * 3.4, k * 3.4 + 0.6, '#6f7cb8', { sw: 0 })
    // The sign.
    const [sx, sy] = q.at(0.95, 1.65, 7)
    const g = q.group()
    // Unity's board (a plaque on short posts): white, a red band across its head, the dark display; the words the page's.
    const art = new N('g')
    art.add(new N('rect', { x: 0, y: 0, width: 88, height: 38, rx: 3, fill: '#ffffff' }))
    art.add(new N('path', { d: 'M0 3a3 3 0 0 1 3 -3h82a3 3 0 0 1 3 3v8h-88z', fill: C.rasp }))
    art.add(new N('rect', { x: 28, y: 14, width: 32, height: 20, rx: 2, fill: '#1b2340' }))
    art.add(new N('rect', { x: 29.5, y: 15.5, width: 29, height: 17, rx: 1.2, fill: '#141a33' }))
    g.plaque('dsi-board', 0.95, 1.65, 7, 88, 38, art, { foot: 0, edge: '#e3e8f7' }, () => {
      g.el('rect', { x: sx - 44, y: sy - 38, width: 88, height: 38, rx: 3, fill: '#ffffff', stroke: INK, 'stroke-width': 2.2 })
      g.el('rect', { x: sx - 44, y: sy - 38, width: 88, height: 11, rx: 3, fill: C.rasp, stroke: INK, 'stroke-width': 1.8 })
    })
    g.el('text', { x: sx, y: sy - 30, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 6.6, fill: '#fff' }).text('DAYS SINCE LAST INCIDENT')
    if (!g.real) g.el('rect', { x: sx - 16, y: sy - 24, width: 32, height: 20, rx: 2, fill: '#1b2340', stroke: INK, 'stroke-width': 1.2 })
    g.el('text', { x: sx, y: sy - 8, 'text-anchor': 'middle', 'font-family': 'Silkscreen, monospace', 'font-size': 16, fill: C.rasp, class: 'dsi-count' }).text('0')
    q.grow(sx - 46, sy - 40, sx + 46, sy)
    // The seismograph mast and dish.
    p.line([1.9, 0.3, 0], [1.9, 0.3, 90], { sw: 2.4 })
    for (let k = 0; k < 6; k++) p.line([1.84, 0.3, k * 15], [1.96, 0.3, k * 15 + 15], { sw: 1 })
    const [dx, dy] = p.at(1.9, 0.3, 90)
    // The dish (Unity's: Models.cs, Dish), turned up to the sky, and what it hears, going out.
    p.model('dish', [1.9, 0.3, 90], { r: 16 }, () => {
      p.path(`M${f(dx - 16)} ${f(dy - 6)}q16 18 32 0z`, C.white)
      p.path(`M${f(dx)} ${f(dy)}l0 -10`, 'none', { sw: 1.6 })
    })
    p.path(`M${f(dx + 2)} ${f(dy - 14)}q6 -6 12 0M${f(dx - 2)} ${f(dy - 20)}q11 -11 22 0`, 'none', { stroke: p.real ? '#ffb8c3' : C.rasp, sw: p.real ? 0.8 : 2, op: p.real ? 0.6 : undefined, cls: 'blink' })
    // Out front: the drum still scribbling.
    const tb = p.box(1.35, 1.75, 0.4, 0.2, 8, { fill: C.stone })
    const [px, py] = p.at(1.55, 1.85, 8)
    p.path(`M${f(px - 10)} ${f(py - 4)}l3 -3l3 5l3 -8l3 9l3 -4l3 2`, 'none', { sw: 1.2, stroke: C.rasp, cls: 'quiver' })
    crate(p, 0.2, 1.85); crate(p, 0.38, 1.9); barrel(p, 0.3, 1.7, C.cobalt)
    person(p, 1.2, 1.9, C.lilac, { hat: '#ffffff' })
    void tb
  } },

  'deep-time': { size: [2, 2], draw(p) {
    const layers = ['#4e4684', '#6b62a8', '#8a80c2', '#a9a1d6', '#9fb1e6', '#c9c3e8', '#dcd6f2']
    layers.forEach((c, k) => p.box(0.05, 0.05, 1.9, 1.9, 11, { z0: k * 11, fill: c, top: k === layers.length - 1 ? '#62e8c9' : c, sw: 1.2 }))
    const top = layers.length * 11
    for (const [x, y] of [[0.4, 0.5], [1.3, 0.3], [1.5, 1.4]] as const) tree(p.move(0, 0, top), x, y, 'bush', C.leaf, 0.8)
    // The dinosaur, in the front face, a third of the way down.
    const [fx, fy] = p.at(1, 1.95, 30)
    const b = p.group('dt-fossil')
    // On the realistic island, bone set in the rock: a pale fossil-grey, lit as the face it is in.
    const bone = p.real ? '#d9d3e6' : '#ffffff', op = p.real ? 0.82 : undefined
    b.path(`M${f(fx - 36)} ${f(fy + 4)}q14 -4 24 -14q14 -12 30 -6q10 4 18 -2`, 'none', { stroke: bone, sw: p.real ? 2.6 : 3, op })
    for (let k = 0; k < 6; k++) b.path(`M${f(fx - 10 + k * 6)} ${f(fy - 12 + Math.abs(k - 2.5) * 1.5)}l-2 ${f(12 - Math.abs(k - 2.5) * 1.6)}`, 'none', { stroke: bone, sw: p.real ? 1.8 : 2.2, op })
    b.path(`M${f(fx + 36)} ${f(fy - 12)}l8 -3l5 3l-2 5l-8 1z`, 'none', { stroke: bone, sw: p.real ? 1.8 : 2.2, op })
    b.path(`M${f(fx - 4)} ${f(fy - 2)}l-4 12M${f(fx + 18)} ${f(fy - 4)}l2 12`, 'none', { stroke: bone, sw: p.real ? 1.8 : 2.2, op })
    // An ammonite on the other face (in the shade: darker).
    const [ax, ay] = p.at(1.95, 0.9, 20)
    p.path(`M${f(ax)} ${f(ay)}m-7 0a7 7 0 1 1 7 7a5 5 0 1 1 -5 -5a3 3 0 1 1 3 3`, 'none', { stroke: p.real ? '#c2bbd6' : '#ffffff', sw: p.real ? 1.5 : 1.8, op })
    // A ladder down the side, and someone at work up top.
    p.line([1.95, 1.45, 0], [1.95, 1.45, top], { sw: 1.6 })
    p.line([1.95, 1.6, 0], [1.95, 1.6, top], { sw: 1.6 })
    for (let z = 6; z < top; z += 8) p.line([1.95, 1.45, z], [1.95, 1.6, z], { sw: 1.2 })
    person(p.move(0, 0, top), 1, 1.3, C.rasp, { hat: '#ffffff', pose: 'wave' })
    flag(p.move(0, 0, top), 0.3, 1.5, 0, C.mint)
    // A survey marker on two stakes: how far down the line is.
    for (const dx of [-0.12, 0.12]) p.line([0.35 + dx, 2.3 - dx, 0], [0.35 + dx, 2.3 - dx, 10], { sw: 1.6, stroke: C.wood })
    p.sign(0.35, 2.3, 8, 36, 12, '#ffffff', '66 MYA', { size: 7 })
  } },

  fusion: { size: [2, 2], draw(p) {
    const orbs: [number, number, string, string][] = [[0.22, 0.22, C.sky, 'water'], [1.78, 0.22, '#ffffff', 'air'], [0.22, 1.78, '#a49dcf', 'earth'], [1.78, 1.78, C.rasp, 'fire']]
    // Each orb's sign, painted on it (on the realistic island, paint on a lit ball: off-white, no outline).
    const paint = p.real ? '#eef0f6' : '#ffffff', gsw = p.real ? 0 : 1, gop = p.real ? 0.9 : undefined
    const glyph = (x: number, y: number, kind: string) => {
      if (kind === 'water') p.path(`M${f(x)} ${f(y - 5)}q5 6 0 9q-5 -3 0 -9z`, paint, { sw: gsw, op: gop })
      if (kind === 'fire') p.path(`M${f(x)} ${f(y - 6)}q6 5 2 10q-2 -3 -3 0q-5 -5 1 -10z`, paint, { sw: gsw, op: gop })
      if (kind === 'air') p.path(`M${f(x - 5)} ${f(y - 2)}h7a2.5 2.5 0 1 0 -2.5 -2.5M${f(x - 5)} ${f(y + 2)}h9`, 'none', { sw: 1.4, stroke: p.real ? '#eef0f6' : undefined, op: gop })
      if (kind === 'earth') p.path(`M${f(x - 5)} ${f(y + 3)}l3 -6l3 3l2 -4l3 7z`, paint, { sw: gsw, op: gop })
    }
    const orb = ([x, y, c, k]: [number, number, string, string]) => {
      p.cyl(x, y, 0.13, 0, 14, C.stone, { bands: [[10, 12, C.lilac]] })
      p.sphere(x, y, 27, 11, c)
      const [gx, gy] = p.at(x, y, 27); glyph(gx, gy, k)
    }
    for (const o of orbs.slice(0, 2)) { p.line([o[0], o[1], 22], [1, 1, 44], { sw: 4.5 }); p.line([o[0], o[1], 22], [1, 1, 44], { sw: 2, stroke: o[2] }) }
    orbs.slice(0, 2).forEach(orb)
    p.cyl(1, 1, 0.44, 0, 62, '#c9cde0', { bands: [[20, 23, C.lilac], [44, 47, C.lilac]] })
    const [wx, wy] = p.at(1, 1, 0)
    for (const z of [14, 34]) p.path(p.real ? `M${f(wx - 1.2)} ${f(wy + 10 - z)}v-9h2.4v9z` : `M${f(wx - 3)} ${f(wy + 10 - z)}v-9h6v9z`, p.real ? '#1d2230' : '#2c355e', { sw: p.real ? 0 : 1 })
    p.path(`M${f(wx - 6)} ${f(wy + 20)}v-12a6 6 0 0 1 12 0v12`, p.real ? '#5a4a40' : C.slate, { sw: p.real ? 0 : 1.2 })
    // Battlements, then the cauldron.
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.box(1 + Math.cos(a) * 0.36 - 0.05, 1 + Math.sin(a) * 0.36 - 0.05, 0.1, 0.1, 6, { z0: 62, fill: '#c9cde0', sw: 1 }) }
    p.cyl(1, 1, 0.26, 62, 12, C.slate, { top: C.mint })
    const [x, y] = p.at(1, 1, 76)
    // Puffs of steam, each tinted: soft, without edges, on the realistic island.
    const defs = p.real ? p.el('defs') : null
    for (let k = 0; k < 5; k++) {
      const col = [C.mint, C.lilac, C.sky, C.rasp, '#ffffff'][k]
      p.el('circle', defs ? { cx: x - 12 + k * 6, cy: y, r: 7.5, fill: puffShade(defs, `fu-puff${k}`, mix(col, '#ffffff', 0.45), 0.85), class: 'puff', style: `animation-delay:${k * 0.55}s` } : { cx: x - 12 + k * 6, cy: y, r: 5, fill: col, stroke: INK, 'stroke-width': 1, class: 'puff', style: `animation-delay:${k * 0.55}s` })
    }
    p.grow(x - 30, y - 60, x + 30, y)
    for (const o of orbs.slice(2)) { p.line([o[0], o[1], 22], [1, 1, 30], { sw: 4.5 }); p.line([o[0], o[1], 22], [1, 1, 30], { sw: 2, stroke: o[2] }) }
    orbs.slice(2).forEach(orb)
    person(p, 1.5, 1.95, C.lilac, { hat: C.lilac, pose: 'wave' })
    void P; void OUT; void shade
  } },
}

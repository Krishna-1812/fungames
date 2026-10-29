/** Old Town: people and time — lives, weeks, days, births and rules. */
import { C, INK, N, OUT, shade, r1 as f, letter, type Landmark } from './kit'
import { creatureUse } from './actors'
import { folk } from './folk'
import { bustAt } from './town'
import { person, tree, flag, lamp, flowers, bench, fence } from './props'

export const town: Record<string, Landmark> = {
  'who-was-alive': { size: [2, 2], draw(p) {
    const hall = p.box(0.1, 0.55, 1.8, 1.25, 30, { fill: '#f1f3fa', trim: C.lilac })
    p.gable(0.1, 0.55, 1.8, 1.25, 30, 16, C.lilac, 'x', { lines: 3 })
    // Portraits in the windows, one face each.
    for (let k = 0; k < 4; k++) {
      const u = (k + 0.5) / 4
      p.quad(hall, 'y', u - 0.08, u + 0.08, 8, 24, '#fff7ea', { sw: 1.4 })
      p.quad(hall, 'y', u - 0.065, u + 0.065, 10, 22, ['#b8a1ff', '#8ccbff', '#4fe3c1', '#ffb3c2'][k], { sw: 0.8 })
      // A portrait in each: painted, and printed on the canvas by Unity (kit.ts, decal).
      const at: [number, number, number, number] = [-3.9, -12, 3.9, 0]
      p.decal(`portrait-${k}`, hall, 'y', u, 10, at)
      const pf = p.face(hall, 'y', u, 10, { w: 8, h: 12 })
      // (On the flat island the painting stays as it was drawn, a face at the window; this, unseen, is only for the print.)
      if (!p.real) pf.attrs.opacity = 0
      const bg = ['#8f84b8', '#7d9cc0', '#6aa894', '#c98f9c'][k], skin = ['#f1d9c6', '#d3a27f', '#e8c4a8', '#a8714e'][k], hair = ['#3a2a22', '#1f1a18', '#a8774a', '#2a2020'][k], coat = ['#2c3350', '#5b4a3c', '#3d4a3a', '#4a3346'][k]
      pf.add(new N('rect', { x: -3.9, y: -12, width: 7.8, height: 12, fill: bg }))
      pf.add(new N('path', { d: 'M-3.9 0v-2.6q0.8 -2.6 3.9 -3q3.1 0.4 3.9 3v2.6z', fill: coat }))
      pf.add(new N('ellipse', { cx: 0, cy: -7.4, rx: 1.75, ry: 2.2, fill: skin }))
      pf.add(new N('path', { d: k % 2 ? 'M-1.9 -7.6q-0.2 -3 1.9 -3q2.1 0 1.9 3q-0.6 -1.6 -1.9 -1.7q-1.3 0.1 -1.9 1.7z' : 'M-2 -6.4q-0.6 -4.2 2 -4.3q2.6 0.1 2 4.3q-0.4 -2.6 -2 -2.7q-1.6 0.1 -2 2.7z', fill: hair }))
      pf.add(new N('rect', { x: -3.9, y: -12, width: 7.8, height: 12, fill: 'none', stroke: '#6b5034', 'stroke-width': 0.5 }))
      p.printFace(pf, `portrait-${k}`, at)
      if (!p.real) {
        const [fx, fy] = p.at(0.1 + 1.8 * u, 1.8, 17)
        // Someone looking out (folk.ts): head and shoulders at the glass.
        p.el('g').add(bustAt(fx, fy + 12.2, 0.68, folk(k * 9.7 + 3.1), ['#3f5a8c', '#7a5a8c', '#4f7d68', '#8c5a64'][k]))
      }
    }
    p.door(hall, 'x', 0.5, { w: 0.3, h: 18, fill: C.lilac })
    // The clock tower, whose face is a year.
    const tw = p.box(0.2, 0.1, 0.56, 0.56, 92, { fill: C.white, trim: C.cobalt })
    p.windows(tw, 'x', { rows: 3, cols: 1, z0: 10, h: 9, gap: 10, wide: 0.35 })
    p.box(0.16, 0.06, 0.64, 0.64, 6, { z0: 92, fill: C.stone })
    p.pyramid(0.16, 0.06, 0.64, 0.64, 98, 26, C.cobalt)
    flag(p.move(0, 0, 124), 0.48, 0.38, 0, C.rasp, 14)
    const [cx, cy] = p.at(0.48, 0.66, 74)
    p.path(`M${f(cx - 20)} ${f(cy - 13)}h40v17h-40z`, '#2c355e', { sw: 1.8 })
    for (let k = 1; k < 4; k++) p.path(`M${f(cx - 20 + k * 10)} ${f(cy - 13)}v17`, 'none', { sw: 0.8, stroke: '#4a5690' })
    p.el('text', { x: cx, y: cy + 0.5, 'text-anchor': 'middle', 'font-family': 'Silkscreen, monospace', 'font-size': 11.5, fill: C.mint, 'letter-spacing': 1.2, class: 'wwa-year' }).text('1564')
    person(p, 1.3, 1.95, C.rasp); person(p, 1.5, 1.95, C.cobalt, { pose: 'look' })
    lamp(p, 1.9, 0.4)
  } },

  'life-in-weeks': { size: [2, 2], draw(p) {
    fence(p, [[0.05, 0.05], [1.95, 0.05]], 6); fence(p, [[0.05, 0.05], [0.05, 1.95]], 6)
    const g = p.plane(0.15, 0.15, 0)
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const k = r * 8 + c
      g.add(new N('rect', p.real
        // A raised bed: crops, or soil waiting (the page turns them over as the weeks pass: data-on, data-off).
        ? { x: c * 0.21, y: r * 0.21, width: 0.17, height: 0.17, rx: 0.012, fill: k < 38 ? '#5d8f4a' : '#7a6e72', stroke: '#9c8f86', 'stroke-width': 0.016, class: 'liw-cell', 'data-k': k, 'data-on': '#5d8f4a', 'data-off': '#7a6e72' }
        : { x: c * 0.21, y: r * 0.21, width: 0.17, height: 0.17, rx: 0.02, fill: k < 38 ? '#5fe0bf' : '#e8e1f5', stroke: INK, 'stroke-width': 0.031, class: 'liw-cell', 'data-k': k }))
      // Its rows: furrows across it, darker, whatever grows there.
      if (p.real) { let d = ''; for (let q = 1; q < 5; q++) d += `M${f(c * 0.21 + 0.015)} ${f(r * 0.21 + q * 0.034)}h0.14`; g.add(new N('path', { d, stroke: '#2f2a2c', 'stroke-width': 0.009, opacity: 0.35 })) }
    }
    // Sprouts on a few of the planted weeks.
    for (let k = 0; k < 14; k++) {
      const c = (k * 3) % 8, r = Math.floor((k * 5) / 8) % 5
      const [x, y] = p.at(0.15 + c * 0.21 + 0.085, 0.15 + r * 0.21 + 0.085)
      p.el('path', { d: `M${f(x)} ${f(y)}v-5m0 2q-4 -1 -4 -4m4 2q4 -1 4 -4`, fill: 'none', stroke: C.leaf2, 'stroke-width': 1.3, 'stroke-linecap': 'round' })
    }
    // A shed, a scarecrow, a watering can.
    const sh = p.box(1.55, 1.55, 0.4, 0.4, 16, { fill: C.wood })
    p.gable(1.55, 1.55, 0.4, 0.4, 16, 8, C.rasp, 'x', { lines: 1 })
    p.door(sh, 'y', 0.5, { w: 0.14, h: 11, fill: shade(C.wood, 0.7) })
    const [sx, sy] = p.at(1.05, 1.05)
    p.model('scarecrow', [1.05, 1.05, 0], { fill: C.cobalt, top: C.lilac }, () => {
      p.path(`M${f(sx)} ${f(sy)}v-30M${f(sx - 11)} ${f(sy - 21)}h22`, 'none', { sw: 2.2, stroke: C.wood })
      p.path(`M${f(sx - 5)} ${f(sy - 24)}h10v11h-10z`, C.cobalt, { sw: 1.2 })
      p.el('circle', { cx: sx, cy: sy - 29, r: 4.5, fill: '#f4f6fc', stroke: INK, 'stroke-width': 1.2 })
      p.path(`M${f(sx - 8)} ${f(sy - 32)}h16l-3 -5h-10z`, C.lilac, { sw: 1.1 })
    })
    const [wx, wy] = p.at(0.3, 1.8)
    p.model('can', [0.3, 1.8, 0], { fill: C.sky }, () => p.path(`M${f(wx - 5)} ${f(wy)}v-7h9v7zM${f(wx + 4)} ${f(wy - 5)}l7 -5`, C.sky, { sw: 1.2 }))
    person(p, 1.35, 1.85, C.mint, { hat: '#ffffff' })
  } },

  'day-go': { size: [2, 2], draw(p) {
    const slices: [number, number, string][] = [[0, 8, C.lilac], [8, 17, C.cobalt], [17, 20, C.sky], [20, 24, C.mint]]
    // A sundial plaza: Unity's (Props8.cs, Sundial), the day's parts inlaid in coloured stone, a bronze ring of hours.
    p.model('sundial', [1, 1, 0], { r: 0.95, pts: slices.flatMap(([a0, a1]) => [a0, a1, 0]), colours: ['#8f86bf', '#5f74b5', '#86aed6', '#6cb59f'] }, () => null)
    const g = p.plane(1, 1, 0)
    if (!p.real) for (const [a0, a1, c] of slices) {
      const t0 = (a0 / 24) * Math.PI * 2 - Math.PI / 2, t1 = (a1 / 24) * Math.PI * 2 - Math.PI / 2, r = 0.88
      g.add(new N('path', { d: `M0 0L${f(Math.cos(t0) * r * 100) / 100} ${f(Math.sin(t0) * r * 100) / 100}A${r} ${r} 0 ${a1 - a0 > 12 ? 1 : 0} 1 ${f(Math.cos(t1) * r * 100) / 100} ${f(Math.sin(t1) * r * 100) / 100}Z`, fill: c, stroke: INK, 'stroke-width': 0.044 }))
    }
    if (!p.real) g.add(new N('circle', { r: 0.95, fill: 'none', stroke: INK, 'stroke-width': 0.063 }))
    if (!p.real) g.add(new N('circle', { r: 0.92, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.05, 'stroke-dasharray': '0.03 0.25' }))
    const sh = g.add(new N('g', { class: 'dg-shadow' }))
    // The gnomon's shadow, going round with the hour: on the realistic island, soft-edged and the sky's blue.
    sh.add(new N('path', { d: p.real ? 'M0 0L0.06 -0.84L0 -0.86L-0.06 -0.84Z' : 'M0 0L0.1 -0.82L-0.1 -0.82Z', fill: p.real ? '#1d2848' : INK, opacity: p.real ? 0.42 : 0.5 }))
    p.grow(...p.at(0, 0), ...p.at(2, 2))
    p.cyl(1, 1, 0.1, 0, 4, C.stone)
    p.poly([[1, 0.88, 4], [1, 1.12, 4], [1, 1, 34]], '#ffffff')
    p.poly([[1, 1, 34], [1, 1.12, 4], [1.04, 1.08, 4]], shade('#ffffff', 0.8), { sw: 1 })
    bench(p, 0.15, 1.0, 'y'); bench(p, 1.85, 1.0, 'y')
    person(p, 1.6, 1.85, C.rasp, { pose: 'look' }); person(p, 0.3, 0.4, C.sky)
    lamp(p, 0.15, 1.85, 24)
  } },

  'every-second': { size: [2, 2], draw(p) {
    // A terrace of three tall houses, front gables to the street, where a
    // window lights up every time someone is born; a stork brings another.
    const houses: [number, number, string, string][] = [[0.14, 30, C.rasp, '#ffffff'], [0.7, 38, C.cobalt, '#f4f1ff'], [1.26, 32, C.lilac, '#eef6ff']]
    const y0 = 0.22, d = 0.82, w = 0.56
    houses.forEach(([x, h, roof, wall], k) => {
      const b = p.box(x, y0, w, d, h, { fill: wall, trim: shade(roof, 1.25) })
      p.windows(b, 'y', { cols: 2, z0: h - 13, h: 8, wide: 0.42, cls: 'es-win', pane: '#e3e8f7' })
      p.windows(b, 'y', { cols: 2, z0: 5, h: 8, wide: 0.3, cls: 'es-win', pane: '#e3e8f7' })
      p.door(b, 'y', 0.5, { w: 0.13, h: 13, fill: shade(roof, 0.9) })
      if (k === houses.length - 1) {
        p.windows(b, 'x', { cols: 3, z0: h - 13, h: 8, wide: 0.38, cls: 'es-win', pane: '#e3e8f7' })
        p.windows(b, 'x', { cols: 3, z0: 5, h: 8, wide: 0.38, cls: 'es-win', pane: '#e3e8f7' })
      }
      p.gable(x, y0, w, d, h, 15, roof, 'y', { lines: 2, over: 0.015 })
      p.box(x + 0.36, y0 + 0.14, 0.09, 0.09, 12, { z0: h + 6, fill: C.stone2, sw: 1 })
    })
    // The stork's nest on the tallest chimney, and the stork coming home.
    const [nx, ny] = p.at(1.11, 0.4, 56)
    // Unity's nest of sticks, the stork standing in it (Props8.cs, Nest).
    p.model('nest', [1.105, 0.405, 56], {}, () => {
      p.el('ellipse', { cx: nx, cy: ny, rx: 7, ry: 3, fill: C.wood, stroke: INK, 'stroke-width': 1.1 })
      p.path(`M${f(nx - 3)} ${f(ny - 2)}q3 -5 7 -1q-2 3 -7 1zM${f(nx + 3)} ${f(ny - 4)}l2 -7l4 1`, '#ffffff', { sw: 1 })
    })
    const [sx, sy] = p.at(1.7, 0.1, 104)
    const st = p.group('glide')
    // Its mate coming home with another: Unity's (Creatures8.cs), wings spread.
    const flier = creatureUse('stork', '#ffffff', 'stand', 'w', { transform: `translate(${f(sx)} ${f(sy)})` })
    if (flier) st.g.add(flier)
    else {
    st.path(`M${f(sx - 14)} ${f(sy - 6)}q7 -2 14 4q7 -6 14 -4q-8 3 -12 8h-4q-4 -5 -12 -8z`, '#ffffff', { sw: 1.1 })
    st.path(`M${f(sx + 2)} ${f(sy + 1)}l9 -3l3 1`, 'none', { sw: 1, stroke: C.rasp })
    st.path(`M${f(sx - 1)} ${f(sy + 2)}v6`, 'none', { sw: 0.8 })
    st.path(`M${f(sx - 5)} ${f(sy + 8)}q4 -3 8 0q1 5 -4 6q-5 -1 -4 -6z`, '#ffe1e8', { sw: 1 })
    }
    p.grow(sx - 16, sy - 12, sx + 16, sy + 16)
    // Front gardens behind a picket fence, gaps for the gates.
    for (const [a, b] of [[0.14, 0.32], [0.52, 0.88], [1.08, 1.44], [1.64, 1.82]] as const) fence(p, [[a, 1.6], [b, 1.6]], 6, '#ffffff')
    flowers(p, 0.3, 1.3); flowers(p, 1.62, 1.32, [C.sky, '#ffffff', C.lilac])
    // A pram, parked.
    const [qx, qy] = p.at(1.0, 1.36)
    p.model('pram', [1.0, 1.36, 0], { fill: C.sky }, () => {
    p.path(`M${f(qx - 6)} ${f(qy - 6)}h11a6 6 0 0 1 -11 -6z`, C.sky, { sw: 1.1 })
    p.path(`M${f(qx - 6)} ${f(qy - 12)}a6 6 0 0 1 6 6h-6z`, shade(C.sky, 0.8), { sw: 1 })
    p.el('circle', { cx: qx - 4, cy: qy - 1.5, r: 1.6, fill: INK }); p.el('circle', { cx: qx + 3, cy: qy - 1.5, r: 1.6, fill: INK })
    p.path(`M${f(qx + 5)} ${f(qy - 6)}l3 -4`, 'none', { sw: 1 })
    })
    person(p, 1.25, 1.85, C.lilac, { pose: 'wave' })
    tree(p, 1.88, 1.85, 'blossom', C.leaf, 0.85)
  } },

  'rule-cascade': { size: [2, 2], draw(p) {
    const o = p.box(0.2, 0.15, 1.4, 1.2, 58, { fill: '#e3e8f7', trim: C.cobalt })
    p.windows(o, 'x', { rows: 3, cols: 3, z0: 8, h: 9, gap: 8, wide: 0.5 })
    p.windows(o, 'y', { rows: 3, cols: 3, z0: 8, h: 9, gap: 8, wide: 0.5 })
    p.box(0.14, 0.09, 1.52, 1.32, 5, { z0: 58, fill: C.cobalt })
    p.box(0.6, 0.5, 0.5, 0.4, 10, { z0: 63, fill: C.stone2 })
    flag(p.move(0, 0, 73), 0.85, 0.7, 0, C.rasp, 18)
    // A ticket machine on a post: take a number, wait for ever.
    p.line([1.9, 1.08, 0], [1.9, 1.08, 14], { sw: 2 })
    const tm = p.box(1.84, 1.02, 0.12, 0.12, 9, { z0: 13, fill: C.rasp, sw: 1.1 })
    p.quad(tm, 'y', 0.25, 0.75, 3, 5.5, '#ffffff', { sw: 0.7 })
    const [kx, ky] = p.at(1.9, 1.14, 15)
    p.path(`M${f(kx - 2)} ${f(ky + 1)}l1 5h3l-1 -5z`, '#ffffff', { sw: 0.7 })
    // The queue that does not move.
    for (const [x, c] of [[1.8, C.mint], [1.95, C.sky]] as const) person(p, x, 1.35, c)
    // The village noticeboard: posts, a little roof, and the rules pinned up
    // on top of one another, each one changing the last.
    for (const x of [0.4, 1.4]) p.box(x - 0.03, 1.7, 0.06, 0.06, 30, { fill: C.wood, sw: 1 })
    const nb = p.box(0.34, 1.7, 1.12, 0.05, 19, { z0: 9, fill: C.wood, sw: 1.2 })
    p.quad(nb, 'y', 0.03, 0.97, 1.5, 17.5, '#dfe4f2', { sw: 0.9 })
    p.gable(0.3, 1.64, 1.2, 0.16, 29, 5, C.cobalt, 'x', { lines: 0 })
    // The rules pinned up: printed on the board by Unity (kit.ts, decal), their words the page's.
    const notesAt: [number, number, number, number] = [-18, -17, 18, 0]
    p.decal('rules-notes', nb, 'y', 0.5, 1.5, notesAt)
    const g = p.face(nb, 'y', 0.5, 1.5, { w: 36, h: 17 })
    const notes: [number, number, number, number, number, string][] = [[-14, -15, 9, 11, -6, '#ffffff'], [-3, -15.5, 8, 7, 4, '#ffe1e8'], [6, -15, 9, 9, -3, '#d6f5ec'], [-5, -8, 7, 6, 7, '#e3e0ff'], [9, -5.5, 6, 5, -8, '#ffffff']]
    for (const [x, y, w, h, a, c] of notes) {
      const n = g.add(new N('g', { transform: `rotate(${a} ${f(x + w / 2)} ${f(y + h / 2)})` }))
      n.add(new N('rect', { x, y, width: w, height: h, fill: c, stroke: INK, 'stroke-width': 0.5 }))
      for (let k = 1; k * 2 < h - 1; k++) n.add(new N('path', { d: `M${f(x + 1.2)} ${f(y + 1 + k * 2)}h${f(w - 2.4 - (k % 2) * 1.5)}`, stroke: '#9aa3c0', 'stroke-width': 0.5 }))
      n.add(new N('circle', { cx: x + w / 2, cy: y + 0.9, r: 0.8, fill: C.rasp }))
    }
    // The newest rule, on top: ticks, and a cross where it contradicts.
    const top = g.add(new N('g', { transform: 'rotate(2 2 -9)' }))
    top.add(new N('rect', { x: -4, y: -16, width: 12, height: 14, fill: '#ffffff', stroke: INK, 'stroke-width': 0.6 }))
    letter(top, 2, -12.4, 'RULES', { size: 3, ls: 0.2 })
    for (let k = 0; k < 3; k++) {
      top.add(new N('path', { d: `M-2.5 ${f(-9.6 + k * 2.6)}h6`, stroke: '#9aa3c0', 'stroke-width': 0.6 }))
      letter(top, 5.8, -8.6 + k * 2.6, k === 2 ? '✗' : '✓', { size: 2.8, fill: k === 2 ? C.rasp : '#11a887', cls: 'rc-tick' }).attrs.style = `animation-delay:${k * 0.5}s`
    }
    top.add(new N('circle', { cx: 2, cy: -15.1, r: 0.9, fill: C.cobalt }))
    p.printFace(g, 'rules-notes', notesAt)
    // The lamp, and the moth that will not leave it.
    lamp(p, 1.85, 1.75, 34)
    const [lx, ly] = p.at(1.85, 1.75, 36)
    const moth = p.group('rc-moth', { style: `transform-origin:${f(lx + 5)}px ${f(ly)}px` })
    moth.path(`M${f(lx + 18)} ${f(ly)}l-5 -5v10zM${f(lx + 18)} ${f(ly)}l5 -5v10z`, '#a49dcf', { sw: 1 })
    person(p, 0.95, 1.95, C.lilac, { pose: 'look' })
  } },

  'from-memory': { size: [2, 2], draw(p) {
    // An art school, with a mural on its side wall: someone's bicycle,
    // drawn from memory, again and again, never quite right.
    const st = p.box(0.12, 0.12, 1.02, 1.32, 30, { fill: C.white, trim: C.rasp })
    p.gable(0.12, 0.12, 1.02, 1.32, 30, 16, C.rasp, 'y', { lines: 3 })
    p.windows(st, 'y', { cols: 2, z0: 9, h: 12, wide: 0.42 })
    p.door(st, 'y', 0.5, { w: 0.2, h: 16, fill: C.lilac })
    // A skylight in the roof, for the north light painters want.
    p.poly([[0.68, 0.3, 38], [0.68, 0.7, 38], [0.66, 0.7, 44], [0.66, 0.3, 44]], C.glass, { sw: 1 })
    p.quad(st, 'x', 0.08, 0.92, 4, 27, '#fdfdff', { sw: 1.1 })
    const m = p.face(st, 'x', 0.5, 4, { w: 40, h: 23 })
    m.add(new N('path', {
      d: 'M-14 -9a5.5 5.5 0 1 1 0.1 0M10 -9a5.5 5.5 0 1 0 -0.1 0M-14 -9l7 -9l9 0l2 9M-7 -18l4 9l7 0M10 -9l-3 -11h4M-9 -20h4M-3 -9l-2 2',
      // (On the realistic island, paint on a wall: a deeper blue, a finer line, the wall showing through.)
      fill: 'none', stroke: p.real ? '#3b5aa6' : C.cobalt, 'stroke-width': p.real ? 1.3 : 1.6, opacity: p.real ? 0.7 : undefined, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'fm-draw',
    }))
    letter(m, 0, -1, 'FROM MEMORY', { size: 3.6, fill: C.rasp, ls: 0.4 })
    // A painter at an easel out front, the easel and canvas painter-sized.
    const [ex, ey] = p.at(1.46, 1.86)
    // Unity's easel (Props8.cs, Easel), and on it the canvas: a board with the sketch printed on it (a plaque).
    p.model('easel', [1.46, 1.86, 0], {}, () => p.path(`M${f(ex - 7)} ${f(ey)}L${f(ex)} ${f(ey - 27)}L${f(ex + 7)} ${f(ey)}M${f(ex)} ${f(ey - 27)}L${f(ex + 2)} ${f(ey + 2)}`, 'none', { sw: 1.5, stroke: C.wood }))
    const sketch = new N('g')
    sketch.add(new N('rect', { width: 20, height: 14, fill: '#fbfaf6' }))
    sketch.add(new N('path', { d: 'M4 10.5a2.6 2.6 0 1 1 0.1 0M15 10.5a2.6 2.6 0 1 0 -0.1 0M4 10.5l4 -5h4l2 5', fill: 'none', stroke: C.cobalt, 'stroke-width': 0.9, 'stroke-linecap': 'round' }))
    p.plaque('fm-canvas', 1.46, 1.86, 11, 20, 14, sketch, { depth: 0.6 }, () => {
      p.path(`M${f(ex - 10)} ${f(ey - 25)}h20v14h-20z`, '#ffffff', { sw: 1.2 })
      p.path(`M${f(ex - 6)} ${f(ey - 14.5)}a2.6 2.6 0 1 1 0.1 0M${f(ex + 5)} ${f(ey - 14.5)}a2.6 2.6 0 1 0 -0.1 0M${f(ex - 6)} ${f(ey - 14.5)}l4 -5h4l2 5`, 'none', { sw: 0.9, stroke: C.cobalt })
      p.path(`M${f(ex - 9)} ${f(ey - 11)}h18`, 'none', { sw: 1.3, stroke: C.wood })
    })
    person(p, 1.78, 1.82, C.lilac, { hat: C.rasp, pose: 'look' })
    // The real bicycle, parked by the door, the size a bicycle is.
    const [cx, cy] = p.at(0.62, 1.72)
    p.model('bicycle', [0.62, 1.72, 0], { fill: C.rasp }, () => {
      p.path(`M${f(cx - 8)} ${f(cy - 4.5)}a4.5 4.5 0 1 0 0.1 0M${f(cx + 8)} ${f(cy - 4.5)}a4.5 4.5 0 1 0 0.1 0`, 'none', { sw: 1.4 })
      p.path(`M${f(cx - 8)} ${f(cy - 4.5)}l4 -7h8l4 7M${f(cx - 4)} ${f(cy - 11.5)}l4 7l4 -7M${f(cx + 4)} ${f(cy - 11.5)}l-1 -3h3M${f(cx - 5)} ${f(cy - 13)}h3`, 'none', { sw: 1.4, stroke: C.rasp })
    })
    p.grow(cx - 14, cy - 16, cx + 14, cy)
    // Paint pots.
    for (const [x, c] of [[1.25, C.rasp], [1.33, C.mint], [1.41, C.cobalt]] as const) p.cyl(x, 1.6, 0.04, 0, 5, c, { sw: 0.9 })
    tree(p, 1.8, 0.35, 'cypress', C.leaf)
  } },
}

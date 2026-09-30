/** Old Town: people and time — lives, weeks, days, births and rules. */
import { C, INK, N, OUT, shade, r1 as f, type Landmark } from './kit'
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
      const [fx, fy] = p.at(0.1 + 1.8 * u, 1.8, 17)
      p.el('circle', { cx: fx, cy: fy - 1, r: 2.6, fill: '#f1d9c6', stroke: INK, 'stroke-width': 0.8 })
      p.el('path', { d: `M${f(fx - 4)} ${f(fy + 5)}q4 -5 8 0`, fill: INK, opacity: 0.7 })
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
      g.add(new N('rect', { x: c * 0.21, y: r * 0.21, width: 0.17, height: 0.17, rx: 0.02, fill: k < 38 ? '#5fe0bf' : '#e8e1f5', stroke: INK, 'stroke-width': 0.031, class: 'liw-cell', 'data-k': k }))
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
    p.path(`M${f(sx)} ${f(sy)}v-30M${f(sx - 11)} ${f(sy - 21)}h22`, 'none', { sw: 2.2, stroke: C.wood })
    p.path(`M${f(sx - 5)} ${f(sy - 24)}h10v11h-10z`, C.cobalt, { sw: 1.2 })
    p.el('circle', { cx: sx, cy: sy - 29, r: 4.5, fill: '#f4f6fc', stroke: INK, 'stroke-width': 1.2 })
    p.path(`M${f(sx - 8)} ${f(sy - 32)}h16l-3 -5h-10z`, C.lilac, { sw: 1.1 })
    const [wx, wy] = p.at(0.3, 1.8)
    p.path(`M${f(wx - 5)} ${f(wy)}v-7h9v7zM${f(wx + 4)} ${f(wy - 5)}l7 -5`, C.sky, { sw: 1.2 })
    person(p, 1.35, 1.85, C.mint, { hat: '#ffffff' })
  } },

  'day-go': { size: [2, 2], draw(p) {
    const g = p.plane(1, 1, 0)
    const slices: [number, number, string][] = [[0, 8, C.lilac], [8, 17, C.cobalt], [17, 20, C.sky], [20, 24, C.mint]]
    for (const [a0, a1, c] of slices) {
      const t0 = (a0 / 24) * Math.PI * 2 - Math.PI / 2, t1 = (a1 / 24) * Math.PI * 2 - Math.PI / 2, r = 0.88
      g.add(new N('path', { d: `M0 0L${f(Math.cos(t0) * r * 100) / 100} ${f(Math.sin(t0) * r * 100) / 100}A${r} ${r} 0 ${a1 - a0 > 12 ? 1 : 0} 1 ${f(Math.cos(t1) * r * 100) / 100} ${f(Math.sin(t1) * r * 100) / 100}Z`, fill: c, stroke: INK, 'stroke-width': 0.044 }))
    }
    g.add(new N('circle', { r: 0.95, fill: 'none', stroke: INK, 'stroke-width': 0.063 }))
    g.add(new N('circle', { r: 0.92, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.05, 'stroke-dasharray': '0.03 0.25' }))
    const sh = g.add(new N('g', { class: 'dg-shadow' }))
    sh.add(new N('path', { d: 'M0 0L0.1 -0.82L-0.1 -0.82Z', fill: INK, opacity: 0.5 }))
    p.grow(...p.at(0, 0), ...p.at(2, 2))
    p.cyl(1, 1, 0.1, 0, 4, C.stone)
    p.poly([[1, 0.88, 4], [1, 1.12, 4], [1, 1, 34]], '#ffffff')
    p.poly([[1, 1, 34], [1, 1.12, 4], [1.04, 1.08, 4]], shade('#ffffff', 0.8), { sw: 1 })
    bench(p, 0.15, 1.0, 'y'); bench(p, 1.85, 1.0, 'y')
    person(p, 1.6, 1.85, C.rasp, { pose: 'look' }); person(p, 0.3, 0.4, C.sky)
    lamp(p, 0.15, 1.85, 24)
  } },

  'every-second': { size: [2, 2], draw(p) {
    const houses: [number, number, string][] = [[0.1, 0.1, C.rasp], [0.95, 0.15, C.cobalt], [0.15, 0.95, C.lilac], [1.2, 1.0, C.sky], [0.65, 1.5, C.mint]]
    houses.forEach(([x, y, roof], k) => {
      const b = p.box(x, y, 0.58, 0.46, 20, { fill: k % 2 ? '#ffffff' : '#f4f1ff' })
      p.gable(x, y, 0.58, 0.46, 20, 13, roof, 'x', { lines: 2 })
      p.windows(b, 'x', { cols: 1, z0: 7, h: 7, wide: 0.4, cls: 'es-win', pane: '#e3e8f7' })
      p.windows(b, 'y', { cols: 2, z0: 7, h: 7, wide: 0.4, cls: 'es-win', pane: '#e3e8f7' })
      p.box(x + 0.08, y + 0.08, 0.08, 0.08, 10, { z0: 24, fill: C.stone2, sw: 1 })
    })
    // A stork on the tallest roof, and a +1 floating up.
    const [kx, ky] = p.at(1.49, 1.23, 34)
    p.path(`M${f(kx - 5)} ${f(ky - 6)}q5 -4 10 0q-2 5 -10 0zM${f(kx + 5)} ${f(ky - 7)}l3 -9M${f(kx + 8)} ${f(ky - 16)}l6 2`, '#ffffff', { sw: 1.2 })
    p.path(`M${f(kx - 2)} ${f(ky - 4)}v5M${f(kx + 1)} ${f(ky - 4)}v5`, 'none', { sw: 1, stroke: C.rasp })
    const [x, y] = p.at(1.7, 0.45, 40)
    const pl = p.group('es-plus')
    pl.el('circle', { cx: x, cy: y, r: 11, fill: C.mint, stroke: INK, 'stroke-width': OUT })
    pl.el('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 10.5, fill: INK }).text('+1')
    p.grow(x - 12, y - 40, x + 12, y + 12)
    flowers(p, 1.85, 1.85); tree(p, 1.8, 0.95, 'blossom', C.leaf)
    person(p, 1.05, 1.95, C.lilac, { pose: 'wave' })
  } },

  'rule-cascade': { size: [2, 2], draw(p) {
    const o = p.box(0.2, 0.15, 1.4, 1.2, 58, { fill: '#e3e8f7', trim: C.cobalt })
    p.windows(o, 'x', { rows: 3, cols: 3, z0: 8, h: 9, gap: 8, wide: 0.5 })
    p.windows(o, 'y', { rows: 3, cols: 3, z0: 8, h: 9, gap: 8, wide: 0.5 })
    p.box(0.14, 0.09, 1.52, 1.32, 5, { z0: 58, fill: C.cobalt })
    p.box(0.6, 0.5, 0.5, 0.4, 10, { z0: 63, fill: C.stone2 })
    flag(p.move(0, 0, 73), 0.85, 0.7, 0, C.rasp, 18)
    // The noticeboard of rules on its posts.
    p.line([0.45, 1.7, 0], [0.45, 1.7, 14], { sw: 2 }); p.line([1.35, 1.7, 0], [1.35, 1.7, 14], { sw: 2 })
    const [bx, by] = p.at(0.9, 1.7, 14)
    p.path(`M${f(bx - 36)} ${f(by - 46)}h72v46h-72z`, '#ffffff', { sw: 2 })
    p.el('text', { x: bx, y: by - 37, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 6.8, fill: INK }).text('THE RULES')
    for (let k = 0; k < 4; k++) {
      p.el('rect', { x: bx - 28, y: by - 31 + k * 7.5, width: 40, height: 2.6, rx: 1.3, fill: '#c9cde0' })
      p.el('text', { x: bx + 22, y: by - 27.5 + k * 7.5, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 7.5, fill: k === 3 ? C.rasp : '#11a887', class: 'rc-tick', style: `animation-delay:${k * 0.5}s` }).text(k === 3 ? '✗' : '✓')
    }
    p.grow(bx - 38, by - 48, bx + 38, by)
    // The lamp, and the moth that will not leave it.
    lamp(p, 1.85, 1.75, 34)
    const [lx, ly] = p.at(1.85, 1.75, 36)
    const moth = p.group('rc-moth', { style: `transform-origin:${f(lx + 5)}px ${f(ly)}px` })
    moth.path(`M${f(lx + 18)} ${f(ly)}l-5 -5v10zM${f(lx + 18)} ${f(ly)}l5 -5v10z`, '#a49dcf', { sw: 1 })
    // A queue that does not move.
    for (const [x, c] of [[1.8, C.mint], [1.95, C.sky]] as const) person(p, x, 1.35, c)
    p.sign(1.9, 1.05, 16, 34, 9, '#ffffff', 'TAKE A NUMBER', { size: 4.6 })
  } },

  'from-memory': { size: [2, 2], draw(p) {
    const st = p.box(0.15, 0.15, 1.1, 1.0, 28, { fill: C.white, trim: C.rasp })
    p.gable(0.15, 0.15, 1.1, 1.0, 28, 16, C.rasp, 'y', { lines: 2 })
    p.windows(st, 'x', { cols: 2, z0: 8, h: 12, wide: 0.55 })
    p.door(st, 'y', 0.5, { w: 0.24, h: 16, fill: C.lilac })
    // A skylight in the roof, for the north light painters want.
    p.poly([[0.75, 0.3, 36], [0.75, 0.6, 36], [0.72, 0.6, 42], [0.72, 0.3, 42]], C.glass, { sw: 1 })
    // The easel, with the wrong bicycle on it...
    const [ex, ey] = p.at(1.55, 1.45)
    p.path(`M${f(ex - 16)} ${f(ey)}L${f(ex)} ${f(ey - 58)}L${f(ex + 16)} ${f(ey)}M${f(ex)} ${f(ey - 58)}L${f(ex + 4)} ${f(ey + 4)}`, 'none', { sw: 2.2, stroke: C.wood })
    p.path(`M${f(ex - 26)} ${f(ey - 52)}h52v36h-52z`, '#ffffff', { sw: 1.8 })
    p.el('path', { d: `M${f(ex - 17)} ${f(ey - 26)}a7 7 0 1 1 1 0M${f(ex + 14)} ${f(ey - 26)}a7 7 0 1 0 -1 0M${f(ex - 17)} ${f(ey - 26)}l10 -12l10 12l-6 -14h-6M${f(ex + 3)} ${f(ey - 40)}l6 -4`, fill: 'none', stroke: C.cobalt, 'stroke-width': 1.8, 'stroke-linecap': 'round', class: 'fm-draw' })
    // ...and the right one parked beside it.
    const [cx, cy] = p.at(0.55, 1.75)
    p.path(`M${f(cx - 15)} ${f(cy - 8)}a8 8 0 1 0 0.1 0M${f(cx + 15)} ${f(cy - 8)}a8 8 0 1 0 0.1 0`, 'none', { sw: 2 })
    p.path(`M${f(cx - 15)} ${f(cy - 8)}l8 -12h13l9 12M${f(cx - 7)} ${f(cy - 20)}l7 12l8 -12M${f(cx + 6)} ${f(cy - 20)}l-2 -5h5M${f(cx - 9)} ${f(cy - 23)}h6`, 'none', { sw: 2, stroke: C.rasp })
    // Paint pots.
    for (const [x, c] of [[1.2, C.rasp], [1.3, C.mint], [1.4, C.cobalt]] as const) p.cyl(x, 1.85, 0.05, 0, 6, c, { sw: 1 })
    person(p, 1.85, 1.7, C.lilac, { hat: C.rasp, pose: 'look' })
    tree(p, 1.8, 0.35, 'cypress', C.leaf)
  } },
}

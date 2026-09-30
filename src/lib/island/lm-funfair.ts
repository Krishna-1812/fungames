/** The Funfair: the internet, the reviews, the progress bar, too many lights. */
import { C, INK, N, OUT, shade, r1 as f, type Landmark } from './kit'
import { person, tree, flag, lamp, flowers, bench } from './props'

export const funfair: Record<string, Landmark> = {
  'earth-reviews': { size: [2, 2], draw(p) {
    const shop = p.box(0.2, 0.3, 1.6, 1.3, 30, { fill: C.white, trim: C.mint })
    p.windows(shop, 'y', { cols: 2, z0: 4, h: 15, wide: 0.6, pane: '#cfe8ff' })
    p.door(shop, 'y', 0.5, { w: 0.24, h: 17, fill: C.mint })
    p.awning(shop, 'y', 0.02, 0.98, 26, 0.22, [C.mint, '#ffffff'])
    p.windows(shop, 'x', { cols: 2, z0: 10, h: 10, wide: 0.5 })
    // The rooftop billboard: Gravity, two stars.
    p.line([0.55, 0.95, 30], [0.55, 0.95, 50], { sw: 2.2 }); p.line([1.45, 0.95, 30], [1.45, 0.95, 50], { sw: 2.2 })
    const [bx, by] = p.at(1, 0.95, 50)
    p.path(`M${f(bx - 52)} ${f(by - 38)}h104v38h-104z`, '#ffffff', { sw: 2.2 })
    p.el('text', { x: bx, y: by - 26, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 8.5, fill: INK }).text('GRAVITY')
    p.el('text', { x: bx, y: by - 4, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 500, 'font-size': 5.5, fill: '#56607e' }).text('“keeps pulling me down”')
    for (let k = 0; k < 5; k++) {
      const x = bx - 30 + k * 15, y = by - 14
      p.path(`M${f(x)} ${f(y - 6.5)}l1.9 4.4h4.8l-3.9 2.9l1.5 4.6l-4.3 -2.8l-4.3 2.8l1.5 -4.6l-3.9 -2.9h4.8z`, k < 2 ? C.rasp : '#e3e8f7', { sw: 1, cls: k < 2 ? 'er-star' : undefined, style: `animation-delay:${k * 0.3}s` })
    }
    // A shopping trolley, a returns desk queue.
    const [tx, ty] = p.at(1.9, 1.8)
    p.path(`M${f(tx - 8)} ${f(ty - 12)}h14l-2 7h-10zM${f(tx - 10)} ${f(ty - 14)}h3`, '#ffffff', { sw: 1.3 })
    p.el('circle', { cx: tx - 5, cy: ty - 2, r: 1.8, fill: INK }); p.el('circle', { cx: tx + 3, cy: ty - 2, r: 1.8, fill: INK })
    p.sign(0.35, 1.95, 12, 34, 10, C.rasp, 'NO REFUNDS', { size: 5, ink: '#fff' })
    p.line([0.35, 1.95, 0], [0.35, 1.95, 12], { sw: 1.6 })
    person(p, 1.25, 1.95, C.lilac, { pose: 'wave' }); person(p, 1.45, 1.95, C.sky)
  } },

  overstimulated: { size: [2, 2], draw(p) {
    // The wheel on its A-frame.
    const [hx, hy] = p.at(0.9, 0.9, 80)
    p.line([0.55, 1.25, 0], [0.9, 0.9, 80], { sw: 4.5 }); p.line([1.25, 0.55, 0], [0.9, 0.9, 80], { sw: 4.5 })
    p.line([0.55, 1.25, 0], [0.9, 0.9, 80], { sw: 2, stroke: C.lilac }); p.line([1.25, 0.55, 0], [0.9, 0.9, 80], { sw: 2, stroke: C.lilac })
    const wheel = p.group('spin')
    wheel.el('circle', { cx: hx, cy: hy, r: 58, fill: 'none', stroke: INK, 'stroke-width': 5 })
    wheel.el('circle', { cx: hx, cy: hy, r: 58, fill: 'none', stroke: C.lilac, 'stroke-width': 2.5 })
    wheel.el('circle', { cx: hx, cy: hy, r: 40, fill: 'none', stroke: INK, 'stroke-width': 1.5 })
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2, x = hx + Math.cos(a) * 58, y = hy + Math.sin(a) * 58
      wheel.el('line', { x1: hx, y1: hy, x2: x, y2: y, stroke: INK, 'stroke-width': 1.4 })
      wheel.el('circle', { cx: hx + Math.cos(a + 0.31) * 58, cy: hy + Math.sin(a + 0.31) * 58, r: 2.4, fill: '#ffffff', stroke: INK, 'stroke-width': 0.6, class: 'chase', style: `animation-delay:${k * 0.1}s` })
      // Each car hangs level while the wheel turns.
      const car = wheel.g.add(new N('g', { class: 'spin-rev', style: `transform-origin:${f(x)}px ${f(y)}px` }))
      car.add(new N('path', { d: `M${f(x - 7)} ${f(y)}h14v7a3 3 0 0 1 -3 3h-8a3 3 0 0 1 -3 -3z`, fill: [C.rasp, C.mint, C.sky, C.lilac, C.cobalt][k % 5], stroke: INK, 'stroke-width': 1.4 }))
      car.add(new N('path', { d: `M${f(x - 6)} ${f(y)}q6 -6 12 0`, fill: 'none', stroke: INK, 'stroke-width': 1.2 }))
    }
    wheel.el('circle', { cx: hx, cy: hy, r: 7, fill: C.rasp, stroke: INK, 'stroke-width': OUT })
    p.grow(hx - 70, hy - 70, hx + 70, hy + 70)
    // A ticket booth covered in bulbs, and pop-ups that keep popping.
    const bth = p.box(1.25, 1.25, 0.65, 0.65, 22, { fill: C.rasp, top: shade(C.rasp, 1.1) })
    p.windows(bth, 'y', { cols: 1, z0: 8, h: 8, wide: 0.6, pane: '#ffffff' })
    p.gable(1.25, 1.25, 0.65, 0.65, 22, 12, '#ffffff', 'y', { lines: 1 })
    for (let k = 0; k < 6; k++) { const [x, y] = p.at(1.25 + k * 0.13, 1.9, 22); p.el('circle', { cx: x, cy: y, r: 2, fill: '#ffffff', stroke: INK, 'stroke-width': 0.6, class: 'chase', style: `animation-delay:${k * 0.12}s` }) }
    for (let k = 0; k < 3; k++) {
      const [x, y] = p.at(1.95, 1.3 + k * 0.22, 36 + k * 20)
      const w = p.group('pop', { style: `animation-delay:${k * 0.7}s` })
      w.path(`M${f(x + 4)} ${f(y - 16)}h34v20h-34z`, '#ffffff', { sw: 1.4 })
      w.path(`M${f(x + 4)} ${f(y - 16)}h34v5h-34z`, C.cobalt, { sw: 1.1 })
      w.path(`M${f(x + 9)} ${f(y - 6)}h18M${f(x + 9)} ${f(y - 2)}h12`, 'none', { sw: 1.2, stroke: '#9aa3c0' })
    }
    // Balloons on strings.
    for (const [x, y, c] of [[1.9, 0.3, C.mint], [1.75, 0.2, C.rasp], [1.95, 0.1, C.lilac]] as const) {
      const [bx, by] = p.at(x, y, 40)
      p.path(`M${f(bx)} ${f(by + 6)}q-3 12 0 26`, 'none', { sw: 0.9 })
      p.el('ellipse', { cx: bx, cy: by, rx: 5.5, ry: 7, fill: c, stroke: INK, 'stroke-width': 1.2, class: 'bob' })
    }
    person(p, 0.3, 1.8, C.mint, { pose: 'wave' }); person(p, 0.5, 1.9, C.sky)
    flag(p, 1.3, 1.3, 34, C.mint, 14)
  } },

  'internet-artifacts': { size: [2, 2], draw(p) {
    // The museum is a computer: a monitor on a base, a keyboard as the steps.
    p.box(0.35, 0.3, 1.3, 0.9, 10, { fill: '#e6e9f5' })
    const mon = p.box(0.25, 0.2, 1.5, 1.05, 60, { z0: 10, fill: '#eceff8', trim: '#d5d9ea' })
    p.quad(mon, 'y', 0.08, 0.92, 10, 54, '#c9cde0', { sw: 1.4 })
    p.quad(mon, 'y', 0.12, 0.88, 14, 50, '#12202e', { sw: 1.6 })
    for (let k = 0; k < 5; k++) p.quad(mon, 'y', 0.17, 0.17 + 0.2 + ((k * 7) % 5) * 0.08, 44 - k * 6.5, 46 - k * 6.5, C.mint, { sw: 0, cls: 'ia-line', style: `animation-delay:${k * 0.3}s` })
    p.quad(mon, 'y', 0.17, 0.22, 11 + 6, 13 + 6, C.mint, { sw: 0, cls: 'blink' })
    p.quad(mon, 'x', 0.3, 0.7, 6, 14, '#c9cde0', { sw: 1 })
    p.quad(mon, 'x', 0.42, 0.58, 16, 18, '#2c355e', { sw: 0.8 })
    const kb = p.box(0.3, 1.45, 1.4, 0.4, 5, { fill: '#e6e9f5' })
    for (let r = 0; r < 2; r++) for (let k = 0; k < 8; k++) p.poly([[0.38 + k * 0.165, 1.5 + r * 0.16, 5], [0.5 + k * 0.165, 1.5 + r * 0.16, 5], [0.5 + k * 0.165, 1.62 + r * 0.16, 5], [0.38 + k * 0.165, 1.62 + r * 0.16, 5]], '#c9cde0', { sw: 0.8 })
    void kb
    // A mouse on its cable, and a floppy-disk sign.
    p.path(`M${f(p.at(1.75, 1.6)[0])} ${f(p.at(1.75, 1.6)[1])}q10 -6 4 -18`, 'none', { sw: 1.2 })
    p.box(1.72, 1.58, 0.14, 0.2, 5, { fill: '#e6e9f5', sw: 1.1 })
    p.sign(1.75, 0.35, 70, 26, 26, C.cobalt, '', { rx: 2 })
    const [sx, sy] = p.at(1.75, 0.35, 70)
    p.path(`M${f(sx - 8)} ${f(sy - 24)}h16v8h-16zM${f(sx - 6)} ${f(sy - 12)}h12v10h-12z`, '#ffffff', { sw: 1 })
    // A pixel rainbow, flying laps.
    const [fx, fy] = p.at(1, 0.6, 120)
    const fly = p.group('ia-fly')
    ;[C.rasp, '#ffffff', C.mint, C.sky, C.cobalt, C.lilac].forEach((c, k) => fly.el('rect', { x: fx - 70, y: fy - 12 + k * 4, width: 52, height: 4, fill: c }))
    fly.path(`M${f(fx - 20)} ${f(fy - 17)}h24v28h-24z`, '#eceff8', { sw: 1.6 })
    fly.path(`M${f(fx - 16)} ${f(fy - 13)}h16v12h-16z`, '#12202e', { sw: 1 })
    fly.el('rect', { x: fx - 12, y: fy - 9, width: 3, height: 3, fill: C.mint })
    p.grow(fx - 90, fy - 30, fx + 90, fy + 20)
    person(p, 1.9, 1.95, C.rasp, { pose: 'look' }); person(p, 0.15, 1.9, C.mint)
  } },

  progress: { size: [2, 1], draw(p) {
    flowers(p, 0.25, 0.5); flowers(p, 1.75, 0.5, [C.sky, '#ffffff', C.lilac])
    p.box(0.3, 0.12, 1.4, 0.76, 6, { fill: C.stone })
    const m = p.box(0.45, 0.3, 1.1, 0.34, 80, { z0: 6, fill: C.white, trim: C.stone2 })
    p.quad(m, 'y', 0.08, 0.92, 32, 48, '#e3e8f7', { sw: 1.6 })
    p.quad(m, 'y', 0.08, 0.08 + 0.84 * 0.74, 32, 48, C.mint, { sw: 1.6, cls: 'pg-fill' })
    for (let k = 1; k < 10; k++) p.quad(m, 'y', 0.08 + (0.84 * k) / 10, 0.08 + (0.84 * k) / 10 + 0.004, 32, 48, '#ffffff', { sw: 0, op: 0.6 })
    const [tx, ty] = p.at(1, 0.64, 58)
    p.el('text', { x: tx, y: ty, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 10, fill: INK }).text('74%')
    const [yx, yy] = p.at(1, 0.64, 22)
    p.el('text', { x: yx, y: yy, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 600, 'font-size': 6, fill: '#56607e' }).text('OF THIS YEAR IS GONE')
    p.pyramid(0.45, 0.3, 1.1, 0.34, 86, 12, C.stone2)
    bench(p, 0.3, 0.95, 'x'); bench(p, 1.7, 0.95, 'x')
    person(p, 1.25, 0.95, C.cobalt, { pose: 'look' })
    void lamp; void tree
  } },
}

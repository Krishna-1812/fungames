/** Market Street: where the money goes. */
import { C, INK, N, OUT, shade, r1 as f, type Landmark } from './kit'
import { person, crate, tree, flag, lamp, fence } from './props'

export const market: Record<string, Landmark> = {
  auction: { size: [2, 2], draw(p) {
    p.box(0.02, 0.02, 1.96, 1.96, 5, { fill: C.stone })
    p.box(0.1, 0.1, 1.8, 1.8, 4, { z0: 5, fill: '#e3e8f7' })
    const hall = p.box(0.25, 0.25, 1.25, 1.25, 38, { z0: 9, fill: C.white })
    p.windows(hall, 'x', { cols: 3, z0: 18, h: 12, wide: 0.45, pane: '#c9d9ff' })
    // A red carpet up the steps to the doors.
    p.poly([[0.8, 1.5, 9], [1.0, 1.5, 9], [1.0, 1.95, 5], [0.8, 1.95, 5]], C.rasp, { sw: 1 })
    p.door(hall, 'y', 0.53, { w: 0.3, h: 22, fill: C.slate })
    for (let k = 0; k < 4; k++) p.cyl(1.66, 0.35 + k * 0.37, 0.055, 9, 38, '#ffffff', { sw: 1.2 })
    for (let k = 0; k < 5; k++) p.cyl(0.35 + k * 0.33, 1.66, 0.055, 9, 38, '#ffffff', { sw: 1.2 })
    const ent = p.box(0.18, 0.18, 1.6, 1.6, 7, { z0: 47, fill: C.white })
    p.band(ent, 2, 5, C.cobalt)
    p.pyramid(0.18, 0.18, 1.6, 1.6, 54, 22, C.cobalt)
    const [tx, ty] = p.at(0.98, 1.78, 50)
    p.el('text', { x: tx, y: ty, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 6, fill: '#ffffff', 'letter-spacing': 1.2 }).text('AUCTIONS')
    const [gx, gy] = p.at(0.98, 0.98, 92)
    const gav = p.group('au-gavel')
    gav.path(`M${f(gx - 3)} ${f(gy + 18)}v-24h6v24z`, C.wood)
    gav.path(`M${f(gx - 15)} ${f(gy - 6)}h30a4 4 0 0 1 4 4v6a4 4 0 0 1 -4 4h-30a4 4 0 0 1 -4 -4v-6a4 4 0 0 1 4 -4z`, C.lilac)
    gav.path(`M${f(gx - 9)} ${f(gy - 6)}v14M${f(gx + 9)} ${f(gy - 6)}v14`, 'none', { sw: 1.2 })
    const sold = p.group('au-sold')
    sold.path(`M${f(gx + 22)} ${f(gy - 48)}h50a6 6 0 0 1 6 6v14a6 6 0 0 1 -6 6h-32l-10 9l2 -9h-10a6 6 0 0 1 -6 -6v-14a6 6 0 0 1 6 -6z`, C.rasp)
    sold.el('text', { x: gx + 47, y: gy - 31, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 12, fill: '#fff' }).text('SOLD!')
    flag(p.move(0, 0, 76), 0.25, 0.25, 0, C.rasp, 18); flag(p.move(0, 0, 76), 1.7, 0.25, 0, C.mint, 18)
    // Bidders with their paddles.
    for (const [x, y, c] of [[1.3, 1.95, C.mint], [0.5, 1.95, C.sky], [1.95, 1.2, C.lilac]] as const) {
      person(p, x, y, c)
      const [px, py] = p.at(x, y); p.path(`M${f(px + 4)} ${f(py - 12)}l3 -8`, 'none', { sw: 1.4 }); p.el('circle', { cx: px + 7.5, cy: py - 22, r: 3.5, fill: '#ffffff', stroke: INK, 'stroke-width': 1.2 })
    }
  } },

  'printing-money': { size: [3, 2], draw(p) {
    // The conveyor, then the bills riding on it.
    const belt = p.plane(1.35, 0.72, 2)
    belt.add(new N('rect', { x: 0, y: 0, width: 1.6, height: 0.5, fill: '#2c355e', stroke: INK, 'stroke-width': 0.05 }))
    for (let k = 0; k < 9; k++) belt.add(new N('line', { x1: k * 0.2, y1: 0, x2: k * 0.2, y2: 0.5, stroke: '#4a5690', 'stroke-width': 0.031 }))
    const bills = belt.add(new N('g', { class: 'pm-bills' }))
    for (let k = 0; k < 8; k++) {
      bills.add(new N('rect', { x: k * 0.3 - 0.3, y: 0.08, width: 0.24, height: 0.34, rx: 0.02, fill: C.bill, stroke: INK, 'stroke-width': 0.031 }))
      bills.add(new N('circle', { cx: k * 0.3 - 0.18, cy: 0.25, r: 0.06, fill: 'none', stroke: '#2c8f68', 'stroke-width': 0.031 }))
    }
    for (const x of [1.45, 2.85]) { p.line([x, 0.72, 0], [x, 0.72, 2], { sw: 1.5 }); p.line([x, 1.22, 0], [x, 1.22, 2], { sw: 1.5 }) }
    // Stacks of money waiting at the far end.
    for (const [x, y, h] of [[2.55, 1.45, 14], [2.8, 1.5, 9], [2.65, 1.75, 6]] as const) {
      const b = p.box(x - 0.1, y - 0.07, 0.2, 0.14, h, { fill: C.bill, sw: 1.1 })
      for (let z = 3; z < h; z += 3) p.band(b, z, z + 0.6, '#5fbf96')
    }
    // The Mint: sawtooth roof, glass north lights, a chimney.
    const m = p.box(0.1, 0.2, 1.25, 1.6, 30, { fill: C.white })
    p.windows(m, 'x', { cols: 4, z0: 8, h: 11, wide: 0.5, pane: '#bdf0da' })
    p.windows(m, 'y', { cols: 3, z0: 8, h: 11, wide: 0.5, pane: '#bdf0da' })
    for (let k = 0; k < 3; k++) {
      const y0 = 0.2 + k * 0.533
      p.poly([[0.1, y0, 30], [1.35, y0, 30], [1.35, y0 + 0.533, 30], [0.1, y0 + 0.533, 30]], '#e6e9f5', { sw: 1 })
      p.poly([[0.1, y0 + 0.533, 30], [1.35, y0 + 0.533, 30], [1.35, y0 + 0.533, 44], [0.1, y0 + 0.533, 44]], C.glass, { sw: 1.2 })
      p.poly([[0.1, y0, 30], [1.35, y0, 30], [1.35, y0 + 0.533, 44], [0.1, y0 + 0.533, 44]], '#9fb1e6', { sw: 1.2 })
    }
    p.cyl(0.3, 0.4, 0.12, 30, 46, '#c9cde0', { bands: [[36, 40, C.rasp]] })
    const [cx, cy] = p.at(0.3, 0.4, 78)
    for (let k = 0; k < 3; k++) p.el('circle', { cx, cy, r: 7, fill: '#ffffff', stroke: INK, 'stroke-width': 1.2, class: 'puff', style: `animation-delay:${k}s` })
    p.grow(cx - 20, cy - 50, cx + 20, cy)
    p.sign(0.7, 1.82, 30, 60, 15, C.bill, 'THE MINT', { size: 8 })
    p.door(m, 'x', 0.62, { w: 0.4, h: 18, fill: C.slate })
    person(p, 2.2, 1.7, C.slate, { hat: C.slate })
    person(p, 1.6, 1.55, C.mint)
    lamp(p, 2.9, 0.4)
  } },

  'dark-patterns': { size: [2, 2], draw(p) {
    // A queue that zigzags for no reason.
    fence(p, [[0.2, 1.95], [0.2, 1.75], [0.7, 1.75]], 6, '#ffffff')
    const mall = p.box(0.1, 0.1, 1.8, 1.55, 44, { fill: C.slate, top: '#3b4675', trim: '#1b2340' })
    p.windows(mall, 'x', { cols: 4, z0: 24, h: 10, wide: 0.6, pane: '#4a5690', frame: '#3b4675' })
    // A glass front and a revolving door.
    p.quad(mall, 'y', 0.3, 0.78, 0, 20, '#6f7cb8', { sw: 1.2 })
    for (let k = 1; k < 4; k++) p.quad(mall, 'y', 0.3 + k * 0.12 - 0.003, 0.3 + k * 0.12 + 0.003, 0, 20, INK, { sw: 0 })
    const [sx, sy] = p.at(1, 1.65, 30)
    const s1 = p.group('blink')
    s1.path(`M${f(sx - 38)} ${f(sy - 19)}h76v16h-76z`, C.rasp, { sw: 1.8 })
    s1.el('text', { x: sx, y: sy - 8, 'text-anchor': 'middle', 'font-family': 'Silkscreen, monospace', 'font-size': 7.5, fill: '#fff' }).text('SALE ENDS 00:59')
    const [rx, ry] = p.at(1, 1, 44)
    const s2 = p.group('blink-slow')
    s2.path(`M${f(rx - 33)} ${f(ry - 24)}h66v17h-66z`, C.mint, { sw: 1.8 })
    s2.el('text', { x: rx, y: ry - 12.5, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 8, fill: INK }).text('ONLY 1 LEFT!')
    p.line([0.6, 1.0, 44], [0.6, 1.0, 52], { sw: 1.5 }); p.line([1.4, 1.0, 44], [1.4, 1.0, 52], { sw: 1.5 })
    // The close button that is not a close button.
    const [bx, by] = p.at(1.9, 0.75, 34)
    p.path(`M${f(bx)} ${f(by - 22)}h20v20h-20z`, '#ffffff', { sw: 1.8 })
    p.path(`M${f(bx + 5)} ${f(by - 17)}l10 10m0 -10l-10 10`, 'none', { sw: 2.2 })
    p.el('text', { x: bx + 10, y: by + 6, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-size': 4.5, fill: '#ffffff' }).text('(opens more)')
    const [ax, ay] = p.at(0.12, 1.62, 16)
    p.el('text', { x: ax - 2, y: ay, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 7, fill: C.mint }).text('← EXIT →')
    person(p, 0.45, 1.85, C.sky); person(p, 0.62, 1.85, C.lilac, { pose: 'look' })
    void OUT; void shade; void crate; void tree
  } },

  'spend-it': { size: [2, 2], water: true, draw(p) {
    // A private island of its own, with a hammock.
    p.disc(1.6, 0.4, 0.4, -10, '#eef0fb')
    tree(p.move(0, 0, -10), 1.72, 0.3, 'palm'); tree(p.move(0, 0, -10), 1.42, 0.3, 'palm', C.leaf, 0.8)
    const [hx, hy] = p.at(1.57, 0.3, 4)
    p.path(`M${f(hx - 12)} ${f(hy - 12)}q12 12 24 0`, 'none', { sw: 1.6, stroke: C.rasp })
    const b = p.group('bob')
    const [x, y] = b.at(0.85, 1.25, -8)
    b.el('ellipse', { cx: x, cy: y + 8, rx: 74, ry: 11, fill: '#ffffff', opacity: 0.4 })
    b.path(`M${f(x - 70)} ${f(y - 14)}L${f(x + 62)} ${f(y - 30)}L${f(x + 50)} ${f(y + 2)}L${f(x - 56)} ${f(y + 10)}Z`, '#ffffff')
    b.path(`M${f(x - 64)} ${f(y - 5)}L${f(x + 56)} ${f(y - 19)}`, 'none', { stroke: C.cobalt, sw: 3.5 })
    b.path(`M${f(x - 44)} ${f(y - 16)}L${f(x + 40)} ${f(y - 26)}L${f(x + 32)} ${f(y - 42)}L${f(x - 32)} ${f(y - 35)}Z`, '#f4f6fc')
    for (let k = 0; k < 6; k++) b.path(`M${f(x - 36 + k * 12)} ${f(y - 30 - k * 1.1)}h8v5h-8z`, C.lilac, { sw: 1 })
    b.path(`M${f(x - 22)} ${f(y - 35)}L${f(x + 24)} ${f(y - 42)}L${f(x + 17)} ${f(y - 54)}L${f(x - 14)} ${f(y - 50)}Z`, '#f4f6fc')
    b.path(`M${f(x - 10)} ${f(y - 44)}h20v4h-20z`, C.glass, { sw: 1 })
    // A helipad, a pool, a radar dome.
    b.el('ellipse', { cx: x - 50, cy: y - 12, rx: 10, ry: 4, fill: '#dfe4f5', stroke: INK, 'stroke-width': 1 })
    b.el('text', { x: x - 50, y: y - 10, 'text-anchor': 'middle', 'font-family': 'Fredoka', 'font-weight': 700, 'font-size': 5, fill: INK }).text('H')
    b.path(`M${f(x + 28)} ${f(y - 22)}l14 -2l-2 6l-14 2z`, C.sky, { sw: 1 })
    b.path(`M${f(x + 2)} ${f(y - 54)}a6 6 0 0 1 12 0z`, '#ffffff', { sw: 1.2 })
    b.path(`M${f(x + 8)} ${f(y - 60)}v-10`, 'none', { sw: 1.4 })
    for (let k = 0; k < 4; k++) { const [cx, cy] = p.at(0.3 + k * 0.4, 0.3, 50 + (k % 2) * 14); p.el('circle', { cx, cy, r: 5, fill: '#e6f7ef', stroke: INK, 'stroke-width': 1.2, class: 'twinkle', style: `animation-delay:${k * 0.4}s` }); p.el('text', { x: cx, y: cy + 2.5, 'text-anchor': 'middle', 'font-family': 'Fredoka', 'font-weight': 700, 'font-size': 6.5, fill: '#2c8f68' }).text('$') }
    p.grow(x - 80, y - 90, x + 70, y + 20)
    // A jet ski doing laps.
    const js = p.group('jetski')
    const [jx, jy] = p.at(0.2, 1.9, -8)
    js.path(`M${f(jx - 10)} ${f(jy)}l18 -3l4 4l-20 3z`, C.rasp, { sw: 1.2 })
    js.el('path', { d: `M${f(jx - 12)} ${f(jy + 3)}q-12 3 -22 0`, stroke: '#ffffff', 'stroke-width': 2, fill: 'none' })
    void crate; void lamp; void flag; void person
  } },
}

/** Market Street: where the money goes. */
import { C, INK, N, OUT, shade, r1 as f, letter, neon, glow, puffShade, type Landmark } from './kit'
import { person, crate, tree, flag, lamp, fence } from './props'
import { creatureUse } from './actors'

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
    // The entablature, with the house's name carved into it.
    const ent = p.box(0.18, 0.18, 1.6, 1.6, 9, { z0: 47, fill: C.white })
    p.band(ent, 0, 1.6, C.cobalt)
    const nm = p.face(ent, 'y', 0.5, 2.6, { w: 50, h: 7 })
    letter(nm, 0, 0, 'AUCTION HOUSE', { size: 5, fill: C.cobalt, ls: 0.6 })
    const nx = p.face(ent, 'x', 0.5, 2.6, { w: 50, h: 7 })
    letter(nx, 0, 0, 'GOING · GOING', { size: 4.6, fill: shade(C.cobalt, 0.9), ls: 0.5 })
    p.pyramid(0.18, 0.18, 1.6, 1.6, 56, 22, C.cobalt)
    // On the very top, where a statue would stand, a gilt gavel that knocks.
    const [gx, gy] = p.at(0.98, 0.98, 78)
    p.path(`M${f(gx - 5)} ${f(gy)}h10v-4h-10z`, '#e3e8f7', { sw: 1.1 })
    const gav = p.group('au-gavel')
    const gilt = p.real ? '#d6ad57' : '#ffd98a', giltEdge = p.real ? { sw: 0.6, stroke: '#94712f' } : { sw: 1.2 }
    gav.path(`M${f(gx - 1.6)} ${f(gy - 4)}v-14h3.2v14z`, p.real ? '#b48a45' : C.wood, p.real ? { sw: 0.5, stroke: '#7d5f2c' } : { sw: 1.1 })
    gav.path(`M${f(gx - 8)} ${f(gy - 23)}h16a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-3a2 2 0 0 1 2 -2z`, gilt, giltEdge)
    gav.path(`M${f(gx - 4)} ${f(gy - 23)}v7M${f(gx + 4)} ${f(gy - 23)}v7`, 'none', p.real ? { sw: 0.6, stroke: '#94712f' } : { sw: 0.9 })
    p.grow(gx - 12, gy - 28, gx + 12, gy)
    flag(p.move(0, 0, 56), 0.25, 0.25, 0, C.rasp, 18); flag(p.move(0, 0, 56), 1.7, 0.25, 0, C.mint, 18)
    // Bidders with their paddles.
    for (const [x, y, c] of [[1.3, 1.95, C.mint], [0.5, 1.95, C.sky], [1.95, 1.2, C.lilac]] as const) {
      person(p, x, y, c)
      const [px, py] = p.at(x, y); p.path(`M${f(px + 4)} ${f(py - 12)}l3 -8`, 'none', { sw: 1.4 }); p.el('circle', { cx: px + 7.5, cy: py - 22, r: p.real ? 2.4 : 3.5, fill: p.real ? '#ece7dc' : '#ffffff', stroke: p.real ? '#8f2f3c' : INK, 'stroke-width': p.real ? 0.7 : 1.2 })
    }
    // An estate agent's board on the lawn, its SOLD rider flipping up.
    const [sx, sy] = p.at(1.9, 1.85)
    const lot = new N('g'); lot.add(new N('rect', { width: 24, height: 11, fill: '#ffffff' }))
    p.plaque('lot-board', 1.9, 1.85, 17, 24, 11, lot, { foot: 0, depth: 0.8 }, () => {
      p.path(`M${f(sx - 9)} ${f(sy)}v-26M${f(sx + 9)} ${f(sy)}v-26`, 'none', { sw: 1.8, stroke: C.wood })
      p.path(`M${f(sx - 12)} ${f(sy - 28)}h24v11h-24z`, '#ffffff', { sw: 1.3 })
    })
    p.el('text', { x: sx, y: sy - 20.4, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 4.6, fill: INK }).text('LOT 42')
    const sold = p.group('au-sold')
    sold.path(`M${f(sx - 12)} ${f(sy - 38)}h24v9h-24z`, C.rasp, { sw: 1.3 })
    sold.el('text', { x: sx, y: sy - 31.4, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 6.4, fill: '#fff', 'letter-spacing': 0.6 }).text('SOLD!')
    p.grow(sx - 13, sy - 40, sx + 13, sy)
  } },

  'printing-money': { size: [3, 2], draw(p) {
    // The conveyor, then the bills riding on it.
    // The belt: Unity's (Props8.cs, Conveyor); the bills riding it the page's.
    p.model('conveyor', [1.35, 0.72, 2], { w: 1.6, d: 0.5 }, () => null)
    const belt = p.plane(1.35, 0.72, 2)
    if (!p.real) belt.add(new N('rect', { x: 0, y: 0, width: 1.6, height: 0.5, fill: '#2c355e', stroke: INK, 'stroke-width': 0.05 }))
    if (!p.real) for (let k = 0; k < 9; k++) belt.add(new N('line', { x1: k * 0.2, y1: 0, x2: k * 0.2, y2: 0.5, stroke: '#4a5690', 'stroke-width': 0.031 }))
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
    // On the realistic island, smoke: soft, no edge to it.
    const smoke = p.real ? puffShade(p.el('defs'), 'pm-smoke', '#eceef3', 0.75) : null
    for (let k = 0; k < 3; k++) p.el('circle', { cx, cy, r: smoke ? 9 : 7, fill: smoke ?? '#ffffff', stroke: smoke ? undefined : INK, 'stroke-width': smoke ? undefined : 1.2, class: 'puff', style: `animation-delay:${k}s` })
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
    p.windows(mall, 'x', { cols: 4, z0: 28, h: 9, wide: 0.55, pane: '#4a5690', frame: '#3b4675' })
    // A glass front and a revolving door.
    p.quad(mall, 'y', 0.3, 0.78, 0, 20, '#6f7cb8', { sw: 1.2 })
    for (let k = 1; k < 4; k++) p.quad(mall, 'y', 0.3 + k * 0.12 - 0.003, 0.3 + k * 0.12 + 0.003, 0, 20, INK, { sw: 0 })
    p.light(p.at(1, 1.65, 12), p.quad(mall, 'y', 0.31, 0.77, 10, 19, '#8592cc', { sw: 0 }), '#ffe6a1', 12, 'y')
    // An LED ticker over the doors that never quite runs out.
    p.light(p.at(1, 1.65, 27), p.quad(mall, 'y', 0.06, 0.94, 23, 31, '#11162e', { sw: 1.2 }), null, 27, 'y')
    const tk = glow(p.face(mall, 'y', 0.5, 24.8, { w: 54, h: 7 }))
    letter(tk, 0, 0, 'SALE ENDS 0:59', { size: 4.8, fill: C.rasp, font: 'Silkscreen, monospace', weight: 400, cls: 'blink' })
    // The rooftop sign: neon tubes on a dark board, on legs.
    for (const x of [0.5, 1.5]) { p.line([x, 0.88, 44], [x, 0.92, 52], { sw: 1.6 }); p.line([x, 0.8, 44], [x, 0.92, 52], { sw: 1 }) }
    const bd = p.box(0.28, 0.9, 1.44, 0.05, 11, { z0: 51, fill: '#3b4675', sw: 1.3 })
    p.light(p.at(1, 0.95, 56), p.quad(bd, 'y', 0.03, 0.97, 1, 10, '#1b2140', { sw: 0.8 }), null, 56, 'y')
    const ns = glow(p.face(bd, 'y', 0.5, 3.2, { w: 46, h: 11 }))
    neon(ns, 0, 0, 'ONLY 1 LEFT!', C.mint, { size: 6.6, cls: 'blink-slow' })
    // Round the side: an exit sign that points both ways, over a door that is painted on.
    p.quad(mall, 'x', 0.6, 0.8, 0, 17, '#3b4675', { sw: 1.1 })
    p.quad(mall, 'x', 0.62, 0.78, 0, 15.5, '#2c355e', { sw: 0.8 })
    p.quad(mall, 'x', 0.75, 0.765, 7, 9, '#9aa3c0', { sw: 0 })
    const ex = glow(p.face(mall, 'x', 0.7, 19.6, { w: 26, h: 6 }))
    neon(ex, 0, 0, 'EXIT', '#7dffc9', { size: 5 })
    ex.add(new N('path', { d: 'M-9 -1.8h-4m1.6 -1.6l-1.6 1.6l1.6 1.6M9 -1.8h4m-1.6 -1.6l1.6 1.6l-1.6 1.6', fill: 'none', stroke: '#7dffc9', 'stroke-width': 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
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
    // Unity's superyacht (Creatures8.cs), at anchor, a little white water along its hull.
    const yacht = creatureUse('yacht', C.cobalt, 'stand', 'e', { transform: `translate(${f(x)} ${f(y + 4)})` })
    if (yacht) {
      b.el('ellipse', { cx: x - 4, cy: y + 4, rx: 70, ry: 9, fill: '#ffffff', opacity: 0.22 })
      b.g.add(yacht)
      p.grow(x - 90, y - 90, x + 90, y + 20)
    } else {
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
    // A pennant on the mast, so everyone knows what it cost.
    b.path(`M${f(x + 8)} ${f(y - 70)}v-8`, 'none', { sw: 1.2 })
    b.path(`M${f(x + 8)} ${f(y - 78)}h14l-3 4l3 4h-14z`, C.bill, { sw: 1.1, cls: 'flutter' })
    b.el('text', { x: x + 14, y: y - 71.6, 'text-anchor': 'middle', 'font-family': 'Fredoka, sans-serif', 'font-weight': 700, 'font-size': 6, fill: '#2c8f68' }).text('$')
    p.grow(x - 80, y - 90, x + 70, y + 20)
    }
    // A jet ski doing laps.
    const js = p.group('jetski')
    const [jx, jy] = p.at(0.2, 1.9, -8)
    const ski = creatureUse('jetski', C.rasp, 'stand', 'e', { transform: `translate(${f(jx)} ${f(jy + 1)})` })
    if (ski) js.g.add(ski)
    else js.path(`M${f(jx - 10)} ${f(jy)}l18 -3l4 4l-20 3z`, C.rasp, { sw: 1.2 })
    js.el('path', { d: `M${f(jx - 12)} ${f(jy + 3)}q-12 3 -22 0`, stroke: '#ffffff', 'stroke-width': p.real ? 1.6 : 2, opacity: p.real ? 0.7 : undefined, fill: 'none', 'stroke-linecap': 'round' })
    void crate; void lamp; void flag; void person
  } },
}

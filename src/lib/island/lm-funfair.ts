/** The Funfair: the internet, the reviews, the progress bar, too many lights. */
import { ballShade, C, INK, N, OUT, shade, r1 as f, letter, glow, type Landmark, Pen } from './kit'
import { creatureUse } from './actors'
import { person, tree, flag, lamp, flowers, bench } from './props'

/** A five-point star at a point, in a group (painted on a sign). */
const starPath = (x: number, y: number, r: number) => {
  let d = ''
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; d += `${k ? 'L' : 'M'}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}` }
  return d + 'Z'
}

/** How far through the year a date is, as a whole percent. */
export const yearPercent = (d = new Date()) => {
  const y = d.getFullYear(), a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1)
  return Math.floor(((Date.UTC(y, d.getMonth(), d.getDate()) - a) / (b - a)) * 100)
}

/** A hard hat on someone already drawn at (x, y). */
const hardHat = (p: Pen, x: number, y: number, c = '#ffffff') => {
  const [hx, hy] = p.at(x, y)
  p.el('path', { d: `M${f(hx - 4)} ${f(hy - 18.6)}a4 3.8 0 0 1 8 0h1.2v1.2h-10.4v-1.2z`, fill: c, stroke: INK, 'stroke-width': 1 })
}

export const funfair: Record<string, Landmark> = {
  'earth-reviews': { size: [2, 2], draw(p) {
    const shop = p.box(0.2, 0.3, 1.6, 1.3, 30, { fill: C.white, trim: C.mint })
    p.windows(shop, 'y', { cols: 2, z0: 4, h: 15, wide: 0.6, pane: '#cfe8ff' })
    p.door(shop, 'y', 0.5, { w: 0.24, h: 17, fill: C.mint })
    p.awning(shop, 'y', 0.02, 0.98, 26, 0.22, [C.mint, '#ffffff'])
    p.windows(shop, 'x', { cols: 2, z0: 10, h: 10, wide: 0.5 })
    // A proper rooftop billboard: steel legs, a catwalk, lamps, and the poster.
    for (const x of [0.55, 1.45]) {
      p.box(x - 0.04, 0.76, 0.08, 0.05, 16, { z0: 30, fill: '#9aa3c0', sw: 1 })
      p.line([x, 0.72, 30], [x, 0.78, 44], { sw: 1.2 })
    }
    p.box(0.3, 0.84, 1.4, 0.14, 1.6, { z0: 43, fill: '#c9cde0', sw: 1 })
    for (let k = 0; k <= 7; k++) p.line([0.3 + k * 0.2, 0.98, 44.6], [0.3 + k * 0.2, 0.98, 49], { sw: 0.7 })
    p.line([0.3, 0.98, 49], [1.7, 0.98, 49], { sw: 0.9 })
    const bd = p.box(0.26, 0.76, 1.48, 0.07, 30, { z0: 45, fill: '#ffffff' })
    // The poster: printed on the board by Unity (kit.ts, decal); its words and its twinkling stars the page's.
    const posterAt: [number, number, number, number] = [-24, -30, 24, 0]
    p.decal('earth-poster', bd, 'y', 0.5, 0, posterAt)
    const g = p.face(bd, 'y', 0.5, 0, { w: 48, h: 30 })
    g.add(new N('rect', { x: -22.5, y: -28, width: 45, height: 26, fill: '#eaf3ff' }))
    // Earth, giving itself a review.
    g.add(new N('circle', { cx: -13, cy: -15, r: 8.5, fill: C.sky, stroke: INK, 'stroke-width': 1 }))
    g.add(new N('path', { d: 'M-18 -19q3 -3 6 -1q2 3 -1 5q-4 1 -5 -4zM-11 -10q4 -2 6 1q-1 4 -5 3zM-8 -21q2 -1 3 1', fill: C.mint, stroke: INK, 'stroke-width': 0.7 }))
    g.add(new N('path', { d: 'M-16 -14.5q1.2 1.4 2.4 0M-12.2 -14.5q1.2 1.4 2.4 0', fill: 'none', stroke: INK, 'stroke-width': 0.8, 'stroke-linecap': 'round' }))
    g.add(new N('path', { d: 'M-15 -11q2 -1.6 4 0', fill: 'none', stroke: INK, 'stroke-width': 0.8, 'stroke-linecap': 'round' }))
    letter(g, 7, -19, 'GRAVITY', { size: 6.4, ls: 0.3 })
    for (let k = 0; k < 5; k++) g.add(new N('path', { d: starPath(-3.5 + k * 5.2, -12, 2.3), fill: k < 2 ? C.rasp : '#d3d9ec', stroke: INK, 'stroke-width': 0.6, 'stroke-linejoin': 'round', class: k < 2 ? 'er-star' : undefined, style: `animation-delay:${k * 0.3}s` }))
    letter(g, 7, -5.5, '“keeps pulling me down”', { size: 3.4, weight: 500, fill: '#56607e' })
    p.printFace(g, 'earth-poster', posterAt)
    // Gooseneck lamps along the top, lighting the poster at night.
    for (const x of [0.6, 1.4]) {
      const [lx, ly] = p.at(x, 0.8, 75)
      p.path(`M${f(lx)} ${f(ly)}v-5q0 -4 5 -3`, 'none', { sw: 1.3 })
      p.light([lx + 6, ly - 7], p.el('ellipse', { cx: lx + 6, cy: ly - 7.6, rx: 2.6, ry: 1.6, fill: '#f4f6fc', stroke: INK, 'stroke-width': 0.9 }), '#ffe6a1', 82)
    }
    // A shopping trolley, and the returns queue.
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
    // The wheel turns about its hub, so Unity renders it (Buildings.cs, Wheel) square round the hub.
    const wheel = p.group('spin')
    wheel.model('wheel', [0.9, 0.9, 80], { half: 64, fill: C.lilac, top: C.rasp }, () => {
      wheel.el('circle', { cx: hx, cy: hy, r: 58, fill: 'none', stroke: INK, 'stroke-width': 5 })
      wheel.el('circle', { cx: hx, cy: hy, r: 58, fill: 'none', stroke: C.lilac, 'stroke-width': 2.5 })
      wheel.el('circle', { cx: hx, cy: hy, r: 40, fill: 'none', stroke: INK, 'stroke-width': 1.5 })
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; wheel.el('line', { x1: hx, y1: hy, x2: hx + Math.cos(a) * 58, y2: hy + Math.sin(a) * 58, stroke: INK, 'stroke-width': 1.4 }) }
      wheel.el('circle', { cx: hx, cy: hy, r: 7, fill: C.rasp, stroke: INK, 'stroke-width': OUT })
    })
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2, x = hx + Math.cos(a) * 58, y = hy + Math.sin(a) * 58
      wheel.el('circle', { cx: hx + Math.cos(a + 0.31) * 58, cy: hy + Math.sin(a + 0.31) * 58, r: 2.4, fill: '#ffffff', stroke: INK, 'stroke-width': 0.6, class: 'chase', style: `animation-delay:${k * 0.1}s` })
      // Each car hangs level while the wheel turns.
      const car = new Pen(wheel.el('g', { class: 'spin-rev', style: `transform-origin:${f(x)}px ${f(y)}px` }), wheel.ox, wheel.oy, wheel.oz, wheel.b, wheel.lights, wheel.sink)
      const fill = [C.rasp, C.mint, C.sky, C.lilac, C.cobalt][k % 5]
      car.model('car', [0.9, 0.9, 80], { dx: f(x - hx), dy: f(y - hy), fill }, () => {
        car.el('path', { d: `M${f(x - 7)} ${f(y)}h14v7a3 3 0 0 1 -3 3h-8a3 3 0 0 1 -3 -3z`, fill, stroke: INK, 'stroke-width': 1.4 })
        car.el('path', { d: `M${f(x - 6)} ${f(y)}q6 -6 12 0`, fill: 'none', stroke: INK, 'stroke-width': 1.2 })
      })
    }
    p.grow(hx - 70, hy - 70, hx + 70, hy + 70)
    // After dark the rim's bulbs shine through: a ring of them turning with the wheel.
    const ring = glow(new N('g', { class: 'spin' }))
    ring.add(new N('circle', { cx: hx, cy: hy, r: 58, fill: 'none', stroke: '#ffffff', 'stroke-width': 1, opacity: 0 }))
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2 + 0.31; ring.add(new N('circle', { cx: f(hx + Math.cos(a) * 58), cy: f(hy + Math.sin(a) * 58), r: 2.2, fill: ['#fff6dc', '#ffd1da', '#d6ecff', '#d8f7ec'][k % 4], class: 'chase', style: `animation-delay:${(k % 5) * 0.1}s` })) }
    ring.add(new N('circle', { cx: hx, cy: hy, r: 4, fill: '#ffd1da' }))
    // A mast of screens, all shouting at once.
    p.line([1.86, 0.5, 0], [1.86, 0.5, 88], { sw: 3.2 })
    p.line([1.86, 0.5, 0], [1.86, 0.5, 88], { sw: 1.2, stroke: '#9aa3c0' })
    const screens: [number, number, 'x' | 'y', string, number][] = [[1.62, 0.56, 'y', 'like', 26], [1.92, 0.22, 'x', 'new', 46], [1.62, 0.56, 'y', 'bang', 66]]
    screens.forEach(([x, y, face, kind, z], k) => {
      const b = face === 'y' ? p.box(x, y, 0.52, 0.05, 19, { z0: z, fill: C.slate, sw: 1.2 }) : p.box(x, y, 0.05, 0.56, 19, { z0: z, fill: C.slate, sw: 1.2 })
      const s = glow(p.face(b, face, 0.5, 1.6, { w: 18, h: 16 }))
      const w = 15
      const scr = s.add(new N('g', { class: 'pop', style: `animation-delay:${k * 0.7}s` }))
      scr.add(new N('rect', { x: -w / 2, y: -15.8, width: w, height: 15, fill: ['#ff8fb0', C.mint, '#8ccbff'][k] }))
      if (kind === 'like') scr.add(new N('path', { d: 'M0 -3.6l-4.6 -4.6a2.7 2.7 0 0 1 4.6 -3.8a2.7 2.7 0 0 1 4.6 3.8z', fill: '#ffffff', stroke: INK, 'stroke-width': 0.6 }))
      if (kind === 'new') letter(scr, 0, -6, 'NEW!', { size: 6, fill: INK })
      if (kind === 'bang') letter(scr, 0, -4.4, '!!!', { size: 10, fill: C.rasp })
    })
    // A ticket booth covered in bulbs, with balloons tied to it.
    const bth = p.box(1.25, 1.25, 0.65, 0.65, 22, { fill: C.rasp, top: shade(C.rasp, 1.1) })
    p.windows(bth, 'y', { cols: 1, z0: 8, h: 8, wide: 0.6, pane: '#ffffff' })
    p.gable(1.25, 1.25, 0.65, 0.65, 22, 12, '#ffffff', 'y', { lines: 1 })
    const bulbs = glow(new N('g'))
    for (let k = 0; k < 6; k++) { const [x, y] = p.at(1.25 + k * 0.13, 1.9, 22); p.el('circle', { cx: x, cy: y, r: 2, fill: '#ffffff', stroke: INK, 'stroke-width': 0.6, class: 'chase', style: `animation-delay:${k * 0.12}s` }); bulbs.add(new N('circle', { cx: x, cy: y, r: 1.8, fill: '#fff6dc', class: 'chase', style: `animation-delay:${k * 0.12}s` })) }
    const [kx, ky] = p.at(1.9, 1.5, 14)
    for (const [dx, dy, c] of [[6, -34, C.mint], [12, -28, C.lilac], [1, -26, C.sky]] as const) {
      p.path(`M${f(kx)} ${f(ky)}q${f(dx * 0.4)} ${f(dy * 0.5)} ${f(dx)} ${f(dy + 6)}`, 'none', { sw: 0.8 })
      // A balloon: on the realistic island, lit, shiny, a knot at its foot.
      if (p.real) { const bl = p.el('g', { class: 'bob' }); bl.add(new N('ellipse', { cx: kx + dx, cy: ky + dy, rx: 5, ry: 6.4, fill: ballShade(bl, `ff-bal${dx}`, c) })); bl.add(new N('path', { d: `M${f(kx + dx - 1)} ${f(ky + dy + 7.2)}l1 -1l1 1z`, fill: shade(c, 0.7) })) }
      else p.el('ellipse', { cx: kx + dx, cy: ky + dy, rx: 5, ry: 6.4, fill: c, stroke: INK, 'stroke-width': 1.1, class: 'bob' })
    }
    p.grow(kx - 6, ky - 42, kx + 18, ky)
    person(p, 0.3, 1.8, C.mint, { pose: 'wave' }); person(p, 0.5, 1.9, C.sky)
    flag(p, 1.3, 1.3, 34, C.mint, 14)
  } },

  'internet-artifacts': { size: [2, 2], draw(p) {
    // The Museum of the Internet: a hall with an old computer in its window,
    // a floppy disk for a shop sign, a dial-up dish, and a pixel balloon.
    p.box(0.06, 0.06, 1.88, 1.88, 4, { fill: C.stone })
    const hall = p.box(0.2, 0.16, 1.52, 1.22, 36, { z0: 4, fill: '#eef0f8' })
    p.band(hall, 26, 33, C.cobalt)
    p.box(0.16, 0.12, 1.6, 1.3, 3, { z0: 40, fill: '#dfe4f5', sw: 1.2 })
    // The display window: the exhibits behind the glass.
    p.quad(hall, 'y', 0.05, 0.63, 4, 23, '#ffffff', { sw: 1.2 })
    p.quad(hall, 'y', 0.07, 0.61, 5.5, 21.5, '#26346a', { sw: 1 })
    p.light(p.at(0.2 + 1.52 * 0.34, 1.38, 18), p.quad(hall, 'y', 0.07, 0.61, 14, 21.5, '#33447e', { sw: 0 }), '#ffe6a1', 18, 'y')
    // The exhibits printed behind the glass by Unity (kit.ts, decal); the screen's text the page's.
    const exAt: [number, number, number, number] = [-13, -16, 13, 0]
    p.decal('ia-exhibits', hall, 'y', 0.34, 5.5, exAt)
    const ex = p.face(hall, 'y', 0.34, 5.5, { w: 26, h: 16 })
    // A beige-grey computer on a plinth: case, screen, green text, keyboard.
    ex.add(new N('rect', { x: -6, y: -3, width: 12, height: 3, fill: '#c9cde0', stroke: INK, 'stroke-width': 0.6 }))
    ex.add(new N('rect', { x: -5.5, y: -14.5, width: 11, height: 10, rx: 1, fill: '#e6e3da', stroke: INK, 'stroke-width': 0.7 }))
    ex.add(new N('rect', { x: -4, y: -13, width: 8, height: 6, rx: 0.6, fill: '#12202e' }))
    for (let k = 0; k < 3; k++) ex.add(new N('rect', { x: -3.2, y: -12 + k * 1.7, width: 2 + ((k * 3) % 4), height: 0.8, fill: C.mint, class: 'ia-line', style: `animation-delay:${k * 0.4}s` }))
    ex.add(new N('rect', { x: -5.5, y: -4.5, width: 11, height: 1.5, fill: '#e6e3da', stroke: INK, 'stroke-width': 0.5 }))
    // A floppy disk and a mouse pointer, on stands of their own.
    ex.add(new N('rect', { x: 7, y: -9, width: 5, height: 5, rx: 0.4, fill: C.cobalt, stroke: INK, 'stroke-width': 0.6 }))
    ex.add(new N('rect', { x: 8.2, y: -9, width: 2.6, height: 1.6, fill: '#e3e8f7' }))
    ex.add(new N('rect', { x: 8, y: -4, width: 3, height: 4, fill: '#c9cde0', stroke: INK, 'stroke-width': 0.5 }))
    ex.add(new N('path', { d: 'M-12 -12v7l1.6 -1.6l1.2 2.6l1.2 -0.6l-1.2 -2.4h2.2z', fill: '#ffffff', stroke: INK, 'stroke-width': 0.6, 'stroke-linejoin': 'round' }))
    ex.add(new N('rect', { x: -11.6, y: -4, width: 2.4, height: 4, fill: '#c9cde0', stroke: INK, 'stroke-width': 0.5 }))
    p.printFace(ex, 'ia-exhibits', exAt)
    // Glass doors, and the name round the top.
    p.quad(hall, 'y', 0.71, 0.93, 0, 21, '#ffffff', { sw: 1.1 })
    p.quad(hall, 'y', 0.73, 0.91, 0, 19, shade(C.glass, 0.84), { sw: 0.9 })
    p.quad(hall, 'y', 0.817, 0.823, 0, 19, INK, { sw: 0 })
    const nm = p.face(hall, 'y', 0.5, 27.6, { w: 48, h: 7 })
    letter(nm, 0, 0, 'INTERNET MUSEUM', { size: 4.9, fill: '#ffffff', ls: 0.35 })
    p.windows(hall, 'x', { cols: 3, z0: 8, h: 13, wide: 0.5 })
    const nx = p.face(hall, 'x', 0.5, 27.6, { w: 38, h: 7 })
    letter(nx, 0, 0, 'EST. 1991', { size: 4.6, fill: '#ffffff', ls: 0.4 })
    // A blade sign, a floppy disk, sticking out from the corner.
    p.line([1.72, 1.24, 30], [1.92, 1.24, 30], { sw: 1.3 })
    const bl = p.box(1.78, 1.22, 0.16, 0.03, 11, { z0: 18, fill: C.cobalt, sw: 1 })
    const flAt: [number, number, number, number] = [-2.4, -10.4, 2.4, -0.6]
    p.decal('ia-floppy', bl, 'y', 0.5, 0.5, flAt)
    const fl = p.face(bl, 'y', 0.5, 0.5, { w: 6, h: 11 })
    fl.add(new N('rect', { x: -1.8, y: -10, width: 3.6, height: 3, fill: '#e3e8f7', stroke: INK, 'stroke-width': 0.4 }))
    fl.add(new N('rect', { x: -2, y: -5, width: 4, height: 4, fill: '#ffffff', stroke: INK, 'stroke-width': 0.4 }))
    p.printFace(fl, 'ia-floppy', flAt)
    // On the roof: a dish for the dial-up, and a pixel balloon on a string.
    const [dx, dy] = p.at(0.55, 0.45, 43)
    p.model('dish', [0.55, 0.45, 43], { r: 9 }, () => {
      p.path(`M${f(dx)} ${f(dy)}v-8`, 'none', { sw: 1.6 })
      p.path(`M${f(dx - 9)} ${f(dy - 14)}q9 12 18 0z`, '#ffffff', { sw: 1.3 })
      p.path(`M${f(dx)} ${f(dy - 8)}l4 -9`, 'none', { sw: 1 })
    })
    const [ax, ay] = p.at(1.2, 0.6, 43)
    const [bx, by] = p.at(1.5, 0.4, 78)
    p.path(`M${f(ax)} ${f(ay)}Q${f(ax + 16)} ${f(ay - 40)} ${f(bx - 4)} ${f(by + 16)}`, 'none', { sw: 0.9 })
    const fly = p.group('bob')
    // Unity's foil balloon with its rainbow streamer (Creatures8.cs).
    const foil = creatureUse('pixelballoon', '#e4e8f0', 'stand', 'se', { transform: `translate(${f(bx - 2)} ${f(by - 2)})` })
    if (foil) fly.g.add(foil)
    else {
    ;[C.rasp, '#ffffff', C.mint, C.sky, C.cobalt, C.lilac].forEach((c, k) => fly.el('rect', { x: bx - 40, y: by - 8 + k * 2.8, width: 30, height: 2.8, fill: c }))
    fly.path(`M${f(bx - 12)} ${f(by - 12)}h20v20h-20z`, '#eceff8', { sw: 1.4 })
    fly.path(`M${f(bx - 9)} ${f(by - 9)}h14v11h-14z`, '#12202e', { sw: 0.9 })
    fly.el('rect', { x: bx - 6, y: by - 6, width: 2.4, height: 2.4, fill: C.mint })
    fly.el('rect', { x: bx - 1, y: by - 6, width: 2.4, height: 2.4, fill: C.mint })
    fly.el('rect', { x: bx - 6, y: by - 2, width: 7.4, height: 1.4, fill: C.mint })
    }
    p.grow(bx - 44, by - 16, bx + 12, ay)
    // Visitors.
    person(p, 1.9, 1.62, C.rasp, { pose: 'look' }); person(p, 0.3, 1.82, C.mint); person(p, 1.45, 1.88, C.lilac)
    lamp(p, 1.9, 0.12)
  } },

  progress: { size: [2, 1], draw(p) {
    // A building site: the year, going up. As many floors are built as the
    // year has gone, and the hoarding out front keeps the count.
    const pct = yearPercent()
    const site = p.plane(0.05, 0.05, 0)
    site.add(new N('rect', { width: 1.9, height: 0.9, fill: '#dfe2ee', stroke: INK, 'stroke-width': 0.025 }))
    for (const [x, y] of [[0.3, 0.2], [1.5, 0.75], [0.9, 0.82]]) site.add(new N('circle', { cx: x, cy: y, r: 0.03, fill: '#b9bed6' }))
    p.grow(...p.at(0.05, 0.05), ...p.at(1.95, 0.95))
    // The floors built so far, then the one going up: a slab, columns, half a wall.
    const floors = 4, done = Math.max(1, Math.min(floors - 1, Math.floor((pct / 100) * floors))), fh = 19
    const b = p.box(0.2, 0.12, 1.0, 0.56, done * fh, { fill: C.white, trim: '#d5d9ea' })
    p.windows(b, 'x', { rows: done, cols: 2, z0: 6, h: 8, gap: fh - 8, wide: 0.42 })
    p.windows(b, 'y', { rows: done, cols: 3, z0: 6, h: 8, gap: fh - 8, wide: 0.42 })
    const z1 = done * fh
    p.box(0.2, 0.12, 1.0, 0.56, 1.5, { z0: z1, fill: '#c9cde0', sw: 1 })
    for (const [x, y] of [[0.22, 0.14], [1.16, 0.14], [0.22, 0.64], [1.16, 0.64], [0.69, 0.64]] as const) p.box(x, y, 0.04, 0.04, fh, { z0: z1 + 1.5, fill: '#c9cde0', sw: 0.9 })
    const part = p.box(0.2, 0.62, 0.5, 0.06, fh * 0.8, { z0: z1 + 1.5, fill: C.white, sw: 1 })
    void part
    // Scaffold up the front, with planks at each floor.
    for (const x of [0.24, 0.6, 0.96, 1.22]) p.line([x, 0.76, 0], [x, 0.76, z1 + 12], { sw: 1 })
    for (let k = 1; k <= done + 1; k++) p.line([0.2, 0.76, k * fh], [1.26, 0.76, k * fh], { sw: 1.6, stroke: C.wood })
    p.line([0.24, 0.76, 0], [0.96, 0.76, z1], { sw: 0.7 })
    // The tower crane, its hook lowering the next beam.
    const mx = 1.62, my = 0.42, top = 104
    p.box(mx - 0.1, my - 0.1, 0.2, 0.2, 4, { fill: C.slate, sw: 1 })
    p.line([mx - 0.04, my, 4], [mx - 0.04, my, top], { sw: 1.6 }); p.line([mx + 0.04, my, 4], [mx + 0.04, my, top], { sw: 1.6 })
    for (let z = 8; z < top; z += 8) p.line([mx - 0.04, my, z], [mx + 0.04, my, z + 8], { sw: 0.8 })
    p.box(mx - 0.02, my + 0.04, 0.14, 0.12, 7, { z0: top - 8, fill: C.mint, sw: 1 })
    p.line([0.1, my, top], [1.98, my, top], { sw: 1.4 }); p.line([0.1, my, top + 5], [1.98, my, top + 5], { sw: 1.1 })
    for (let x = 0.1; x < 1.95; x += 0.16) p.line([x, my, top], [x + 0.08, my, top + 5], { sw: 0.7 })
    p.line([mx, my, top + 16], [0.1, my, top + 5], { sw: 0.8 }); p.line([mx, my, top + 16], [1.98, my, top + 5], { sw: 0.8 })
    p.line([mx, my, top], [mx, my, top + 16], { sw: 1.4 })
    p.box(1.86, my - 0.06, 0.12, 0.12, 6, { z0: top - 6, fill: C.slate, sw: 1 })
    const hook = p.group('bob')
    hook.line([0.7, my, top], [0.7, my, z1 + 30], { sw: 0.8 })
    hook.box(0.48, my - 0.03, 0.44, 0.06, 2.5, { z0: z1 + 26, fill: C.rasp, sw: 0.9 })
    person(p, 1.42, 0.62, C.lilac); hardHat(p, 1.42, 0.62)
    // The hoarding, and the count painted on it.
    const ho = p.box(0.06, 0.88, 1.84, 0.04, 13, { fill: '#ffffff', sw: 1.2 })
    const hoardAt: [number, number, number, number] = [-29, -13, 29, 0]
    p.decal('progress-hoarding', ho, 'y', 0.5, 0, hoardAt)
    const sg = p.face(ho, 'y', 0.5, 0, { w: 58, h: 13 })
    sg.add(new N('rect', { x: -28, y: -12.4, width: 56, height: 11.8, fill: '#eef0f8' }))
    letter(sg, -26, -7, `${new Date().getFullYear()} SO FAR`, { size: 4.4, anchor: 'start', cls: 'pg-year' })
    letter(sg, 26, -6.6, `${pct}%`, { size: 5.6, anchor: 'end', cls: 'pg-pct' })
    sg.add(new N('rect', { x: -26, y: -5, width: 52, height: 3, rx: 1, fill: '#ffffff', stroke: INK, 'stroke-width': 0.6 }))
    sg.add(new N('rect', { x: -26, y: -5, width: f((52 * pct) / 100), height: 3, rx: 1, fill: C.mint, stroke: INK, 'stroke-width': 0.6, class: 'pg-bar', 'data-w': 52 }))
    p.printFace(sg, 'progress-hoarding', hoardAt)
    // The crew, in hard hats, and a cone.
    const sc = p.move(0, 0, fh * 2)
    person(sc, 0.78, 0.78, C.cobalt); hardHat(sc, 0.78, 0.78)
    const tp = p.move(0, 0, z1 + 1.5)
    person(tp, 0.95, 0.4, C.mint, { pose: 'wave' }); hardHat(tp, 0.95, 0.4, C.rasp)
    const [cx, cy] = p.at(1.95, 0.6)
    p.path(`M${f(cx - 3)} ${f(cy)}l2 -8h2l2 8z`, C.rasp, { sw: 1 })
    p.path(`M${f(cx - 2.2)} ${f(cy - 3.5)}h4.4`, 'none', { sw: 1.4, stroke: '#ffffff' })
    void bench; void flowers; void tree; void lamp
  } },
}

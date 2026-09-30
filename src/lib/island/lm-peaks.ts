/** Sky Peaks: space, sky and scale, on the highest ground. */
import { C, INK, N, OUT, P, shade, r1 as f, motionPath, type Landmark, type Pen } from './kit'
import { person, lamp, bench, flag, tree, fence } from './props'

const star = (p: Pen, x: number, y: number, r: number, cls = 'twinkle', delay = 0) =>
  p.path(`M${f(x)} ${f(y - r)}L${f(x + r * 0.3)} ${f(y - r * 0.3)}L${f(x + r)} ${f(y)}L${f(x + r * 0.3)} ${f(y + r * 0.3)}L${f(x)} ${f(y + r)}L${f(x - r * 0.3)} ${f(y + r * 0.3)}L${f(x - r)} ${f(y)}L${f(x - r * 0.3)} ${f(y - r * 0.3)}Z`, '#ffffff', { sw: 1.2, cls, style: delay ? `animation-delay:${delay}s` : undefined })

export const peaks: Record<string, Landmark> = {
  'space-elevator': { size: [2, 2], draw(p) {
    const base = p.box(0.05, 0.05, 1.9, 1.9, 10, { fill: C.stone })
    p.band(base, 3, 6, C.lilac)
    const st = p.box(0.5, 0.5, 1, 1, 30, { z0: 10, fill: C.white, trim: C.cobalt })
    p.windows(st, 'x', { rows: 2, cols: 3, z0: 5, h: 6, gap: 5, wide: 0.5 })
    p.windows(st, 'y', { rows: 2, cols: 3, z0: 5, h: 6, gap: 5, wide: 0.5 })
    p.box(0.62, 0.62, 0.76, 0.76, 6, { z0: 40, fill: C.stone2 })
    // Tethers from the four corners to the cable.
    for (const [x, y] of [[0.2, 0.2], [1.8, 0.2], [0.2, 1.8], [1.8, 1.8]] as const) p.line([x, y, 10], [1, 1, 120], { sw: 1.8 })
    // The cable itself goes on up out of the frame; only its foot counts towards the building's box.
    const [cx, cy] = P(1 + p.ox, 1 + p.oy, 46 + p.oz)
    p.el('path', { d: `M${f(cx)} ${f(cy)}V${f(cy - 1500)}`, stroke: INK, 'stroke-width': 4.5, fill: 'none' })
    p.el('path', { d: `M${f(cx)} ${f(cy)}V${f(cy - 1500)}`, stroke: '#ffffff', 'stroke-width': 1.4, fill: 'none' })
    for (let k = 1; k < 10; k++) p.el('circle', { cx, cy: cy - k * 150, r: 2.6, fill: C.rasp, class: 'blink', style: `animation-delay:${k * 0.2}s` })
    p.grow(cx - 20, cy - 200, cx + 20, cy)
    const pod = p.group('se-pod')
    pod.el('rect', { x: cx - 10, y: cy - 150, width: 20, height: 28, rx: 7, fill: C.lilac, stroke: INK, 'stroke-width': OUT })
    pod.el('rect', { x: cx - 6, y: cy - 144, width: 12, height: 8, rx: 2.5, fill: C.glass, stroke: INK, 'stroke-width': 1 })
    pod.el('rect', { x: cx - 10, y: cy - 128, width: 20, height: 4, fill: shade(C.lilac, 0.8), stroke: INK, 'stroke-width': 1 })
    p.door(st, 'y', 0.5, { w: 0.24, h: 14 })
    person(p.move(0, 0, 10), 1.75, 1.3, C.rasp, { pose: 'look' })
    person(p.move(0, 0, 10), 1.3, 1.78, C.mint, { hat: C.cobalt })
    flag(p.move(0, 0, 10), 0.25, 1.75, 0, C.mint)
  } },

  'constellation-draw': { size: [2, 2], draw(p) {
    p.box(0.15, 0.15, 1.7, 1.7, 8, { fill: C.stone2 })
    p.cyl(1, 1, 0.62, 8, 30, C.white, { bands: [[21, 24, C.cobalt]] })
    const [dx, dy] = p.at(1, 1, 8)
    p.path(`M${f(dx - 6)} ${f(dy + 22)}v-16h12v16`, shade(C.cobalt, 0.85), { sw: 1.2 })
    p.dome(1, 1, 0.64, 38, '#6f92ff')
    const [tx, ty] = p.at(1, 1, 38)
    p.path(`M${f(tx - 5)} ${f(ty - 1)}L${f(tx - 6)} ${f(ty - 40)}L${f(tx + 6)} ${f(ty - 40)}L${f(tx + 5)} ${f(ty - 1)}Z`, '#1f2a5c', { sw: 1.2 })
    p.path(`M${f(tx - 1)} ${f(ty - 22)}L${f(tx + 30)} ${f(ty - 58)}`, 'none', { sw: 10 })
    p.path(`M${f(tx - 1)} ${f(ty - 22)}L${f(tx + 30)} ${f(ty - 58)}`, 'none', { sw: 6, stroke: C.white })
    p.path(`M${f(tx + 22)} ${f(ty - 49)}l6 5`, 'none', { sw: 3, stroke: C.cobalt })
    const pts: [number, number][] = [[-48, -98], [-18, -122], [14, -108], [44, -130], [30, -84], [60, -100]].map(([a, b]) => [tx + a, ty + b])
    const g = p.group('cd-lines')
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [2, 4], [3, 5]]) g.path(`M${f(pts[i][0])} ${f(pts[i][1])}L${f(pts[j][0])} ${f(pts[j][1])}`, 'none', { stroke: C.sky, sw: 2, style: 'stroke-dasharray:3 5' })
    pts.forEach(([x, y], i) => star(p, x, y, i % 2 ? 5 : 7, 'twinkle', i * 0.35))
    const shed = p.box(1.5, 0.2, 0.4, 0.4, 14, { z0: 8, fill: C.white })
    p.gable(1.5, 0.2, 0.4, 0.4, 22, 8, C.rasp, 'y', { lines: 1 })
    p.windows(shed, 'x', { cols: 1, z0: 5, h: 5, wide: 0.4 })
    person(p.move(0, 0, 8), 0.45, 1.55, C.cobalt, { pose: 'wave' })
    lamp(p.move(0, 0, 8), 1.7, 1.7, 20)
  } },

  'universe-forecast': { size: [2, 2], draw(p) {
    p.disc(1, 1, 0.98, 0, '#62e8c9')
    p.disc(1, 1, 0.78, 1, '#8aeed6', { sw: 1, dash: '4 4' })
    p.disc(1, 1, 0.18, 1, C.stone2)
    const ring = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; return [1 + Math.cos(a) * 0.72, 1 + Math.sin(a) * 0.72, 20 + (k % 3) * 3] as const })
      .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
    for (const [x, y, h] of ring) {
      p.box(x - 0.07, y - 0.07, 0.14, 0.14, h, { fill: '#c9cde0' })
      p.line([x - 0.02, y + 0.07, h * 0.3], [x - 0.02, y + 0.07, h * 0.7], { sw: 0.8, stroke: shade('#c9cde0', 0.7) })
    }
    // Two lintels, trilithon style.
    p.box(0.62, 0.22, 0.42, 0.12, 5, { z0: 22, fill: '#d5d9ea' })
    p.box(1.66, 0.8, 0.12, 0.42, 5, { z0: 23, fill: '#d5d9ea' })
    const [mx, my] = p.at(1, 1, 130)
    p.el('circle', { cx: mx, cy: my, r: 26, fill: '#ffffff', opacity: 0.35, class: 'pulse' })
    p.circle(1, 1, 130, 17, '#ffffff')
    const cp = p.el('clipPath', { id: 'uf-clip' }); cp.add(new N('circle', { cx: mx, cy: my, r: 17 }))
    p.el('g', { 'clip-path': 'url(#uf-clip)' }).add(new N('circle', { cx: mx, cy: my, r: 16, fill: '#243066', class: 'uf-shadow' }))
    p.el('circle', { cx: mx, cy: my, r: 17, fill: 'none', stroke: INK, 'stroke-width': OUT })
    p.el('path', { d: `M${f(mx - 60)} ${f(my + 30)}A70 40 0 0 1 ${f(mx + 60)} ${f(my + 30)}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-dasharray': '3 6' })
    person(p, 1.85, 1.35, C.lilac, { pose: 'look' })
    person(p, 1.35, 1.9, C.rasp)
    const [sx, sy] = p.at(0.2, 1.7)
    p.path(`M${f(sx)} ${f(sy)}l-6 12M${f(sx)} ${f(sy)}l6 12M${f(sx)} ${f(sy)}l0 12`, 'none', { sw: 1.4 })
    p.path(`M${f(sx - 8)} ${f(sy - 3)}l16 -9`, 'none', { sw: 4.5 })
  } },

  orbit: { size: [2, 2], draw(p) {
    p.disc(1, 1, 0.95, 0, '#eef0f8')
    p.disc(1, 1, 0.82, 0.5, 'none', { sw: 1, dash: '2 5' })
    p.cyl(1, 1, 0.42, 0, 10, C.stone, { bands: [[4, 6, C.lilac]] })
    p.cyl(1, 1, 0.18, 10, 8, C.stone2)
    p.line([1, 1, 18], [1, 1, 48], { sw: 3.5 })
    const [x, y] = p.at(1, 1, 60)
    const orbits: [number, number, number, string, number][] = [[32, 0.42, 3.4, C.mint, 5], [50, 0.42, 6, C.rasp, 7], [70, 0.4, 9.8, C.lilac, 8]]
    orbits.forEach(([rx, k, dur, c, r], i) => {
      const ry = rx * k, d = `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`
      p.path(d, 'none', { sw: 1.2, style: 'stroke-dasharray:3 4', op: 0.7 })
      const pts: [number, number][] = Array.from({ length: 28 }, (_, q) => { const t = (q / 28) * Math.PI * 2 + i * 1.3; return [x + Math.cos(t) * rx, y + Math.sin(t) * ry] })
      motionPath(`orbit-${i}`, pts, { closed: true })
      const pl = p.el('g', { class: 'mover', style: `animation:orbit-${i} ${dur}s linear infinite` })
      pl.add(new N('circle', { r, fill: c, stroke: INK, 'stroke-width': OUT }))
      if (i === 2) pl.add(new N('ellipse', { rx: r * 1.9, ry: r * 0.55, fill: 'none', stroke: INK, 'stroke-width': 1.4 }))
    })
    p.el('circle', { cx: x, cy: y, r: 24, fill: C.sky, opacity: 0.3, class: 'pulse' })
    p.sphere(1, 1, 60, 14, '#e2f2ff')
    fence(p, [[0.12, 1.3], [0.12, 0.7]])
    person(p, 1.8, 1.55, C.cobalt, { pose: 'look' })
    person(p, 1.45, 1.85, C.mint)
    lamp(p, 0.2, 0.2)
  } },

  speed: { size: [2, 2], draw(p) {
    p.disc(1, 1, 0.9, 0, '#eef0f8')
    const pl = p.box(0.5, 0.5, 1, 1, 20, { fill: C.stone, trim: C.cobalt })
    p.sign(1.02, 1.52, 4, 44, 12, '#2c355e', '1,670 km/h', { size: 7, ink: C.mint, font: 'Silkscreen, monospace' })
    const [x, y] = p.at(1, 1, 60)
    p.el('circle', { cx: x, cy: y, r: 32, fill: C.sky, stroke: INK, 'stroke-width': OUT })
    const cp = p.el('clipPath', { id: 'sp-clip' }); cp.add(new N('circle', { cx: x, cy: y, r: 31 }))
    const land = p.el('g', { 'clip-path': 'url(#sp-clip)' })
    const drift = land.add(new N('g', { class: 'sp-spin' }))
    for (const dx of [-128, -64, 0, 64]) drift.add(new N('path', { d: `M${f(x + dx - 20)} ${f(y - 16)}q12 -12 25 -2q9 9 -2 18q-11 11 -23 0zM${f(x + dx + 14)} ${f(y + 8)}q11 -4 16 7q-4 11 -16 7z`, fill: C.mint, stroke: INK, 'stroke-width': 1.3 }))
    p.el('ellipse', { cx: x, cy: y, rx: 32, ry: 10, fill: 'none', stroke: INK, 'stroke-width': 1, opacity: 0.35 })
    p.el('path', { d: `M${f(x - 30)} ${f(y + 22)}A38 38 0 0 0 ${f(x + 36)} ${f(y - 14)}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 3, opacity: 0.5 })
    p.circle(1, 1, 60, 32, 'none', { sw: 2.2 })
    p.path(`M${f(x - 10)} ${f(y - 42)}L${f(x + 10)} ${f(y + 42)}`, 'none', { sw: 3 })
    p.path(`M${f(x - 42)} ${f(y + 6)}A44 16 0 0 0 ${f(x + 42)} ${f(y - 6)}`, 'none', { sw: 3.5, stroke: C.lilac })
    for (const [dy, w] of [[-18, 26], [-2, 42], [14, 22]]) p.path(`M${f(x - 44 - w)} ${f(y + dy)}L${f(x - 40)} ${f(y + dy)}`, 'none', { sw: 3, cls: 'speedline' })
    person(p, 1.8, 1.7, C.rasp, { pose: 'wave' })
    bench(p, 0.35, 1.7, 'x')
  } },

  scale: { size: [2, 2], draw(p) {
    p.disc(1.3, 1.3, 0.42, 0, '#62e8c9', { sw: 1 })
    const [ax, ay] = p.at(1.3, 1.3)
    p.el('ellipse', { cx: ax, cy: ay, rx: 2.8, ry: 1.8, fill: INK })
    p.el('path', { d: `M${f(ax - 2)} ${f(ay)}l-2 2M${f(ax + 2)} ${f(ay)}l2 2`, stroke: INK, 'stroke-width': 0.8 })
    // The stand: an easel of timber holding the lens up.
    p.line([0.35, 1.65, 0], [0.8, 1.05, 52], { sw: 4.5, stroke: C.wood })
    p.line([0.35, 1.65, 0], [0.8, 1.05, 52], { sw: 1.2, stroke: shade(C.wood, 1.2) })
    p.line([0.8, 1.05, 0], [0.8, 1.05, 52], { sw: 3.5, stroke: C.wood })
    const [lx, ly] = p.at(0.95, 0.95, 84)
    const lens = p.group('sc-lens')
    lens.circle(0.95, 0.95, 84, 38, '#eef7ff')
    lens.el('circle', { cx: lx, cy: ly, r: 38, fill: 'none', stroke: INK, 'stroke-width': 9 })
    lens.el('circle', { cx: lx, cy: ly, r: 38, fill: 'none', stroke: C.cobalt, 'stroke-width': 5 })
    lens.el('circle', { cx: lx, cy: ly, r: 33, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.2, opacity: 0.8 })
    const atom = lens.group('spin-slow')
    for (const [a, c] of [[0, C.cobalt], [60, C.rasp], [-60, C.mint]] as const) atom.el('ellipse', { cx: lx, cy: ly, rx: 25, ry: 9, fill: 'none', stroke: c, 'stroke-width': 2.2, transform: `rotate(${a} ${f(lx)} ${f(ly)})` })
    for (const a of [0, 120, 240]) { const r = (a * Math.PI) / 180; atom.el('circle', { cx: lx + Math.cos(r) * 25, cy: ly + Math.sin(r) * 9, r: 2.6, fill: '#fff', stroke: INK, 'stroke-width': 1, transform: `rotate(${a / 2} ${f(lx)} ${f(ly)})` }) }
    lens.el('circle', { cx: lx, cy: ly, r: 5.5, fill: C.rasp, stroke: INK, 'stroke-width': 1.3 })
    lens.el('path', { d: `M${f(lx - 26)} ${f(ly - 16)}q9 -12 23 -14`, fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round' })
    person(p, 1.6, 1.75, C.lilac, { pose: 'look', hat: C.mint })
    tree(p, 1.8, 0.3, 'bush', C.leaf)
  } },
}

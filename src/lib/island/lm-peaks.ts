/** Sky Peaks: space, sky and scale, on the highest ground. */
import { C, INK, N, OUT, P, shade, mix, ballShade, puffShade, r1 as f, motionPath, letter, type Landmark, type Pen } from './kit'
import { creatureUse } from './actors'
import { cloudModel } from './props'
import { person, lamp, bench, flag, tree, fence } from './props'

const star = (p: Pen, x: number, y: number, r: number, cls = 'twinkle', delay = 0) => p.real
  ? starLit(p, x, y, r, cls, delay)
  : p.path(`M${f(x)} ${f(y - r)}L${f(x + r * 0.3)} ${f(y - r * 0.3)}L${f(x + r)} ${f(y)}L${f(x + r * 0.3)} ${f(y + r * 0.3)}L${f(x)} ${f(y + r)}L${f(x - r * 0.3)} ${f(y + r * 0.3)}L${f(x - r)} ${f(y)}L${f(x - r * 0.3)} ${f(y - r * 0.3)}Z`, '#ffffff', { sw: 1.2, cls, style: delay ? `animation-delay:${delay}s` : undefined })

/** A star on the realistic island: a point of light in a soft glow. */
function starLit(p: Pen, x: number, y: number, r: number, cls: string, delay: number) {
  const g = p.el('g', { class: cls, style: delay ? `animation-delay:${delay}s` : undefined })
  g.add(new N('circle', { cx: f(x), cy: f(y), r: f(r * 0.9), fill: puffShade(g, `star-${f(x)}-${f(y)}`, '#e8f1ff', 0.95) }))
  g.add(new N('circle', { cx: f(x), cy: f(y), r: f(r * 0.22), fill: '#ffffff' }))
  return g
}

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
    if (p.real) {
      // A steel cable, lit on its right, as a rod in the sun is.
      p.el('path', { d: `M${f(cx)} ${f(cy)}V${f(cy - 1500)}`, stroke: '#5d6478', 'stroke-width': 2.6, fill: 'none' })
      p.el('path', { d: `M${f(cx + 0.5)} ${f(cy)}V${f(cy - 1500)}`, stroke: '#c9cfe0', 'stroke-width': 0.9, fill: 'none' })
    } else {
      p.el('path', { d: `M${f(cx)} ${f(cy)}V${f(cy - 1500)}`, stroke: INK, 'stroke-width': 4.5, fill: 'none' })
      p.el('path', { d: `M${f(cx)} ${f(cy)}V${f(cy - 1500)}`, stroke: '#ffffff', 'stroke-width': 1.4, fill: 'none' })
    }
    for (let k = 1; k < 10; k++) p.el('circle', { cx, cy: cy - k * 150, r: 2.6, fill: C.rasp, class: 'blink', style: `animation-delay:${k * 0.2}s` })
    p.grow(cx - 20, cy - 200, cx + 20, cy)
    const pod = p.group('se-pod')
    const climber = creatureUse('pod', C.lilac, 'stand', 'se', { transform: `translate(${f(cx)} ${f(cy - 122)})` })
    if (climber && p.real) pod.el('g').add(climber)
    else {
    pod.el('rect', { x: cx - 10, y: cy - 150, width: 20, height: 28, rx: 7, fill: C.lilac, stroke: INK, 'stroke-width': OUT })
    pod.el('rect', { x: cx - 6, y: cy - 144, width: 12, height: 8, rx: 2.5, fill: C.glass, stroke: INK, 'stroke-width': 1 })
    pod.el('rect', { x: cx - 10, y: cy - 128, width: 20, height: 4, fill: shade(C.lilac, 0.8), stroke: INK, 'stroke-width': 1 })
    }
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
    p.model('telescope', [1, 1, 38], {}, () => {
      p.path(`M${f(tx - 5)} ${f(ty - 1)}L${f(tx - 6)} ${f(ty - 40)}L${f(tx + 6)} ${f(ty - 40)}L${f(tx + 5)} ${f(ty - 1)}Z`, '#1f2a5c', { sw: 1.2 })
      p.path(`M${f(tx - 1)} ${f(ty - 22)}L${f(tx + 30)} ${f(ty - 58)}`, 'none', { sw: 10 })
      p.path(`M${f(tx - 1)} ${f(ty - 22)}L${f(tx + 30)} ${f(ty - 58)}`, 'none', { sw: 6, stroke: C.white })
      p.path(`M${f(tx + 22)} ${f(ty - 49)}l6 5`, 'none', { sw: 3, stroke: C.cobalt })
    })
    const pts: [number, number][] = [[-48, -98], [-18, -122], [14, -108], [44, -130], [30, -84], [60, -100]].map(([a, b]) => [tx + a, ty + b])
    const g = p.group('cd-lines')
    // The constellation being drawn: faint lines of light between its stars.
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [2, 4], [3, 5]]) g.path(`M${f(pts[i][0])} ${f(pts[i][1])}L${f(pts[j][0])} ${f(pts[j][1])}`, 'none', { stroke: p.real ? '#cfe2ff' : C.sky, sw: p.real ? 1 : 2, op: p.real ? 0.55 : undefined, style: 'stroke-dasharray:3 5' })
    pts.forEach(([x, y], i) => star(p, x, y, i % 2 ? 5 : 7, 'twinkle', i * 0.35))
    const shed = p.box(1.5, 0.2, 0.4, 0.4, 14, { z0: 8, fill: C.white })
    p.gable(1.5, 0.2, 0.4, 0.4, 22, 8, C.rasp, 'y', { lines: 1 })
    p.windows(shed, 'x', { cols: 1, z0: 5, h: 5, wide: 0.4 })
    person(p.move(0, 0, 8), 0.45, 1.55, C.cobalt, { pose: 'wave' })
    lamp(p.move(0, 0, 8), 1.7, 1.7, 20)
  } },

  'universe-forecast': { size: [2, 2], draw(p) {
    // On the realistic island the circle stands on turf, worn to the chalk in a ring.
    p.disc(1, 1, 0.98, 0, p.real ? '#7d946d' : '#62e8c9')
    p.disc(1, 1, 0.78, 1, '#8aeed6', { sw: 1, dash: '4 4', op: p.real ? 0 : undefined })
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
    const ufDefs = p.real ? p.el('defs') : null
    p.el('circle', ufDefs ? { cx: mx, cy: my, r: 44, fill: puffShade(ufDefs, 'uf-corona', '#f2f6ff', 0.75), class: 'pulse' } : { cx: mx, cy: my, r: 26, fill: '#ffffff', opacity: 0.35, class: 'pulse' })
    // Rays round the sun, so the dark disc reads as an eclipse, not a hole.
    let rays = ''
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, r0 = 21, r1 = k % 2 ? 27 : 31; rays += `M${f(mx + Math.cos(a) * r0)} ${f(my + Math.sin(a) * r0)}L${f(mx + Math.cos(a) * r1)} ${f(my + Math.sin(a) * r1)}` }
    if (!p.real) p.path(rays, 'none', { stroke: '#ffffff', sw: 2.4 })
    p.circle(1, 1, 130, 17, p.real ? '#fffdf6' : '#ffffff', p.real ? { sw: 0 } : {})
    const cp = p.el('clipPath', { id: 'uf-clip' }); cp.add(new N('circle', { cx: mx, cy: my, r: 17 }))
    p.el('g', { 'clip-path': 'url(#uf-clip)' }).add(new N('circle', { cx: mx, cy: my, r: 16, fill: p.real ? '#141a2c' : '#4b5ba6', class: 'uf-shadow' }))
    if (!p.real) p.el('circle', { cx: mx, cy: my, r: 17, fill: 'none', stroke: INK, 'stroke-width': OUT })
    if (!p.real) p.el('path', { d: `M${f(mx - 60)} ${f(my + 30)}A70 40 0 0 1 ${f(mx + 60)} ${f(my + 30)}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-dasharray': '3 6' })
    // The forecast for the stone circle itself: showers.
    const [rx, ry] = p.at(0.3, 0.6, 74)
    const rc = p.group('drift')
    const rain = cloudModel(2, 0.3)
    if (p.real && rain) rc.el('g', { transform: `translate(${f(rx)} ${f(ry + 8)})` }).add(rain)
    else {
      for (const [dx, dy, r] of [[-12, 0, 10], [2, -6, 12], [15, 1, 9], [0, 4, 9]]) rc.el('circle', { cx: rx + dx, cy: ry + dy, r, fill: '#e3e8f5', stroke: INK, 'stroke-width': 1.3 })
      rc.el('ellipse', { cx: rx + 1, cy: ry + 5, rx: 19, ry: 6, fill: '#e3e8f5' })
    }
    for (let k = 0; k < 7; k++) p.el('path', { d: `M${f(rx - 15 + k * 5)} ${f(ry + 14)}l-2.4 6`, stroke: p.real ? '#b9c8e6' : C.cobalt, 'stroke-width': p.real ? 0.9 : 1.5, opacity: p.real ? 0.75 : undefined, 'stroke-linecap': 'round', class: 'rain', style: `animation-delay:${(k % 3) * 0.27}s` })
    p.grow(rx - 26, ry - 20, rx + 26, ry + 24)
    person(p, 1.85, 1.35, C.lilac, { pose: 'look' })
    person(p, 1.35, 1.9, C.rasp)
    const [sx, sy] = p.at(0.2, 1.7)
    // A telescope on its tripod: Unity's (Props8.cs, TripodScope).
    p.model('tripodscope', [0.2, 1.7, -12], {}, () => {
      p.path(`M${f(sx)} ${f(sy)}l-6 12M${f(sx)} ${f(sy)}l6 12M${f(sx)} ${f(sy)}l0 12`, 'none', { sw: 1.4 })
      p.path(`M${f(sx - 8)} ${f(sy - 3)}l16 -9`, 'none', { sw: 4.5 })
    })
  } },

  orbit: { size: [2, 2], draw(p) {
    p.disc(1, 1, 0.95, 0, '#eef0f8')
    p.disc(1, 1, 0.82, 0.5, 'none', { sw: 1, dash: '2 5', op: p.real ? 0 : undefined })
    p.cyl(1, 1, 0.42, 0, 10, C.stone, { bands: [[4, 6, C.lilac]] })
    p.cyl(1, 1, 0.18, 10, 8, C.stone2)
    p.line([1, 1, 18], [1, 1, 48], { sw: 3.5 })
    const [x, y] = p.at(1, 1, 60)
    const orbits: [number, number, number, string, number][] = [[32, 0.42, 3.4, C.mint, 5], [50, 0.42, 6, C.rasp, 7], [70, 0.4, 9.8, C.lilac, 8]]
    // On the realistic island the tracks are Unity's steel rings, level round the sun (Models.cs, Orrery): the planets ride them.
    p.model('orrery', [1, 1, 60], { colours: orbits.map(([rx]) => String(rx)) }, () => null)
    const defs = p.real ? p.el('defs') : null
    orbits.forEach(([rx, k0, dur, c, r], i) => {
      const k = p.real ? 0.5 : k0
      const ry = rx * k, d = `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`
      if (!p.real) p.path(d, 'none', { sw: 1.2, style: 'stroke-dasharray:3 4', op: 0.7 })
      const pts: [number, number][] = Array.from({ length: 28 }, (_, q) => { const t = (q / 28) * Math.PI * 2 + i * 1.3; return [x + Math.cos(t) * rx, y + Math.sin(t) * ry] })
      motionPath(`orbit-${i}`, pts, { closed: true })
      const pl = p.el('g', { class: 'mover', style: `animation:orbit-${i} ${dur}s linear infinite` })
      if (defs) {
        // A planet, lit; the outer one with its rings (behind it, then over its front).
        if (i === 2) pl.add(new N('path', { d: `M${f(-r * 2)} 0a${f(r * 2)} ${f(r * 0.6)} 0 0 1 ${f(r * 4)} 0`, fill: 'none', stroke: '#cfc7e6', 'stroke-width': 1.6, opacity: 0.85 }))
        pl.add(new N('circle', { r, fill: ballShade(defs, `orb-planet${i}`, c) }))
        if (i === 2) pl.add(new N('path', { d: `M${f(-r * 2)} 0a${f(r * 2)} ${f(r * 0.6)} 0 0 0 ${f(r * 4)} 0`, fill: 'none', stroke: '#e6e0f5', 'stroke-width': 1.6, opacity: 0.95 }))
      } else {
        pl.add(new N('circle', { r, fill: c, stroke: INK, 'stroke-width': OUT }))
        if (i === 2) pl.add(new N('ellipse', { rx: r * 1.9, ry: r * 0.55, fill: 'none', stroke: INK, 'stroke-width': 1.4 }))
      }
    })
    p.el('circle', defs ? { cx: x, cy: y, r: 30, fill: puffShade(defs, 'orb-glow', '#dff0ff', 0.5), class: 'pulse' } : { cx: x, cy: y, r: 24, fill: C.sky, opacity: 0.3, class: 'pulse' })
    p.sphere(1, 1, 60, 14, '#e2f2ff')
    fence(p, [[0.12, 1.3], [0.12, 0.7]])
    person(p, 1.8, 1.55, C.cobalt, { pose: 'look' })
    person(p, 1.45, 1.85, C.mint)
    lamp(p, 0.2, 0.2)
  } },

  speed: { size: [2, 2], draw(p) {
    p.disc(1, 1, 0.9, 0, '#eef0f8')
    const pl = p.box(0.5, 0.5, 1, 1, 20, { fill: C.stone, trim: C.cobalt })
    // An LED board set into the plinth: how fast you are going, standing still.
    p.quad(pl, 'y', 0.06, 0.94, 4, 15, '#2c355e', { sw: 1.2 })
    const led = p.face(pl, 'y', 0.5, 7.4, { w: 30, h: 10 })
    letter(led, 0, 0, '1,670 km/h', { size: 5.2, fill: C.mint, font: 'Silkscreen, monospace', weight: 400 })
    const [x, y] = p.at(1, 1, 60)
    // It stands on something: a stem from the plinth, and a brass meridian
    // ring holding it at the poles, like a desk globe the size of a house.
    p.cyl(1, 1, 0.16, 20, 4, C.stone2, { sw: 1.2 })
    p.path(`M${f(x - 3)} ${f(y + 36)}v-6h6v6z`, C.slate, { sw: 1.2, op: p.real ? 0 : undefined })
    // The meridian ring and its stand: Unity's (Models.cs, Meridian), else drawn.
    p.model('meridian', [1, 1, 60], {}, () => {
      p.path(`M${f(x - 12)} ${f(y - 39)}A40 40 0 0 1 ${f(x + 14)} ${f(y + 37)}`, 'none', { sw: 6 })
      p.path(`M${f(x - 12)} ${f(y - 39)}A40 40 0 0 1 ${f(x + 14)} ${f(y + 37)}`, 'none', { sw: 3, stroke: C.lilac })
    })
    // The globe: Unity's, turning (24 frames, Creatures.cs, Globe), in a thin haze of air at its rim.
    const turns = Array.from({ length: 24 }, (_, k) => creatureUse('globe', C.sky, `f${k}`, 'se', { class: 'frame24', style: `animation-delay:${f(k * 0.5 - 12)}s`, transform: `translate(${f(x)} ${f(y)})` }))
    if (p.real && turns.every(Boolean)) {
      const g = p.el('g')
      turns.forEach((u) => g.add(u!))
      const air = g.add(new N('defs')).add(new N('radialGradient', { id: 'sp-air' }))
      for (const [o, op] of [[0, 0], [0.86, 0], [0.95, 0.4], [1, 0]]) air.add(new N('stop', { offset: o, 'stop-color': '#bcd9ff', 'stop-opacity': op }))
      g.add(new N('circle', { cx: f(x), cy: f(y), r: 34, fill: 'url(#sp-air)' }))
    } else {
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
    }
    if (!p.real) for (const [dy, w] of [[-18, 26], [-2, 42], [14, 22]]) p.path(`M${f(x - 44 - w)} ${f(y + dy)}L${f(x - 40)} ${f(y + dy)}`, 'none', { sw: 3, cls: 'speedline' })
    person(p, 1.8, 1.7, C.rasp, { pose: 'wave' })
    bench(p, 0.35, 1.7, 'x')
  } },

  scale: { size: [2, 2], draw(p) {
    // The Tower of Scales: each storey a size smaller than the one below,
    // and on top, where a weather vane would be, an atom.
    p.box(0.12, 0.12, 1.76, 1.76, 5, { fill: C.stone })
    p.box(0.22, 0.22, 1.56, 1.56, 3, { z0: 5, fill: '#e3e8f7', sw: 1.2 })
    const tiers: [number, number, string, number][] = [[0.38, 30, C.cobalt, 3], [0.56, 24, C.lilac, 2], [0.72, 18, C.mint, 1]]
    let z = 8
    const boxes = tiers.map(([e, h, trim, cols]) => {
      const w = 2 - e * 2
      const t = p.box(e, e, w, w, h, { z0: z, fill: C.white, trim })
      p.windows(t, 'x', { cols, z0: h * 0.3, h: h * 0.38, wide: 0.45 })
      p.windows(t, 'y', { cols, z0: h * 0.3, h: h * 0.38, wide: 0.45 })
      // A ledge round the top, so each storey reads as a step in.
      p.box(e - 0.04, e - 0.04, w + 0.08, w + 0.08, 2.5, { z0: z + h, fill: '#eef1fb', sw: 1.1 })
      z += h + 2.5
      return t
    })
    p.door(boxes[0], 'y', 0.5, { w: 0.26, h: 15, fill: C.cobalt })
    // The lantern on top, and the vane.
    p.cyl(1, 1, 0.2, z, 12, C.glass, { top: '#eef1fb', bands: [[0, 2, C.white]] })
    p.dome(1, 1, 0.24, z + 12, C.cobalt)
    p.line([1, 1, z + 20], [1, 1, z + 44], { sw: 2 })
    const [vx, vy] = p.at(1, 1, z + 48)
    p.path(`M${f(vx - 14)} ${f(vy + 10)}h28M${f(vx)} ${f(vy + 4)}v12`, 'none', { sw: 1.3 })
    p.path(`M${f(vx - 14)} ${f(vy + 10)}l-4 -3v6zM${f(vx + 14)} ${f(vy + 10)}l5 0l-3 -3`, C.rasp, { sw: 1 })
    // The atom: Unity's, turning (24 frames, Creatures8.cs), as the globe at How Fast does.
    const turns = Array.from({ length: 24 }, (_, k) => creatureUse('atom', C.cobalt, `f${k}`, 'se', { class: 'frame24', style: `animation-delay:${f(k * 0.5 - 12)}s`, transform: `translate(${f(vx)} ${f(vy)})` }))
    const atom = p.group(p.real && turns.every(Boolean) ? 'atom' : 'spin-slow')
    if (p.real && turns.every(Boolean)) turns.forEach((u) => atom.g.add(u!))
    else for (const [ang, c] of [[0, C.cobalt], [60, C.rasp], [-60, C.mint]] as const) atom.el('ellipse', { cx: vx, cy: vy, rx: 13, ry: 4.6, fill: 'none', stroke: c, 'stroke-width': 1.8, transform: `rotate(${ang} ${f(vx)} ${f(vy)})` })
    if (!(p.real && turns.every(Boolean))) atom.el('circle', { cx: vx, cy: vy, r: 3.2, fill: C.rasp, stroke: INK, 'stroke-width': 1.1 })
    if (!(p.real && turns.every(Boolean))) for (const ang of [0, 120, 240]) { const r = (ang * Math.PI) / 180; atom.el('circle', { cx: vx + Math.cos(r) * 13, cy: vy + Math.sin(r) * 4.6, r: 1.7, fill: '#fff', stroke: INK, 'stroke-width': 0.8, transform: `rotate(${ang / 2} ${f(vx)} ${f(vy)})` }) }
    p.grow(vx - 18, vy - 16, vx + 18, vy + 20)
    // Visitors: one looking a long way up, one with a magnifying glass at the flowers.
    person(p, 1.75, 1.92, C.lilac, { pose: 'look', hat: C.mint })
    const [gx, gy] = p.at(0.32, 1.86)
    person(p, 0.32, 1.86, C.rasp)
    p.el('path', { d: `M${f(gx + 3)} ${f(gy - 11)}l5 4`, stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' })
    p.el('circle', { cx: gx + 10, cy: gy - 5, r: 3.2, fill: '#eef7ff', stroke: INK, 'stroke-width': 1.3 })
    tree(p, 1.86, 0.2, 'bush', C.leaf)
    tree(p, 0.18, 1.2, 'pine', C.leaf, 0.75)
  } },
}

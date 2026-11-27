/**
 * Tiny Island — the traffic, driven live.
 *
 * Every car and the bus drive the island's roads for themselves: each keeps
 * to its own side of the road, takes corners on a curve, goes on straight
 * more often than it turns and never doubles back unless the road ends. How
 * each one moves is the Intelligent Driver Model (Treiber, Hennecke and
 * Helbing, 2000), the car-following law traffic engineers simulate real roads
 * with: it accelerates towards the speed it likes, keeps a gap to the one in
 * front that grows with its speed, and brakes harder the faster it is closing
 * on it, so a queue builds and drains the way a real one does. A corner is
 * taken slower than a straight, and a junction somebody else is crossing is
 * waited at, at its edge; whoever has waited longest goes first, so nothing
 * locks. Brake lights come on as they brake; after dark, the headlights and
 * tail lights.
 *
 * Positions are in tiles (i, j), speeds in tiles a second, like the map's
 * own model; drawn by the page in the painting's order (play.ts), Unity's
 * picture of each on the realistic island, the drawn one on the cartoon.
 */
import type { Box, M } from './scene'

const T = 32, H = 16
const at = (i: number, j: number, z = 0): [number, number] => [(i - j) * T, (i + j) * H - z]
const key = (i: number, j: number) => `${i},${j}`

type Kind = 'car' | 'bus'
/** The Intelligent Driver Model, per kind: the speed it likes (v0), how hard it pulls away (a), how hard it is comfortable braking (b), the gap it keeps standing (s0), and the time it keeps behind the one in front (gap). */
const IDM: Record<Kind, { v0: number; a: number; b: number; s0: number; gap: number; len: number }> = {
  car: { v0: 1.55, a: 1.3, b: 2.1, s0: 0.22, gap: 0.85, len: 0.44 },
  bus: { v0: 1.05, a: 0.8, b: 1.6, s0: 0.3, gap: 1.2, len: 0.78 },
}
/** How fast a corner is taken, tiles a second. */
const CORNER = 0.7
/** How far off the road's middle each side's lane is, in tiles. */
const LANE = 0.17

type Car = {
  kind: Kind; body: string
  /** The cells it is driving through: it is on the curve from between path[0] and path[1] to between path[1] and path[2]. */
  path: [number, number][]
  u: number; v: number; acc: number
  /** Where it is (tiles), the way it is heading (a unit vector in tiles), and on screen. */
  i: number; j: number; hi: number; hj: number
  /** How long it has stood waiting at a junction; and, when that was too long, how long it edges through regardless. */
  waited: number; squeeze: number
  rnd: () => number
}

export type Traffic = ReturnType<typeof createTraffic>

export function createTraffic(o: {
  roads: [number, number][]
  play: boolean
  /** How dark it is, 0 by day to 1 at night. */
  dark: () => number
  /** Unity's picture of a car or the bus, by name, its foot at (x, y); false if there is none to draw. */
  pic?: (c: CanvasRenderingContext2D, name: string, x: number, y: number) => boolean
  /** Unity's pictures: for each body colour, its name facing se, sw, nw and ne; and the bus's. */
  names?: { cars: Record<string, string[]>; bus: string[] } | null
  count?: number
  /** Anything else on the road that the traffic must stop for (the walk's own car, someone on foot): where (tiles), how far it reaches along the road and across it (tiles). */
  others?: () => { i: number; j: number; r: number; w: number }[]
  /** Traffic lights (the walk's): the light facing a car driving from one cell into a junction's cell. */
  signal?: (cell: [number, number], from: [number, number]) => 'green' | 'amber' | 'red'
}) {
  const road = new Set(o.roads.map(([i, j]) => key(i, j)))
  const isRoad = (i: number, j: number) => road.has(key(i, j))
  const next4 = (i: number, j: number) => ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).map(([a, b]) => [i + a, j + b] as [number, number]).filter(([a, b]) => isRoad(a, b))
  // (A cell in a solid block of road, where two streets run side by side, is wide road, not a junction.)
  const wide = (i: number, j: number) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([a, b]) => isRoad(i + a, j + b) && isRoad(i + a + 1, j + b) && isRoad(i + a, j + b + 1) && isRoad(i + a + 1, j + b + 1))
  const junction = new Set(o.roads.filter(([i, j]) => next4(i, j).length >= 3 && !wide(i, j)).map(([i, j]) => key(i, j)))
  /**
   * Junction cells next to each other are one box (a wide crossroads): one car holds it at a time, from
   * the moment it drives in to the moment it is out the far side, and everyone else waits at its edge.
   */
  const box = new Map<string, number>()
  {
    let n = 0
    for (const k of junction) {
      if (box.has(k)) continue
      const q = [k]; box.set(k, n)
      while (q.length) { const [i, j] = q.pop()!.split(',').map(Number); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nk = key(i + a, j + b); if (junction.has(nk) && !box.has(nk)) { box.set(nk, n); q.push(nk) } } }
      n++
    }
  }
  const holder = new Map<number, Car>()
  const boxOfCell = (c: [number, number]) => box.get(key(...c))

  // Seeded, so the island's traffic sets off the same way every visit.
  let s0 = 20261125
  const rand = () => { s0 = (s0 * 1664525 + 1013904223) >>> 0; return s0 / 4294967296 }
  const mkRnd = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

  /** The cell after b, coming from a: on more often than turning, back only where the road ends. */
  const choose = (a: [number, number], b: [number, number], r: () => number): [number, number] => {
    const opts = next4(b[0], b[1]).filter(([i, j]) => i !== a[0] || j !== a[1])
    if (!opts.length) return a
    const di = b[0] - a[0], dj = b[1] - a[1]
    const weights = opts.map(([i, j]) => (i - b[0] === di && j - b[1] === dj ? 3 : 1))
    let x = r() * weights.reduce((s, w) => s + w, 0)
    for (let k = 0; k < opts.length; k++) { x -= weights[k]; if (x <= 0) return opts[k] }
    return opts[opts.length - 1]
  }

  /* ---- the curve a car is on ---- */
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2 + 0.5, (a[1] + b[1]) / 2 + 0.5]
  const straight = (p: [number, number][]) => p[2][0] - p[1][0] === p[1][0] - p[0][0] && p[2][1] - p[1][1] === p[1][1] - p[0][1]
  const back = (p: [number, number][]) => p[2][0] === p[0][0] && p[2][1] === p[0][1]
  const pieceLen = (p: [number, number][]) => (straight(p) ? 1 : back(p) ? 1.6 : 0.785)
  /** Where on its curve, and which way it faces there (a quadratic from one cell edge to the next, round the cell's middle). */
  const place = (car: Car) => {
    const [a, b, c] = car.path, P0 = mid(a, b), P1: [number, number] = [b[0] + 0.5, b[1] + 0.5], P2 = mid(b, c), u = car.u, w = 1 - u
    let x: number, y: number, ti: number, tj: number
    if (back(car.path)) {
      // Turning round where the road ends: a loop round the end of it, so it comes back in the other lane
      // without ever jumping across (a cubic out to one side of the cell's middle and back by the other).
      const di = b[0] - a[0], dj = b[1] - a[1], ni = dj, nj = -di
      const C1: [number, number] = [P1[0] + di * 0.25 + ni * 0.42, P1[1] + dj * 0.25 + nj * 0.42], C2: [number, number] = [P1[0] + di * 0.25 - ni * 0.42, P1[1] + dj * 0.25 - nj * 0.42]
      const q = (k: number) => [w * w * w * P0[k] + 3 * w * w * u * C1[k] + 3 * w * u * u * C2[k] + u * u * u * P2[k], 3 * w * w * (C1[k] - P0[k]) + 6 * w * u * (C2[k] - C1[k]) + 3 * u * u * (P2[k] - C2[k])]
      ;[x, ti] = q(0); [y, tj] = q(1)
    } else {
      x = w * w * P0[0] + 2 * w * u * P1[0] + u * u * P2[0]; y = w * w * P0[1] + 2 * w * u * P1[1] + u * u * P2[1]
      ti = 2 * w * (P1[0] - P0[0]) + 2 * u * (P2[0] - P1[0]); tj = 2 * w * (P1[1] - P0[1]) + 2 * u * (P2[1] - P1[1])
    }
    const l = Math.hypot(ti, tj) || 1; ti /= l; tj /= l
    // Its own side of the road.
    car.i = x + tj * LANE; car.j = y - ti * LANE; car.hi = ti; car.hj = tj
  }

  /* ---- setting off ---- */
  const cars: Car[] = []
  const COLOURS = ['#ff4f6e', '#4fe3c1', '#ffffff', '#ffffff', '#ff4f6e', '#4fe3c1']
  const want = Math.min(o.count ?? 12, Math.floor(o.roads.length / 7))
  const starts = [...o.roads].sort(() => rand() - 0.5)
  for (const st of starts) {
    if (cars.length >= want) break
    const opts = next4(st[0], st[1])
    if (!opts.length) continue
    if (cars.some((c) => Math.hypot(c.path[1][0] - st[0], c.path[1][1] - st[1]) < 2.2)) continue
    const r = mkRnd(st[0] * 97 + st[1] * 31 + cars.length)
    const prev = opts[Math.floor(r() * opts.length)]
    const path: [number, number][] = [prev, st]
    while (path.length < 5) path.push(choose(path[path.length - 2], path[path.length - 1], r))
    const kind: Kind = cars.length === 3 ? 'bus' : 'car'
    const car: Car = { kind, body: kind === 'bus' ? '#5b82ff' : COLOURS[cars.length % COLOURS.length], path, u: r(), v: IDM[kind].v0 * 0.6, acc: 0, i: 0, j: 0, hi: 1, hj: 0, waited: 0, squeeze: 0, rnd: r }
    place(car)
    cars.push(car)
  }

  /* ---- driving ---- */
  function step(dt: number) {
    if (!o.play || dt <= 0) return
    for (const car of cars) {
      const p = IDM[car.kind]
      const len = pieceLen(car.path)
      // The speed it would like on this stretch: slower into a corner, and on one.
      let v0 = p.v0
      if (!straight(car.path)) v0 = Math.min(v0, back(car.path) ? CORNER * 0.7 : CORNER)
      else if (!straight(car.path.slice(1, 4))) v0 = Math.min(v0, CORNER + (p.v0 - CORNER) * Math.min(1, (1 - car.u) * 1.6))
      // The nearest thing in front: another car in its lane ahead, or a junction someone else is in.
      let gap = Infinity, lead = 0
      // Stood still too long: it edges through for a moment, as a driver squeezes past a jam.
      if (car.waited > 8) { car.squeeze = 1.6; car.waited = 0 }
      car.squeeze = Math.max(0, car.squeeze - dt)
      for (const other of cars) {
        if (other === car || car.squeeze > 0) continue
        const di = other.i - car.i, dj = other.j - car.j
        const fwd = di * car.hi + dj * car.hj, lat = Math.abs(di * car.hj - dj * car.hi)
        // Only one going its way counts as in front: cross traffic is the junctions' business, and a car met
        // head on is in the other lane.
        const same = other.hi * car.hi + other.hj * car.hj
        if (fwd <= 0 || fwd > 3 || lat > 0.24 || !(same > 0.5 || (fwd < 0.45 && lat < 0.18 && same > -0.5))) continue
        const g = fwd - (p.len + IDM[other.kind].len) / 2
        if (g < gap) { gap = g; lead = other.v }
      }
      // Something else in its lane ahead (a car somebody is driving, a person in the road): it stops short of it.
      for (const ob of o.others?.() ?? []) {
        const di = ob.i - car.i, dj = ob.j - car.j
        const fwd = di * car.hi + dj * car.hj, lat = Math.abs(di * car.hj - dj * car.hi)
        if (fwd <= 0 || fwd > 3 || lat > 0.12 + ob.w) continue
        const g = fwd - p.len / 2 - ob.r
        if (g < gap) { gap = Math.max(0.001, g); lead = 0 }
      }
      // A light at red ahead (or amber, with room to stop): it stops at the line, and waits as long as it takes.
      let atLight = false
      // (Once inside the junction it goes on out; until then, the light has the say, whoever holds the box.)
      const ahead = boxOfCell(car.path[2])
      if (o.signal && ahead !== undefined && boxOfCell(car.path[1]) !== ahead) {
        const lt = o.signal(car.path[2], car.path[1]), g = (1 - car.u) * len - 0.06
        if (lt === 'red' || (lt === 'amber' && g > 0.3)) { atLight = true; if (holder.get(ahead) === car) holder.delete(ahead); if (g < gap) { gap = Math.max(0.001, g); lead = 0 } }
      }
      // A box it is about to drive into: only if nobody else holds it, and there is room to get out the
      // far side (blocking the box is how a grid of streets locks solid). Then it is this car's.
      const zone = boxOfCell(car.path[2])
      if (zone !== undefined && holder.get(zone) !== car && car.squeeze <= 0 && !atLight) {
        const out = car.path.slice(3).find((c) => boxOfCell(c) !== zone) ?? car.path[car.path.length - 1]
        const held = holder.get(zone)
        const blocked = (held && held !== car) || cars.some((other) => other !== car && other.v < 0.3 && Math.hypot(other.i - (out[0] + 0.5), other.j - (out[1] + 0.5)) < 0.55)
        const g = (1 - car.u) * len - 0.06
        if (blocked && car.waited < 6) { if (g < gap) { gap = Math.max(0.001, g); lead = 0 } }
        else if (g < 0.5) holder.set(zone, car)
      }
      // The Intelligent Driver Model's acceleration.
      const s = Math.max(0.001, gap)
      const want = p.s0 + Math.max(0, car.v * p.gap + (car.v * (car.v - lead)) / (2 * Math.sqrt(p.a * p.b)))
      let a = p.a * (1 - Math.pow(car.v / v0, 4) - (Number.isFinite(gap) ? (want / s) ** 2 : 0))
      a = Math.max(-p.b * 3, Math.min(p.a, a))
      car.acc = a
      car.v = Math.max(0, Math.min(p.v0 * 1.05, car.v + a * dt))
      // (Waiting at a red light is not being stuck.)
      car.waited = car.v < 0.05 && !atLight ? car.waited + dt : 0
      car.u += (car.v * dt) / len
      while (car.u >= 1) {
        car.u -= 1
        car.path.shift()
        car.path.push(choose(car.path[car.path.length - 2], car.path[car.path.length - 1], car.rnd))
      }
      place(car)
      // Out of a box it held: it is free again.
      for (const [z, c] of holder) if (c === car && boxOfCell(car.path[1]) !== z && boxOfCell(car.path[2]) !== z && boxOfCell([Math.floor(car.i), Math.floor(car.j)]) !== z) holder.delete(z)
    }
  }

  /* ---- drawing ---- */
  /** se, sw, nw, ne: the way it is heading on screen. */
  const facing = (car: Car) => { const dx = (car.hi - car.hj) * T, dy = (car.hi + car.hj) * H; return dx >= 0 ? (dy >= 0 ? 0 : 3) : dy >= 0 ? 1 : 2 }
  const boxOf = (car: Car): Box => { const [x, y] = at(car.i, car.j); return [x - 30, y - 30, x + 30, y + 10] }

  /** The car drawn, for the cartoon island: its body slanted to lie along the road it is on. */
  function drawn(c: CanvasRenderingContext2D, car: Car, x: number, y: number) {
    const f = facing(car), alongI = f === 0 || f === 2, dir = f === 0 || f === 3 ? 1 : -1
    c.save()
    c.translate(x, y); c.transform(1, Math.tan(((alongI ? 26.57 : -26.57) * Math.PI) / 180), 0, 1, 0, 0); c.scale(dir, 1)
    c.fillStyle = '#1b2340'; c.globalAlpha = 0.15; c.beginPath(); c.ellipse(0, 1, car.kind === 'bus' ? 20 : 13, 3.5, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1
    c.lineWidth = 1.6; c.strokeStyle = '#1b2340'; c.lineJoin = 'round'; c.fillStyle = car.body
    c.beginPath()
    if (car.kind === 'bus') { c.moveTo(-20, -15); c.lineTo(17, -15); c.quadraticCurveTo(20, -15, 20, -12); c.lineTo(20, 2); c.lineTo(-20, 2); c.closePath() }
    else { c.moveTo(-12, -2); c.lineTo(-9, -8); c.quadraticCurveTo(-7, -10, -4, -10); c.lineTo(5, -10); c.quadraticCurveTo(8, -10, 9, -8); c.lineTo(12, -2); c.lineTo(12, 2); c.lineTo(-12, 2); c.closePath() }
    c.fill(); c.stroke()
    c.fillStyle = '#e8f4ff'
    if (car.kind === 'bus') for (let k = -16; k < 14; k += 7) c.fillRect(k, -12, 5, 5)
    else { c.beginPath(); c.moveTo(-6, -8.5); c.lineTo(-4.5, -12.5); c.lineTo(4, -12.5); c.lineTo(6, -8.5); c.closePath(); c.fill() }
    c.fillStyle = '#1b2340'
    for (const wx of car.kind === 'bus' ? [-13, 13] : [-7, 7]) { c.beginPath(); c.arc(wx, 2, 2.8, 0, Math.PI * 2); c.fill() }
    c.restore()
  }

  /** Its lights: tail lights, brighter as it brakes; after dark, its headlights on the road ahead. */
  function lights(c: CanvasRenderingContext2D, car: Car, dark: number) {
    const braking = car.acc < -0.35 || car.v < 0.04
    const L = IDM[car.kind].len / 2
    const [fx, fy] = at(car.i + car.hi * L, car.j + car.hj * L, 5), [bx, by] = at(car.i - car.hi * L, car.j - car.hj * L, 5)
    let n = 0
    if (dark > 0.05) {
      // Headlights: a soft pool of light thrown ahead.
      const [ax, ay] = at(car.i + car.hi * (L + 0.55), car.j + car.hj * (L + 0.55))
      const g = c.createRadialGradient(ax, ay, 0, ax, ay, 22)
      g.addColorStop(0, `rgba(240,246,255,${0.32 * dark})`); g.addColorStop(1, 'rgba(240,246,255,0)')
      c.fillStyle = g; c.beginPath(); c.ellipse(ax, ay, 24, 12, 0, 0, Math.PI * 2); c.fill(); n++
      c.fillStyle = `rgba(250,252,255,${0.9 * dark})`; c.beginPath(); c.arc(fx, fy, 1.6, 0, Math.PI * 2); c.fill(); n++
    }
    const tail = braking ? 0.95 : dark * 0.55
    if (tail > 0.05) {
      c.fillStyle = `rgba(255,58,82,${tail})`; c.beginPath(); c.arc(bx, by, braking ? 2 : 1.4, 0, Math.PI * 2); c.fill(); n++
      if (braking) { c.fillStyle = `rgba(255,58,82,${0.18 * tail})`; c.beginPath(); c.arc(bx, by, 6, 0, Math.PI * 2); c.fill(); n++ }
    }
    return n
  }

  function draw(c: CanvasRenderingContext2D, m: M, visible: (b: Box) => boolean, inWin?: (b: Box) => boolean): number {
    let n = 0
    const dark = o.dark()
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
    for (const car of [...cars].sort((a, b) => a.i + a.j - (b.i + b.j))) {
      const b = boxOf(car)
      if (!visible(b)) continue
      if (inWin) { if (!inWin(b)) continue; c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]) }
      const [x, y] = at(car.i, car.j)
      const names = car.kind === 'bus' ? o.names?.bus : o.names?.cars[car.body]
      const name = names?.[facing(car)]
      let shown = !!(name && o.pic?.(c, name, x, y))
      // Unity has pictured each colour facing two of the four ways: facing the other two, it is the mirror of one of those.
      if (!shown && names && o.pic) {
        const twin = names[[1, 0, 3, 2][facing(car)]]
        if (twin) { c.save(); c.translate(x, y); c.scale(-1, 1); shown = o.pic(c, twin, 0, 0); c.restore() }
      }
      if (!shown) drawn(c, car, x, y)
      n += 2 + lights(c, car, dark)
    }
    return n
  }

  return {
    step, draw, cars: () => cars.length,
    /** Where every vehicle is, which way it heads and how fast (for check-traffic). */
    state: () => cars.map((c) => ({ i: c.i, j: c.j, hi: c.hi, hj: c.hj, v: c.v, kind: c.kind, acc: c.acc, path: c.path.slice(0, 4).map((q) => q.join(",")).join(" "), u: c.u, waited: c.waited })),
  }
}

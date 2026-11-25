/**
 * Tiny Island — the wind, and what it carries.
 *
 * One wind for the whole island: it blows from the west-south-west, swings a
 * little through the day, and gusts. It carries two things live on the page:
 *
 *   - a flock of gulls over the harbour, flying as real flocks do (Reynolds'
 *     boids: each keeps clear of the ones nearest it, turns with its
 *     neighbours and drifts towards the middle of them, all of them wheeling
 *     round a point that wanders over the water), flapping to gain speed and
 *     gliding otherwise, carried along by the wind, and scattering when the
 *     hand comes near;
 *   - leaves and petals off the town's trees: shaken loose in the gusts, they
 *     fall the way a leaf does (not straight: fluttering from side to side
 *     as they go down, slowed by the air), blown with the wind, and lie a
 *     while where they land before they are gone.
 *
 * Everything moves by the time passed. In map units (the screen at zoom 1);
 * height z goes up the screen. With reduced motion none of it is drawn.
 */
import type { M } from './scene'

const T = 32, H = 16
const at = (i: number, j: number, z = 0): [number, number] => [(i - j) * T, (i + j) * H - z]

/** The wind at time t (seconds): which way and how hard, in map units a second (x across the screen, y down it). */
export function wind(t: number): [number, number] {
  const swing = 0.35 * Math.sin(t / 97) + 0.15 * Math.sin(t / 31)
  const gust = 0.6 + 0.3 * Math.sin(t / 7.3) + 0.25 * Math.max(0, Math.sin(t / 2.9 + Math.sin(t / 5.1) * 2))
  const a = -0.25 + swing
  return [Math.cos(a) * 22 * gust, Math.sin(a) * 9 * gust]
}

type Gull = { x: number; y: number; z: number; vx: number; vy: number; phase: number; flap: number; scared: number }
type Leaf = { x: number; y: number; z: number; vz: number; t: number; rest: number; c: string; spin: number; k: number }

export function createFlock(o: {
  /** The island's ground, a letter a tile (0 sea, 1 land, b beach): where the trees can stand. */
  grid: string; gridSize: number
  /** Where the flock wheels (a tile point over the water). */
  home: [number, number]
  play: boolean
  /** The towns' land cells, where leaves come off the trees. */
  towns: [number, number][]
}) {
  const N = 18
  const rnd = (() => { let s = 7919; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } })()
  const [hx, hy] = at(o.home[0], o.home[1])
  const gulls: Gull[] = Array.from({ length: N }, () => ({ x: hx + (rnd() - 0.5) * 160, y: hy + (rnd() - 0.5) * 80, z: 150 + rnd() * 60, vx: (rnd() - 0.5) * 30, vy: (rnd() - 0.5) * 15, phase: rnd() * 6.28, flap: 0, scared: 0 }))
  const leaves: Leaf[] = []
  let clock = 0, hand: [number, number] | null = null, handAt = 0

  function step(dt: number) {
    if (!o.play || dt <= 0) return
    clock += dt
    const [wx, wy] = wind(clock)
    // The point they wheel round wanders over the water.
    const ax = hx + Math.cos(clock / 23) * 150 + Math.sin(clock / 9) * 40, ay = hy + Math.sin(clock / 23) * 70
    const handNear = hand && clock - handAt < 0.6 ? hand : null
    for (const g of gulls) {
      let sx = 0, sy = 0, cx = 0, cy = 0, vx = 0, vy = 0, n = 0
      for (const q of gulls) {
        if (q === g) continue
        const dx = q.x - g.x, dy = (q.y - q.z) - (g.y - g.z), d = Math.hypot(dx, dy)
        if (d < 16) { sx -= dx / (d + 0.1); sy -= dy / (d + 0.1) }
        if (d < 70) { cx += q.x; cy += q.y; vx += q.vx; vy += q.vy; n++ }
      }
      let fx = sx * 26, fy = sy * 26
      if (n) { fx += ((cx / n - g.x) * 0.5 + (vx / n - g.vx) * 0.9); fy += ((cy / n - g.y) * 0.5 + (vy / n - g.vy) * 0.9) }
      fx += (ax - g.x) * 0.18; fy += (ay - g.y) * 0.18
      if (handNear) {
        const dx = g.x - handNear[0], dy = g.y - g.z - handNear[1], d = Math.hypot(dx, dy)
        if (d < 90) { fx += (dx / (d + 1)) * 900; fy += (dy / (d + 1)) * 900; g.scared = 1.2 }
      }
      g.scared = Math.max(0, g.scared - dt)
      g.vx += fx * dt; g.vy += fy * dt
      const sp = Math.hypot(g.vx, g.vy), max = g.scared ? 90 : 42, min = 16
      if (sp > max) { g.vx *= max / sp; g.vy *= max / sp } else if (sp < min) { g.vx *= min / (sp || 1); g.vy *= min / (sp || 1) }
      // The wind carries them; climbing when scared, settling back to their height after.
      g.x += (g.vx + wx * 0.6) * dt; g.y += (g.vy + wy * 0.6) * dt
      g.z += ((g.scared ? 230 : 165 + Math.sin(g.phase) * 20) - g.z) * dt * 0.6
      // Flap to gain speed or height, glide otherwise.
      const want = g.scared ? 1 : sp < 26 ? 0.6 : 0
      g.flap += (want - g.flap) * Math.min(1, dt * 3)
      g.phase += dt * (2 + g.flap * 9)
    }
    // Leaves: the gusts shake some loose off the trees in town.
    const gust = Math.hypot(wx, wy) / 22
    if (o.towns.length && leaves.length < 46 && rnd() < dt * (1.5 + gust * 6)) {
      const [i, j] = o.towns[Math.floor(rnd() * o.towns.length)]
      const [x, y] = at(i + rnd(), j + rnd())
      const pink = rnd() < 0.35
      leaves.push({ x, y, z: 20 + rnd() * 14, vz: 0, t: 0, rest: 0, c: pink ? (rnd() < 0.5 ? '#ffc2d4' : '#ff9fb8') : rnd() < 0.5 ? '#7ccf6a' : '#a9d46f', spin: rnd() * 6.28, k: 0.7 + rnd() * 0.6 })
    }
    for (let n = leaves.length - 1; n >= 0; n--) {
      const l = leaves[n]
      l.t += dt
      if (l.z > 0) {
        // Falling: drag keeps it slow, and it swings from side to side on its way down.
        l.vz = Math.max(-9, l.vz - 14 * dt)
        l.z = Math.max(0, l.z + l.vz * dt)
        const sway = Math.sin(l.t * 3.1 + l.spin) * 9
        l.x += (wx * 0.9 + sway) * dt; l.y += (wy * 0.9) * dt
        l.spin += dt * 4
      } else {
        l.rest += dt
        if (l.rest > 5) leaves.splice(n, 1)
      }
    }
  }

  function drawSky(c: CanvasRenderingContext2D, m: M): number {
    if (!o.play) return 0
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
    c.lineCap = 'round'; c.lineJoin = 'round'
    // All the gulls in two strokes: their wings, then a fainter one for their shadows on the sea far below.
    c.strokeStyle = 'rgba(27,35,64,0.14)'; c.lineWidth = 1.6
    c.beginPath()
    for (const g of gulls) { const s = 6; c.moveTo(g.x - s, g.y); c.quadraticCurveTo(g.x, g.y - 2, g.x + s, g.y) }
    c.stroke()
    c.strokeStyle = '#f4f7fd'; c.lineWidth = 1.9
    c.beginPath()
    for (const g of gulls) {
      const y = g.y - g.z, w = 7, lift = Math.sin(g.phase) * (2 + g.flap * 4)
      c.moveTo(g.x - w, y - lift); c.quadraticCurveTo(g.x - w * 0.45, y - 3 - lift * 0.5, g.x, y); c.quadraticCurveTo(g.x + w * 0.45, y - 3 - lift * 0.5, g.x + w, y - lift)
    }
    c.stroke()
    c.strokeStyle = 'rgba(70,82,110,0.55)'; c.lineWidth = 0.8
    c.stroke()
    return 4
  }

  function drawGround(c: CanvasRenderingContext2D, m: M): number {
    if (!o.play || !leaves.length) return 0
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
    // One shape a colour, every leaf of it in it: a leaf at rest shrinks away rather than fading, so none needs a draw of its own.
    const by = new Map<string, Leaf[]>()
    for (const l of leaves) { const list = by.get(l.c); if (list) list.push(l); else by.set(l.c, [l]) }
    for (const [col, list] of by) {
      c.fillStyle = col
      c.beginPath()
      for (const l of list) {
        const k = l.k * (l.rest > 3 ? Math.max(0, 1 - (l.rest - 3) / 2) : 1)
        if (k <= 0.05) continue
        const y = l.y - l.z, w = 2.2 * k, h = (0.9 + Math.abs(Math.sin(l.spin)) * 0.9) * k
        c.moveTo(l.x + w, y); c.ellipse(l.x, y, w, h, l.spin * 0.3, 0, Math.PI * 2)
      }
      c.fill()
    }
    return by.size
  }

  return {
    step, drawSky, drawGround,
    /** The hand is over the map at (x, y): gulls near it scatter. */
    pointer(x: number, y: number) { hand = [x, y]; handAt = clock },
  }
}

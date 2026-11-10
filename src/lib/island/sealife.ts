/**
 * Tiny Island — what lives in the water.
 *
 *   - under the surface, as shadows: shoals of fish that turn together, a
 *     turtle paddling along, a manta ray gliding; they keep to the sea and
 *     turn away from the shore;
 *   - the light the swell throws on the sea bed, a net of it, shifting;
 *   - after dark, jellyfish that pulse, and the shore's own glow where the
 *     water is stirred (the sea sparkles of a warm night).
 *
 * None of it is baked: drawn live by the engine's hooks (LiveLayer in
 * engine.ts), clipped to the open sea so nothing swims under the land. `under`
 * goes just after the sea (so the night falls over it with the water); `glow`
 * after the night (it is light). With motion off it all holds still.
 */
import type { LiveHook } from './engine'

type C = CanvasRenderingContext2D
type Mx = [number, number, number, number, number, number]

/** A swimmer: where it is and which way it heads, in tiles; how fast; how big; and what it is. */
type Swimmer = { kind: 'shoal' | 'turtle' | 'manta'; i: number; j: number; th: number; v: number; k: number; turn: number; ph: number; n?: number; /** Startled: how much faster it goes for a moment (it dies away). */ dart?: number }

/** Who is out there, and where each starts (tiles; outside the island's square it is all sea). */
const SWIMMERS: Swimmer[] = [
  { kind: 'shoal', i: -3, j: 8, th: 0.4, v: 0.55, k: 1, turn: 1, ph: 0, n: 13 },
  { kind: 'shoal', i: 33, j: 20, th: 3.4, v: 0.5, k: 0.9, turn: -1, ph: 1.3, n: 11 },
  { kind: 'shoal', i: 12, j: 34, th: 5.2, v: 0.6, k: 1.1, turn: 1, ph: 2.6, n: 15 },
  { kind: 'shoal', i: 20, j: -4, th: 1.9, v: 0.52, k: 0.85, turn: -1, ph: 3.9, n: 9 },
  { kind: 'turtle', i: -4, j: 22, th: 5.6, v: 0.22, k: 1, turn: 1, ph: 0.7 },
  { kind: 'turtle', i: 34, j: 6, th: 2.5, v: 0.2, k: 0.85, turn: -1, ph: 2.2 },
  { kind: 'manta', i: 30, j: 34, th: 4.1, v: 0.34, k: 1, turn: 1, ph: 1.1 },
  { kind: 'manta', i: -5, j: -3, th: 0.9, v: 0.3, k: 0.8, turn: -1, ph: 3.3 },
]
/** Jellyfish: a tile each drifts round, and its colour. */
const JELLIES: { i: number; j: number; c: string; ph: number }[] = [
  { i: -3.5, j: 12, c: '120,240,255', ph: 0 }, { i: -2, j: 14.5, c: '190,150,255', ph: 1.7 }, { i: -4.5, j: 15, c: '130,255,220', ph: 3.1 },
  { i: 32.5, j: 14, c: '190,150,255', ph: 0.6 }, { i: 34, j: 16.5, c: '120,240,255', ph: 2.4 },
  { i: 17, j: 33, c: '130,255,220', ph: 4.2 }, { i: 19.5, j: 34.5, c: '120,240,255', ph: 5.3 }, { i: 15, j: 35, c: '190,150,255', ph: 1.1 },
  { i: 10, j: -3.5, c: '120,240,255', ph: 3.7 }, { i: 13, j: -5, c: '130,255,220', ph: 0.3 },
]

export function createSeaLife(o: {
  /** The island's ground, a letter a tile: 0 sea. */
  grid: string
  size: number
  /** The open sea, in tiles, filled even-odd (world.ts). */
  openSea?: string
  play: boolean
  /** How dark it is, 0 by day to 1 at night. */
  dark: () => number
}) {
  const G = o.size
  const sea = (i: number, j: number) => { const a = Math.floor(i), b = Math.floor(j); return a < 0 || b < 0 || a >= G || b >= G || o.grid[a * G + b] === '0' }
  /** Open water with room round it. */
  const clear = (i: number, j: number) => sea(i, j) && sea(i + 0.9, j) && sea(i - 0.9, j) && sea(i, j + 0.9) && sea(i, j - 0.9)
  const swimmers = SWIMMERS.map((s) => ({ ...s }))
  let clip: Path2D | null = null
  let last = 0

  /** A swimmer's next moment: on its way, wandering a little; away from the shore and back from the far sea. */
  const step = (s: Swimmer, dt: number, t: number) => {
    const ahead = 2.6, ai = s.i + Math.cos(s.th) * ahead, aj = s.j + Math.sin(s.th) * ahead
    const cx = G / 2, cy = G / 2, far = Math.hypot(s.i - cx, s.j - cy) > G * 0.5 + 9
    if (!clear(ai, aj) || !clear(s.i + Math.cos(s.th) * 1.2, s.j + Math.sin(s.th) * 1.2)) s.th += s.turn * 1.5 * dt
    else if (far) {
      // Back toward the island, the short way round.
      const want = Math.atan2(cy - s.j, cx - s.i)
      let d = want - s.th
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      s.th += Math.sign(d) * Math.min(Math.abs(d), 0.5 * dt)
    } else s.th += Math.sin(t * 0.23 + s.ph * 3) * 0.22 * dt
    const v = s.v * (1 + 3.2 * (s.dart ?? 0))
    if (s.dart) s.dart = s.dart < 0.02 ? 0 : s.dart * Math.exp(-dt / 0.7)
    s.i += Math.cos(s.th) * v * dt; s.j += Math.sin(s.th) * v * dt
  }

  /* ---- the shapes, in the swimmer's own space (forward is +x, a unit a tile), laid on the water by `put` ---- */
  let ox = 0, oy = 0, cs = 1, sn = 0
  /** Onto the map: P(i, j, SEA) is (32 (i - j), 16 (i + j) + 12). */
  const px = (x: number, y: number) => { const i = ox + x * cs - y * sn, j = oy + x * sn + y * cs; return 32 * (i - j) }
  const py = (x: number, y: number) => { const i = ox + x * cs - y * sn, j = oy + x * sn + y * cs; return 16 * (i + j) + 12 }
  const put = (s: { i: number; j: number; th: number }) => { ox = s.i; oy = s.j; cs = Math.cos(s.th); sn = Math.sin(s.th) }
  const poly = (p: Path2D, pts: number[]) => { p.moveTo(px(pts[0], pts[1]), py(pts[0], pts[1])); for (let q = 2; q < pts.length; q += 2) p.lineTo(px(pts[q], pts[q + 1]), py(pts[q], pts[q + 1])); p.closePath() }
  const oval = (p: Path2D, x: number, y: number, rx: number, ry: number, steps = 10) => {
    for (let q = 0; q <= steps; q++) { const a = (q / steps) * Math.PI * 2, X = x + Math.cos(a) * rx, Y = y + Math.sin(a) * ry; if (q) p.lineTo(px(X, Y), py(X, Y)); else p.moveTo(px(X, Y), py(X, Y)) }
    p.closePath()
  }

  const fish = (p: Path2D, k: number, wag: number) => {
    const L = 0.2 * k, W = 0.06 * k
    // A body that tapers, and a tail that wags.
    poly(p, [L, 0, L * 0.35, W, -L * 0.55, W * 0.35, -L, W * 1.1 + wag * W, -L * 0.8, wag * W * 0.5, -L, -W * 1.1 + wag * W, -L * 0.55, -W * 0.35, L * 0.35, -W])
  }
  const shoal = (p: Path2D, s: Swimmer, t: number) => {
    const n = s.n ?? 10
    for (let q = 0; q < n; q++) {
      // Its place in the shoal: a loose wedge behind the first, each drifting in its own small round.
      const row = Math.ceil((Math.sqrt(8 * q + 1) - 1) / 2), col = row ? q - (row * (row - 1)) / 2 - 1 : 0
      const bx = -row * 0.36 + Math.sin(t * 0.7 + q * 1.9 + s.ph) * 0.08, by = (row ? (col - (row - 1) / 2) * 0.3 : 0) + Math.cos(t * 0.55 + q * 2.3) * 0.07
      const wag = Math.sin(t * 7 + q * 1.3)
      const i = s.i + bx * Math.cos(s.th) - by * Math.sin(s.th), j = s.j + bx * Math.sin(s.th) + by * Math.cos(s.th)
      put({ i, j, th: s.th + wag * 0.06 })
      fish(p, s.k * (0.8 + ((q * 37) % 10) / 25), wag)
    }
  }
  const turtle = (p: Path2D, s: Swimmer, t: number) => {
    put(s)
    const k = 0.5 * s.k, pad = Math.sin(t * 1.6 + s.ph)
    oval(p, 0, 0, 0.5 * k, 0.4 * k, 12)
    oval(p, 0.62 * k, 0, 0.16 * k, 0.12 * k, 8)
    // Four flippers: the front pair row, the back pair trail.
    for (const side of [1, -1]) {
      const f = 0.25 + pad * 0.35
      poly(p, [0.3 * k, side * 0.3 * k, (0.45 - f * 0.5) * k, side * (0.82 + f * 0.1) * k, (0.2 - f * 0.55) * k, side * 0.86 * k, 0.1 * k, side * 0.36 * k])
      poly(p, [-0.34 * k, side * 0.26 * k, -0.66 * k, side * (0.5 - pad * 0.06) * k, -0.72 * k, side * 0.36 * k, -0.46 * k, side * 0.16 * k])
    }
    poly(p, [-0.48 * k, 0.05 * k, -0.7 * k, 0, -0.48 * k, -0.05 * k])
  }
  const manta = (p: Path2D, s: Swimmer, t: number) => {
    put(s)
    const k = 0.85 * s.k, flap = Math.sin(t * 1.1 + s.ph), tip = 0.86 + flap * 0.14, sweep = -0.18 - flap * 0.1
    // Wings out to their tips and back to the tail's root; the two horns at the head.
    poly(p, [
      0.5 * k, 0.1 * k, 0.62 * k, 0.2 * k, 0.4 * k, 0.26 * k, 0.16 * k, 0.5 * k, sweep * k, tip * k, -0.2 * k, 0.42 * k, -0.42 * k, 0.12 * k,
      -0.5 * k, 0, -0.42 * k, -0.12 * k, -0.2 * k, -0.42 * k, sweep * k, -tip * k, 0.16 * k, -0.5 * k, 0.4 * k, -0.26 * k, 0.62 * k, -0.2 * k, 0.5 * k, -0.1 * k,
    ])
    const sway = Math.sin(t * 0.9 + s.ph) * 0.07
    poly(p, [-0.46 * k, 0.025 * k, -0.9 * k, sway * k * 0.5 + 0.012 * k, -1.3 * k, sway * k, -0.9 * k, sway * k * 0.5 - 0.012 * k, -0.46 * k, -0.025 * k])
  }

  /* ---- the light on the sea bed: a net of it, as a seamless tile ---- */
  const NET = 256
  let net: CanvasPattern | null = null, netTried = false
  const netTile = () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = NET
    const g = cv.getContext('2d')!, img = g.createImageData(NET, NET)
    let seed = 23
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const N = 7, cell = NET / N
    const pts: [number, number][] = []
    for (let a = 0; a < N * N; a++) pts.push([((a % N) + 0.15 + rnd() * 0.7) * cell, (Math.floor(a / N) + 0.15 + rnd() * 0.7) * cell])
    const TAU = Math.PI * 2
    for (let Y = 0; Y < NET; Y++) for (let X = 0; X < NET; X++) {
      // Water bends the net: the picture is read through a slow ripple (one that comes round with the tile).
      const x = X + 11 * Math.sin((Y / NET) * TAU * 2 + 0.6) + 5 * Math.sin((Y / NET) * TAU * 5 + (X / NET) * TAU * 3)
      const y = Y + 11 * Math.sin((X / NET) * TAU * 2 + 2.1) + 5 * Math.sin((X / NET) * TAU * 4 - (Y / NET) * TAU * 3)
      // The two nearest of the scattered points (wrapping round): light gathers where they are equally far.
      let d1 = 1e9, d2 = 1e9
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx, gy = cy + dy, p = pts[(((gy % N) + N) % N) * N + (((gx % N) + N) % N)]
        const qx = p[0] + Math.floor(gx / N) * NET - x, qy = p[1] + Math.floor(gy / N) * NET - y, d = Math.hypot(qx, qy)
        if (d < d1) { d2 = d1; d1 = d } else if (d < d2) d2 = d
      }
      const e = Math.max(0, 1 - (d2 - d1) / (cell * 0.34)), v = e * e * e * e * (0.55 + 0.45 * Math.sin((X / NET) * TAU * 3 + (Y / NET) * TAU * 2))
      const at = (Y * NET + X) * 4
      img.data[at] = 235; img.data[at + 1] = 252; img.data[at + 2] = 255; img.data[at + 3] = Math.round(v * 255)
    }
    g.putImageData(img, 0, 0)
    return cv
  }

  /* ---- jellyfish and the shore's glow ---- */
  const bells = new Map<string, HTMLCanvasElement>()
  const bell = (rgb: string) => {
    let cv = bells.get(rgb)
    if (cv) return cv
    cv = document.createElement('canvas'); cv.width = 64; cv.height = 64
    const g = cv.getContext('2d')!
    const halo = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    halo.addColorStop(0, `rgba(${rgb},0.55)`); halo.addColorStop(0.35, `rgba(${rgb},0.22)`); halo.addColorStop(1, `rgba(${rgb},0)`)
    g.fillStyle = halo; g.fillRect(0, 0, 64, 64)
    // The bell, and its trailing arms.
    g.fillStyle = `rgba(${rgb},0.9)`
    g.beginPath(); g.moveTo(22, 31); g.bezierCurveTo(22, 19, 42, 19, 42, 31); g.quadraticCurveTo(32, 34, 22, 31); g.fill()
    g.strokeStyle = `rgba(${rgb},0.6)`; g.lineWidth = 1.3; g.lineCap = 'round'
    for (const x of [25, 29.5, 34.5, 39]) { g.beginPath(); g.moveTo(x, 32); g.quadraticCurveTo(x + (x < 32 ? -2 : 2), 38, x, 44); g.stroke() }
    bells.set(rgb, cv)
    return cv
  }
  /** The stirred water along the shore: two sets of points of light, one brightening as the other fades. */
  let shore: [Path2D, Path2D] | null = null
  const shoreGlow = (): [Path2D, Path2D] => {
    if (shore) return shore
    const sets: [Path2D, Path2D] = [new Path2D(), new Path2D()]
    let seed = 97
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = -1; i <= G; i++) for (let j = -1; j <= G; j++) {
      if (!sea(i, j)) continue
      // Water with land beside it.
      const coast = !sea(i + 1, j) || !sea(i - 1, j) || !sea(i, j + 1) || !sea(i, j - 1)
      if (!coast) continue
      for (let q = 0; q < 7; q++) {
        const a = i + rnd(), b = j + rnd(), x = 32 * (a - b), y = 16 * (a + b) + 12, r = 0.8 + rnd() * 1.5
        const p = sets[q % 2]
        p.moveTo(x + r, y); p.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2)
      }
    }
    return (shore = sets)
  }

  const seaClip = (c: C, m: Mx) => {
    if (!o.openSea) return
    if (!clip) clip = new Path2D(o.openSea)
    // The open sea is in tiles: P(i, j, SEA) is (32 (i - j), 16 (i + j) + 12).
    c.setTransform(m[0] * 32, m[3] * 16, -m[0] * 32, m[3] * 16, m[4], m[3] * 12 + m[5])
    c.clip(clip, 'evenodd')
  }

  const under: LiveHook = (c, m, now) => {
    const t = o.play ? now / 1000 : 0, dt = o.play && last ? Math.min(0.05, (now - last) / 1000) : 0
    last = now
    const dark = o.dark(), day = Math.max(0, 1 - dark)
    let n = 0
    c.save()
    seaClip(c, m); n += 2
    // The net of light on the sea bed: twice over, sliding across itself.
    if (day > 0.05) {
      if (!net && !netTried) { netTried = true; net = c.createPattern(netTile(), 'repeat') }
      if (net) {
        c.globalCompositeOperation = 'soft-light'
        c.fillStyle = net
        const W = c.canvas.width, H = c.canvas.height
        for (const [k, vx, vy, a] of [[1.3, 4, 1.6, 0.5], [2.1, -2.6, 2.2, 0.4]]) {
          const span = NET * k, dx = (((vx * t) % span) + span) % span, dy = (((vy * t) % (span / 2)) + span / 2) % (span / 2)
          const A = m[0] * k, D = m[3] * k * 0.5, E = m[4] + m[0] * dx, F = m[5] + m[3] * dy
          c.setTransform(A, 0, 0, D, E, F)
          c.globalAlpha = a * day
          c.fillRect(-E / A, -F / D, W / A, H / D); n += 2
        }
        c.globalCompositeOperation = 'source-over'
      }
    }
    // The swimmers, as shadows under the surface.
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); n++
    const cw = c.canvas.width, ch = c.canvas.height
    for (const s of swimmers) {
      if (dt) step(s, dt, t)
      const x = m[0] * (32 * (s.i - s.j)) + m[4], y = m[3] * (16 * (s.i + s.j) + 12) + m[5], pad = 90 * m[0]
      if (x < -pad || x > cw + pad || y < -pad || y > ch + pad) continue
      const p = new Path2D()
      if (s.kind === 'shoal') shoal(p, s, t); else if (s.kind === 'turtle') turtle(p, s, t); else manta(p, s, t)
      c.globalAlpha = (s.kind === 'shoal' ? 0.46 : 0.4) * (1 - dark * 0.5)
      c.fillStyle = s.kind === 'turtle' ? '#1c5a4e' : '#123a78'
      c.fill(p); n++
    }
    c.restore()
    c.globalAlpha = 1
    return n + 1
  }

  const glow: LiveHook = (c, m, now) => {
    const dark = o.dark()
    if (dark < 0.6) return 0
    const t = o.play ? now / 1000 : 0, k = (dark - 0.6) / 0.4
    let n = 0
    c.save()
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); n++
    c.globalCompositeOperation = 'lighter'
    // The shore's glow (in the shallows, which the open sea leaves out).
    const [a, b] = shoreGlow(), beat = 0.5 + 0.5 * Math.sin(t * 0.9)
    c.fillStyle = '#7df3ff'
    c.globalAlpha = k * (0.25 + 0.6 * beat); c.fill(a)
    c.globalAlpha = k * (0.25 + 0.6 * (1 - beat)); c.fill(b); n += 2
    seaClip(c, m); n += 2
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); n++
    // The jellyfish: each drifts round its own spot, and pulses.
    const cw = c.canvas.width, ch = c.canvas.height
    for (const J of JELLIES) {
      const i = J.i + Math.sin(t * 0.11 + J.ph) * 1.1, j = J.j + Math.cos(t * 0.09 + J.ph * 1.7) * 1.1
      const x = 32 * (i - j), y = 16 * (i + j) + 12
      const sx = m[0] * x + m[4], sy = m[3] * y + m[5]
      if (sx < -60 || sx > cw + 60 || sy < -60 || sy > ch + 60) continue
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + J.ph * 2), size = 30 + pulse * 5
      c.globalAlpha = k * (0.55 + 0.45 * pulse)
      c.drawImage(bell(J.c), x - size / 2, y - size / 2 - pulse * 2, size, size); n++
    }
    c.restore()
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1
    return n + 1
  }
  return {
    under, glow,
    /** Something touched the water at (x, y) on the map: whatever swims near darts away from it. */
    startle(x: number, y: number) {
      if (!o.play) return
      const i = (x / 32 + (y - 12) / 16) / 2, j = ((y - 12) / 16 - x / 32) / 2
      for (const s of swimmers) {
        const d = Math.hypot(s.i - i, s.j - j)
        if (d > (s.kind === 'shoal' ? 2.4 : 1.6)) continue
        const away = Math.atan2(s.j - j, s.i - i)
        // Only if the way out is open water: else it keeps its own way, faster.
        if (clear(s.i + Math.cos(away) * 1.6, s.j + Math.sin(away) * 1.6)) s.th = away
        s.dart = 1
      }
    },
  }
}

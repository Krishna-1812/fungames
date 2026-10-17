/**
 * Tiny Island — the things on the map that answer back.
 *
 * A beach ball you can pick up and throw (it bounces, rolls to a stop in the
 * sand, and if it lands in the sea it floats and drifts back in); a flock of
 * pigeons on the town square that goes up when you come near, circles, and
 * comes down again; rings on the water wherever it is touched; and the day's
 * parade, which marches from the square to the day's game and back every five
 * minutes by the clock, so everyone on the island sees it at the same time.
 *
 * None of it is baked: it is drawn live by the engine's hooks (LiveLayer in
 * engine.ts), in the painting's own order, so a building in front of the
 * parade hides it as it hides the island's own walkers, and the windows in
 * front of the buildings show it again where it passes. Everything moves by
 * the time that has passed, not the frame. With reduced motion nothing here
 * moves: the ball sits, the pigeons stand, and there is no parade.
 */
import type { LiveLayer } from './engine'
import type { Box, M } from './scene'

const INK = '#1b2340'
const T = 32, H = 16
/** Tiles to the map's own units (the screen at zoom 1), at height z. */
const at = (i: number, j: number, z = 0): [number, number] => [(i - j) * T, (i + j) * H - z]
/** The map's units back to tiles, on the ground at height z. */
const tile = (x: number, y: number, z = 0): [number, number] => { const a = x / T, b = (y + z) / H; return [(a + b) / 2, (b - a) / 2] }
/** A movement in the map's units, as a movement in tiles. */
const dTile = (dx: number, dy: number): [number, number] => { const a = dx / T, b = dy / H; return [(a + b) / 2, (b - a) / 2] }
const SEA = -12, BEACH = -6, GRID = 30

/** A marcher of the parade as a picture (folk.ts): their body without legs, for the canvas to march; the colour of their legs, and how big they are. */
export type FolkPic = { svg: string; legs: string; k: number }
export type PlayData = { square: [number, number]; board: [number, number]; ball: { at: [number, number]; cells: [number, number][] }; routes: Record<string, [number, number][]>; sprites?: (Sprites & { id: string }) | null; folk?: FolkPic[] }
import type { Sprites } from './actors'
export type Sounds = { thump?: (k: number) => void; splash?: () => void; flutter?: () => void }

/** The parade's timetable: once every this many seconds, by the clock. */
export const PARADE_EVERY = 300
/** How fast the parade walks, in map units a second (a little slower than the island's walkers). */
const PACE = 24
/** The gap between one marcher and the next. */
const GAP = 13

export function createPlay(o: {
  data: PlayData
  /** The island's ground, a letter a tile: 0 sea, 1 land, b beach. */
  grid: string
  play: boolean
  /** Today's game, for the parade. */
  daily: () => string
  /** The district ink of today's game, for the parade's flag. */
  ink: () => string
  sound: () => Sounds | null
  /** The flock went up (`all`: every one of them, as the bell does). */
  onScare?: (all: boolean) => void
  /** Where the baked files are (the sheet of Unity's pictures for the canvas: sprites.webp). */
  base?: string
}) {
  /* ---- Unity's pictures, on the realistic island (lib/island/actors.ts, scripts/bake-island.mjs) ---- */
  type SheetMeta = { rects: Record<string, [number, number, number, number]>; sizes: Record<string, { w: number; h: number; ax: number; ay: number }> }
  let sheet: HTMLImageElement | null = null, meta: SheetMeta | null = null
  const sp = o.data.sprites ?? null
  if (sp && o.base && typeof Image !== 'undefined') {
    fetch(o.base + 'sprites.json').then((r) => (r.ok ? r.json() : null)).then((m: SheetMeta | null) => {
      if (!m) return
      const im = new Image()
      im.decoding = 'async'
      im.onload = () => { meta = m; sheet = im }
      im.src = o.base + 'sprites.webp'
    }).catch(() => {})
  }
  /** One of Unity's pictures, its foot at (x, y), at k times its size; false if not loaded. */
  const drawPic = (c: CanvasRenderingContext2D, name: string | undefined, x: number, y: number, k = 1): boolean => {
    if (!sheet || !meta || !name) return false
    const r = meta.rects[name], z = meta.sizes[name]
    if (!r || !z) return false
    c.drawImage(sheet, r[0], r[1], r[2], r[3], x - z.ax * k, y - z.ay * k, z.w * k, z.h * k)
    return true
  }
  /** Which of the four ways a step on screen heads (se, sw, nw, ne). */
  const way = (dx: number, dy: number) => (dx >= 0 ? (dy >= 0 ? 0 : 3) : dy >= 0 ? 1 : 2)
  const ground = (i: number, j: number) => { const a = Math.floor(i), b = Math.floor(j); return a < 0 || b < 0 || a >= GRID || b >= GRID ? '0' : o.grid[a * GRID + b] }
  const ballCells = new Set(o.data.ball.cells.map(([i, j]) => `${i},${j}`))
  const onSand = (i: number, j: number) => ballCells.has(`${Math.floor(i)},${Math.floor(j)}`)
  const inSea = (i: number, j: number) => ground(i, j) === '0'
  let last = 0
  /** Device pixels to a map unit, as the last frame drew. */
  let scale = 1

  /* ---- rings on the water ---------------------------------------------------- */
  type Ring = { x: number; y: number; at: number; size: number; life: number }
  const rings: Ring[] = []
  const ring = (x: number, y: number, size = 1, life = 1.7) => {
    if (!o.play) return
    if (rings.length > 28) rings.shift()
    rings.push({ x, y, at: performance.now(), size, life })
  }
  let lastTrail = 0
  /** A splash: two rings, one just after the other. */
  const splash = (x: number, y: number, size = 1) => { ring(x, y, size, 1.5); setTimeout(() => ring(x, y, size * 0.7, 1.3), 160) }

  /* ---- the ball ---------------------------------------------------------------- */
  const R = 5.4
  const home = o.data.ball.at
  const ball = { i: home[0], j: home[1], h: 0, vi: 0, vj: 0, vh: 0, spin: 0, held: false, wet: false, ringT: 0 }
  const COLS = ['#5b82ff', '#ffffff', '#4fe3c1', '#ffffff', '#ff4f6e', '#ffffff']
  const ballZ = () => (ball.wet ? SEA + 1.2 : BEACH)
  /** Where the ball is on the map, in its own units: the middle of it. */
  const ballXY = (): [number, number] => { const [x, y] = at(ball.i, ball.j, ballZ()); return [x, y - ball.h - R] }
  function stepBall(dt: number) {
    if (ball.held) return
    const was = { i: ball.i, j: ball.j }
    // In the air: falling. On the sand: rolling, slowing fast. In the sea: floating, drifting home.
    if (ball.h > 0 || ball.vh > 0) {
      ball.vh -= 560 * dt; ball.h += ball.vh * dt
      const air = Math.exp(-0.25 * dt); ball.vi *= air; ball.vj *= air
      if (ball.h <= 0) {
        ball.h = 0
        const sea = inSea(ball.i, ball.j)
        if (sea) { ball.wet = true; ball.vh = 0; ball.vi *= 0.3; ball.vj *= 0.3; const [x, y] = at(ball.i, ball.j, SEA); splash(x, y, 1.2); o.sound()?.splash?.() }
        else {
          const hit = -ball.vh
          ball.vh = hit > 40 ? hit * 0.42 : 0
          if (hit > 30) o.sound()?.thump?.(Math.min(1, hit / 260))
          ball.vi *= 0.8; ball.vj *= 0.8
        }
      }
    } else if (ball.wet) {
      const k = Math.exp(-1.6 * dt); ball.vi *= k; ball.vj *= k
      // The tide brings it in, gently.
      const di = home[0] - ball.i, dj = home[1] - ball.j, d = Math.hypot(di, dj) || 1
      ball.vi += (di / d) * 0.55 * dt; ball.vj += (dj / d) * 0.55 * dt
      ball.ringT -= dt
      if (ball.ringT <= 0) { const [x, y] = at(ball.i, ball.j, SEA); ring(x, y + 2, 0.55, 1.6); ball.ringT = 1.4 }
    } else {
      const k = Math.exp(-2.1 * dt); ball.vi *= k; ball.vj *= k
      if (Math.hypot(ball.vi, ball.vj) < 0.03) { ball.vi = 0; ball.vj = 0 }
    }
    ball.i += ball.vi * dt; ball.j += ball.vj * dt
    // Off the sand onto anything but the sea: it bounces back off the edge.
    if (!onSand(ball.i, ball.j) && !inSea(ball.i, ball.j)) {
      if (!onSand(ball.i, was.j) && !inSea(ball.i, was.j)) { ball.i = was.i; ball.vi = -ball.vi * 0.55 }
      if (!onSand(was.i, ball.j) && !inSea(was.i, ball.j)) { ball.j = was.j; ball.vj = -ball.vj * 0.55 }
      if (!onSand(ball.i, ball.j) && !inSea(ball.i, ball.j)) { ball.i = was.i; ball.j = was.j }
    }
    // Floated back to the sand: out of the water, and it rolls up the beach a little.
    if (ball.wet && onSand(ball.i, ball.j)) { ball.wet = false; ball.vi *= 0.5; ball.vj *= 0.5 }
    // Never too far out to sea.
    if (Math.hypot(ball.i - home[0], ball.j - home[1]) > 4) { const k = 4 / Math.hypot(ball.i - home[0], ball.j - home[1]); ball.i = home[0] + (ball.i - home[0]) * k; ball.j = home[1] + (ball.j - home[1]) * k }
    const v = Math.hypot(ball.vi, ball.vj) * 36
    ball.spin += (v * dt) / R * (ball.vi - ball.vj >= 0 ? 1 : -1)
    // Landing among the pigeons sends them up (the square is far from the beach, but a thrown ball can be carried).
    if (ball.h === 0 && v > 0) scareNear(...ballXY(), 30)
  }
  function drawBall(c: CanvasRenderingContext2D, m: M): number {
    const [gx, gy] = at(ball.i, ball.j, ballZ())
    const [x, y] = ballXY()
    if (!visible(m, [x - 12, y - 12, x + 12, gy + 6])) return 0
    let n = 0
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); n++
    // Its shadow, smaller and fainter the higher it is.
    if (!ball.wet) {
      const k = Math.max(0.35, 1 - ball.h / 90)
      c.globalAlpha = 0.16 * k; c.fillStyle = INK
      c.beginPath(); c.ellipse(gx - 1, gy + 0.5, R * 1.15 * k, R * 0.45 * k, 0, 0, Math.PI * 2); c.fill(); n++
    }
    c.globalAlpha = 1
    const bob = ball.wet ? Math.sin(performance.now() / 420) * 0.8 : 0
    const cy = y + bob
    // Far out it is a dot of colour; close, a ball in six panels that turn as it rolls.
    if (scale < 0.9) { c.fillStyle = COLS[0]; c.beginPath(); c.arc(x, cy, R, 0, Math.PI * 2); c.fill(); return n + 1 }
    c.save(); n++
    c.beginPath(); c.arc(x, cy, R, 0, Math.PI * 2); c.clip()
    for (let k = 0; k < 6; k++) {
      c.fillStyle = COLS[k]
      c.beginPath(); c.moveTo(x, cy); c.arc(x, cy, R + 1, ball.spin + (k * Math.PI) / 3, ball.spin + ((k + 1) * Math.PI) / 3); c.closePath(); c.fill(); n++
    }
    // The water line, when it floats.
    if (ball.wet) { c.fillStyle = 'rgba(140, 203, 255, 0.75)'; c.fillRect(x - R - 1, cy + R * 0.35, R * 2 + 2, R); n++ }
    c.restore()
    if (sp) {
      // Lit as a ball is: bright towards the sun, falling off to shadow, no outline.
      const g = c.createRadialGradient(x - R * 0.35, cy - R * 0.45, R * 0.1, x, cy, R * 1.05)
      g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(20,28,50,0.18)'); g.addColorStop(1, 'rgba(20,28,50,0.42)')
      c.fillStyle = g; c.beginPath(); c.arc(x, cy, R, 0, Math.PI * 2); c.fill(); n++
    } else {
    c.strokeStyle = INK; c.lineWidth = 1.05
    c.beginPath(); c.arc(x, cy, R, 0, Math.PI * 2); c.stroke(); n++
    }
    c.fillStyle = '#ffffff'; c.globalAlpha = 0.85
    c.beginPath(); c.ellipse(x - 1.8, cy - 2.2, 1.6, 1, -0.6, 0, Math.PI * 2); c.fill(); n++
    c.globalAlpha = 1
    return n
  }

  /* ---- the pigeons --------------------------------------------------------------- */
  const [sqI, sqJ] = [o.data.square[0] + 0.5, o.data.square[1] + 0.5]
  type Bird = { hi: number; hj: number; i: number; j: number; face: number; peck: number; hop: number; fly: null | { at: number; dur: number; ang: number; far: number; delay: number } }
  const birds: Bird[] = Array.from({ length: 9 }, (_, k) => {
    const a = k * 2.399, r = 0.12 + (k % 4) * 0.085
    const hi = sqI + Math.cos(a) * r, hj = sqJ + Math.sin(a) * r * 0.9
    return { hi, hj, i: hi, j: hj, face: k % 2 ? 1 : -1, peck: k * 0.7, hop: 1 + k * 0.6, fly: null }
  })
  let lastScare = 0
  /** Every pigeon on the ground within d of (x, y) goes up, the nearest first. */
  function scareNear(x: number, y: number, d: number, all = false) {
    if (!o.play) return
    const now = performance.now()
    let any = false
    for (const b of birds) {
      if (b.fly) continue
      const [bx, by] = at(b.i, b.j)
      const dist = Math.hypot(bx - x, by - y)
      if (!all && dist > d) continue
      any = true
    }
    if (!any) return
    o.onScare?.(all)
    // One goes, they all go: a flock.
    for (const b of birds) if (!b.fly) {
      const [bx, by] = at(b.i, b.j)
      const away = Math.atan2(by - y, bx - x)
      b.fly = { at: now, dur: 3.6 + Math.random() * 2.2, ang: away + (Math.random() - 0.5) * 1.6, far: 50 + Math.random() * 60, delay: Math.random() * 0.25 }
    }
    if (now - lastScare > 1200) o.sound()?.flutter?.()
    lastScare = now
  }
  /** Where a flying pigeon is: out, up, round and back to where it took off. */
  const flight = (b: Bird, now: number) => {
    const f = b.fly!
    const u = Math.min(1, Math.max(0, ((now - f.at) / 1000 - f.delay) / f.dur))
    const [hx, hy] = at(b.i, b.j)
    const out = Math.sin(Math.PI * u) * f.far, turn = u * Math.PI * 1.4
    const x = hx + Math.cos(f.ang + turn) * out, y = hy + Math.sin(f.ang + turn) * out * 0.5
    const h = Math.sin(Math.PI * u) * (40 + f.far * 0.4)
    return { x, y, h, u, dir: Math.cos(f.ang + turn + Math.PI / 2) >= 0 ? 1 : -1 }
  }
  function stepBirds(dt: number, now: number) {
    for (const b of birds) {
      if (b.fly) { if ((now - b.fly.at) / 1000 > b.fly.dur + b.fly.delay) b.fly = null; continue }
      b.peck += dt
      b.hop -= dt
      if (b.hop <= 0) {
        // A little walk: a step or two, somewhere near home.
        b.hop = 1.5 + Math.random() * 3.5
        const ni = b.hi + (Math.random() - 0.5) * 0.16, nj = b.hj + (Math.random() - 0.5) * 0.16
        b.face = ni - nj > b.i - b.j ? 1 : -1
        b.i = ni; b.j = nj
      }
    }
  }
  function drawBirdsOnGround(c: CanvasRenderingContext2D, m: M, now: number): number {
    if (scale < 0.75) return 0
    const [sx, sy] = at(sqI, sqJ)
    if (!visible(m, [sx - 140, sy - 140, sx + 140, sy + 60])) return 0
    let n = 1
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
    for (const b of birds) {
      if (b.fly) {
        // Its shadow on the ground, under where it flies.
        const p = flight(b, now)
        c.globalAlpha = 0.12 * (1 - p.h / 160); c.fillStyle = INK
        c.beginPath(); c.ellipse(p.x, p.y, 3, 1.2, 0, 0, Math.PI * 2); c.fill(); n++
        continue
      }
      const [x, y] = at(b.i, b.j)
      const pk = Math.max(0, Math.sin(b.peck * 3.2)) ** 6 * 2.2
      n += pigeon(c, x, y, b.face, pk, 0, false)
    }
    c.globalAlpha = 1
    return n
  }
  function drawBirdsFlying(c: CanvasRenderingContext2D, m: M, now: number): number {
    if (scale < 0.75 || !birds.some((b) => b.fly)) return 0
    let n = 1
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
    for (const b of birds) {
      if (!b.fly) continue
      const p = flight(b, now)
      if (p.u <= 0) { const [x, y] = at(b.i, b.j); n += pigeon(c, x, y, b.face, 0, 0, false); continue }
      n += pigeon(c, p.x, p.y - p.h, p.dir, 0, Math.sin(now / 55 + b.peck * 9), true)
    }
    return n
  }
  /** One pigeon, standing (and pecking) or flying (and flapping). */
  /**
   * A pigeon, from a small picture of each of its poses, drawn once (facing
   * either way, head up or down, wings up, level or down): one canvas call a
   * bird, where drawing it from its shapes took ten. A pigeon is a good deal
   * smaller than a person, so the pictures are drawn at its own size.
   */
  const poses = new Map<string, HTMLCanvasElement>()
  const RES = 6, BOXW = 16, BOXH = 16, OX = 8, OY = 12
  function pigeon(c: CanvasRenderingContext2D, x0: number, y0: number, face: number, peck: number, flap: number, flying: boolean): number {
    // Unity's: standing or pecking (facing either way), or on the wing, wings up or down.
    if (sp && sheet) {
      const i = face >= 0 ? 0 : 1
      const name = flying ? (flap > 0 ? sp.pigeon.up[i] : sp.pigeon.down[i]) : peck > 0.3 ? sp.pigeon.peck[i] : sp.pigeon.stand[i]
      if (drawPic(c, name, x0, y0, 0.8)) return 1
    }
    const pk = peck > 1 ? 2 : peck > 0.3 ? 1 : 0, fl = flying ? (flap > 0.33 ? 2 : flap < -0.33 ? 0 : 1) : -1
    const key = `${face}|${pk}|${fl}`
    let img = poses.get(key)
    if (!img) {
      img = document.createElement('canvas')
      img.width = BOXW * RES; img.height = BOXH * RES
      const g = img.getContext('2d')!
      g.scale(RES * PIGEON, RES * PIGEON); g.translate(OX / PIGEON, OY / PIGEON)
      pigeonAt(g, 0, 0, face, [0, 0.9, 2.2][pk], [-1, 0, 1][fl] ?? 0, flying)
      poses.set(key, img)
    }
    c.drawImage(img, x0 - OX, y0 - OY, BOXW, BOXH)
    return 1
  }
  const PIGEON = 0.6
  function pigeonAt(c: CanvasRenderingContext2D, x: number, y: number, face: number, peck: number, flap: number, flying: boolean): number {
    c.globalAlpha = 1
    if (!flying) { c.globalAlpha = 0.14; c.fillStyle = INK; c.beginPath(); c.ellipse(x, y + 0.3, 3.6, 1.3, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1 }
    c.lineWidth = 0.8; c.strokeStyle = INK; c.lineJoin = 'round'
    const by = y - 3.4
    // The body, its tail, the head on the neck, and an eye.
    c.fillStyle = '#b3b9d6'
    c.beginPath(); c.ellipse(x, by, 3.6, 2.4, face * -0.15, 0, Math.PI * 2)
    c.moveTo(x - face * 3, by - 0.6); c.lineTo(x - face * 5.6, by - 1.6); c.lineTo(x - face * 5.4, by + 0.6); c.closePath()
    c.fill(); c.stroke()
    const hx = x + face * 2.8, hy = by - 2.6 + peck
    c.fillStyle = '#8a92b6'
    c.beginPath(); c.arc(hx, hy, 1.6, 0, Math.PI * 2); c.fill(); c.stroke()
    c.strokeStyle = '#4fe3c1'; c.lineWidth = 0.7
    c.beginPath(); c.moveTo(hx - face * 1, hy + 1.4); c.quadraticCurveTo(x + face * 1.2, by - 0.6, x + face * 0.4, by + 0.6); c.stroke()
    c.fillStyle = '#ff9fb2'; c.beginPath(); c.moveTo(hx + face * 1.4, hy - 0.2); c.lineTo(hx + face * 2.6, hy + 0.3); c.lineTo(hx + face * 1.4, hy + 0.6); c.fill()
    let n = 6
    if (flying) {
      // Two wings, up and down.
      c.strokeStyle = INK; c.lineWidth = 0.8; c.fillStyle = '#c8cde4'
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(x - 1.5, by - 1); c.lineTo(x + s * 0.5 - face * 2, by - 1 - 6 * flap * (s > 0 ? 1 : 0.7)); c.lineTo(x + 2, by - 1); c.closePath(); c.fill(); c.stroke(); n++
      }
    }
    return n
  }

  /* ---- the parade ------------------------------------------------------------------ */
  type Path = { pts: [number, number][]; len: number[]; total: number }
  const paths = new Map<string, Path>()
  const pathTo = (slug: string): Path | null => {
    if (paths.has(slug)) return paths.get(slug)!
    const route = o.data.routes[slug]
    if (!route || route.length < 1) return null
    const pts = route.map(([i, j]) => at(i + 0.5, j + 0.5))
    // From the middle of the square's road, round the square, and on.
    const len = [0]
    for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
    const p = { pts, len, total: len[len.length - 1] }
    paths.set(slug, p)
    return p
  }
  /** A point along the way there and back (u from 0 to twice its length), and which way it faces. */
  const along = (p: Path, u: number): { x: number; y: number; dir: number; dx: number; dy: number } => {
    const back = u > p.total, d = back ? 2 * p.total - u : u
    let k = 1
    while (k < p.pts.length - 1 && p.len[k] < d) k++
    const a = p.pts[k - 1] ?? p.pts[0], b = p.pts[k] ?? p.pts[0]
    const seg = (p.len[k] ?? 0) - (p.len[k - 1] ?? 0) || 1
    const t = Math.min(1, Math.max(0, (d - (p.len[k - 1] ?? 0)) / seg))
    const dx = (b[0] - a[0]) * (back ? -1 : 1), dy = (b[1] - a[1]) * (back ? -1 : 1)
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dir: dx >= 0 ? 1 : -1, dx, dy }
  }
  const MARCHERS = 7
  /** How long one parade takes: there and back, and the last marcher home. */
  const lasts = (p: Path) => (2 * p.total + GAP * MARCHERS) / PACE
  /** Seconds into the day, by the visitor's clock. */
  const clock = (d = new Date()) => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000
  /** The parade now: whether it is marching, how far along, and when it next sets off. */
  function parade(d = new Date()) {
    const p = pathTo(o.daily())
    const sec = clock(d), into = sec % PARADE_EVERY
    const dur = p ? lasts(p) : 0
    const nextAt = new Date(d.getTime() + (PARADE_EVERY - into) * 1000)
    return { path: p, on: !!p && o.play && into < dur, t: into, dur, next: nextAt, to: o.daily() }
  }
  type Marcher = { x: number; y: number; dir: number; k: number; a: number; w: number }
  function marchers(now: number): Marcher[] {
    const pr = parade()
    if (!pr.on || !pr.path) return []
    const out: Marcher[] = []
    const lead = pr.t * PACE
    for (let k = 0; k < MARCHERS; k++) {
      const u = lead - k * GAP
      if (u < 0 || u > pr.path.total * 2) continue
      // Out of the square and back into it, fading.
      const a = Math.min(1, u / 10, (pr.path.total * 2 - u) / 10)
      const q = along(pr.path, u)
      out.push({ x: q.x, y: q.y, dir: q.dir, k, a, w: way(q.dx, q.dy) })
    }
    void now
    return out
  }
  const SHIRT = ['#ffffff', '', '#ff4f6e', '#4fe3c1', '#5b82ff', '#b8a1ff', '']
  // The cartoon island's marchers (folk.ts): each one's body as a picture, made once; the canvas marches their legs.
  const folkPics = (o.data.folk ?? []).map((fp) => {
    if (typeof Image === 'undefined') return null
    const im = new Image()
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fp.svg)
    return { im, legs: fp.legs, k: fp.k }
  })
  function drawMarcher(c: CanvasRenderingContext2D, m: Marcher, now: number): number {
    const { x, y, dir: f, k } = m
    c.globalAlpha = m.a
    // Unity's: each marcher in their stride, the way they are heading; the dog at a trot. What they carry is drawn over them.
    if (sp && sheet) {
      const stride = (now / 1000 / 0.5 + k * 0.37) % 1
      const ok = k === MARCHERS - 1 ? drawPic(c, sp.dog[m.w]?.[Math.floor(((now / 1000 / 0.36 + k * 0.2) % 1) * 4)], x, y) : drawPic(c, sp.marchers[k]?.[m.w]?.[Math.floor(stride * 8)], x, y, k === 4 || k === 5 ? 0.82 : 1)
      if (ok) {
        const top = y - 2
        c.lineCap = 'round'
        if (k === 1) {
          // The flag of today's game, on its pole.
          c.strokeStyle = '#c9cde0'; c.lineWidth = 0.9
          c.beginPath(); c.moveTo(x + f * 3, top - 8); c.lineTo(x + f * 3, top - 30); c.stroke()
          const wave = Math.sin(now / 240) * 1.6
          c.fillStyle = o.ink()
          c.beginPath(); c.moveTo(x + f * 3, top - 30); c.quadraticCurveTo(x + f * 9, top - 32 + wave, x + f * 15, top - 29); c.lineTo(x + f * 15, top - 21); c.quadraticCurveTo(x + f * 9, top - 24 + wave, x + f * 3, top - 22); c.closePath(); c.fill()
        }
        if (k === 4 || k === 5) {
          // A balloon on a string.
          const bx = x - f * 3 + Math.sin(now / 500 + k) * 1.5, byy = top - 26
          c.strokeStyle = '#eef0f7'; c.lineWidth = 0.4
          c.beginPath(); c.moveTo(x + f * 2, top - 7); c.lineTo(bx, byy + 4); c.stroke()
          c.fillStyle = k === 4 ? '#b8a1ff' : '#8ccbff'
          c.beginPath(); c.ellipse(bx, byy, 3.2, 4, 0, 0, Math.PI * 2); c.fill()
          c.fillStyle = '#ffffff'; c.globalAlpha = m.a * 0.6; c.beginPath(); c.arc(bx - 1, byy - 1.4, 0.8, 0, Math.PI * 2); c.fill(); c.globalAlpha = m.a
        }
        c.globalAlpha = 1
        return 2
      }
    }
    const step = Math.sin(now / 150 + k * 1.3)
    let n = 0
    c.lineCap = 'round'; c.lineJoin = 'round'
    // The dog at the back, trotting.
    if (k === MARCHERS - 1) {
      c.fillStyle = INK; c.globalAlpha = m.a * 0.14; c.beginPath(); c.ellipse(x, y + 0.3, 5, 1.6, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = m.a
      c.strokeStyle = INK; c.lineWidth = 1.4
      c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x - 3 + step, y - 3.5); c.moveTo(x + 3, y); c.lineTo(x + 3 - step, y - 3.5); c.stroke()
      c.fillStyle = '#efe2c8'; c.lineWidth = 0.9
      c.beginPath(); c.ellipse(x, y - 5, 4.6, 2.4, 0, 0, Math.PI * 2); c.fill(); c.stroke()
      c.beginPath(); c.arc(x + f * 4.6, y - 7.6, 2.2, 0, Math.PI * 2); c.fill(); c.stroke()
      c.beginPath(); c.moveTo(x - f * 4.4, y - 5.6); c.lineTo(x - f * 6.6, y - 8.6 + step); c.stroke()
      return 6
    }
    const bob = Math.abs(step) * 0.8
    c.fillStyle = INK; c.globalAlpha = m.a * 0.15
    c.beginPath(); c.ellipse(x - 2, y + 0.5, 5, 1.8, 0, 0, Math.PI * 2); c.fill(); n++
    c.globalAlpha = m.a
    // Someone of their own (folk.ts), once their picture is in.
    const fp = folkPics[k], pic = fp && fp.im.complete && fp.im.naturalWidth > 0 ? fp : null
    // Legs, marching.
    if (pic) {
      const q = pic.k
      c.strokeStyle = pic.legs; c.lineWidth = 2.5 * q
      c.beginPath(); c.moveTo(x - 1.7 * q, y - 0.6); c.lineTo(x - 1.7 * q + step * 1.4, y - 7.6 * q); c.moveTo(x + 1.7 * q, y - 0.6); c.lineTo(x + 1.7 * q - step * 1.4, y - 7.6 * q); c.stroke()
      c.fillStyle = '#2a2730'
      c.beginPath(); c.ellipse(x - 1.7 * q + 0.4, y - 0.2, 1.5, 0.85, 0, 0, Math.PI * 2); c.ellipse(x + 1.7 * q + 0.4, y - 0.2, 1.5, 0.85, 0, 0, Math.PI * 2); c.fill(); n += 2
    } else {
      c.strokeStyle = INK; c.lineWidth = 2
      c.beginPath(); c.moveTo(x - 1.8, y); c.lineTo(x - 1.8 + step * 1.4, y - 6); c.moveTo(x + 1.8, y); c.lineTo(x + 1.8 - step * 1.4, y - 6); c.stroke(); n++
    }
    const top = y - bob
    // The flag goes behind the one carrying it.
    if (k === 1) {
      c.strokeStyle = INK; c.lineWidth = 1.3
      c.beginPath(); c.moveTo(x + f * 3.5, top - 8); c.lineTo(x + f * 3.5, top - 34); c.stroke()
      const wave = Math.sin(now / 240) * 1.6
      c.fillStyle = o.ink(); c.lineWidth = 1
      c.beginPath(); c.moveTo(x + f * 3.5, top - 34); c.quadraticCurveTo(x + f * 10, top - 36 + wave, x + f * 17, top - 33); c.lineTo(x + f * 17, top - 24); c.quadraticCurveTo(x + f * 10, top - 27 + wave, x + f * 3.5, top - 25); c.closePath(); c.fill(); c.stroke()
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x + f * 10.3, top - 29.6 + wave * 0.5, 2, 0, Math.PI * 2); c.fill()
      n += 4
    }
    // A balloon on a string, for the two children.
    if (k === 4 || k === 5) {
      const bx = x - f * 3 + Math.sin(now / 500 + k) * 1.5, byy = top - 34
      c.strokeStyle = INK; c.lineWidth = 0.6
      c.beginPath(); c.moveTo(x + f * 2.5, top - 9); c.lineTo(bx, byy + 5); c.stroke()
      c.fillStyle = k === 4 ? '#b8a1ff' : '#8ccbff'; c.lineWidth = 1
      c.beginPath(); c.ellipse(bx, byy, 4, 5, 0, 0, Math.PI * 2); c.fill(); c.stroke()
      c.fillStyle = '#ffffff'; c.globalAlpha = m.a * 0.7; c.beginPath(); c.arc(bx - 1.3, byy - 1.8, 1, 0, Math.PI * 2); c.fill(); c.globalAlpha = m.a
      n += 3
    }
    // The body, and the head (a child is a little smaller).
    const small = k === 4 || k === 5 ? 0.82 : 1
    if (pic) { c.drawImage(pic.im, x - 12, top - 32, 24, 34); n++ }
    else {
      c.fillStyle = k === 1 ? o.ink() : SHIRT[k]; c.strokeStyle = INK; c.lineWidth = 1.2
      rr(c, x - 3.4 * small, top - 14 * small, 6.8 * small, 9 * small, 2.6 * small); c.fill(); c.stroke(); n++
      c.fillStyle = k % 2 ? '#e0b899' : '#f1d9c6'
      c.beginPath(); c.arc(x, top - 17.5 * small, 3.4 * small, 0, Math.PI * 2); c.fill(); c.stroke(); n++
    }
    // (Someone of their own stands a little taller: what sits on their head sits higher.)
    const lift = pic ? 4.6 : 0
    c.strokeStyle = INK; c.lineWidth = 1.2
    // What each carries: the drum major's tall hat and baton, a drum, a trumpet.
    if (k === 0) {
      c.fillStyle = '#5b82ff'; rr(c, x - 3, top - 26 - lift, 6, 6.6, 1.4); c.fill(); c.stroke()
      c.fillStyle = '#ff4f6e'; c.beginPath(); c.arc(x, top - 27 - lift, 1.4, 0, Math.PI * 2); c.fill()
      const sw = Math.sin(now / 260) * 0.9
      c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + f * 3, top - 11); c.lineTo(x + f * (5 + sw * 3), top - 21 + Math.abs(sw) * 3); c.stroke()
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x + f * (5 + sw * 3), top - 21 + Math.abs(sw) * 3, 1.5, 0, Math.PI * 2); c.fill(); c.stroke()
      n += 5
    } else if (k === 2) {
      c.fillStyle = '#ffffff'; c.lineWidth = 1
      c.beginPath(); c.ellipse(x + f * 1, top - 7.5, 4.6, 2, 0, 0, Math.PI * 2); c.rect(x + f * 1 - 4.6, top - 7.5, 9.2, 4.4); c.fill()
      c.beginPath(); c.ellipse(x + f * 1, top - 3.1, 4.6, 2, 0, 0, Math.PI); c.moveTo(x + f * 1 - 4.6, top - 7.5); c.lineTo(x + f * 1 - 4.6, top - 3.1); c.moveTo(x + f * 1 + 4.6, top - 7.5); c.lineTo(x + f * 1 + 4.6, top - 3.1); c.stroke()
      c.beginPath(); c.ellipse(x + f * 1, top - 7.5, 4.6, 2, 0, 0, Math.PI * 2); c.stroke()
      c.strokeStyle = '#ff4f6e'; c.beginPath(); c.moveTo(x + f * 1 - 4, top - 6.4); c.lineTo(x + f * 1 + 4, top - 3.6); c.stroke()
      n += 5
    } else if (k === 3) {
      c.strokeStyle = '#9fb5f2'; c.lineWidth = 1.6
      const m = pic ? 2.6 : 0
      c.beginPath(); c.moveTo(x + f * 2, top - 16 - m); c.lineTo(x + f * 8, top - 15 - m); c.stroke()
      c.fillStyle = '#d8eeff'; c.strokeStyle = INK; c.lineWidth = 0.8
      c.beginPath(); c.moveTo(x + f * 8, top - 15 - m); c.lineTo(x + f * 11, top - 18 - m); c.lineTo(x + f * 11, top - 12 - m); c.closePath(); c.fill(); c.stroke()
      n += 2
    }
    c.globalAlpha = 1
    return n
  }
  const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
  const marcherBox = (q: Marcher): Box => [q.x - 20, q.y - 44, q.x + 20, q.y + 3]
  function drawParade(c: CanvasRenderingContext2D, m: M, now: number, list: Marcher[], inWin?: (b: Box) => boolean): number {
    if (!list.length || scale < 0.55) return 0
    let n = 1
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
    // Back to front, so the one nearer stands in front.
    for (const q of [...list].sort((a, b) => a.y - b.y)) {
      const b = marcherBox(q)
      if (!visible(m, b)) continue
      if (inWin) { if (!inWin(b)) continue; c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]) }
      n += drawMarcher(c, q, now)
    }
    return n
  }

  /* ---- what the frame shows ---------------------------------------------------------- */
  let cw = 0, ch = 0
  /** Whether a box on the map is on the canvas at all. */
  const visible = (m: M, b: Box) => { const x0 = m[0] * b[0] + m[4], x1 = m[0] * b[2] + m[4], y0 = m[3] * b[1] + m[5], y1 = m[3] * b[3] + m[5]; return x1 > 0 && x0 < cw && y1 > 0 && y0 < ch }
  let frameMarchers: Marcher[] = []
  const live: LiveLayer = {
    after: {
      // The sea's rings, and the ball when it floats: under the shallows' edge and everything on land.
      sea: (c, m, t) => {
        cw = c.canvas.width; ch = c.canvas.height; scale = m[0]
        let n = 0
        const now = performance.now()
        if (rings.length) {
          c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); n++
          c.strokeStyle = '#ffffff'; c.lineWidth = 1.4
          for (let k = rings.length - 1; k >= 0; k--) {
            const r = rings[k], u = (now - r.at) / 1000 / r.life
            if (u >= 1) { rings.splice(k, 1); continue }
            const e = 1 - (1 - u) * (1 - u)
            c.globalAlpha = 0.8 * (1 - u)
            c.beginPath(); c.ellipse(r.x, r.y, (4 + e * 26) * r.size, (2 + e * 13) * r.size, 0, 0, Math.PI * 2); c.stroke(); n++
          }
          c.globalAlpha = 1
        }
        if (ball.wet) n += drawBall(c, m)
        void t
        return n
      },
      // On the ground, among the walkers: the ball on the sand, the pigeons, the parade.
      walkers: (c, m, t) => {
        const now = performance.now()
        const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0
        last = now
        if (o.play && dt > 0) { stepBall(dt); stepBirds(dt, now) }
        let n = 0
        if (!ball.wet) n += drawBall(c, m)
        n += drawBirdsOnGround(c, m, now)
        frameMarchers = marchers(now)
        // The parade passing the square puts the pigeons up.
        for (const q of frameMarchers) if (q.k === 0) scareNear(q.x, q.y, 34)
        n += drawParade(c, m, now, frameMarchers)
        void t
        return n
      },
    },
    top: (c, m) => drawBirdsFlying(c, m, performance.now()),
    front: (c, m, _t, inWin) => drawParade(c, m, performance.now(), frameMarchers, inWin),
  }

  return {
    live,
    /**
     * A hand on the map at (x, y): if it is on the ball, the ball is picked
     * up, and goes where the hand goes until it lets go, when it is thrown the
     * way the hand was moving. z is screen pixels to a map unit.
     */
    grab(x: number, y: number, z: number, touch: boolean) {
      const [bx, by] = ballXY()
      if (Math.hypot(x - bx, y - by) > R + (touch ? 16 : 7) / z) return null
      const trail: { x: number; y: number; t: number }[] = [{ x, y, t: performance.now() }]
      const sx = x, sy = y
      ball.held = o.play; ball.vh = 0
      return {
        move(nx: number, ny: number) {
          trail.push({ x: nx, y: ny, t: performance.now() }); if (trail.length > 8) trail.shift()
          if (!o.play) return
          // Carried, a little off the ground, over the sand or the water's edge only.
          const [i, j] = tile(nx, ny + 10 + R, ballZ())
          if (onSand(i, j) || (inSea(i, j) && Math.hypot(i - home[0], j - home[1]) < 3)) { ball.i = i; ball.j = j; ball.wet = false; ball.h = 10 }
        },
        up() {
          ball.held = false
          if (!o.play) return
          const now = performance.now()
          const old = trail.find((p) => now - p.t < 110) ?? trail[0], lastP = trail[trail.length - 1]
          const dt = Math.max(0.016, (lastP.t - old.t) / 1000)
          const moved = Math.hypot(lastP.x - sx, lastP.y - sy) * z
          let [vi, vj] = dTile((lastP.x - old.x) / dt, (lastP.y - old.y) / dt)
          if (moved < 5) {
            // A tap, not a throw: a kick, away from where it was touched.
            const a = Math.atan2(by - y, bx - x) + (Math.random() - 0.5)
            ;[vi, vj] = dTile(Math.cos(a) * 70, Math.sin(a) * 70)
          }
          const sp = Math.hypot(vi, vj), cap = 7
          if (sp > cap) { vi *= cap / sp; vj *= cap / sp }
          ball.vi = vi; ball.vj = vj
          ball.vh = 120 + Math.min(cap, sp) * 34
          if (ball.h === 0) ball.h = 0.01
          o.sound()?.thump?.(0.5)
        },
      }
    },
    /** The pointer is over the map at (x, y) (hovering, or pressing): pigeons near it go up; water touched ripples. */
    pointer(x: number, y: number, z: number, kind: 'hover' | 'down' | 'tap') {
      scareNear(x, y, kind === 'hover' ? 26 + 8 / z : 34 + 14 / z)
      const [i, j] = tile(x, y, SEA)
      if (!o.play || !inSea(i, j)) return
      if (kind === 'tap') splash(x, y, 0.9)
      else if (kind === 'down') ring(x, y, 0.7)
      else { const now = performance.now(); if (now - lastTrail > 110) { lastTrail = now; ring(x, y, 0.45, 1.2) } }
    },
    /** Whether the pointer is over the ball (for the cursor). */
    overBall(x: number, y: number, z: number) { const [bx, by] = ballXY(); return Math.hypot(x - bx, y - by) <= R + 6 / z },
    /** The bell on the hour: every pigeon goes up. */
    bells() { scareNear(0, 0, 0, true) },
    parade,
    /** Where the parade's leader is now, or the square if it is not marching. */
    paradeAt(): [number, number] { const l = frameMarchers.find((q) => q.k === 0) ?? frameMarchers[0]; return l ? [l.x, l.y] : at(sqI, sqJ) },
    square: () => at(sqI, sqJ),
    ballAt: () => ballXY(),
  }
}
export type Play = ReturnType<typeof createPlay>

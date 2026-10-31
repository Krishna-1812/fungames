/**
 * Tiny Island — the sun on the water.
 *
 * Light glittering on the open sea, live, in both worlds: a scatter of short
 * flat flecks of light, drawn once into a tile and laid over the sea as a
 * repeating pattern, three times over at three sizes, each drifting its own
 * way with the wind and coming and going in turn, so the flecks seem to catch
 * the sun and lose it. Clipped to the open sea (world.ts, openSea), so none
 * of it falls on the land, the foam, the rocks or the piers; what stands in
 * the water (boats) is painted after it.
 *
 * A handful of canvas calls a frame, whatever the zoom. By day only: softer
 * and warmer at dawn and dusk, none by moonlight (the moon has its own path).
 * With reduced motion, one still moment of it.
 */
import type { M } from './scene'

/** The tile of flecks: this many map units square (before it is laid flat), drawn this many pixels to a unit. */
const TILE = 420, RES = 2, FLECKS = 300
/** The three sets: their size, drift (map units a second) and when in the cycle each is brightest. */
const SETS: { k: number; vx: number; vy: number; ph: number }[] = [
  { k: 1, vx: 5.2, vy: 1.4, ph: 0 },
  { k: 1.37, vx: -3.6, vy: 2.3, ph: 1 / 3 },
  { k: 0.81, vx: 2.4, vy: -2.8, ph: 2 / 3 },
]
/** Seconds for one set to come and go. */
const PERIOD = 2.8

/** A tile of flecks of light in a colour, seamless, for createPattern. */
function tile(rgb: string): HTMLCanvasElement {
  const N = TILE * RES, cv = document.createElement('canvas')
  cv.width = cv.height = N
  const g = cv.getContext('2d')!
  let seed = 41
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // Light on water comes in patches where the swell faces the sun, not evenly: most flecks gather round a few spots.
  const spots = Array.from({ length: 15 }, () => [rnd() * N, rnd() * N])
  const near = () => (rnd() + rnd() + rnd() - 1.5) * N * 0.055
  for (let n = 0; n < FLECKS; n++) {
    const s = spots[n % spots.length], gathered = rnd() < 0.8
    const x = ((gathered ? s[0] + near() : rnd() * N) % N + N) % N
    const y = ((gathered ? s[1] + near() : rnd() * N) % N + N) % N
    const big = rnd()
    // Mostly small, now and then a long one; laid flat later (squashed by half), so drawn twice as tall.
    const L = (1.4 + big * big * 6) * RES, w = (1.6 + rnd() * 1.2) * RES, a = 0.4 + rnd() * 0.55
    for (const [ox, oy] of [[0, 0], [-N, 0], [N, 0], [0, -N], [0, N]]) {
      const cx = x + ox, cy = y + oy
      if (cx < -L * 2 || cx > N + L * 2 || cy < -w * 2 || cy > N + w * 2) continue
      // Soft at the edge: a halo, then the fleck, then a hot core.
      for (const [s, op] of [[1.9, 0.18], [1.25, 0.45], [0.7, 1]]) {
        g.fillStyle = `rgba(${rgb}, ${a * op})`
        g.beginPath(); g.ellipse(cx, cy, L * s / 2, w * s / 2, 0, 0, Math.PI * 2); g.fill()
      }
      // The brightest catch the sun full: a little star of light across them.
      if (big > 0.92) {
        g.fillStyle = `rgba(${rgb}, ${a * 0.8})`
        g.beginPath(); g.ellipse(cx, cy, L * 1.6, w * 0.22, 0, 0, Math.PI * 2); g.fill()
        g.beginPath(); g.ellipse(cx, cy, w * 0.3, L * 0.9, 0, 0, Math.PI * 2); g.fill()
      }
    }
  }
  return cv
}

/**
 * The sparkle, for play.ts to draw just after the sea. openSea is in tiles
 * (world.ts); `play` false draws one still moment.
 */
export function sunOnWater(openSea: string, play: boolean) {
  let clip: Path2D | null = null
  let pats: { day: CanvasPattern; warm: CanvasPattern } | null = null
  /** How much sparkle there is now, eased toward what the time of day wants. */
  let glow = -1, warmth = 0, last = 0
  return (c: CanvasRenderingContext2D, m: M, now: number, dark: number): number => {
    const want = Math.max(0, 1 - dark * 1.15), wantWarm = dark > 0.1 && dark < 0.9 ? 1 : 0
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1
    last = now
    if (glow < 0 || !play) { glow = want; warmth = wantWarm }
    else { const e = 1 - Math.exp(-dt / 0.6); glow += (want - glow) * e; warmth += (wantWarm - warmth) * e }
    if (glow < 0.01) return 0
    if (!clip) clip = new Path2D(openSea)
    if (!pats) {
      const day = c.createPattern(tile('255, 255, 255'), 'repeat'), warm = c.createPattern(tile('255, 232, 200'), 'repeat')
      if (!day || !warm) return 0
      pats = { day, warm }
    }
    const t = play ? now / 1000 : 0
    const [a, , , d, e, f] = m
    const W = c.canvas.width, H = c.canvas.height
    let n = 0
    c.save()
    // The open sea, in tiles: P(i, j, SEA) is (32 (i - j), 16 (i + j) + 12).
    c.setTransform(a * 32, d * 16, -a * 32, d * 16, e, d * 12 + f)
    c.clip(clip, 'evenodd')
    c.globalCompositeOperation = 'lighter'
    // The flecks are soft already: the cheap filter does, across the whole screen.
    c.imageSmoothingQuality = 'low'
    n += 3
    for (const [pat, w] of [[pats.day, 1 - warmth], [pats.warm, warmth]] as [CanvasPattern, number][]) {
      if (w < 0.01) continue
      c.fillStyle = pat
      for (const s of SETS) {
        // Each set swells and goes, brightest a third of the cycle after the one before.
        const u = t / PERIOD + s.ph, pulse = Math.max(0, Math.sin(u * Math.PI * 2))
        const alpha = glow * w * (0.1 + 0.9 * pulse * pulse) * 0.75
        if (alpha < 0.01) continue
        // Laid flat on the water (squashed by half), drifting; the drift kept within one tile.
        const k = s.k / RES, span = TILE * s.k
        const dx = (((s.vx * t) % span) + span) % span, dy = (((s.vy * t) % (span / 2)) + span / 2) % (span / 2)
        const A = a * k, D = d * k * 0.5, E = e + a * dx, F = f + d * dy
        c.setTransform(A, 0, 0, D, E, F)
        c.globalAlpha = alpha
        // The whole canvas, in the pattern's own pixels.
        c.fillRect(-E / A, -F / D, W / A, H / D)
        n += 2
      }
    }
    c.restore()
    return n + 1
  }
}

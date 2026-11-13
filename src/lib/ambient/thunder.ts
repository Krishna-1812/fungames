/**
 * Thunder, from the lightning.
 *
 * Thunder is not one bang. A lightning channel heats the air along its whole
 * length to 30,000 kelvin in microseconds, and every metre of it sends out
 * its own shock — a single sharp pressure wave, a compression then a
 * rarefaction (an "N-wave"). The channel is kilometres long and tortuous, so
 * those shocks arrive from all along it, each after its own travel time: the
 * nearest bit first, as the crack, then the rest of the channel rolling in
 * for seconds after. The roll *is* the shape of the bolt, heard.
 *
 * So each strike here grows a channel: a jagged walk down from a cloud base
 * two to four kilometres up to a point on the ground, with branches off it,
 * and often a long run along the cloud base first. Every segment's N-wave is
 * laid down at the time it would arrive (distance ÷ 343 m/s), weaker with
 * distance, and wider — the air rounds a shock off as it travels, and
 * absorbs high frequencies on the way, which is why far thunder is a low
 * grumble and near thunder cracks. Each one comes from the direction its
 * segment is in, so a long bolt rolls across the sky.
 *
 * The flash is reported the moment the strike happens and the sound arrives
 * when it would — about three seconds for every kilometre — so the picture
 * flashes first and the rumble follows, the gap telling you how far away it
 * was. Fainter, more distant storms grumble now and then in between.
 *
 * Laying down a few hundred pulses takes a moment, so it is spread across the
 * gap between flash and sound, which is always seconds long.
 */
import { type Source, type SourceCtx } from './dsp'

export const SOUND_SPEED = 343
const RATE_DIV = 2
const MAX_SECONDS = 12
const SEG_STRIDE = 5

type Bolt = {
  state: 0 | 1 | 2 | 3 // free, laying down pulses, filtering, playing
  L: Float32Array
  R: Float32Array
  len: number
  segs: Float32Array
  nseg: number
  done: number
  fpos: number
  start: number
  rmin: number
  D: number
  far: boolean
  gain: number
  peak: number
  lp1: number; lp2: number; lp3: number; lp4: number
  hx1: number; hy1: number; hx2: number; hy2: number
  a: number
}

/** How far a lightning strike is, from the gap between flash and thunder. */
export const kmFromDelay = (seconds: number) => (seconds * SOUND_SPEED) / 1000

export function thunder(c: SourceCtx): Source {
  const { sr, rng } = c
  const sr2 = sr / RATE_DIV
  const cap = Math.floor(MAX_SECONDS * sr2)
  const bolts: Bolt[] = []
  const slot = (): Bolt | null => {
    let b = bolts.find((x) => x.state === 0)
    if (!b && bolts.length < 3) {
      b = {
        state: 0, L: new Float32Array(cap), R: new Float32Array(cap), len: 0,
        segs: new Float32Array(1600 * SEG_STRIDE), nseg: 0, done: 0, fpos: 0, start: 0, rmin: 0,
        D: 0, far: false, gain: 1, peak: 0, lp1: 0, lp2: 0, lp3: 0, lp4: 0, hx1: 0, hy1: 0, hx2: 0, hy2: 0, a: 1,
      }
      bolts.push(b)
    }
    return b ?? null
  }

  let started = false
  let untilNear = rng.range(1.5, 4)
  let untilFar = rng.range(10, 20)
  let lastFlash = -1

  /** Walk from (x,y,z) towards (tx,ty,tz), tortuously, adding segments. */
  function walk(b: Bolt, x: number, y: number, z: number, tx: number, ty: number, tz: number, amp: number, stepLo: number, stepHi: number, branches: boolean) {
    let ux = 0, uy = 0, uz = -1
    for (let guard = 0; guard < 1200 && b.nseg < 1600; guard++) {
      let dx = tx - x, dy = ty - y, dz = tz - z
      const dist = Math.hypot(dx, dy, dz)
      if (dist < stepHi || z <= 0) break
      dx /= dist; dy /= dist; dz /= dist
      const rx = rng.gauss(), ry = rng.gauss(), rz = rng.gauss()
      const rl = Math.hypot(rx, ry, rz) || 1
      ux = ux * 0.35 + dx * 0.45 + (rx / rl) * 0.6
      uy = uy * 0.35 + dy * 0.45 + (ry / rl) * 0.6
      uz = uz * 0.35 + dz * 0.45 + (rz / rl) * 0.6
      const ul = Math.hypot(ux, uy, uz) || 1
      ux /= ul; uy /= ul; uz /= ul
      const step = rng.range(stepLo, stepHi)
      const nx = x + ux * step, ny = y + uy * step, nz = Math.max(0, z + uz * step)
      const o = b.nseg++ * SEG_STRIDE
      b.segs[o] = (x + nx) / 2
      b.segs[o + 1] = (y + ny) / 2
      b.segs[o + 2] = (z + nz) / 2
      b.segs[o + 3] = step
      b.segs[o + 4] = amp
      x = nx; y = ny; z = nz
      if (branches && rng.chance(0.008)) {
        const len = rng.range(300, 1400)
        const h = rng.range(0, Math.PI * 2)
        walk(b, x, y, z, x + Math.cos(h) * len * 0.7, y + Math.sin(h) * len * 0.7, Math.max(0, z - len * 0.7), amp * 0.4, 9, 30, false)
      }
    }
  }

  function strike(D: number, az: number, far: boolean, flashAt: number, soundAt?: number) {
    const b = slot()
    if (!b) return
    b.nseg = 0
    b.D = D
    b.far = far
    const gx = D * 1000 * Math.sin(az), gy = D * 1000 * Math.cos(az)
    const H = rng.range(2200, 4200)
    let x = gx + rng.bi() * 700, y = gy + rng.bi() * 700
    // Most strikes run for kilometres through the cloud before they come
    // down, and those runs, spread out in range, are what make a long roll.
    const runs = rng.chance(0.85) ? 1 + (rng.chance(0.4) ? 1 : 0) : 0
    for (let k = 0; k < runs; k++) {
      const h = rng.range(0, Math.PI * 2), len = rng.range(2000, 7000)
      const sx = x + Math.cos(h) * len, sy = y + Math.sin(h) * len
      walk(b, sx, sy, H + rng.range(0, 500), x, y, H, 0.7, 30, 70, false)
    }
    walk(b, x, y, H, gx, gy, 0, 1, 9, 30, true)
    let rmin = Infinity
    for (let i = 0; i < b.nseg; i++) {
      const o = i * SEG_STRIDE
      rmin = Math.min(rmin, Math.hypot(b.segs[o], b.segs[o + 1], b.segs[o + 2]))
    }
    b.rmin = rmin
    b.L.fill(0)
    b.R.fill(0)
    b.len = 0
    b.done = 0
    b.fpos = 0
    b.peak = 0
    b.lp1 = b.lp2 = b.lp3 = b.lp4 = b.hx1 = b.hy1 = b.hx2 = b.hy2 = 0
    // Absorption: the further, the duller.
    const fc = Math.min(3200, 2600 / Math.pow(Math.max(0.6, D), 0.75))
    b.a = 1 - Math.exp((-2 * Math.PI * fc) / sr2)
    b.gain = far ? rng.range(0.12, 0.2) : Math.min(1, Math.max(0.2, 0.95 * Math.sqrt(1.8 / D)))
    // A first rumble that is already on its way arrives sooner than the
    // distance alone would say.
    b.start = (soundAt ?? flashAt + rmin / SOUND_SPEED) - 0.04
    b.state = 1
    if (!soundAt) {
      lastFlash = flashAt
      c.emit('flash', flashAt, { km: D, az, far: far ? 1 : 0, gain: b.gain, delay: b.start + 0.04 - flashAt })
    }
  }

  /** Lay down some of a bolt's N-waves into its buffer. */
  function layDown(b: Bolt, budget: number) {
    const tStart = b.rmin / SOUND_SPEED - 0.04
    const end = Math.min(b.nseg, b.done + budget)
    for (let i = b.done; i < end; i++) {
      const o = i * SEG_STRIDE
      const x = b.segs[o], y = b.segs[o + 1], z = b.segs[o + 2]
      const r = Math.hypot(x, y, z)
      const at = Math.floor((r / SOUND_SPEED - tStart) * sr2)
      // A shock starts a millisecond or two wide and the air widens it as it goes.
      const tau = 0.0016 + 0.0026 * (r / 1000)
      const w = Math.max(4, Math.floor(tau * sr2))
      if (at < 0 || at + w >= cap) continue
      const A = (b.segs[o + 4] * Math.sqrt(b.segs[o + 3]) * 40) / r
      const h = Math.hypot(x, y) || 1
      const p = Math.max(-1, Math.min(1, x / h))
      const gl = Math.cos(((p + 1) * Math.PI) / 4) * A, gr = Math.sin(((p + 1) * Math.PI) / 4) * A
      // An N-wave: a sudden rise, a straight fall through zero, a sudden
      // return. The two sudden edges are the crack.
      for (let k = 0; k < w; k++) {
        const s = 1 - (2 * k) / w
        b.L[at + k] += s * gl
        b.R[at + k] += s * gr
      }
      if (at + w > b.len) b.len = at + w
    }
    b.done = end
    if (b.done >= b.nseg) {
      // Room for the echoes off the land to die away.
      b.len = Math.min(cap, b.len + Math.floor(sr2 * 3.5))
      b.state = 2
    }
  }

  /** Low-pass by distance and take out any DC, in chunks. */
  function filter(b: Bolt, chunk: number) {
    const end = Math.min(b.len, b.fpos + chunk)
    // Two poles of low-pass, then a DC blocker (y = x - x1 + R y1, about 20 Hz),
    // then the echoes: thunder comes back off hills and cloud for seconds, so
    // each side is fed a little of both sides' past at three long delays.
    const a = b.a, k = 1 - (2 * Math.PI * 20) / sr2
    const d1 = Math.round(0.137 * sr2), d2 = Math.round(0.211 * sr2), d3 = Math.round(0.293 * sr2)
    for (let i = b.fpos; i < end; i++) {
      b.lp1 += a * (b.L[i] - b.lp1)
      b.lp2 += a * (b.lp1 - b.lp2)
      b.lp3 += a * (b.R[i] - b.lp3)
      b.lp4 += a * (b.lp3 - b.lp4)
      const yl = b.lp2 - b.hx1 + k * b.hy1
      const yr = b.lp4 - b.hx2 + k * b.hy2
      b.hx1 = b.lp2; b.hy1 = yl
      b.hx2 = b.lp4; b.hy2 = yr
      let el = yl, er = yr
      if (i >= d3) {
        el += 0.26 * b.L[i - d1] + 0.26 * b.R[i - d2] + 0.18 * b.L[i - d3]
        er += 0.26 * b.R[i - d1] + 0.26 * b.L[i - d2] + 0.18 * b.R[i - d3]
      }
      b.L[i] = el
      b.R[i] = er
      const m = Math.max(Math.abs(el), Math.abs(er))
      if (m > b.peak) b.peak = m
    }
    b.fpos = end
    if (b.fpos >= b.len) {
      b.gain = b.gain / Math.max(1e-6, b.peak)
      b.state = 3
    }
  }

  return {
    render(L, R, n, t) {
      const dt = n / sr
      if (!started) {
        started = true
        // Arrive mid-storm: a distant rumble is already rolling in.
        strike(rng.range(7, 10), rng.bi() * 1.1, true, t, t + 0.25)
      }
      if ((untilNear -= dt) <= 0) {
        const D = 1.1 + 6.5 * Math.pow(rng.next(), 1.5)
        strike(D, rng.bi() * 1.15, false, t)
        untilNear = rng.exp(20) + 9
      }
      if ((untilFar -= dt) <= 0) {
        strike(rng.range(9, 15), rng.bi() * 1.3, true, t)
        untilFar = rng.exp(16) + 7
      }
      for (const b of bolts) {
        if (b.state === 1) layDown(b, 48)
        else if (b.state === 2) filter(b, 12000)
      }
      L.fill(0, 0, n)
      R.fill(0, 0, n)
      for (const b of bolts) {
        if (b.state !== 3) continue
        for (let i = 0; i < n; i++) {
          const pos = (t + i / sr - b.start) * sr2
          if (pos < 0) continue
          const j = Math.floor(pos)
          if (j + 1 >= b.len) { b.state = 0; break }
          const u = pos - j
          L[i] += (b.L[j] + (b.L[j + 1] - b.L[j]) * u) * b.gain
          R[i] += (b.R[j] + (b.R[j + 1] - b.R[j]) * u) * b.gain
        }
      }
    },
    state: () => ({ flash: lastFlash }),
  }
}

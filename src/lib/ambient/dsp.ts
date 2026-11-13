/**
 * The parts every Ambient Mix layer is built from.
 *
 * Each layer is a small physical model of the thing it is named after — a
 * raindrop is a bubble that rings and rises in pitch, a passing car is a
 * moving source with spreading, air absorption and Doppler — and these are the
 * pieces those models share: a fast deterministic random generator, the three
 * colours of noise, a state-variable filter that can be swept without
 * blowing up, and a pool of short ringing voices for anything that clicks,
 * pings or bubbles.
 *
 * Everything here runs per sample inside an AudioWorklet, so it is written for
 * that: plain numeric fields, no allocation after construction, and nothing
 * that would make V8 deoptimise a hot loop. Control values (filter cutoffs,
 * envelopes, positions) are updated once every CR samples, not every sample.
 */

export const TAU = Math.PI * 2
/** Control rate: parameters move once every this many samples. */
export const CR = 32

/** xorshift32. Fast, deterministic from its seed, and plenty for noise. */
export class Rng {
  s: number
  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x9e3779b9
  }
  /** 0..1 */
  next(): number {
    let x = this.s | 0
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.s = x >>> 0
    return this.s / 4294967296
  }
  /** -1..1 */
  bi(): number {
    return this.next() * 2 - 1
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }
  int(n: number): number {
    return Math.floor(this.next() * n)
  }
  chance(p: number): boolean {
    return this.next() < p
  }
  /** Roughly normal, mean 0, sd 1. */
  gauss(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508
  }
  /** An exponential wait with mean m: the gap between events in a Poisson process. */
  exp(m: number): number {
    return -Math.log(1 - this.next() * 0.999999) * m
  }
  pick<T>(a: readonly T[]): T {
    return a[this.int(a.length)]
  }
}

/** Pink noise: equal energy per octave. Paul Kellet's refined filter. */
export class Pink {
  b0 = 0; b1 = 0; b2 = 0; b3 = 0; b4 = 0; b5 = 0; b6 = 0
  next(w: number): number {
    this.b0 = 0.99886 * this.b0 + w * 0.0555179
    this.b1 = 0.99332 * this.b1 + w * 0.0750759
    this.b2 = 0.969 * this.b2 + w * 0.153852
    this.b3 = 0.8665 * this.b3 + w * 0.3104856
    this.b4 = 0.55 * this.b4 + w * 0.5329522
    this.b5 = -0.7616 * this.b5 - w * 0.016898
    const out = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + w * 0.5362
    this.b6 = w * 0.115926
    return out * 0.11
  }
}

/** Brown noise: a leaky random walk, most of its energy in the bass. */
export class Brown {
  y = 0
  next(w: number): number {
    this.y = (this.y + 0.02 * w) / 1.02
    return this.y * 3.5
  }
}

/** One pole: a gentle 6 dB/octave slope. Cheap enough to use everywhere. */
export class OnePole {
  y = 0
  a = 1
  set(fc: number, sr: number): this {
    this.a = 1 - Math.exp((-TAU * Math.max(1, fc)) / sr)
    return this
  }
  lp(x: number): number {
    return (this.y += this.a * (x - this.y))
  }
  hp(x: number): number {
    return x - this.lp(x)
  }
}

/**
 * A state-variable filter (Andrew Simper's trapezoidal form). Low, band and
 * high pass from one structure, and — the reason it is used here instead of a
 * biquad — it stays stable when its cutoff is swept quickly, which a wave
 * opening up or a gust rising does constantly.
 *
 * `bp * k` is the band pass normalised to unity gain at the centre.
 */
export class Svf {
  ic1 = 0; ic2 = 0
  a1 = 1; a2 = 0; a3 = 0; k = 1
  lp = 0; bp = 0; hp = 0
  set(fc: number, q: number, sr: number): this {
    const g = Math.tan((Math.PI * Math.min(Math.max(fc, 5), sr * 0.45)) / sr)
    this.k = 1 / q
    this.a1 = 1 / (1 + g * (g + this.k))
    this.a2 = g * this.a1
    this.a3 = g * this.a2
    return this
  }
  run(x: number): number {
    const v3 = x - this.ic2
    const v1 = this.a1 * this.ic1 + this.a2 * v3
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3
    this.ic1 = 2 * v1 - this.ic1
    this.ic2 = 2 * v2 - this.ic2
    this.lp = v2
    this.bp = v1
    this.hp = x - this.k * v1 - v2
    return v2
  }
  /** Band pass, unity at the centre. */
  band(x: number): number {
    this.run(x)
    return this.bp * this.k
  }
}

/**
 * A value that wanders: it picks a new target at random intervals and glides
 * towards it. Real modulation — the swell of rain, the breathing of a fire —
 * is never a sine wave, and a sine LFO is the quickest way to make synthesis
 * sound synthetic. Stepped at control rate.
 */
export class Drift {
  v: number
  target: number
  lo: number
  hi: number
  hold: number
  a: number
  left = 0
  rng: Rng
  constructor(rng: Rng, lo: number, hi: number, holdSeconds: number, smoothSeconds: number, sr: number) {
    this.rng = rng
    this.lo = lo
    this.hi = hi
    this.hold = holdSeconds * (sr / CR)
    this.a = 1 - Math.exp(-1 / Math.max(1e-3, smoothSeconds * (sr / CR)))
    this.v = this.target = rng.range(lo, hi)
  }
  step(): number {
    if (--this.left <= 0) {
      this.target = this.rng.range(this.lo, this.hi)
      this.left = Math.max(1, this.rng.exp(this.hold))
    }
    return (this.v += this.a * (this.target - this.v))
  }
}

/** Equal-power pan. p is -1 (left) to 1 (right); returns the left gain. */
export const panL = (p: number) => Math.cos(((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4)
export const panR = (p: number) => Math.sin(((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4)

/**
 * A pool of short ringing voices: a decaying sine, optionally sweeping in
 * pitch and optionally mixed with noise. This one shape covers a surprising
 * amount of the world: a raindrop on a puddle (a bubble ringing as it rises,
 * so its pitch climbs), a tick on a leaf, a crackle in a fire, the partials of
 * a cup set down on a saucer, the escapement of a clock.
 *
 * Struct-of-arrays, fixed size; a voice that has died is swapped out with the
 * last one, so the loop only ever touches live voices.
 */
export class Pings {
  n = 0
  readonly max: number
  ph: Float64Array
  w: Float64Array
  dw: Float64Array
  amp: Float32Array
  dec: Float32Array
  gl: Float32Array
  gr: Float32Array
  nz: Float32Array
  wait: Int32Array
  l = 0
  r = 0
  constructor(max: number) {
    this.max = max
    this.ph = new Float64Array(max)
    this.w = new Float64Array(max)
    this.dw = new Float64Array(max)
    this.amp = new Float32Array(max)
    this.dec = new Float32Array(max)
    this.gl = new Float32Array(max)
    this.gr = new Float32Array(max)
    this.nz = new Float32Array(max)
    this.wait = new Int32Array(max)
  }
  /**
   * @param f      starting frequency, Hz
   * @param amp    peak amplitude
   * @param tau    decay time constant, seconds
   * @param rise   pitch rise per second, as a fraction of f (0.2 = +20%/s)
   * @param pan    -1..1
   * @param noise  0 = pure tone, 1 = pure noise
   * @param delay  seconds before it starts
   */
  add(sr: number, f: number, amp: number, tau: number, rise: number, pan: number, noise: number, delay = 0): void {
    if (this.n >= this.max) return
    const i = this.n++
    this.ph[i] = 0
    this.w[i] = (TAU * f) / sr
    this.dw[i] = (TAU * f * rise) / (sr * sr)
    this.amp[i] = amp
    this.dec[i] = Math.exp(-1 / (Math.max(1e-4, tau) * sr))
    this.gl[i] = panL(pan)
    this.gr[i] = panR(pan)
    this.nz[i] = noise
    this.wait[i] = Math.round(delay * sr)
  }
  /** Advance every voice one sample; the result is left in `l` and `r`. */
  tick(rng: Rng): void {
    let l = 0
    let r = 0
    for (let i = 0; i < this.n; i++) {
      if (this.wait[i] > 0) {
        this.wait[i]--
        continue
      }
      const nz = this.nz[i]
      const s = nz === 0 ? Math.sin(this.ph[i]) : Math.sin(this.ph[i]) * (1 - nz) + rng.bi() * nz
      const v = s * this.amp[i]
      l += v * this.gl[i]
      r += v * this.gr[i]
      this.ph[i] += this.w[i]
      this.w[i] += this.dw[i]
      this.amp[i] *= this.dec[i]
      if (this.amp[i] < 1e-4) {
        const j = --this.n
        this.ph[i] = this.ph[j]; this.w[i] = this.w[j]; this.dw[i] = this.dw[j]
        this.amp[i] = this.amp[j]; this.dec[i] = this.dec[j]
        this.gl[i] = this.gl[j]; this.gr[i] = this.gr[j]
        this.nz[i] = this.nz[j]; this.wait[i] = this.wait[j]
        i--
      }
    }
    this.l = l
    this.r = r
  }
}

/** Naive-free sawtooth: PolyBLEP smooths the jump so it does not alias. */
export function polyblep(t: number, dt: number): number {
  if (t < dt) {
    t /= dt
    return t + t - t * t - 1
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt
    return t * t + t + t + 1
  }
  return 0
}

export class Saw {
  t = 0
  next(f: number, sr: number): number {
    const dt = f / sr
    let v = 2 * this.t - 1
    v -= polyblep(this.t, dt)
    this.t += dt
    if (this.t >= 1) this.t -= 1
    return v
  }
}

/* -------------------------------------------------------------------------- */
/* What a layer is                                                             */
/* -------------------------------------------------------------------------- */

/** Something a layer tells the picture: a wave breaking, a flash, a car. */
export type AmbientEvent = { id: string; kind: string; at: number } & Record<string, number | string>

export type SourceCtx = {
  sr: number
  rng: Rng
  /** Report an event; `at` is in the same seconds as render's `t`. */
  emit: (kind: string, at: number, data?: Record<string, number>) => void
  /**
   * Seconds to add to render's `t` to get local wall-clock time, as seconds
   * since the epoch in the visitor's own time zone. The clock ticks on the
   * real second and strikes the real hour with it. Read every block, because
   * the page sets it once the audio clock is running.
   */
  wall: () => number
}

export interface Source {
  /** Overwrite L and R with the next n frames. `t` is the first frame's time in seconds. */
  render(L: Float32Array, R: Float32Array, n: number, t: number): void
  /** Slow-moving values the picture follows (wind speed, a fire's flicker). */
  state?(): Record<string, number>
}

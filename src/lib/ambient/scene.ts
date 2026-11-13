/**
 * What the picture knows, and how it learns it.
 *
 * The scene (scene-frag.ts) is a pure function of a few dozen numbers. This
 * keeps those numbers: each layer's level, eased so things fade in and out
 * rather than pop; the time of day the mix implies; and the moving parts the
 * sound engine reports — a wave's break, a car's position, a bolt's bearing,
 * a bird's song — each turned from the engine's timestamps into "where is it
 * now", against the audio clock as it reaches the ears.
 *
 * Light is instant and sound is not, so this is honest physics as well as
 * tidy code: a lightning flash is drawn the moment it happens and its thunder
 * arrives seconds later, and a car is drawn where it is while it is heard
 * from where it was.
 */
import { ShaderSurface } from '../gl'
import { LAWN } from './mower'
import { SCENE_FRAG } from './scene-frag'

type Ev = { id: string; kind: string; at: number } & Record<string, number | string>

/** Where each layer pulls the time of day: 0 night, 0.35 dusk, 1 day. */
const TOD: Record<string, number> = {
  rain: 0.55, waves: 0.78, wind: 0.62, fire: 0.04, cafe: 0.3, birds: 0.92,
  crickets: 0.03, traffic: 0.3, clock: 0.12, thunder: 0.42, mower: 1, dial: 0.1,
}
const REST_TOD = 0.3

/** Metres along the road to world x: the point in front of you is the middle. */
const roadX = (m: number) => 1.2 + m * 0.0009
/** The mower's lawn, in the model's metres, to world coordinates. */
const lawnX = (m: number) => 1.2 + (m + LAWN.x) * 0.025
const lawnY = (m: number) => 0.287 + (m - 14) * 0.0025
/** A strike's bearing (radians, 0 ahead) to where its bolt stands. */
const boltX = (az: number) => 1.2 + az * 0.8

const SCREEN: Record<number, number> = { 0: 0.25, 1: 0.35, 2: 0.4, 3: 0.35, 4: 0.3, 5: 0.6, 6: 0.65, 7: 0.7, 8: 0.85, 9: 0.85, 10: 0.75 }

export class Scene {
  readonly surface: ShaderSurface | null
  private readonly reduced: boolean
  private readonly now: () => number
  private level: Record<string, number> = {}
  private target: Record<string, number> = {}
  private tod = REST_TOD
  private cloud = 0.1
  private wet = 0
  private waves: { crash: number; build: number; wash: number; peak: number; peel: number }[] = []
  private cars: { x0: number; v: number; at: number; lane: number; truck: number }[] = []
  private flash: { at: number; x: number; seed: number; far: number; gain: number } | null = null
  private songs = [0, 0, 0, 0]
  private last = performance.now()
  private mowerDir = 1
  private mowerX = 0
  state: Record<string, Record<string, number>> = {}

  private readonly waveU = new Float32Array(16)
  private readonly peelU = new Float32Array(4)
  private readonly carU = new Float32Array(48)
  private readonly birdU = new Float32Array(4)

  constructor(host: HTMLElement, now: () => number, reduced: boolean) {
    this.reduced = reduced
    this.now = now
    this.surface = (() => {
      try {
        // About a million pixels at most (less on a phone, whose GPU is
        // smaller): on a dense screen the picture is drawn a little under
        // its full resolution, where nobody can tell. Measured on a laptop's
        // integrated GPU, a full frame with all twelve layers is 7–12 ms.
        const r = host.getBoundingClientRect()
        const dpr = Math.min(devicePixelRatio || 1, 2)
        const px = Math.max(1, r.width * r.height * dpr * dpr)
        const budget = matchMedia('(pointer: coarse)').matches ? 0.7e6 : 1.1e6
        const scale = Math.min(1, Math.sqrt(budget / px))
        return new ShaderSurface(host, SCENE_FRAG, { scale, uniforms: () => this.uniforms() })
      } catch { return null }
    })()
  }

  /** A layer's loudness, 0..1 (its knob, if it is on). */
  setLevel(id: string, v: number) {
    this.target[id] = v
  }

  /** Something the sound engine reported. */
  event(e: Ev) {
    const n = (k: string) => Number(e[k])
    if (e.kind === 'wave') {
      this.waves.push({ crash: e.at, build: n('build'), wash: n('wash'), peak: n('peak'), peel: Math.sign(n('p1') - n('p0')) })
      if (this.waves.length > 4) this.waves.shift()
    } else if (e.kind === 'car') {
      this.cars.push({ x0: n('x0'), v: n('v'), at: e.at, lane: n('lane'), truck: n('truck') })
      if (this.cars.length > 40) this.cars.shift()
    } else if (e.kind === 'flash') {
      this.flash = { at: e.at, x: boltX(n('az')), seed: Math.random() * 100, far: n('far'), gain: n('gain') }
    } else if (e.kind === 'song') {
      const b = n('bird')
      if (b >= 0 && b < 4) this.songs[b] = e.at + n('dur')
    }
  }

  /** Redraw now (reduced motion has no ticker of its own). */
  redraw() {
    this.surface?.redraw()
  }

  private uniforms() {
    const wallNow = performance.now()
    // Under reduced motion frames are far apart; fades still take their time.
    const dt = Math.min(this.reduced ? 1 : 0.2, (wallNow - this.last) / 1000)
    this.last = wallNow
    const t = this.now()
    const ease = 1 - Math.exp(-dt / 0.6)
    let wsum = 0, tsum = 0
    for (const id of Object.keys(TOD)) {
      const lv = (this.level[id] ?? 0) + ((this.target[id] ?? 0) - (this.level[id] ?? 0)) * ease
      this.level[id] = lv
      wsum += lv
      tsum += lv * TOD[id]
    }
    const L = this.level
    // With nothing playing the view rests at dusk; the mix pulls it from there.
    const todTarget = (tsum + REST_TOD * 0.35) / (wsum + 0.35)
    this.tod += (todTarget - this.tod) * (1 - Math.exp(-dt / 2.5))
    const S = this.state
    const rain = L.rain * (0.6 + 0.4 * (S.rain?.intensity ?? 0.8))
    const cloudTarget = Math.min(1, 0.1 + 0.6 * L.rain + 0.85 * L.thunder + 0.12 * L.wind)
    this.cloud += (cloudTarget - this.cloud) * (1 - Math.exp(-dt / 3))
    this.wet += (Math.min(1, L.rain * 1.4) - this.wet) * (1 - Math.exp(-dt / (L.rain > this.wet ? 6 : 25)))

    // Waves: seconds since each one broke (negative while it is still coming in).
    this.waveU.fill(0)
    this.waves = this.waves.filter((w) => t - w.crash < w.wash * 5)
    this.waves.forEach((w, k) => {
      this.waveU[k * 4] = t - w.crash
      this.waveU[k * 4 + 1] = w.build
      this.waveU[k * 4 + 2] = w.wash
      this.waveU[k * 4 + 3] = t - w.crash > -w.build ? w.peak : 0
      this.peelU[k] = w.peel
    })

    // Cars, where they are now.
    this.carU.fill(-1)
    this.cars = this.cars.filter((c) => Math.abs(c.x0 + c.v * (t - c.at)) < 1500)
    let k = 0
    for (const c of this.cars) {
      if (k >= 16) break
      if (t < c.at) continue
      const x = roadX(c.x0 + c.v * (t - c.at))
      if (x < -0.7 || x > 2.9) continue
      this.carU[k * 3] = x
      this.carU[k * 3 + 1] = c.lane
      this.carU[k * 3 + 2] = c.truck
      k++
    }

    // Lightning: a stroke and one restroke, never a strobe.
    let fl = 0, bz = 0
    const f = this.flash
    if (f && !this.reduced && t >= f.at) {
      const a = t - f.at
      const env = Math.exp(-a / 0.05) + (a > 0.11 ? 0.6 * Math.exp(-(a - 0.11) / 0.06) : 0)
      fl = Math.min(0.85, env * f.gain * (f.far ? 0.35 : 1.1)) * Math.max(L.thunder, 0.0)
      bz = f.far ? 0 : Math.min(1, env * 1.4) * L.thunder
      if (a > 1.5) this.flash = null
    }

    // Birds singing now.
    for (let i = 0; i < 4; i++) this.birdU[i] = t < this.songs[i] ? 1 : 0

    // The clock: real local time, the second hand stepping.
    const d = new Date()
    const sec = d.getSeconds(), min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60
    const TAU = Math.PI * 2

    // The mower, from the model's metres.
    const m = S.mower
    let mp = [0, 0, 0]
    if (m) {
      if (m.x !== this.mowerX) this.mowerDir = m.x > this.mowerX ? 1 : -1
      this.mowerX = m.x
      mp = [lawnX(m.x), lawnY(m.y), this.mowerDir * (m.running ? 1 : 0.01)]
    }

    const stage = S.dial?.stage ?? 0
    let screen = SCREEN[stage] ?? 0.3
    if (!this.reduced && (stage === 8 || stage === 9 || stage === 6)) screen *= 0.55 + 0.45 * Math.random()

    const wind = S.wind ? Math.max(0, Math.min(1, (S.wind.speed - 2) / 9)) * L.wind : 0
    return {
      u_motion: this.reduced ? 0 : 1,
      u_tod: this.tod,
      u_cloud: this.cloud,
      u_rain: rain,
      u_wet: this.wet,
      u_wind: wind,
      u_windDir: S.wind?.pan ?? 0.3,
      u_flash: fl,
      u_bolt: [f?.x ?? 1.2, f?.seed ?? 0, bz, f?.far ?? 1],
      u_waves: L.waves,
      u_wave: this.waveU,
      u_peel: this.peelU,
      u_fire: L.fire,
      u_flicker: Math.max(0.4, Math.min(1.3, S.fire?.flicker ?? 0.9)),
      u_pop: S.fire && S.fire.pop > 0 ? t - S.fire.pop : 99,
      u_cafe: L.cafe,
      u_birds: L.birds,
      u_bird: this.birdU,
      u_crickets: L.crickets,
      u_traffic: L.traffic,
      u_cars: this.carU,
      u_clock: L.clock,
      u_hands: [(hr / 12) * TAU, (min / 60) * TAU, (sec / 60) * TAU],
      u_mower: L.mower,
      u_mowerP: mp,
      u_modem: L.dial,
      u_screen: screen,
      u_level: 0,
    }
  }
}

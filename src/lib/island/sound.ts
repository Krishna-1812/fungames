/**
 * What the island sounds like, made live: there is not one audio file. A few
 * beds that never stop (the sea, the wind, a market's murmur, rain under the
 * Universe Forecast's cloud, crickets after dark, the funfair's music box) and
 * things that happen now and then (gulls, birdsong, a bell buoy, an owl, the
 * ferry's horn as it comes in and leaves, a sheep up on the peaks).
 *
 * Each has a place on the map, and the camera is the listener: a district gets
 * louder as you fly to it and quieter as you leave, and is heard from the side
 * it is on. Zoomed out, you hear the whole island, softly, and mostly the sea.
 * The time of day and the season change the mix the way they change the
 * picture: no birds at night, crickets instead; more wind in winter.
 *
 * It all goes through the site's one master (lib/audio), so the mute every
 * game has is the mute here too, and it is off until someone turns it on.
 */
import { output, tone, hit } from '../audio'

type Pt = { x: number; y: number }
export type Places = {
  /** Where each district stands on the map, in map units. */
  districts: Record<string, Pt>
  /** The cloud that always rains. */
  rain?: Pt
  /** The island's land, for telling the coast from the middle. */
  land: [number, number, number, number]
}
export type Listener = {
  view(): { x: number; y: number; w: number; h: number }
  time(): string
  season(): string
  /** False while the island is off screen or the tab is hidden. */
  awake(): boolean
  /** The ferry's place in its trip, 0..1, if it can be read. */
  ferry?(): number | null
  /** A festival night (Friday's fireworks). */
  fest?(): boolean
}

type Bed = { level: GainNode; pan: StereoPannerNode; at: (p: Places) => Pt | null; base: number }

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

export function islandSound(places: Places, ear: Listener) {
  let ctx: AudioContext | null = null
  let bus: GainNode | null = null
  let beds: Record<string, Bed> = {}
  let timer = 0
  let on = false

  /* ---- the raw material ------------------------------------------------- */
  const buffers: Record<string, AudioBuffer> = {}
  function noise(kind: 'white' | 'pink' | 'brown') {
    if (buffers[kind]) return buffers[kind]
    const c = ctx!, len = c.sampleRate * 4
    const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      if (kind === 'white') d[i] = w
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 1.6 }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.4 }
    }
    // Fade the loop's seam so it never clicks.
    for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] *= k; d[len - 1 - i] *= k }
    return (buffers[kind] = b)
  }
  function loop(kind: 'white' | 'pink' | 'brown') {
    const s = ctx!.createBufferSource()
    s.buffer = noise(kind); s.loop = true
    s.loopStart = Math.random() * 2
    s.start(ctx!.currentTime, Math.random() * 3)
    return s
  }
  function filter(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = ctx!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f
  }
  /** A slow wobble on a parameter: depth either side of its own value. */
  function lfo(param: AudioParam, rate: number, depth: number, type: OscillatorType = 'sine') {
    const o = ctx!.createOscillator(), g = ctx!.createGain()
    o.type = type; o.frequency.value = rate; g.gain.value = depth
    o.connect(g).connect(param); o.start()
  }
  function bed(name: string, chain: AudioNode[], base: number, at: Bed['at']) {
    const level = ctx!.createGain(), pan = ctx!.createStereoPanner()
    level.gain.value = 0
    for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1])
    chain[chain.length - 1].connect(level).connect(pan).connect(bus!)
    beds[name] = { level, pan, at, base }
  }

  function build() {
    const o = output()!
    ctx = o.ctx
    bus = ctx.createGain(); bus.gain.value = 0
    bus.connect(o.out)
    const D = (k: string) => (p: Places) => p.districts[k] ?? null

    // The sea: a low swell that comes in every nine seconds or so, and the
    // hiss of the surf riding on top of it, a little out of step.
    { const swell = ctx.createGain(); swell.gain.value = 0.62; lfo(swell.gain, 0.11, 0.36)
      bed('sea', [loop('brown'), filter('lowpass', 480), swell], 0.55, () => null) }
    { const swell = ctx.createGain(); swell.gain.value = 0.5; lfo(swell.gain, 0.137, 0.45)
      bed('surf', [loop('white'), filter('bandpass', 1500, 0.6), filter('lowpass', 3800), swell], 0.07, () => null) }
    // Wind: noise through a resonance that wanders.
    { const f = filter('bandpass', 720, 1.6); lfo(f.frequency, 0.07, 320); const g = ctx.createGain(); lfo(g.gain, 0.05, 0.4); g.gain.value = 0.6
      bed('wind', [loop('pink'), f, g], 0.16, D('peaks')) }
    { const f = filter('bandpass', 900, 1.2); lfo(f.frequency, 0.05, 260)
      bed('dry', [loop('pink'), f], 0.1, D('badlands')) }
    // A crowd, far enough away that it is only the shape of talking.
    { const g = ctx.createGain(); g.gain.value = 0.7; lfo(g.gain, 0.43, 0.25)
      bed('market', [loop('pink'), filter('bandpass', 620, 0.9), filter('lowpass', 1400), g], 0.11, D('market')) }
    { const g = ctx.createGain(); g.gain.value = 0.7; lfo(g.gain, 0.31, 0.3)
      bed('fair', [loop('pink'), filter('bandpass', 760, 0.9), g], 0.08, D('funfair')) }
    // The cloud that rains on the Universe Forecast, all year.
    bed('rain', [loop('white'), filter('highpass', 2400), filter('lowpass', 7600)], 0.05, (p) => p.rain ?? null)
    // Crickets: a high note trilled thirty times a second, in bursts.
    for (const [i, hz] of [[0, 4350], [1, 4720]] as const) {
      const osc = ctx.createOscillator(); osc.frequency.value = hz
      const trill = ctx.createGain(); trill.gain.value = 0; lfo(trill.gain, 29 + i * 3, 0.5, 'square')
      const burst = ctx.createGain(); burst.gain.value = 0.5; lfo(burst.gain, 0.8 + i * 0.37, 0.5, 'square')
      osc.start()
      bed(`cricket${i}`, [osc, trill, burst], 0.016, D(i ? 'oldtown' : 'peaks'))
    }
    // The music box is notes, not a loop: it has a bed for its level and
    // pan, fed by the scheduler.
    { const g = ctx.createGain(); g.gain.value = 1
      bed('box', [g], 0.13, D('funfair')); boxIn = g }
  }

  /* ---- where the listener is -------------------------------------------- */
  function hear(p: Pt | null) {
    const v = ear.view()
    if (!p) return { g: 1, pan: 0 }
    const r = Math.max(v.w, v.h) * 0.55 + 380
    const d = Math.hypot(p.x - v.x, (p.y - v.y) * 1.4)
    return { g: Math.exp(-((d / r) ** 2)), pan: clamp((p.x - v.x) / (v.w * 0.6 + 200), -1, 1) * 0.75 }
  }
  function mix() {
    const v = ear.view(), t = ear.time(), season = ear.season()
    const [lx0, ly0, lx1, ly1] = places.land
    const far = clamp((v.w - 700) / 1900)
    const dn = Math.hypot((v.x - (lx0 + lx1) / 2) / ((lx1 - lx0) / 2), (v.y - (ly0 + ly1) / 2) / ((ly1 - ly0) / 2))
    const coast = clamp((dn - 0.3) / 0.6)
    const night = t === 'night' ? 1 : t === 'dusk' || t === 'dawn' ? 0.5 : 0
    const winter = season === 'winter' || season === 'newyear' ? 1 : 0
    const want: Record<string, number> = {
      sea: 0.3 + 0.7 * Math.max(far, coast),
      surf: 0.3 + 0.7 * Math.max(far * 0.6, coast),
      wind: 0.6 + winter * 0.9 + far * 0.3,
      dry: 1,
      market: 1 - night * 0.7,
      fair: 1 - night * 0.4,
      rain: 1,
      cricket0: night * (1 - winter),
      cricket1: night * (1 - winter),
      box: 1,
    }
    const now = ctx!.currentTime
    for (const [name, b] of Object.entries(beds)) {
      const h = hear(b.at(places))
      b.level.gain.setTargetAtTime(b.base * (want[name] ?? 1) * h.g, now, 0.6)
      b.pan.pan.setTargetAtTime(h.pan, now, 0.6)
    }
    bus!.gain.setTargetAtTime(on && ear.awake() ? 0.55 : 0, now, on ? 0.5 : 0.15)
  }

  /* ---- one voice, for the things that happen ------------------------------ */
  type VoiceOpts = {
    type?: OscillatorType
    /** Frequency over time: [seconds from start, Hz]. */
    f: [number, number][]
    dur: number
    gain: number
    vib?: [number, number]
    lp?: number
    bp?: [number, number]
    attack?: number
    delay?: number
    at?: Pt | null
    /** Through the ambience (placed, and quiet when away) or straight out. */
    direct?: boolean
  }
  function voice(o: VoiceOpts) {
    const out = output(); if (!out) return
    const c = out.ctx, t = c.currentTime + (o.delay ?? 0)
    const osc = c.createOscillator(); osc.type = o.type ?? 'sine'
    osc.frequency.setValueAtTime(o.f[0][1], t)
    for (const [s, hz] of o.f.slice(1)) osc.frequency.exponentialRampToValueAtTime(Math.max(20, hz), t + s)
    if (o.vib) { const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = o.vib[0]; vg.gain.value = o.vib[1]; v.connect(vg).connect(osc.frequency); v.start(t); v.stop(t + o.dur + 0.05) }
    const env = c.createGain(), a = o.attack ?? 0.02
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + a)
    env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    let node: AudioNode = osc
    if (o.bp) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.bp[0]; f.Q.value = o.bp[1]; node.connect(f); node = f }
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f }
    node.connect(env)
    if (o.direct || !bus) env.connect(out.out)
    else { const h = hear(o.at ?? null), p = c.createStereoPanner(), g = c.createGain(); p.pan.value = h.pan; g.gain.value = h.g; env.connect(g).connect(p).connect(bus) }
    osc.start(t); osc.stop(t + o.dur + 0.05)
  }

  /* ---- now and then ------------------------------------------------------- */
  const gull = (at: Pt | null, gain = 0.05, delay = 0) => {
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++)
      voice({ type: 'sawtooth', f: [[0, 1500], [0.08, 1950], [0.3, 1100]], dur: 0.34, gain, vib: [18, 40], bp: [1700, 3], delay: delay + k * 0.36, at })
  }
  const birdsong = (at: Pt | null) => {
    const base = 2600 + Math.random() * 1600, n = 3 + Math.floor(Math.random() * 5)
    for (let k = 0; k < n; k++) { const up = Math.random() < 0.5; voice({ f: [[0, base * (up ? 0.9 : 1.2)], [0.07, base * (up ? 1.25 : 0.85)]], dur: 0.09, gain: 0.03, delay: k * (0.1 + Math.random() * 0.06), at }) }
  }
  const bell = (at: Pt | null) => {
    for (const [m, g] of [[1, 0.05], [2.76, 0.02], [5.4, 0.01]]) voice({ f: [[0, 560 * m]], dur: 2.4 / Math.sqrt(m), gain: g, attack: 0.004, at })
  }
  const owl = (at: Pt | null) => {
    for (const [d, len] of [[0, 0.5], [0.75, 0.22], [1.05, 0.6]]) voice({ f: [[0, 400], [len, 360]], dur: len, gain: 0.06, attack: 0.08, vib: [5, 6], lp: 900, delay: d, at })
  }
  const baa = (at: Pt | null, gain = 0.05, direct = false) =>
    voice({ type: 'sawtooth', f: [[0, 430], [0.1, 470], [0.55, 360]], dur: 0.6, gain, vib: [7, 22], bp: [1000, 2], lp: 2200, attack: 0.04, at, direct })
  const horn = (at: Pt | null, gain = 0.07, direct = false) => {
    for (const hz of [110, 164.8]) voice({ type: 'sawtooth', f: [[0, hz], [1.2, hz * 0.99]], dur: 1.3, gain, lp: 640, attack: 0.08, at, direct })
  }
  const boom = (at: Pt | null) => {
    voice({ f: [[0, 120], [0.8, 40]], dur: 0.9, gain: 0.12, at })
    for (let k = 0; k < 6; k++) voice({ type: 'square', f: [[0, 2000 + Math.random() * 2000]], dur: 0.04, gain: 0.012, lp: 5000, delay: 0.3 + Math.random() * 0.6, at })
  }

  // The music box: a slow carousel waltz, round and round.
  let boxIn: GainNode | null = null, boxNext = 0, boxStep = 0
  const TUNE = [0, 4, 7, 12, 7, 4, 5, 9, 12, 9, 5, 0, 7, 11, 14, 11, 7, 2, 4, 7, 12, 0, -1, -1]
  function musicBox() {
    if (!ctx || !boxIn) return
    const beat = 0.34
    if (boxNext < ctx.currentTime) boxNext = ctx.currentTime + 0.05
    while (boxNext < ctx.currentTime + 0.5) {
      const s = TUNE[boxStep % TUNE.length]
      if (s >= 0) {
        const hz = 523.25 * Math.pow(2, s / 12), t = boxNext
        for (const [m, g] of [[1, 0.5], [2, 0.12], [3.01, 0.05]]) {
          const o = ctx.createOscillator(), e = ctx.createGain()
          o.frequency.value = hz * m
          e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 / m)
          o.connect(e).connect(boxIn); o.start(t); o.stop(t + 1.2)
        }
        if (boxStep % 3 === 0) { const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.value = (hz / 4) * (s >= 12 ? 0.5 : 1); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.18, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.connect(e).connect(boxIn); o.start(t); o.stop(t + 1) }
      }
      boxNext += beat; boxStep++
    }
  }

  let ferryWas: number | null = null
  function tick() {
    if (!ctx) return
    mix()
    if (!ear.awake()) return
    musicBox()
    const t = ear.time(), season = ear.season(), D = places.districts
    const day = t === 'day' ? 1 : t === 'night' ? 0 : 0.5
    const roll = (p: number) => Math.random() < p
    if (roll(0.035 * (0.3 + day))) gull(D.harbour ?? null)
    if (roll(0.012 * day)) gull(D.market ?? null, 0.035)
    if (roll(0.05 * day * (season === 'winter' ? 0.4 : 1))) birdsong([D.oldtown, D.peaks, D.market][Math.floor(Math.random() * 3)] ?? null)
    if (roll(0.007)) bell(D.harbour ?? null)
    if (roll(0.012 * (1 - day))) owl([D.peaks, D.oldtown][Math.floor(Math.random() * 2)] ?? null)
    if (roll(0.008 * day)) baa(D.peaks ?? null)
    if ((season === 'newyear' || ear.fest?.()) && t === 'night' && roll(0.07)) boom(D.oldtown ?? null)
    // The ferry blows its horn as it comes in to the jetty and as it leaves.
    const ph = ear.ferry?.() ?? null
    if (ph !== null && ferryWas !== null) for (const at of [0.28, 0.625]) if (ferryWas < at && ph >= at) horn(D.harbour ?? null)
    ferryWas = ph
  }

  /* ---- switching on and off ----------------------------------------------- */
  function start() {
    if (!output()) return
    if (!bus) build()
    if (ctx!.state === 'suspended') void ctx!.resume()
    on = true
    clearInterval(timer); timer = window.setInterval(tick, 250)
    tick()
  }
  function stop() {
    on = false
    if (ctx) mix()
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else if (on) void ctx.resume()
  })

  /* ---- things poked, and the page's own moments --------------------------- */
  const clicks = (n: number, hz: number, gap: number, g = 0.12) => { for (let k = 0; k < n; k++) hit({ dur: 0.02, gain: g, freq: hz, q: 8, delay: k * gap }) }
  const POKES: Record<string, () => void> = {
    whale: () => { voice({ f: [[0, 160], [0.6, 210], [1.6, 120]], dur: 1.7, gain: 0.12, vib: [4, 5], lp: 700, attack: 0.25, direct: true }); hit({ dur: 0.9, gain: 0.18, freq: 1800, sweepTo: 300, q: 0.5, delay: 0.5 }) },
    dawnwhale: () => { voice({ f: [[0, 220], [0.5, 330], [1.4, 180], [2.2, 140]], dur: 2.3, gain: 0.12, vib: [5, 7], lp: 900, attack: 0.3, direct: true }); hit({ dur: 1.2, gain: 0.22, freq: 1400, sweepTo: 200, q: 0.4, delay: 1.2 }) },
    sheep: () => baa(null, 0.13, true),
    windmill: () => { for (let k = 0; k < 5; k++) hit({ dur: 0.22, gain: 0.08 + k * 0.015, freq: 500, sweepTo: 1600, q: 0.8, delay: k * (0.28 - k * 0.03) }) },
    balloon: () => { hit({ dur: 0.9, gain: 0.16, freq: 700, sweepTo: 300, type: 'lowpass', q: 0.4 }); hit({ dur: 0.8, gain: 0.05, freq: 5000, q: 0.5 }) },
    crab: () => clicks(7, 3600, 0.055),
    fountain: () => { hit({ dur: 0.7, gain: 0.14, freq: 2600, sweepTo: 500, q: 0.6 }); [0.5, 0.68, 0.8].forEach((d) => tone({ freq: 900, to: 380, dur: 0.12, gain: 0.08, delay: d })) },
    kite: () => { hit({ dur: 0.5, gain: 0.08, freq: 400, sweepTo: 2000, q: 1 }); hit({ dur: 0.5, gain: 0.06, freq: 2000, sweepTo: 500, q: 1, delay: 0.45 }) },
    dolphin: () => { clicks(5, 5200, 0.04, 0.08); voice({ f: [[0, 3000], [0.15, 5200], [0.4, 2800]], dur: 0.45, gain: 0.05, delay: 0.25, direct: true }) },
    duck: () => { for (const d of [0, 0.2]) voice({ type: 'sawtooth', f: [[0, 340], [0.12, 280]], dur: 0.14, gain: 0.12, bp: [1100, 4], delay: d, direct: true }) },
    gull: () => gull(null, 0.1, 0),
    deer: () => { for (let k = 0; k < 6; k++) tone({ freq: 260, to: 180, dur: 0.05, gain: 0.12, delay: k * 0.09 }) },
    ferry: () => horn(null, 0.12, true),
    // Morse: · · · — — — · · ·
    castaway: () => { let t = 0; for (const u of [1, 1, 1, 3, 3, 3, 1, 1, 1]) { tone({ freq: 760, dur: u * 0.08, gain: 0.08, type: 'sine', delay: t }); t += u * 0.08 + 0.08 } },
    treasure: () => { [0, 4, 7, 12, 16].forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.35, gain: 0.1, type: 'triangle', delay: i * 0.07 })) },
    bottle: () => { tone({ freq: 500, to: 1400, dur: 0.06, gain: 0.14, type: 'sine' }); [0.25, 0.45, 0.6].forEach((d, i) => tone({ freq: 320 + i * 90, to: 520 + i * 90, dur: 0.1, gain: 0.06, delay: d })) },
    house32: () => { voice({ type: 'sawtooth', f: [[0, 90], [0.4, 140], [0.9, 110]], dur: 1, gain: 0.05, vib: [11, 8], lp: 900, direct: true }); [1, 1.18, 1.36].forEach((d) => hit({ dur: 0.06, gain: 0.2, freq: 300, type: 'lowpass', delay: d })) },
    ufo: () => { voice({ f: [[0, 500], [0.5, 900], [1.1, 420], [1.7, 1100]], dur: 1.8, gain: 0.07, vib: [7, 40], direct: true }) },
  }

  return {
    start, stop,
    get on() { return on },
    poke: (kind: string) => { if (on) POKES[kind]?.() },
    /** A new thing found: a little sparkle on top of its own sound. */
    found: () => { if (on) [0, 3, 5, 10].forEach((s, i) => tone({ freq: 1046 * Math.pow(2, s / 12), dur: 0.16, type: 'sine', gain: 0.05, delay: 0.25 + i * 0.05 })) },
    /** Going into a game: the camera dives. */
    dive: () => { if (on) hit({ dur: 0.7, gain: 0.12, freq: 300, sweepTo: 2600, q: 0.7 }) },
    /** A stamp in the passport: a thump, and the ink. */
    stamp: (k = 0) => { if (!on) return; tone({ freq: 150, to: 60, dur: 0.16, gain: 0.25, delay: k }); hit({ dur: 0.08, gain: 0.16, freq: 900, type: 'lowpass', delay: k }) },
    /** The passport's cover opening. */
    page: () => { if (on) hit({ dur: 0.3, gain: 0.06, freq: 1800, sweepTo: 4000, q: 0.5 }) },
    /** A bottle's note unrolled: the cork, then paper. */
    unroll: () => { if (!on) return; tone({ freq: 620, to: 1500, dur: 0.05, gain: 0.12, type: 'sine', delay: 0.5 }); hit({ dur: 0.42, gain: 0.07, freq: 2600, sweepTo: 5200, q: 0.5, delay: 0.62 }) },
    /** The beach ball landing, harder or softer. */
    thump: (k = 0.5) => { if (!on) return; tone({ freq: 190 + k * 60, to: 90, dur: 0.12, gain: 0.08 + k * 0.14, type: 'sine' }); hit({ dur: 0.05, gain: 0.04 + k * 0.05, freq: 700, type: 'lowpass' }) },
    /** Something landing in the sea. */
    splash: () => { if (!on) return; hit({ dur: 0.5, gain: 0.14, freq: 2200, sweepTo: 600, q: 0.6 }); tone({ freq: 520, to: 220, dur: 0.15, gain: 0.05, delay: 0.04 }) },
    /** Pigeons going up: a clatter of wings. */
    flutter: () => { if (!on) return; for (let k = 0; k < 9; k++) hit({ dur: 0.06, gain: 0.05 + (k % 3) * 0.015, freq: 900 + (k % 4) * 260, q: 1.2, delay: k * 0.045 + Math.random() * 0.03 }) },
    /** The bell in the square, on the hour: as many strokes as the hour (up to twelve), and a hum after. */
    bells: (n: number) => { if (!on) return; const strokes = Math.max(1, Math.min(12, n)); for (let k = 0; k < strokes; k++) { const d = k * 1.15; tone({ freq: 392, dur: 2.2, gain: 0.08, type: 'sine', delay: d }); tone({ freq: 392 * 2.76, dur: 1.2, gain: 0.025, type: 'sine', delay: d }); tone({ freq: 196, dur: 2.6, gain: 0.04, type: 'sine', delay: d }) } },
    /** The parade's drum, a beat: k picks which of the bar it is. */
    drum: (k = 0) => { if (!on) return; if (k % 4 === 0) tone({ freq: 110, to: 60, dur: 0.18, gain: 0.12 }); hit({ dur: 0.06, gain: k % 2 ? 0.05 : 0.08, freq: 1800, q: 1.5, type: 'bandpass' }) },
    /** A postcard taken: the shutter, and the film winding on. */
    shutter: () => { if (!on) return; hit({ dur: 0.025, gain: 0.3, freq: 3200, q: 2 }); hit({ dur: 0.04, gain: 0.2, freq: 1500, q: 3, delay: 0.08 }); for (let k = 0; k < 4; k++) hit({ dur: 0.018, gain: 0.05, freq: 2400, q: 6, delay: 0.24 + k * 0.045 }) },
  }
}

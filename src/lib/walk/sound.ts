/**
 * The walk's sound (walker.ts), made as it plays — no recordings: noise and
 * oscillators shaped the way the real sounds are shaped, placed in the world
 * round your ears (the camera), louder the nearer, to the side they come from.
 *
 *   - the sea: a low roar of surf that grows as you near the shore, and the
 *     waves themselves, each swelling and breaking with a hiss, from the side
 *     the water is on; lapping round you when you wade or swim;
 *   - the wind: a moan that rises and falls with its gusts, a whistle in a gale;
 *   - rain: its hiss and patter, harder as it rains harder; thunder rolling in
 *     a few seconds after the lightning, further off the longer it takes;
 *   - you: footsteps, each a step on what you are walking on (a tap on the
 *     street and the paving, a brush through grass, a crunch in sand, a splash
 *     in a puddle or the shallows); a thud landing; a splash jumping in;
 *     strokes swimming;
 *   - the traffic: each car near you its engine and its tyres on the road,
 *     going by; the car you drive — its engine climbing through the gears with
 *     your speed and your foot, the tyres squealing in a slide, a knock;
 *   - gulls calling overhead and from the rocks; by day birdsong from the
 *     trees, by night crickets; the ferry's horn as it leaves the pier.
 *
 * Browsers start sound only after you do something on the page: it starts
 * at the first key or touch. It can be turned off (the page's button), and
 * stays off for next time.
 */
import type { Vector3 } from 'three'

/** What the sound needs to know each frame. */
export type Hearing = {
  cam: Vector3; forward: Vector3; up: Vector3
  /** How near the shore is (world units) and which way (x, z), or null if far. */
  shore: { d: number; x: number; z: number } | null
  inWater: boolean; swimming: boolean
  wind: number; gust: number; rain: number; flash: number; day: number; wet: number
  /** Out among the streets (people, traffic), or out of town. */
  town: number
  /** Trees near (songbirds by day, crickets by night) — and land under you at all. */
  green: number
  /** Cars near: where, how fast (m/s), and whether it is the bus. */
  cars: { x: number; y: number; z: number; v: number; bus: boolean }[]
  /** The car you drive, if you do: speed (m/s, + forward), your foot (0–1), how hard it slides (m/s sideways), a knock this frame. */
  mine: { x: number; y: number; z: number; v: number; throttle: number; slide: number; hit: number; flooded: boolean } | null
  gulls: { x: number; y: number; z: number }[]
}
export type Surface = 'hard' | 'grass' | 'sand' | 'wood' | 'puddle' | 'water'

export function soundscape() {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let on = true, started = false
  let noise: AudioBuffer | null = null
  const beds: Record<string, { g: GainNode; f?: BiquadFilterNode; f2?: BiquadFilterNode; p?: StereoPannerNode }> = {}
  const levels: Record<string, number> = {}
  let t = 0, nextWave = 2, nextGull = 3, nextBird = 1, thunderAt = -1, thunderPow = 0, lastFlash = 0
  type Voice = { osc: OscillatorNode; osc2: OscillatorNode; road: GainNode; g: GainNode; f: BiquadFilterNode; pan: PannerNode; car: number }
  const voices: Voice[] = []
  let engine: { osc: OscillatorNode; osc2: OscillatorNode; g: GainNode; f: BiquadFilterNode; squeal: GainNode; road: GainNode } | null = null
  let rpm = 900, gear = 1

  const make = () => {
    const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    if (!AC) return
    ctx = new AC()
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4
    master = ctx.createGain(); master.gain.value = on ? 0.9 : 0
    master.connect(comp).connect(ctx.destination)
    // White noise, two seconds of it, looped under everything.
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const loop = (rate = 1) => { const s = ctx!.createBufferSource(); s.buffer = noise; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 2); return s }
    /** A bed of filtered noise: low-pass then band (or high) shaped, its own level and side. */
    const bed = (name: string, f1: BiquadFilterType, fr1: number, f2: BiquadFilterType | null, fr2: number, q = 0.7) => {
      const src = loop(0.8 + Math.random() * 0.4), f = ctx!.createBiquadFilter(); f.type = f1; f.frequency.value = fr1; f.Q.value = q
      const g = ctx!.createGain(); g.gain.value = 0
      const p = ctx!.createStereoPanner()
      let n: AudioNode = src.connect(f)
      let ff: BiquadFilterNode | undefined
      if (f2) { ff = ctx!.createBiquadFilter(); ff.type = f2; ff.frequency.value = fr2; n = n.connect(ff) }
      n.connect(g).connect(p).connect(master!)
      beds[name] = { g, f, f2: ff, p }
    }
    bed('surf', 'lowpass', 380, 'highpass', 40)
    bed('wave', 'bandpass', 900, 'lowpass', 4200, 0.5)
    bed('lap', 'bandpass', 600, 'lowpass', 2500, 1.2)
    bed('wind', 'bandpass', 500, 'lowpass', 1400, 1.1)
    bed('whistle', 'bandpass', 1400, null, 0, 9)
    bed('rain', 'highpass', 1300, 'lowpass', 7500)
    bed('patter', 'bandpass', 2600, null, 0, 0.9)
    bed('thunder', 'lowpass', 140, null, 0)
    bed('town', 'lowpass', 320, null, 0)
    bed('leaves', 'highpass', 2400, 'lowpass', 6500)
    // Engines for the cars near you: two detuned saws through a low-pass, and their tyres' roar.
    for (let k = 0; k < 4; k++) {
      const osc = ctx.createOscillator(), osc2 = ctx.createOscillator(); osc.type = 'sawtooth'; osc2.type = 'square'
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 2
      const g = ctx.createGain(); g.gain.value = 0
      const og = ctx.createGain(); og.gain.value = 0.25
      const road = ctx.createGain(); road.gain.value = 0
      const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 700; rf.Q.value = 0.6
      const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 0.25; pan.rolloffFactor = 1.3
      osc.connect(f); osc2.connect(og).connect(f); f.connect(g); loop(1).connect(rf).connect(road).connect(g)
      g.connect(pan).connect(master)
      osc.start(); osc2.start()
      voices.push({ osc, osc2, road, g, f, pan, car: -1 })
    }
    // Your own engine.
    {
      const osc = ctx.createOscillator(), osc2 = ctx.createOscillator(); osc.type = 'sawtooth'; osc2.type = 'sawtooth'
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 3
      const g = ctx.createGain(); g.gain.value = 0
      osc.connect(f); osc2.connect(f); f.connect(g).connect(master)
      const sq = ctx.createGain(); sq.gain.value = 0
      const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2600; sf.Q.value = 6
      loop(1).connect(sf).connect(sq).connect(master)
      const road = ctx.createGain(); road.gain.value = 0
      const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 700
      loop(1).connect(rf).connect(road).connect(master)
      osc.start(); osc2.start()
      engine = { osc, osc2, g, f, squeal: sq, road }
    }
  }

  /** A short burst of filtered noise: a step, a splash, a thud. */
  const burst = (o: { type: BiquadFilterType; freq: number; q?: number; dur: number; gain: number; attack?: number; pan?: number; at?: { x: number; y: number; z: number } | null; sweep?: number; delay?: number }) => {
    if (!ctx || !master || !noise || !on) return
    const now = ctx.currentTime + (o.delay ?? 0)
    const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.9 + Math.random() * 0.2
    const f = ctx.createBiquadFilter(); f.type = o.type; f.frequency.setValueAtTime(o.freq, now); f.Q.value = o.q ?? 1
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.freq * o.sweep, now + o.dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(o.gain, now + (o.attack ?? 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, now + o.dur)
    let out: AudioNode = s.connect(f).connect(g)
    if (o.at) { const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 0.3; p.rolloffFactor = 1.2; p.positionX.value = o.at.x; p.positionY.value = o.at.y; p.positionZ.value = o.at.z; out = out.connect(p) }
    else if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; out = out.connect(p) }
    out.connect(master)
    s.start(now, Math.random() * 1.5); s.stop(now + o.dur + 0.05)
  }
  /** A call: a tone sweeping between pitches, with a little roughness (a gull's, a bird's, a cricket's). */
  const call = (o: { f0: number; f1: number; dur: number; gain: number; type?: OscillatorType; at?: { x: number; y: number; z: number }; pan?: number; vib?: number; delay?: number; bp?: number }) => {
    if (!ctx || !master || !on) return
    const now = ctx.currentTime + (o.delay ?? 0)
    const osc = ctx.createOscillator(); osc.type = o.type ?? 'sawtooth'
    osc.frequency.setValueAtTime(o.f0, now); osc.frequency.exponentialRampToValueAtTime(o.f1, now + o.dur * 0.85)
    if (o.vib) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = o.vib; lg.gain.value = o.f0 * 0.04; lfo.connect(lg).connect(osc.frequency); lfo.start(now); lfo.stop(now + o.dur) }
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.bp ?? (o.f0 + o.f1) * 0.6; f.Q.value = 1.4
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(o.gain, now + Math.min(0.03, o.dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, now + o.dur)
    let out: AudioNode = osc.connect(f).connect(g)
    if (o.at) { const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 0.4; p.rolloffFactor = 1.1; p.positionX.value = o.at.x; p.positionY.value = o.at.y; p.positionZ.value = o.at.z; out = out.connect(p) }
    else if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; out = out.connect(p) }
    out.connect(master)
    osc.start(now); osc.stop(now + o.dur + 0.05)
  }
  const set = (name: string, v: number, k = 0.15) => {
    levels[name] = v
    const b = beds[name]; if (!b || !ctx) return
    b.g.gain.setTargetAtTime(v, ctx.currentTime, k)
  }

  return {
    /** Start (at the first key or touch: browsers allow no sooner). */
    start() {
      if (!started) { started = true; try { make() } catch { ctx = null } }
      void ctx?.resume()
    },
    get running() { return !!ctx && ctx.state === 'running' },
    /** Sound on or off. */
    setOn(v: boolean) { on = v; if (master && ctx) master.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.1) },
    get on() { return on },
    /** A footstep on what you are walking on (louder running). */
    step(s: Surface, run: boolean) {
      const k = run ? 1.5 : 1
      if (s === 'hard') { burst({ type: 'bandpass', freq: 1700 + Math.random() * 600, q: 1.8, dur: 0.07, gain: 0.09 * k }); burst({ type: 'lowpass', freq: 160, dur: 0.06, gain: 0.12 * k }) }
      else if (s === 'wood') { burst({ type: 'bandpass', freq: 520, q: 3, dur: 0.11, gain: 0.14 * k }); burst({ type: 'bandpass', freq: 1500, q: 2, dur: 0.05, gain: 0.05 * k }) }
      else if (s === 'grass') burst({ type: 'bandpass', freq: 2600 + Math.random() * 1200, q: 0.6, dur: 0.12, gain: 0.045 * k, attack: 0.02 })
      else if (s === 'sand') { burst({ type: 'highpass', freq: 3000, dur: 0.14, gain: 0.05 * k, attack: 0.015 }); burst({ type: 'lowpass', freq: 220, dur: 0.08, gain: 0.05 * k }) }
      else if (s === 'puddle') { burst({ type: 'bandpass', freq: 1400, q: 1, dur: 0.16, gain: 0.1 * k, sweep: 1.8 }); burst({ type: 'lowpass', freq: 160, dur: 0.06, gain: 0.08 * k }) }
      else burst({ type: 'bandpass', freq: 900, q: 0.8, dur: 0.3, gain: 0.12 * k, attack: 0.02, sweep: 2.5 })
    },
    /** Something knocked, bounced or kicked, where it is: a ball's thump, a crate's wooden knock, a fish box's or a cone's plastic clack. */
    knock(kind: string, hard: number, at: { x: number; y: number; z: number }) {
      const k = Math.min(1, hard / 6)
      if (kind === 'football') { burst({ type: 'bandpass', freq: 380, q: 1.5, dur: 0.12, gain: 0.3 * k, at }); burst({ type: 'bandpass', freq: 1300, q: 1.2, dur: 0.05, gain: 0.12 * k, at }) }
      else if (kind === 'beachball') burst({ type: 'bandpass', freq: 260, q: 5, dur: 0.22, gain: 0.25 * k, at, sweep: 0.8 })
      else if (kind === 'crate') { burst({ type: 'bandpass', freq: 480 + Math.random() * 120, q: 3.5, dur: 0.16, gain: 0.35 * k, at }); burst({ type: 'lowpass', freq: 180, dur: 0.12, gain: 0.3 * k, at }) }
      else if (kind === 'fishbox') burst({ type: 'bandpass', freq: 850 + Math.random() * 200, q: 2.5, dur: 0.12, gain: 0.28 * k, at })
      else { burst({ type: 'bandpass', freq: 1150, q: 2.2, dur: 0.08, gain: 0.25 * k, at }); burst({ type: 'lowpass', freq: 300, dur: 0.1, gain: 0.15 * k, at }) }
    },
    /** Coming down hard. */
    land(power: number) { burst({ type: 'lowpass', freq: 140, dur: 0.18, gain: 0.25 * Math.min(1, power) }); burst({ type: 'bandpass', freq: 1200, dur: 0.08, gain: 0.08 * Math.min(1, power) }) },
    /** Into the water. */
    splash(power: number) { burst({ type: 'bandpass', freq: 700, q: 0.7, dur: 0.5 + power * 0.6, gain: 0.25 * Math.min(1, 0.3 + power), sweep: 3 }); burst({ type: 'highpass', freq: 2500, dur: 0.9, gain: 0.08 * power, delay: 0.15 }) },
    /** A stroke of the crawl. */
    stroke() { burst({ type: 'bandpass', freq: 800 + Math.random() * 400, q: 0.9, dur: 0.35, gain: 0.07, attack: 0.03, sweep: 1.8 }) },
    /** The ferry's horn: two long notes, from where it is. */
    horn(at: { x: number; y: number; z: number }) {
      for (const [f, d] of [[110, 0], [138.6, 0]] as const) call({ f0: f, f1: f * 0.995, dur: 2.6, gain: 0.5, type: 'sawtooth', at, delay: d, bp: 300 })
    },
    /** (For the checks: how loud each part is meant to be now.) */
    levels: () => ({ ...levels }),
    /** Each frame: the beds follow where you are and the weather; the cars, your engine, the birds. */
    update(dt: number, h: Hearing) {
      if (!ctx || !master || ctx.state !== 'running') return
      t += dt
      const L = ctx.listener, now = ctx.currentTime
      if (L.positionX) {
        L.positionX.setTargetAtTime(h.cam.x, now, 0.02); L.positionY.setTargetAtTime(h.cam.y, now, 0.02); L.positionZ.setTargetAtTime(h.cam.z, now, 0.02)
        L.forwardX.setTargetAtTime(h.forward.x, now, 0.02); L.forwardY.setTargetAtTime(h.forward.y, now, 0.02); L.forwardZ.setTargetAtTime(h.forward.z, now, 0.02)
        L.upX.setTargetAtTime(h.up.x, now, 0.02); L.upY.setTargetAtTime(h.up.y, now, 0.02); L.upZ.setTargetAtTime(h.up.z, now, 0.02)
      }
      // Which side a direction is on (−1 left, 1 right), as you face.
      const side = (x: number, z: number) => { const rx = -h.forward.z, rz = h.forward.x, l = Math.hypot(x, z) || 1; return Math.max(-1, Math.min(1, (x * rx + z * rz) / l / Math.hypot(rx, rz || 1e-6))) }

      /* the sea */
      const near = h.shore ? 1 / (1 + (h.shore.d / 1.2) ** 2) : 0
      set('surf', 0.05 + 0.25 * near + 0.08 * h.wind, 0.4)
      if (h.shore) { const pv = side(h.shore.x, h.shore.z) * 0.6; beds.surf.p!.pan.setTargetAtTime(pv, now, 0.3); beds.wave.p!.pan.setTargetAtTime(pv, now, 0.3) }
      // A wave: swelling, breaking, running up the sand and drawing back.
      if ((nextWave -= dt) <= 0) {
        nextWave = 5 + Math.random() * 4 - h.wind * 2
        const g = beds.wave.g.gain, f = beds.wave.f!.frequency, peak = (0.1 + 0.5 * near) * (0.7 + 0.5 * h.wind)
        g.cancelScheduledValues(now); g.setTargetAtTime(peak * 0.3, now, 0.6); g.setTargetAtTime(peak, now + 1.4, 0.15); g.setTargetAtTime(peak * 0.25, now + 2.1, 0.8); g.setTargetAtTime(0.0001, now + 4, 1.2)
        f.cancelScheduledValues(now); f.setTargetAtTime(500, now, 0.5); f.setTargetAtTime(1900, now + 1.4, 0.2); f.setTargetAtTime(700, now + 2.6, 0.9)
        levels.wave = peak
      }
      set('lap', h.inWater ? (h.swimming ? 0.12 : 0.07) + 0.04 * Math.sin(t * 1.3) : 0, 0.3)

      /* the wind, the rain, thunder */
      const w = h.wind * (0.6 + 0.4 * h.gust)
      set('wind', 0.015 + 0.14 * w * w, 0.5)
      beds.wind.f!.frequency.setTargetAtTime(320 + 520 * w + 120 * Math.sin(t * 0.7), now, 0.4)
      set('whistle', Math.max(0, w - 0.65) * 0.05, 0.6)
      beds.whistle.f!.frequency.setTargetAtTime(1100 + 700 * h.gust, now, 0.5)
      set('leaves', h.green * (0.004 + 0.03 * w), 0.4)
      set('rain', 0.22 * h.rain, 0.5)
      set('patter', 0.1 * h.rain * (0.6 + 0.4 * Math.sin(t * 9.1) * Math.sin(t * 3.7)), 0.05)
      if (h.flash > 0.9 && t - lastFlash > 2) { lastFlash = t; thunderAt = t + 1 + Math.random() * 4; thunderPow = 1 - (thunderAt - t - 1) / 5 }
      if (thunderAt > 0 && t >= thunderAt) {
        thunderAt = -1
        const g = beds.thunder.g.gain, p = 0.9 * thunderPow
        g.cancelScheduledValues(now); g.setTargetAtTime(p, now, 0.08); g.setTargetAtTime(p * 0.5, now + 0.5, 0.4); g.setTargetAtTime(p * 0.7, now + 1.2, 0.3); g.setTargetAtTime(0.0001, now + 2, 1.6)
        burst({ type: 'lowpass', freq: 600, dur: 0.6, gain: 0.3 * thunderPow })
        levels.thunder = p
      }
      set('town', 0.025 * h.town * (0.4 + 0.6 * h.day), 0.6)

      /* the traffic: the four nearest cars each an engine, placed where it is */
      const order = h.cars.map((c, k) => [Math.hypot(c.x - h.cam.x, c.z - h.cam.z), k]).sort((a, b) => a[0] - b[0]).slice(0, 4)
      voices.forEach((v, n) => {
        const pick = order[n]
        const c = pick && pick[0] < 4 ? h.cars[pick[1]] : null
        if (!c) { v.g.gain.setTargetAtTime(0, now, 0.2); return }
        v.pan.positionX.setTargetAtTime(c.x, now, 0.03); v.pan.positionY.setTargetAtTime(c.y + 0.05, now, 0.03); v.pan.positionZ.setTargetAtTime(c.z, now, 0.03)
        // (Idling at 800 rpm, a four-cylinder fires 27 times a second; up through the gears, the note climbs and falls.)
        const sp = Math.abs(c.v), g = sp < 0.3 ? 0 : 1 + Math.min(3, Math.floor(sp / 4)), r = sp < 0.3 ? 800 : 1200 + ((sp % 4) / 4) * 1800 + g * 150
        const fire = (r / 60) * (c.bus ? 1.5 : 2) * (c.bus ? 0.6 : 1)
        v.osc.frequency.setTargetAtTime(fire, now, 0.1); v.osc2.frequency.setTargetAtTime(fire * 0.5, now, 0.1)
        v.f.frequency.setTargetAtTime(300 + sp * 60, now, 0.1)
        v.road.gain.setTargetAtTime(Math.min(0.5, sp * 0.05), now, 0.1)
        v.g.gain.setTargetAtTime((c.bus ? 0.22 : 0.14) * (0.5 + Math.min(1, sp / 8)), now, 0.15)
      })
      levels.traffic = order.length && order[0][0] < 4 ? 1 / (1 + order[0][0]) : 0

      /* your own car */
      if (engine) {
        const m = h.mine
        if (m && !m.flooded) {
          const sp = Math.abs(m.v)
          // Up a gear at 4,800 rpm, down at 1,800.
          const ratio = [0, 13.5, 8.2, 5.8, 4.4, 3.6][gear], wheelRpm = (sp / (2 * Math.PI * 0.32)) * 60
          let want = Math.max(800 + 1400 * m.throttle * (sp < 0.5 ? 1 : 0), wheelRpm * ratio)
          if (want > 4800 && gear < 5) gear++
          else if (want < 1800 && gear > 1) gear--
          want = Math.max(800 + 600 * m.throttle * (sp < 0.5 ? 1 : 0), wheelRpm * [0, 13.5, 8.2, 5.8, 4.4, 3.6][gear])
          rpm += (want - rpm) * Math.min(1, dt * 6)
          const fire = (rpm / 60) * 2
          engine.osc.frequency.setTargetAtTime(fire, now, 0.03); engine.osc2.frequency.setTargetAtTime(fire * 1.006, now, 0.03)
          engine.f.frequency.setTargetAtTime(250 + rpm * 0.12 + 900 * m.throttle, now, 0.05)
          engine.g.gain.setTargetAtTime(0.07 + 0.1 * m.throttle + rpm / 60000, now, 0.05)
          engine.road.gain.setTargetAtTime(Math.min(0.12, sp * 0.008), now, 0.1)
          engine.squeal.gain.setTargetAtTime(sp > 2 ? Math.min(0.12, Math.max(0, m.slide - 1.2) * 0.05) : 0, now, 0.05)
          if (m.hit > 0.5) burst({ type: 'lowpass', freq: 220, dur: 0.35, gain: Math.min(0.6, m.hit * 0.08) })
          levels.engine = rpm
        } else {
          engine.g.gain.setTargetAtTime(0, now, 0.2); engine.road.gain.setTargetAtTime(0, now, 0.2); engine.squeal.gain.setTargetAtTime(0, now, 0.1)
          levels.engine = 0; gear = 1; rpm = 900
        }
      }

      /* the gulls, the birds, the crickets */
      if ((nextGull -= dt) <= 0) {
        nextGull = 2 + Math.random() * 6
        const g = h.gulls.filter((q) => Math.hypot(q.x - h.cam.x, q.z - h.cam.z) < 12)
        if (g.length) {
          const q = g[Math.floor(Math.random() * g.length)], n = 1 + Math.floor(Math.random() * 4)
          // The herring gull's long call: a run of falling "kyow"s, the first longest.
          for (let k = 0; k < n; k++) call({ f0: 1650 + Math.random() * 150, f1: 980, dur: k ? 0.22 : 0.42, gain: 0.22, at: q, delay: k * 0.3 + (k ? 0.12 : 0), vib: 38, bp: 1400 })
          levels.gull = 1
        }
      }
      if ((nextBird -= dt) <= 0) {
        nextBird = 0.6 + Math.random() * 2.2
        if (h.green > 0.2 && h.day > 0.5 && h.rain < 0.2) {
          // A songbird: a few quick whistled notes, rising and falling.
          const pan = Math.random() * 1.6 - 0.8, base = 2600 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 5)
          for (let k = 0; k < n; k++) { const up = Math.random() < 0.5; call({ f0: base * (up ? 0.8 : 1.2), f1: base * (up ? 1.25 : 0.75), dur: 0.07 + Math.random() * 0.08, gain: 0.05 * h.green, type: 'sine', pan, delay: k * 0.11 }) }
          levels.bird = 1
        } else if (h.green > 0.1 && h.day < 0.3 && h.rain < 0.3) {
          // A cricket: a chirp of three pulses of its high note.
          const pan = Math.random() * 1.6 - 0.8, f = 4300 + Math.random() * 500
          for (let k = 0; k < 3; k++) call({ f0: f, f1: f * 0.99, dur: 0.035, gain: 0.025 * h.green, type: 'sine', pan, delay: k * 0.05 })
          nextBird = 0.25 + Math.random() * 0.7
          levels.cricket = 1
        }
      }
    },
    dispose() { void ctx?.close() },
  }
}

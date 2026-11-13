/**
 * What Orbit sounds like.
 *
 * Space is silent, so this is the sound a film gives it, kept to what the
 * picture is doing:
 *
 *   - impact: a collision is felt more than heard — a low thump whose pitch
 *     falls as it dies, a crunch on top, and the rattle of debris after, all
 *     as loud as the energy of the blow, placed left or right where it
 *     happened. Something falling into a star is a deeper, longer whoomp with
 *     a hiss of vapour instead of a crunch.
 *   - launch: a short rush of air that rises with the speed of the throw and
 *     sits lower for a heavier body.
 *   - ambience: a quiet hum under everything while the sky runs — two low
 *     tones a fifth apart and a band of dark noise breathing slowly — which
 *     hushes when the sky is frozen or the page is out of sight.
 *
 * Everything goes through the site's master, so all of it is behind the same
 * mute, and nothing is built until sound has been unlocked by a touch.
 */
import { output } from './audio'

type Out = { ctx: AudioContext; out: AudioNode }

let noiseBuf: AudioBuffer | null = null
/** Two seconds of white noise, made once per sample rate. */
function noise(c: AudioContext) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf
  const n = Math.floor(c.sampleRate * 2)
  noiseBuf = c.createBuffer(1, n, c.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

let rattleBuf: AudioBuffer | null = null
/** Debris: sparse clicks of uneven size, as fragments tick off each other. */
function rattle(c: AudioContext) {
  if (rattleBuf && rattleBuf.sampleRate === c.sampleRate) return rattleBuf
  const n = Math.floor(c.sampleRate * 1.5)
  rattleBuf = c.createBuffer(1, n, c.sampleRate)
  const d = rattleBuf.getChannelData(0)
  let ring = 0
  for (let i = 0; i < n; i++) {
    const fade = 1 - i / n
    if (Math.random() < 0.0012 * fade * fade) ring = (Math.random() * 2 - 1) * (0.4 + Math.random())
    ring *= 0.86
    d[i] = ring
  }
  return rattleBuf
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** A gain node that rises fast and falls exponentially to nothing. */
function envelope(o: Out, at: number, peak: number, attack: number, dur: number) {
  const g = o.ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  return g
}

/** Somewhere between the speakers: -1 is hard left. */
function panner(o: Out, pan: number) {
  const p = o.ctx.createStereoPanner()
  p.pan.value = clamp(pan, -1, 1) * 0.7
  p.connect(o.out)
  return p
}

function noiseShot(o: Out, dest: AudioNode, at: number, opt: {
  dur: number; gain: number; type: BiquadFilterType; freq: number; to?: number; q?: number; attack?: number
}) {
  const c = o.ctx
  const src = c.createBufferSource()
  src.buffer = noise(c)
  const f = c.createBiquadFilter()
  f.type = opt.type
  f.Q.value = opt.q ?? 0.7
  f.frequency.setValueAtTime(opt.freq, at)
  if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, at + opt.dur)
  const g = envelope(o, at, opt.gain, opt.attack ?? 0.005, opt.dur)
  src.connect(f).connect(g).connect(dest)
  src.start(at, Math.random() * 1.5)
  src.stop(at + opt.dur + 0.05)
  src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect() }
}

export function createOrbitSound() {
  let hum: { gain: GainNode; nodes: AudioScheduledSourceNode[] } | null = null

  /** A collision. `energy` is ½mv² of the swallowed body; `pan` is -1..1. */
  function impact(energy: number, pan: number, star: boolean) {
    const o = output()
    if (!o) return
    const c = o.ctx, at = c.currentTime + 0.005
    // Loudness grows with the log of the energy: a pebble and a planet are
    // not a thousand times apart to the ear.
    const k = clamp(0.25 + Math.log10(1 + energy) * 0.32, 0.15, 1)
    const dest = panner(o, pan)
    const dur = star ? 1.4 : 0.45 + 0.5 * k

    // The thump: a low sine that drops as it dies.
    const osc = c.createOscillator()
    osc.type = 'sine'
    const f0 = star ? 52 : 78 - 22 * k
    osc.frequency.setValueAtTime(f0, at)
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, at + dur)
    const g = envelope(o, at, 0.34 * k, star ? 0.06 : 0.008, dur)
    osc.connect(g).connect(dest)
    osc.start(at); osc.stop(at + dur + 0.05)
    osc.onended = () => { osc.disconnect(); g.disconnect() }

    if (star) {
      // Into a star: a slow swell of dark noise and a hiss of vapour.
      noiseShot(o, dest, at, { dur: 1.3, gain: 0.16 * k, type: 'lowpass', freq: 180, to: 90, attack: 0.12 })
      noiseShot(o, dest, at + 0.05, { dur: 0.9, gain: 0.05 * k, type: 'highpass', freq: 3500, to: 6000, attack: 0.08 })
    } else {
      // Rock on rock: a crunch, then the debris.
      noiseShot(o, dest, at, { dur: 0.18 + 0.2 * k, gain: 0.20 * k, type: 'lowpass', freq: 900 + 900 * k, to: 220, q: 0.9 })
      const src = c.createBufferSource()
      src.buffer = rattle(c)
      src.playbackRate.value = 0.8 + Math.random() * 0.4
      const f = c.createBiquadFilter()
      f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.8
      const rg = envelope(o, at + 0.04, 0.25 * k, 0.01, 1.1)
      src.connect(f).connect(rg).connect(dest)
      src.start(at + 0.04); src.stop(at + 1.2)
      src.onended = () => { src.disconnect(); f.disconnect(); rg.disconnect() }
    }
    window.setTimeout(() => dest.disconnect(), (dur + 1.5) * 1000)
  }

  /** A launch: `speed` in pixels a frame, `heavy` 0..1 from moon to star. */
  function launch(speed: number, heavy: number, pan: number) {
    const o = output()
    if (!o) return
    const c = o.ctx, at = c.currentTime + 0.005
    const k = clamp(speed / 6, 0.1, 1)
    const dest = panner(o, pan)
    const low = 1 - 0.55 * heavy
    noiseShot(o, dest, at, {
      dur: 0.22 + 0.2 * k, gain: 0.07 + 0.09 * k, type: 'bandpass',
      freq: 260 * low, to: (900 + 2200 * k) * low, q: 1.4, attack: 0.03,
    })
    window.setTimeout(() => dest.disconnect(), 900)
  }

  function buildHum(o: Out) {
    const c = o.ctx, t = c.currentTime
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.connect(o.out)
    const nodes: AudioScheduledSourceNode[] = []
    for (const [f, a] of [[55, 0.5], [82.4, 0.3], [110.3, 0.12]] as const) {
      const osc = c.createOscillator()
      osc.frequency.value = f
      const g = c.createGain()
      g.gain.value = a
      osc.connect(g).connect(gain)
      osc.start(t)
      nodes.push(osc)
    }
    // Dark noise, its filter breathing on a twenty-second cycle.
    const src = c.createBufferSource()
    src.buffer = noise(c)
    src.loop = true
    const f = c.createBiquadFilter()
    f.type = 'lowpass'; f.frequency.value = 240; f.Q.value = 0.6
    const ng = c.createGain()
    ng.gain.value = 0.9
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.05
    const depth = c.createGain()
    depth.gain.value = 120
    lfo.connect(depth).connect(f.frequency)
    src.connect(f).connect(ng).connect(gain)
    src.start(t); lfo.start(t)
    nodes.push(src, lfo)
    return { gain, nodes }
  }

  /** Keep the hum going (true) or let it fall away (false). */
  function ambience(on: boolean) {
    const o = output()
    if (!o) return
    if (!hum && on) hum = buildHum(o)
    if (!hum) return
    hum.gain.gain.setTargetAtTime(on ? 0.035 : 0, o.ctx.currentTime, on ? 1.2 : 0.25)
  }

  return { impact, launch, ambience }
}

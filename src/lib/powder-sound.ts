/**
 * What the tank sounds like.
 *
 * A sandbox you can only watch is half there. So the world is listened to a
 * few times a second — how much is burning, how much lava there is, how much
 * water and how many grains are actually moving, how much steam is coming off
 * — and five looping voices follow those numbers: fire crackles, lava rumbles
 * and now and then bubbles, running water babbles, falling sand hisses, steam
 * sighs. Pour sand and you hear it; let it settle and it goes quiet; set a
 * forest alight and the crackle grows with the fire.
 *
 * Every voice goes through the site's master, so all of it is behind the same
 * mute, and nothing is built until sound has been unlocked by a touch.
 */
import { output } from './audio'
import { FIRE, LAVA, STEAM, SMOKE } from './powder-rules'
import { TYPE, type World } from './powder-sim'

export type Heard = { fire: number; lava: number; water: number; grains: number; steam: number }

/** Count what is making a sound: burning, molten, and what moved this step. */
export function listen(w: World): Heard {
  const h: Heard = { fire: 0, lava: 0, water: 0, grains: 0, steam: 0 }
  const g = w.grid, m = w.moved
  for (let i = 0; i < g.length; i++) {
    const id = g[i]
    if (id === 0) continue
    if (id === FIRE) h.fire++
    else if (id === LAVA) { h.lava++; if (m[i]) h.water += 0.2 }
    else if (id === STEAM || id === SMOKE) h.steam++
    else if (m[i]) {
      const k = TYPE[id]
      if (k === 2) h.water++
      else if (k === 1) h.grains++
    }
  }
  return h
}

type Voice = { src: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode; lfo?: OscillatorNode }

let crackleBuf: AudioBuffer | null = null
let noiseBuf: AudioBuffer | null = null
function crackle(c: AudioContext) {
  if (crackleBuf && crackleBuf.sampleRate === c.sampleRate) return crackleBuf
  const n = Math.floor(c.sampleRate * 3)
  crackleBuf = c.createBuffer(1, n, c.sampleRate)
  const d = crackleBuf.getChannelData(0)
  let ring = 0
  for (let i = 0; i < n; i++) {
    // Pops of uneven size, the wood's sap and air letting go.
    if (Math.random() < 0.0016) ring = (Math.random() * 2 - 1) * (0.5 + Math.random() * 2.2)
    ring *= 0.9
    d[i] = ring + (Math.random() * 2 - 1) * 0.06
  }
  return crackleBuf
}
function noise(c: AudioContext) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf
  const n = Math.floor(c.sampleRate * 3)
  noiseBuf = c.createBuffer(1, n, c.sampleRate)
  const d = noiseBuf.getChannelData(0)
  // Pink-ish: a running sum leaks the high end away, so it rushes rather than hisses.
  let b = 0
  for (let i = 0; i < n; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.3; d[i] = b }
  return noiseBuf
}

export function createAmbience() {
  let voices: Record<keyof Heard, Voice> | null = null
  let nextBloop = 0

  function build() {
    const o = output()
    if (!o) return null
    const c = o.ctx, t = c.currentTime
    const voice = (buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number, wobble = 0): Voice => {
      const src = c.createBufferSource()
      src.buffer = buf
      src.loop = true
      const f = c.createBiquadFilter()
      f.type = type; f.frequency.value = freq; f.Q.value = q
      const g = c.createGain()
      g.gain.setValueAtTime(0, t)
      src.connect(f).connect(g).connect(o.out)
      src.start(t, Math.random() * 2)
      let lfo: OscillatorNode | undefined
      if (wobble) {
        // A babble: the filter wanders, so running water is never one note.
        lfo = c.createOscillator()
        lfo.frequency.value = 5.3
        const depth = c.createGain()
        depth.gain.value = wobble
        lfo.connect(depth).connect(f.frequency)
        lfo.start(t)
      }
      return { src, f, g, lfo }
    }
    return {
      fire: voice(crackle(c), 'bandpass', 2400, 0.6),
      lava: voice(noise(c), 'lowpass', 150, 0.9),
      water: voice(noise(c), 'bandpass', 900, 1.1, 380),
      grains: voice(noise(c), 'bandpass', 4200, 0.9),
      steam: voice(noise(c), 'highpass', 4800, 0.7),
    }
  }

  /** Follow what the tank is doing. Called a few times a second. */
  function update(h: Heard) {
    const o = output()
    if (!o) return
    if (!voices) voices = build()
    if (!voices) return
    const t = o.ctx.currentTime
    const level = (n: number, k: number) => Math.min(1, Math.sqrt(n) / k)
    const set = (v: Voice, g: number) => v.g.gain.setTargetAtTime(g, t, 0.18)
    set(voices.fire, level(h.fire, 26) * 0.42)
    set(voices.lava, level(h.lava, 40) * 0.5)
    set(voices.water, level(h.water, 22) * 0.22)
    set(voices.grains, level(h.grains, 24) * 0.12)
    set(voices.steam, level(h.steam, 40) * 0.06)
    // Lava bubbles: a slow, low bloop now and then, more often the more there is.
    if (h.lava > 20 && t > nextBloop) {
      const osc = o.ctx.createOscillator(), g = o.ctx.createGain()
      const f0 = 90 + Math.random() * 60
      osc.frequency.setValueAtTime(f0, t)
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.18)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12 * level(h.lava, 40), t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      osc.connect(g).connect(o.out)
      osc.start(t); osc.stop(t + 0.25)
      osc.onended = () => { osc.disconnect(); g.disconnect() }
      nextBloop = t + 0.4 + Math.random() * 2.4 / Math.max(0.3, level(h.lava, 40))
    }
  }

  /** Everything quiet: paused, frozen, or the page out of sight. */
  function hush() {
    const o = output()
    if (!o || !voices) return
    const t = o.ctx.currentTime
    for (const v of Object.values(voices)) v.g.gain.setTargetAtTime(0, t, 0.12)
  }

  return { update, hush }
}

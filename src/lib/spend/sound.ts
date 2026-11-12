/**
 * What money sounds like when it moves.
 *
 * Paper money is paper: a note is a flick and a snap, a bundle run through a
 * counting machine is a fast flutter of clicks, a shrink-wrapped brick lands
 * with a dull plastic thump, and a pallet of a million notes is lifted with a
 * low groan of hydraulics. So a purchase sounds like the size of what it takes
 * — a latte is a flick, a car is a counter's run, a cruise ship is a forklift — and
 * selling it back is the same weight set down again.
 *
 * Everything goes through the site's master, behind the same mute.
 */
import { output } from '../audio'

type Out = { ctx: AudioContext; out: AudioNode }

let paperBuf: AudioBuffer | null = null
/** Paper: sparse sharp clicks over a soft bed, the grain of a note moving. */
function paper(c: AudioContext) {
  if (paperBuf && paperBuf.sampleRate === c.sampleRate) return paperBuf
  const n = Math.floor(c.sampleRate * 2)
  paperBuf = c.createBuffer(1, n, c.sampleRate)
  const d = paperBuf.getChannelData(0)
  let ring = 0
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.004) ring = (Math.random() * 2 - 1) * (0.7 + Math.random() * 1.5)
    ring *= 0.8
    d[i] = (Math.random() * 2 - 1) * 0.3 + ring
  }
  return paperBuf
}

function noise(o: Out, at: number, dur: number, gain: number, f: { type?: BiquadFilterType; freq: number; to?: number; q?: number }, attack = 0.004, rate = 1) {
  const c = o.ctx
  const src = c.createBufferSource()
  src.buffer = paper(c)
  src.playbackRate.value = rate
  const fl = c.createBiquadFilter()
  fl.type = f.type ?? 'bandpass'
  fl.Q.value = f.q ?? 0.8
  fl.frequency.setValueAtTime(f.freq, at)
  if (f.to) fl.frequency.exponentialRampToValueAtTime(f.to, at + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(fl).connect(g).connect(o.out)
  src.start(at, Math.random() * 1.5)
  src.stop(at + dur + 0.05)
  src.onended = () => { src.disconnect(); fl.disconnect(); g.disconnect() }
}

function tone(o: Out, at: number, dur: number, gain: number, freq: number, to: number, type: OscillatorType = 'sine', attack = 0.006) {
  const c = o.ctx
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(g).connect(o.out)
  osc.start(at)
  osc.stop(at + dur + 0.05)
  osc.onended = () => { osc.disconnect(); g.disconnect() }
}

/** A counting machine: a run of clicks, `n` of them, fast. */
function riffle(o: Out, at: number, n: number, gain: number) {
  let t = at
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(1, n - 1)
    // The machine spins up and down: the middle of the run is the fastest.
    t += 0.016 + 0.012 * Math.abs(k - 0.5) * 2
    noise(o, t, 0.012, gain * (0.6 + 0.4 * Math.sin(Math.PI * k)), { freq: 3200 + Math.random() * 900, q: 1.4 })
  }
  // The motor under it.
  tone(o, at, t - at + 0.05, gain * 0.12, 95, 90, 'triangle', 0.03)
  return t
}

export function createCashSound() {
  /** The sound of `dollars` being taken away. */
  function take(dollars: number) {
    const o = output()
    if (!o || dollars <= 0) return
    const at = o.ctx.currentTime + 0.005
    if (dollars < 10_000) {
      // A few notes: picked up with a flick.
      noise(o, at, 0.07, 0.22, { freq: 2600, to: 4800, q: 0.9 })
      noise(o, at + 0.05, 0.05, 0.12, { type: 'highpass', freq: 3800 })
    } else if (dollars < 1_000_000) {
      // Bundles: a run through the counter, longer for more of them.
      const n = Math.round(8 + 10 * Math.min(1, Math.log10(dollars / 10_000) / 2))
      riffle(o, at, n, 0.2)
    } else if (dollars < 100_000_000) {
      // Bricks: a counter's run, and the wrapped weight picked up.
      tone(o, at, 0.12, 0.28, 120, 70)
      noise(o, at, 0.12, 0.16, { freq: 900, to: 500, q: 0.7 }, 0.004, 0.8)
      riffle(o, at + 0.08, 14, 0.15)
    } else {
      // Pallets: hydraulics taking the weight, and a low groan as it lifts.
      const k = Math.min(1, Math.log10(dollars / 1e8) / 2.6)
      const dur = 0.7 + 0.8 * k
      tone(o, at, dur, 0.1 + 0.08 * k, 140, 210, 'sawtooth', 0.12)
      noise(o, at, dur, 0.22 + 0.1 * k, { type: 'lowpass', freq: 140, to: 320, q: 0.9 }, 0.15, 0.5)
      tone(o, at, 0.3, 0.3, 60, 38)
      // Film and wood creaking under the load.
      for (let i = 0; i < 4; i++) noise(o, at + 0.12 + i * (0.1 + Math.random() * 0.1), 0.05, 0.08, { freq: 700 + Math.random() * 500, q: 5 }, 0.004, 0.7)
    }
  }

  /** The sound of `dollars` being put back down. */
  function put(dollars: number) {
    const o = output()
    if (!o || dollars <= 0) return
    const at = o.ctx.currentTime + 0.02
    const k = Math.min(1, Math.log10(Math.max(1, dollars)) / 11)
    // Set down: heavier and lower for more of it, with a papery slap on top.
    tone(o, at + 0.3, 0.12 + 0.25 * k, 0.12 + 0.3 * k, 150 - 90 * k, 60 - 25 * k)
    noise(o, at + 0.3, 0.06 + 0.1 * k, 0.15, { freq: 2200 - 1500 * k, q: 0.7 })
  }

  return { take, put }
}

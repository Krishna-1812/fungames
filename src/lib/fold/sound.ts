/**
 * The sounds a sheet of paper makes while you fold it.
 *
 * Paper crackles rather than hisses: a sheet moving is thousands of tiny
 * fibres catching and letting go, so what you hear is a spray of clicks over
 * a soft wash. Every sound here starts from that crackle, shaped by how hard
 * the paper is to move. A fresh sheet is light and bright. A stack many folds
 * thick is stiff, so it sounds lower, heavier and slower, and when it will not
 * go any further it creaks.
 *
 *   - drag:   the rustle while the flap is lifted, as loud as it is moving fast;
 *   - crease: the flap landing, then a fingernail run along the new edge;
 *   - creak:  the stack refusing, in uneven stiff ticks;
 *   - unfold: a soft swish as it opens out.
 *
 * `stiff` is 0 for a single sheet and 1 for a stack at its real limit. All of
 * it goes through the site's master, so it is behind the same mute as
 * everything else and silent until sound is on.
 */
import { output } from '../audio'

let crackleBuf: AudioBuffer | null = null
/** Crackle: sparse clicks of uneven strength over a low bed of noise. */
function crackle(c: AudioContext) {
  if (crackleBuf && crackleBuf.sampleRate === c.sampleRate) return crackleBuf
  const n = Math.floor(c.sampleRate * 2.3)
  crackleBuf = c.createBuffer(1, n, c.sampleRate)
  const d = crackleBuf.getChannelData(0)
  let ring = 0
  for (let i = 0; i < n; i++) {
    // A fibre letting go: a click that rings for a few samples.
    if (Math.random() < 0.0035) ring = (Math.random() * 2 - 1) * (0.6 + Math.random() * 1.8)
    ring *= 0.82
    d[i] = (Math.random() * 2 - 1) * 0.28 + ring
  }
  return crackleBuf
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** One shot of shaped crackle. */
function burst(o: { ctx: AudioContext; out: AudioNode }, at: number, opt: {
  dur: number; gain: number; freq: number; to?: number; q?: number; type?: BiquadFilterType; attack?: number; rate?: number
}) {
  const c = o.ctx
  const src = c.createBufferSource()
  src.buffer = crackle(c)
  src.playbackRate.value = opt.rate ?? 1
  const f = c.createBiquadFilter()
  f.type = opt.type ?? 'bandpass'
  f.Q.value = opt.q ?? 0.9
  f.frequency.setValueAtTime(opt.freq, at)
  if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, at + opt.dur)
  const g = c.createGain()
  const atk = opt.attack ?? 0.004
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opt.gain), at + atk)
  g.gain.exponentialRampToValueAtTime(0.0001, at + opt.dur)
  src.connect(f).connect(g).connect(o.out)
  src.start(at, Math.random() * 1.8)
  src.stop(at + opt.dur + 0.05)
  src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect() }
}

/** A low, short body: the weight of the paper meeting the paper under it. */
function thud(o: { ctx: AudioContext; out: AudioNode }, at: number, freq: number, gain: number, dur: number) {
  const c = o.ctx
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, at)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, at + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(g).connect(o.out)
  osc.start(at)
  osc.stop(at + dur + 0.05)
  osc.onended = () => { osc.disconnect(); g.disconnect() }
}

type Voice = { src: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode }

export function createPaperSound() {
  let v: Voice | null = null

  /**
   * The rustle while the flap moves.
   * @param rate  how fast the fold is turning, in whole folds per second
   * @param stiff 0 (one sheet) to 1 (a stack at its limit)
   */
  function drag(rate: number, stiff: number) {
    const o = output()
    if (!o) return
    const c = o.ctx, t = c.currentTime
    if (!v) {
      const src = c.createBufferSource()
      src.buffer = crackle(c)
      src.loop = true
      const f = c.createBiquadFilter()
      f.type = 'bandpass'; f.Q.value = 0.7
      const g = c.createGain(); g.gain.setValueAtTime(0, t)
      src.connect(f).connect(g).connect(o.out)
      src.start(t, Math.random() * 2)
      v = { src, f, g }
    }
    const s = clamp(Math.abs(rate) / 3, 0, 1)
    const k = clamp(stiff, 0, 1)
    v.g.gain.setTargetAtTime(Math.sqrt(s) * (0.16 - 0.05 * k), t, 0.03)
    v.f.frequency.setTargetAtTime((3600 - 2000 * k) * (0.7 + 0.5 * s), t, 0.05)
    // A stiff stack's fibres let go more slowly: a lower, coarser crackle.
    v.src.playbackRate.setTargetAtTime(1 - 0.35 * k + 0.25 * s, t, 0.05)
  }

  /** The hand lets go: the rustle stops. */
  function release() {
    const o = output()
    if (!o || !v) { v = null; return }
    const t = o.ctx.currentTime
    const done = v
    done.g.gain.setTargetAtTime(0, t, 0.025)
    done.src.stop(t + 0.2)
    done.src.onended = () => { done.src.disconnect(); done.f.disconnect(); done.g.disconnect() }
    v = null
  }

  /** The flap lands and the crease is pressed down. */
  function crease(stiff: number) {
    const o = output()
    if (!o) return
    const t = o.ctx.currentTime + 0.005, k = clamp(stiff, 0, 1)
    // The landing: a sharp crack, heavier as the stack thickens.
    burst(o, t, { dur: 0.05 + 0.05 * k, gain: 0.34, freq: 2800 - 1500 * k, q: 0.8, rate: 1 - 0.3 * k })
    thud(o, t, 150 - 60 * k, 0.12 + 0.2 * k, 0.07 + 0.1 * k)
    // A fingernail along the new edge: a quick bright run.
    burst(o, t + 0.09, { dur: 0.16, gain: 0.13, freq: 1800 - 600 * k, to: 4400 - 1400 * k, q: 1.6, attack: 0.03 })
  }

  /** The stack will not bend that far: stiff, uneven ticks, lower as it thickens. */
  function creak(stiff: number) {
    const o = output()
    if (!o) return
    const k = clamp(stiff, 0, 1)
    let at = o.ctx.currentTime + 0.005
    const ticks = 7 + Math.round(5 * k)
    for (let i = 0; i < ticks; i++) {
      const fade = 1 - i / ticks
      burst(o, at, { dur: 0.022, gain: 0.2 * fade + 0.04, freq: (1100 - 450 * k) * (0.92 + Math.random() * 0.16), q: 7, rate: 0.8 })
      at += 0.018 + Math.random() * 0.03 + 0.012 * k
    }
    thud(o, o.ctx.currentTime + 0.005, 90 - 25 * k, 0.1 + 0.08 * k, 0.22)
  }

  /** It opens out: a soft swish. */
  function unfold(stiff: number) {
    const o = output()
    if (!o) return
    const k = clamp(stiff, 0, 1)
    burst(o, o.ctx.currentTime + 0.005, { dur: 0.24, gain: 0.12, freq: 4200 - 1600 * k, to: 1500 - 500 * k, q: 0.8, attack: 0.05 })
  }

  return { drag, release, crease, creak, unfold }
}

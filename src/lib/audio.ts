/**
 * A tiny synthesiser shared by every game.
 *
 * Everything is generated in the Web Audio graph — there is not a single audio
 * file on this site. That keeps pages in the kilobytes, means nothing has to be
 * licensed, and lets sounds take parameters, so a "pop" can rise in pitch as a
 * combo builds instead of being the same 200 ms clip forever.
 *
 * Browsers refuse to start audio without a gesture, so the context is created
 * lazily on the first real interaction and every call is a no-op until then.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
const MUTE_KEY = 'sound:muted'

try {
  muted = localStorage.getItem(MUTE_KEY) === '1'
} catch {
  /* private mode — default to sound on */
}

function ac(): AudioContext | null {
  if (ctx) return ctx
  const C = window.AudioContext || (window as any).webkitAudioContext
  if (!C) return null
  ctx = new C()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 0.9
  master.connect(ctx.destination)
  return ctx
}

/** Call from any pointerdown/keydown so the first sound is not swallowed. */
export function unlock() {
  const c = ac()
  if (c && c.state === 'suspended') void c.resume()
}

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try { localStorage.setItem(MUTE_KEY, next ? '1' : '0') } catch {}
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.02)
}

export function toggleMute() {
  setMuted(!muted)
  return muted
}

type ToneOpts = {
  /** Starting frequency in Hz. */
  freq: number
  /** Optional glide target. */
  to?: number
  dur?: number
  type?: OscillatorType
  gain?: number
  /** Seconds from now. */
  delay?: number
  /** Low-pass cutoff; omit for none. */
  filter?: number
  /** Detune a second oscillator by this many cents for thickness. */
  detune?: number
}

/** One enveloped oscillator. The building block for most of the kit. */
export function tone({
  freq, to, dur = 0.18, type = 'sine', gain = 0.25, delay = 0, filter, detune,
}: ToneOpts) {
  const c = ac()
  if (!c || !master) return
  const t = c.currentTime + delay

  const g = c.createGain()
  // Exponential ramps cannot touch zero, hence the tiny floor values.
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.min(0.015, dur * 0.25))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  let node: AudioNode = g
  if (filter) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = filter
    g.connect(f)
    node = f
  }
  node.connect(master)

  const mk = (cents = 0) => {
    const o = c.createOscillator()
    o.type = type
    o.detune.value = cents
    o.frequency.setValueAtTime(freq, t)
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
    o.connect(g)
    o.start(t)
    o.stop(t + dur + 0.03)
  }
  mk(0)
  if (detune) mk(detune)
}

let noiseBuf: AudioBuffer | null = null
function noise(c: AudioContext) {
  if (noiseBuf) return noiseBuf
  const len = c.sampleRate * 2
  noiseBuf = c.createBuffer(1, len, c.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

type NoiseOpts = {
  dur?: number
  gain?: number
  freq?: number
  q?: number
  type?: BiquadFilterType
  delay?: number
  /** Sweep the filter to this frequency across the sound. */
  sweepTo?: number
}

/** Filtered noise: impacts, whooshes, fizzes, rumbles. */
export function hit({
  dur = 0.12, gain = 0.3, freq = 1200, q = 1, type = 'bandpass', delay = 0, sweepTo,
}: NoiseOpts = {}) {
  const c = ac()
  if (!c || !master) return
  const t = c.currentTime + delay

  const src = c.createBufferSource()
  src.buffer = noise(c)
  src.loop = true

  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t + dur)
  f.Q.value = q

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.min(0.01, dur * 0.2))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  src.connect(f).connect(g).connect(master)
  src.start(t)
  src.stop(t + dur + 0.05)
}

// A pentatonic scale, so stacked or rapid notes never sound wrong together.
const PENTA = [0, 2, 4, 7, 9]
export function scaleFreq(step: number, root = 220) {
  const oct = Math.floor(step / PENTA.length)
  const semis = PENTA[((step % PENTA.length) + PENTA.length) % PENTA.length] + oct * 12
  return root * Math.pow(2, semis / 12)
}

/** The shared kit. Named by feel rather than by waveform. */
export const sfx = {
  click: () => hit({ dur: 0.035, gain: 0.22, freq: 2600, q: 6 }),
  tick: () => hit({ dur: 0.02, gain: 0.14, freq: 4200, q: 10 }),
  /** Rises with `n` — use for combos and streaks. */
  pop: (n = 0) => tone({ freq: scaleFreq(n), to: scaleFreq(n) * 1.6, dur: 0.13, type: 'triangle', gain: 0.24 }),
  blip: (n = 0) => tone({ freq: scaleFreq(n, 440), dur: 0.09, type: 'square', gain: 0.12, filter: 2600 }),
  good: () => { tone({ freq: 523, dur: 0.16, type: 'triangle', gain: 0.2 }); tone({ freq: 784, dur: 0.22, type: 'triangle', gain: 0.16, delay: 0.07 }) },
  great: () => [0, 4, 7, 12].forEach((s, i) => tone({ freq: 392 * Math.pow(2, s / 12), dur: 0.3, type: 'triangle', gain: 0.16, delay: i * 0.06 })),
  bad: () => tone({ freq: 180, to: 90, dur: 0.28, type: 'sawtooth', gain: 0.18, filter: 900 }),
  thud: () => { tone({ freq: 120, to: 44, dur: 0.22, type: 'sine', gain: 0.4 }); hit({ dur: 0.09, gain: 0.18, freq: 260, type: 'lowpass' }) },
  whoosh: () => hit({ dur: 0.34, gain: 0.16, freq: 300, sweepTo: 2400, q: 0.7 }),
  fizz: () => hit({ dur: 0.5, gain: 0.1, freq: 3000, sweepTo: 700, q: 0.6 }),
  boom: () => {
    tone({ freq: 90, to: 28, dur: 1.1, type: 'sine', gain: 0.6 })
    hit({ dur: 1.4, gain: 0.4, freq: 420, sweepTo: 60, type: 'lowpass', q: 0.6 })
    hit({ dur: 0.25, gain: 0.3, freq: 2600, sweepTo: 400, q: 0.5 })
  },
  sparkle: () => [0, 3, 5].forEach((s, i) => tone({ freq: 1200 * Math.pow(2, s / 12), dur: 0.14, type: 'sine', gain: 0.08, delay: i * 0.04 })),
  drip: () => tone({ freq: 900, to: 380, dur: 0.13, type: 'sine', gain: 0.16 }),
  zap: () => { tone({ freq: 2200, to: 160, dur: 0.16, type: 'sawtooth', gain: 0.16, filter: 3000 }); hit({ dur: 0.1, gain: 0.14, freq: 3400, q: 2 }) },
}

// Drawn rather than an emoji: an emoji renders in its own colours, so it
// cannot inherit the chrome's ink and cannot be checked for contrast.
const SPEAKER = '<path d="M4 7h3l4-3.5v13L7 13H4z"/>'
const WAVES = '<path d="M13.5 6.5a4 4 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
const CROSS = '<path d="M13.5 7.5l4 5M17.5 7.5l-4 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'

/** A speaker button every game drops into its chrome. */
export function mountMuteButton(host: HTMLElement | null) {
  if (!host) return
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'sound-toggle'
  const paint = () => {
    btn.innerHTML =
      '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" focusable="false" fill="currentColor">' +
      SPEAKER + (muted ? CROSS : WAVES) + '</svg>'
    btn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off')
    btn.setAttribute('aria-pressed', String(!muted))
    btn.classList.toggle('is-muted', muted)
  }
  paint()
  btn.addEventListener('click', () => { unlock(); toggleMute(); paint(); if (!muted) sfx.click() })
  host.prepend(btn)
  return btn
}

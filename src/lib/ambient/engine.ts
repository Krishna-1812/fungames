/**
 * Ambient Mix's audio graph, on the page's side.
 *
 *   worklet ─┬─ layer gain ─┬─────────── bus ──┐
 *   (one     │  (the knob)  └─ send ─ room ─ wet ┤
 *   output   │                                   ├─ limiter ─ master ─ speakers
 *   per      ⋮                                   │
 *   layer)                                       ┘
 *
 * The layers' physical models run in an AudioWorklet (worklet.ts). Each has
 * its own gain — the knob on its card — and sends a little of itself to one
 * shared room, a convolution reverb whose impulse response is made here: a
 * short pre-delay, a few early reflections, and a tail that darkens as it
 * dies, because air and soft surfaces absorb the highs first. A limiter
 * before the master keeps "every layer at once" loud rather than broken.
 *
 * Where AudioWorklet is missing (an old browser, or a page served over plain
 * http, where worklets are not allowed), the same models run in
 * ScriptProcessorNodes on the main thread instead. It is the same sound,
 * only less robust under load.
 */
import { createSource, Rng, SEND, type Source } from './index'
import workletUrl from './worklet.ts?worker&url'

export type EngineEvent = { id: string; kind: string; at: number } & Record<string, number | string>

export type Engine = {
  ctx: AudioContext
  /** Master volume. */
  master: GainNode
  /** A tap on the master, for the picture. */
  analyser: AnalyserNode
  layers: Map<string, { gain: GainNode; analyser: AnalyserNode }>
  setOn(id: string, on: boolean): void
  /** The slow values the picture follows, by layer, refreshed every 50 ms. */
  state: Record<string, Record<string, number>>
  onEvent: ((e: EngineEvent) => void) | null
  /** The audio clock's time as it reaches the ears, allowing for output latency. */
  heard(): number
}

/** Local wall-clock seconds (epoch, in the visitor's zone) minus audio time. */
function wallOffset(ctx: AudioContext): number {
  const ts = ctx.getOutputTimestamp?.()
  const tz = new Date().getTimezoneOffset() * 60
  if (ts && ts.performanceTime && ts.contextTime !== undefined) {
    return (performance.timeOrigin + ts.performanceTime) / 1000 - tz - ts.contextTime
  }
  return Date.now() / 1000 - tz - ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0)
}

/** A room: pre-delay, early reflections, and a tail that darkens as it dies. */
function roomImpulse(ctx: BaseAudioContext, seconds = 2.2, rt60 = 1.6): AudioBuffer {
  const sr = ctx.sampleRate
  const n = Math.floor(seconds * sr)
  const buf = ctx.createBuffer(2, n, sr)
  const pre = Math.floor(0.012 * sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    const rng = new Rng(97 + ch * 31)
    let lp = 0
    let a = 1
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr
      if ((i & 63) === 0) a = 1 - Math.exp((-2 * Math.PI * (1200 + 8500 * Math.exp(-t * 1.6))) / sr)
      lp += a * (rng.bi() - lp)
      d[i] = lp * Math.exp((-6.9 * t) / rt60)
    }
    // Early reflections: the nearest walls, a little different in each ear.
    for (let k = 0; k < 7; k++) {
      const at = pre + Math.floor((0.006 + rng.next() * 0.055) * sr)
      d[at] += (rng.chance(0.5) ? 1 : -1) * (0.55 - k * 0.06)
    }
  }
  return buf
}

export async function createEngine(ids: string[], masterLevel: number): Promise<Engine> {
  const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  // "playback": bigger buffers, so a busy phone does not crackle. A mixer
  // does not need the snappiness of a game.
  const ctx = new AC({ latencyHint: 'playback' })

  const master = ctx.createGain()
  master.gain.value = masterLevel
  master.connect(ctx.destination)
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 6
  limiter.ratio.value = 20
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  limiter.connect(master)
  const bus = ctx.createGain()
  bus.connect(limiter)
  const room = ctx.createConvolver()
  room.buffer = roomImpulse(ctx)
  const wet = ctx.createGain()
  wet.gain.value = 0.6
  room.connect(wet).connect(limiter)

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 128
  analyser.smoothingTimeConstant = 0.75
  master.connect(analyser)

  const layers = new Map<string, { gain: GainNode; analyser: AnalyserNode }>()
  for (const id of ids) {
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(bus)
    const send = ctx.createGain()
    send.gain.value = SEND[id] ?? 0.1
    gain.connect(send).connect(room)
    const an = ctx.createAnalyser()
    an.fftSize = 64
    an.smoothingTimeConstant = 0.7
    gain.connect(an)
    layers.set(id, { gain, analyser: an })
  }

  const engine: Engine = {
    ctx, master, analyser, layers,
    state: {},
    onEvent: null,
    setOn: () => {},
    heard: () => ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0),
  }
  const seed = (Math.random() * 2 ** 32) >>> 0

  if (ctx.audioWorklet) {
    await ctx.audioWorklet.addModule(workletUrl)
    const node = new AudioWorkletNode(ctx, 'ambient-mix', {
      numberOfInputs: 0,
      numberOfOutputs: ids.length,
      outputChannelCount: ids.map(() => 2),
      processorOptions: { ids, seed },
    })
    ids.forEach((id, k) => node.connect(layers.get(id)!.gain, k, 0))
    node.port.onmessage = (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'state') engine.state = m.state
      else if (m.type === 'ev') engine.onEvent?.(m)
    }
    const sync = () => node.port.postMessage({ type: 'wall', offset: wallOffset(ctx) })
    sync()
    setInterval(sync, 10_000)
    engine.setOn = (id, on) => node.port.postMessage({ type: 'on', id, on })
  } else {
    // The same models on the main thread.
    let wall = wallOffset(ctx)
    setInterval(() => { wall = wallOffset(ctx) }, 10_000)
    const live = new Map<string, Source>()
    engine.setOn = (id, on) => {
      if (!on || live.has(id)) return
      const src = createSource(id, {
        sr: ctx.sampleRate, rng: new Rng(seed ^ id.length * 7919),
        emit: (kind, at, data) => engine.onEvent?.({ id, kind, at, ...data } as EngineEvent),
        wall: () => wall,
      })
      live.set(id, src)
      const sp = ctx.createScriptProcessor(4096, 1, 2)
      sp.onaudioprocess = (e) => {
        const l = e.outputBuffer.getChannelData(0), r = e.outputBuffer.getChannelData(1)
        src.render(l, r, l.length, e.playbackTime)
      }
      sp.connect(layers.get(id)!.gain)
    }
    setInterval(() => {
      const state: Record<string, Record<string, number>> = {}
      for (const [id, s] of live) if (s.state) state[id] = s.state()
      engine.state = state
    }, 50)
  }
  return engine
}

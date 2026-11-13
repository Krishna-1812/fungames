/**
 * The AudioWorklet that plays Ambient Mix.
 *
 * Every layer's physical model (lib/ambient/*) runs here, on the audio
 * thread, one stereo output per layer, so the page's own work — drawing,
 * layout, a slow phone — can never make the sound stutter. The page turns
 * layers on and off and sets the wall clock; this sends back what happened
 * (a wave broke, lightning struck, a car set off) and, every 50 ms, the slow
 * values the picture follows (the wind's speed, the fire's flicker).
 *
 * A layer's model is built the first time it is switched on and kept after,
 * so turning one off and on again carries on where it was. Once off and
 * faded, it stops being computed at all.
 */
import { createSource, Rng, type Source } from './index'

declare const sampleRate: number
declare const currentTime: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor(options?: unknown)
}
declare function registerProcessor(name: string, ctor: unknown): void

type Slot = { id: string; src: Source | null; on: boolean; tail: number }

/** A stable small number from a layer id, so each layer gets its own seed. */
const hashId = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

class AmbientProcessor extends AudioWorkletProcessor {
  slots: Slot[]
  seed: number
  wall = 0
  lastState = 0

  constructor(options: { processorOptions: { ids: string[]; seed: number } }) {
    super(options)
    this.slots = options.processorOptions.ids.map((id) => ({ id, src: null, on: false, tail: 0 }))
    this.seed = options.processorOptions.seed >>> 0
    this.port.onmessage = (e: MessageEvent) => this.message(e.data)
  }

  message(m: { type: string; id?: string; on?: boolean; offset?: number }) {
    if (m.type === 'wall' && typeof m.offset === 'number') this.wall = m.offset
    if (m.type !== 'on') return
    const s = this.slots.find((x) => x.id === m.id)
    if (!s) return
    s.on = !!m.on
    if (s.on && !s.src) {
      const id = s.id
      s.src = createSource(id, {
        sr: sampleRate,
        rng: new Rng((this.seed ^ hashId(id)) >>> 0),
        emit: (kind, at, data) => this.port.postMessage({ type: 'ev', id, kind, at, ...data }),
        wall: () => this.wall,
      })
    }
    // Keep computing for a while after "off", so the fade-out is heard.
    if (!s.on) s.tail = 1.5
  }

  process(_in: Float32Array[][], outputs: Float32Array[][]) {
    const t = currentTime
    for (let k = 0; k < this.slots.length; k++) {
      const s = this.slots[k]
      const out = outputs[k]
      if (!out || !out[0]) continue
      const l = out[0], r = out[1] ?? out[0]
      if (!s.src || (!s.on && s.tail <= 0)) {
        l.fill(0)
        if (r !== l) r.fill(0)
        continue
      }
      if (!s.on) s.tail -= l.length / sampleRate
      s.src.render(l, r, l.length, t)
    }
    if (t - this.lastState >= 0.05) {
      this.lastState = t
      const state: Record<string, Record<string, number>> = {}
      for (const s of this.slots) if (s.src && s.on && s.src.state) state[s.id] = s.src.state()
      this.port.postMessage({ type: 'state', t, state })
    }
    return true
  }
}

registerProcessor('ambient-mix', AmbientProcessor)

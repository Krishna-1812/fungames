/**
 * The sound of a pencil on paper.
 *
 * A pencil is never silent. The lead drags over the paper's tooth and every
 * bump it crosses is a tiny scrape, so what you hear is noise, shaped by two
 * things you can feel through the pencil: how fast it is moving (faster is
 * louder, and brighter, because more bumps go by each second) and how hard it
 * presses (harder is fuller, more of a rasp than a hiss). Lift it and there is
 * nothing.
 *
 * So this is one stretch of filtered noise per stroke, its loudness and
 * colour following the hand from moment to moment, smoothed so it breathes
 * rather than clicks. It goes through the site's master, so it is behind the
 * same mute as everything else and does nothing until sound is on.
 */
import { output } from '../audio'

let buffer: AudioBuffer | null = null
function grainNoise(c: AudioContext) {
  if (buffer && buffer.sampleRate === c.sampleRate) return buffer
  const n = Math.floor(c.sampleRate * 1.7)
  buffer = c.createBuffer(1, n, c.sampleRate)
  const d = buffer.getChannelData(0)
  // Not quite white: the odd louder grain, the way a lead catches on a fibre.
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1
    d[i] = Math.random() < 0.012 ? w * 2.4 : w
  }
  return buffer
}

type Voice = { src: AudioBufferSourceNode; hiss: BiquadFilterNode; rasp: BiquadFilterNode; hissGain: GainNode; raspGain: GainNode }

export function createScratch() {
  let v: Voice | null = null

  function start() {
    const o = output()
    if (!o || v) return
    const c = o.ctx, t = c.currentTime
    const src = c.createBufferSource()
    src.buffer = grainNoise(c)
    src.loop = true
    src.playbackRate.value = 0.9 + Math.random() * 0.2
    // The hiss: the lead skating over the tops of the bumps.
    const hiss = c.createBiquadFilter()
    hiss.type = 'bandpass'; hiss.frequency.value = 3200; hiss.Q.value = 0.8
    const hissGain = c.createGain(); hissGain.gain.setValueAtTime(0, t)
    // The rasp: pressing into them.
    const rasp = c.createBiquadFilter()
    rasp.type = 'bandpass'; rasp.frequency.value = 1100; rasp.Q.value = 1.4
    const raspGain = c.createGain(); raspGain.gain.setValueAtTime(0, t)
    src.connect(hiss).connect(hissGain).connect(o.out)
    src.connect(rasp).connect(raspGain).connect(o.out)
    src.start(t, Math.random())
    v = { src, hiss, rasp, hissGain, raspGain }
  }

  /**
   * @param speed  how fast the pencil is moving, in page widths per second
   * @param weight how hard it is pressing, 0 to 1
   */
  function move(speed: number, weight: number) {
    const o = output()
    if (!o || !v) return
    const t = o.ctx.currentTime
    const s = Math.min(1, speed / 1.6)
    const loud = Math.sqrt(s)
    v.hissGain.gain.setTargetAtTime(loud * (0.1 + 0.05 * (1 - weight)), t, 0.025)
    v.raspGain.gain.setTargetAtTime(loud * (0.04 + 0.12 * weight), t, 0.03)
    v.hiss.frequency.setTargetAtTime(2400 + 3200 * s, t, 0.04)
    v.rasp.frequency.setTargetAtTime(800 + 700 * s + 300 * weight, t, 0.04)
  }

  /** Lift the pencil. */
  function stop() {
    const o = output()
    if (!o || !v) { v = null; return }
    const t = o.ctx.currentTime
    const done = v
    done.hissGain.gain.setTargetAtTime(0, t, 0.018)
    done.raspGain.gain.setTargetAtTime(0, t, 0.018)
    done.src.stop(t + 0.15)
    done.src.onended = () => { done.src.disconnect(); done.hissGain.disconnect(); done.raspGain.disconnect() }
    v = null
  }

  return { start, move, stop }
}

/**
 * A dial-up modem connecting — the real handshake, roughly to the standard.
 *
 * That sound was never noise for its own sake: it is two machines
 * negotiating over a phone line, and every part of it means something.
 *
 *   1. Dial tone: 350 + 440 Hz, the line saying it is ready.
 *   2. The number, in touch tones: each digit two frequencies at once, one
 *      from a low group (697, 770, 852, 941 Hz) and one from a high group
 *      (1209, 1336, 1477 Hz) — DTMF.
 *   3. Ringback: 440 + 480 Hz, the far end ringing.
 *   4. The answer: 2100 Hz, wobbling fifteen times a second, its phase
 *      flipping every 450 milliseconds — which tells any echo cancellers on
 *      the line to switch themselves off (ANSam, V.8).
 *   5. Introductions: both modems at once in slow frequency-shift keying —
 *      the caller at 980/1180 Hz and the answerer at 1650/1850 Hz, 300 bits
 *      a second (V.21), saying what they can each do.
 *   6. The "bong": line probing. A chord of tones every 150 Hz across the
 *      band, sent so the far end can measure exactly what the line does to
 *      each frequency (V.34).
 *   7. Training: the hiss. Scrambled data at full rate while each side tunes
 *      its equaliser to the line.
 *   8. Then silence — not because it has stopped, but because once it has
 *      connected the modem turns its speaker off.
 *
 * Everything goes through a telephone line's band (300–3400 Hz) and a small,
 * cheap speaker. After a while the connection drops, and it dials again.
 */
import { Svf, type Source, type SourceCtx } from './dsp'

const ROWS = [697, 770, 852, 941]
const KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10]
const COLS = [1209, 1336, 1477]
/** Tones of the line probe: every 150 Hz, a few left out as V.34 does. */
const PROBE = Array.from({ length: 25 }, (_, i) => 150 * (i + 1)).filter((f) => ![900, 1200, 1800, 2400].includes(f))

type Stage = { name: string; dur: number }

export function modem(c: SourceCtx): Source {
  const { sr, rng } = c
  const hp1 = new Svf().set(300, 0.7, sr), hp2 = new Svf().set(300, 0.7, sr)
  const lp1 = new Svf().set(3400, 0.7, sr), lp2 = new Svf().set(3400, 0.7, sr)
  const hissBp = new Svf().set(1800, 0.55, sr)
  const ph = new Float64Array(32)
  const probePh = PROBE.map(() => rng.next() * Math.PI * 2)

  let stages: Stage[] = []
  let digits: number[] = []
  let si = 0
  let st = 0
  let bits: number[] = []

  function plan() {
    // Keypad positions: 1-9 are 0-8, and 0 sits under 8 at 10.
    digits = Array.from({ length: 7 + rng.int(4) }, () => rng.pick(KEYS))
    bits = Array.from({ length: 30 }, () => rng.int(2))
    stages = [
      { name: 'quiet', dur: 0.4 },
      { name: 'dial', dur: 1.3 },
      { name: 'dtmf', dur: digits.length * 0.15 + 0.2 },
      { name: 'ring', dur: 1.9 },
      { name: 'quiet', dur: 0.35 },
      { name: 'answer', dur: 2.4 },
      { name: 'v21', dur: 1.05 },
      { name: 'probe', dur: 1.75 },
      { name: 'train', dur: 2.2 },
      { name: 'train2', dur: 1.3 },
      { name: 'connected', dur: rng.range(14, 26) },
    ]
    si = 0
    st = 0
  }
  plan()

  const sine = (k: number, f: number) => {
    ph[k] += (2 * Math.PI * f) / sr
    if (ph[k] > 1e4) ph[k] -= 2 * Math.PI * 1591
    return Math.sin(ph[k])
  }

  return {
    render(L, R, n, t) {
      for (let i = 0; i < n; i++) {
        const s = stages[si]
        let v = 0
        switch (s.name) {
          case 'dial':
            v = (sine(0, 350) + sine(1, 440)) * 0.16
            break
          case 'dtmf': {
            const k = Math.floor(st / 0.15)
            if (k < digits.length && st - k * 0.15 < 0.09) {
              const d = digits[k]
              v = (sine(2, ROWS[Math.floor(d / 3)]) + sine(3, COLS[d % 3])) * 0.18
            }
            break
          }
          case 'ring':
            v = (sine(4, 440) + sine(5, 480)) * 0.11
            break
          case 'answer': {
            // 2100 Hz, 15 Hz amplitude wobble, a phase flip every 450 ms.
            const flip = Math.floor(st / 0.45) % 2 ? Math.PI : 0
            ph[6] += (2 * Math.PI * 2100) / sr
            v = Math.sin(ph[6] + flip) * (1 + 0.2 * Math.sin(2 * Math.PI * 15 * st)) * 0.3
            break
          }
          case 'v21': {
            const b = bits[Math.floor(st * 300) % bits.length]
            const b2 = bits[(Math.floor(st * 300) + 11) % bits.length]
            v = (sine(7, b ? 980 : 1180) + sine(8, b2 ? 1650 : 1850)) * 0.17
            break
          }
          case 'probe': {
            if (st < 0.3) {
              // Tones A and B with phase reversals: the opening of the bong.
              const f = st < 0.15 ? 2400 : 1200
              const flip = Math.floor(st / 0.05) % 2 ? Math.PI : 0
              ph[9] += (2 * Math.PI * f) / sr
              v = Math.sin(ph[9] + flip) * 0.26
            } else {
              // L1 then L2: the chord, from one end and then the other.
              const u = st - 0.3
              const on = u < 0.16 || (u > 0.24 && u < 0.79) || (u > 0.9 && u < 1.45)
              if (on) {
                let sum = 0
                const tt = t + i / sr
                for (let j = 0; j < PROBE.length; j++) sum += Math.sin(2 * Math.PI * PROBE[j] * tt + probePh[j])
                v = sum * (u > 0.9 ? 0.03 : 0.045)
              }
            }
            break
          }
          case 'train':
          case 'train2': {
            const w = rng.bi()
            v = (hissBp.band(w) * 0.9 + w * 0.12) * (s.name === 'train' ? 0.42 : 0.34)
            // The odd framing click in the second half.
            if (s.name === 'train2' && st % 0.2 < 0.0012) v += 0.25
            break
          }
        }
        // Through the phone line and a small speaker.
        hp1.run(v); hp2.run(hp1.hp)
        lp1.run(hp2.hp); lp2.run(lp1.lp)
        const y = Math.tanh(lp2.lp * 1.6) * 0.7
        L[i] = y
        R[i] = y * 0.96
        st += 1 / sr
        if (st >= s.dur) {
          st = 0
          si++
          if (si >= stages.length) plan()
          c.emit('modem', t + i / sr, { stage: si })
        }
      }
    },
    state: () => ({ stage: si }),
  }
}

export const MODEM_STAGES = ['quiet', 'dial', 'dtmf', 'ring', 'quiet', 'answer', 'v21', 'probe', 'train', 'train2', 'connected']

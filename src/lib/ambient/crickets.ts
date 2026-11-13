/**
 * Crickets on a warm night — at a temperature you can read off them.
 *
 * A cricket chirps by drawing a scraper on one wing across a file of teeth on
 * the other, and the wing rings at its own frequency, so a chirp is a few
 * short, nearly pure pulses of tone, a few kilohertz up. A cricket is cold-
 * blooded: the warmer the night, the faster its muscles run and the faster
 * it chirps. In 1897 Amos Dolbear wrote the rate down as a formula —
 *
 *     T(°F) = 50 + (N − 40) / 4      N = chirps per minute
 *
 * — and it holds well enough that you can tell the temperature by counting.
 * So every night here has a temperature, every cricket chirps at the rate
 * Dolbear says it should, and the page can tell you how warm it is.
 *
 * Each cricket has its own pitch, pulse count and very slightly different
 * pace, so a few of them drift in and out of step with each other the way a
 * real field does. Behind them, the countless others too far off to pick out
 * blur into a shimmer.
 */
import { CR, OnePole, Svf, panL, panR, type Source, type SourceCtx } from './dsp'

/** Chirps per minute at a temperature in °C, by Dolbear's law. */
export function dolbear(tempC: number): number {
  const f = (tempC * 9) / 5 + 32
  return 4 * (f - 50) + 40
}

class Cricket {
  fc = 4600
  pulses = 3
  period = 0.5
  pulseLen = 0.018
  pulseGap = 0.035
  gain = 1
  gl = 0.7
  gr = 0.7
  t = 0
  ph = 0
  next = 0
}

export function crickets(c: SourceCtx): Source {
  const { sr, rng } = c
  const crate = sr / CR
  const temp = Math.round(rng.range(19, 27) * 2) / 2
  const perMin = dolbear(temp)
  const pulseRate = 27 + 1.1 * (temp - 22)
  const list: Cricket[] = []
  for (let i = 0; i < 16; i++) {
    const k = new Cricket()
    const near = i < 5
    k.fc = rng.range(4200, 5200) * (1 + 0.006 * (temp - 22))
    k.pulses = 3 + (rng.chance(0.4) ? 1 : 0)
    // The same temperature for all of them, but each its own pace.
    k.period = (60 / perMin) * (1 + 0.035 * rng.gauss())
    const pp = 1 / (pulseRate * rng.range(0.94, 1.06))
    k.pulseLen = pp * 0.58
    k.pulseGap = pp
    k.gain = near ? rng.range(0.45, 1) : rng.range(0.05, 0.14)
    const pan = near ? rng.bi() * 0.85 : rng.bi()
    k.gl = panL(pan)
    k.gr = panR(pan)
    k.next = rng.range(0, k.period)
    list.push(k)
  }
  const far = new OnePole().set(6000, sr)
  const farR = new OnePole().set(6000, sr)
  const shL = new Svf().set(4700, 5, sr), shR = new Svf().set(4800, 5, sr)
  const shAm = new OnePole().set(3, crate)
  let am = 1

  return {
    render(L, R, n) {
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)
        am = 0.7 + Math.min(0.6, Math.abs(shAm.lp(rng.bi())) * 20)
        for (let i = i0; i < i0 + m; i++) {
          let l = 0, r = 0, fl = 0, fr = 0
          for (let j = 0; j < list.length; j++) {
            const k = list[j]
            k.t += 1 / sr
            if (k.t < k.next) continue
            const x = k.t - k.next
            const p = Math.floor(x / k.pulseGap)
            if (p >= k.pulses) {
              // Chirp over: the next one, a hair early or late.
              k.next += k.period * (1 + 0.02 * rng.gauss())
              continue
            }
            const u = (x - p * k.pulseGap) / k.pulseLen
            if (u >= 1) continue
            const env = 0.5 - 0.5 * Math.cos(2 * Math.PI * u)
            // The pitch sags a touch through each pulse as the wing slows.
            k.ph += (2 * Math.PI * k.fc * (1.01 - 0.02 * u)) / sr
            if (k.ph > 1e4) k.ph -= 2 * Math.PI * 1591
            const v = (Math.sin(k.ph) + 0.08 * Math.sin(2 * k.ph)) * env * k.gain * (p === k.pulses - 1 ? 0.8 : 1)
            if (j < 5) { l += v * k.gl; r += v * k.gr }
            else { fl += v * k.gl; fr += v * k.gr }
          }
          const sl = shL.band(rng.bi()) * 0.03 * am
          const srr = shR.band(rng.bi()) * 0.03 * am
          L[i] = l + far.lp(fl) + sl
          R[i] = r + farR.lp(fr) + srr
        }
      }
    },
    state: () => ({ temp, perMin }),
  }
}

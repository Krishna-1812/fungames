/**
 * A wall clock, ticking on the real second.
 *
 * A clock's tick is its escapement: a toothed wheel, pushed by the
 * mainspring, is let go one tooth at a time by a rocking anchor. Each release
 * is two small impacts close together — the tooth slipping off one pallet,
 * then landing on the other a few milliseconds later — and those impacts ring
 * the metal parts (high, inharmonic, gone in a few milliseconds) and knock the
 * wooden case (low, short). The anchor rocks the other way for the next
 * second, so a tick and a tock are not quite the same sound: that slight
 * difference is what makes it a clock and not a metronome.
 *
 * Ticks land on the visitor's actual seconds, and on the hour it strikes the
 * hour on its gong — a coiled steel rod, with inharmonic partials and a long
 * ring — once for every hour, and once at the half. It is the time where you
 * are.
 */
import { CR, Pings, type Source, type SourceCtx } from './dsp'

const METAL = [
  [2150, 0.5, 0.022], [3480, 0.36, 0.014], [5230, 0.28, 0.009], [7710, 0.17, 0.006], [10350, 0.1, 0.004],
] as const
const CASE = [[190, 0.28, 0.05], [430, 0.2, 0.034], [780, 0.12, 0.024]] as const
/** A coiled gong's partials: ratio, level, decay (s). */
const GONG = [[1, 1, 3.6], [2.76, 0.55, 2.4], [5.4, 0.32, 1.5], [8.93, 0.18, 0.9], [13.3, 0.08, 0.5]] as const

export function clock(c: SourceCtx): Source {
  const { sr, rng } = c
  const pings = new Pings(64)
  const PAN = -0.18
  let next = Number.NaN
  let strikes = 0
  let strikeGap = 0
  let lastTick = -1

  function tick(tock: boolean, delay: number) {
    const k = tock ? 0.955 : 1
    for (const [hit, lvl] of [[0, 0.35], [0.0095 + rng.bi() * 0.0012, 1]] as const) {
      const g = lvl * (1 + 0.05 * rng.gauss())
      for (const [f, a, tau] of METAL) pings.add(sr, f * k * (1 + 0.003 * rng.gauss()), a * g, tau, 0, PAN, 0.04, delay + hit)
      for (const [f, a, tau] of CASE) pings.add(sr, f * (tock ? 0.98 : 1), a * g, tau, 0, PAN, 0, delay + hit)
      // The impact itself: a fraction of a millisecond of noise.
      pings.add(sr, 3000, 0.3 * g, 0.0004, 0, PAN, 1, delay + hit)
    }
  }

  function strike(delay: number) {
    for (const [ratio, a, tau] of GONG) pings.add(sr, 196 * ratio, 0.16 * a, tau, 0, PAN, 0, delay)
  }

  return {
    render(L, R, n, t) {
      const wall = c.wall()
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)
        const t0 = t + i0 / sr + wall
        if (Number.isNaN(next)) next = Math.floor(t0) + 1
        if (t0 + m / sr >= next) {
          const s = Math.round(next)
          tick(s % 2 === 1, Math.max(0, next - t0))
          lastTick = s
          // On the hour, the hour; on the half, one.
          if (strikes === 0) {
            const sec = ((s % 86400) + 86400) % 86400
            if (sec % 3600 === 0) {
              const h = Math.floor(sec / 3600) % 12
              strikes = h === 0 ? 12 : h
              strikeGap = 0.6
            } else if (sec % 1800 === 0) {
              strikes = 1
              strikeGap = 0.6
            }
          }
          next += 1
          // If the wall clock was set or jumped, catch up rather than rattle.
          if (next < t0) next = Math.floor(t0) + 1
        }
        if (strikes > 0 && (strikeGap -= m / sr) <= 0) {
          strike(0)
          strikes--
          strikeGap = 1.6
        }
        for (let i = i0; i < i0 + m; i++) {
          pings.tick(rng)
          L[i] = pings.l
          R[i] = pings.r
        }
      }
    },
    state: () => ({ tick: lastTick }),
  }
}

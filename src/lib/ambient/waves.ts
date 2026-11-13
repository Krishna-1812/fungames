/**
 * Surf, one wave at a time.
 *
 * A slow sine on a low-pass filter — this layer's old self — swells and
 * fades like breathing, which is exactly what the sea does not do. Each wave
 * on a beach is an event with a shape, and the shape is the sound:
 *
 *   1. It builds. A dark roar as the water piles up and steepens, getting
 *      louder and slowly brighter.
 *   2. It breaks. The lip falls onto the water in front of it: a thump you
 *      feel more than hear, and the roar opens up to the full brightness of
 *      white water in a fraction of a second. A wave does not break all at
 *      once — it peels along its length — so the crash travels across the
 *      stereo field as it happens.
 *   3. It washes up. The roar dies over a couple of seconds and leaves the
 *      fizz of foam: millions of bubbles bursting, which is a crackle, not a
 *      hiss.
 *   4. It drains back. A softer, brighter hiss as the water runs back down
 *      through the sand.
 *
 * Waves arrive every eight to thirteen seconds, never regularly, mostly small,
 * and every so often in a set of three bigger ones — which is how swell from
 * a distant storm really arrives. Underneath it all is the sea further along
 * the coast, a low roar that never quite stops.
 */
import { Brown, CR, Drift, OnePole, Pings, Svf, panL, panR, type Source, type SourceCtx } from './dsp'

type Wave = {
  live: boolean
  t: number
  build: number
  peak: number
  wash: number
  p0: number
  p1: number
  roarL: Svf
  roarR: Svf
  hissL: Svf
  hissR: Svf
  boom: Svf
  /* This block's levels and pan gains. */
  g: number
  hs: number
  bm: number
  gl: number
  gr: number
}

export function waves(c: SourceCtx): Source {
  const { sr, rng } = c
  const brownL = new Brown(), brownR = new Brown(), brownB = new Brown()
  const bedL = new Svf().set(380, 0.6, sr), bedR = new Svf().set(380, 0.6, sr)
  const bedLevel = new Drift(rng, 0.6, 1, 9, 4, sr)
  const foam = new Pings(64)
  const pool: Wave[] = [0, 1, 2].map(() => ({
    live: false, t: 0, build: 2, peak: 1, wash: 1.6, p0: 0, p1: 0,
    roarL: new Svf(), roarR: new Svf(), hissL: new Svf(), hissR: new Svf(), boom: new Svf().set(85, 0.8, sr),
    g: 0, hs: 0, bm: 0, gl: 0, gr: 0,
  }))
  let clock = 0
  let next = rng.range(0.3, 1.2)
  let inSet = 0
  let untilSet = 4 + rng.int(5)
  let level = 0

  function launch(at: number) {
    const w = pool.find((p) => !p.live)
    if (!w) return
    let peak: number
    if (inSet > 0) { inSet--; peak = rng.range(0.95, 1.2) }
    else if (--untilSet <= 0) { inSet = 2; untilSet = 6 + rng.int(4); peak = rng.range(0.95, 1.15) }
    else peak = rng.range(0.5, 0.88)
    const side = rng.chance(0.5) ? 1 : -1
    Object.assign(w, {
      live: true, t: 0, build: rng.range(1.7, 2.6), peak, wash: rng.range(1.8, 3),
      p0: side * rng.range(0.25, 0.7), p1: -side * rng.range(0.1, 0.5),
    })
    c.emit('wave', at + w.build, { peak, p0: w.p0, p1: w.p1, build: w.build, wash: w.wash })
  }

  return {
    render(L, R, n, t) {
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)
        const dt = m / sr
        clock += dt
        if (clock >= next) {
          launch(t + i0 / sr)
          next = clock + (inSet > 0 ? rng.range(6, 8.5) : rng.range(8, 13))
        }
        const bedG = 0.12 * bedLevel.step()
        // Each live wave's envelopes for this block.
        let fizzRate = 0, fizzPan = 0, loud = 0
        for (const w of pool) {
          if (!w.live) continue
          w.t += dt
          const tc = w.t - w.build
          let g: number, fc: number, hiss: number, boom: number
          if (tc < 0) {
            const x = w.t / w.build
            g = 0.25 * x * x
            fc = 220 + 380 * x
            hiss = 0
            boom = 0
          } else {
            g = (0.25 + 0.75 * (1 - Math.exp(-tc / 0.12))) * Math.exp(-tc / w.wash)
            fc = 600 + 3000 * (1 - Math.exp(-tc / 0.08)) * Math.exp(-tc / 0.75)
            // The drain: a bump of brighter hiss as the water runs back.
            const u = (tc - w.wash * 1.9) / 1.1
            hiss = 0.22 * Math.exp(-u * u)
            boom = (1 - Math.exp(-tc / 0.025)) * Math.exp(-tc / 0.22)
            const f = (1 - Math.exp(-tc / 0.3)) * Math.exp(-tc / 2.6)
            fizzRate += w.peak * f * 900
            fizzPan += w.peak * f * (w.p0 + w.p1) * 0.5
            if (tc > w.wash * 5) w.live = false
          }
          g *= w.peak
          loud = Math.max(loud, g)
          w.roarL.set(fc, 0.7, sr)
          w.roarR.set(fc * 1.04, 0.7, sr)
          w.hissL.set(1300 + 900 * Math.max(0, tc) / 6, 0.9, sr)
          w.hissR.set(1400 + 900 * Math.max(0, tc) / 6, 0.9, sr)
          const p = w.p0 + (w.p1 - w.p0) * Math.min(1, Math.max(0, tc / 1.2))
          w.g = g
          w.hs = hiss * w.peak
          w.bm = boom * w.peak
          w.gl = 0.55 + 0.6 * panL(p)
          w.gr = 0.55 + 0.6 * panR(p)
        }
        level = loud
        const pFizz = fizzRate / sr
        const fp = fizzRate > 0 ? fizzPan / (fizzRate / 900) : 0
        for (let i = i0; i < i0 + m; i++) {
          const nl = brownL.next(rng.bi()), nr = brownR.next(rng.bi())
          let l = bedL.run(nl) * bedG
          let r = bedR.run(nr) * bedG
          const wl = rng.bi(), wr = rng.bi()
          const nb = brownB.next(rng.bi())
          for (const w of pool) {
            if (!w.live) continue
            // White noise into the sweeping low-pass: the roar.
            const rl = w.roarL.run(wl) * w.g, rr = w.roarR.run(wr) * w.g
            const hl = w.hissL.band(wr) * w.hs, hr = w.hissR.band(wl) * w.hs
            const b = w.boom.run(nb) * w.bm
            l += rl * w.gl + hl + b
            r += rr * w.gr + hr + b
          }
          if (pFizz > 0 && rng.next() < pFizz) {
            foam.add(sr, rng.range(2500, 9000), 0.02 + 0.06 * rng.next() ** 4, rng.range(0.0004, 0.0016), 0, fp + rng.bi() * 0.6, 0.7)
          }
          foam.tick(rng)
          L[i] = l + foam.l
          R[i] = r + foam.r
        }
      }
    },
    state: () => ({ level }),
  }
}

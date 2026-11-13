/**
 * Rain, as what it physically is: a great many separate drops.
 *
 * Filtered white noise — which is what this layer used to be — sounds like
 * static because it is static: every instant equally loud, nothing in it
 * ever happening. Rain is built out of events, and the events have two
 * distinct sounds:
 *
 *   - A drop that hits something hard (a leaf, a roof, a path) makes a click:
 *     a millisecond or two of noise, coloured by whatever it hit.
 *   - A drop that hits water traps a tiny bubble, and the bubble rings. Its
 *     pitch is set by its size (Minnaert: about 3.3 kHz divided by the radius
 *     in millimetres), it dies away in a few milliseconds, and it rises in
 *     pitch as it does, because the bubble is being pushed back up to the
 *     surface. That rising "plip" is the sound that makes rain on a puddle
 *     sound wet (van den Doel's model of liquid sounds).
 *
 * Under the near drops is the bed — the uncountable drops further away, which
 * really do blur into noise — fed to each ear separately so it surrounds you.
 * The whole shower swells and eases on its own. And two gutters drip, each at
 * its own pace and in its own place, which is what anchors the space.
 */
import { Brown, CR, Drift, OnePole, Pings, Pink, Svf, type Source, type SourceCtx } from './dsp'

export function rain(c: SourceCtx): Source {
  const { sr, rng } = c
  const pinkL = new Pink(), pinkR = new Pink()
  const hpL = new Svf().set(420, 0.6, sr), hpR = new Svf().set(420, 0.6, sr)
  // The hiss of a lot of rain peaks in the low kilohertz.
  const pkL = new Svf().set(2300, 0.8, sr), pkR = new Svf().set(2300, 0.8, sr)
  const lpL = new OnePole().set(8500, sr), lpR = new OnePole().set(8500, sr)
  const body = new Brown()
  const bodyLp = new OnePole().set(170, sr)
  const intensity = new Drift(rng, 0.5, 1, 7, 3.5, sr)
  const drops = new Pings(80)

  const drips = [
    { pan: -0.55, every: rng.range(0.7, 1.1), f: rng.range(1300, 1700), left: rng.range(0.2, 1) },
    { pan: 0.42, every: rng.range(1.4, 2.2), f: rng.range(1800, 2300), left: rng.range(0.5, 2) },
  ]

  let I = intensity.v

  function drop() {
    const u = rng.next()
    // Drop sizes follow a steep power law: a lot of drizzle, the odd fat drop.
    const amp = 0.01 + 0.11 * u * u * u * u * u
    const pan = rng.bi() * 0.95
    if (rng.chance(0.3)) {
      // Onto water: a bubble. Damping and the pitch rise both follow from the
      // frequency (van den Doel).
      const f = rng.range(1100, 3600)
      const d = 0.043 * f + 0.0014 * Math.pow(f, 1.5)
      drops.add(sr, f, amp * 0.8, 1 / d, rng.range(0.1, 0.4) * d, pan, 0.02)
    } else {
      // Onto something hard: a click, tinted by what it hit.
      drops.add(sr, rng.range(1800, 7000), amp, rng.range(0.0006, 0.0025), 0, pan, 0.6)
    }
  }

  return {
    render(L, R, n) {
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)
        I = intensity.step()
        const rate = (70 + 260 * I) / sr
        const bed = 0.11 * (0.5 + 0.5 * I)
        const thrum = 0.05 * I
        const dt = m / sr
        for (const d of drips) {
          d.left -= dt
          if (d.left > 0) continue
          const f = d.f * (1 + 0.025 * rng.gauss())
          const damp = 0.043 * f + 0.0014 * Math.pow(f, 1.5)
          drops.add(sr, f, 0.07 * (0.75 + 0.5 * rng.next()), 1.6 / damp, 0.35 * damp, d.pan, 0.01)
          // Now and then a second drop follows close behind the first.
          d.left = d.every * (1 + 0.12 * rng.gauss()) * (rng.chance(0.12) ? 0.3 : 1)
        }
        for (let i = i0; i < i0 + m; i++) {
          if (rng.next() < rate) drop()
          hpL.run(pinkL.next(rng.bi()))
          hpR.run(pinkR.next(rng.bi()))
          const yl = hpL.hp, yr = hpR.hp
          const zl = yl * 0.5 + pkL.band(yl) * 0.9
          const zr = yr * 0.5 + pkR.band(yr) * 0.9
          const b = bodyLp.lp(body.next(rng.bi())) * thrum
          drops.tick(rng)
          L[i] = lpL.lp(zl) * bed + b + drops.l
          R[i] = lpR.lp(zr) * bed + b + drops.r
        }
      }
    },
    state: () => ({ intensity: I }),
  }
}

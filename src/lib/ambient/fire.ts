/**
 * A campfire.
 *
 * Most of what a wood fire sounds like is not the flame. The flame is a soft
 * low roar — combustion buffeting the air — that flickers as the flames do.
 * What makes it a *fire* is the wood: water and resin trapped in it boil,
 * the pressure splits the wood, and the result is a crack. Cracks are sharp
 * (a millisecond or less), wildly uneven in size, and they come in clusters,
 * because one split opens the way for the next. Once in a while a pocket of
 * resin goes with a proper pop, throws sparks, and sizzles after.
 *
 * So: a flickering low roar, a faint hiss of escaping gas, clustered cracks
 * whose sizes follow a steep power law, and the occasional pop. A fire is a
 * point, so all of it sits close to the middle — the cracks spread only as
 * wide as the logs. The flicker that drives the roar is reported too, so the
 * firelight in the picture moves with what you hear.
 */
import { Brown, CR, Drift, OnePole, Pings, Svf, type Source, type SourceCtx } from './dsp'

export function fire(c: SourceCtx): Source {
  const { sr, rng } = c
  const crate = sr / CR
  const brown = new Brown(), side = new Brown()
  const roar = new Svf().set(260, 0.8, sr), roarS = new Svf().set(300, 0.8, sr)
  // Lapping: the flames' own movement, higher than the roar.
  const lap = new Svf().set(620, 0.7, sr)
  // Below this a fire is felt, not heard; and small speakers only muddy it.
  const sub = new OnePole().set(70, sr)
  const hiss = new Svf().set(2800, 0.7, sr)
  const hissLp = new OnePole().set(8000, sr)
  const flickN = new OnePole().set(6, crate)
  const breath = new Drift(rng, 0.65, 1.1, 3, 1.4, sr)
  // Some minutes a fire is busy, some it is not.
  const busy = new Drift(rng, 0.45, 1.6, 4, 1.2, sr)
  const cracks = new Pings(96)
  const sizzle = new Svf().set(3800, 0.8, sr)
  let sizzleAmp = 0
  const sizzleDecay = Math.exp(-1 / (0.28 * sr))

  let flick = 1
  let untilCluster = 0.2
  let untilPop = rng.range(3, 8)
  let lastPop = -1

  function cluster(at: number) {
    // One split leads to the next: a run of cracks a few milliseconds apart.
    const k = 1 + Math.floor(rng.next() ** 2 * 7)
    const centre = rng.bi() * 0.3
    let delay = 0
    for (let j = 0; j < k; j++) {
      const u = rng.next()
      const amp = 0.05 + 0.42 * u * u * u * u
      cracks.add(sr, rng.range(1200, 5200), amp, rng.range(0.00025, 0.0012), 0, centre + rng.bi() * 0.08, 0.75, delay)
      delay += rng.exp(0.006)
    }
    void at
  }

  return {
    render(L, R, n, t) {
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)
        const dt = m / sr
        const b = breath.step()
        flick = Math.max(0.3, Math.min(1.4, 0.8 + flickN.lp(rng.bi()) * 9)) * b
        if ((untilCluster -= dt) <= 0) {
          cluster(t + i0 / sr)
          untilCluster = rng.exp(1 / (8.5 * b * busy.step()))
        }
        if ((untilPop -= dt) <= 0) {
          const at = t + i0 / sr
          const pan = rng.bi() * 0.25
          // Resin: a low pop with a sharp edge on it, then a sizzle.
          cracks.add(sr, rng.range(260, 520), 0.32, 0.025, 0, pan, 0.3)
          cracks.add(sr, rng.range(1900, 3200), 0.34, 0.0011, 0, pan, 0.6)
          sizzleAmp = 0.06
          lastPop = at
          c.emit('pop', at, { pan })
          untilPop = rng.exp(5) + 1.5
        }
        const r = 0.22 * flick
        const h = 0.018 * flick
        for (let i = i0; i < i0 + m; i++) {
          const w = rng.bi()
          const s = side.next(rng.bi())
          const body = (sub.hp(roar.run(brown.next(w))) + lap.band(w) * 0.22) * r
          const wide = roarS.run(s) * r * 0.42
          hiss.run(rng.bi())
          const hs = hissLp.lp(hiss.hp) * h
          sizzle.run(rng.bi())
          const sz = sizzle.hp * sizzleAmp
          sizzleAmp *= sizzleDecay
          cracks.tick(rng)
          // The roar is nearly mono; a touch of the hiss differs per side.
          L[i] = body + wide + hs + sz * 0.9 + cracks.l
          R[i] = body - wide + hs * 0.8 + sz + cracks.r
        }
      }
    },
    state: () => ({ flicker: flick, pop: lastPop }),
  }
}

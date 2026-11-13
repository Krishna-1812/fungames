/**
 * Wind, driven by an actual wind speed.
 *
 * Air on its own is silent; what you hear as wind is air moving past things.
 * So this layer keeps a wind speed in metres per second — a slow base, gusts
 * that build over a second or two and die away over several, and turbulence
 * on top — and every sound in it follows from that number:
 *
 *   - Rumble: the buffeting of air against the ground and against you. Louder
 *     and brighter the faster it blows.
 *   - Whistle: air flowing past a wire or a twig sheds vortices at a rate set
 *     by the speed and the thickness (Strouhal: f ≈ 0.2 v / d). That is why
 *     wind howls up in pitch as a gust arrives and sags as it passes — here,
 *     a 4 mm wire and a 2 mm twig, each a narrow resonance at its own place.
 *     Below a few metres a second they fall silent, as real ones do.
 *   - Rustle: leaves, which only join in once a gust has some strength, and
 *     flutter rather than hiss.
 *
 * A gust comes from somewhere and goes somewhere, so it moves across the
 * stereo field as it passes.
 */
import { Brown, CR, Drift, OnePole, Svf, type Source, type SourceCtx } from './dsp'

type Gust = { live: boolean; age: number; rise: number; fall: number; amp: number; p0: number; p1: number }

export function wind(c: SourceCtx): Source {
  const { sr, rng } = c
  const crate = sr / CR
  const base = new Drift(rng, 3.2, 6, 14, 6, sr)
  const turb = new OnePole().set(1.2, crate)
  const gusts: Gust[] = [0, 1, 2, 3].map(() => ({ live: false, age: 0, rise: 1, fall: 4, amp: 0, p0: 0, p1: 0 }))
  let untilGust = rng.range(0.5, 2)

  const bL = new Brown(), bR = new Brown()
  const rumL = new Svf(), rumR = new Svf()
  const wire = new Svf(), twig = new Svf()
  // Leaves rustle across the low kilohertz, not up in the hiss.
  const leafL = new Svf().set(2600, 0.55, sr), leafR = new Svf().set(2900, 0.55, sr)
  const flutter = new OnePole().set(9, sr)

  let v = base.v
  let pan = 0

  return {
    render(L, R, n) {
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)
        const dt = 1 / crate
        // ---- the weather ---------------------------------------------------
        if ((untilGust -= dt) <= 0) {
          const g = gusts.find((x) => !x.live)
          if (g) {
            const side = rng.chance(0.5) ? 1 : -1
            Object.assign(g, {
              live: true, age: 0, rise: rng.range(0.9, 2.6), fall: rng.range(2.5, 7),
              amp: rng.range(1.5, 6.5) * (rng.chance(0.15) ? 1.5 : 1),
              p0: side * rng.range(0.3, 0.9), p1: -side * rng.range(0.1, 0.8),
            })
          }
          untilGust = rng.exp(6.5) + 1.5
        }
        let gsum = 0, psum = 0
        for (const g of gusts) {
          if (!g.live) continue
          g.age += dt
          const k = g.age < g.rise ? 0.5 - 0.5 * Math.cos((Math.PI * g.age) / g.rise) : Math.exp(-(g.age - g.rise) / g.fall)
          if (g.age > g.rise && k < 0.01) { g.live = false; continue }
          const s = g.amp * k
          const u = Math.min(1, g.age / (g.rise + g.fall))
          gsum += s
          psum += s * (g.p0 + (g.p1 - g.p0) * u)
        }
        v = Math.max(0.5, base.step() + gsum + turb.lp(rng.bi()) * 40)
        pan = gsum > 0.01 ? (psum / gsum) * Math.min(1, gsum / 3) : pan * 0.999

        // ---- what it sounds like at that speed -----------------------------
        rumL.set(70 + 42 * v, 0.6, sr)
        rumR.set(74 + 42 * v, 0.6, sr)
        const rum = 0.16 * Math.pow(v / 7, 1.5)
        wire.set(0.2 * v / 0.004, 26, sr)
        twig.set(0.2 * v / 0.0021, 18, sr)
        const ww = Math.max(0, v - 4.5)
        const whistle = Math.min(1.4, (ww * ww) / 22) * 1.1
        const leaves = 0.13 * Math.min(2.2, Math.pow(Math.max(0, v - 2.5) / 6, 2))
        const gl = 1 - 0.32 * pan, gr = 1 + 0.32 * pan
        for (let i = i0; i < i0 + m; i++) {
          const rl = rumL.run(bL.next(rng.bi())) * rum
          const rr = rumR.run(bR.next(rng.bi())) * rum
          const w1 = wire.band(rng.bi()) * whistle
          const w2 = twig.band(rng.bi()) * whistle * 0.55
          const fl = 0.35 + Math.min(1.6, Math.abs(flutter.lp(rng.bi())) * 26)
          const ll = leafL.band(rng.bi()) * leaves * fl, lr = leafR.band(rng.bi()) * leaves * fl
          L[i] = (rl + ll) * gl + w1 * 0.82 + w2 * 0.55
          R[i] = (rr + lr) * gr + w1 * 0.57 + w2 * 0.84
        }
      }
    },
    state: () => ({ speed: v, pan }),
  }
}

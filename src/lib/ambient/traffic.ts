/**
 * A motorway, a little way off — as a stream of real moving sources.
 *
 * Every vehicle is a point that drives along a straight road, about a hundred
 * and twenty metres in front of you, and what you hear of it is worked out
 * from where it is:
 *
 *   - Spreading: sound from a point falls as one over the distance.
 *   - Air: high frequencies are absorbed by the air on the way, so a car a
 *     kilometre off is a dull hum and only gets bright as it nears.
 *   - Delay: sound takes time to arrive (343 m/s), so you hear each car where
 *     it *was* — a third of a second ago, at this range.
 *   - Doppler: a source coming towards you is heard higher, and going away,
 *     lower, by c / (c + v_r) where v_r is how fast it is moving away from
 *     you. That falling "neeeoww" of a car going past is this.
 *   - Direction: it pans from one ear to the other as it passes.
 *
 * At motorway speed most of a car's noise is its tyres on the road, a broad
 * roar around a kilohertz; the engine is a low hum underneath. Lorries are
 * slower, louder, lower. Traffic comes in both directions, in the loose
 * bunches real traffic forms, and the vehicles too far away to pick out make
 * the steady roar behind.
 */
import { CR, Drift, OnePole, Pink, Saw, Svf, panL, panR, type Source, type SourceCtx } from './dsp'

export const SOUND_SPEED = 343

/**
 * Where a vehicle is heard from, given where it is now: the retarded
 * position, one fixed-point step (good to millimetres at road speeds).
 * Returns the distance, the pan and the Doppler factor.
 */
export function heard(x: number, d: number, v: number) {
  const r0 = Math.hypot(x, d)
  const xr = x - (v * r0) / SOUND_SPEED
  const r = Math.hypot(xr, d)
  const vr = (v * xr) / r
  return { r, pan: xr / r, doppler: SOUND_SPEED / (SOUND_SPEED + vr) }
}

class Vehicle {
  live = false
  x = 0
  v = 30
  d = 120
  truck = false
  engine = 80
  tyre = new Svf()
  air = new OnePole()
  eng = new Saw()
  engLp = new Svf()
  g = 0
  gl = 0.7
  gr = 0.7
  f = 80
}

export function traffic(c: SourceCtx): Source {
  const { sr, rng } = c
  const crate = sr / CR
  const cars: Vehicle[] = Array.from({ length: 18 }, () => new Vehicle())
  const LANES = [
    { dir: 1, d: 118 },
    { dir: -1, d: 132 },
  ]
  const until = [rng.range(0, 2), rng.range(0, 3)]
  const busy = new Drift(rng, 0.5, 1.4, 20, 8, sr)
  const roarL = new Pink(), roarR = new Pink()
  const roarFL = new OnePole().set(520, sr), roarFR = new OnePole().set(560, sr)
  // The far roar is tyres, not engines: little below a couple of hundred hertz.
  const roarHL = new OnePole().set(160, sr), roarHR = new OnePole().set(160, sr)
  const roarLevel = new Drift(rng, 0.75, 1, 6, 3, sr)
  const SPAN = 1300

  function spawn(lane: number, at: number, already = 0) {
    const car = cars.find((x) => !x.live)
    if (!car) return
    const L = LANES[lane]
    car.live = true
    car.truck = rng.chance(0.14)
    car.v = L.dir * (car.truck ? rng.range(22, 25) : rng.range(27, 36))
    car.d = L.d + rng.bi() * 3
    // A car that set off `already` seconds ago is that far down the road.
    car.x = -L.dir * SPAN + car.v * already
    if (Math.abs(car.x) > SPAN) { car.live = false; return }
    car.engine = car.truck ? rng.range(55, 75) : rng.range(70, 120)
    car.tyre.set(car.truck ? rng.range(500, 800) : rng.range(750, 1200), 0.7, sr)
    car.engLp.set(car.truck ? 380 : 300, 0.9, sr)
    c.emit('car', at, { lane, x0: car.x, v: car.v, d: car.d, truck: car.truck ? 1 : 0 })
  }

  /** The road was busy before you started listening: fill it as it would be. */
  function prefill(at: number) {
    for (let k = 0; k < 2; k++) {
      let ago = rng.range(0, 3)
      while (ago < (2 * SPAN) / 22) {
        spawn(k, at, ago)
        ago += rng.chance(0.35) ? rng.range(0.8, 2.2) : rng.exp(4.5) + 0.6
      }
    }
  }
  let filled = false

  return {
    render(L, R, n, t) {
      if (!filled) { filled = true; prefill(t) }
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)
        const dt = 1 / crate
        const b = busy.step()
        for (let k = 0; k < 2; k++) {
          if ((until[k] -= dt) > 0) continue
          spawn(k, t + i0 / sr)
          // Bunches: a short gap is likely to be followed by another.
          until[k] = rng.chance(0.35) ? rng.range(0.8, 2.2) : rng.exp(4.5 / b) + 0.6
        }
        for (const car of cars) {
          if (!car.live) continue
          car.x += car.v * dt
          if (Math.abs(car.x) > SPAN && Math.sign(car.x) === Math.sign(car.v)) { car.live = false; continue }
          const h = heard(car.x, car.d, Math.abs(car.v) * Math.sign(car.v))
          // vr above is along +x; flip for traffic going the other way.
          const lvl = (car.truck ? 1.7 : 1) * Math.pow(Math.abs(car.v) / 30, 3)
          car.g = (lvl * 110) / h.r
          car.air.set(Math.min(14000, Math.max(500, 9000 * Math.pow(140 / h.r, 1.15))), sr)
          car.f = car.engine * h.doppler
          car.gl = panL(h.pan)
          car.gr = panR(h.pan)
        }
        const rg = 0.09 * roarLevel.step() * (0.7 + 0.3 * b)
        for (let i = i0; i < i0 + m; i++) {
          let l = roarHL.hp(roarFL.lp(roarL.next(rng.bi()))) * rg
          let r = roarHR.hp(roarFR.lp(roarR.next(rng.bi()))) * rg
          for (const car of cars) {
            if (!car.live) continue
            const tyre = car.tyre.band(rng.bi())
            const eng = car.engLp.run(car.eng.next(car.f, sr)) * (car.truck ? 0.34 : 0.14)
            const s = car.air.lp(tyre + eng) * car.g
            l += s * car.gl
            r += s * car.gr
          }
          L[i] = l
          R[i] = r
        }
      }
    },
  }
}

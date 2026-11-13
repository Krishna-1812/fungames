/**
 * A lawnmower, two gardens away.
 *
 * A mower is a single-cylinder four-stroke engine, which fires once every two
 * turns of the crankshaft: at its governed 3000 rpm, 25 times a second. Each
 * firing is a pulse of exhaust gas that rings the muffler, and that rhythm —
 * a buzz you can almost count — is the sound. What makes it sound like an
 * engine rather than a buzzer is that no two firings are quite alike: the
 * gap between them wanders by a few per cent, the strength of each varies,
 * and every so often one misfires altogether.
 *
 * The blade is bolted to the crankshaft, so it adds a hum at the blade-pass
 * rate (two tips, 100 a second) and a whoosh of air. When it hits a thick
 * patch the load drags the engine down and the governor opens the throttle
 * to bring it back: the pitch sags and the note gets harder, then recovers.
 *
 * And it moves. The person pushing it walks up and down the lawn at a walking
 * pace, so it slides from one side to the other and back, getting nearer
 * with each stripe, quieter and duller at the far end. Every few minutes it
 * stops — the grass box is full — and after a while is pull-started again:
 * the whirr of the recoil starter, a cough, a second pull, and it catches.
 */
import { CR, OnePole, Saw, Svf, panL, panR, type Source, type SourceCtx } from './dsp'

/** The lawn: its middle is this many metres to your right (so, to the left),
 *  and the mower walks this far either side of it. The picture uses it too. */
export const LAWN = { x: -15, half: 9 }

export function mower(c: SourceCtx): Source {
  const { sr, rng } = c
  const crate = sr / CR
  const muffler = [new Svf().set(165, 5, sr), new Svf().set(480, 3, sr), new Svf().set(1300, 2.5, sr)]
  const exhaust = new Svf().set(3000, 0.8, sr)
  const blade = new Saw()
  const bladeF = new Svf().set(800, 1, sr)
  const whoosh = new Svf().set(2200, 0.8, sr)
  const cut = new Svf().set(1500, 0.7, sr)
  const recoil = new Svf()
  const air = new OnePole()
  const fence = new OnePole().set(3800, sr)

  // Engine state.
  let rpm = 0
  let target = 3000
  let load = 0
  let loadLeft = 0
  let untilLoad = rng.range(3, 8)
  let untilFire = 0
  let pulse = 0
  let pulseAmp = 0
  let exh = 0
  // Life cycle: 0 starting, 1 running, 2 stopping, 3 stopped.
  let phase = 0
  let phaseT = 0
  let pulls = 1 + (rng.chance(0.5) ? 1 : 0)
  let pullT = 0
  let runFor = rng.range(90, 200)
  let restFor = 12
  // Where it is on the lawn (metres; you are at the origin).
  let x = rng.range(-LAWN.half, LAWN.half)
  let dir = rng.chance(0.5) ? 1 : -1
  let y = 22
  let turning = 0
  let gl = 0.7, gr = 0.7, dist = 1

  const PULSE = Math.round(0.001 * sr)

  return {
    render(L, R, n) {
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)
        const dt = 1 / crate
        phaseT += dt

        // ---- life cycle -------------------------------------------------
        if (phase === 0) {
          // Pull-start: each pull spins it up briefly; the last one catches.
          pullT += dt
          if (pullT < 0.55) {
            target = 600 + 900 * (pullT / 0.55)
            rpm += (target - rpm) * 0.08
          } else if (pulls > 1) {
            rpm *= 0.97
            if (pullT > 1.6) { pulls--; pullT = 0 }
          } else {
            phase = 1; phaseT = 0; target = 3000
          }
        } else if (phase === 1) {
          target = 3000
          if (phaseT > runFor) { phase = 2; phaseT = 0 }
        } else if (phase === 2) {
          target = 0
          if (rpm < 120) { phase = 3; phaseT = 0; rpm = 0 }
        } else if (phase === 3 && phaseT > restFor) {
          phase = 0; phaseT = 0; pullT = 0; pulls = 1 + (rng.chance(0.5) ? 1 : 0); runFor = rng.range(90, 200); restFor = rng.range(8, 20)
        }

        // The governor: a lag towards the set speed, fought by the load.
        if (phase === 1) {
          if ((untilLoad -= dt) <= 0) { loadLeft = rng.range(0.5, 2); load = rng.range(150, 420); untilLoad = rng.range(3, 10) }
          if (loadLeft > 0) loadLeft -= dt
          else load *= 0.9
          rpm += ((target - rpm) / 0.25 - load * 4) * dt
        } else if (phase === 2) {
          rpm += (0 - rpm) * dt * 2.2
        }
        rpm = Math.max(0, rpm)

        // ---- walking up and down the lawn --------------------------------
        if (phase === 1 || phase === 0) {
          if (turning > 0) turning -= dt
          else {
            x += dir * 1.05 * dt
            if (Math.abs(x) > LAWN.half) { dir = -dir; turning = 1.3; y += dir > 0 ? -0.5 : 0; if (y < 14) y = 26 }
          }
        }
        const ax = x + LAWN.x
        const r = Math.hypot(ax, y)
        dist = 20 / r
        air.set(Math.min(12000, 7000 * (20 / r)), sr)
        gl = panL(ax / r)
        gr = panR(ax / r)

        const firing = rpm / 120
        const bladeHz = (rpm / 60) * 2
        const cutting = phase === 1 ? Math.min(1, load / 300) : 0
        const spin = Math.min(1, rpm / 3000)

        for (let i = i0; i < i0 + m; i++) {
          // ---- the engine: one exhaust pulse per firing -----------------
          if (firing > 3 && (untilFire -= 1) <= 0) {
            // Cycle-to-cycle variation, and the odd misfire.
            const misfire = phase === 1 ? 0.02 : 0.12
            pulseAmp = rng.chance(misfire) ? 0 : (1 + 0.15 * rng.gauss()) * (1 + 0.35 * cutting)
            pulse = PULSE
            exh = pulseAmp * 1.3
            untilFire = (sr / firing) * (1 + 0.03 * rng.gauss())
          }
          let ex = 0
          if (pulse > 0) {
            ex = Math.sin((Math.PI * (PULSE - pulse)) / PULSE) * pulseAmp
            pulse--
          }
          const e = muffler[0].band(ex) * 1 + muffler[1].band(ex) * 0.55 + muffler[2].band(ex) * 0.6
          exhaust.run(rng.bi())
          const hiss = exhaust.hp * exh
          exh *= 0.996
          // ---- the blade ----------------------------------------------------
          let b = 0
          if (spin > 0.05) {
            const bp = bladeF.band(blade.next(bladeHz, sr)) * 0.12 * spin
            const am = 0.6 + 0.4 * Math.abs(Math.sin(Math.PI * blade.t))
            b = bp + whoosh.band(rng.bi()) * 0.06 * spin * am + cut.band(rng.bi()) * 0.1 * cutting * am
          }
          // ---- the starter cord ----------------------------------------------
          let rc = 0
          if (phase === 0 && pullT < 0.55) {
            if ((i & 31) === 0) recoil.set(300 + 1400 * (pullT / 0.55), 2, sr)
            rc = recoil.band(rng.bi()) * 0.25 * Math.sin(Math.PI * (pullT / 0.55))
          }
          const s = fence.lp(air.lp((e * 2.4 + hiss + b + rc) * dist))
          L[i] = s * gl
          R[i] = s * gr
        }
      }
    },
    state: () => ({ x, y, rpm, running: phase === 1 ? 1 : 0 }),
  }
}

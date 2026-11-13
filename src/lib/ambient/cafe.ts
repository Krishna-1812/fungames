/**
 * A coffee shop: a room full of people talking, and their cups.
 *
 * The murmur of a café is speech you cannot quite follow — so this makes
 * speech. Ten talkers sit at four tables. Each one has a voice: a pitch, and
 * a vocal tract modelled the way speech science models it, as a buzzing
 * source (the vocal folds) shaped by three resonances (the formants), whose
 * positions are what make one vowel different from another. They talk in
 * syllables of a fifth of a second, in phrases that fall in pitch towards
 * their end, with consonants hissing at the start of some syllables and the
 * formants gliding between vowels rather than jumping. And they take turns:
 * at a table, one person speaks at a time and the gaps between turns are
 * short, which is the rhythm that makes babble sound like conversation and
 * not like a crowd at a match. Now and then a table laughs.
 *
 * None of it is language — there are no words in it to catch — which is
 * exactly what you hear from three tables away. The near table is clear and
 * the far ones are muffled and duller, by distance.
 *
 * Under them: the room, cups set down on saucers (a ceramic cup rings at a
 * few inharmonic partials, highest dying first), a spoon going round a cup,
 * and every minute or so the steam wand or the grinder behind the counter.
 */
import { CR, OnePole, Pings, Pink, Saw, Svf, panL, panR, type Source, type SourceCtx } from './dsp'

/** F1, F2 in Hz for an adult male: a, i, u, e, o, æ, ʌ, ɔ, ɪ. */
const VOWELS: readonly (readonly [number, number])[] = [
  [730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840],
  [660, 1720], [520, 1190], [440, 1020], [390, 1990],
]

type Group = { floor: number; gap: number; last: number; members: Talker[] }

class Talker {
  // who
  f0 = 120
  fscale = 1
  gain = 1
  gl = 0.7
  gr = 0.7
  // the voice
  saw = new Saw()
  tilt = new OnePole()
  dist = new OnePole()
  f1 = new Svf()
  f2 = new Svf()
  f3 = new Svf()
  fricF = new Svf()
  F1 = 500
  F2 = 1500
  T1 = 500
  T2 = 1500
  // what they are doing
  talking = false
  laughing = false
  sylT = 0
  sylDur = 0.2
  sylAmp = 0
  phraseN = 0
  phraseI = 0
  pitch = 120
  fric = 0
  fricDecay = 0.999
  breath = 0
  env = 0
}

export function cafe(c: SourceCtx): Source {
  const { sr, rng } = c
  const crate = sr / CR
  const dt = 1 / crate

  const TABLES = [
    { n: 3, gain: 1, lp: 4300, pan: -0.42 },
    { n: 3, gain: 0.6, lp: 3300, pan: 0.38 },
    { n: 2, gain: 0.4, lp: 2600, pan: -0.02 },
    { n: 2, gain: 0.27, lp: 2000, pan: 0.78 },
  ]
  const groups: Group[] = []
  const talkers: Talker[] = []
  for (const tb of TABLES) {
    const g: Group = { floor: -1, gap: rng.range(0, 1.5), last: -1, members: [] }
    for (let k = 0; k < tb.n; k++) {
      const p = new Talker()
      const female = rng.chance(0.5)
      p.f0 = female ? rng.range(175, 235) : rng.range(95, 140)
      p.fscale = female ? rng.range(1.12, 1.2) : rng.range(0.97, 1.03)
      p.gain = tb.gain * rng.range(0.8, 1.1)
      const pan = tb.pan + rng.bi() * 0.14
      p.gl = panL(pan)
      p.gr = panR(pan)
      p.tilt.set(female ? 1900 : 1450, sr)
      p.dist.set(tb.lp, sr)
      p.f3.set(2700 * p.fscale, 2700 / 170, sr)
      p.fricF.set(rng.range(4200, 6200), 0.9, sr)
      g.members.push(p)
      talkers.push(p)
    }
    groups.push(g)
  }

  function startSyllable(p: Talker) {
    p.sylT = 0
    if (p.laughing) {
      p.sylDur = rng.range(0.1, 0.15)
      p.T1 = 820 * p.fscale; p.T2 = 1250 * p.fscale
      p.breath = 0.55
      p.sylAmp = 0.9 * Math.pow(0.88, p.phraseI)
      p.pitch = p.f0 * (1.55 - 0.05 * p.phraseI) * (1 + 0.05 * rng.gauss())
      return
    }
    p.sylDur = rng.range(0.1, 0.26)
    const [a, b] = rng.pick(VOWELS)
    p.T1 = a * p.fscale * rng.range(0.94, 1.06)
    p.T2 = b * p.fscale * rng.range(0.94, 1.06)
    p.breath = 0.04
    const stress = rng.chance(0.3) ? 1 : 0
    p.sylAmp = rng.range(0.55, 0.85) + 0.3 * stress
    // Declination: a phrase starts high and settles as it goes.
    const prog = p.phraseI / Math.max(1, p.phraseN - 1)
    p.pitch = p.f0 * (1.14 - 0.26 * prog) * (1 + 0.1 * stress) * (1 + 0.025 * rng.gauss())
    if (rng.chance(0.45)) {
      // A consonant: a short hiss ahead of the vowel.
      p.fric = rng.range(0.2, 0.45)
      p.fricDecay = Math.exp(-1 / (rng.range(0.02, 0.06) * sr))
    }
  }

  function startPhrase(p: Talker, laugh: boolean) {
    p.talking = true
    p.laughing = laugh
    p.phraseN = laugh ? 4 + rng.int(5) : 3 + rng.int(12)
    p.phraseI = 0
    startSyllable(p)
  }

  // The room and its crockery.
  const roomL = new Pink(), roomR = new Pink()
  const roomFL = new OnePole().set(480, sr), roomFR = new OnePole().set(520, sr)
  const crock = new Pings(48)
  let untilCup = rng.exp(3), untilStir = rng.exp(18), untilCutlery = rng.exp(4), untilLaugh = rng.range(12, 30)
  let stirLeft = 0, stirGap = 0, stirPan = 0, stirF = 5000
  // The counter: the steam wand and the grinder.
  const steamA = new Svf(), steamB = new Svf().set(7400, 2, sr)
  const steamAm = new OnePole().set(18, crate)
  const grindN = new Svf().set(2800, 1.3, sr)
  const grindM = new Saw(), grindF = new Svf().set(1100, 2, sr)
  let machine = 0, machineT = 0, machineDur = 0, untilMachine = rng.range(20, 50)
  let grindPh = 0
  const counterL = panL(0.55), counterR = panR(0.55)

  function cup(pan: number, amp: number, delay = 0) {
    const f = rng.range(2400, 3600)
    crock.add(sr, f, amp, 0.16, 0, pan, 0.02, delay)
    crock.add(sr, f * 2.32, amp * 0.55, 0.08, 0, pan, 0.02, delay)
    crock.add(sr, f * 4.25, amp * 0.3, 0.045, 0, pan, 0.05, delay)
  }

  return {
    render(L, R, n) {
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)

        // ---- conversation ---------------------------------------------------
        for (let gi = 0; gi < groups.length; gi++) {
          const g = groups[gi]
          if (g.floor < 0) {
            g.gap -= dt
            if (g.gap <= 0) {
              // Usually the other person answers; sometimes the speaker goes on.
              let k = rng.int(g.members.length)
              if (k === g.last && rng.chance(0.65)) k = (k + 1 + rng.int(g.members.length - 1)) % g.members.length
              g.floor = k
              g.last = k
              startPhrase(g.members[k], false)
            }
          }
          for (let k = 0; k < g.members.length; k++) {
            const p = g.members[k]
            if (!p.talking) {
              // The odd overlap: someone chips in over the speaker.
              if (g.floor >= 0 && k !== g.floor && rng.next() < 0.03 * dt) startPhrase(p, false)
              continue
            }
            p.sylT += dt
            if (p.sylT >= p.sylDur) {
              p.phraseI++
              if (p.phraseI >= p.phraseN) {
                p.talking = false
                p.laughing = false
                if (g.floor === k) {
                  g.floor = -1
                  g.gap = rng.chance(0.15) ? rng.range(1.2, 3.5) : rng.range(0.12, 0.7)
                }
              } else if (!p.laughing && rng.chance(0.08)) {
                // A breath in the middle of a phrase.
                p.sylT = -rng.range(0.15, 0.35)
                p.sylAmp = 0
              } else startSyllable(p)
            }
          }
        }
        if ((untilLaugh -= dt) <= 0) {
          const g = rng.pick(groups)
          for (const p of g.members) if (rng.chance(0.7)) startPhrase(p, true)
          untilLaugh = rng.range(25, 70)
        }

        // Formants glide towards their targets (coarticulation), voice by voice.
        for (const p of talkers) {
          const x = p.sylT / p.sylDur
          const target = p.talking && x >= 0 ? Math.sin(Math.PI * Math.min(1, x)) ** 0.6 * p.sylAmp : 0
          p.env += (target - p.env) * 0.35
          if (p.env < 1e-3 && p.fric < 1e-3) continue
          p.F1 += (p.T1 - p.F1) * 0.09
          p.F2 += (p.T2 - p.F2) * 0.09
          p.f1.set(p.F1, p.F1 / 90, sr)
          p.f2.set(p.F2, p.F2 / 110, sr)
        }

        // ---- crockery and the counter -------------------------------------
        if ((untilCup -= dt) <= 0) {
          const pan = rng.bi() * 0.8, amp = rng.range(0.04, 0.12)
          cup(pan, amp)
          if (rng.chance(0.3)) cup(pan, amp * 0.6, rng.range(0.04, 0.09))
          untilCup = rng.exp(3.2)
        }
        if ((untilCutlery -= dt) <= 0) {
          crock.add(sr, rng.range(6000, 9000), rng.range(0.012, 0.03), 0.02, 0, rng.bi() * 0.8, 0.1)
          untilCutlery = rng.exp(4)
        }
        if ((untilStir -= dt) <= 0) {
          stirLeft = 5 + rng.int(5); stirGap = 0; stirPan = rng.bi() * 0.7; stirF = rng.range(4800, 6800)
          untilStir = rng.exp(22) + 4
        }
        if (stirLeft > 0 && (stirGap -= dt) <= 0) {
          crock.add(sr, stirF * rng.range(0.98, 1.02), rng.range(0.015, 0.035), 0.05, 0, stirPan, 0.02)
          stirLeft--
          stirGap = rng.range(0.18, 0.27)
        }
        if (machine === 0 && (untilMachine -= dt) <= 0) {
          machine = rng.chance(0.6) ? 1 : 2
          machineT = 0
          machineDur = machine === 1 ? rng.range(5, 9) : rng.range(3.5, 6)
        }
        let mg = 0
        if (machine) {
          machineT += dt
          const x = machineT
          mg = Math.min(1, x / 0.15) * Math.min(1, Math.max(0, (machineDur - x) / 0.3))
          if (machine === 1) steamA.set(2600 + 900 * Math.min(1, x / machineDur), 1.4, sr)
          if (x >= machineDur) { machine = 0; untilMachine = rng.range(35, 100) }
        }
        const stretch = machine === 1 && machineT < machineDur * 0.4
        const am = stretch ? Math.max(0, 0.45 + steamAm.lp(rng.bi()) * 30) : 1

        // ---- samples --------------------------------------------------------
        for (let i = i0; i < i0 + m; i++) {
          let l = 0, r = 0
          for (const p of talkers) {
            if (p.env < 1e-3 && p.fric < 1e-3) continue
            const s = p.tilt.lp(p.saw.next(p.pitch, sr))
            const voiced = (p.f1.band(s) + p.f2.band(s) * 0.72 + p.f3.band(s) * 0.38) * p.env
            let noise = 0
            if (p.fric > 1e-3 || p.breath > 0.1) {
              const w = rng.bi()
              p.fricF.run(w)
              noise = p.fricF.hp * p.fric + p.f1.band(w) * p.breath * p.env * 0.6
              p.fric *= p.fricDecay
            }
            const v = p.dist.lp(voiced * 2.2 + noise) * p.gain
            l += v * p.gl
            r += v * p.gr
          }
          l += roomFL.lp(roomL.next(rng.bi())) * 0.1
          r += roomFR.lp(roomR.next(rng.bi())) * 0.1
          if (machine === 1) {
            const w = rng.bi()
            const st = (steamA.band(w) + steamB.band(w) * 0.4) * 0.05 * mg * am
            l += st * counterL
            r += st * counterR
          } else if (machine === 2) {
            grindPh += 23 / sr
            if (grindPh >= 1) grindPh -= 1
            const burr = 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * 2 * grindPh))
            const gr = (grindN.band(rng.bi()) * burr + grindF.band(grindM.next(148, sr)) * 0.5) * 0.04 * mg
            l += gr * counterL
            r += gr * counterR
          }
          crock.tick(rng)
          L[i] = l + crock.l
          R[i] = r + crock.r
        }
      }
    },
  }
}

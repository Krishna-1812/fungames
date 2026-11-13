/**
 * Birdsong.
 *
 * A songbird sings through a syrinx, which makes something close to a pure
 * tone and bends it fast and far: sweeps of an octave in a tenth of a second,
 * trills of twenty notes a second, warbles. So a bird here is a single
 * oscillator — a sine, with a little second harmonic — driven along a
 * frequency path, and the art is all in the paths.
 *
 * Each bird has its own voice (a body size, so a pitch range) and its own
 * small repertoire of songs, built from five kinds of syllable: whistles,
 * sweeps, trills, warbles and chips. And it sings the way real songbirds do:
 * the same song several times over, each time very slightly different, then
 * a switch to another of its songs. Birds near each other tend not to talk
 * over one another, so a bird about to start will often wait for a neighbour
 * to finish.
 *
 * Four birds are close, each in its own place; five more are further off —
 * quieter, duller and wetter with distance — and make the chorus behind.
 */
import { CR, OnePole, panL, panR, type Rng, type Source, type SourceCtx } from './dsp'

/** One syllable: a glide from f0 to f1 with optional vibrato, then a gap. */
type Syl = { f0: number; f1: number; dur: number; gap: number; fm: number; dev: number; amp: number; sharp: number }
type Song = Syl[]

function makeSong(rng: Rng, s: number): Song {
  const out: Song = []
  const kind = rng.int(5)
  const r = (a: number, b: number) => rng.range(a, b) * s
  if (kind === 0) {
    // Whistled phrase: a few clear notes, stepping, maybe a trill to end.
    const n = 2 + rng.int(3)
    let f = r(2300, 3800)
    for (let i = 0; i < n; i++) {
      const g = f * rng.range(0.9, 1.12)
      out.push({ f0: f, f1: g, dur: rng.range(0.16, 0.4), gap: rng.range(0.05, 0.14), fm: 5, dev: f * 0.006, amp: 1, sharp: 0 })
      f = g * rng.range(0.82, 1.2)
    }
  } else if (kind === 1) {
    // A trill: an introductory note, then a run of quick falling notes that
    // speeds up as it goes.
    out.push({ f0: r(3000, 4200), f1: r(3200, 4600), dur: 0.12, gap: 0.06, fm: 0, dev: 0, amp: 0.8, sharp: 0 })
    const n = 6 + rng.int(9)
    const top = r(4200, 5600), bot = r(2600, 3400)
    let d = rng.range(0.035, 0.05)
    for (let i = 0; i < n; i++) {
      out.push({ f0: top, f1: bot, dur: d, gap: d * 0.55, fm: 0, dev: 0, amp: 0.85 + 0.15 * Math.sin(i), sharp: 1 })
      d *= 0.96
    }
  } else if (kind === 2) {
    // Warble: notes with a fast vibrato, wandering in pitch.
    const n = 3 + rng.int(4)
    for (let i = 0; i < n; i++) {
      const f = r(3000, 5000)
      out.push({ f0: f, f1: f * rng.range(0.85, 1.15), dur: rng.range(0.08, 0.2), gap: rng.range(0.03, 0.08), fm: rng.range(18, 36), dev: rng.range(250, 650) * s, amp: 0.9, sharp: 0 })
    }
  } else if (kind === 3) {
    // Chips: short, sharp, falling calls.
    const n = 2 + rng.int(4)
    for (let i = 0; i < n; i++) {
      out.push({ f0: r(6000, 7800), f1: r(3200, 4200), dur: rng.range(0.012, 0.022), gap: rng.range(0.08, 0.2), fm: 0, dev: 0, amp: 0.8, sharp: 1 })
    }
  } else {
    // Two notes, high then low: "tee-yoo".
    const hi = r(3600, 4800)
    out.push({ f0: hi, f1: hi * 1.04, dur: rng.range(0.14, 0.28), gap: rng.range(0.04, 0.1), fm: 0, dev: 0, amp: 1, sharp: 0 })
    out.push({ f0: hi * 0.82, f1: hi * rng.range(0.6, 0.72), dur: rng.range(0.16, 0.32), gap: 0.05, fm: 0, dev: 0, amp: 0.9, sharp: 0 })
  }
  return out
}

class Bird {
  gl = 0.7
  gr = 0.7
  gain = 1
  lp = new OnePole()
  near = true
  songs: Song[] = []
  song = 0
  reps = 0
  rest = 0
  // the song in progress
  cur: Song | null = null
  idx = 0
  end = 0
  t = 0
  inGap = false
  // the oscillator
  ph = 0
  f = 3000
  mul = 1
  fmPh = 0
  speed = 1
  pitch = 1
}

export function birds(c: SourceCtx): Source {
  const { sr, rng } = c
  const crate = sr / CR
  const list: Bird[] = []
  for (let i = 0; i < 9; i++) {
    const b = new Bird()
    b.near = i < 4
    const pan = b.near ? [-0.65, 0.55, -0.15, 0.85][i] : rng.bi() * 0.9
    b.gl = panL(pan)
    b.gr = panR(pan)
    b.gain = b.near ? rng.range(0.7, 1) : rng.range(0.12, 0.26)
    b.lp.set(b.near ? 12000 : rng.range(3500, 5500), sr)
    const size = rng.range(0.8, 1.22)
    const k = 2 + rng.int(2)
    for (let j = 0; j < k; j++) b.songs.push(makeSong(rng, size))
    b.song = rng.int(k)
    b.reps = 2 + rng.int(5)
    b.rest = b.near ? rng.range(0.2, 3) + i * 0.6 : rng.range(1, 8)
    list.push(b)
  }

  function begin(b: Bird, i: number, at: number) {
    if (--b.reps <= 0) {
      b.song = (b.song + 1 + rng.int(b.songs.length - 1)) % b.songs.length
      b.reps = 3 + rng.int(6)
    }
    b.cur = b.songs[b.song]
    b.idx = 0
    // A fifth of repeats lose their last syllable, as real ones do.
    b.end = b.cur.length - (b.cur.length > 3 && rng.chance(0.2) ? 1 : 0)
    b.speed = rng.range(0.96, 1.04)
    b.pitch = rng.range(0.98, 1.02)
    syllable(b, b.cur[0])
    if (b.near) {
      let dur = 0
      for (const s of b.cur) dur += (s.dur + s.gap) / b.speed
      c.emit('song', at, { bird: i, dur })
    }
  }

  function syllable(b: Bird, s: Syl) {
    b.t = 0
    b.inGap = false
    b.f = s.f0 * b.pitch
    b.mul = Math.pow(s.f1 / s.f0, 1 / ((s.dur / b.speed) * sr))
  }

  let singing = 0

  return {
    render(L, R, n, t) {
      for (let i0 = 0; i0 < n; i0 += CR) {
        const m = Math.min(CR, n - i0)
        const dt = 1 / crate
        singing = 0
        for (const b of list) if (b.cur && b.near) singing++
        for (let bi = 0; bi < list.length; bi++) {
          const b = list[bi]
          if (b.cur) continue
          if ((b.rest -= dt) > 0) continue
          // Wait for a neighbour to finish, more often than not.
          if (b.near && singing > 0 && rng.chance(0.75)) { b.rest = rng.range(0.3, 1.2); continue }
          begin(b, bi, t + i0 / sr)
          if (b.near) singing++
        }
        for (let i = i0; i < i0 + m; i++) {
          let l = 0, r = 0
          for (const b of list) {
            const song = b.cur
            if (!song) continue
            const s = song[b.idx]
            const dur = s.dur / b.speed
            b.t += 1 / sr
            if (!b.inGap) {
              const x = b.t / dur
              if (x >= 1) {
                b.inGap = true
                b.t = 0
                continue
              }
              // Sharp syllables start hard and fall; the rest swell and fade.
              const env = s.sharp ? Math.min(1, x * 12) * (1 - x) * (1 - x) : Math.sin(Math.PI * x)
              b.fmPh += (Math.PI * 2 * s.fm) / sr
              const f = b.f + s.dev * Math.sin(b.fmPh)
              b.ph += (Math.PI * 2 * f) / sr
              if (b.ph > 1e4) b.ph -= Math.PI * 2 * 1591
              const sn = Math.sin(b.ph)
              const v = (sn + 0.12 * Math.sin(2 * b.ph)) * env * s.amp * b.gain
              b.f *= b.mul
              const y = b.lp.lp(v)
              l += y * b.gl
              r += y * b.gr
            } else {
              b.lp.lp(0)
              if (b.t >= s.gap / b.speed) {
                b.idx++
                if (b.idx >= b.end) {
                  b.cur = null
                  b.rest = b.near ? rng.range(1.2, 5.5) : rng.range(2, 9)
                } else syllable(b, song[b.idx])
              }
            }
          }
          L[i] = l
          R[i] = r
        }
      }
    },
  }
}

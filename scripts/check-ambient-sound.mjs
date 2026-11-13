/**
 * Checks Ambient Mix's sound models: that they behave, and that the physics
 * they claim is the physics they do.
 *
 * Nobody can listen to a test run, so this listens with numbers. Every layer
 * is rendered offline, exactly as the AudioWorklet renders it, and then:
 *
 *   - Health: nothing is NaN or infinite, nothing has a DC offset, peaks stay
 *     in bounds, and every layer at full volume lands within a few dB of the
 *     others (that is what TRIM in lib/ambient/index.ts is for).
 *   - Determinism: the same seed gives the same sound, sample for sample, so
 *     any failure here can be reproduced.
 *   - Character: each layer's energy is where the real thing's is — thunder
 *     low, crickets and birds high, a modem inside a telephone's band — and
 *     the layers that should surround you are not mono.
 *   - Physics: thunder arrives after its flash by distance over the speed of
 *     sound; the clock ticks on the wall clock's second and strikes its hour;
 *     a car is heard sharp approaching and flat going away, by c/(c ± v);
 *     crickets chirp at Dolbear's rate for the night's temperature; a modem
 *     answers at 2100 Hz.
 *   - Cost: all twelve at once, rendered here, run comfortably faster than
 *     real time, because a phone has to keep up with the same code.
 *
 *   node scripts/check-ambient-sound.mjs [--verbose]
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { SOURCES, TRIM, SEND, createSource, Rng } = await import('../src/lib/ambient/index.ts')
const { LAYERS } = await import('../src/lib/mix-code.ts')
const { heard, SOUND_SPEED } = await import('../src/lib/ambient/traffic.ts')
const { kmFromDelay } = await import('../src/lib/ambient/thunder.ts')
const { dolbear } = await import('../src/lib/ambient/crickets.ts')

const VERBOSE = process.argv.includes('--verbose')
const SR = 48000
let failures = 0
const report = (label, ok, extra = '') => {
  if (!ok) failures++
  if (!ok || VERBOSE) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}

/** Render a layer the way the worklet does: 128 frames at a time. */
function render(id, seconds, { seed = 11, wall = 0, trimmed = true } = {}) {
  const N = Math.floor(seconds * SR)
  const L = new Float32Array(N), R = new Float32Array(N)
  const events = []
  const ctx = { sr: SR, rng: new Rng(seed), emit: (kind, at, data) => events.push({ kind, at, ...data }), wall: () => wall }
  const src = trimmed ? createSource(id, ctx) : SOURCES[id](ctx)
  const bl = new Float32Array(128), br = new Float32Array(128)
  for (let i = 0; i < N; i += 128) {
    const m = Math.min(128, N - i)
    src.render(bl, br, m, i / SR)
    L.set(bl.subarray(0, m), i)
    R.set(br.subarray(0, m), i)
  }
  return { L, R, events, src }
}

/** RMS of windows of `w` seconds. */
function windows(L, R, w = 0.4) {
  const W = Math.floor(w * SR), out = []
  for (let i = 0; i + W <= L.length; i += W) {
    let e = 0
    for (let j = i; j < i + W; j++) e += (L[j] * L[j] + R[j] * R[j]) / 2
    out.push(Math.sqrt(e / W))
  }
  return out
}

/** Energy-weighted mean frequency, from a crude DFT over a few hundred frames. */
function centroid(L, R) {
  const F = 1024, hop = Math.max(F, Math.floor((L.length - F) / 300))
  let num = 0, den = 0
  for (let s = 0; s + F <= L.length; s += hop) {
    const x = new Float64Array(F)
    for (let k = 0; k < F; k++) x[k] = (L[s + k] + R[s + k]) * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / F))
    for (let b = 2; b < F / 2; b += 2) {
      let re = 0, im = 0
      const w = (2 * Math.PI * b) / F
      for (let k = 0; k < F; k++) { re += x[k] * Math.cos(w * k); im -= x[k] * Math.sin(w * k) }
      const p = re * re + im * im
      num += p * ((b * SR) / F)
      den += p
    }
  }
  return den > 0 ? num / den : 0
}

/** The strongest frequency in a stretch, by DFT on a fine grid. */
function peakFreq(x, lo, hi, step = 5) {
  let best = 0, bestF = 0
  for (let f = lo; f <= hi; f += step) {
    let re = 0, im = 0
    const w = (2 * Math.PI * f) / SR
    for (let k = 0; k < x.length; k++) { re += x[k] * Math.cos(w * k); im -= x[k] * Math.sin(w * k) }
    const p = re * re + im * im
    if (p > best) { best = p; bestF = f }
  }
  return bestF
}

console.log('Ambient Mix: the sound models')

// ---- the registry matches the mixer ------------------------------------------
{
  const ids = LAYERS.map((l) => l.id).sort().join(',')
  report('every mixer layer has a model, and nothing else does', Object.keys(SOURCES).sort().join(',') === ids)
  report('every layer has a trim and a reverb send', LAYERS.every((l) => TRIM[l.id] > 0 && SEND[l.id] >= 0 && SEND[l.id] <= 1))
}

// ---- health, loudness, character ---------------------------------------------
const SECONDS = { thunder: 70, dial: 40, clock: 20 }
/** Where each layer's energy should centre, in Hz. */
const CENTROID = {
  rain: [1500, 6000], waves: [500, 2500], wind: [400, 3000], fire: [300, 3500], cafe: [300, 1500],
  birds: [2000, 6500], crickets: [3500, 6500], traffic: [300, 2000], clock: [200, 4500],
  thunder: [30, 400], mower: [200, 3000], dial: [700, 2600],
}
/** Layers that should surround you rather than sit in one place. */
const WIDE = ['rain', 'waves', 'wind', 'cafe', 'traffic', 'birds']
const loudness = {}
for (const l of LAYERS) {
  const id = l.id
  const { L, R } = render(id, SECONDS[id] ?? 20)
  let bad = 0, peak = 0, dc = 0, sl = 0, sr = 0, slr = 0
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = R[i]
    if (!Number.isFinite(a) || !Number.isFinite(b)) bad++
    peak = Math.max(peak, Math.abs(a), Math.abs(b))
    dc += a + b
    sl += a * a; sr += b * b; slr += a * b
  }
  dc /= L.length * 2
  const w = windows(L, R).sort((a, b) => b - a)
  // Loudness while it is sounding: the louder half of the time (the loudest
  // eighth for thunder, which is mostly waiting for the next strike).
  const frac = id === 'thunder' ? 0.12 : 0.5
  const top = w.slice(0, Math.max(1, Math.floor(w.length * frac)))
  const loud = Math.sqrt(top.reduce((a, b) => a + b * b, 0) / top.length)
  loudness[id] = loud
  const corr = slr / Math.sqrt(sl * sr + 1e-12)
  const c = centroid(L, R)
  report(`${id}: finite`, bad === 0, bad ? `${bad} bad samples` : '')
  report(`${id}: no DC offset`, Math.abs(dc) < 0.004, dc.toExponential(1))
  report(`${id}: peaks in bounds`, peak < 1.9, `peak ${peak.toFixed(2)}`)
  report(`${id}: energy centred where the real thing's is`, c >= CENTROID[id][0] && c <= CENTROID[id][1], `${Math.round(c)} Hz`)
  if (WIDE.includes(id)) report(`${id}: wide, not mono`, corr < 0.9, `L/R correlation ${corr.toFixed(2)}`)
}
{
  const ids = Object.keys(loudness)
  const quiet = ['clock', 'crickets', 'fire']
  const main = ids.filter((id) => !quiet.includes(id))
  const db = (x) => 20 * Math.log10(x)
  const lo = Math.min(...main.map((id) => db(loudness[id]))), hi = Math.max(...main.map((id) => db(loudness[id])))
  report('layers at full volume within 6 dB of each other', hi - lo < 6, `${(hi - lo).toFixed(1)} dB spread`)
  report('the clicky layers sit under the rest, not over', quiet.every((id) => db(loudness[id]) < hi))
  if (VERBOSE) console.log('    loudness (dBFS):', ids.map((id) => `${id} ${db(loudness[id]).toFixed(1)}`).join(', '))
}

// ---- determinism --------------------------------------------------------------
for (const id of ['rain', 'cafe', 'thunder', 'traffic']) {
  const a = render(id, 2, { seed: 5 }), b = render(id, 2, { seed: 5 }), c = render(id, 2, { seed: 6 })
  let same = true, diff = false
  for (let i = 0; i < a.L.length; i++) {
    if (a.L[i] !== b.L[i] || a.R[i] !== b.R[i]) same = false
    if (a.L[i] !== c.L[i]) diff = true
  }
  report(`${id}: the same seed gives the same sound, another seed another`, same && diff)
}

// ---- thunder: the flash, then the sound ---------------------------------------
{
  report('three seconds of flash-to-bang is a kilometre', Math.abs(kmFromDelay(3) - 1.029) < 0.001)
  let checked = 0, good = 0
  for (const seed of [3, 7, 19]) {
    const { L, R, events } = render('thunder', 70, { seed })
    for (const e of events) {
      if (e.kind !== 'flash' || e.far) continue
      const arrive = e.at + e.delay
      if (arrive + 0.5 > 70) continue
      checked++
      // Silent between flash and arrival (bar earlier rumbles), loud after.
      const W = Math.floor(0.05 * SR)
      const level = (t) => {
        const i = Math.floor(t * SR)
        let s = 0
        for (let j = i; j < i + W; j++) s += L[j] * L[j] + R[j] * R[j]
        return Math.sqrt(s / W / 2)
      }
      const before = level(arrive - 0.35), after = Math.max(level(arrive + 0.05), level(arrive + 0.15), level(arrive + 0.3))
      // The delay itself is distance over sound speed: the nearest part of
      // the channel can be a few hundred metres nearer than the ground point.
      const physical = e.delay <= (e.km * 1000 + 50) / SOUND_SPEED && e.delay >= (e.km * 1000 - 1600) / SOUND_SPEED
      if (after > before * 4 && physical) good++
      else if (VERBOSE) console.log('    thunder', JSON.stringify({ seed, km: e.km, delay: e.delay, before, after }))
    }
  }
  report('every near strike is heard when distance / 343 m/s says, not before', checked >= 3 && good === checked, `${good}/${checked}`)
}

// ---- the clock: on the real second, and the hour ------------------------------
{
  // Ticks, away from any hour: 00:16:40.37 at t = 0.
  const wall = 1000.37
  const { L } = render('clock', 6, { wall })
  const onsets = []
  let last = -1
  for (let i = 1; i < L.length; i++) {
    if (Math.abs(L[i]) > 0.05 && i - last > SR * 0.3) { onsets.push(i / SR); last = i }
    else if (Math.abs(L[i]) > 0.05) last = i
  }
  const frac = onsets.map((t) => (((t + wall) % 1) + 1) % 1)
  report('clock ticks once a second', onsets.length >= 5 && onsets.length <= 7, `${onsets.length} in 6 s`)
  report('clock ticks on the wall clock\'s second', frac.every((f) => f < 0.02 || f > 0.995), frac.map((f) => f.toFixed(3)).join(' '))
  // And the hour: 00:59:57.6 at t = 0, so one o'clock falls at t = 2.4 s.
  const hour = render('clock', 6, { wall: 3600 - 2.4 }).L
  const gong = peakFreq(hour.subarray(Math.floor(3.1 * SR), Math.floor(4 * SR)), 150, 250, 2)
  // The gong's own note, before the hour and after it.
  const note = (a, b) => {
    const x = hour.subarray(Math.floor(a * SR), Math.floor(b * SR))
    let re = 0, im = 0
    const w = (2 * Math.PI * 196) / SR
    for (let k = 0; k < x.length; k++) { re += x[k] * Math.cos(w * k); im -= x[k] * Math.sin(w * k) }
    return re * re + im * im
  }
  report('clock strikes its gong on the hour, and not before', Math.abs(gong - 196) < 6 && note(3.1, 4) > 100 * note(1, 1.9), `${gong} Hz after the hour`)
}

// ---- traffic: Doppler and delay ----------------------------------------------
{
  const v = 30, far = heard(-2000, 120, v), gone = heard(2000, 120, v)
  report('an approaching car is heard sharp by c/(c−v)', Math.abs(far.doppler - SOUND_SPEED / (SOUND_SPEED - v)) < 0.002, far.doppler.toFixed(4))
  report('a receding car is heard flat by c/(c+v)', Math.abs(gone.doppler - SOUND_SPEED / (SOUND_SPEED + v)) < 0.002, gone.doppler.toFixed(4))
  const abreast = heard(0, 120, v)
  report('a car level with you is still heard where it was, a beat ago', abreast.pan < -0.05 && abreast.doppler > 1)
  const { events } = render('traffic', 60)
  const cars = events.filter((e) => e.kind === 'car')
  report('traffic flows both ways at motorway speeds', cars.some((e) => e.v > 0) && cars.some((e) => e.v < 0) && cars.every((e) => Math.abs(e.v) >= 20 && Math.abs(e.v) <= 37), `${cars.length} vehicles a minute`)
}

// ---- crickets: Dolbear's law -------------------------------------------------
{
  report('Dolbear: 40 chirps a minute at 50 °F (10 °C)', Math.abs(dolbear(10) - 40) < 1e-9)
  report('Dolbear: warmer is faster', dolbear(25) > dolbear(18))
  for (const seed of [2, 9]) {
    const { src } = render('crickets', 0.1, { seed })
    const s = src.state()
    report(`crickets (seed ${seed}) chirp at the rate their temperature says`, Math.abs(s.perMin - dolbear(s.temp)) < 1e-9 && s.temp >= 18 && s.temp <= 28, `${s.temp} °C, ${s.perMin.toFixed(0)}/min`)
  }
}

// ---- waves: irregular, not a metronome ---------------------------------------
{
  const { events } = render('waves', 120)
  const at = events.filter((e) => e.kind === 'wave').map((e) => e.at)
  const gaps = at.slice(1).map((t, i) => t - at[i])
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length)
  report('waves break every six to fourteen seconds', gaps.every((g) => g > 5.5 && g < 14.5), gaps.map((g) => g.toFixed(1)).join(' '))
  report('and never like clockwork', sd > 0.6, `sd ${sd.toFixed(2)} s`)
}

// ---- the modem answers at 2100 Hz --------------------------------------------
{
  const { L, events } = render('dial', 14)
  const ans = events.find((e) => e.kind === 'modem' && e.stage === 5)
  if (!ans) report('modem reaches its answer tone', false)
  else {
    const seg = L.subarray(Math.floor((ans.at + 0.1) * SR), Math.floor((ans.at + 0.4) * SR))
    const f = peakFreq(seg, 1800, 2400, 5)
    report('modem answers at 2100 Hz', Math.abs(f - 2100) <= 10, `${f} Hz`)
  }
  const dial = events.find((e) => e.kind === 'modem' && e.stage === 1)
  if (dial) {
    const seg = L.subarray(Math.floor((dial.at + 0.2) * SR), Math.floor((dial.at + 0.5) * SR))
    const f = peakFreq(seg, 300, 500, 5)
    report('and dials from a 350 + 440 Hz dial tone', f === 350 || f === 440, `${f} Hz`)
  }
}

// ---- cost ---------------------------------------------------------------------
{
  const srcs = LAYERS.map((l, i) => createSource(l.id, { sr: SR, rng: new Rng(100 + i), emit: () => {}, wall: () => 0 }))
  const L = new Float32Array(128), R = new Float32Array(128)
  const secs = 10
  const t0 = performance.now()
  for (let i = 0; i < secs * SR; i += 128) for (const s of srcs) s.render(L, R, 128, i / SR)
  const share = (performance.now() - t0) / (secs * 1000)
  report('all twelve at once render well inside real time', share < 0.5, `${(share * 100).toFixed(1)}% of real time`)
}

if (failures) {
  console.log(`\n${failures} check(s) failed.`)
  process.exitCode = 1
} else console.log('  all sound checks passed')

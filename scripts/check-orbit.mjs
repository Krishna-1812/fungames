/**
 * Checks Orbit's integrator and its eight challenges.
 *
 * Two separate jobs, and the first is the reason the second can be trusted.
 *
 * The integrator is checked against closed-form answers: the softened field
 * has a circular speed that can be derived on paper, so launching at exactly
 * that speed must produce a circle, and launching at the textbook Kepler speed
 * must not. That second assertion is a regression test for a real bug — the
 * presets used sqrt(GM/r) for years, which is 10% too fast at the innermost
 * radius, and every inner planet visibly wobbled because of it. Momentum and
 * mass are checked across a merge, and energy across ten thousand steps.
 *
 * The challenges are then driven headlessly through the same physics the page
 * runs, at the same two-substeps-per-frame cadence. Each one is checked twice:
 * once on a system built to satisfy it, and once on a system built to look
 * like it but fail. The slingshot is the clearest case — the identical orbit
 * with the heavy companion removed must never complete it, because a two-body
 * encounter cannot change a body's energy and the challenge is only meaningful
 * if it is really measuring a third body doing work.
 *
 *   node scripts/check-orbit.mjs [--verbose]
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  makeBody, resetIds, step, circularV, escapeV, radiusFor,
  totalEnergy, bodyEnergy, barycentre, G, SOFT, STAR_MASS,
} = await import('../src/lib/orbit-sim.ts')
const { GOALS, GOAL_IDS, Tracker } = await import('../src/lib/orbit-goals.ts')

const VERBOSE = process.argv.includes('--verbose')

let failures = 0
const report = (label, ok, extra = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}
const near = (label, got, want, tol) =>
  report(label, Math.abs(got - want) <= tol, `${fmt(got)} vs ${fmt(want)} ±${fmt(tol)}`)
const fmt = (n) => (Number.isFinite(n) ? (Math.abs(n) < 0.01 ? n.toExponential(2) : n.toFixed(4)) : String(n))

const W = 900, H = 600, CX = 450, CY = 300

/**
 * One frame of the page: two half-steps, then one look at the tracker.
 * Splitting the step is not cosmetic — it is what keeps a fast close pass
 * accurate, and running the checker at a different cadence would be checking
 * a simulation nobody plays.
 */
function frame(bodies, tracker, sub = 2) {
  const ev = { merges: [], escaped: [] }
  for (let s = 0; s < sub; s++) {
    const r = step(bodies, 1 / sub, W, H)
    bodies = r.bodies
    ev.merges.push(...r.events.merges)
    ev.escaped.push(...r.events.escaped)
  }
  const won = tracker ? tracker.observe(bodies, ev) : []
  return { bodies, ev, won }
}

/** Drive a system for `frames` frames and collect every challenge it earns. */
function run(bodies, frames, { stopOn = null } = {}) {
  const tracker = new Tracker()
  const won = new Set()
  let cur = bodies
  let stoppedAt = null
  for (let f = 0; f < frames; f++) {
    const r = frame(cur, tracker)
    cur = r.bodies
    for (const id of r.won) won.add(id)
    if (stopOn && won.has(stopOn) && stoppedAt === null) { stoppedAt = f; break }
  }
  return { won, bodies: cur, tracker, stoppedAt }
}

/** Shape of the orbit of `bodies[i]` about `bodies[0]`, over one full lap. */
function lapStats(bodies, maxFrames = 6000, sub = 2) {
  let cur = bodies
  const TAU = Math.PI * 2
  const wrap = (a) => (((a + Math.PI) % TAU) + TAU) % TAU - Math.PI
  const at = () => {
    const p = cur[0], b = cur[1]
    return { r: Math.hypot(b.x - p.x, b.y - p.y), a: Math.atan2(b.y - p.y, b.x - p.x) }
  }
  let s = at()
  let swept = 0, last = s.a, rmin = s.r, rmax = s.r, frames = 0
  for (let f = 0; f < maxFrames; f++) {
    cur = frame(cur, null, sub).bodies
    if (cur.length < 2) return { rmin, rmax, frames: null, merged: true }
    const now = at()
    swept += wrap(now.a - last)
    last = now.a
    rmin = Math.min(rmin, now.r)
    rmax = Math.max(rmax, now.r)
    frames = f + 1
    if (Math.abs(swept) >= TAU) return { rmin, rmax, frames, merged: false }
  }
  return { rmin, rmax, frames: null, merged: false }
}

/** A star with one satellite launched tangentially at `k` times circular. */
function twoBody(r, k, m = 6, M = 2600, mine = true) {
  resetIds()
  return [
    makeBody(CX, CY, 0, 0, M),
    makeBody(CX + r, CY, 0, circularV(M, r) * k, m, mine),
  ]
}

console.log(`\n${GOALS.length} challenges, softening length ${SOFT}, G = ${G}\n`)

/* -------------------------------------------------------------------------- */
/* The field                                                                  */
/* -------------------------------------------------------------------------- */

console.log('the softened field, against closed form')

// v² = GMr²/(r²+s²)^(3/2), derived in orbit-sim.ts. Confirm the function
// really solves the centripetal condition rather than approximating it.
for (const r of [70, 145, 300]) {
  const v = circularV(2600, r)
  const a = (G * 2600 * r) / Math.pow(r * r + SOFT * SOFT, 1.5)
  near(`r=${r}: v²/r equals the softened acceleration`, (v * v) / r, a, a * 1e-12)
}

near('escape speed is √2 × circular only when softening is irrelevant',
  escapeV(2600, 4000) / circularV(2600, 4000), Math.SQRT2, 0.02)

// The bug this is a regression test for.
const kepler = Math.sqrt(2600 / 70)
report('the Kepler speed is measurably wrong here', kepler / circularV(2600, 70) > 1.09,
  `${((kepler / circularV(2600, 70) - 1) * 100).toFixed(1)}% too fast at r=70`)

/* -------------------------------------------------------------------------- */
/* The integrator                                                             */
/* -------------------------------------------------------------------------- */

console.log('\nthe integrator')

const circ = lapStats(twoBody(145, 1))
const wobble = circ.rmax / circ.rmin - 1
report('circular speed gives a circle', wobble < 0.02,
  `apoapsis/periapsis ${(circ.rmax / circ.rmin).toFixed(5)}`)
report('...well inside the band the challenges use', wobble < 0.25 / 5,
  `${(wobble * 100).toFixed(2)}% of wobble against a 25% threshold`)

// A circle that is 1.4% out is only reassuring if the 1.4% is accounted for.
// There are exactly two sources and they can be separated.
//
// The first is the step size. Semi-implicit Euler is first order, so halving
// dt must *halve* the radial error — not reduce it by some unspecified amount.
// That is a strong claim and it either holds or the integrator is not the one
// the header says it is.
const exact = (r) => {
  resetIds()
  return [
    makeBody(CX, CY, 0, 0, 2600),
    makeBody(CX + r, CY, 0, circularV(2606, r), 6, true),
  ]
}
const conv = [2, 4, 8, 16].map((sub) => {
  const l = lapStats(exact(145), 20000, sub)
  return l.rmax / l.rmin - 1
})
const halving = conv.slice(1).map((v, i) => v / conv[i])
report('halving the step halves the error, as first order demands',
  halving.every((h) => h > 0.45 && h < 0.55),
  halving.map((h) => h.toFixed(3)).join(', '))
if (VERBOSE) console.log('       wobble by substep:', conv.map((c) => (c * 100).toFixed(4) + '%').join('  '))

// The second source only appears once the first is driven down. `circularV`
// is a test-particle formula and this primary is not infinitely heavy: both
// bodies turn about their barycentre, so the correct relative speed uses
// M + m. Launching at circularV(M) is slow by exactly the mass ratio, and a
// tangential launch at k times circular leaves an eccentricity of |k² − 1|.
// So the residual that refuses to shrink should be m/(M+m) and nothing else.
const floor = (() => { const l = lapStats(twoBody(145, 1), 20000, 32); return l.rmax / l.rmin - 1 })()
const e = 6 / 2606
near('what is left over is the mass ratio, not the arithmetic',
  floor, (1 + e) / (1 - e) - 1, 0.0006)

const wrong = lapStats(twoBody(70, kepler / circularV(2600, 70)))
report('the Kepler speed gives a visible ellipse', wrong.rmax / wrong.rmin > 1.2,
  `apoapsis/periapsis ${(wrong.rmax / wrong.rmin).toFixed(3)}`)

// One lap of a circle is 2πr/v, in sim time. Each frame advances sim time by
// 1.0, so the frame count is the period.
const wantPeriod = (2 * Math.PI * 145) / circularV(2600, 145)
near('the period matches 2πr/v', circ.frames, wantPeriod, wantPeriod * 0.02)

{
  let cur = twoBody(190, 1)
  const e0 = totalEnergy(cur)
  for (let f = 0; f < 5000; f++) cur = frame(cur, null).bodies
  const drift = Math.abs((totalEnergy(cur) - e0) / e0)
  report('energy holds over ten thousand steps', drift < 0.005,
    `drift ${(drift * 100).toFixed(4)}%`)
  report('nothing was lost on the way', cur.length === 2)
}

{
  // Two bodies on a collision course. Momentum and mass are exactly conserved
  // by the merge rule, so this is a float-precision assertion, not a tolerance.
  resetIds()
  let cur = [makeBody(CX - 60, CY, 1.2, 0.3, 40), makeBody(CX + 60, CY, -0.4, -0.1, 90)]
  const p0 = { x: cur.reduce((s, b) => s + b.m * b.vx, 0), y: cur.reduce((s, b) => s + b.m * b.vy, 0) }
  const m0 = cur.reduce((s, b) => s + b.m, 0)
  let merged = false
  for (let f = 0; f < 400 && !merged; f++) {
    const r = frame(cur, null)
    cur = r.bodies
    merged = r.ev.merges.length > 0
  }
  report('they actually collided', merged)
  const p1 = { x: cur.reduce((s, b) => s + b.m * b.vx, 0), y: cur.reduce((s, b) => s + b.m * b.vy, 0) }
  near('merging conserves momentum (x)', p1.x, p0.x, 1e-9)
  near('merging conserves momentum (y)', p1.y, p0.y, 1e-9)
  near('merging conserves mass', cur.reduce((s, b) => s + b.m, 0), m0, 1e-12)
  near('the survivor gets the combined radius', cur[0].r, radiusFor(m0), 1e-12)
}

{
  // The threshold is set by the *pair's* mass, not the star's. Launching at
  // escapeV(M) alone leaves a body a tenth of a percent short and it stays
  // bound — which is the correct answer, and the reason both helpers say in
  // their doc comments that they are test-particle formulas.
  const r = 200
  const k = (v) => v / circularV(2600, r)
  const out = twoBody(r, k(escapeV(2606, r) * 1.02))
  const marginal = twoBody(r, k(escapeV(2606, r)))
  const stay = twoBody(r, k(escapeV(2600, r) * 0.95))
  report('past the pair escape speed the body reads unbound', bodyEnergy(out[1], out) > 0)
  report('below it the body reads bound', bodyEnergy(stay[1], stay) < 0)
  const s = lapStats(stay)
  report('...and the bound one comes back round', s.frames !== null && !s.merged)
  const o = lapStats(out, 3000)
  report('...and the unbound one never does', o.frames === null)

  // `bodyEnergy` charges an escaping body the whole of every pair potential
  // while crediting it only its own kinetic energy, which biases it towards
  // reporting "bound". That is deliberate and documented, and this is the size
  // of the bias: at exactly the escape speed it still reads bound, while the
  // body is in fact already leaving and never comes back. The error is the
  // mass ratio, so it is 0.2% here and would only matter for two bodies of
  // similar weight.
  report('the escaper test errs towards bound, by the mass ratio',
    bodyEnergy(marginal[1], marginal) < 0 && lapStats(marginal, 3000).frames === null,
    `reads bound by ${(-bodyEnergy(marginal[1], marginal)).toExponential(2)} while leaving anyway`)
}

/* -------------------------------------------------------------------------- */
/* The challenges, on systems built to satisfy them                           */
/* -------------------------------------------------------------------------- */

console.log('\nchallenges that should be earned')

{
  const { won } = run(twoBody(145, 1), 400)
  report('a circular lap earns First orbit', won.has('orbit'))
  report('a circular lap earns Round trip', won.has('circle'))
  report('...and is not mistaken for a comet', !won.has('comet'))
  report('...and is not mistaken for a grazing pass', !won.has('graze'))
}

{
  // Launched at 1.34× circular from r=90: apoapsis lands well past 5× periapsis.
  const { won, tracker } = run(twoBody(90, 1.34), 3000)
  report('an eccentric lap earns Long-period comet', won.has('comet'))
  report('...and is not mistaken for a circle', !won.has('circle'))
  report('...and still earns First orbit', won.has('orbit'))
  if (VERBOSE) console.log('       best laps:', tracker.bestLaps)
}

{
  // Dropped from far out with a small sideways nudge, so it whips past the
  // star inside twice the contact distance and comes back. The margin here is
  // narrow in one direction only: below about 1.4 it does not graze, it hits.
  resetIds()
  const bodies = [makeBody(CX, CY, 0, 0, 2600), makeBody(CX + 320, CY, 0, 1.5, 6, true)]
  const { won } = run(bodies, 4000)
  report('a near miss earns Grazing pass', won.has('graze'))
  report('...which is a comet as well', won.has('comet'))
}

{
  // Two equal stars about a shared barycentre. Half the separation each, so
  // the relative orbit is circular at the full separation.
  resetIds()
  const sep = 150, M = 400
  const v = circularV(2 * M, 2 * sep) / 2
  const bodies = [
    makeBody(CX - sep, CY, 0, v, M, false),
    makeBody(CX + sep, CY, 0, -v, M, true),
  ]
  const { won } = run(bodies, 4000)
  report('two stars about a barycentre earn Binary star', won.has('binary'))
}

{
  // The found slingshot: a heavy companion on a circular orbit at 260, and a
  // small body of mine on a crossing ellipse from 90.
  const build = (withCompanion) => {
    resetIds()
    const b = [makeBody(CX, CY, 0, 0, 2600)]
    if (withCompanion) {
      const R = 260, vc = circularV(2600, R)
      const a = (10 / 12) * Math.PI * 2
      b.push(makeBody(CX + Math.cos(a) * R, CY + Math.sin(a) * R, -Math.sin(a) * vc, Math.cos(a) * vc, 500))
    }
    b.push(makeBody(CX + 90, CY, 0, circularV(2600, 90) * 1.28, 6, true))
    return b
  }
  const withIt = run(build(true), 4000, { stopOn: 'slingshot' })
  report('a captured body thrown out earns Slingshot', withIt.won.has('slingshot'),
    withIt.stoppedAt !== null ? `after ${withIt.stoppedAt} frames` : '')
  // The whole point of the challenge. Take the companion away and the same
  // orbit can never do it, because two bodies cannot change each other's energy.
  const without = run(build(false), 8000)
  report('the same orbit with nothing to steal from cannot', !without.won.has('slingshot'))
  report('...and it stays in orbit instead', without.won.has('orbit'))
}

{
  // Ten laps. A tight orbit gets there sooner: the period grows as the radius
  // over the speed, and the speed falls off with distance, so r=90 laps in 112
  // frames while r=300 takes 644.
  const tight = run(twoBody(90, 1), 1400)
  report('ten laps of a tight orbit earn Ten laps', tight.won.has('laps'),
    `best ${tight.tracker.bestLaps} laps`)
  const wide = run(twoBody(300, 1), 1400)
  report('two laps of a wide one do not', !wide.won.has('laps') && wide.won.has('orbit'),
    `best ${wide.tracker.bestLaps} laps`)
}

{
  /*
   * The solar preset's spacing, which is a claim the page now makes in a
   * comment and so is a claim worth testing.
   *
   * What matters between two neighbouring orbits is not the gap in pixels but
   * the gap in mutual Hill radii — the reach of a planet's own gravity against
   * the star's — and that grows with distance. Equal pixel gaps therefore mean
   * steadily *tighter* spacing where it counts. Geometric gaps hold it constant.
   */
  const SUN = 2600
  const hill = (m, a) => a * Math.cbrt((2 * m) / (3 * SUN))
  const build = (radii, mass) => {
    resetIds()
    const b = [makeBody(CX, CY, 0, 0, SUN)]
    radii.forEach((r, i) => {
      const a = i * 2.39996
      const v = circularV(SUN, r)
      b.push(makeBody(CX + Math.cos(a) * r, CY + Math.sin(a) * r, -Math.sin(a) * v, Math.cos(a) * v, mass))
    })
    let px = 0, py = 0
    for (const x of b) { px += x.m * x.vx; py += x.m * x.vy }
    b[0].vx -= px / b[0].m
    b[0].vy -= py / b[0].m
    return b
  }
  const survives = (bodies, secs) => {
    const r = run(bodies, 60 * secs)
    return r.tracker.merges === 0
  }

  const evenly = [70, 105, 145, 190, 240, 300]
  const gapsOf = (radii) => radii.slice(1).map((r, i) => (r - radii[i]) / hill(14, radii[i]))
  const even = gapsOf(evenly)
  // Two planets need about 2√3 ≈ 3.46 mutual Hill radii between them to be
  // stable at all, and a packed system wants nearer ten.
  report('equal pixel gaps get tighter further out, in the units that matter',
    even.every((g, i) => i === 0 || g < even[i - 1]),
    `${even.map((g) => g.toFixed(1)).join(' → ')} Hill radii`)
  report('...ending below the two-planet stability line of 3.46',
    even[even.length - 1] < 3.46, even[even.length - 1].toFixed(2))
  report('...and that system does not survive a minute', !survives(build(evenly, 14), 60))

  // The page's own numbers: gaps of five mutual Hill radii, from 70 out to
  // whatever fits, which on a desktop-sized field is four planets.
  const ratio = 1 + 5 * Math.cbrt((2 * 14) / (3 * SUN))
  const spaced = []
  for (let r = 70; r <= 415; r *= ratio) spaced.push(Math.round(r))
  const geo = gapsOf(spaced)
  report('geometric gaps hold the separation constant',
    Math.max(...geo) - Math.min(...geo) < 0.2,
    `${geo.map((g) => g.toFixed(2)).join(', ')} Hill radii`)
  report('...and that system runs clean for two minutes', survives(build(spaced, 14), 120),
    `${spaced.length} planets at ${spaced.join(', ')}`)
}

{
  // Six heavy bodies falling straight together. Total 3,600.
  resetIds()
  const b = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    b.push(makeBody(CX + Math.cos(a) * 120, CY + Math.sin(a) * 120, 0, 0, 600, true))
  }
  const { won, bodies } = run(b, 3000)
  report('everything falling together earns Last one standing', won.has('collapse'),
    `${bodies.length} body, mass ${bodies[0]?.m}`)
}

/* -------------------------------------------------------------------------- */
/* ...and on systems built to look like them and fail                         */
/* -------------------------------------------------------------------------- */

console.log('\nchallenges that should not be earned')

{
  const { won } = run(twoBody(145, 1, 6, 2600, false), 600)
  report('a preset body orbiting perfectly earns nothing', won.size === 0,
    won.size ? [...won].join(', ') : '')
}

{
  // Fast enough to leave, so it sweeps well under a full turn on the way past.
  resetIds()
  const bodies = [makeBody(CX, CY, 0, 0, 2600), makeBody(20, 40, 9, 0, 6, true)]
  const { won } = run(bodies, 2000)
  report('a fly-past is not an orbit', !won.has('orbit'))
  report('...and is not a slingshot either', !won.has('slingshot'))
}

{
  // Two stars on opposite sides of a much heavier one. Each sweeps a full turn
  // about the other, and neither is orbiting it.
  resetIds()
  const R = 200, M = 3000, m = 400
  const v = circularV(M, R)
  const bodies = [
    makeBody(CX, CY, 0, 0, M),
    makeBody(CX + R, CY, 0, v, m, true),
    makeBody(CX - R, CY, 0, -v, m, true),
  ]
  const { won } = run(bodies, 3000)
  report('two satellites of a heavier star are not a binary', !won.has('binary'))
  report('...though they are certainly in orbit', won.has('orbit'))
  // The barycentre of the 3000 and either 400 sits 23.5 from the star's
  // centre, and the star's radius is 37.5. It is inside the star, so the
  // small one is going round it, and that is not a binary.
  report('...and the barycentre is the reason', (R * m) / (M + m) < radiusFor(M),
    `barycentre ${((R * m) / (M + m)).toFixed(1)} inside a radius of ${radiusFor(M).toFixed(1)}`)
}

{
  const { won } = run(twoBody(145, 1), 400)
  report('a circle is not a collapse', !won.has('collapse'))
  report('one lap is not ten', !won.has('laps'))
}

/* -------------------------------------------------------------------------- */
/* Bookkeeping                                                                */
/* -------------------------------------------------------------------------- */

console.log('\nthe list itself')

report('eight challenges', GOALS.length === 8, String(GOALS.length))
report('ids are unique', new Set(GOAL_IDS).size === GOAL_IDS.length)
report('all named and briefed', GOALS.every((g) => g.name.length > 3 && g.brief.length > 15))
report('all explain themselves afterwards', GOALS.every((g) => g.note.length > 40))
report('none of the briefs give away the note', GOALS.every((g) => g.brief !== g.note))
report('a star is a star', radiusFor(STAR_MASS) > radiusFor(STAR_MASS - 1))

{
  const t = new Tracker()
  t.load({ done: ['orbit', 'nonsense', 'circle'], bestLaps: 12 })
  report('saved progress round-trips', t.progress().done.join(',') === 'orbit,circle')
  report('junk in a save is ignored', !t.done.has('nonsense'))
  near('the best lap count survives', t.progress().bestLaps, 12, 0)
  t.load({ bestLaps: 3 })
  near('...and never goes backwards', t.progress().bestLaps, 12, 0)
  t.reset()
  report('resetting a run keeps what you earned', t.done.size === 2)
}

{
  // The same start twice must play out identically, or nothing above means
  // anything.
  const a = run(twoBody(90, 1.34), 1200)
  const b = run(twoBody(90, 1.34), 1200)
  report('the simulation is deterministic',
    JSON.stringify([...a.won].sort()) === JSON.stringify([...b.won].sort()) &&
    Math.abs(a.bodies[1].x - b.bodies[1].x) < 1e-12)
}

if (VERBOSE) {
  const com = barycentre(twoBody(145, 1))
  console.log('\n       barycentre of a 2600/6 pair:', fmt(com.x - CX), 'from the star')
  for (const g of GOALS) console.log(`       ${g.id.padEnd(10)} ${g.brief}`)
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)

/**
 * Checks src/lib/telemetry.ts against inputs whose answers are known by hand.
 *
 * I'm Not a Robot is a joke, but the numbers it reads back to you are real
 * measurements of your own input, and a measurement nobody has checked is just
 * a confident-looking number. Run with:
 *
 *   node scripts/check-telemetry.mjs
 */
import {
  pathStats,
  splitStrokes,
  variation,
  gaps,
  circleStats,
  report,
} from '../src/lib/telemetry.ts'

let failures = 0

function check(label, got, expected, tol = 1e-9) {
  const ok =
    Array.isArray(expected)
      ? got !== null && got >= expected[0] && got <= expected[1]
      : typeof expected === 'string' || expected === null || got === null
        ? got === expected
        : Math.abs(got - expected) <= tol
  if (!ok) failures++
  const want = Array.isArray(expected)
    ? `${expected[0]}–${expected[1]}`
    : String(expected)
  const show = typeof got === 'number' ? got.toPrecision(6) : String(got)
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: ${show} (expected ${want})`)
}

/* -------------------------------------------------------------------------- */
/* A path drawn by a script                                                   */
/* -------------------------------------------------------------------------- */

console.log('\nlinear interpolation — 40 samples, 10 px apart, 16 ms apart')

const linear = Array.from({ length: 40 }, (_, i) => ({ x: i * 10, y: 0, t: i * 16 }))
const lin = pathStats(linear)
check('straightness', lin.straightness, 1)
check('jitter', lin.jitter, 0)
// Constant speed peaks at the first interval, so every later sample is
// "correction". That is exactly the shape that should look inhuman.
check('correction', lin.correction, 1)
check('pathLength', lin.pathLength, 390, 1e-6)
check('strokes', lin.strokes, 1)

/* -------------------------------------------------------------------------- */
/* Geometry the answers can be worked out for                                 */
/* -------------------------------------------------------------------------- */

console.log('\nunit zigzag — every interior point sits 1 px off its neighbours chord')

// (0,0) (1,1) (2,0) (3,1)… Each interior point is exactly 1 px from the line
// through the two either side of it. Every step is sqrt(2) long, so the path is
// 29*sqrt(2) long; the ends are (0,0) and (29,1), so displacement is sqrt(842).
const zig = Array.from({ length: 30 }, (_, i) => ({ x: i, y: i % 2, t: i * 16 }))
const zs = pathStats(zig)
check('jitter', zs.jitter, 1, 1e-9)
check('straightness', zs.straightness, Math.sqrt(842) / (29 * Math.SQRT2), 1e-12)

console.log('\nstroke splitting')
const twoStrokes = [
  ...Array.from({ length: 12 }, (_, i) => ({ x: i, y: 0, t: i * 16 })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: i, y: 40, t: 900 + i * 16 })),
]
check('strokes found', splitStrokes(twoStrokes, 250).length, 2)
check('one long pause is not a stroke boundary at 2 s', splitStrokes(twoStrokes, 2000).length, 1)

/* -------------------------------------------------------------------------- */
/* A path drawn by an arm                                                     */
/* -------------------------------------------------------------------------- */

console.log('\nminimum-jerk reach with tremor — the shape a hand actually makes')

// Deterministic, so a failure here is a real regression and not a bad seed.
let seed = 12345
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.4

// Minimum-jerk: speed is symmetric and peaks halfway, which is the classic
// model of a human reaching movement.
const human = Array.from({ length: 45 }, (_, i) => {
  const t = i / 44
  const s = 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5
  return {
    x: s * 420 + gauss() * 1.2,
    // A gentle arc, because nobody moves along a ruler.
    y: Math.sin(t * Math.PI) * 38 + gauss() * 1.2,
    t: i * 16,
  }
})
const hum = pathStats(human)
check('straightness', hum.straightness, [0.55, 0.988])
check('jitter', hum.jitter, [0.08, 8])
check('correction', hum.correction, [0.2, 0.92])

/* -------------------------------------------------------------------------- */
/* Rhythm                                                                     */
/* -------------------------------------------------------------------------- */

console.log('\nrhythm')

check('metronome cv', variation([100, 100, 100, 100, 100, 100]).cv, 0)
const ramp = variation([100, 200, 300, 400, 500, 600])
check('ramp mean', ramp.mean, 350, 1e-9)
check('ramp sd', ramp.sd, Math.sqrt(175000 / 6), 1e-9)
check('ramp cv', ramp.cv, Math.sqrt(175000 / 6) / 350, 1e-9)
// The gap where you stopped to read the question must not become the signal.
check('idle gap dropped', variation([100, 100, 100, 100, 100, 9000]).count, 5)
check('too few intervals is not measured', variation([100, 100, 100]), null)
check('gaps()', gaps([0, 10, 40, 90]).join(','), '10,30,50')

/* -------------------------------------------------------------------------- */
/* Shape                                                                      */
/* -------------------------------------------------------------------------- */

console.log('\nfreehand circle — isoperimetric quotient')

const polygon = (n, fn) => Array.from({ length: n }, (_, i) => fn(i / n))
// A 64-gon on radius 100. 4*pi*A/P^2 works out at 0.99916.
const perfect = polygon(64, (u) => ({
  x: Math.cos(u * Math.PI * 2) * 100,
  y: Math.sin(u * Math.PI * 2) * 100,
}))
check('64-gon roundness', circleStats(perfect).roundness, 0.99916, 5e-5)
check('64-gon closes', circleStats(perfect).gap, [0, 0.12])

// A square is the standard sanity check: pi/4 exactly, and radius-variance
// measures wrongly score it above 0.9.
const square = []
for (let side = 0; side < 4; side++)
  for (let i = 0; i < 25; i++) {
    const u = i / 25
    const pts = [
      [u * 200, 0], [200, u * 200], [200 - u * 200, 200], [0, 200 - u * 200],
    ][side]
    square.push({ x: pts[0], y: pts[1] })
  }
check('square roundness', circleStats(square).roundness, Math.PI / 4, 1e-9)

// A wobbly hand-drawn loop should land clearly between the two.
const wobbly = polygon(70, (u) => {
  const r = 100 + Math.sin(u * Math.PI * 2 * 3) * 9 + gauss() * 2.5
  return { x: Math.cos(u * Math.PI * 2) * r, y: Math.sin(u * Math.PI * 2) * r }
})
check('hand-drawn roundness', circleStats(wobbly).roundness, [0.5, 0.988])

// A straight scribble encloses nothing.
const scribble = polygon(40, (u) => ({ x: u * 300, y: (u * 40) % 6 }))
check('scribble roundness', circleStats(scribble).roundness, [0, 0.1])
check('too few points is not measured', circleStats([{ x: 0, y: 0 }]), null)

/* -------------------------------------------------------------------------- */
/* The verdict                                                                */
/* -------------------------------------------------------------------------- */

console.log('\nverdict')

const botReport = report({
  path: lin,
  clicks: variation([100, 100, 100, 100, 100, 100]),
  keys: variation([80, 80, 80, 80, 80, 80]),
  drift: 0,
  roundness: 0.9999,
})
check('a script is not a human', botReport.verdict, 'Not a human')
check('and scores zero', botReport.humanity, 0)

const humanReport = report({
  path: hum,
  clicks: variation([412, 900, 233, 1500, 620, 380]),
  keys: variation([140, 90, 260, 110, 320, 95]),
  drift: 7.2,
  roundness: 0.91,
})
check('an arm is a human', humanReport.verdict, 'Human')
check('and scores 100', humanReport.humanity, 100)

// A phone gives no pointer path and no keystrokes. Those channels must count
// neither for you nor against you, rather than quietly reading as robotic.
const touchReport = report({
  path: null,
  clicks: variation([412, 900, 233, 1500, 620, 380]),
  keys: null,
  drift: 12,
  roundness: 0.88,
})
check('untouched channels are not scored', touchReport.measured, 3)
check('and do not drag the score down', touchReport.humanity, 100)

const nothing = report({ path: null, clicks: null, keys: null, drift: null, roundness: null })
check('no evidence at all', nothing.verdict, 'Inconclusive')

console.log(
  failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`,
)
process.exit(failures === 0 ? 0 : 1)

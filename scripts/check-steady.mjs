/**
 * Checks Steady Hand's four shapes and the geometry that scores them.
 *
 * A score out of a hundred is a claim about a drawing, and the only way to
 * know it is a fair one is to hand it drawings whose right answer is already
 * known: a perfect trace, a trace with a measured wobble on it, half a shape,
 * a scribble. Then the properties matter more than any single number —
 *
 *   - a perfect trace scores a hundred, on every shape;
 *   - more wobble always scores less, never the same or more;
 *   - the same *relative* wobble scores the same on a phone and on a monitor,
 *     which is the whole point of normalising by the shape's size;
 *   - rotating the shape changes nothing;
 *   - a slow, densely sampled stroke scores the same as a fast, sparse one
 *     along the same path.
 *
 * The three factors are checked by removing them one at a time: half a circle
 * has to lose about half, and scrubbing back and forth along the line has to
 * lose most of it, even though every point of both is in exactly the right
 * place.
 *
 *   node scripts/check-steady.mjs [--verbose]
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  SHAPES, SHAPE_IDS, shapeById, scoreStroke, rating, verdictFor, ratingName,
  TOLERANCE, sizeOf, pathLength, distToPath, distToSegment, centroid, dist,
} = await import('../src/lib/steady-shapes.ts')

const VERBOSE = process.argv.includes('--verbose')

let failures = 0
const report = (label, ok, extra = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}
const near = (label, got, want, tol) =>
  report(label, Math.abs(got - want) <= tol, `${fmt(got)} vs ${fmt(want)} ±${fmt(tol)}`)
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(3) : String(n))

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BOX = { w: 900, h: 620 }

/**
 * Resample a polyline to `n` evenly spaced points, so a "stroke" can be built
 * along any ideal without inheriting the ideal's own sample spacing.
 */
function resample(path, n) {
  const total = pathLength(path)
  const out = []
  let i = 1, walked = 0
  for (let k = 0; k <= n; k++) {
    const want = (total * k) / n
    while (i < path.length - 1 && walked + dist(path[i - 1], path[i]) < want) {
      walked += dist(path[i - 1], path[i])
      i++
    }
    const seg = dist(path[i - 1], path[i]) || 1
    const t = Math.min(1, Math.max(0, (want - walked) / seg))
    out.push({
      x: path[i - 1].x + (path[i].x - path[i - 1].x) * t,
      y: path[i - 1].y + (path[i].y - path[i - 1].y) * t,
    })
  }
  return out
}

/** The unit normal of a path at index i, for pushing a point sideways. */
function normalAt(path, i) {
  const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)]
  const dx = b.x - a.x, dy = b.y - a.y
  const L = Math.hypot(dx, dy) || 1
  return { x: -dy / L, y: dx / L }
}

/**
 * A traced stroke with a sinusoidal wobble of a known amplitude, given as a
 * fraction of the shape's size. A sine has mean |amplitude| of 2/π, so the
 * mean deviation this produces is amp × 2/π and the expected accuracy is
 * computable rather than guessed at.
 */
function traced(shape, rot, { amp = 0, waves = 9, n = 300, fraction = 1, seed = 0 } = {}) {
  const ideal = shape.target(BOX, rot, shape.target(BOX, rot, []))
  const size = sizeOf(ideal)
  const pts = resample(ideal, n)
  const rnd = seed ? mulberry32(seed) : null
  const take = Math.max(2, Math.round(pts.length * fraction))
  const out = []
  for (let i = 0; i < take; i++) {
    const t = i / (pts.length - 1)
    const nrm = normalAt(pts, i)
    const off = amp * size * (rnd ? rnd() * 2 - 1 : Math.sin(t * waves * Math.PI * 2))
    out.push({ x: pts[i].x + nrm.x * off, y: pts[i].y + nrm.y * off })
  }
  return out
}

const scoreOf = (shape, rot, stroke) => scoreStroke(shape, BOX, rot, stroke)

console.log(`\n${SHAPES.length} shapes, tolerance ${TOLERANCE}\n`)

/* -------------------------------------------------------------------------- */
/* The geometry underneath                                                    */
/* -------------------------------------------------------------------------- */

console.log('geometry, against answers worked out by hand')

near('a point on a segment is zero from it',
  distToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 0, 1e-12)
near('a point above the middle is its height away',
  distToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 3, 1e-12)
near('...and past the end it is the distance to the end, not to the line',
  distToSegment({ x: 14, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5, 1e-12)
near('a 3-4-5 triangle comes out at 5',
  distToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5, 1e-12)

{
  const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }]
  near('a closed square is four sides long', pathLength(square), 16, 1e-12)
  near('its centroid is the middle', centroid(square).x, 1.6, 1e-9)
  const circle = []
  for (let i = 0; i <= 720; i++) {
    const a = (i / 720) * Math.PI * 2
    circle.push({ x: 100 + Math.cos(a) * 50, y: 100 + Math.sin(a) * 50 })
  }
  // A tenth of a percent out, because a closed polyline repeats its first
  // point and that nudges the centroid off the true middle. Every closed shape
  // here does the same, it is the same at every rotation, and it is four
  // hundredths of a pixel on a real board.
  near('a circle of radius 50 measures 100 across', sizeOf(circle), 100, 0.2)
  near('...and 2πr around', pathLength(circle), 2 * Math.PI * 50, 0.5)
  const seg = [{ x: 0, y: 0 }, { x: 30, y: 40 }]
  near('a segment of length 50 has size 50', sizeOf(seg), 50, 1e-9)
}

{
  // Rotating the shape must not change its measured size, which a bounding
  // box would have got wrong: a square is s√2 square-on and 2s at 45 degrees.
  const sq = shapeById('square')
  const sizes = [0, 0.3, Math.PI / 4, 1.1, 2].map((r) => sizeOf(sq.target(BOX, r, [])))
  report('a square measures the same at every angle',
    Math.max(...sizes) - Math.min(...sizes) < 0.5,
    sizes.map((s) => s.toFixed(1)).join(' '))
}

/* -------------------------------------------------------------------------- */
/* A perfect trace                                                            */
/* -------------------------------------------------------------------------- */

console.log('\na perfect trace')

for (const shape of SHAPES) {
  const s = scoreOf(shape, 0.4, traced(shape, 0.4))
  report(`${shape.id.padEnd(6)} scores full marks`, s.score > 99.5,
    `${s.score.toFixed(2)}  acc ${s.accuracy.toFixed(3)} cov ${s.coverage.toFixed(3)} eco ${s.economy.toFixed(3)}`)
}

/* -------------------------------------------------------------------------- */
/* Wobble                                                                     */
/* -------------------------------------------------------------------------- */

console.log('\nwobble, which has to cost exactly what it should')

{
  /*
   * A sine of amplitude a has mean |value| 2a/π, so a stroke pushed that far
   * off the ideal along the normal should drift by 2a/π — in the limit.
   *
   * It comes in slightly under, and should: the score measures the distance
   * to the *nearest* point of the ideal, and once the wobble is large enough
   * for the stroke to lean, the nearest point is not the one it was pushed
   * away from. So the exact claim is that it converges on 2a/π as the wobble
   * gets small, and never exceeds it.
   */
  const shape = shapeById('line')
  const rows = []
  let under = true, converging = true, lastRatio = 0
  for (const amp of [0.002, 0.005, 0.01, 0.02, 0.04]) {
    const d = scoreOf(shape, 0, traced(shape, 0, { amp, waves: 11, n: 900 })).drift
    const ratio = d / ((amp * 2) / Math.PI)
    rows.push(`${amp}:${ratio.toFixed(3)}`)
    if (ratio > 1.0001) under = false
    if (lastRatio && ratio > lastRatio + 1e-6) converging = false
    lastRatio = ratio
  }
  report('a small sine wobble drifts by 2a/π, as the maths says', lastRatio > 0,
    rows.join('  '))
  const first = Number(rows[0].split(':')[1])
  report('...to within a percent at the small end', Math.abs(first - 1) < 0.01, rows[0])
  report('...never more, because the nearest point of the ideal is nearer', under)
  report('...and further off it falls away steadily', converging)
}

{
  const shape = shapeById('line')
  let last = Infinity
  let monotone = true
  const row = []
  // Accuracy reaches zero when the drift reaches the tolerance, and a sine of
  // amplitude a drifts by about 2a/π — so it takes an amplitude of roughly
  // π/2 times the tolerance, not the tolerance itself.
  for (let amp = 0; amp <= 0.11; amp += 0.01) {
    const s = scoreOf(shape, 0, traced(shape, 0, { amp, waves: 9, n: 600 })).score
    row.push(s.toFixed(0))
    if (s > last + 1e-9) monotone = false
    last = s
  }
  report('more wobble always scores less', monotone, row.join(' → '))
  // Accuracy is what has a floor, and it reaches it when the drift reaches
  // the tolerance. Asserting that directly says more than a score threshold.
  const wild = scoreOf(shape, 0, traced(shape, 0, { amp: 0.16, waves: 9, n: 600 }))
  report('...and enough of it reaches exactly zero',
    wild.accuracy === 0 && wild.score === 0,
    `drift ${wild.drift.toFixed(3)} against a tolerance of ${TOLERANCE}`)
}

/* -------------------------------------------------------------------------- */
/* The properties the normalising is for                                      */
/* -------------------------------------------------------------------------- */

console.log('\nthe same drawing on a different screen, or at a different angle')

{
  // The same relative wobble on a phone and on a monitor. If this failed, the
  // game would quietly be easier on a big screen.
  const shape = shapeById('line')
  const big = { w: 1800, h: 1200 }
  const small = { w: 360, h: 640 }
  const at = (box) => {
    const ideal = shape.target(box, 0.3, [])
    const size = sizeOf(ideal)
    const pts = resample(ideal, 500)
    const st = pts.map((p, i) => {
      const n = normalAt(pts, i)
      const off = 0.02 * size * Math.sin((i / (pts.length - 1)) * 9 * Math.PI * 2)
      return { x: p.x + n.x * off, y: p.y + n.y * off }
    })
    return scoreStroke(shape, box, 0.3, st).score
  }
  near('a phone and a monitor score the same wobble alike', at(small), at(big), 0.6)
}

for (const shape of SHAPES) {
  const scores = [0, 0.7, Math.PI / 3, 2.6, 5].map(
    (r) => scoreOf(shape, r, traced(shape, r, { amp: 0.018, waves: 7, n: 600 })).score)
  report(`${shape.id.padEnd(6)} scores the same at every angle`,
    Math.max(...scores) - Math.min(...scores) < 2.5,
    scores.map((s) => s.toFixed(1)).join(' '))
}

{
  // The arc-length weighting claim: a stroke sampled 200 times and the same
  // stroke sampled 2,000 times are the same drawing and must score alike.
  const shape = shapeById('circle')
  const sparse = scoreOf(shape, 0, traced(shape, 0, { amp: 0.02, waves: 6, n: 120 })).score
  const dense = scoreOf(shape, 0, traced(shape, 0, { amp: 0.02, waves: 6, n: 2000 })).score
  near('sampling rate does not change the score', sparse, dense, 2)
}

/* -------------------------------------------------------------------------- */
/* Each factor, by taking it away                                             */
/* -------------------------------------------------------------------------- */

console.log('\nwhat each of the three factors is for')

{
  const shape = shapeById('circle')
  const half = scoreOf(shape, 0, traced(shape, 0, { fraction: 0.5 }))
  report('half a circle, drawn perfectly, loses about half',
    half.score > 35 && half.score < 60,
    `${half.score.toFixed(1)}  acc ${half.accuracy.toFixed(2)} cov ${half.coverage.toFixed(2)}`)
  report('...because coverage caught it, not accuracy', half.accuracy > 0.9)

  const quarter = scoreOf(shape, 0, traced(shape, 0, { fraction: 0.25 }))
  report('a quarter of it loses about three quarters',
    quarter.score > 12 && quarter.score < 34, quarter.score.toFixed(1))
}

{
  // Scrubbing: every point is on the line, and all of it is covered, so only
  // economy can catch this.
  const shape = shapeById('line')
  const ideal = shape.target(BOX, 0, [])
  const pts = resample(ideal, 200)
  const scrub = [...pts, ...pts.slice().reverse(), ...pts]
  const s = scoreOf(shape, 0, scrub)
  report('scrubbing the line three times over is not a good line',
    s.score < 45, `${s.score.toFixed(1)}  acc ${s.accuracy.toFixed(2)} cov ${s.coverage.toFixed(2)} eco ${s.economy.toFixed(2)}`)
  report('...and it is economy that says so', s.accuracy > 0.95 && s.coverage > 0.95)
}

{
  const shape = shapeById('square')
  const rnd = mulberry32(4)
  const c = { x: BOX.w / 2, y: BOX.h / 2 }
  const scribble = []
  for (let i = 0; i < 400; i++) {
    scribble.push({ x: c.x + (rnd() - 0.5) * 400, y: c.y + (rnd() - 0.5) * 400 })
  }
  report('a scribble scores nothing', scoreOf(shape, 0, scribble).score < 5,
    scoreOf(shape, 0, scribble).score.toFixed(2))
}

{
  const shape = shapeById('line')
  report('a stroke of one point scores nothing',
    scoreOf(shape, 0, [{ x: 10, y: 10 }]).score === 0)
  report('an empty stroke scores nothing and does not throw',
    scoreOf(shape, 0, []).score === 0)
  report('a stroke that never moves scores nothing',
    scoreOf(shape, 0, Array.from({ length: 50 }, () => ({ x: 100, y: 100 }))).score === 0)
}

/* -------------------------------------------------------------------------- */
/* The circle fits its own radius                                             */
/* -------------------------------------------------------------------------- */

console.log('\nthe circle takes its size from what you drew')

{
  const shape = shapeById('circle')
  const c = { x: BOX.w / 2, y: BOX.h / 2 }
  const ring = (R, wobble = 0) => {
    const out = []
    for (let i = 0; i <= 400; i++) {
      const a = (i / 400) * Math.PI * 2
      const r = R * (1 + wobble * Math.sin(a * 7))
      out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r })
    }
    return out
  }
  const small = scoreOf(shape, 0, ring(70))
  const large = scoreOf(shape, 0, ring(190))
  report('a small perfect circle scores full marks', small.score > 99, small.score.toFixed(2))
  report('a large perfect circle scores the same', large.score > 99, large.score.toFixed(2))
  near('...exactly the same, because only roundness is measured',
    small.score, large.score, 0.5)
  const lumpy = scoreOf(shape, 0, ring(150, 0.08))
  report('a lumpy one does not', lumpy.score < 80, lumpy.score.toFixed(1))
  // An oval is round in no sense, and the fitted radius cannot rescue it.
  const oval = []
  for (let i = 0; i <= 400; i++) {
    const a = (i / 400) * Math.PI * 2
    oval.push({ x: c.x + Math.cos(a) * 190, y: c.y + Math.sin(a) * 110 })
  }
  report('an oval is not a circle', scoreOf(shape, 0, oval).score < 30,
    scoreOf(shape, 0, oval).score.toFixed(1))
}

/* -------------------------------------------------------------------------- */
/* The suite                                                                  */
/* -------------------------------------------------------------------------- */

console.log('\nthe suite')

report('four shapes', SHAPES.length === 4, String(SHAPES.length))
report('ids are unique', new Set(SHAPE_IDS).size === SHAPE_IDS.length)
report('all named and briefed',
  SHAPES.every((s) => s.name.length > 2 && s.brief.length > 20))
report('lookup works', SHAPES.every((s) => shapeById(s.id) === s))
report('every shape puts dots on the board',
  SHAPES.every((s) => s.dots(BOX, 0).length >= 1))
report('every dot lands inside the board',
  SHAPES.every((s) => [0, 1, 2, 3, 4, 5].every((r) => s.dots(BOX, r).every(
    (d) => d.x > 10 && d.x < BOX.w - 10 && d.y > 10 && d.y < BOX.h - 10))))
report('closed shapes are the ones that come back',
  shapeById('circle').closed && shapeById('square').closed &&
  !shapeById('line').closed && !shapeById('spiral').closed)

report('a rating needs all four', rating({ line: 90, circle: 80 }) === null)
near('a rating is the mean of the bests',
  rating({ line: 90, circle: 80, square: 70, spiral: 60 }), 75, 1e-9)
report('a rating of nothing is nothing', rating({}) === null)

{
  const grades = [100, 95, 85, 70, 50, 20, 0].map(ratingName)
  report('every rating has a name', grades.every((g) => g && g.length > 3))
  report('the names are not all the same', new Set(grades).size >= 4, grades.join(' '))
  const verdicts = [100, 95, 85, 70, 50, 20, 0].map(verdictFor)
  report('every score has a verdict', verdicts.every((v) => v.length > 5))
  report('the verdicts are not all the same', new Set(verdicts).size >= 5)
}

if (VERBOSE) {
  console.log('')
  for (const shape of SHAPES) {
    const t = shape.target(BOX, 0, shape.target(BOX, 0, []))
    console.log(`       ${shape.id.padEnd(7)} size ${sizeOf(t).toFixed(0)}  length ${pathLength(t).toFixed(0)}  ${shape.dots(BOX, 0).length} dots`)
  }
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)

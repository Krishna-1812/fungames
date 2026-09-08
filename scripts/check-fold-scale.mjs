/**
 * check-fold-scale — the ladder of real things Paper Folds measures itself
 * against, and the silhouettes it draws them with.
 *
 * The panel this checks replaced a gradient rail with seven words next to it.
 * Words cost nothing to be wrong about; a drawing of the Eiffel Tower at 330
 * metres does not, because it is now making a claim on every fold between
 * twenty-one and twenty-two. So:
 *
 *   1. Are the heights real? A dozen of them are held here to figures typed in
 *      independently of the library, so a slip in one place has to be a slip
 *      in two places to survive.
 *   2. Is the ladder climbable? Sorted, no duplicates, and no gap so wide that
 *      the next thing to aim at is out of sight for a dozen clicks.
 *   3. Do the silhouettes stand on the ground and fill their box? This is the
 *      one a screenshot answers badly, because an object floating four pixels
 *      above the floor or overflowing its own width looks *almost* right in
 *      any single frame and wrong in all of them. Every path is walked, cubic
 *      extrema and all, and measured.
 *   4. Does the frame always contain what it is pointing at? The panel's world
 *      height is a function of the stack; if it were ever smaller than the
 *      target, the thing being named would be off the top of the picture.
 *
 *   node scripts/check-fold-scale.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { REFS, target, passed, worldHeight, relation, leadIn } =
  await import('../src/lib/fold-scale.ts')

let failed = 0
const fail = (m) => { console.error('  FAIL ' + m); failed++ }
const ok = (m) => console.log('  ok   ' + m)

const MAX_FOLDS = 103
const heightAt = (n) => (0.1 * Math.pow(2, n)) / 1000
const foldOf = (m) => Math.log2(m / 1e-4)

/* -------------------------------------------------------------------------- */
console.log('\nThe heights are the real ones')
/* -------------------------------------------------------------------------- */

{
  /* Typed in from the ordinary published figures, on purpose not imported. */
  const KNOWN = {
    rice: 0.005,
    pencil: 0.19,
    person: 1.75,
    giraffe: 5.5,
    tree: 25,
    liberty: 93,
    eiffel: 330,
    burj: 828,
    everest: 8849,
    karman: 100_000,
    iss: 408_000,
    earth: 12_742_000,
    moon: 384_400_000,
    sun: 1.392e9,
    au: 1.496e11,
    proxima: 4.0e16,
    milkyway: 1.0e21,
    universe: 8.8e26,
  }
  const by = Object.fromEntries(REFS.map((r) => [r.id, r]))
  let bad = 0
  for (const [id, m] of Object.entries(KNOWN)) {
    const r = by[id]
    if (!r) { fail('no rung called "' + id + '"'); bad++; continue }
    if (Math.abs(r.metres - m) > m * 1e-9) {
      fail(r.name + ' is ' + r.metres + ' m here and ' + m + ' m in the world')
      bad++
    }
  }
  if (!bad) ok(Object.keys(KNOWN).length + ' heights match the published figures')

  // The Moon has to be further than the Earth is wide, the Sun further than
  // the Moon, and so on: relations that hold whatever the exact numbers are.
  const m = (id) => by[id].metres
  const order = [
    ['a person', 'a giraffe', m('person') < m('giraffe')],
    ['Everest', 'the edge of space', m('everest') < m('karman')],
    ["the Earth's width", 'the way to the Moon', m('earth') < m('moon')],
    ['the Sun', 'the way to the Sun', m('sun') < m('au')],
    ['the nearest star', 'the Milky Way', m('proxima') < m('milkyway')],
  ]
  const wrong = order.filter((o) => !o[2])
  if (wrong.length) for (const o of wrong) fail(o[0] + ' is not smaller than ' + o[1])
  else ok('the relations between them hold too')
}

/* -------------------------------------------------------------------------- */
console.log('\nThe ladder can be climbed')
/* -------------------------------------------------------------------------- */

{
  let bad = 0
  const seen = new Set()
  for (const r of REFS) {
    if (seen.has(r.id)) { fail('two rungs called "' + r.id + '"'); bad++ }
    seen.add(r.id)
    if (!(r.metres > 0) || !isFinite(r.metres)) { fail(r.name + ' has no height'); bad++ }
  }
  for (let i = 1; i < REFS.length; i++)
    if (REFS[i].metres <= REFS[i - 1].metres) {
      fail(REFS[i].name + ' is not above ' + REFS[i - 1].name); bad++
    }
  if (!bad) ok(REFS.length + ' rungs, all distinct and in order')

  // A rung is a thing to aim at, and a fold is one click.
  let worst = 0, worstAt = ''
  for (let i = 1; i < REFS.length; i++) {
    const d = foldOf(REFS[i].metres) - foldOf(REFS[i - 1].metres)
    if (d > worst) { worst = d; worstAt = REFS[i - 1].name + ' -> ' + REFS[i].name }
  }
  if (worst > 7.2) fail('a gap of ' + worst.toFixed(1) + ' folds: ' + worstAt)
  else ok('the widest gap is ' + worst.toFixed(1) + ' folds (' + worstAt + ')')

  const first = foldOf(REFS[0].metres)
  if (first > 4) fail('nothing to compare against until fold ' + first.toFixed(1))
  else ok('there is something to stand beside from fold ' + Math.max(0, Math.ceil(first)))

  const last = foldOf(REFS[REFS.length - 1].metres)
  if (last > MAX_FOLDS) fail('the ladder runs past the last fold')
  else ok('the last rung is reached at fold ' + last.toFixed(1) + ', inside ' + MAX_FOLDS)
}

/* -------------------------------------------------------------------------- */
console.log('\nThe frame always contains what it names')
/* -------------------------------------------------------------------------- */

{
  let bad = 0, tightest = 1, loosest = 0
  for (let k = 0; k <= MAX_FOLDS * 4; k++) {
    const m = heightAt(k / 4)
    const t = target(m)
    const world = worldHeight(m)
    if (t.metres > world) { fail('at fold ' + (k / 4) + ' the target is off the top'); bad++; continue }
    if (m > world) { fail('at fold ' + (k / 4) + ' the stack is off the top'); bad++; continue }
    // Nor should it be a speck: a target filling a twentieth of the frame is
    // not something you are visibly climbing towards.
    const fill = t.metres / world
    tightest = Math.min(tightest, fill)
    loosest = Math.max(loosest, fill)
  }
  if (!bad) ok('the target fills between ' + (tightest * 100).toFixed(0) + '% and ' +
    (loosest * 100).toFixed(0) + '% of the frame, all the way up')
  if (tightest < 0.5) fail('the target shrinks to ' + (tightest * 100).toFixed(0) + '% of the frame')

  // target and passed have to partition the ladder.
  let split = 0
  for (let n = 0; n <= MAX_FOLDS; n += 1) {
    const m = heightAt(n)
    const t = target(m), ps = passed(m)
    if (ps.some((r) => r.metres > m)) { fail('fold ' + n + ': passed something it has not reached'); split++ }
    if (ps.includes(t) && t.metres > m) { fail('fold ' + n + ': the target is also in the passed list'); split++ }
    for (let i = 1; i < ps.length; i++)
      if (ps[i].metres > ps[i - 1].metres) { fail('fold ' + n + ': the passed list is not descending'); split++ }
  }
  if (!split) ok('what it has passed and what it is chasing never overlap')

  const phrases = new Set(REFS.map((r) => leadIn(r)))
  if (phrases.size < 3) fail('only ' + phrases.size + ' ways of introducing a rung')
  else ok('rungs are introduced as ' + [...phrases].join(' / '))

  const R = REFS.find((r) => r.id === 'eiffel')
  const say = (folds) => relation(heightAt(folds), R)
  if (!/^6\d% of it$/.test(say(21))) fail('fold 21 against the Eiffel Tower reads "' + say(21) + '"')
  else if (!/^1\.\d × it$/.test(say(22))) fail('fold 22 against the Eiffel Tower reads "' + say(22) + '"')
  else ok('fold 21 is ' + say(21) + ' of the Eiffel Tower, fold 22 is ' + say(22))
}

/* -------------------------------------------------------------------------- */
console.log('\nThe silhouettes stand on the ground')
/* -------------------------------------------------------------------------- */

/**
 * The bounding box of a path made of M, L, C and Z, with the cubics solved
 * rather than approximated by their control points.
 *
 * Control-point bounds are a superset, which is fine for "does it overflow"
 * and useless for "does it touch the floor" — the whole point of this section.
 */
function bbox(d) {
  const toks = d.match(/[MLCZmlcz]|-?\d*\.?\d+/g) || []
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = ''
  const B = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const hit = (x, y) => {
    B.x0 = Math.min(B.x0, x); B.x1 = Math.max(B.x1, x)
    B.y0 = Math.min(B.y0, y); B.y1 = Math.max(B.y1, y)
  }
  const num = () => Number(toks[i++])
  // Where a cubic turns, per axis: the roots of its derivative in [0,1].
  const cubic = (p0, p1, p2, p3) => {
    const out = [p0, p3]
    const a = -p0 + 3 * p1 - 3 * p2 + p3
    const b = 2 * (p0 - 2 * p1 + p2)
    const c = p1 - p0
    const at = (t) => {
      const u = 1 - t
      return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
    }
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > 1e-12) { const t = -c / b; if (t > 0 && t < 1) out.push(at(t)) }
    } else {
      const disc = b * b - 4 * a * c
      if (disc >= 0) for (const s of [1, -1]) {
        const t = (-b + s * Math.sqrt(disc)) / (2 * a)
        if (t > 0 && t < 1) out.push(at(t))
      }
    }
    return out
  }
  while (i < toks.length) {
    if (/[MLCZmlcz]/.test(toks[i])) cmd = toks[i++]
    if (cmd === 'Z' || cmd === 'z') { cx = sx; cy = sy; continue }
    if (cmd === 'M') { cx = num(); cy = num(); sx = cx; sy = cy; hit(cx, cy); cmd = 'L'; continue }
    if (cmd === 'L') { cx = num(); cy = num(); hit(cx, cy); continue }
    if (cmd === 'C') {
      const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x3 = num(), y3 = num()
      for (const v of cubic(cx, x1, x2, x3)) hit(v, cy)
      for (const v of cubic(cy, y1, y2, y3)) hit(cx, v)
      cx = x3; cy = y3
      hit(cx, cy)
      continue
    }
    throw new Error('unhandled path command "' + cmd + '"')
  }
  return B
}

{
  const stands = REFS.filter((r) => r.kind === 'stand')
  let bad = 0
  for (const r of stands) {
    let b
    try { b = bbox(r.d) } catch (e) { fail(r.name + ': ' + e.message); bad++; continue }
    // On the ground. Off by two units at this scale is a visible float.
    if (Math.abs(b.y1 - 100) > 1.2) { fail(r.name + ' rests at y=' + b.y1.toFixed(1) + ', not 100'); bad++ }
    // Using the height it claims: a shape that only reaches y=20 is drawn 20%
    // short of the height the ladder says it is.
    if (b.y0 > 6) { fail(r.name + ' only reaches y=' + b.y0.toFixed(1) + ' — it is drawn short'); bad++ }
    if (b.y0 < -1.5) { fail(r.name + ' pokes ' + (-b.y0).toFixed(1) + ' above its own box'); bad++ }
    // Inside the width it declares, or the layout reserves the wrong space and
    // neighbours overlap.
    if (b.x0 < -1.5 || b.x1 > r.w + 1.5) {
      fail(r.name + ' spans x ' + b.x0.toFixed(1) + '..' + b.x1.toFixed(1) + ' in a box ' + r.w + ' wide')
      bad++
    }
    // And actually filling it, so the drawn width means something.
    if (b.x1 - b.x0 < r.w * 0.7) {
      fail(r.name + ' fills only ' + (((b.x1 - b.x0) / r.w) * 100).toFixed(0) + '% of its box width')
      bad++
    }
    if (r.detail) {
      let db
      try { db = bbox(r.detail) } catch (e) { fail(r.name + ' detail: ' + e.message); bad++; continue }
      if (db.x0 < b.x0 - 1 || db.x1 > b.x1 + 1 || db.y0 < b.y0 - 1 || db.y1 > b.y1 + 1) {
        fail(r.name + ': the lit detail is drawn outside the silhouette')
        bad++
      }
    }
    if (!(r.w >= 8 && r.w <= 220)) { fail(r.name + ' has an unusable aspect (' + r.w + ':100)'); bad++ }
  }
  if (!bad) ok(stands.length + ' silhouettes stand on y=100, reach the top, and fit their box')

  const skies = REFS.filter((r) => r.kind !== 'stand')
  const bodies = new Set()
  for (const r of skies) {
    if (r.kind === 'span') { bodies.add(r.from); bodies.add(r.to) }
    else bodies.add(r.disc)
  }
  const DRAWN = new Set(['earth', 'moon', 'sun', 'star', 'iss', 'galaxy',
    'nebula', 'cluster', 'web', 'sphere', 'line'])
  const missing = [...bodies].filter((b) => !DRAWN.has(b))
  if (missing.length) fail('nothing draws: ' + missing.join(', '))
  else ok(skies.length + ' distances and bodies, using ' + bodies.size + ' kinds the page can draw')
}

console.log(failed ? '\n' + failed + ' failed.\n' : '\nAll good.\n')
process.exit(failed ? 1 : 0)

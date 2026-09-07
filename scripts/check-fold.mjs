/**
 * check-fold — does the paper model agree with paper?
 *
 * The whole point of rewriting this game was to replace a button that counted
 * to 103 with a sheet that stops when a real sheet stops. That claim is only
 * worth making if the model reproduces things somebody has actually done, so
 * this checks it against three:
 *
 *   1. A sheet of A4 folds seven times, alternating directions, and not eight.
 *      This is the fact the game is named after, and it is the one everybody
 *      has tested personally on the back of an envelope.
 *   2. The same sheet folded always the same way manages six.
 *   3. Britney Gallivan's 1,219-metre roll of toilet paper folded twelve times
 *      in one direction, in 2002, which is the record and also the reason the
 *      equations in `fold-paper.ts` exist.
 *
 * Then the parts a wrong sign or a stray factor would break quietly: the
 * requirement has to grow with every fold, the reach has to be 1 exactly when
 * the sheet has the room and less when it does not, and the drawing has to
 * stay in its box.
 *
 *   node scripts/check-fold.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  SHEETS, sheetById, lengthForFolds, sideForFolds, need, have, maxFolds,
  reach, profile, foldPath, thicknessAt, bendRadius, mm, costOfFold,
} = await import('../src/lib/fold-paper.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/* -------------------------------------------------------------------------- */
console.log('against sheets people have actually folded')
{
  const a4 = sheetById('a4')
  check(
    maxFolds(a4, 'alternate') === 7,
    `A4 folds seven times alternating — the fact the game is about — and this says ${maxFolds(a4, 'alternate')}`,
  )
  check(
    maxFolds(a4, 'single') === 6,
    `A4 folds six times in one direction, and this says ${maxFolds(a4, 'single')}`,
  )

  const roll = sheetById('roll')
  check(
    maxFolds(roll, 'single') === 12,
    `Gallivan's roll folded twelve times in 2002, and this says ${maxFolds(roll, 'single')}`,
  )

  // And the eighth fold of A4 is not merely unreached, it is out of reach by a
  // long way. A model that made it a near miss would be telling a different
  // and much less interesting story.
  const ratio = need(a4, 8, 'alternate') / have(a4, 'alternate')
  check(ratio > 2, `the eighth fold of A4 needs ${ratio.toFixed(1)}× the sheet, so it is not close`)
}

/* -------------------------------------------------------------------------- */
console.log('\nthe equations behave like equations')
{
  let bad = 0
  for (const t of [0.0001, 0.05, 0.1, 1]) {
    for (let n = 1; n < 30; n++) {
      if (!(lengthForFolds(t, n + 1) > lengthForFolds(t, n))) {
        fail(`single-direction requirement does not grow at t=${t}, n=${n}`)
        bad++
      }
      if (!(sideForFolds(t, n + 1) > sideForFolds(t, n))) {
        fail(`alternating requirement does not grow at t=${t}, n=${n}`)
        bad++
      }
      if (!(costOfFold(t, n, 'single') > 0)) {
        fail(`fold ${n} costs nothing at t=${t}`)
        bad++
      }
    }
  }
  check(bad === 0, 'every fold costs something, and each one costs more than the last')

  // Thicker paper folds fewer times. Obvious, and exactly the sort of thing a
  // reciprocal in the wrong place would invert without changing anything else.
  const thin = { ...sheetById('a4'), thickness: 0.02 }
  const thick = { ...sheetById('a4'), thickness: 0.4 }
  check(
    maxFolds(thin, 'alternate') > maxFolds(sheetById('a4'), 'alternate') &&
      maxFolds(thick, 'alternate') < maxFolds(sheetById('a4'), 'alternate'),
    `thinner paper folds more (${maxFolds(thin, 'alternate')}) and thicker folds less (${maxFolds(thick, 'alternate')})`,
  )

  // Doubling a strip does not buy you a fold, it buys you a fraction of one:
  // that is the whole shape of the problem.
  const roll = sheetById('roll')
  const twice = { ...roll, length: roll.length * 2 }
  check(
    maxFolds(twice, 'single') - maxFolds(roll, 'single') <= 1,
    'twice the paper is worth at most one more fold',
  )
}

/* -------------------------------------------------------------------------- */
console.log('\nthe handle stops where the paper stops')
{
  let bad = 0
  for (const s of SHEETS) {
    for (const mode of ['single', 'alternate']) {
      const lim = maxFolds(s, mode)
      for (let n = 1; n <= lim; n++) {
        if (reach(s, n, mode) !== 1) {
          fail(`${s.id}/${mode}: fold ${n} is affordable but does not complete`)
          bad++
        }
      }
      for (let n = lim + 1; n <= lim + 3; n++) {
        const r = reach(s, n, mode)
        if (r >= 1) {
          fail(`${s.id}/${mode}: fold ${n} is impossible but completes`)
          bad++
        }
        if (r <= 0) {
          fail(`${s.id}/${mode}: fold ${n} does not move at all`)
          bad++
        }
      }
      // An impossible fold that is nearly affordable must travel further than
      // one that is hopeless, or "the paper resists" is just a word.
      if (lim >= 1 && reach(s, lim + 1, mode) <= reach(s, lim + 3, mode)) {
        fail(`${s.id}/${mode}: the hopeless fold travels as far as the near miss`)
        bad++
      }
    }
  }
  check(bad === 0, 'every sheet folds to its limit, resists past it, and never refuses outright')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe drawing stays in its box')
{
  let bad = 0
  const BOX = 120
  for (let n = 0; n <= 30; n++) {
    const p = profile(n, BOX)
    const bottom = Math.max(...p.layers.map((l) => l.y + l.h))
    if (Math.abs(bottom - BOX) > 0.001) {
      fail(`profile at ${n} folds fills ${bottom.toFixed(2)} of ${BOX}`)
      bad++
    }
    if (!p.merged && p.layers.length !== 2 ** n) {
      fail(`profile at ${n} folds draws ${p.layers.length} layers, not ${2 ** n}`)
      bad++
    }
    if (p.layers.some((l) => l.h <= 0 || l.y < -0.001)) {
      fail(`profile at ${n} folds has a layer of no height, or above the box`)
      bad++
    }
  }
  check(bad === 0, 'the stack always fills its box exactly, with one layer per fold until it cannot')

  // The path is handed straight to an SVG. NaN in it renders nothing at all,
  // silently, which is the failure mode this catches.
  let paths = 0
  for (let n = 1; n <= 12; n++)
    for (const u of [0, 0.2, 0.5, 0.8, 1]) {
      const d = foldPath(20, 200, 90, 4, u, bendRadius(0.1, n) * 10)
      if (/NaN|Infinity|undefined/.test(d)) {
        fail(`fold path at n=${n}, u=${u} is not a number`)
        bad++
      }
      paths++
    }
  check(paths === 60, `all ${paths} mid-fold outlines are drawable`)
}

/* -------------------------------------------------------------------------- */
console.log('\nthe numbers a person reads')
{
  const a4 = sheetById('a4')
  check(thicknessAt(a4.thickness, 7) === 12.8, 'seven folds of A4 is 12.8 mm of paper')
  check(mm(0.0001) === '100 nanometres', `gold leaf reads as "${mm(0.0001)}"`)
  check(mm(1_219_000).startsWith('1.2'), `Gallivan's roll reads as "${mm(1_219_000)}"`)
  check(
    new Set(SHEETS.map((s) => s.id)).size === SHEETS.length,
    'every sheet has its own id',
  )
  check(
    SHEETS.every((s) => s.thickness > 0 && s.length > 0 && s.width > 0),
    'every sheet has real dimensions',
  )
  // The picker is worth having only if the sheets do different things.
  const answers = SHEETS.map((s) => maxFolds(s, 'alternate'))
  check(
    new Set(answers).size >= 3,
    `the sheets give ${new Set(answers).size} different answers: ${answers.join(', ')}`,
  )
}

console.log(
  failures ? `\n${failures} failed.` : '\nAll fold checks passed.',
)
process.exit(failures ? 1 : 0)

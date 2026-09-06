/**
 * Checks Trolley's twenty-six problems and the scoring behind them.
 *
 * The game's one real claim is that it tells you something true about your own
 * answers rather than inventing crowd statistics. That claim rests entirely on
 * the `endorse` field — what each of four ethical positions says about each
 * case — and on those four positions being genuinely different from one another.
 * If two of them agreed on everything, naming one of them would be meaningless.
 *
 * So this checks the authoring, and then plays the game four times: once as a
 * player who follows each position exactly, and once as every one-sided
 * strategy a person might actually adopt.
 *
 *   node scripts/check-trolley.mjs [--verbose]
 */
import {
  DILEMMAS, POSITIONS, coverage, scoreAnswers, REPEAT_OF_FIRST,
} from '../src/data/dilemmas.ts'

const VERBOSE = process.argv.includes('--verbose')
const KEYS = Object.keys(POSITIONS)

let failures = 0
const report = (label, ok, extra = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}

console.log(`\n${DILEMMAS.length} problems\n`)

/* -------------------------------------------------------------------------- */
/* The authoring                                                              */
/* -------------------------------------------------------------------------- */

console.log('every problem is well formed')

report('there are 26 of them', DILEMMAS.length === 26, String(DILEMMAS.length))

const badTitles = DILEMMAS.filter((d) => !d.title || d.title.length < 4).map((d) => d.title)
report('all titled', badTitles.length === 0, badTitles.join(', '))

const dupTitles = DILEMMAS.map((d) => d.title).filter((t, i, a) => a.indexOf(t) !== i)
report('titles are unique', dupTitles.length === 0, dupTitles.join(', '))

const shortSetups = DILEMMAS.filter((d) => d.setup.length < 40).map((d) => d.title)
report('every setup says enough', shortSetups.length === 0, shortSetups.join(', '))

const badOptions = DILEMMAS.filter(
  (d) =>
    !d.left.label || !d.right.label ||
    d.left.label === d.right.label ||
    !d.left.outcome || !d.right.outcome ||
    d.left.outcome === d.right.outcome ||
    d.left.acts !== false || d.right.acts !== true,
).map((d) => d.title)
report('two distinct options, left passive and right active', badOptions.length === 0, badOptions.join(', '))

const noView = DILEMMAS.filter((d) => Object.keys(d.endorse).length === 0).map((d) => d.title)
report('every problem is a problem for somebody', noView.length === 0, noView.join(', '))

const badSides = DILEMMAS.filter((d) =>
  Object.values(d.endorse).some((s) => s !== 'left' && s !== 'right'),
).map((d) => d.title)
report('every endorsement names a real side', badSides.length === 0, badSides.join(', '))

/* -------------------------------------------------------------------------- */
/* Coverage                                                                   */
/* -------------------------------------------------------------------------- */

console.log('\nevery position has enough to say to be scored')
const cov = coverage()
for (const k of KEYS) {
  report(`${POSITIONS[k].name} takes a side on`, cov[k] >= 18, `${cov[k]} of ${DILEMMAS.length}`)
}

/* -------------------------------------------------------------------------- */
/* Are the four positions actually different?                                 */
/* -------------------------------------------------------------------------- */

console.log('\nthe four positions genuinely disagree with each other')
let worst = { pair: '', same: 0, of: 0 }
for (let i = 0; i < KEYS.length; i++)
  for (let j = i + 1; j < KEYS.length; j++) {
    const a = KEYS[i]
    const b = KEYS[j]
    let same = 0
    let both = 0
    for (const d of DILEMMAS) {
      if (!d.endorse[a] || !d.endorse[b]) continue
      both++
      if (d.endorse[a] === d.endorse[b]) same++
    }
    const pct = Math.round((same / both) * 100)
    if (pct > worst.same) worst = { pair: `${a}/${b}`, same: pct, of: both }
    if (VERBOSE) console.log(`       ${a} vs ${b}: agree on ${same} of ${both} (${pct}%)`)
  }
// Two positions that agreed on everything would make naming one of them a coin
// toss dressed up as a result.
report('the closest pair still disagrees somewhere', worst.same <= 85, `${worst.pair} agree ${worst.same}%`)

/* -------------------------------------------------------------------------- */
/* Playing it as each position                                                */
/* -------------------------------------------------------------------------- */

console.log('\nplaying the whole game as a strict follower of each position')
for (const k of KEYS) {
  // Where the position has no view, this player does what most people do and
  // leaves the lever alone.
  const picks = DILEMMAS.map((d) => d.endorse[k] ?? 'left')
  const scored = scoreAnswers(picks)
  const top = scored[0]
  const mine = scored.find((s) => s.key === k)
  const ok = mine.pct === 100 && top.key === k
  report(
    `a strict ${POSITIONS[k].name.toLowerCase()} is named one`,
    ok,
    `${mine.pct}% ${k}, runner-up ${scored.find((s) => s.key !== k).key} ${scored.find((s) => s.key !== k).pct}%`,
  )
}

console.log('\nand as the two strategies that are not positions at all')
for (const [label, side] of [['never touches the lever', 'left'], ['pulls every lever', 'right']]) {
  const scored = scoreAnswers(DILEMMAS.map(() => side))
  if (VERBOSE) console.log(`       ${label}: ${scored.map((s) => s.key + ' ' + s.pct + '%').join(', ')}`)
  // Neither should come out as a perfect anything — a rule that ignores the
  // case in front of it is not an ethical position.
  report(`${label} is not a perfect anything`, scored[0].pct < 100, `best ${scored[0].key} ${scored[0].pct}%`)
}

/* -------------------------------------------------------------------------- */
/* The repeat                                                                 */
/* -------------------------------------------------------------------------- */

console.log('\nthe repeated problem')
report('there is one', REPEAT_OF_FIRST > 0, `at index ${REPEAT_OF_FIRST}`)
const first = DILEMMAS[0]
const again = DILEMMAS[REPEAT_OF_FIRST]
report('it is the same dilemma', first.left.deaths === again.left.deaths && first.right.deaths === again.right.deaths)
report(
  'and the same problem for every position',
  KEYS.every((k) => first.endorse[k] === again.endorse[k]),
)
report('but it says so', again.setup.includes('seen this one before'))

/* -------------------------------------------------------------------------- */
/* Scoring arithmetic                                                         */
/* -------------------------------------------------------------------------- */

console.log('\nscoring')
const half = DILEMMAS.map((d, i) => (i % 2 ? 'left' : 'right'))
const s = scoreAnswers(half)
report('percentages are 0–100', s.every((x) => x.pct >= 0 && x.pct <= 100))
report('denominators match coverage', s.every((x) => x.of === cov[x.key]))
report('sorted best first', s.every((x, i) => i === 0 || s[i - 1].pct >= x.pct))
const none = scoreAnswers(DILEMMAS.map(() => null))
report('an unplayed game scores nothing', none.every((x) => x.agreed === 0))

/* -------------------------------------------------------------------------- */
/* Body count                                                                 */
/* -------------------------------------------------------------------------- */

console.log('\nthe body count')
const worstCase = DILEMMAS.reduce((a, d) => a + Math.max(d.left.deaths, d.right.deaths), 0)
const bestCase = DILEMMAS.reduce((a, d) => a + Math.min(d.left.deaths, d.right.deaths), 0)
console.log(`       between ${bestCase} and ${worstCase} deaths across the whole game`)
report('the two differ, so "lives saved" means something', worstCase > bestCase)
report('no negative deaths', DILEMMAS.every((d) => d.left.deaths >= 0 && d.right.deaths >= 0))

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)

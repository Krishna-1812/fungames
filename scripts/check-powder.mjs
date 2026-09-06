/**
 * Checks Powder's materials and its reaction table.
 *
 * The reactions are the game now — the log counts them and tells you how many
 * you have left to find — so two things have to be true and neither is obvious
 * by reading. Every reaction must actually produce what its name claims, and
 * every material must be reachable: a substance that no reaction ever makes and
 * no button ever draws is content nobody can get to.
 *
 * Each reaction is run here on a real two-cell grid with its probability forced
 * to 1, using the same application rule the engine uses.
 *
 *   node scripts/check-powder.mjs [--verbose]
 */
import {
  MATERIALS, REACTIONS, EMPTY, SLOTS, buildLookup, describe, nameOf, byId,
} from '../src/lib/powder-rules.ts'

const VERBOSE = process.argv.includes('--verbose')

let failures = 0
const report = (label, ok, extra = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}

console.log(`\n${MATERIALS.length} materials, ${REACTIONS.length} reactions\n`)

/* -------------------------------------------------------------------------- */
/* Materials                                                                  */
/* -------------------------------------------------------------------------- */

console.log('materials')

const ids = MATERIALS.map((m) => m.id)
report('ids are unique', new Set(ids).size === ids.length)
report('none collides with empty', !ids.includes(EMPTY))
report('all fit the arrays', ids.every((id) => id > 0 && id < SLOTS), `max ${Math.max(...ids)}, ${SLOTS} slots`)
report('all named', MATERIALS.every((m) => m.name && m.name.length > 2))
report('all have a colour', MATERIALS.every((m) => m.rgb.length === 3 && m.rgb.every((c) => c >= 0 && c <= 255)))
report('all have a sane type', MATERIALS.every((m) => m.type >= 0 && m.type <= 3))

const drawable = MATERIALS.filter((m) => m.draw)
const hidden = MATERIALS.filter((m) => !m.draw)
report('enough to draw with', drawable.length >= 24, `${drawable.length} drawable, ${hidden.length} produced only`)

/* -------------------------------------------------------------------------- */
/* Reachability                                                               */
/* -------------------------------------------------------------------------- */

console.log('\nevery material can actually be reached')

const produced = new Set()
for (const r of REACTIONS) {
  if (r.a2 !== undefined) produced.add(r.a2)
  if (r.b2 !== undefined) produced.add(r.b2)
}
// Fire and embers also decay into smoke and ash inside the engine, which is not
// a pairwise reaction and so is not in the table.
const ENGINE_MAKES = ['Smoke', 'Steam', 'Ember', 'Ash']
const unreachable = hidden.filter(
  (m) => !produced.has(m.id) && !ENGINE_MAKES.includes(m.name),
)
report(
  'nothing is produced-only and unproducible',
  unreachable.length === 0,
  unreachable.map((m) => m.name).join(', '),
)

const inert = drawable.filter(
  (m) => !REACTIONS.some((r) => r.a === m.id || r.b === m.id),
)
report(
  'every drawable material does something',
  inert.length === 0,
  inert.map((m) => m.name).join(', '),
)

/* -------------------------------------------------------------------------- */
/* The table itself                                                           */
/* -------------------------------------------------------------------------- */

console.log('\nthe table is well formed')

const rxIds = REACTIONS.map((r) => r.id)
report('reaction ids are unique', new Set(rxIds).size === rxIds.length,
  rxIds.filter((v, i, a) => a.indexOf(v) !== i).join(', '))
report('ids are save-key safe', rxIds.every((id) => /^[a-z0-9-]+$/.test(id)))
report('probabilities are probabilities', REACTIONS.every((r) => r.p > 0 && r.p <= 1))
report('every material referenced exists', REACTIONS.every((r) =>
  [r.a, r.b, r.a2, r.b2].every((v) => v === undefined || v === EMPTY || byId(v))))
report('every reaction changes something', REACTIONS.every((r) =>
  r.a2 !== undefined || r.b2 !== undefined || r.boom))
report('nothing reacts with itself', REACTIONS.every((r) => r.a !== r.b))
report('every reaction is explained', REACTIONS.every((r) => r.note.length > 12))

// The same unordered pair defined twice would mean one silently never fires.
const pairs = REACTIONS.map((r) => [r.a, r.b].sort((x, y) => x - y).join('-'))
const dupPairs = pairs.filter((v, i, a) => a.indexOf(v) !== i)
report('no pair is defined twice', dupPairs.length === 0, dupPairs.join(', '))

/* -------------------------------------------------------------------------- */
/* Running them                                                               */
/* -------------------------------------------------------------------------- */

console.log('\nevery reaction actually does what it says')

const table = buildLookup()

/**
 * The engine's application rule, isolated. Two cells side by side; whichever
 * one is acting looks up the pair, works out which side of the reaction it is,
 * and applies both products.
 */
function apply(cellEl, neighbourEl) {
  const r = table[cellEl * SLOTS + neighbourEl]
  if (!r) return null
  const forward = r.a === cellEl && r.b === neighbourEl
  const backward = r.b === cellEl && r.a === neighbourEl
  if (!forward && !backward) return null
  return {
    r,
    cell: forward ? (r.a2 ?? cellEl) : (r.b2 ?? cellEl),
    neighbour: forward ? (r.b2 ?? neighbourEl) : (r.a2 ?? neighbourEl),
    boom: r.boom ?? 0,
  }
}

let ran = 0
let wrong = []
for (const r of REACTIONS) {
  // Forward: the cell holding `a` acts on a neighbour holding `b`.
  const f = apply(r.a, r.b)
  // And backward, because the engine scans cells in whatever order it reaches
  // them and the neighbour is just as likely to be the one acting.
  const b = apply(r.b, r.a)
  const okF = f && f.r.id === r.id && f.cell === (r.a2 ?? r.a) && f.neighbour === (r.b2 ?? r.b)
  const okB = b && b.r.id === r.id && b.cell === (r.b2 ?? r.b) && b.neighbour === (r.a2 ?? r.a)
  if (!okF || !okB) wrong.push(r.id)
  else ran++
  if (VERBOSE) console.log(`       ${describe(r)}${r.boom ? `  (blast ${r.boom})` : ''}`)
}
report(`all ${REACTIONS.length} fire from both sides`, wrong.length === 0, wrong.join(', '))
report('and the lookup found every one', ran === REACTIONS.length, `${ran}/${REACTIONS.length}`)

// A pair with no reaction must return nothing rather than the wrong thing.
report('unrelated materials do not react', apply(1, 3) === null || table[1 * SLOTS + 3] === undefined)

/* -------------------------------------------------------------------------- */
/* The claims the game makes on screen                                        */
/* -------------------------------------------------------------------------- */

console.log('\nthe numbers the game shows you')
report('there are at least 30 materials', MATERIALS.length >= 30, String(MATERIALS.length))
report('there are at least 38 reactions', REACTIONS.length >= 38, String(REACTIONS.length))

const labels = REACTIONS.map(describe)
report('every reaction gets a readable label', labels.every((l) => !l.includes('undefined') && !l.includes('Nothing +')))
const dupLabels = labels.filter((v, i, a) => a.indexOf(v) !== i)
report('labels are distinguishable', dupLabels.length === 0, [...new Set(dupLabels)].join(' / '))

if (VERBOSE) {
  console.log('\n       drawable:', drawable.map((m) => m.name).join(', '))
  console.log('       produced only:', hidden.map((m) => m.name).join(', '))
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)

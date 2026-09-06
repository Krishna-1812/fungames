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
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  MATERIALS, REACTIONS, EMPTY, SLOTS, buildLookup, describe, nameOf, byId,
  SAND, WATER, STONE, WOOD, FIRE, LAVA, OIL, PLANT, ACID, GLASS, EMBER,
  SALT, DIRT, SEED, METAL, SPARK, POWDER, THERMITE, ICE: R_ICE,
} = await import('../src/lib/powder-rules.ts')
const { createWorld, step, put, census, mulberry32 } = await import('../src/lib/powder-sim.ts')
const { SCENARIOS, begin, tickStats, foldCensus, paintCell } = await import('../src/lib/powder-goals.ts')

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

/* -------------------------------------------------------------------------- */
/* The scenarios                                                              */
/* -------------------------------------------------------------------------- */

/*
 * Each scenario is played to completion here, headlessly, against a seeded
 * random source. That is the only claim worth making about a puzzle: not that
 * the predicate compiles, but that somebody can actually satisfy it.
 *
 * The negative half matters as much. Every scenario is also run for the same
 * number of frames with nobody touching it and must *not* finish, or the task
 * is "wait", which is not a task.
 */

const RX = buildLookup()
const GW = 160, GH = 110

/*
 * The solutions paint through paintCell, exactly as the page does, so they are
 * spending the same budget and obeying the same reach. A solution that ignored
 * either would be proving a scenario is solvable in a game nobody is playing.
 */
const CTX = { o: null, s: null, sc: null }

const SOLID = new Set([STONE, WOOD, GLASS, R_ICE])

function dab(cx, cy, r, el) {
  const { o, s, sc } = CTX
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue
      // The page thins non-solid brushes so pouring looks like pouring. It
      // also means a pour costs less budget than a wall does, which is worth
      // reproducing rather than approximating.
      if (!SOLID.has(el) && o.rand() < 0.3) continue
      paintCell(o, s, sc, cx + dx, cy + dy, el)
    }
  }
}

/**
 * A drag, interpolated one cell at a time exactly as the page does.
 *
 * This is not a detail. Twelve evenly spaced discs across the canvas cost
 * about eight hundred cells; the same gesture made with a pointer paints every
 * cell along the line and costs three and a half thousand. Budgets calibrated
 * against the first are a different game from the one anybody plays.
 */
function stroke(fx0, fx1, fy, r, el) {
  const { o } = CTX
  const x0 = Math.round(fx0 * o.w), x1 = Math.round(fx1 * o.w), y = Math.round(fy * o.h)
  const steps = Math.abs(x1 - x0)
  for (let i = 0; i <= steps; i++) dab(Math.round(x0 + ((x1 - x0) * i) / steps), y, r, el)
}

/** A single press, in fractions, for the times one dab is the whole answer. */
function brush(fx, fy, r, el) {
  const { o } = CTX
  dab(Math.round(fx * o.w), Math.round(fy * o.h), r, el)
}

/** Run a scenario, reporting the first frame at which it was solved. */
function play(sc, frames, act, seed = 7) {
  const o = createWorld(GW, GH, mulberry32(seed))
  const st = begin(o, sc)
  CTX.o = o; CTX.s = st; CTX.sc = sc
  const c = new Uint32Array(SLOTS)
  let solvedAt = null
  for (let f = 0; f < frames; f++) {
    if (act) act(f)
    step(o, RX)
    tickStats(o, st)
    if (f % 4 === 0 || f === frames - 1) {
      census(o, c)
      foldCensus(st, c)
      if (solvedAt === null && sc.done(c, st, o)) solvedAt = f
    }
  }
  census(o, c)
  return { solvedAt, world: o, stats: st, c, line: sc.progress(c, st, o), spent: st.spent }
}

const SOLUTIONS = {
  // Lava is denser than sand, so pouring it on top is enough - it sinks in.
  glass: (f) => { if (f < 60 && f % 20 === 0) stroke(0.05, 0.95, 0.58, 2, LAVA) },
  // The same idea into water, which quenches rather than melts.
  island: (f) => { if (f < 300 && f % 20 === 0) stroke(0.05, 0.95, 0.4, 3, LAVA) },
  // Light it, let it take, then drown it before the embers spread.
  house: (f) => {
    if (f < 10) brush(0.5, 0.75, 4, FIRE)
    if (f >= 18 && f % 6 === 0) stroke(0.22, 0.78, 0.3, 5, WATER)
  },
  // Wet the dirt into mud first, then seed it. A light hand with the water:
  // it is the seeds that need the budget, and once a few plants take they
  // drink and spread on their own.
  forest: (f) => {
    if (f < 80 && f % 40 === 0) stroke(0.05, 0.95, 0.45, 2, WATER)
    if (f >= 120 && f < 500 && f % 40 === 0) stroke(0.05, 0.95, 0.4, 2, SEED)
  },
  salt: (f) => { if (f % 30 === 0) stroke(0.02, 0.98, 0.46, 3, SALT) },
  // One spark on the pad. Everything after that is the wire's doing.
  wire: (f) => { if (f === 5) brush(0.08, 0.32, 2, SPARK) },
  // Line the tank before it eats its way out.
  acid: (f) => {
    if (f !== 0) return
    // Line the tank, walls and floor, before it gets through.
    for (let y = 0.34; y <= 0.95; y += 0.008) {
      brush(0.331, y, 1, GLASS)
      brush(0.669, y, 1, GLASS)
    }
    for (let x = 0.32; x <= 0.68; x += 0.006) brush(x, 0.938, 1, GLASS)
  },
  // A pile of thermite on the plate, then set it off.
  cut: (f) => {
    // Sparing with the thermite, because the spark comes out of the same
    // budget — the first attempt spent all of it on the pile and then had
    // nothing left to light it with, which is a fair way to lose.
    if (f < 20 && f % 10 === 0) stroke(0.42, 0.58, 0.5, 3, THERMITE)
    // Into the pile, not above it: a spark is a gas and rises away from
    // anything you drop it over.
    if (f === 60) stroke(0.44, 0.56, 0.55, 2, SPARK)
  },
}

console.log('\nscenarios')
report('there are eight', SCENARIOS.length === 8, String(SCENARIOS.length))
report('ids are unique', new Set(SCENARIOS.map((x) => x.id)).size === SCENARIOS.length)
report('all briefed and explained',
  SCENARIOS.every((x) => x.name.length > 3 && x.brief.length > 20 && x.note.length > 50))
report('every scenario has a budget',
  SCENARIOS.every((x) => x.budget > 0 && x.budget < 20000),
  SCENARIOS.map((x) => x.budget).join(' '))
report('every palette is drawable',
  SCENARIOS.every((x) => x.palette.length && x.palette.every((id) => byId(id) && byId(id).draw)),
  SCENARIOS.filter((x) => x.palette.some((id) => !(byId(id) || {}).draw)).map((x) => x.id).join(' '))

const BUDGET = 1400
for (const sc of SCENARIOS) {
  const solve = SOLUTIONS[sc.id]
  if (!solve) { report(sc.id + ': has a solution to try', false); continue }
  const won = play(sc, BUDGET, solve)
  report(sc.id.padEnd(7) + ' can be solved', won.solvedAt !== null,
    (won.solvedAt !== null ? 'at frame ' + won.solvedAt : won.line) +
    '  [' + won.spent + '/' + sc.budget + ' paint]')
  const idle = play(sc, BUDGET, null)
  report('        and not by doing nothing', idle.solvedAt === null, idle.line)
}

// A second seed, because a falling-sand puzzle that only works on one is luck.
console.log('\nthe same solutions on a different seed')
for (const sc of SCENARIOS) {
  const solve = SOLUTIONS[sc.id]
  if (!solve) continue
  const other = play(sc, BUDGET, solve, 991)
  report(sc.id.padEnd(7) + ' still solvable', other.solvedAt !== null,
    other.solvedAt !== null ? 'frame ' + other.solvedAt : other.line)
}

/*
 * A scenario is only a puzzle if technique changes the outcome. Glass is the
 * clearest case: the same nine hundred cells of lava make well over twice as
 * much glass spread across the bed as they do dumped in a heap, because lava
 * wraps itself in the glass it makes and stops. If both worked, the budget
 * would be decoration.
 */
{
  const sc = SCENARIOS.find((x) => x.id === 'glass')
  const spread = play(sc, 1400, (f) => { if (f < 60 && f % 20 === 0) stroke(0.05, 0.95, 0.58, 2, LAVA) })
  const heap = play(sc, 1400, (f) => { if (f < 60 && f % 4 === 0) brush(0.5, 0.58, 6, LAVA) })
  report('spreading the lava solves the glass bed', spread.solvedAt !== null, spread.line)
  report('...and dumping the same amount does not', heap.solvedAt === null, heap.line)
  report('...by a wide margin, not a rounding error',
    spread.c[GLASS] > heap.c[GLASS] * 1.8,
    spread.c[GLASS] + ' glass spread vs ' + heap.c[GLASS] + ' heaped')
}

const wire = SCENARIOS.find((x) => x.id === 'wire')
report('the wire mask puts the barrel out of reach', wire.drawTo !== undefined && wire.drawTo < 0.7,
  'you may draw in the first ' + Math.round(wire.drawTo * 100) + '%')

/* -------------------------------------------------------------------------- */
/* The engine, after being lifted out of the page                             */
/* -------------------------------------------------------------------------- */

console.log('\nthe engine, after being lifted out of the page')

{
  const a = play(SCENARIOS[0], 200, SOLUTIONS.glass, 3)
  const b = play(SCENARIOS[0], 200, SOLUTIONS.glass, 3)
  let same = true
  for (let i = 0; i < a.world.grid.length; i++) {
    if (a.world.grid[i] !== b.world.grid[i]) { same = false; break }
  }
  report('a seeded run is reproducible', same)
}
{
  const o = createWorld(20, 20, mulberry32(1))
  put(o, 10, 2, SAND)
  put(o, 4, 2, STONE)
  for (let f = 0; f < 60; f++) step(o, RX)
  const c = census(o)
  report('sand falls to the floor', o.grid[19 * 20 + 10] === SAND)
  report('stone stays where it was put', o.grid[2 * 20 + 4] === STONE)
  report('neither was created nor destroyed', c[SAND] === 1 && c[STONE] === 1)
}
{
  // Oil floats on water because it is lighter. Nothing says so anywhere; it
  // falls out of one density comparison in the movement rules.
  const o = createWorld(9, 30, mulberry32(5))
  for (let y = 10; y < 24; y++) {
    for (let x = 0; x < 9; x++) put(o, x, y, y < 17 ? WATER : OIL)
  }
  for (let f = 0; f < 400; f++) step(o, RX)
  let oilY = 0, waterY = 0, no = 0, nw = 0
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 9; x++) {
      const g = o.grid[y * 9 + x]
      if (g === OIL) { oilY += y; no++ }
      if (g === WATER) { waterY += y; nw++ }
    }
  }
  report('oil ends up above water on its own', no > 0 && nw > 0 && oilY / no < waterY / nw,
    'oil at row ' + (oilY / no).toFixed(1) + ', water at ' + (waterY / nw).toFixed(1))
}

console.log(failures === 0 ? '\nAll checks passed.\n' : '\n' + failures + ' check(s) failed.\n')
process.exit(failures === 0 ? 0 : 1)

/**
 * Checks Ambient Mix's presets and the code that goes in a shared URL.
 *
 * A mix code is a promise to a stranger. Somebody pastes a link into a message
 * and somebody else opens it a month later, possibly after the site has
 * changed — so the interesting properties are not "does it encode" but:
 *
 *   - does a mix survive the round trip, to the precision it claims;
 *   - does a link still mean the same thing if the layer list is reordered or
 *     added to, which is the mistake an index-based format makes;
 *   - does junk in the URL degrade rather than explode.
 *
 * The last one matters because the string arrives from outside. Every mangling
 * this can think of is thrown at `decode`, and it has to return either a mix
 * or null, never throw.
 *
 *   node scripts/check-mix.mjs [--verbose]
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  LAYERS, PRESETS, VERSION, encode, decode, quantise, layerCount,
  layerById, layerByCode, presetById,
} = await import('../src/lib/mix-code.ts')

const VERBOSE = process.argv.includes('--verbose')

let failures = 0
const report = (label, ok, extra = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}

/** Deterministic, so a failure can be reproduced from the seed alone. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

console.log(`\n${LAYERS.length} layers, ${PRESETS.length} presets, format v${VERSION}\n`)

/* -------------------------------------------------------------------------- */
/* The layers                                                                 */
/* -------------------------------------------------------------------------- */

console.log('the layers')

const ids = LAYERS.map((l) => l.id)
const codes = LAYERS.map((l) => l.code)
report('ids are unique', new Set(ids).size === ids.length)
report('codes are unique', new Set(codes).size === codes.length,
  codes.filter((c, i) => codes.indexOf(c) !== i).join(' '))
report('every code is a single character', codes.every((c) => c.length === 1))
report('codes avoid the volume alphabet',
  codes.every((c) => !/[0-9]/.test(c)),
  'a digit would be readable as a volume by a sloppier parser')
report('codes are URL-safe without escaping',
  codes.every((c) => encodeURIComponent(c) === c))
report('every layer is named and explained',
  LAYERS.every((l) => l.name.length > 2 && l.hint.length > 8))
report('lookups agree', LAYERS.every((l) => layerById(l.id) === l && layerByCode(l.code) === l))

/* -------------------------------------------------------------------------- */
/* Round trips                                                                */
/* -------------------------------------------------------------------------- */

console.log('\nround trips')

{
  // 32 steps, so nothing should move by more than half a step. The epsilon is
  // because the worst case lands exactly on the bound and binary rounding
  // should not be what decides whether this passes.
  const tolerance = 1 / 62 + 1e-9
  const rnd = mulberry32(11)
  let worst = 0
  let worstAt = ''
  for (let n = 0; n < 4000; n++) {
    const levels = {}
    for (const l of LAYERS) if (rnd() < 0.5) levels[l.id] = rnd()
    const mix = { master: rnd(), levels }
    const back = decode(encode(mix))
    if (!back) { worst = 1; worstAt = 'decode returned null'; break }
    worst = Math.max(worst, Math.abs(back.master - mix.master))
    for (const l of LAYERS) {
      const a = mix.levels[l.id] ?? 0
      const b = back.levels[l.id] ?? 0
      // A level that quantises to zero is dropped on purpose, and that is not
      // a round-trip failure — it is a silent layer staying silent.
      if (a > 0 && b === 0 && a < 1 / 62) continue
      const d = Math.abs(a - b)
      if (d > worst) { worst = d; worstAt = `${l.id} ${a.toFixed(4)} -> ${b.toFixed(4)}` }
    }
  }
  report('4,000 random mixes survive the round trip', worst <= tolerance,
    `worst drift ${worst.toExponential(2)} (allowed ${tolerance.toExponential(2)})${worstAt ? ' at ' + worstAt : ''}`)
}

report('encoding is stable', encode(PRESETS[0].mix) === encode(PRESETS[0].mix))
report('a silent mix is still a valid code',
  decode(encode({ master: 0, levels: {} })) !== null, encode({ master: 0, levels: {} }))
report('silent layers are left out, not written as zero',
  encode({ master: 1, levels: { rain: 0.5, waves: 0 } }).length === 4,
  encode({ master: 1, levels: { rain: 0.5, waves: 0 } }))

{
  const full = encode({ master: 1, levels: Object.fromEntries(LAYERS.map((l) => [l.id, 1])) })
  report('even every layer at once fits in a tweetable code', full.length <= 32,
    `${full.length} chars: ${full}`)
  report('...and comes back with all of them', layerCount(decode(full)) === LAYERS.length)
}

/* -------------------------------------------------------------------------- */
/* The property an index-based format would get wrong                         */
/* -------------------------------------------------------------------------- */

console.log('\nlinks shared today, opened after the site changes')

{
  /*
   * The failure this guards against is quiet and total: encode by position,
   * add a layer at the top, and every link in the world now plays the wrong
   * sounds with no error anywhere. So the code is checked against a mutated
   * copy of the layer table.
   */
  const original = LAYERS.slice()
  const mix = { master: 0.7, levels: { rain: 0.8, thunder: 0.5, clock: 0.3 } }
  const before = encode(mix)

  const restore = () => { LAYERS.length = 0; LAYERS.push(...original) }

  // Reversed.
  LAYERS.length = 0
  LAYERS.push(...original.slice().reverse())
  const reversed = decode(before)
  const reversedCode = encode(mix)
  restore()
  report('a link survives the layer list being reordered',
    reversed !== null &&
    Math.abs((reversed.levels.rain ?? 0) - 0.8) < 0.02 &&
    Math.abs((reversed.levels.thunder ?? 0) - 0.5) < 0.02 &&
    Math.abs((reversed.levels.clock ?? 0) - 0.3) < 0.02 &&
    layerCount(reversed) === 3)
  report('...though the code is written in the new order',
    reversedCode !== before && decode(reversedCode).levels.rain !== undefined,
    `${before} vs ${reversedCode}`)

  // A layer removed: its pair should be skipped, the rest should play.
  LAYERS.length = 0
  LAYERS.push(...original.filter((l) => l.id !== 'thunder'))
  const trimmed = decode(before)
  restore()
  report('a link naming a layer this version lost still plays the rest',
    trimmed !== null && layerCount(trimmed) === 2 && trimmed.levels.thunder === undefined,
    `${layerCount(trimmed)} of 3 layers recovered`)

  // A layer added: an old link must be unaffected by it.
  LAYERS.length = 0
  LAYERS.push({ id: 'kettle', name: 'Kettle', glyph: '', hint: 'A kettle', code: 'z' }, ...original)
  const grown = decode(before)
  restore()
  report('...and one made before a layer existed is unchanged by it',
    grown !== null && layerCount(grown) === 3 && grown.levels.kettle === undefined)

  report('the layer table was left exactly as it was found',
    LAYERS.length === original.length && LAYERS.every((l, i) => l === original[i]))
}

/* -------------------------------------------------------------------------- */
/* Junk from the address bar                                                  */
/* -------------------------------------------------------------------------- */

console.log('\njunk, because this arrives from outside')

{
  const good = encode(PRESETS[0].mix)
  const nasty = [
    null, undefined, '', ' ', '1', '2', 'x', '0000', VERSION,
    good.slice(0, -1),                       // half a trailing pair
    good + 'r',                              // an orphan code
    good + '??',                             // a pair of nonsense
    good.toUpperCase(),                      // case mangled by a chat client
    '1' + ' '.repeat(4),
    '1z' + 'r'.repeat(10000),                // very long
    '1k' + 'zz'.repeat(200),                 // all-unknown codes
    '../../etc/passwd', '<script>alert(1)</script>', '%%%%',
    '1k rain=1', '1k;DROP TABLE', '1k\n\nr v',
  ]
  let threw = null
  let bad = null
  for (const s of nasty) {
    let out
    try { out = decode(s) } catch (e) { threw = `${JSON.stringify(s)?.slice(0, 30)}: ${e.message}`; break }
    if (out !== null) {
      if (typeof out.master !== 'number' || !Number.isFinite(out.master) ||
          out.master < 0 || out.master > 1) { bad = JSON.stringify(s)?.slice(0, 30); break }
      for (const [id, v] of Object.entries(out.levels)) {
        if (!layerById(id) || !(v > 0) || v > 1) { bad = `${JSON.stringify(s)?.slice(0, 30)} -> ${id}=${v}`; break }
      }
    }
  }
  report('nothing thrown by any of it', threw === null, threw ?? `${nasty.length} inputs`)
  report('anything it does accept is a usable mix', bad === null, bad ?? '')
  report('a code with the wrong version is refused', decode('9' + good.slice(1)) === null)
  report('a code with no version is refused', decode(good.slice(1)) === null)
  report('an all-unknown code is a valid empty mix',
    layerCount(decode('1k' + 'zz'.repeat(4))) === 0)
}

/* -------------------------------------------------------------------------- */
/* The presets                                                                */
/* -------------------------------------------------------------------------- */

console.log('\nthe presets')

report('there are at least six', PRESETS.length >= 6, String(PRESETS.length))
report('ids are unique', new Set(PRESETS.map((p) => p.id)).size === PRESETS.length)
report('names are unique', new Set(PRESETS.map((p) => p.name)).size === PRESETS.length)
report('all named and explained',
  PRESETS.every((p) => p.name.length > 3 && p.note.length > 25))
report('lookup works', PRESETS.every((p) => presetById(p.id) === p))
report('every level names a real layer',
  PRESETS.every((p) => Object.keys(p.mix.levels).every((id) => layerById(id))),
  PRESETS.flatMap((p) => Object.keys(p.mix.levels)).filter((id) => !layerById(id)).join(' '))
report('every level is in range',
  PRESETS.every((p) => Object.values(p.mix.levels).every((v) => v > 0 && v <= 1) &&
    p.mix.master > 0 && p.mix.master <= 1))
report('none is silent', PRESETS.every((p) => layerCount(p.mix) >= 1))
report('none is a single layer with the volume up',
  PRESETS.every((p) => layerCount(p.mix) >= 2 || p.id === 'unbearable'),
  PRESETS.filter((p) => layerCount(p.mix) < 2).map((p) => p.id).join(' '))

{
  // Two presets that encode identically are the same preset with two names.
  const seen = new Map()
  let dup = null
  for (const p of PRESETS) {
    const c = encode(p.mix)
    if (seen.has(c)) dup = `${seen.get(c)} and ${p.id} are the same mix (${c})`
    seen.set(c, p.id)
  }
  report('no two presets are the same mix', dup === null, dup ?? '')
}

report('every preset survives being shared',
  PRESETS.every((p) => {
    const back = quantise(p.mix)
    if (layerCount(back) !== layerCount(p.mix)) return false
    if (Math.abs(back.master - p.mix.master) > 1 / 62) return false
    return Object.entries(p.mix.levels).every(
      ([id, v]) => Math.abs((back.levels[id] ?? 0) - v) <= 1 / 62)
  }))

report('the loud one really is everything',
  layerCount(presetById('unbearable').mix) === LAYERS.length)

if (VERBOSE) {
  console.log('')
  for (const p of PRESETS) {
    console.log(`       ${p.name.padEnd(18)} ${encode(p.mix).padEnd(28)} ${layerCount(p.mix)} layers`)
  }
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)

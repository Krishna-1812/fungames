/**
 * check-constellation-code — proves a drawn constellation survives being
 * turned into a URL and back, including the edge cases a real visitor's
 * link will eventually hit.
 *
 *   node scripts/check-constellation-code.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { encodeStrokes, decodeStrokes, colorCss, DRAW_COLORS } = await import('../src/lib/constellation-code.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

console.log('a real drawing round-trips exactly')
{
  const strokes = [{ starIds: [32263, 24378, 27919] }, { starIds: [90979, 97338] }]
  const code = encodeStrokes(strokes)
  const back = decodeStrokes(code)
  check(back.length === 2, `both strokes survive (got ${back.length})`)
  check(JSON.stringify(back[0].starIds) === JSON.stringify(strokes[0].starIds), 'the first stroke\'s star order survives exactly')
  check(JSON.stringify(back[1].starIds) === JSON.stringify(strokes[1].starIds), 'the second stroke\'s star order survives exactly')
}

console.log('\na stroke with fewer than two stars draws nothing, so it is dropped rather than encoded')
{
  const code = encodeStrokes([{ starIds: [1] }, { starIds: [] }, { starIds: [2, 3] }])
  const back = decodeStrokes(code)
  check(back.length === 1, `only the real two-star stroke survives (got ${back.length})`)
}

console.log('\ndecodeStrokes never throws on malformed input')
{
  for (const bad of ['', '_', '...', 'not-base-36!!', '5..6', '_5.6_', '0.1']) {
    let threw = false
    let result
    try { result = decodeStrokes(bad) } catch { threw = true }
    check(!threw, `"${bad}" does not throw`)
    check(Array.isArray(result), `"${bad}" returns an array either way`)
  }
  // A leading zero id (the real HYG id 0 is the Sun, never a real catalogued
  // star here) must not sneak a phantom star into a decoded stroke.
  const withZero = decodeStrokes('0.5.6')
  check(withZero[0]?.starIds.every((id) => id > 0), 'id 0 (the Sun placeholder, never in this catalogue) is filtered out of a decoded stroke')
}

console.log('\nevery draw colour key round-trips to its own real CSS colour, and an unknown key falls back rather than crashing')
{
  for (const c of DRAW_COLORS) check(colorCss(c.key) === c.css, `"${c.key}" -> ${c.css}`)
  check(colorCss('not-a-real-key') === DRAW_COLORS[0].css, 'an unknown colour key falls back to the first palette colour')
}

console.log(failures ? `\n${failures} failed.` : '\nAll constellation-code checks passed.')
process.exitCode = failures ? 1 : 0

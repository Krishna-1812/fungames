/**
 * check-fold-curl — does the flap fold like paper?
 *
 * lib/fold/curl.ts gives the shape of a fold in progress: a loose roll near the
 * crease that tightens to half the stack's thickness as it lands. A shape like
 * that is easy to get subtly wrong in ways that still look like a fold — paper
 * that stretches, a flap that dips through the sheet it is landing on, a
 * crease tighter than the paper inside it allows — so this walks it:
 *
 *   1. the paper never stretches or shrinks: the flap is a long at every
 *      stage of the fold;
 *   2. flat at the start, and at the end lying exactly on top, face down,
 *      stopping short of the far edge by the length the bend took;
 *   3. it never goes through the half it is folding onto, or through the desk;
 *   4. the bend is never tighter than half the stack, and is exactly that once
 *      the fold is pressed down.
 *
 *   node scripts/check-fold-curl.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { curl } = await import('../src/lib/fold/curl.ts')

let failures = 0
const check = (c, m) => { if (!c) failures++; if (!c || process.env.VERBOSE) console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`) }

// Sheets as the page draws them: half-widths and stack heights in the same
// units, from a single sheet (h tiny) to a stack fatter than it is wide.
const CASES = [
  { a: 1, h: 0.0007, name: 'one sheet of A4' },
  { a: 1, h: 0.05, name: 'a few folds in' },
  { a: 1, h: 0.4, name: 'a stack nearly at its limit' },
  { a: 1, h: 1.2, name: 'a stack fatter than its flap' },
]
const US = Array.from({ length: 41 }, (_, k) => k / 40)
const N = 600

for (const { a, h, name } of CASES) {
  console.log(`\n${name} (h = ${h})`)
  let worstLen = 0, through = 0, belowDesk = 0, tight = 0
  for (const u of US) {
    const c = curl(u, a, h)
    if (c.R < h / 2 - 1e-12) tight++
    let len = 0, prev = c.at(0)
    for (let i = 1; i <= N; i++) {
      const s = (a * i) / N, p = c.at(s)
      len += Math.hypot(p.x - prev.x, p.y - prev.y)
      prev = p
      const lo = Math.min(p.y + p.ny * h / 2, p.y - p.ny * h / 2)
      // Over the half it lands on (x < 0), the paper's lower face stays on or above its top.
      if (p.x < -1e-9 && lo < h - 1e-7) through++
      if (lo < -1e-9) belowDesk++
    }
    worstLen = Math.max(worstLen, Math.abs(len - a) / a)
  }
  check(worstLen < 0.002, `the paper never stretches: the flap stays its own length (worst ${(worstLen * 100).toFixed(3)}%)`)
  check(through === 0, `it never passes through the half it is folding onto (${through} points)`)
  check(belowDesk === 0, `it never goes through the desk (${belowDesk} points)`)
  check(tight === 0, 'the bend is never tighter than half the stack')

  const flat = curl(0, a, h)
  const isFlat = Array.from({ length: 11 }, (_, k) => flat.at((a * k) / 10)).every((p, k) => Math.abs(p.y - h / 2) < 1e-12 && Math.abs(p.x - (a * k) / 10) < 1e-12)
  check(isFlat, 'before the fold it lies flat')

  const done = curl(1, a, h)
  check(Math.abs(done.R - h / 2) < 1e-12, `pressed down, the bend is exactly half the stack (${done.R.toFixed(5)})`)
  const bend = Math.PI * h / 2
  if (a > bend) {
    const edge = done.at(a)
    const face = edge.y + edge.ny * h / 2
    check(Math.abs(face - h) < 1e-9 && edge.ny < 0, 'it lands face down, lying exactly on the top of the other half')
    check(Math.abs(edge.x - -(a - bend)) < 1e-9, `the free edge stops short of the far side by the bend's length (${bend.toFixed(4)})`)
  } else {
    check(done.at(a).x > -1e-9, 'a stack fatter than its flap cannot reach over at all: the bend takes all of it')
  }
  let mono = true
  for (let k = 1; k < US.length; k++) if (curl(US[k], a, h).theta < curl(US[k - 1], a, h).theta) mono = false
  check(mono, 'pulling further always turns it further')
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall curl checks passed\n')
process.exit(failures ? 1 : 0)

/**
 * check-steady-neon — does Steady Hand's neon always come to rest?
 *
 * The tube is decoration on top of the scoring, but decoration with physics
 * in it: a flicker when it catches, and shards that fall and bounce when it
 * breaks. Either one stuck half-way would leave the board looking wrong (a
 * tube that never finishes lighting, glass that never stops falling, an
 * animation loop running for ever). This steps the module frame by frame and
 * checks:
 *
 *   1. a tube that catches ends fully lit, within a second;
 *   2. broken glass lands, settles and is gone within two seconds, and its
 *      pieces are heard landing;
 *   3. no shard ever falls through the floor or becomes NaN;
 *   4. with reduced motion, the tube is lit at once, nothing breaks into
 *      pieces, and no animation frame is ever asked for.
 *
 *   node scripts/check-steady-neon.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

let frames = [], now = 0
globalThis.requestAnimationFrame = (f) => { frames.push(f); return frames.length }
globalThis.performance = { now: () => now }
const run = (seconds, each) => {
  for (let i = 0; i < seconds * 60; i++) {
    now += 1000 / 60
    const f = frames; frames = []
    f.forEach((fn) => fn(now))
    each?.()
    if (!frames.length) return (i + 1) / 60
  }
  return Infinity
}

/* A 2D context that draws nothing but answers everything. */
const noop = () => {}
const grad = { addColorStop: noop }
const ctx2d = () => new Proxy({ filter: 'none' }, {
  get: (o, k) => k in o ? o[k]
    : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad
    : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
    : k === 'createPattern' ? () => ({})
    : noop,
  set: (o, k, v) => { o[k] = v; return true },
})
const canvas = () => { const x = ctx2d(); return { width: 0, height: 0, getContext: () => x } }
globalThis.document = { createElement: canvas }

const { createNeon, GASES } = await import('../src/lib/steady/neon.ts')

let failures = 0
const check = (c, m) => { if (!c) failures++; if (!c || process.env.VERBOSE) console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`) }

const W = 900, H = 600
const spiral = Array.from({ length: 240 }, (_, i) => {
  const t = i / 239, a = t * Math.PI * 4, r = t * 220
  return { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r }
})

console.log('\nwith motion')
{
  let lands = 0
  const n = createNeon(canvas(), { animate: true, onLand: () => lands++ })
  n.resize(W, H, 2)
  n.set({ tube: spiral, gas: GASES.spiral.rgb, mode: 'warm' })
  n.ignite()
  // A dip is the light falling well back from a peak it had reached.
  let dips = 0, peak = 0
  const t = run(3, () => { if (n.lit > peak) peak = n.lit; else if (n.lit < peak - 0.4) { dips++; peak = n.lit } })
  check(t < 1, `the tube catches and holds within a second (${t.toFixed(2)} s)`)
  check(n.lit === 1, `and ends fully lit (${n.lit})`)
  check(dips >= 2, `it stutters on the way, the way neon does (${dips} dips)`)

  n.shatter()
  let below = 0, nan = 0
  const t2 = run(4, () => {
    // Reach into the drawing: every shard is still on the wall, and a number.
    for (const d of n._shards?.() ?? []) { if (d.y > H) below++; if (![d.x, d.y, d.a].every(Number.isFinite)) nan++ }
  })
  check(t2 < 2, `broken glass lands and is gone within two seconds (${t2.toFixed(2)} s)`)
  check(below === 0, `no piece falls through the floor (${below})`)
  check(nan === 0, `no piece becomes NaN (${nan})`)
  check(lands > 10, `the pieces are heard landing (${lands})`)
  check(n.state.tube.length === 0 && n.state.mode === 'none', 'and the tube is gone from the wall')
}

console.log('\nreduced motion')
{
  frames = []
  const n = createNeon(canvas(), { animate: false })
  n.resize(W, H, 1)
  n.set({ tube: spiral, gas: GASES.line.rgb, mode: 'warm' })
  n.ignite()
  check(n.lit === 1, 'the tube is lit at once')
  n.shatter()
  check((n._shards?.() ?? []).length === 0, 'a miss clears the tube without pieces')
  check(frames.length === 0, 'no animation frame is ever asked for')
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall neon checks passed\n')
process.exit(failures ? 1 : 0)

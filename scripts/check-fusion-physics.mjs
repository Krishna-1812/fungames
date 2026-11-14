/**
 * Checks Fusion's bench physics (src/lib/fusion-physics.ts).
 *
 * The board is an air table, so the laws it should keep are a puck's:
 * a collision conserves momentum and never creates energy, a heavier token
 * is moved less, nothing leaves the board or ends up inside something else,
 * a flicked token coasts and stops, a held token follows the hand and leaves
 * it with the hand's velocity, and a fusion's blast pushes outwards.
 *
 *   node scripts/check-fusion-physics.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { World, THROW_WINDOW } = await import('../src/lib/fusion-physics.ts')

let failures = 0
const check = (ok, label, extra = '') => {
  if (!ok) failures++
  if (!ok || process.argv.includes('--verbose')) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}
const run = (w, seconds) => { const hits = []; for (let i = 0; i < seconds * 60; i++) hits.push(...w.advance(1 / 60)); return hits }
const rand = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) })()

console.log('Fusion: the bench')

// ---- a head-on collision ------------------------------------------------------
{
  const w = new World(); w.resize(2000, 600)
  const a = w.add(400, 300, 38, 1), b = w.add(700, 300, 38, 3)
  a.vx = 600
  let px = a.m * a.vx, before = 0, hits = []
  // Step until they touch; note momentum and energy just before and after.
  for (let i = 0; i < 600 && !hits.length; i++) { before = w.energy(); px = a.m * a.vx + b.m * b.vx; hits = w.advance(1 / 120) }
  const after = w.energy(), pxAfter = a.m * a.vx + b.m * b.vx
  check(hits.length === 1 && hits[0].speed > 100, 'a collision is reported, with its closing speed', `${hits[0]?.speed.toFixed(0)} px/s`)
  // One step of the table's drag acts in the same step as the hit.
  px *= Math.exp(-1.6 / 120)
  check(Math.abs(pxAfter - px) < 1e-6 * Math.abs(px) + 1e-6, 'momentum is conserved through it', `${px.toFixed(2)} → ${pxAfter.toFixed(2)}`)
  check(after <= before + 1e-6 && after > before * 0.2, 'and energy is lost, not made', `${before.toFixed(0)} → ${after.toFixed(0)}`)
  check(Math.abs(b.vx) < Math.abs(a.vx - 600) , 'the heavier token is moved less than the lighter one is slowed')
  check(a.vx < 0 && b.vx > 0, 'a light token bounces back off a heavy one')
}

// ---- coasting -----------------------------------------------------------------
{
  const w = new World(); w.resize(4000, 600)
  const a = w.add(100, 300, 38)
  a.vx = 900
  run(w, 0.5)
  const mid = a.vx
  run(w, 6)
  check(mid > 300 && mid < 600, 'a flicked token coasts', `${mid.toFixed(0)} px/s after half a second`)
  check(Math.abs(a.vx) < 1 && a.x > 400 && a.x < 800, 'and comes to rest a sensible way off', `${(a.x - 100).toFixed(0)} px`)
}

// ---- the hand -----------------------------------------------------------------
{
  const w = new World(); w.resize(1200, 800)
  const a = w.add(200, 400, 38), still = w.add(600, 400, 38)
  w.grab(a, 200, 400)
  // Drag steadily to the right at 600 px/s, straight through the other token.
  for (let i = 0; i < 60; i++) { a.tx = 200 + i * 10; w.advance(1 / 60) }
  check(Math.abs(a.x - a.tx) < 60, 'a held token keeps up with the hand', `${(a.tx - a.x).toFixed(0)} px behind`)
  check(Math.abs(a.vx - 600) < 90, 'and has the hand\'s velocity', `${a.vx.toFixed(0)} px/s`)
  check(Math.abs(still.x - 600) < 1e-6, 'it passes over other tokens without shoving them')
  w.release(a)
  check(a.thrown === THROW_WINDOW, 'let go at speed, it counts as thrown')
  // Hold still, then let go: set down, not thrown.
  const c = w.add(300, 200, 38)
  w.grab(c, 300, 200); run(w, 0.5); w.release(c)
  check(c.thrown === 0, 'let go at rest, it is only set down')
  // Set down on top of another: that one is "under" it.
  c.x = still.x + 10; c.y = still.y + 5
  check(w.under(c) === still, 'a token set down on another finds it underneath')
  check(w.at(still.x, still.y) !== null && w.at(5, 5) === null, 'a point finds the token under it')
}

// ---- a crowd: nothing escapes, nothing overlaps, it all settles -----------------
{
  const w = new World(); w.resize(900, 600)
  for (let i = 0; i < 40; i++) { const b = w.add(100 + rand() * 700, 100 + rand() * 400, 30 + rand() * 12, 0.6 + rand() * 2); b.vx = (rand() - 0.5) * 1500; b.vy = (rand() - 0.5) * 1500 }
  let peak = w.energy(), grew = false, last = peak
  for (let i = 0; i < 60 * 12; i++) {
    w.advance(1 / 60)
    const e = w.energy()
    // Positional correction can add a whisker; anything more is a bug.
    if (e > last * 1.02 + 50) grew = true
    last = e
  }
  const inside = w.bodies.every((b) => b.x >= b.r - 0.01 && b.x <= 900 - b.r + 0.01 && b.y >= b.r - 0.01 && b.y <= 600 - b.r + 0.01)
  let worst = 0
  for (const a of w.bodies) for (const b of w.bodies) if (a.id < b.id) worst = Math.max(worst, a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y))
  check(!grew, 'a crowd never gains energy')
  check(inside, 'every token stays on the board')
  check(worst < 1.5, 'and none ends up inside another', `worst overlap ${worst.toFixed(2)} px`)
  check(w.energy() < peak * 1e-4, 'and it all comes to rest')
  check(w.bodies.every((b) => Number.isFinite(b.x + b.y + b.vx + b.vy)), 'with every number finite')
}

// ---- a fusion's blast -----------------------------------------------------------
{
  const w = new World(); w.resize(1000, 1000)
  const near = w.add(560, 500, 30), far = w.add(500, 900, 30), heavy = w.add(440, 500, 30, 4)
  w.blast(500, 500, 9000, 200)
  check(near.vx > 0 && Math.abs(near.vy) < 1e-9, 'a blast pushes straight outwards')
  check(far.vx === 0 && far.vy === 0, 'only within its reach')
  check(Math.abs(heavy.vx) < near.vx / 3.5, 'and moves a heavy token less')
}

// ---- the same inputs, the same result -------------------------------------------
{
  const make = () => { const w = new World(); w.resize(800, 500); for (let i = 0; i < 12; i++) { const b = w.add(60 + i * 60, 250 + (i % 3) * 40, 28); b.vx = (i % 5 - 2) * 300; b.vy = (i % 4 - 1.5) * 260 } ; run(w, 3); return w.bodies.map((b) => b.x + b.y).join() }
  check(make() === make(), 'deterministic: the same start gives the same finish')
}

if (failures) { console.log(`\n${failures} check(s) failed.`); process.exitCode = 1 } else console.log('  all bench checks passed')

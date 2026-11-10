/**
 * check-trolley-physics — do the things on the layout fall the way things fall?
 *
 * The tram and the figures in Trolley are simulated, not animated, so what
 * happens when the tram arrives is whatever the solver says. This asks the
 * solver the questions somebody watching would:
 *
 *   1. Does a dropped body fall at g, land, and come to rest on the ground?
 *   2. Does an untouched figure stay exactly where it was put?
 *   3. Does a tram through five figures strike all five, throw them forward,
 *      leave none of them inside itself or under the grass, and end with
 *      everything at rest? At no point may anything move faster than a struck
 *      object could.
 *   4. Does the bed under the track hold a body up higher than the grass does?
 *   5. Do the routes go where the scenes say: the siding off to the side, the
 *      loop back onto the main line before the place people stand, and no
 *      curve tighter than a tram on two bogies can take?
 *
 *   node scripts/check-trolley-physics.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { makeBody, step, rot, STEP } = await import('../src/lib/trolley/physics.ts')
const { TRACK, route, branch, at, distAtX, groundAt, sideZ } = await import('../src/lib/trolley/track.ts')

let failures = 0
const check = (c, m) => { if (!c) failures++; console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`) }

const lowest = (b) => {
  let lo = Infinity
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rot(b.q, [sx * b.h[0], sy * b.h[1], sz * b.h[2]])
    lo = Math.min(lo, b.p[1] + r[1])
  }
  return lo
}
const finite = (b) => [...b.p, ...b.q, ...b.v, ...b.w].every(Number.isFinite)
const FIG = [0.24, 0.86, 0.17]

console.log('\n1. a dropped body')
{
  const b = makeBody(FIG, 70, [0, 6, 0], 0.3)
  b.asleep = false
  const w = { bodies: [b], drivers: [], ground: () => 0, g: 9.81 }
  const t = 0.5
  for (let i = 0; i < t / STEP; i++) step(w)
  const fell = 6 - b.p[1], want = 0.5 * 9.81 * t * t
  check(Math.abs(fell - want) / want < 0.03, `falls ${fell.toFixed(3)} m in ${t} s (g says ${want.toFixed(3)})`)
  for (let i = 0; i < 8 / STEP; i++) step(w)
  check(b.asleep, 'comes to rest and goes to sleep')
  check(Math.abs(lowest(b)) < 0.04, `rests on the ground (lowest corner at ${lowest(b).toFixed(3)})`)
  check(finite(b), 'every number is still a number')
}

console.log('\n2. an untouched figure')
{
  const b = makeBody(FIG, 70, [3, FIG[1], 1])
  const w = { bodies: [b], drivers: [], ground: () => 0, g: 9.81 }
  for (let i = 0; i < 10 / STEP; i++) step(w)
  check(b.p[0] === 3 && b.p[1] === FIG[1] && b.p[2] === 1, 'has not moved after ten seconds')
}

console.log('\n3. a tram through five figures')
{
  const lines = [() => 0]
  const ground = (x, z) => groundAt(x, z, lines)
  const bodies = []
  for (let k = 0; k < 5; k++) bodies.push(makeBody(FIG, 62 + k * 5, [TRACK.STAND + (k - 2) * 0.9, TRACK.BED + FIG[1], (k % 2 ? 0.35 : -0.3)], k * 0.7))
  const tram = { h: [3.4, 1.5, 1.2], p: [-10, TRACK.BED + 0.1 + 1.5, 0], yaw: 0, v: [9, 0, 0], e: 0.2 }
  let struck = 0, top = 0
  const w = { bodies, drivers: [tram], ground, g: 9.81, onStrike: () => struck++ }
  let x = -10, v = 9
  const start = bodies.map((b) => b.p[0])
  for (let i = 0; i < 14 / STEP; i++) {
    // Brakes on once it is through them.
    if (x > TRACK.STAND + 3) v = Math.max(0, v - 3.2 * STEP)
    x += v * STEP
    tram.p[0] = x; tram.v[0] = v
    step(w)
    for (const b of bodies) top = Math.max(top, Math.hypot(...b.v))
  }
  check(struck === 5, `all five are struck (${struck})`)
  check(bodies.every(finite), 'every number is still a number')
  check(bodies.every((b, k) => b.p[0] > start[k] + 1), 'all five are thrown forward')
  check(top < 9 * 2.6, `nothing leaves faster than a struck thing could (${top.toFixed(1)} m/s off a 9 m/s tram)`)
  check(bodies.every((b) => b.asleep), 'everything is at rest fourteen seconds later')
  const sunk = bodies.filter((b) => lowest(b) < ground(b.p[0], b.p[2]) - 0.2).length
  check(sunk === 0, 'nothing has sunk into the ground')
  const inside = bodies.filter((b) => Math.abs(b.p[0] - tram.p[0]) < tram.h[0] - 0.3 && Math.abs(b.p[2]) < tram.h[2] - 0.3 && Math.abs(b.p[1] - tram.p[1]) < tram.h[1] - 0.3).length
  check(inside === 0, 'nothing is left inside the tram')
  const flat = bodies.filter((b) => Math.abs(rot(b.q, [0, 1, 0])[1]) < 0.5).length
  check(flat >= 4, `they end up lying down (${flat} of 5)`)
}

console.log('\n4. the ballast bed')
{
  const lines = [() => 0, (x) => (x > TRACK.FORK ? sideZ(x, false) : null)]
  check(groundAt(0, 0, lines) === TRACK.BED, 'the main line is on a bed')
  check(groundAt(30, TRACK.SIDE, lines) === TRACK.BED, 'so is the siding')
  check(groundAt(30, TRACK.SIDE / 2, lines) === 0, 'and there is grass between them')
  check(groundAt(-20, TRACK.SIDE, lines) === 0, 'and none where the siding has not started')
}

console.log('\n5. the routes')
{
  const side = route(true, false), loop = route(true, true), main = route(false)
  const end = at(side, side.length)
  check(Math.abs(end.z - TRACK.SIDE) < 1e-6, 'the siding ends up beside the main line')
  const atStand = at(loop, distAtX(loop, TRACK.STAND))
  check(Math.abs(atStand.z) < 1e-6, 'the loop is back on the main line where people stand')
  const mid = at(loop, distAtX(loop, -2.5))
  check(Math.abs(mid.z - TRACK.LOOP_SIDE) < 0.4, 'and well off it in between')
  check(Math.abs(main.length - (TRACK.FAR - TRACK.START + 8)) < 1e-6, 'the main line is straight')
  for (const [name, r] of [['siding', side], ['loop', loop]]) {
    // Heading change per metre: the tightest radius the tram is asked to take.
    let tight = Infinity
    for (let d = 1; d < r.length - 1; d += 0.5) {
      const a = at(r, d - 0.5), b = at(r, d + 0.5)
      const turn = Math.abs(Math.atan2(b.tz, b.tx) - Math.atan2(a.tz, a.tx))
      if (turn > 1e-6) tight = Math.min(tight, 1 / turn)
    }
    check(tight > 6.5, `the ${name}'s tightest curve is ${tight.toFixed(1)} m radius`)
  }
  const b = branch(true)
  check(Math.abs(b.pts[0].z) < 1e-6 && Math.abs(b.pts[b.pts.length - 1].z) < 1e-3, 'the loop branch starts and ends on the main line')
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall trolley physics checks passed\n')
process.exit(failures ? 1 : 0)

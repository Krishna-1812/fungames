/**
 * check-orbit-predict — is the path drawn while aiming the path flown?
 *
 * lib/orbit-predict.ts flies a launch forward before it happens, against the
 * heaviest dozen bodies, and works out what the launch is thrown relative to.
 * A preview that drifts from the real thing is worse than none, so this holds
 * it to:
 *
 *   1. the curve drawn is the curve the page's own physics then flies, to a
 *      hair, when nothing is left out;
 *   2. it stops where the body would hit something, and says so;
 *   3. a launch beside a moving planet is thrown relative to that planet, and
 *      one in open space relative to the star;
 *   4. the loop round a moving planet is drawn in the planet's frame, so it
 *      closes on itself instead of smearing into a spiral.
 *
 *   node scripts/check-orbit-predict.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { makeBody, resetIds, step, circularV } = await import('../src/lib/orbit-sim.ts')
const { launchFrame, predict } = await import('../src/lib/orbit-predict.ts')

let failures = 0
const report = (ok, label, extra = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}
const W = 1200, H = 800, CX = 600, CY = 400

/** A star, a giant on a circular orbit, and two small planets. */
function system() {
  resetIds()
  const s = [makeBody(CX, CY, 0, 0, 2600)]
  const R = 300, v = circularV(2600, R)
  s.push(makeBody(CX + R, CY, 0, v, 60))
  s.push(makeBody(CX - 140, CY, 0, -circularV(2600, 140), 8))
  s.push(makeBody(CX, CY + 200, circularV(2600, 200), 0, 5))
  return s
}

console.log('\nthe curve drawn is the curve flown')
{
  const bodies = system()
  const x = CX + 220, y = CY - 40, vx = 0.6, vy = 3.1
  const path = predict(bodies, x, y, vx, vy, 6, null, 300, W, H)
  // Now fly it for real, two half-steps a frame, exactly as the page does.
  let real = [...bodies.map((b) => ({ ...b })), makeBody(x, y, vx, vy, 6, true)]
  const me = real[real.length - 1]
  let worst = 0
  for (let f = 1; f < path.n; f++) {
    for (let s = 0; s < 2; s++) real = step(real, 0.5, W, H).bodies
    if (!real.includes(me)) break
    worst = Math.max(worst, Math.hypot(me.x - path.pts[f * 2], me.y - path.pts[f * 2 + 1]))
  }
  report(path.n > 100, 'it goes somewhere', `${path.n} frames`)
  // The path is kept in 32-bit floats, so a few hundred-thousandths of a
  // pixel is storage, not physics.
  report(worst < 1e-3, 'with every body included it matches the real flight to a thousandth of a pixel', `worst ${worst.toExponential(1)} px`)
}

console.log('\nit stops where it would hit')
{
  const bodies = system()
  // Dropped straight at the star from rest.
  const path = predict(bodies, CX + 150, CY + 2, 0, 0, 6, null, 400, W, H)
  report(!!path.hit, 'a fall into the star ends in a hit')
  const d = path.hit ? Math.hypot(path.hit.x - CX, path.hit.y - CY) : Infinity
  report(d < bodies[0].r + 10, '...at the star', `${d.toFixed(1)} px from its centre, radius ${bodies[0].r.toFixed(1)}`)
}

console.log('\nwhat a launch is thrown relative to')
{
  const bodies = system()
  const giant = bodies[1]
  const near = launchFrame(bodies, giant.x + 18, giant.y)
  report(near?.body === giant, 'beside the giant: the giant', near ? `reach ${near.reach.toFixed(1)} px` : 'nothing')
  const open = launchFrame(bodies, CX - 300, CY - 250)
  report(open?.body === bodies[0], 'in open space: the star')
  const far = launchFrame(bodies, giant.x + 80, giant.y)
  report(far?.body === bodies[0], 'outside the giant’s reach: the star again')
  report(launchFrame([], 10, 10) === null, 'an empty sky: nothing, so the screen')
}

console.log('\na moon’s loop is drawn round its planet')
{
  const bodies = system()
  const giant = bodies[1]
  const d = 18, v = circularV(61, d)
  const path = predict(bodies, giant.x + d, giant.y, giant.vx, giant.vy + v, 1, giant, 420, W, H)
  report(path.closed && !path.hit, 'it closes', `${path.n} frames`)
  let far = 0
  for (let i = 0; i < path.n; i++) far = Math.max(far, Math.hypot(path.pts[i * 2] - giant.x, path.pts[i * 2 + 1] - giant.y))
  report(far < d * 1.3, '...and stays round the planet’s current position', `furthest ${far.toFixed(1)} px for an orbit of ${d}`)
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall prediction checks passed\n')
process.exit(failures ? 1 : 0)

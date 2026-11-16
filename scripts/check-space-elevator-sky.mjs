/**
 * check-space-elevator-sky — is the sky outside the car the one its gauge
 * describes?
 *
 * The sky is drawn by a shader this cannot run. What it can check is the two
 * pieces of physics the shader is written from, against figures anyone can
 * look up, and that the page and the shader agree:
 *
 *   1. The horizon. From a height h it is below eye level by acos(R/(R+h)):
 *      about 3.2 degrees from an airliner at 10 km and 10.1 at the Karman
 *      line. The shader must use that, with the Earth's real radius.
 *   2. The air. The shader thins it by a scale height; the page's own
 *      pressure gauge comes from the Standard Atmosphere. The two must tell
 *      the same story to within the roughness of a single scale height.
 *   3. The page hands the shader its altitude, and the things that used to
 *      stand in for a sky are gone.
 *
 *   node scripts/check-space-elevator-sky.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const sky = read('src/lib/space-elevator-sky.ts')
const page = read('src/pages/space-elevator.astro')
const M = await import('../src/lib/space-elevator-model.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

console.log('\nthe horizon')
const R = +(/EARTH_RADIUS_M = ([\d_]+)/.exec(sky)?.[1] ?? '0').replace(/_/g, '')
{
  check(R === 6_371_000, `the Earth is its real size (${R.toLocaleString('en-US')} m)`)
  check(sky.includes('float dip = acos(R / (R + h));'), 'the horizon is drawn where it lies from that height')
  const dip = (h) => (Math.acos(R / (R + h)) * 180) / Math.PI
  check(Math.abs(dip(10_000) - 3.2) < 0.1, `3.2 degrees down from an airliner (${dip(10_000).toFixed(2)})`)
  check(Math.abs(dip(100_000) - 10.1) < 0.1, `10.1 at the Karman line (${dip(100_000).toFixed(2)})`)
  check(dip(300) < 0.6, `and next to nothing from a tower (${dip(300).toFixed(2)})`)
}

console.log('\nthe air')
{
  const H = +(/SCALE_HEIGHT_M = ([\d_]+)/.exec(sky)?.[1] ?? '0').replace(/_/g, '')
  check(H >= 7000 && H <= 8500 && sky.includes('float air = exp(-h / H);'), `it thins by a scale height of ${H.toLocaleString('en-US')} m`)
  // Against the page's own gauge, which is the Standard Atmosphere. One scale height cannot fit
  // every layer; within a factor of two and a half is the same story.
  const worst = [2000, 5000, 10_000, 20_000, 30_000].map((h) => { const a = Math.exp(-h / H), b = M.approxPressureRatio(h); return Math.max(a / b, b / a) })
  check(Math.max(...worst) < 2.5, `and agrees with the gauge up to 30 km (never out by more than ${Math.max(...worst).toFixed(2)} times)`)
  check(Math.exp(-100_000 / H) < 1e-4, 'none to speak of at the Karman line, where the sky is black')
}

console.log('\nthe page and the shader')
{
  const declared = [...sky.matchAll(/^uniform\s+\w+\s+(u_\w+)/gm)].map((m) => m[1])
  check(declared.join() === 'u_alt' && page.includes('uniforms: () => ({ u_alt: skyAlt })') && page.includes('skyAlt = metres'), 'the page hands the shader the altitude on the gauge, and nothing else is asked for')
  check(!/class="starfield"|class="rain"|class="panorama"/.test(page), 'the dots, the rain and the painted mountains that stood in for a sky are gone')
  check(page.includes('<div class="sky" id="sky"></div>'), 'the plain gradient is still under it, for a browser that cannot draw the sky')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)

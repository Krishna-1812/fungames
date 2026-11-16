/**
 * check-deep-sea-water — is the Deep Sea's water the water its gauge says?
 *
 * The water is drawn by a shader this cannot run. What it can check is the
 * physics the shader is written from, and that the page and the shader are
 * talking about the same things:
 *
 *   1. Light. Water takes red first, then green, then blue: the three
 *      numbers in the shader must be in that order, and worked through they
 *      must leave about a hundredth of the blue at two hundred metres (where
 *      the page says the sunlight zone ends) and none worth the name at a
 *      thousand (where it says "none at all, ever").
 *   2. The page hands the shader exactly what it asks for.
 *   3. The animals are shapes, in both kinds of water, and the old backdrop
 *      is gone.
 *
 *   node scripts/check-deep-sea-water.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const water = read('src/lib/deep-sea-water.ts')
const page = read('src/pages/deep-sea.astro')
const { ZONES, TOTAL_DEPTH } = await import('../src/data/deep-sea.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

console.log('\nlight')
{
  const k = /exp\(-vec3\(([\d.]+), ([\d.]+), ([\d.]+)\) \* max\(metres, 0\.0\)\)/.exec(water)
  check(!!k, 'the shader states how fast water takes each colour')
  if (k) {
    const [r, g, b] = k.slice(1).map(Number)
    check(r > g && g > b && b > 0, `red goes first, then green, then blue (${r}, ${g}, ${b} per metre)`)
    const left = (c, m) => Math.exp(-c * m)
    check(left(r, 10) < 0.05, `red is gone in ten metres (${(left(r, 10) * 100).toFixed(1)}% left)`)
    const sunlit = ZONES[0].to
    const at200 = left(b, sunlit)
    check(sunlit === 200 && at200 > 0.01 && at200 < 0.15, `a little blue is left where the sunlight zone ends (${(at200 * 100).toFixed(1)}% at ${sunlit} m)`)
    const twilight = ZONES[1].to
    check(left(b, twilight) < 0.0001, `and none at ${twilight.toLocaleString('en-US')} m, where the page says there is none`)
    const lamp = /float lampOn = smoothstep\(([\d.]+), ([\d.]+), light\);/.exec(water)
    check(!!lamp && +lamp[1] > +lamp[2] && -Math.log(+lamp[1]) / b > sunlit * 0.9, 'the lamp comes on as the day goes, not while there is plenty of it')
  }
}

console.log('\nthe page and the shader')
{
  const declared = [...water.matchAll(/^uniform\s+\w+\s+(u_\w+)/gm)].map((m) => m[1]).sort()
  const handed = [...(/uniforms: \(\) => \(\{ (u_D:[^}]*) \}\)/.exec(page)?.[1] ?? '').matchAll(/(u_\w+):/g)].map((m) => m[1]).sort()
  check(declared.length === 3 && declared.join() === handed.join(), `the page hands over exactly what the shader asks for (${declared.join(', ')})`)
  check(page.includes('surface.setPointer(') && water.includes('u_pointer'), 'and the pointer, which the lamp leans toward')
  check(/floorUp = .*totalHeight - clamped/.test(page) && TOTAL_DEPTH === ZONES[ZONES.length - 1].to, 'the floor comes up at the end of the real descent, not at a depth typed in twice')
  check(!fs.existsSync(path.join(root, 'src/lib/deep-sea-sky.ts')) && !page.includes('deep-sea-sky'), 'the old backdrop is gone')
}

console.log('\nthe animals')
{
  check(page.includes('.ev-art :global(svg) { filter: brightness(0)') && page.includes('.ev.dark .ev-art :global(svg) { filter: brightness(0) invert(1)'), 'dark shapes in daylight, pale ones in the dark')
  check(/dark: m\.depth >= (\d+)/.test(page) && +/dark: m\.depth >= (\d+)/.exec(page)[1] <= ZONES[0].to, 'and every animal below the sunlight zone is one of the pale ones')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)

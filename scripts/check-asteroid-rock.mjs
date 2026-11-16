/**
 * check-asteroid-rock — is the solid rock in the builder the rock the model
 * is told about?
 *
 * The rock is marched by a shader this cannot run. What it can check is what
 * goes wrong without anything looking broken: the builder's five materials
 * and the shader's five must be the same five in the same order, or "iron"
 * is drawn as ice and nothing complains; the page must hand the shader what
 * it asks for; and the drawn rock must still be there underneath for a
 * browser that cannot do this.
 *
 *   node scripts/check-asteroid-rock.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const rock = read('src/lib/asteroid-rock.ts')
const page = read('src/pages/asteroid.astro')
const { DENSITIES } = await import('../src/lib/impact.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

console.log('\nwhat it is made of')
{
  const kinds = [...(/ROCK_KINDS = \[([^\]]*)\]/.exec(rock)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1])
  const model = Object.keys(DENSITIES)
  check(kinds.length === 5 && kinds.join() === model.join(), `the shader's five are the model's five, in its order (${kinds.join(', ')})`)
  const order = [...page.matchAll(/\{ key: '(\w+)', label:/g)].map((m) => m[1])
  check(order.join() === kinds.join(), 'and the builder offers them in that order too')
  // Each one is a branch of the shader: a material with no branch would be drawn as the last.
  const branches = (rock.match(/u_mat < \d\.5\) \{/g) ?? []).length
  check(branches === 4 && /\} else \{\s+\/\/ gold/.test(rock), 'each has its own surface in the shader')
  // Heavier is not the same as shinier, but the two metals are the two heaviest, and they are the two that shine.
  const heavy = model.slice().sort((a, b) => DENSITIES[b] - DENSITIES[a]).slice(0, 2).sort().join()
  check(heavy === 'gold,iron', 'the two drawn as metal are the two that are')
}

console.log('\nthe page and the shader')
{
  const declared = [...rock.matchAll(/^uniform\s+\w+\s+(u_\w+)/gm)].map((m) => m[1]).sort()
  const handed = [...(/return \{ (u_mat:[^}]*) \}/.exec(page)?.[1] ?? '').matchAll(/(u_\w+):/g)].map((m) => m[1]).sort()
  check(declared.length === 3 && declared.join() === handed.join(), `the page hands over exactly what the shader asks for (${declared.join(', ')})`)
  check(page.includes('<svg id="rockSvg"') && page.includes('.rockStage.solid svg { visibility: hidden; }') && page.includes('if (rockSolid) el(\'rockStage\').classList.add(\'solid\')'), 'the drawn rock is still underneath, hidden only when the solid one is up')
  check(page.includes('if (!prefersReducedMotion) rockSpin ='), 'it holds still when asked to')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)

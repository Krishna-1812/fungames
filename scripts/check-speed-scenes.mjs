/**
 * check-speed-scenes — does How Fast Are You Moving? have a view for every
 * speed, and only those?
 *
 * The picture is drawn by a shader this cannot run. What it can check is the
 * thing that would go wrong silently: the page counts its sections and the
 * shader counts its views, separately, and if they disagree the last speeds
 * are shown over the wrong picture and nothing complains.
 *
 *   node scripts/check-speed-scenes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const scenes = read('src/lib/speed-scenes.ts')
const page = read('src/pages/speed.astro')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

console.log('\na view for every speed')
{
  const sections = (page.match(/<section class="sp-stage[ "]/g) ?? []).length
  const declared = +(/SPEED_SCENES = (\d+)/.exec(scenes)?.[1] ?? 0)
  check(sections === 8 && declared === sections, `${sections} sections on the page, ${declared} views in the shader`)
  // Each view is a branch: id 0..6 named, and the last is the else.
  const branches = [...scenes.matchAll(/(?:if|else if) \(id == (\d)\)/g)].map((m) => +m[1])
  check(branches.join() === '0,1,2,3,4,5,6' && /\} else \{\s+\/\/ Everything leaving/.test(scenes), 'and a branch for each, in order')
  check(scenes.includes(`clamp(u_scene, 0.0, ${declared - 1}.0)`) && scenes.includes(`a < ${declared - 1}`), 'the scroll cannot ask for a view past the last')
  const ids = [...page.matchAll(/<section class="sp-stage[^"]*" id="stage-(\w+)"/g)].map((m) => m[1])
  check(ids.join() === 'tectonic,rotation,orbit,apex,galactic,andromeda,cmb,finale', `in the order the views are drawn (${ids.join(', ')})`)
}

console.log('\nthe page and the shader')
{
  const declared = [...scenes.matchAll(/^uniform\s+\w+\s+(u_\w+)/gm)].map((m) => m[1]).sort()
  const handed = [...(/uniforms: \(\) => \(\{ (u_scene:[^}]*) \}\)/.exec(page)?.[1] ?? '').matchAll(/(u_\w+):/g)].map((m) => m[1])
  if (page.includes("textures: { u_land: '/deep-time/land.webp' }")) handed.push('u_land')
  check(declared.length === 3 && declared.join() === handed.sort().join(), `the page hands over exactly what the shader asks for (${declared.join(', ')})`)
  check(fs.existsSync(path.join(root, 'public/deep-time/land.webp')), 'the coastline the Earth is drawn on is published')
  check((page.match(/<div class="sp-art/g) ?? []).length === 8 && page.includes('.speed-body.live .sp-art { display: none; }'), 'the eight small drawings are still in the page, put away only when the picture is up')
  check(page.includes('if (prefersReducedMotion) picture.redraw()'), 'under reduced motion the view still follows the scroll')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)

/**
 * check-earth-reviews-packs — is every product on Earth Reviews photographed?
 *
 * Each phenomenon is shot in its packaging (lib/earth-reviews-packs.ts) by
 * scripts/bake-earth-reviews.mjs into public/earth-reviews/. This holds that
 * set together:
 *
 *   1. Every phenomenon has a pack, and every pack a phenomenon; a pack's
 *      sizes are a real pack's (about a hand high), its colours are hex, and
 *      a jar's contents are something a jar can hold.
 *   2. Every pack's colours stay in the page's cool palette — no label printed
 *      in orange or yellow (the Sun's own light inside its jar is light, not
 *      print, and is left alone).
 *   3. Both pictures exist for every product, square, at 1200 and 600 pixels,
 *      and none is a blank frame.
 *   4. The studio has no GLSL reserved word as a name, and the page shows the
 *      photographs, with the drawing kept as the second view.
 *
 *   node scripts/check-earth-reviews-packs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
import sharp from 'sharp'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { PACKS, packPhoto } = await import('../src/lib/earth-reviews-packs.ts')
const { PHENOMENA } = await import('../src/data/earth-reviews.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const ids = PHENOMENA.map((p) => p.id)
const hex = (c) => /^#[0-9a-f]{6}$/i.test(c)
const hue = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d < 0.12 || mx < 0.15) return null // greys, near-blacks: no hue to speak of
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

/* -------------------------------------------------------------------------- */
console.log('\nthe packs')
/* -------------------------------------------------------------------------- */
{
  const missing = ids.filter((id) => !PACKS[id]), extra = Object.keys(PACKS).filter((id) => !ids.includes(id))
  check(!missing.length && !extra.length, `a pack for each of the ${ids.length} products, and no pack for anything else${missing.length ? ' — none for ' + missing.join(', ') : ''}${extra.length ? ' — stray ' + extra.join(', ') : ''}`)
  const bad = Object.entries(PACKS).filter(([, p]) => !['box', 'tin', 'jar'].includes(p.kind) || p.size.some((v) => !(v > 0.25 && v < 1.3)) || ![p.paper, p.ink, p.band].every(hex) || !p.net)
  check(!bad.length, `every pack is a carton, tin or jar about a hand high, with hex colours and its net contents${bad.length ? ' — not ' + bad.map(([k]) => k).join(', ') : ''}`)
  const jars = Object.entries(PACKS).filter(([, p]) => p.contents)
  check(jars.every(([, p]) => p.kind === 'jar') && jars.every(([, p]) => !('level' in p.contents) || (p.contents.level > 0.2 && p.contents.level < 0.8)), 'only jars have contents to show, filled between a fifth and four-fifths')
  check(new Set(Object.values(PACKS).map((p) => p.kind)).size === 3 && ['box', 'tin', 'jar'].every((k) => Object.values(PACKS).filter((p) => p.kind === k).length >= 6), 'all three kinds of pack, at least six of each, so the grid is not one shape')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe colours')
/* -------------------------------------------------------------------------- */
{
  const warm = []
  for (const [id, p] of Object.entries(PACKS)) for (const c of [p.paper, p.ink, p.band]) { const h = hue(c); if (h != null && h > 18 && h < 75) warm.push(`${id} ${c}`) }
  check(!warm.length, `no label printed in orange or yellow${warm.length ? ' — ' + warm.join(', ') : ''}`)
  check(Object.values(PACKS).every((p) => p.metal !== 'gold'), 'and no gold lids')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe pictures')
/* -------------------------------------------------------------------------- */
{
  const problems = []
  for (const id of ids) {
    for (const [small, size] of [[false, 1200], [true, 600]]) {
      const f = path.join(root, 'public', packPhoto(id, small))
      if (!fs.existsSync(f)) { problems.push(`${id}${small ? ' (small)' : ''} missing`); continue }
      const m = await sharp(f).metadata()
      if (m.width !== size || m.height !== size) problems.push(`${id} ${m.width}x${m.height}`)
      if (!small) {
        const s = await sharp(f).stats()
        if (s.channels.slice(0, 3).every((c) => c.stdev < 8)) problems.push(`${id} is a blank frame`)
      }
    }
  }
  check(!problems.length, `both pictures for all ${ids.length}, square, 1200 and 600 pixels, none blank${problems.length ? ' — ' + problems.slice(0, 6).join('; ') : ''}`)
}

/* -------------------------------------------------------------------------- */
console.log('\nthe studio and the page')
/* -------------------------------------------------------------------------- */
{
  const studio = fs.readFileSync(path.join(root, 'scripts/earth-reviews-bake/studio.glsl'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  check(!/\b(half|input|output|sample|filter)\b/.test(studio), 'the studio names nothing with a GLSL reserved word')
  const page = fs.readFileSync(path.join(root, 'src/pages/earth-reviews.astro'), 'utf8')
  check(page.includes("from '../lib/earth-reviews-packs'") && /class="er-photo"/.test(page) && /er-heroimg/.test(page), 'the grid and the product page show the photographs')
  check(/data-view="art"/.test(page) && /symbolId\(item\.id\)/.test(page), 'and the drawing is still there, as the second picture')
  const allow = fs.readFileSync(path.join(root, 'scripts/check-public-boundary.mjs'), 'utf8')
  check(allow.includes("'earth-reviews'"), 'public/earth-reviews is on the deploy allowlist')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)

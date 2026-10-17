/**
 * check-island-runs — the realistic island's pictures line up with its solids.
 *
 * Unity renders each building's solids run by run (scripts/unity-buildings.mjs)
 * from the island built plainly (scripts/export-island.mjs); the realistic
 * island puts each picture where the same run begins, by its number. So the
 * two builds must write down exactly the same runs, in the same order, for
 * every building and every thing: one solid drawn only on one of them would
 * put every later picture in the wrong place.
 *
 *   node scripts/check-island-runs.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { listedGames } = await import('../src/data/games.ts')
const { buildIsland } = await import('../src/lib/island/world.ts')
const { resvgRaster } = await import('../src/lib/island/raster.ts')
const { plateRef } = await import('../src/lib/island/plate.ts')
const { figureSet, buildingSet } = await import('../src/lib/island/figures.ts')

const games = listedGames().map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: '/' + g.slug + '/' }))
const shape = (isl) => new Map(isl.model.solids.map((s) => [s.slug, s.runs.map((r) => r.map((x) => x.k + (x.name ? ':' + x.name : '')).join(' '))]))
const plain = shape(buildIsland(games, { raster: resvgRaster }))
process.env.ISLAND_PLATE = '1'
const plate = plateRef()
const glow = plate ? plateRef('glow') : null
if (!plate) { console.log('check-island-runs: no plate, nothing to compare'); process.exit(0) }
const shots = buildingSet()
const real = shape(buildIsland(games, { raster: resvgRaster, plate, glow, figures: figureSet(), buildings: shots }))
let bad = 0
for (const [slug, runs] of plain) {
  const other = real.get(slug)
  if (!other) { console.error(`  ${slug}: missing on the realistic island`); bad++; continue }
  // The realistic island's runs must be the plain one's, from the first: a run only the plain island has
  // (a tree or a rock drawn there, Unity's figure here) is harmless at the end, and wrong anywhere before.
  if (other.length > runs.length) { console.error(`  ${slug}: ${runs.length} runs plainly, ${other.length} realistically`); bad++; continue }
  other.forEach((r, k) => { if (r !== runs[k]) { console.error(`  ${slug} run ${k}: "${runs[k]}" plainly vs "${r}"`); bad++ } })
}
for (const slug of real.keys()) if (!plain.has(slug)) { console.error(`  ${slug}: only on the realistic island`); bad++ }
if (bad) { console.error(`check-island-runs: ${bad} mismatches`); process.exit(1) }
console.log(`check-island-runs: ${plain.size} buildings and things, runs identical`)

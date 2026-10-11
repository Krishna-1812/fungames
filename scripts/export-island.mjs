/**
 * export-island — the island as facts, for the Unity scene in unity/.
 *
 * Unity renders the island in 3D (unity/Assets/Island/Editor), and needs the
 * same island the site draws: every tile's ground, height and district, the
 * water, the roads, the fields and where each building stands, plus the
 * building's drawn bounds (its anchor), so a stand-in can be the right size.
 * All of it comes from buildIsland's `model` (lib/island/world.ts).
 *
 *   node scripts/export-island.mjs        writes unity/Assets/Island/Data/island.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { register } = await import('node:module')
register('./resolve-ts.mjs', import.meta.url)
const { listedGames } = await import('../src/data/games.ts')
const { buildIsland } = await import('../src/lib/island/world.ts')
const { resvgRaster } = await import('../src/lib/island/raster.ts')
const { DISTRICTS } = await import('../src/lib/island/landmarks.ts')

const games = listedGames()
const island = buildIsland(games.map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: `/${g.slug}/` })), { raster: resvgRaster })
const m = island.model
const out = {
  ...m,
  // Unity's JsonUtility reads flat arrays and lists of objects, not arrays of arrays: each is flattened, row by row.
  height: m.height.flat(),
  district: m.district.flat(),
  river: m.river.flat(), pond: m.pond.flat(), road: m.road.flat(),
  routes: m.routes.map((r) => ({ pts: r.flat() })),
  // Each district's own ground colours (lib/island/landmarks.ts), so the 3D island keeps them.
  districts: DISTRICTS.map((d) => ({ key: d.key, a: d.ground[0], b: d.ground[1] })),
  wash: (m.wash ?? []).flat(),
  fields: m.fields.map(([i, j, w, d, kind]) => ({ i, j, w, d, kind })),
  mill: m.mill ?? [], bales: m.bales.flat(), arch: m.arch ?? [],
  buttes: m.buttes.flat(), hoodoos: m.hoodoos.flat(), boulders: m.boulders.flat(), seaRocks: m.seaRocks.flat(), shoreRocks: m.shoreRocks.flat(),
  piers: m.piers.map((p) => ({ from: p[0], to: p[1] })),
  buildings: m.buildings.map((b) => ({ ...b, anchor: (({ x0, y0, x1, y1, bx, by }) => ({ x0, y0, x1, y1, bx, by }))(island.anchors[b.slug]) })),
}
const file = fileURLToPath(new URL('../unity/Assets/Island/Data/island.json', import.meta.url))
mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, JSON.stringify(out, null, 1))
console.log(`island.json: ${m.grid}×${m.grid} tiles, ${m.buildings.length} buildings, ${m.road.length} road tiles, ${m.plants.length} plants → ${file}`)

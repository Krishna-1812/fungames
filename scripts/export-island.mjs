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
 *
 * And the artwork Unity prints on what it builds (kit.ts, print): each one
 * rasterised, packed on one sheet, prints.png, with prints.json saying where
 * each one is on it.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { register } = await import('node:module')
register('./resolve-ts.mjs', import.meta.url)
const { listedGames } = await import('../src/data/games.ts')
const { buildIsland } = await import('../src/lib/island/world.ts')
const { resvgRaster } = await import('../src/lib/island/raster.ts')
const { DISTRICTS } = await import('../src/lib/island/landmarks.ts')

/** A solid as Unity reads it: no arrays of arrays (a polygon's points and a cylinder's bands, flattened). */
const flatSolid = (x) => ({ ...x, ...(x.pts ? { pts: x.pts.flat() } : {}), ...(x.bands ? { bandZ: x.bands.flatMap(([a, b]) => [a, b]), bandC: x.bands.map((q) => q[2]), bands: undefined } : {}) })

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
  buttes: m.buttes.flat(), hoodoos: m.hoodoos.flat(), boulders: m.boulders.flat(), seaRocks: m.seaRocks.flat(), shoreRocks: m.shoreRocks.flat(), isles: m.isles.flat(),
  // (Each print's drawing goes to its sheet, not to Unity.)
  prints: undefined,
  // Each building's solids, for Unity: every run a list of records, written as JSON strings (JsonUtility reads no free-form objects).
  solids: m.solids.map((b) => ({ slug: b.slug, runs: b.runs.map((r) => ({ items: r.map((x) => JSON.stringify(flatSolid(x))) })), ...(b.k ? { k: b.k, at: b.at } : {}) })),
  piers: m.piers.map((p) => ({ from: p[0], to: p[1] })),
  buildings: m.buildings.map((b) => ({ ...b, anchor: (({ x0, y0, x1, y1, bx, by }) => ({ x0, y0, x1, y1, bx, by }))(island.anchors[b.slug]) })),
}
const file = fileURLToPath(new URL('../unity/Assets/Island/Data/island.json', import.meta.url))
mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, JSON.stringify(out, null, 1))
console.log(`island.json: ${m.grid}×${m.grid} tiles, ${m.buildings.length} buildings, ${m.road.length} road tiles, ${m.plants.length} plants → ${file}`)

/* ---- the prints, on one sheet ---- */
{
  /** Pixels a screen pixel: the site's prints are a few tens of pixels across, seen at up to eight times. */
  const K = 14, PAD = 6, SHEET = 2048
  const list = m.prints.map((p) => {
    const w = Math.ceil(p.w * K), h = Math.ceil(p.h * K)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${w}" height="${h}">${p.svg}</svg>`
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: w }, font: { loadSystemFonts: false } }).render().asPng()
    return { name: p.name, w, h, png }
  }).sort((a, b) => b.h - a.h)
  // Shelves, tallest first.
  let x = PAD, y = PAD, shelf = 0
  const placed = []
  for (const it of list) {
    if (x + it.w + PAD > SHEET) { x = PAD; y += shelf + PAD; shelf = 0 }
    placed.push({ ...it, x, y }); x += it.w + PAD; shelf = Math.max(shelf, it.h)
  }
  const H = Math.max(64, 2 ** Math.ceil(Math.log2(y + shelf + PAD)))
  const dir = fileURLToPath(new URL('../unity/Assets/Island/Data/', import.meta.url))
  // Each print's edge pixels carried out a little into its padding (extend), so the sheet's mipmaps do not bleed in the background.
  const tiles = await Promise.all(placed.map(async (it) => ({ input: await sharp(it.png).extend({ top: 2, bottom: 2, left: 2, right: 2, extendWith: 'copy' }).toBuffer(), left: it.x - 2, top: it.y - 2 })))
  await sharp({ create: { width: SHEET, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(tiles).png().toFile(dir + 'prints.png')
  // Where each is, as Unity's texture coordinates (v up from the bottom).
  writeFileSync(dir + 'prints.json', JSON.stringify({ items: placed.map((it) => ({ name: it.name, r: [it.x / SHEET, 1 - (it.y + it.h) / H, (it.x + it.w) / SHEET, 1 - it.y / H] })) }))
  console.log(`prints.png: ${placed.length} prints on ${SHEET}×${H}`)
}

// What is still drawn flat on the realistic island: every element outlined or
// filled in the drawing's ink, counted by what it belongs to (its layer, and
// the nearest ancestor with a class, a poke, a slug or an id).
//   ISLAND_PLATE=1 node scripts/_audit-cartoon.mjs
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { parse } = await import('../src/lib/island/bake/xml.ts')
const { listedGames } = await import('../src/data/games.ts')
const { buildIsland } = await import('../src/lib/island/world.ts')
const { resvgRaster } = await import('../src/lib/island/raster.ts')
const { plateRef } = await import('../src/lib/island/plate.ts')
const { figureSet, buildingSet } = await import('../src/lib/island/figures.ts')
const plate = plateRef()
const isl = buildIsland(listedGames().map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: '/' + g.slug + '/' })), { raster: resvgRaster, plate, figures: plate ? figureSet() : null, buildings: plate ? buildingSet() : null })
const INK = '#1b2340'
const counts = new Map()
const walk = (n, layer, label) => {
  if (typeof n === 'string') return
  const a = n.attrs ?? {}
  const own = a['data-poke'] ? `poke:${a['data-poke']}` : a['data-slug'] ? `slug:${a['data-slug']}` : a.class ? `.${String(a.class).split(' ')[0]}` : a.id ? `#${a.id}` : null
  const lab = own ?? label
  const inked = (a.stroke === INK && Number(a['stroke-width'] ?? 1) >= 0.5) || a.fill === INK
  if (inked && n.tag !== 'g') { const k = `${layer} ${lab ?? '?'}`; counts.set(k, (counts.get(k) ?? 0) + 1) }
  for (const k of n.kids ?? []) walk(k, layer, lab)
}
for (const l of isl.layers) for (const n of parse(l.body)) walk(n, l.kind + (l.slug ? ':' + l.slug : ''), null)
const rows = [...counts].sort((a, b) => b[1] - a[1])
let total = 0
for (const [k, v] of rows) total += v
console.log(`${total} inked elements in ${rows.length} groups`)
for (const [k, v] of rows.slice(0, Number(process.argv[2] ?? 80))) console.log(String(v).padStart(5), k)

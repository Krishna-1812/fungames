/**
 * fetch-textures — the photographs and models the 3D island is made of.
 *
 * Ten CC0 texture sets from Poly Haven (polyhaven.com, public domain): a
 * colour photo and a normal map each, at 1K (the island renders at about
 * 180 px a tile, and each texture spans several tiles, so 1K is all a pixel
 * ever sees). They go to unity/Textures/, which git ignores: anyone can fetch
 * them again with this, and each file is checked against Poly Haven's MD5.
 *
 * Its trees are built in Unity (Assets/Island/Editor/Trees.cs), dressed in the
 * leaf, needle and bark photographs of four of Poly Haven's trees (LEAVES; its
 * own tree models are hundreds of MB each, for film, where a tree here is a
 * hundred pixels). Rocks, shrubs and street things are Poly Haven's own models
 * (MODELS), into unity/Assets/Island/Models/, also out of git. The buildings'
 * walls and roofs are ten more texture sets (WALLS), into Textures/buildings/.
 *
 *   node scripts/fetch-textures.mjs
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** What each set is for: Terrain3D's ground kinds (unity/Assets/Island/Editor/Ground.shader). */
export const SETS = {
  aerial_beach_01: 'dry sand',
  coast_sand_01: 'wet sand at the waterline',
  aerial_grass_rock: 'grass',
  forest_ground_04: 'grass under trees, the meadows\' second texture',
  cliff_side: 'cliff faces',
  aerial_rocks_02: 'rock seen from above',
  aerial_asphalt_01: 'roads',
  concrete_pavers_02: 'plazas',
  cobblestone_square: 'the old town',
  mud_cracked_dry_03: 'the badlands and the dry wash',
}
/** The tree photographs: Poly Haven asset → its maps. */
export const LEAVES = {
  pine_tree_01: ['twig_diff', 'twig_alpha', 'twig_nor_gl', 'bark_diff', 'bark_nor_gl'],
  jacaranda_tree: ['leaves_diff', 'leaves_alpha', 'leaves_nor_gl', 'trunk_diff', 'trunk_nor_gl'],
  tree_small_02: ['leaves_diff', 'leaves_alpha', 'leaves_nor_gl', 'branch_diff'],
  island_tree_01: ['leaves_diff', 'leaves_alpha', 'leaves_nor_gl', 'branches_diff'],
}
/** The buildings' materials (Buildings.cs, Building.shader): colour + normal, into Textures/buildings/. */
export const WALLS = {
  painted_plaster_wall: 'plaster',
  white_plaster_02: 'plaster, clean',
  painted_brick: 'painted brick (the old town)',
  brick_wall_02: 'brick',
  grey_roof_tiles: 'roof tiles',
  roof_slates_02: 'slate',
  weathered_planks: 'timber boards',
  corrugated_iron_02: 'metal sheet',
  metal_plate_02: 'metal panels and domes',
  concrete_wall_008: 'concrete',
}
/** The models, as FBX with their textures. */
export const MODELS = ['boulder_01', 'rock_07', 'namaqualand_boulder_02', 'shrub_02', 'shrub_04', 'street_lamp_01', 'painted_wooden_bench']
const RES = '1k'
const out = path.join(process.cwd(), 'unity', 'Textures')
fs.mkdirSync(out, { recursive: true })

const md5 = (b) => createHash('md5').update(b).digest('hex')
let got = 0, kept = 0
for (const name of Object.keys(SETS)) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${name}`)).json()
  for (const [map, tag] of [['Diffuse', 'diff'], ['nor_gl', 'nor']]) {
    const f = files?.[map]?.[RES]?.jpg
    if (!f) { console.warn(`${name}: no ${map} at ${RES}, skipped`); continue }
    const file = path.join(out, `${name}_${tag}.jpg`)
    if (fs.existsSync(file) && md5(fs.readFileSync(file)) === f.md5) { kept++; continue }
    const buf = Buffer.from(await (await fetch(f.url)).arrayBuffer())
    if (md5(buf) !== f.md5) throw new Error(`${name} ${map}: checksum does not match`)
    fs.writeFileSync(file, buf)
    got++
  }
}

/** One file, unless it is already here and whole. */
async function take(url, sum, file) {
  if (fs.existsSync(file) && md5(fs.readFileSync(file)) === sum) { kept++; return }
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  if (md5(buf) !== sum) throw new Error(`${path.basename(file)}: checksum does not match`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, buf)
  got++
}
for (const [name, maps] of Object.entries(LEAVES)) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${name}`)).json()
  for (const map of maps) {
    const f = files?.[map]?.[RES]?.jpg ?? files?.[map]?.[RES]?.png
    if (!f) { console.warn(`${name}: no ${map} at ${RES}, skipped`); continue }
    await take(f.url, f.md5, path.join(out, 'trees', `${name}_${map}.${f.url.split('.').pop()}`))
  }
}
for (const name of Object.keys(WALLS)) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${name}`)).json()
  for (const [map, tag] of [['Diffuse', 'diff'], ['nor_gl', 'nor']]) {
    const f = files?.[map]?.[RES]?.jpg
    if (!f) { console.warn(`${name}: no ${map} at ${RES}, skipped`); continue }
    await take(f.url, f.md5, path.join(out, 'buildings', `${name}_${tag}.jpg`))
  }
}
const models = path.join(process.cwd(), 'unity', 'Assets', 'Island', 'Models')
for (const name of MODELS) {
  const f = (await (await fetch(`https://api.polyhaven.com/files/${name}`)).json())?.fbx?.[RES]?.fbx
  if (!f) { console.warn(`${name}: no FBX at ${RES}, skipped`); continue }
  const dir = path.join(models, name)
  await take(f.url, f.md5, path.join(dir, `${name}.fbx`))
  for (const [rel, t] of Object.entries(f.include ?? {})) await take(t.url, t.md5, path.join(dir, rel))
}
console.log(`textures and models: ${got} fetched, ${kept} already here`)

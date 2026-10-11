/**
 * fetch-textures — the photographs the 3D island's ground is made of.
 *
 * Ten CC0 texture sets from Poly Haven (polyhaven.com, public domain): a
 * colour photo and a normal map each, at 1K (the island renders at about
 * 180 px a tile, and each texture spans several tiles, so 1K is all a pixel
 * ever sees). They go to unity/Textures/, which git ignores: anyone can fetch
 * them again with this, and each file is checked against Poly Haven's MD5.
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
console.log(`textures: ${got} fetched, ${kept} already here, in unity/Textures/`)

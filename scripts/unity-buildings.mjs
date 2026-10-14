/**
 * unity-buildings — render the island's buildings in Unity, for the site.
 *
 * Each building's solids (lib/island/kit.ts, Solids: its boxes, roofs,
 * cylinders, domes, windows and doors, in runs) are built in Unity
 * (unity/Assets/Island/Editor/Buildings.cs) and each run rendered alone, lit
 * as the island is; here each picture is trimmed to what it shows and
 * written, with where it lies on the map, to src/lib/island/buildings/
 * (lib/island/figures.ts, buildingSet). The site draws each in place of its
 * run's drawing whenever the plate is on; the plate casts the buildings'
 * shadows on the ground.
 *
 *   node scripts/unity-buildings.mjs [--skip-unity]
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const UNITY = process.env.UNITY ?? 'C:/Program Files/Unity/Hub/Editor/6000.5.5f1/Editor/Unity.exe'
const renders = path.join(root, 'unity/Renders/buildings')
const out = path.join(root, 'src/lib/island/buildings')

const run = (cmd, args, what) => {
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) { console.error(`${what} failed (exit ${r.status})`); process.exit(1) }
  console.log(`${what}: ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

if (!process.argv.includes('--skip-unity')) {
  run(process.execPath, ['scripts/export-island.mjs'], 'export')
  const log = path.join(root, 'unity/Logs/buildings.log')
  fs.mkdirSync(path.dirname(log), { recursive: true })
  run(UNITY, ['-batchmode', '-projectPath', path.join(root, 'unity'), '-executeMethod', 'Island.IslandBuild.BuildingShots', '-quit', '-logFile', log], 'unity')
  const text = fs.readFileSync(log, 'utf8')
  // A shader that does not compile renders nothing, and Unity still exits happily.
  const broken = [...new Set(text.split('\n').filter((l) => /Shader error|error CS\d|Exception:/.test(l)))]
  if (broken.length || !/\[island\] buildings:/.test(text)) { console.error(broken.join('\n') || 'no buildings rendered'); process.exit(1) }
}

const m = JSON.parse(fs.readFileSync(path.join(renders, 'buildings.json'), 'utf8'))
// A render of a few (Unity's `-only a,b`) writes where they lie to a file of its own, named for the
// first: folded into the whole list here (theirs replacing what the list had), and the list kept so.
for (const f of fs.readdirSync(renders).filter((f) => f.endsWith('.json') && f !== 'buildings.json')) {
  const part = JSON.parse(fs.readFileSync(path.join(renders, f), 'utf8'))
  const slugs = new Set(Object.keys(part.items).map((key) => key.split('/')[0]))
  for (const key of Object.keys(m.items)) if (slugs.has(key.split('/')[0])) delete m.items[key]
  Object.assign(m.items, part.items)
  fs.rmSync(path.join(renders, f))
}
fs.writeFileSync(path.join(renders, 'buildings.json'), JSON.stringify(m))
const k = m.scale
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
const hash = createHash('sha256')
const items = {}
let bytes = 0
for (const [key, [x, y, w, h, centred]] of Object.entries(m.items).sort(([a], [b]) => a.localeCompare(b))) {
  const file = key.replace('/', '_') + '.png'
  const src = path.join(renders, file)
  if (!fs.existsSync(src)) continue
  // A piece that turns about its middle keeps its whole square.
  if (centred) {
    const png = await sharp(src).png({ compressionLevel: 9, effort: 10 }).toBuffer()
    fs.writeFileSync(path.join(out, file), png)
    hash.update(key).update(png); bytes += png.length
    items[key] = { x, y, w, h }
    continue
  }
  const { data, info } = await sharp(src).trim({ threshold: 0 }).toBuffer({ resolveWithObject: true }).catch(() => ({ data: null, info: null }))
  if (!data) continue
  const png = await sharp(data).png({ compressionLevel: 9, effort: 10 }).toBuffer()
  fs.writeFileSync(path.join(out, file), png)
  hash.update(key).update(png); bytes += png.length
  const r = (v) => Math.round(v * 100) / 100
  items[key] = { x: r(x - info.trimOffsetLeft / k), y: r(y - info.trimOffsetTop / k), w: r(info.width / k), h: r(info.height / k) }
}
const id = hash.digest('hex').slice(0, 12)
fs.writeFileSync(path.join(out, 'buildings.json'), JSON.stringify({ id, scale: k, items }, null, 1) + '\n')
console.log(`buildings ${id}: ${Object.keys(items).length} runs, ${(bytes / 1e6).toFixed(2)} MB`)

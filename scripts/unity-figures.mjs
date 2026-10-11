/**
 * unity-figures — render what grows on the island in Unity, for the site.
 *
 * Each tree, rock and cactus the island names (lib/island/props.ts, figure())
 * is grown in Unity (unity/Assets/Island/Editor/Plants.cs) and rendered alone,
 * lit and seen exactly as the island is; here each picture is trimmed to what
 * it shows, and written with where its foot is, to src/lib/island/figures/
 * (lib/island/figures.ts reads them). Their shadows are not in them: the plate
 * (scripts/unity-plate.mjs) casts every one onto the ground where it stands.
 *
 *   node scripts/unity-figures.mjs [--skip-unity]
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const UNITY = process.env.UNITY ?? 'C:/Program Files/Unity/Hub/Editor/6000.5.5f1/Editor/Unity.exe'
const renders = path.join(root, 'unity/Renders/figures')
const out = path.join(root, 'src/lib/island/figures')

const run = (cmd, args, what) => {
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) { console.error(`${what} failed (exit ${r.status})`); process.exit(1) }
  console.log(`${what}: ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

if (!process.argv.includes('--skip-unity')) {
  run(process.execPath, ['scripts/export-island.mjs'], 'export')
  const log = path.join(root, 'unity/Logs/figures.log')
  fs.mkdirSync(path.dirname(log), { recursive: true })
  run(UNITY, ['-batchmode', '-projectPath', path.join(root, 'unity'), '-executeMethod', 'Island.IslandBuild.Figures', '-quit', '-logFile', log], 'unity')
  const text = fs.readFileSync(log, 'utf8')
  // A shader that does not compile renders nothing, and Unity still exits happily.
  const broken = [...new Set(text.split('\n').filter((l) => /Shader error|error CS\d|Exception:/.test(l)))]
  if (broken.length || !/\[island\] figures:/.test(text)) { console.error(broken.join('\n') || 'no figures rendered'); process.exit(1) }
}

const m = JSON.parse(fs.readFileSync(path.join(renders, 'figures.json'), 'utf8'))
const [bx, by] = m.box, k = m.scale
// The foot: the origin, P(0, 0), in the render's pixels.
const fx = -bx * k, fy = -by * k
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
const hash = createHash('sha256')
const items = {}
let bytes = 0
for (const f of fs.readdirSync(renders).filter((f) => f.endsWith('.png')).sort()) {
  const name = f.replace(/\.png$/, '')
  const { data, info } = await sharp(path.join(renders, f)).trim({ threshold: 0 }).toBuffer({ resolveWithObject: true })
  // trim's offsets are negative: how far the kept picture's top left is in from the render's.
  const left = -info.trimOffsetLeft, top = -info.trimOffsetTop
  const png = await sharp(data).png({ compressionLevel: 9, effort: 10 }).toBuffer()
  fs.writeFileSync(path.join(out, f), png)
  hash.update(png); bytes += png.length
  const r = (v) => Math.round(v * 100) / 100
  items[name] = { w: r(info.width / k), h: r(info.height / k), ax: r((fx - left) / k), ay: r((fy - top) / k) }
}
const id = hash.digest('hex').slice(0, 12)
fs.writeFileSync(path.join(out, 'figures.json'), JSON.stringify({ id, scale: k, items }, null, 1) + '\n')
console.log(`figures ${id}: ${Object.keys(items).length}, ${(bytes / 1e6).toFixed(2)} MB`)

/**
 * unity-glow — render the island's night light in Unity, for the site to bake.
 *
 * The site's night is the day multiplied down to moonlight, and over that the
 * light of the island itself: its street lamps, the windows of the lit rooms,
 * the bulbs, the lighthouse (unity/Assets/Island/Editor/Night.cs). That light
 * is rendered here, over the plate's box and in its tiles, and kept in the
 * repo (src/lib/island/glow/) as the plate is: the bake paints the night's
 * cells from it (lib/island/plate.ts, 'glow').
 *
 *   1. scripts/export-island.mjs: the island, as facts, for Unity (its lights among them);
 *   2. Unity, IslandBuild.Glow: the light alone, as colour and strength, in tiles (unity/Renders/glow);
 *   3. here: graded (plate-grade.mjs, gradeGlow) and written as WebP tiles, a small copy for the island's SVG, and glow.json.
 *
 *   node scripts/unity-glow.mjs [--scale 4] [--skip-unity]
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { gradeGlow } from './plate-grade.mjs'

const root = process.cwd()
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const scale = Number(arg('--scale', '4'))
const UNITY = process.env.UNITY ?? 'C:/Program Files/Unity/Hub/Editor/6000.5.5f1/Editor/Unity.exe'
const renders = path.join(root, 'unity/Renders/glow')
const out = path.join(root, 'src/lib/island/glow')

const run = (cmd, args, what) => {
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) { console.error(`${what} failed (exit ${r.status})`); process.exit(1) }
  console.log(`${what}: ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

if (!process.argv.includes('--skip-unity')) {
  run(process.execPath, ['scripts/export-island.mjs'], 'export')
  const log = path.join(root, 'unity/Logs/glow.log')
  fs.mkdirSync(path.dirname(log), { recursive: true })
  run(UNITY, ['-batchmode', '-projectPath', path.join(root, 'unity'), '-executeMethod', 'Island.IslandBuild.Glow', '-scale', String(scale), '-quit', '-logFile', log], 'unity')
  const text = fs.readFileSync(log, 'utf8')
  // A shader that does not compile renders nothing, and Unity still exits happily.
  const broken = [...new Set(text.split('\n').filter((l) => /Shader error/.test(l)))]
  if (broken.length) { console.error(broken.join('\n')); process.exit(1) }
  if (!/\[island\] glow:/.test(text)) { console.error(text.split('\n').filter((l) => /error|exception/i.test(l)).slice(0, 20).join('\n')); process.exit(1) }
}

const m = JSON.parse(fs.readFileSync(path.join(renders, 'glow.json'), 'utf8'))
const W = m.cols * m.tile, H = m.rows * m.tile
const tiles = []
for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) tiles.push({ input: path.join(renders, `${r}_${c}.png`), left: c * m.tile, top: r * m.tile })
const px = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }, limitInputPixels: false })
  .composite(tiles).raw().toBuffer()
// Graded once, here: a street lamp's warm white, and no neon lawns or clipped pools (plate-grade.mjs).
gradeGlow(px, W, H)

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
const hash = createHash('sha256')
let bytes = 0
const big = () => sharp(px, { raw: { width: W, height: H, channels: 4 }, limitInputPixels: false })
for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
  const buf = await big().extract({ left: c * m.tile, top: r * m.tile, width: m.tile, height: m.tile }).webp({ quality: 92, alphaQuality: 95, effort: 5 }).toBuffer()
  fs.writeFileSync(path.join(out, `${r}_${c}.webp`), buf)
  hash.update(buf); bytes += buf.length
}
// The small copy, for the island's SVG (resvg cannot read WebP).
const low = await big().resize(Math.round((W / m.scale) * 0.25), Math.round((H / m.scale) * 0.25)).png({ palette: true, colours: 128, effort: 8 }).toBuffer()
fs.writeFileSync(path.join(out, 'low.png'), low)
const id = hash.digest('hex').slice(0, 12)
fs.writeFileSync(path.join(out, 'glow.json'), JSON.stringify({ ...m, id }, null, 1) + '\n')
console.log(`glow ${id}: ${m.cols * m.rows} tiles, ${(bytes / 1e6).toFixed(1)} MB; small copy ${(low.length / 1e3).toFixed(0)} KB`)

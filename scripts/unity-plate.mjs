/**
 * unity-plate — render the island's ground in Unity, for the site to bake.
 *
 * Unity cannot run on Vercel, so its picture of the ground is made here and
 * kept in the repo (src/lib/island/plate/): the bake (lib/island/bake) paints
 * the map's cells from it in place of the drawn ground and the still sea.
 *
 *   1. scripts/export-island.mjs: the island, as facts, for Unity;
 *   2. Unity, IslandBuild.Plate: the ground, the sea round it and the
 *      buildings' shadows, in tiles (unity/Renders/plate);
 *   3. here: the tiles stitched, graded once (scripts/plate-grade.mjs: a
 *      calmer sea, natural lawns, highlights that roll off), faded at the
 *      edges into the site's own sea, and written as WebP tiles, a small
 *      copy for the island's SVG, and
 *      plate.json (where it lies on the map, and an id for the bake's hash).
 *
 *   node scripts/unity-plate.mjs [--scale 4] [--skip-unity]
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { gradePlate } from './plate-grade.mjs'

const root = process.cwd()
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const scale = Number(arg('--scale', '4'))
const UNITY = process.env.UNITY ?? 'C:/Program Files/Unity/Hub/Editor/6000.5.5f1/Editor/Unity.exe'
const renders = path.join(root, 'unity/Renders/plate')
const out = path.join(root, 'src/lib/island/plate')
/** How far in from the plate's edge it fades into the site's sea, in map units. */
const FADE = 160

const run = (cmd, args, what) => {
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) { console.error(`${what} failed (exit ${r.status})`); process.exit(1) }
  console.log(`${what}: ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

if (!process.argv.includes('--skip-unity')) {
  run(process.execPath, ['scripts/export-island.mjs'], 'export')
  const log = path.join(root, 'unity/Logs/plate.log')
  fs.mkdirSync(path.dirname(log), { recursive: true })
  run(UNITY, ['-batchmode', '-projectPath', path.join(root, 'unity'), '-executeMethod', 'Island.IslandBuild.Plate', '-scale', String(scale), '-quit', '-logFile', log], 'unity')
  const text = fs.readFileSync(log, 'utf8')
  // A shader that does not compile renders nothing, and Unity still exits happily.
  const broken = [...new Set(text.split('\n').filter((l) => /Shader error/.test(l)))]
  if (broken.length) { console.error(broken.join('\n')); process.exit(1) }
  if (!/\[island\] plate:/.test(text)) { console.error(text.split('\n').filter((l) => /error|exception/i.test(l)).slice(0, 20).join('\n')); process.exit(1) }
}

const m = JSON.parse(fs.readFileSync(path.join(renders, 'plate.json'), 'utf8'))
const W = m.cols * m.tile, H = m.rows * m.tile
console.log(`stitching ${m.cols}×${m.rows} tiles: ${W}×${H} px`)
const tiles = []
for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) tiles.push({ input: path.join(renders, `${r}_${c}.png`), left: c * m.tile, top: r * m.tile })
const px = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }, limitInputPixels: false })
  .composite(tiles).raw().toBuffer({ resolveWithObject: false })
gradePlate(px, W, H)
console.log('graded')

// Fade the edges into the site's own sea.
const F = FADE * m.scale
// The open sea's own colour, as it comes out round the edges (a band just inside the fade): the site's
// sea is painted in it, so the picture fades into the same water (plate.json's `sea`).
const sea = (() => {
  let r = 0, g = 0, b = 0, n = 0
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
    const e = Math.min(y, H - 1 - y, x, W - 1 - x)
    if (e < F || e > 2 * F) continue
    const k = (y * W + x) * 4
    if (px[k + 3] < 250) continue
    r += px[k]; g += px[k + 1]; b += px[k + 2]; n++
  }
  const h = (v) => Math.round(v / Math.max(1, n)).toString(16).padStart(2, '0')
  return '#' + h(r) + h(g) + h(b)
})()
console.log('open sea', sea)
for (let y = 0; y < H; y++) {
  const ey = Math.min(y, H - 1 - y)
  for (let x = 0; x < W; x++) {
    const e = Math.min(ey, x, W - 1 - x)
    if (e >= F) { if (x < F) continue; x = W - F - 1; continue }
    const t = e / F, a = t * t * (3 - 2 * t)
    const k = (y * W + x) * 4 + 3
    px[k] = Math.round(px[k] * a)
  }
}

// Whether the site shows it: kept from the plate before (lib/island/plate.ts).
const live = (() => { try { return !!JSON.parse(fs.readFileSync(path.join(out, 'plate.json'), 'utf8')).live } catch { return false } })()
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
const hash = createHash('sha256')
let bytes = 0
const big = () => sharp(px, { raw: { width: W, height: H, channels: 4 }, limitInputPixels: false })
for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
  const buf = await big().extract({ left: c * m.tile, top: r * m.tile, width: m.tile, height: m.tile }).webp({ quality: 90, alphaQuality: 90, effort: 5 }).toBuffer()
  fs.writeFileSync(path.join(out, `${r}_${c}.webp`), buf)
  hash.update(buf); bytes += buf.length
}
// The small copy, drawn into the island's SVG: what anything that renders the SVG whole sees.
// A PNG (resvg, which paints the SVG, cannot read WebP), of a palette of 256 colours to stay small.
const low = await big().resize(Math.round((W / m.scale) * 0.5), Math.round((H / m.scale) * 0.5)).png({ palette: true, colours: 256, dither: 0.6, effort: 8 }).toBuffer()
fs.writeFileSync(path.join(out, 'low.png'), low)
const id = hash.digest('hex').slice(0, 12)
fs.writeFileSync(path.join(out, 'plate.json'), JSON.stringify({ ...m, id, sea, live }, null, 1) + '\n')
console.log(`plate ${id}: ${m.cols * m.rows} tiles, ${(bytes / 1e6).toFixed(1)} MB; small copy ${(low.length / 1e3).toFixed(0)} KB`)

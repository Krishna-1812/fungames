/**
 * bake-island — paints the homepage's island into the files its canvas draws
 * (lib/island/bake). Run by the homepage's build when the island has changed
 * (src/lib/island/bake/index.ts), in a process of its own, with --expose-gc so
 * resvg's native memory can be given back as it goes.
 *
 *   node --expose-gc scripts/bake-island.mjs <island.json> <out dir> <hash>
 *
 * island.json is the island as the homepage built it (its layers, its CSS,
 * its viewBox), so the bake paints exactly what the page would have shown.
 */
import fs from 'node:fs'
import path from 'node:path'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const [input, out, hash] = process.argv.slice(2)
if (!input || !out || !hash) { console.error('usage: bake-island.mjs <island.json> <out dir> <hash>'); process.exit(2) }

const { build } = await import('../src/lib/island/bake/build.ts')
const { paint } = await import('../src/lib/island/bake/draw.ts')
const { sceneJson } = await import('../src/lib/island/scene.ts')
const { SKIP_LAYERS } = await import('../src/lib/island/bake/index.ts')
const { Resvg } = await import('@resvg/resvg-js')
const sharp = (await import('sharp')).default
const { platePixels } = await import('../src/lib/island/plate.ts')

const t0 = Date.now()
const island = JSON.parse(fs.readFileSync(input, 'utf8'))
const b = build({ ...island, layers: island.layers.filter((l) => !SKIP_LAYERS.has(l.kind)) })
for (const w of b.warnings) console.log(`  [island] warning: ${w}`)
// The ground as Unity renders it, if the island was built with it (lib/island/plate.ts).
const plate = island.layers.some((l) => l.body.includes('data-plate')) ? await platePixels() : null
if (plate) console.log(`  [island] painting the ground from the Unity plate ${plate.id} (${plate.width}x${plate.height})`)
const p = await paint(b, island.viewBox, hash, (s) => console.log(`  [island] ${s}`), plate)

fs.rmSync(out, { recursive: true, force: true })
const files = []
for (const [f, buf] of p.files) { const fp = path.join(out, f); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, buf); files.push(f) }
fs.writeFileSync(path.join(out, 'scene.json'), sceneJson(p.scene)); files.push('scene.json')

// The whole island as one still picture, names and buildings and all, by day:
// for a page without script, which has no canvas.
{
  const [vx, vy, vw, vh] = island.viewBox, k = 0.6
  // By day and out of season: no night, no beam, no weather, and none of what only comes at certain hours.
  const { parse, write, classes } = await import('../src/lib/island/bake/xml.ts')
  const AWAY = new Set(['ufo', 'dawn-whale', 'fireworks', 'night-dim'])
  const day = island.layers.filter((l) => !['night', 'beam', 'weather'].includes(l.kind))
    .map((l) => parse(l.body).map((n) => write(n, (e) => (classes(e).some((c) => AWAY.has(c)) ? null : e.attrs))).join(''))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${Math.round(vw * k)}" height="${Math.round(vh * k)}"><style>${island.css}</style>${day.join('')}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: Math.round(vw * k) }, font: { loadSystemFonts: true } }).render()
  const buf = await sharp(Buffer.from(img.pixels), { raw: { width: img.width, height: img.height, channels: 4, premultiplied: true } }).flatten({ background: '#8ccbff' }).webp({ quality: 80, effort: 5 }).toBuffer()
  fs.writeFileSync(path.join(out, 'still.webp'), buf); files.push('still.webp')
}
fs.writeFileSync(path.join(out, 'cards.json'), JSON.stringify(b.cards))
let bytes = 0
for (const f of files) bytes += fs.statSync(path.join(out, f)).size
// Written last: its presence says the bake is whole.
fs.writeFileSync(path.join(out, 'done.json'), JSON.stringify({ hash, files, bytes, ms: Date.now() - t0 }))
console.log(`  [island] ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB, in ${((Date.now() - t0) / 1000).toFixed(0)}s`)

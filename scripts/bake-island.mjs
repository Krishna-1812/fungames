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

const t0 = Date.now()
const island = JSON.parse(fs.readFileSync(input, 'utf8'))
const b = build(island)
for (const w of b.warnings) console.log(`  [island] warning: ${w}`)
const p = await paint(b, island.viewBox, hash, (s) => console.log(`  [island] ${s}`))

fs.rmSync(out, { recursive: true, force: true })
const files = []
for (const [f, buf] of p.files) { const fp = path.join(out, f); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, buf); files.push(f) }
fs.writeFileSync(path.join(out, 'scene.json'), JSON.stringify(p.scene)); files.push('scene.json')
fs.writeFileSync(path.join(out, 'cards.json'), JSON.stringify(b.cards))
let bytes = 0
for (const f of files) bytes += fs.statSync(path.join(out, f)).size
// Written last: its presence says the bake is whole.
fs.writeFileSync(path.join(out, 'done.json'), JSON.stringify({ hash, files, bytes, ms: Date.now() - t0 }))
console.log(`  [island] ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB, in ${((Date.now() - t0) / 1000).toFixed(0)}s`)

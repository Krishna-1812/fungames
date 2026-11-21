/**
 * bake-artifacts — photograph Internet Artifacts' twenty-five objects.
 *
 * Each object is a signed-distance model, scripts/artifact-bake/<slug>.glsl,
 * shot in artifact-bake/studio.glsl (the Auction's lights, no backdrop: the
 * picture is transparent but for the object and its shadow). An object that
 * carries print or a screen has a picture of it, artifact-bake/<slug>.svg,
 * which is rasterised here and handed to the shader as u_tex.
 *
 *   node scripts/bake-artifacts.mjs                 every model there is
 *   node scripts/bake-artifacts.mjs logbook pop-tart some of them
 *   --out dir --size 480 --ss 2                     PNG drafts there instead
 *   --sheet sheet.png                               and a contact sheet of the
 *                                                   drafts on the era skies
 *
 * Output: public/internet-artifacts/<slug>.webp (960 square) and <slug>-s.webp
 * (480), with alpha.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { openDarkroom } from './darkroom.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const VALUED = ['--out', '--size', '--ss', '--sheet']
const outDir = opt('--out')
const SS = Number(opt('--ss')) || 4
const W = Number(opt('--size')) || 960
const sheet = opt('--sheet')
const dir = path.join(here, 'artifact-bake')
const all = fs.readdirSync(dir).filter((f) => f.endsWith('.glsl') && f !== 'studio.glsl').map((f) => f.slice(0, -5)).sort()
const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]))
const jobs = names.length ? names : all
const unknown = jobs.filter((n) => !all.includes(n))
if (unknown.length) { console.log('no model for: ' + unknown.join(', ')); process.exit(1) }

const common = fs.readFileSync(path.join(here, 'scale-bake', 'common.glsl'), 'utf8')
const studio = fs.readFileSync(path.join(dir, 'studio.glsl'), 'utf8')
const dest = outDir ?? path.join(root, 'public', 'internet-artifacts')
fs.mkdirSync(dest, { recursive: true })

/** The object's print or screen, as a PNG data URL, or null. */
async function picture(slug) {
  const svg = path.join(dir, slug + '.svg')
  if (!fs.existsSync(svg)) return null
  const png = await sharp(fs.readFileSync(svg), { density: 96 }).png().toBuffer()
  return 'data:image/png;base64,' + png.toString('base64')
}

const room = await openDarkroom()
let failed = 0
const done = []
for (const slug of jobs) {
  const t0 = Date.now()
  try {
    const frag = common + '\n' + fs.readFileSync(path.join(dir, slug + '.glsl'), 'utf8') + '\n' + studio
    const png = await room.bake(frag, W, W, SS, await picture(slug))
    if (outDir) {
      fs.writeFileSync(path.join(dest, slug + '.png'), png)
      done.push(slug)
    } else {
      await sharp(png).webp({ quality: 86, alphaQuality: 92, effort: 6 }).toFile(path.join(dest, slug + '.webp'))
      await sharp(png).resize(W / 2, W / 2).webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(path.join(dest, slug + '-s.webp'))
    }
    console.log(`  baked  ${slug}  ${W}x${W}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  } catch (e) {
    failed++
    console.log(`  FAIL   ${slug}\n${String(e.message).split('\n').slice(0, 14).join('\n')}`)
  }
}
room.close()

// A contact sheet: each draft on one of the page's era skies, named.
if (sheet && outDir && done.length) {
  const SKIES = [['#0b2b12', '#03110a'], ['#132a3d', '#081420'], ['#0e3b45', '#06181d'], ['#2a1245', '#150822'], ['#3d0f2e', '#1c0716']]
  const cell = 360, cols = Math.min(4, done.length), rows = Math.ceil(done.length / cols)
  const parts = []
  for (let i = 0; i < done.length; i++) {
    const [a, b] = SKIES[i % SKIES.length]
    const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="10" y="${cell - 12}" font-family="monospace" font-size="14" fill="#9fb3c8">${done[i]}</text></svg>`)
    const img = await sharp(path.join(dest, done[i] + '.png')).resize(cell, cell).toBuffer()
    const tile = await sharp(bg).composite([{ input: img }]).png().toBuffer()
    parts.push({ input: tile, left: (i % cols) * cell, top: Math.floor(i / cols) * cell })
  }
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: '#000' } }).composite(parts).png().toFile(sheet)
  console.log('  sheet  ' + sheet)
}
process.exit(failed ? 1 : 0)

/**
 * bake-auction — photograph the Auction Game's lots for the catalogue.
 *
 * Each of the fourteen lots (src/data/lots.ts) is a signed-distance model in
 * scripts/auction-bake/lots/<id>.glsl. This shoots it in the catalogue studio
 * (auction-bake/studio.glsl: a seamless sweep, a softbox, a strip light, and
 * the sweep falling away to the rostrum's own colour) at sixteen samples a
 * pixel in a headless browser, and writes public/auction/<id>.webp (1500 x
 * 1000) and -s.webp (750 x 500). The pictures are committed; the site never
 * runs any of this.
 *
 *   node scripts/bake-auction.mjs fox ring          bake two
 *   node scripts/bake-auction.mjs --all             bake all of them
 *   node scripts/bake-auction.mjs fox --out dir     PNG previews there instead
 *   --size 750 --ss 2                               a quick draft
 *
 * A name starting zz- is a scratch model (a test view) and needs no lot.
 *
 * --set shop shoots Dark Patterns' products instead: the models in
 * scripts/shop-bake/, in the studio's white packshot room (WHITE_CYC),
 * square, to public/dark-patterns/<id>.webp (1200) and -s.webp (600).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
import sharp from 'sharp'
import { openDarkroom } from './darkroom.mjs'
register('./resolve-ts.mjs', import.meta.url)

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const { CATALOGUE } = await import('../src/data/lots.ts')

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const outDir = opt('--out')
const SHOP = opt('--set') === 'shop'
const W = Number(opt('--size')) || (SHOP ? 1200 : 1500)
const H = SHOP ? W : Math.round(W * 2 / 3)
const SS = Number(opt('--ss')) || 4

const lotDir = SHOP ? path.join(here, 'shop-bake') : path.join(here, 'auction-bake', 'lots')
const have = fs.readdirSync(lotDir).filter((f) => f.endsWith('.glsl')).map((f) => f.slice(0, -5))
const names = flag('--all') ? have.filter((n) => !n.startsWith('zz-')) : argv.filter((a, i) => !a.startsWith('--') && !['--out', '--size', '--ss', '--set'].includes(argv[i - 1]))
if (!names.length) { console.log('nothing to bake: name a lot or pass --all'); process.exit(1) }
for (const n of names) {
  if (!have.includes(n)) { console.log(`no model ${n}.glsl`); process.exit(1) }
  if (!SHOP && !n.startsWith('zz-') && !CATALOGUE.some((l) => l.id === n)) { console.log(`${n}.glsl is not a lot in data/lots.ts`); process.exit(1) }
}

/* ---- the darkroom (scripts/darkroom.mjs) ------------------------------- */

const room = await openDarkroom()

/* ---- bake --------------------------------------------------------------- */

const common = fs.readFileSync(path.join(here, 'scale-bake', 'common.glsl'), 'utf8')
const studio = fs.readFileSync(path.join(here, 'auction-bake', 'studio.glsl'), 'utf8')
const dest = outDir ?? path.join(root, 'public', SHOP ? 'dark-patterns' : 'auction')
fs.mkdirSync(dest, { recursive: true })

let failed = 0
for (const id of names) {
  const model = fs.readFileSync(path.join(lotDir, id + '.glsl'), 'utf8')
  // A lot may have a picture of its own — a painting, a spine, a label —
  // drawn as lots/<id>.svg (or .png) and handed to the model as u_tex.
  const svg = path.join(lotDir, id + '.svg'), pngTex = path.join(lotDir, id + '.png')
  const texBuf = fs.existsSync(svg) ? await sharp(svg, { density: 300 }).resize(2048, 2048, { fit: 'fill' }).png().toBuffer()
    : fs.existsSync(pngTex) ? fs.readFileSync(pngTex) : null
  const texUrl = texBuf ? 'data:image/png;base64,' + texBuf.toString('base64') : null
  const frag = common + '\n' + (SHOP ? '#define WHITE_CYC\n' : '') + model + '\n' + studio
  const t0 = Date.now()
  try {
    const png = await room.bake(frag, W, H, SS, texUrl)
    if (outDir) fs.writeFileSync(path.join(dest, id + '.png'), png)
    else {
      await sharp(png).webp({ quality: 86, effort: 6 }).toFile(path.join(dest, id + '.webp'))
      await sharp(png).resize(Math.round(W / 2), Math.round(H / 2)).webp({ quality: 84, effort: 6 }).toFile(path.join(dest, id + '-s.webp'))
    }
    console.log(`  baked  ${id}  ${W}x${H}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  } catch (e) {
    failed++
    console.log(`  FAIL   ${id}\n${String(e.message).split('\n').slice(0, 14).join('\n')}`)
  }
}
room.close()
process.exit(failed ? 1 : 0)

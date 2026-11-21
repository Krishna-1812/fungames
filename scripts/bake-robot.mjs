/**
 * bake-robot — render I'm Not a Robot's photographs.
 *
 *   the street   scripts/robot-bake/street.glsl, a whole scene with its own
 *                camera and sun, to public/not-a-robot/street.jpg (900 x 900,
 *                a JPEG because a real challenge's tiles are JPEG crops). It
 *                is rendered a second time with MASK defined, which marks the
 *                signal head and its pole, and the share of each square of
 *                the 3 x 3 grid that each one covers is written to
 *                src/data/robot-street-key.ts. The answer key is measured
 *                from the picture, not written beside it.
 *
 *   the hands    scripts/robot-bake/hand.glsl, shot in the Auction studio's
 *                white room with FINGERS and THUMBS defined, to
 *                public/not-a-robot/hand-<fingers>-<thumbs>.webp (600).
 *
 *   node scripts/bake-robot.mjs                 everything
 *   node scripts/bake-robot.mjs street          one of them
 *   --out dir --size 450 --ss 2                 PNG drafts there instead
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
const outDir = opt('--out')
const SS = Number(opt('--ss')) || 4
const names = argv.filter((a, i) => !a.startsWith('--') && !['--out', '--size', '--ss'].includes(argv[i - 1]))

/** The four hands the check offers: exactly one has five digits. */
export const HANDS = [[4, 1], [5, 1], [3, 1], [4, 2]]
const jobs = ['street', ...HANDS.map(([f, t]) => `hand-${f}-${t}`)].filter((n) => !names.length || names.includes(n) || (names.includes('hands') && n.startsWith('hand-')))
if (!jobs.length) { console.log('nothing to bake: street, hands or hand-F-T'); process.exit(1) }

const dir = path.join(here, 'robot-bake')
const common = fs.readFileSync(path.join(here, 'scale-bake', 'common.glsl'), 'utf8')
const studio = fs.readFileSync(path.join(here, 'auction-bake', 'studio.glsl'), 'utf8')
const dest = outDir ?? path.join(root, 'public', 'not-a-robot')
fs.mkdirSync(dest, { recursive: true })

const room = await openDarkroom()
let failed = 0
for (const job of jobs) {
  const t0 = Date.now()
  try {
    if (job === 'street') {
      const W = Number(opt('--size')) || 900
      const model = fs.readFileSync(path.join(dir, 'street.glsl'), 'utf8')
      const png = await room.bake(common + '\n' + model, W, W, SS)
      if (outDir) fs.writeFileSync(path.join(dest, 'street.png'), png)
      else await sharp(png).jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:2:0' }).toFile(path.join(dest, 'street.jpg'))
      // The key: what share of each square is the head, and the pole.
      const mask = await room.bake(common + '\n#define MASK\n' + model, W, W, SS)
      const { data, info } = await sharp(mask).raw().toBuffer({ resolveWithObject: true })
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      const n = 3, s = W / n, head = Array(9).fill(0), pole = Array(9).fill(0)
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * info.channels, c = Math.min(n - 1, Math.floor(x / s)) + n * Math.min(n - 1, Math.floor(y / s))
        head[c] += lin(data[i]); pole[c] += lin(data[i + 1])
      }
      const share = (a) => a.map((v) => Math.round((v / (s * s)) * 10000) / 10000)
      const key = { grid: 3, size: W, head: share(head), pole: share(pole) }
      if (outDir) { fs.writeFileSync(path.join(dest, 'street-mask.png'), mask); console.log('  key', JSON.stringify(key)) }
      else fs.writeFileSync(path.join(root, 'src', 'data', 'robot-street-key.ts'),
        `/* Measured by scripts/bake-robot.mjs from the street's mask render: for each\n   square of the 3 x 3 grid, the share of it the signal head and the pole\n   cover. Do not edit by hand; rebake. */\nexport const KEY = ${JSON.stringify(key)}\n`)
      console.log(`  baked  street  ${W}x${W}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    } else {
      const W = Number(opt('--size')) || 600
      const [, f, th] = job.split('-')
      const frag = common + `\n#define WHITE_CYC\n#define FINGERS ${f}\n#define THUMBS ${th}\n` + fs.readFileSync(path.join(dir, 'hand.glsl'), 'utf8') + '\n' + studio
      const png = await room.bake(frag, W, W, SS)
      if (outDir) fs.writeFileSync(path.join(dest, job + '.png'), png)
      else await sharp(png).webp({ quality: 84, effort: 6 }).toFile(path.join(dest, job + '.webp'))
      console.log(`  baked  ${job}  ${W}x${W}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    }
  } catch (e) {
    failed++
    console.log(`  FAIL   ${job}\n${String(e.message).split('\n').slice(0, 14).join('\n')}`)
  }
}
room.close()
process.exit(failed ? 1 : 0)

/**
 * unity-actors — render the island's people in Unity, for the site.
 *
 * The island writes down every picture of a person it draws (lib/island/
 * actors.ts: a spec, a pose, a facing, a frame of a stride); export-island
 * hands the list to Unity, which models each person and renders them alone
 * (unity/Assets/Island/Editor/Actors.cs, IslandBuild.ActorShots), lit as the
 * island is, with a second picture of the shadow they cast on the ground. Here
 * the shadow is softened and laid under each, and the pictures go to
 * src/lib/island/actors/ with actors.json: their size and where the foot is
 * (the same for all), and an id. figures.ts reads them with the trees.
 *
 *   node scripts/unity-actors.mjs [--skip-unity] [--sheet out.png]
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const UNITY = process.env.UNITY ?? 'C:/Program Files/Unity/Hub/Editor/6000.5.5f1/Editor/Unity.exe'
const renders = path.join(root, 'unity/Renders/actors')
const out = path.join(root, 'src/lib/island/actors')
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null }

const run = (cmd, args, what) => {
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) { console.error(`${what} failed (exit ${r.status})`); process.exit(1) }
  console.log(`${what}: ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

if (!process.argv.includes('--skip-unity')) {
  run(process.execPath, ['scripts/export-island.mjs'], 'export')
  const log = path.join(root, 'unity/Logs/actors.log')
  run(UNITY, ['-batchmode', '-projectPath', path.join(root, 'unity'), '-executeMethod', 'Island.IslandBuild.ActorShots', '-quit', '-logFile', log], 'unity')
  const text = fs.readFileSync(log, 'utf8')
  const broken = [...new Set(text.split('\n').filter((l) => /Shader error|error CS\d|Exception:/.test(l)))]
  if (broken.length || !/\[island\] actors:/.test(text)) { console.error(broken.join('\n') || 'no actors rendered'); process.exit(1) }
}

const m = JSON.parse(fs.readFileSync(path.join(renders, 'actors.json'), 'utf8'))
const k = m.scale
/** What a picture is of, from its name (lib/island/actors.ts): a person, or the kind of vehicle. */
const kindOf = (name) => (name.startsWith('v-') || name.startsWith('a-') ? name.split('-')[1] : 'person')
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
const hash = createHash('sha256')
const names = fs.readdirSync(renders).filter((f) => f.endsWith('.png') && !f.endsWith('.s.png') && !f.endsWith('.w.png')).map((f) => f.slice(0, -4)).sort()
const BOATS = new Set(['sail', 'ferry', 'fishing', 'speed', 'row', 'duck', 'dolphin', 'whale'])
let bytes = 0
// The shadow on the ground: the sky's blue in it, soft at the edge, as dark as the buildings' are on the plate.
const SHADOW = { r: 22, g: 30, b: 52, a: 0.46 }
const kinds = {}
for (const name of names) {
  const fig = path.join(renders, `${name}.png`), sh = path.join(renders, `${name}.s.png`)
  kinds[kindOf(name)] = true
  const { width, height } = await sharp(fig).metadata()
  const under = []
  // On the water a shadow is faint (the sea's own light is most of what you see), and a boat that moves has its wake.
  const boat = BOATS.has(kindOf(name))
  // A mask (the shape's coverage), softened, in one colour at a strength: built pixel by pixel.
  const layer = async (file, rgb, a, blur) => {
    const m = await sharp(file).ensureAlpha().extractChannel(3).blur(blur).raw().toBuffer()
    const px = Buffer.alloc(width * height * 4)
    for (let i = 0; i < width * height; i++) { px[i * 4] = rgb.r; px[i * 4 + 1] = rgb.g; px[i * 4 + 2] = rgb.b; px[i * 4 + 3] = Math.round(m[i] * a) }
    return sharp(px, { raw: { width, height, channels: 4 } }).png().toBuffer()
  }
  const wk = path.join(renders, `${name}.w.png`)
  if (fs.existsSync(wk)) under.push({ input: await layer(wk, { r: 246, g: 250, b: 255 }, 0.62, 2.2) })
  if (fs.existsSync(sh)) under.push({ input: await layer(sh, { r: SHADOW.r, g: SHADOW.g, b: SHADOW.b }, boat ? 0.16 : SHADOW.a, boat ? 2 : 1.1) })
  const png = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([...under, { input: kindOf(name) === 'cloud' ? await sharp(fig).blur(1.2).toBuffer() : fig }]).png({ compressionLevel: 9, effort: 10, palette: false }).toBuffer()
  fs.writeFileSync(path.join(out, `${name}.png`), png)
  hash.update(name).update(png); bytes += png.length
}
const id = hash.digest('hex').slice(0, 12)
// Every picture of a kind the same size, the foot (or a vehicle's middle) at the same point (P()'s units).
const sizes = Object.fromEntries(Object.entries(m.boxes).map(([kind, [bx, by, bw, bh]]) => [kind, { w: bw, h: bh, ax: -bx, ay: -by }]))
fs.writeFileSync(path.join(out, 'actors.json'), JSON.stringify({ id, sizes, names }, null, 1) + '\n')
console.log(`actors ${id}: ${names.length} pictures, ${(bytes / 1e6).toFixed(2)} MB`)

// A sheet to look at: each picture three times its size on a ground-coloured tile.
const sheet = arg('--sheet')
if (sheet) {
  const pick = names.filter((n) => !process.argv.includes('--only') || n.startsWith(arg('--only'))).slice(0, 48)
  const [, , bw, bh] = m.boxes.person
  const cw = Math.round(bw * k), ch = Math.round(bh * k), cols = 8
  const tiles = await Promise.all(pick.map((n) => sharp(path.join(out, `${n}.png`)).resize(cw, ch, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()))
  const W = cols * cw, H = Math.ceil(pick.length / cols) * ch
  await sharp({ create: { width: W, height: H, channels: 3, background: '#9aa69a' } }).composite(tiles.map((input, i) => ({ input, left: (i % cols) * cw, top: Math.floor(i / cols) * ch }))).png().toFile(sheet)
  console.log(`sheet: ${sheet}`)
}

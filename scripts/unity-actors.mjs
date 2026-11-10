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
  // Unity's clouds are heaps of white balls: the clouds made as mist (make-clouds.mjs) go over them, every time.
  run(process.execPath, ['scripts/make-clouds.mjs'], 'clouds')
}

const m = JSON.parse(fs.readFileSync(path.join(renders, 'actors.json'), 'utf8'))
const k = m.scale
/** What a picture is of, from its name (lib/island/actors.ts): a person, or the kind of vehicle. */
const kindOf = (name) => (name.startsWith('v-') || name.startsWith('a-') ? name.split('-')[1] : 'person')
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
const hash = createHash('sha256')
const names = fs.readdirSync(renders).filter((f) => f.endsWith('.png') && !f.endsWith('.s.png') && !f.endsWith('.w.png')).map((f) => f.slice(0, -4)).sort()
const BOATS = new Set(['sail', 'ferry', 'fishing', 'speed', 'row', 'duck', 'dolphin', 'whale', 'yacht', 'buoy', 'bottle', 'jetski'])
/** What stands up out of the water and so is mirrored in it (the animals and the bottle sit in it, flat). */
const MIRRORED = new Set(['sail', 'ferry', 'fishing', 'speed', 'row', 'yacht', 'buoy', 'jetski'])
/**
 * A whale lying at the surface: the lowest third of it taken into the water, going bluer (the sea's colour in it,
 * more and more toward its underside) and a little fainter, so it is washed by the sea and not sat on top of it.
 */
async function sunk(file, width, height) {
  const px = await sharp(file).ensureAlpha().raw().toBuffer()
  const rowOpaque = (y) => { let n = 0; for (let x = 0; x < width; x++) if (px[(y * width + x) * 4 + 3] > 60) n++; return n }
  let top = 0, low = height - 1
  while (top < height && rowOpaque(top) < 2) top++
  while (low > top && rowOpaque(low) < 2) low--
  const start = low - Math.round(0.35 * (low - top))
  for (let y = start; y <= low; y++) {
    const t = (y - start) / Math.max(1, low - start), mix = 0.55 * t
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      px[i] = px[i] * (1 - mix) + 45 * mix; px[i + 1] = px[i + 1] * (1 - mix) + 106 * mix; px[i + 2] = px[i + 2] * (1 - mix) + 160 * mix
      px[i + 3] = Math.round(px[i + 3] * (1 - 0.25 * t * t))
    }
  }
  return sharp(px, { raw: { width, height, channels: 4 } }).png().toBuffer()
}
/**
 * A boat's reflection, below it in the picture's own spare room: the picture turned over at the waterline (a
 * little above the lowest row of the hull, so it lies under it), faint, tinted toward the water, rippled along
 * its length and gone by the bottom of the picture or half its height, whichever is nearer.
 */
async function reflection(file, width, height) {
  const src = await sharp(file).ensureAlpha().raw().toBuffer()
  const rowOpaque = (y) => { let n = 0; for (let x = 0; x < width; x++) if (src[(y * width + x) * 4 + 3] > 60) n++; return n }
  let top = 0, low = height - 1
  while (top < height && rowOpaque(top) < 2) top++
  while (low > top && rowOpaque(low) < 2) low--
  const water = low - 6, fade = Math.min(height - 2 - water, Math.round(0.55 * (water - top)))
  if (fade < 4) return null
  const out = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) { out[i * 4] = 60; out[i * 4 + 1] = 100; out[i * 4 + 2] = 140 }
  for (let d = 1; d <= fade; d++) {
    const from = water - d, to = water + d, shift = Math.round(2 * Math.sin(d * 0.9)), k = Math.pow(1 - d / fade, 1.2) * 0.26
    for (let x = 0; x < width; x++) {
      const sx = x - shift
      if (sx < 0 || sx >= width) continue
      const si = (from * width + sx) * 4, di = (to * width + x) * 4
      if (!src[si + 3]) continue
      out[di] = src[si] * 0.55; out[di + 1] = src[si + 1] * 0.7; out[di + 2] = src[si + 2] * 0.85
      out[di + 3] = Math.round(src[si + 3] * k)
    }
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).blur(0.7).png().toBuffer()
}
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
  if (MIRRORED.has(kindOf(name))) { const rf = await reflection(fig, width, height); if (rf) under.push({ input: rf }) }
  // The wake: the separate flecks the render leaves run together (blurred, stretched in contrast, blurred again) into
  // one foamy trail, with a wide faint wash of churned water under it.
  const wk = path.join(renders, `${name}.w.png`)
  if (fs.existsSync(wk)) {
    const trail = async (blur, gain, bias, soften, a) => {
      let m = sharp(wk).ensureAlpha().extractChannel(3).blur(blur)
      if (gain) m = m.linear(gain, bias * 255).blur(soften)
      const mask = await m.raw().toBuffer(), px = Buffer.alloc(width * height * 4)
      for (let i = 0; i < width * height; i++) { px[i * 4] = 246; px[i * 4 + 1] = 250; px[i * 4 + 2] = 255; px[i * 4 + 3] = Math.min(255, Math.round(mask[i] * a)) }
      return sharp(px, { raw: { width, height, channels: 4 } }).png().toBuffer()
    }
    // (The flecks lie ten or more pixels apart: it takes a wide blur and a hard stretch to run them together.)
    under.push({ input: await trail(22, 0, 0, 0, 1.6) }, { input: await trail(14, 6, -0.15, 3, 0.55) })
  }
  if (fs.existsSync(sh)) under.push({ input: await layer(sh, { r: SHADOW.r, g: SHADOW.g, b: SHADOW.b }, boat ? 0.16 : SHADOW.a, boat ? 2 : 1.1) })
  const body = kindOf(name) === 'whale' && name.includes('-stand-') ? await sunk(fig, width, height) : fig
  const png = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([...under, { input: body }]).png({ compressionLevel: 9, effort: 10, palette: false }).toBuffer()
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

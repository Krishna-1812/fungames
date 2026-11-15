/**
 * make-time-earth — where the land is today, for Deep Time's globe.
 *
 * The globe is drawn live, and for most of its 4.54 billion years the
 * continents are an impression. For the last few million they are not: the
 * coastline is Natural Earth's, the same one the site's maps use.
 *
 * It is stored as a distance field rather than a mask — how far each point is
 * from the coast, inland or out to sea — for two reasons. A field can be
 * blended with another field, which is how the invented continents of the
 * deep past turn into the real ones; and a threshold on a field stays a crisp
 * coast however far the globe is magnified, where a mask would show pixels.
 *
 *   node scripts/make-time-earth.mjs
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
import sharp from 'sharp'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { LAND_PATH, MAP_W, MAP_H } = await import('../src/data/world.ts')

const W = 2048, H = 1024
/** Pixels either side of the coast the field covers: about eleven degrees. */
const SPREAD = 64

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_W} ${MAP_H}"><rect width="${MAP_W}" height="${MAP_H}" fill="#000"/><path d="${LAND_PATH}" fill="#fff"/></svg>`
const png = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: false } }).render().asPng()
const mask = await sharp(png).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer()

/* Exact Euclidean distance to the nearest pixel of the other kind, by the
   two-pass method of Felzenszwalb and Huttenlocher: columns, then rows. The
   map wraps east to west, so it is done on three copies side by side. */
function distance(inside) {
  const WW = W * 3, INF = 1e12
  const g = new Float64Array(WW * H)
  for (let x = 0; x < WW; x++) {
    const sx = x % W
    let d = INF
    for (let y = 0; y < H; y++) { d = inside(sx, y) ? 0 : d + 1; g[y * WW + x] = d }
    d = INF
    for (let y = H - 1; y >= 0; y--) { d = inside(sx, y) ? 0 : d + 1; g[y * WW + x] = Math.min(g[y * WW + x], d) }
  }
  const out = new Float32Array(W * H)
  const v = new Int32Array(WW), z = new Float64Array(WW + 1), f = new Float64Array(WW)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < WW; x++) f[x] = Math.min(g[y * WW + x], 1e6) ** 2
    let k = 0
    v[0] = 0; z[0] = -INF; z[1] = INF
    for (let q = 1; q < WW; q++) {
      let s
      do { const p = v[k]; s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p) } while (s <= z[k] && --k >= 0)
      k++
      v[k] = q; z[k] = s; z[k + 1] = INF
    }
    k = 0
    for (let q = W; q < 2 * W; q++) {
      while (z[k + 1] < q) k++
      out[y * W + q - W] = Math.sqrt((q - v[k]) ** 2 + f[v[k]])
    }
  }
  return out
}

const isLand = (x, y) => mask[y * W + x] > 127
const toLand = distance(isLand)
const toSea = distance((x, y) => !isLand(x, y))

const field = Buffer.alloc(W * H)
for (let i = 0; i < W * H; i++) {
  const d = toSea[i] > 0 ? toSea[i] - 0.5 : -(toLand[i] - 0.5)      // + inland, − at sea
  field[i] = Math.max(0, Math.min(255, Math.round(127.5 + (d / SPREAD) * 127.5)))
}

const dir = path.join(root, 'public', 'deep-time')
fs.mkdirSync(dir, { recursive: true })
const file = path.join(dir, 'land.webp')
await sharp(field, { raw: { width: W, height: H, channels: 1 } }).resize(1024, 512, { kernel: 'lanczos3' }).webp({ quality: 95, effort: 6 }).toFile(file)
console.log(`land.webp 1024x512, ${(fs.statSync(file).size / 1024).toFixed(0)} kB`)

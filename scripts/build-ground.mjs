#!/usr/bin/env node
/**
 * build-ground — the walk's ground materials (src/lib/walk/groundset.ts), from CC0 photograph sets to the
 * compressed textures the page loads (public/walk-ground/).
 *
 *   node scripts/build-ground.mjs <folder of Poly Haven sets>
 *
 * The folder holds one sub-folder per set, as Poly Haven names it (<source>/<source>_diff_1k.jpg, _nor_gl_1k,
 * _arm_1k, _disp_1k). For each layer:
 *
 *   - colour (<key>-c.ktx2): the photograph, its albedo held to what that surface is in the real world — the mean
 *     scaled to the layer's albedo, its colour eased (sat), its contrast eased (contrast), tinted — and never past
 *     the albedo rule's ceiling; its height (the displacement map, stretched over its own 1st–99th percentiles)
 *     in alpha. Basis ETC1S, sRGB, mipmapped.
 *   - detail (<key>-d.ktx2): the normal's x and y (OpenGL's convention), the roughness and the occlusion, linear.
 *     Basis UASTC (with rate-distortion and Zstandard, for its size), at half the colour's size, mipmapped.
 *
 * It prints each file's size, every layer's albedo as made, and the total against the first-load budget; and it
 * writes public/walk-ground/ground.json (the layers' measured albedos and file sizes: the checks read it).
 * The downloads themselves are never read as anything but pixels, and never kept in the repository.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { GROUND, GROUND_SIZE, GROUND_BUDGET_MB } = await import('../src/lib/walk/groundset.ts')
const sharp = (await import('sharp')).default
const { encodeToKTX2 } = await import('ktx2-encoder')

const src = process.argv[2]
if (!src || !existsSync(src)) { console.error('usage: node scripts/build-ground.mjs <folder of Poly Haven sets>'); process.exit(1) }
const out = process.env.GROUND_OUT ?? new URL('../public/walk-ground/', import.meta.url).pathname
mkdirSync(out, { recursive: true })
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null

const N = GROUND_SIZE
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b
/** An image as N×N RGBA bytes. */
const raw = async (file, channels = 4) => {
  const { data } = await sharp(file).resize(N, N, { fit: 'fill' }).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (channels !== 4) throw new Error('rgba only')
  return data
}
const find = (dir, source, map) => {
  for (const name of [`${source}_${map}_1k.jpg`, `${source}_${map}_1k.png`]) if (existsSync(join(dir, source, name))) return join(dir, source, name)
  throw new Error(`missing ${map} for ${source}`)
}
const encode = (rgba, size, opts) => encodeToKTX2(new Uint8Array(1), {
  ...opts, isKTX2File: true, generateMipmap: true,
  imageDecoder: async () => ({ width: size, height: size, data: new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength) }),
})
/** The detail half the colour's size: a normal four millimetres to a pixel is finer than the walk's camera comes. */
const DN = N / 2
const half = async (rgba) => new Uint8Array(await sharp(Buffer.from(rgba), { raw: { width: N, height: N, channels: 4 } }).resize(DN, DN, { kernel: 'mitchell' }).raw().toBuffer())

const made = []
let total = 0
for (const [k, L] of GROUND.entries()) {
  if (only && !only.has(L.key)) continue
  const t0 = Date.now()
  const diff = await raw(find(src, L.source, L.diffuse ?? 'diff'))
  const nor = await raw(find(src, L.source, 'nor_gl'))
  const arm = await raw(find(src, L.source, 'arm'))
  const disp = await raw(find(src, L.source, 'disp'))
  const px = N * N

  // The colour, in linear light: its mean, then eased and scaled to the layer's albedo.
  const lin = new Float32Array(px * 3)
  for (let i = 0; i < px; i++) for (let c = 0; c < 3; c++) lin[i * 3 + c] = toLin(diff[i * 4 + c] / 255)
  const mean = [0, 0, 0]
  for (let i = 0; i < px; i++) for (let c = 0; c < 3; c++) mean[c] += lin[i * 3 + c] / px
  const sat = L.sat ?? 1, con = L.contrast ?? 1, tint = L.tint ?? [1, 1, 1]
  for (let i = 0; i < px; i++) {
    let r = lin[i * 3], g = lin[i * 3 + 1], b = lin[i * 3 + 2]
    r = mean[0] + (r - mean[0]) * con; g = mean[1] + (g - mean[1]) * con; b = mean[2] + (b - mean[2]) * con
    const l = luma(r, g, b)
    r = (l + (r - l) * sat) * tint[0]; g = (l + (g - l) * sat) * tint[1]; b = (l + (b - l) * sat) * tint[2]
    lin[i * 3] = Math.max(0, r); lin[i * 3 + 1] = Math.max(0, g); lin[i * 3 + 2] = Math.max(0, b)
  }
  let ml = 0
  for (let i = 0; i < px; i++) ml += luma(lin[i * 3], lin[i * 3 + 1], lin[i * 3 + 2]) / px
  const gain = L.albedo / ml

  // The height: stretched over its own 1st to 99th percentiles.
  const hist = new Uint32Array(256)
  for (let i = 0; i < px; i++) hist[disp[i * 4]]++
  const pct = (q) => { let s = 0; for (let v = 0; v < 256; v++) { s += hist[v]; if (s >= q * px) return v } return 255 }
  const h0 = pct(0.01), h1 = Math.max(h0 + 1, pct(0.99))

  const colour = new Uint8Array(px * 4), detail = new Uint8Array(px * 4)
  let over = 0, outMean = 0
  const avg = [0, 0, 0]
  for (let i = 0; i < px; i++) {
    let r = lin[i * 3] * gain, g = lin[i * 3 + 1] * gain, b = lin[i * 3 + 2] * gain
    const m = Math.max(r, g, b)
    if (m > 0.86) { r *= 0.86 / m; g *= 0.86 / m; b *= 0.86 / m; over++ }
    outMean += luma(r, g, b) / px
    avg[0] += r / px; avg[1] += g / px; avg[2] += b / px
    colour[i * 4] = Math.round(toSrgb(r) * 255); colour[i * 4 + 1] = Math.round(toSrgb(g) * 255); colour[i * 4 + 2] = Math.round(toSrgb(b) * 255)
    colour[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (disp[i * 4] - h0) / (h1 - h0))) * 255)
    detail[i * 4] = nor[i * 4]; detail[i * 4 + 1] = nor[i * 4 + 1]
    detail[i * 4 + 2] = Math.round(Math.max(0, Math.min(255, arm[i * 4 + 1] * (L.rough ?? 1))))
    detail[i * 4 + 3] = arm[i * 4]
  }
  const c = await encode(colour, N, { isUASTC: false, qualityLevel: 128, compressionLevel: 2, isPerceptual: true, isSetKTX2SRGBTransferFunc: true })
  const d = await encode(await half(detail), DN, { isUASTC: true, uastcLDRQualityLevel: 1, enableRDO: true, rdoQualityLevel: 3, needSupercompression: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false })
  writeFileSync(join(out, `${L.key}-c.ktx2`), c); writeFileSync(join(out, `${L.key}-d.ktx2`), d)
  total += c.length + d.length
  made.push({ key: L.key, layer: k, source: L.source, albedo: +outMean.toFixed(4), mean: avg.map((v) => Math.round(toSrgb(v) * 255)), clipped: +(over / px).toFixed(5), colourKB: Math.round(c.length / 1024), detailKB: Math.round(d.length / 1024) })
  console.log(`${String(k).padStart(2)} ${L.key.padEnd(13)} albedo ${outMean.toFixed(3)} (photo ${luma(...mean).toFixed(3)})  colour ${Math.round(c.length / 1024)} KB  detail ${Math.round(d.length / 1024)} KB  ${((Date.now() - t0) / 1000).toFixed(1)} s`)
}

// Everything in the folder, whether made this run or before.
const manifest = join(out, 'ground.json')
const prev = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).layers : []
const layers = GROUND.map((L) => made.find((m) => m.key === L.key) ?? prev.find((p) => p.key === L.key)).filter(Boolean)
let bytes = 0
for (const L of GROUND) for (const s of ['c', 'd']) { const f = join(out, `${L.key}-${s}.ktx2`); if (existsSync(f)) bytes += statSync(f).size }
writeFileSync(manifest, JSON.stringify({ size: N, detail: DN, bytes, layers }, null, 1) + '\n')
console.log(`all ${(bytes / 1048576).toFixed(2)} MB of a ${GROUND_BUDGET_MB} MB budget`)

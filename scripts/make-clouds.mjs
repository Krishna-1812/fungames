/**
 * make-clouds — the realistic island's cumulus, as volumes of water droplets.
 *
 * Unity's clouds were heaps of white balls (Creatures.cs, "cloud"): solid,
 * lit like plaster. A real fair-weather cumulus is a mist: soft at its edges,
 * bright where the sun reaches into it, blue-grey in its own shade, glowing
 * at the rims. Here each of the five (c0 to c4) is built as a density field
 * (a flat base, towers heaped highest in the middle, cauliflower lumps on
 * them, worn into wisps by noise), the sunlight that reaches every point in
 * it found by marching towards the sun (with the light scattered on inside
 * it, in a few octaves), and the picture made by marching through it along
 * the island's own view (IslandBuild: 2:1 isometric). Lit by the same sun
 * and sky, and toned by the same curve and grade (Dome.Tone), as everything
 * Unity renders; written over Unity's pictures in unity/Renders/actors, in
 * the same frame (the foot where the box says), for unity-actors.mjs to take.
 *
 *   node scripts/make-clouds.mjs [--only 0,3] [--out dir]
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null }
const outDir = arg('--out') ?? path.join(root, 'unity/Renders/actors')
const only = arg('--only')?.split(',').map(Number) ?? [0, 1, 2, 3, 4]

// The frame (unity/Renders/actors/actors.json: the cloud's box, in the site's px, at 5 px each).
const SCALE = 5, BOX = [-96, -80, 192, 132]
const PW = BOX[2] * SCALE, PH = BOX[3] * SCALE
// The view: a world point (X = tile j, Y up in world units, Z = tile i) is drawn at
// sx = (Z - X) * 32, sy = (Z + X) * 16 - Y * 39.19 site px; the cloud is made at K times that.
const PXH = 45.254834 * 0.8660254, K = 0.7
const VIEW = norm([-1, -32 / PXH, -1])
// The sun (IslandBuild.Light: 40° up, from behind and to the right), and its light and the sky's, linear.
const TO_SUN = norm([-0.707 * Math.cos(0.698), Math.sin(0.698), 0.707 * Math.cos(0.698)])
const SUN = [1.32, 1.24, 1.1], SKY_TOP = [0.38, 0.47, 0.64], SKY_LOW = [0.15, 0.19, 0.29]

function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l) }

/* ---- noise ---- */
const hash = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295 }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
function vnoise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz, s)
  return l(l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf), l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf)
}
function fbm(x, y, z, s, oct) { let a = 0.5, f = 1, sum = 0, n = 0; for (let o = 0; o < oct; o++) { sum += a * vnoise(x * f, y * f, z * f, s + o * 17); n += a; a *= 0.5; f *= 2.03 } return sum / n }
// Billows: the rounded lumps a cumulus is made of (1 - |noise|, folded).
function billow(x, y, z, s, oct) { let a = 0.5, f = 1, sum = 0, n = 0; for (let o = 0; o < oct; o++) { sum += a * (1 - Math.abs(vnoise(x * f, y * f, z * f, s + o * 31) * 2 - 1)); n += a; a *= 0.5; f *= 2.1 } return sum / n }

/* ---- one cloud ---- */
function makeCloud(seed) {
  let st = seed * 9301 + 49297
  const rnd = () => { st = (st * 9301 + 49297) % 233280; return st / 233280 }
  // Its size and lean: some long and low, some piled up.
  const rx = 1.55 + rnd() * 0.4, rz = 1.0 + rnd() * 0.3, tall = 0.5 + rnd() * 0.35
  const puffs = []
  // The towers: big rounded heads, highest near the middle, a few off to the side.
  const heads = 6 + Math.floor(rnd() * 4)
  for (let k = 0; k < heads; k++) {
    const t = rnd() * Math.PI * 2, d = Math.pow(rnd(), 0.8) * 0.7
    const x = Math.cos(t) * d * rx, z = Math.sin(t) * d * rz
    const centre = 1 - d / 0.7
    const r = 0.28 + rnd() * 0.16 + centre * 0.1
    puffs.push([x, 0.15 + centre * tall * (0.45 + rnd() * 0.4) + r * 0.3, z, r])
  }
  // Shoulders round them, lower and smaller, and the wide flat skirt the base is.
  for (let k = 0; k < 40; k++) {
    const t = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.92
    const r = 0.2 + rnd() * 0.14
    puffs.push([Math.cos(t) * d * rx, 0.1 + rnd() * 0.22 * (1 - d) + r * 0.2, Math.sin(t) * d * rz, r])
  }
  const top = Math.max(...puffs.map((p) => p[1] + p[3]))
  // The field, on a grid.
  const V = 0.02, X0 = -rx - 0.6, X1 = rx + 0.6, Z0 = -rz - 0.6, Z1 = rz + 0.6, Y0 = -0.02, Y1 = top + 0.15
  const nx = Math.ceil((X1 - X0) / V), ny = Math.ceil((Y1 - Y0) / V), nz = Math.ceil((Z1 - Z0) / V)
  const dens = new Float32Array(nx * ny * nz)
  const at = (i, j, k) => (k * ny + j) * nx + i
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = X0 + (i + 0.5) * V, y = Y0 + (j + 0.5) * V, z = Z0 + (k + 0.5) * V
    // How far inside the heap: a soft union of the puffs.
    let s = 0
    for (const [px, py, pz, r] of puffs) {
      const dx = x - px, dy = (y - py) * (y < py ? 1.25 : 1), dz = z - pz
      const q = 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / (r * 1.25)
      if (q > 0) s = s + q - s * q
    }
    if (s <= 0) continue
    // Cauliflower on the tops, wisps at the edges and underneath; the base flat and a little ragged.
    const b = billow(x * 3.2, y * 3.2, z * 3.2, seed, 4)
    const w = fbm(x * 9, y * 9, z * 9, seed + 7, 3)
    const hgt = (y - Y0) / (Y1 - Y0)
    let d = s * 1.6 - 0.42 + (b - 0.55) * (0.7 + 0.5 * hgt) + (w - 0.5) * 0.3
    d *= smoothstep(-0.01, 0.07, y + (w - 0.5) * 0.05)
    dens[at(i, j, k)] = Math.max(0, Math.min(1, d * 5))
  }
  const sample = (x, y, z) => {
    const fx = (x - X0) / V - 0.5, fy = (y - Y0) / V - 0.5, fz = (z - Z0) / V - 0.5
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz)
    if (i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1) return 0
    const tx = fx - i, ty = fy - j, tz = fz - k
    const g = (a, b, c) => dens[at(i + a, j + b, k + c)]
    const l = (a, b, t) => a + (b - a) * t
    return l(l(l(g(0, 0, 0), g(1, 0, 0), tx), l(g(0, 1, 0), g(1, 1, 0), tx), ty), l(l(g(0, 0, 1), g(1, 0, 1), tx), l(g(0, 1, 1), g(1, 1, 1), tx), ty), tz)
  }
  // How much cloud lies between each point and the sun (its optical depth, in density × units).
  const toSun = new Float32Array(dens.length)
  const LS = 0.025
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = at(i, j, k)
    if (dens[idx] <= 0 && !(dens[at(Math.min(nx - 1, i + 1), j, k)] > 0)) continue
    let x = X0 + (i + 0.5) * V, y = Y0 + (j + 0.5) * V, z = Z0 + (k + 0.5) * V, od = 0
    for (let n = 0; n < 90; n++) { x += TO_SUN[0] * LS; y += TO_SUN[1] * LS; z += TO_SUN[2] * LS; if (y > Y1) break; od += sample(x, y, z) * LS }
    toSun[idx] = od
  }
  const sunDepth = (x, y, z) => {
    const fx = (x - X0) / V - 0.5, fy = (y - Y0) / V - 0.5, fz = (z - Z0) / V - 0.5
    const i = Math.max(0, Math.min(nx - 1, Math.round(fx))), j = Math.max(0, Math.min(ny - 1, Math.round(fy))), k = Math.max(0, Math.min(nz - 1, Math.round(fz)))
    return toSun[at(i, j, k)]
  }
  return { sample, sunDepth, Y0, Y1, X0, X1, Z0, Z1, top }
}

function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const hg = (c, g) => (1 - g * g) / (4 * Math.PI * Math.pow(1 + g * g - 2 * g * c, 1.5))

/* ---- the grade: Dome.Tone, the same numbers ---- */
const EXPOSURE = 1.05, SATURATION = 1.06, VIBRANCE = 0.2, CONTRAST = 0.1
const aces = (x) => { x = Math.max(0, x); return Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)) }
const toSrgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)
const grade = (v) => Math.min(1, Math.max(0, v + CONTRAST * (v - 0.5) * (1 - Math.abs(2 * v - 1)) * 2))
function tone([r, g, b]) {
  r *= EXPOSURE; g *= EXPOSURE; b *= EXPOSURE
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  const k = SATURATION + VIBRANCE * (1 - (mx > 0 ? (mx - mn) / mx : 0))
  return [r, g, b].map((v) => grade(toSrgb(aces(Math.max(0, l + (v - l) * k)))))
}

/* ---- the picture ---- */
async function render(seed) {
  const t0 = Date.now()
  const c = makeCloud(seed)
  const SIGMA = 42
  const cosT = VIEW[0] * TO_SUN[0] + VIEW[1] * TO_SUN[1] + VIEW[2] * TO_SUN[2]
  const px = Buffer.alloc(PW * PH * 4)
  const SS = 2
  for (let py = 0; py < PH; py++) for (let pxi = 0; pxi < PW; pxi++) {
    let acc = [0, 0, 0], cov = 0
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      // This pixel's place in the site's px, from the foot, and so the ray through the cloud (by height).
      const u = (BOX[0] + (pxi + (sx + 0.5) / SS) / SCALE) / K, v = (BOX[1] + (py + (sy + 0.5) / SS) / SCALE) / K
      const at = (y) => { const s = (v + y * PXH) / 16, d = u / 32; return [(s - d) / 2, y, (s + d) / 2] }
      let T = 1, col = [0, 0, 0]
      const dy = 0.012, step = dy * Math.hypot(1, 32 / PXH, 1) / (32 / PXH)
      for (let y = c.Y1; y > c.Y0; y -= dy) {
        const [x, , z] = at(y)
        if (x < c.X0 || x > c.X1 || z < c.Z0 || z > c.Z1) continue
        const d = c.sample(x, y, z)
        if (d <= 0.002) continue
        const od = c.sunDepth(x, y, z) * SIGMA
        const h = (y - c.Y0) / (c.top - c.Y0)
        // The sun's light scattered towards the eye, in octaves (each fainter, reaching deeper, less forward), with the powder's darkening where light has only just come in.
        let s = 0
        for (let o = 0, a = 1, b = 1, g = 1; o < 4; o++, a *= 0.5, b *= 0.45, g *= 0.5) s += a * Math.exp(-od * b) * (0.7 * hg(cosT, 0.55 * g) + 0.3 * hg(cosT, -0.25 * g))
        const powder = 1 - Math.exp(-d * SIGMA * 0.09) * 0.45
        const amb = 0.85 + 0.15 * Math.exp(-od * 0.08)
        const sky = [0, 1, 2].map((k) => (SKY_LOW[k] + (SKY_TOP[k] - SKY_LOW[k]) * Math.pow(h, 0.7)) * amb)
        const L = [0, 1, 2].map((k) => SUN[k] * s * 3.5 * powder + sky[k])
        const a = 1 - Math.exp(-d * SIGMA * step)
        for (let k = 0; k < 3; k++) col[k] += T * a * L[k]
        T *= 1 - a
        if (T < 0.004) break
      }
      for (let k = 0; k < 3; k++) acc[k] += col[k]
      cov += 1 - T
    }
    const i = (py * PW + pxi) * 4, n = SS * SS
    const alpha = cov / n
    if (alpha < 0.002) continue
    // Straight colour (as Unity's figures come), toned.
    const t = tone(acc.map((v) => v / n / alpha))
    px[i] = Math.round(t[0] * 255); px[i + 1] = Math.round(t[1] * 255); px[i + 2] = Math.round(t[2] * 255); px[i + 3] = Math.round(Math.min(1, alpha) * 255)
  }
  const file = path.join(outDir, `a-cloud-fbfcff-c${seed}-se.png`)
  await sharp(px, { raw: { width: PW, height: PH, channels: 4 } }).png().toFile(file)
  console.log(`cloud c${seed}: ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

fs.mkdirSync(outDir, { recursive: true })
for (const s of only) await render(s)

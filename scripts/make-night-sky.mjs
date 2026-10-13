/**
 * make-night-sky — the realistic island's moon, and its light on the sea.
 *
 * The moon: a sphere lit from a little to the right (a waxing gibbous, nine
 * tenths full), shaded as the moon's dust is (Lommel-Seeliger: nearly flat
 * across the face, a sharp edge where the night begins), with its seas (the
 * dark maria, in broad soft patches), and craters, each a bright rim round
 * a darker floor; a cool white, as it looks in a clear sky.
 *
 * Its path on the sea: no stripes, but thousands of small glints on the
 * ripples, thickest under the moon and spreading as the water comes nearer,
 * in two sets the page fades between, so the path shimmers.
 *
 * Written to src/lib/island/sky/ (lib/island/plate.ts, skyArt, reads them).
 *
 *   node scripts/make-night-sky.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const out = path.join(process.cwd(), 'src/lib/island/sky')
fs.mkdirSync(out, { recursive: true })

let seed = 1234567
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
// Value noise on the sphere (3D), smooth.
const hash3 = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h) }
const noise3 = (x, y, z) => {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz
  const s = (t) => t * t * (3 - 2 * t), u = s(fx), v = s(fy), w = s(fz)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz)
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w)
}
const fbm = (x, y, z, o = 5) => { let a = 0, k = 1, n = 0; for (let i = 0; i < o; i++) { a += noise3(x * k, y * k, z * k) / k; n += 1 / k; k *= 2.03 } return a / n }

/* ---- the moon ---- */
/** The maria: Procellarum, Imbrium, Serenitatis, Tranquillitatis, Crisium, Fecunditatis, Nubium, Humorum, Frigoris, Nectaris. */
const MARIA = [[-0.6, 0.0, 0.34, 0.55], [-0.3, -0.42, 0.33, 0.27], [0.16, -0.4, 0.2, 0.18], [0.33, -0.08, 0.25, 0.22], [0.72, -0.33, 0.12, 0.14], [0.58, 0.18, 0.16, 0.2], [-0.16, 0.36, 0.2, 0.16], [-0.5, 0.42, 0.11, 0.11], [0.0, -0.72, 0.45, 0.09], [0.38, 0.32, 0.1, 0.1], [-0.05, 0.05, 0.14, 0.12]]
{
  const S = 512, R = 236, C = S / 2
  const px = Buffer.alloc(S * S * 4)
  const L = (() => { const v = [0.42, -0.12, 0.9], m = Math.hypot(...v); return v.map((x) => x / m) })()
  // Craters: centres on the sphere, radii; more small than large.
  const craters = []
  for (let k = 0; k < 420; k++) {
    const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z)
    craters.push({ c: [r * Math.cos(a), r * Math.sin(a), z], r: 0.008 + Math.pow(rnd(), 4) * 0.07, ray: k < 2 })
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // 4x4 samples a pixel: a clean edge.
    let rr = 0, gg = 0, bb = 0, aa = 0
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const nx = (x + (sx + 0.5) / 4 - C) / R, ny = (y + (sy + 0.5) / 4 - C) / R
      const d2 = nx * nx + ny * ny
      if (d2 >= 1) continue
      const nz = Math.sqrt(1 - d2), n = [nx, ny, nz]
      // The seas: broad dark patches, more of them in the north-west, as on the real moon's near side.
      const mare = fbm(nx * 1.6 + 3, ny * 1.6 + 1, nz * 1.6, 4)
      // The seas where they are on the real moon's near side (x right, y down, in the disc), their edges ragged.
      let sea = 0
      const rag = 0.55 * (fbm(nx * 4 + 2, ny * 4, nz * 4, 5) - 0.5) + 0.25 * (fbm(nx * 14, ny * 14 + 3, nz * 14, 3) - 0.5)
      for (const [mx, my, ax, ay] of MARIA) {
        const e = Math.hypot((nx - mx) / (ax * 1.3), (ny - my) / (ay * 1.3)) + rag
        sea = Math.max(sea, Math.min(1, Math.max(0, (1.1 - e) / 0.55)))
      }
      let alb = 0.86 - 0.34 * sea * (0.65 + 0.6 * fbm(nx * 6 + 7, ny * 6, nz * 6, 4))
      // Mottled at every scale: the highlands rougher than the seas.
      alb *= 0.9 + 0.2 * fbm(nx * 7, ny * 7, nz * 7, 5) * (1 - 0.5 * sea)
      alb *= 0.96 + 0.08 * fbm(nx * 30 + 5, ny * 30, nz * 30, 3)
      let tilt = [0, 0, 0]
      for (const cr of craters) {
        const dx = n[0] - cr.c[0], dy = n[1] - cr.c[1], dz = n[2] - cr.c[2]
        const d = Math.hypot(dx, dy, dz) / cr.r
        if (d > 1.5) continue
        // A bowl (darker), a rim (brighter), the rim's slope tilting the surface.
        if (d < 1) alb *= 0.96 + 0.04 * d
        else alb *= 1 + 0.06 * Math.max(0, 1 - Math.abs(d - 1.1) / 0.3)
        const k = d < 1 ? -0.6 * d : 0.8 * Math.max(0, 1.5 - d)
        tilt = [tilt[0] + dx / (d * cr.r + 1e-6) * k * 0.15, tilt[1] + dy / (d * cr.r + 1e-6) * k * 0.15, tilt[2]]
      }
      const nn = [n[0] + tilt[0], n[1] + tilt[1], n[2]], m = Math.hypot(...nn)
      const mu0 = Math.max(0, (nn[0] * L[0] + nn[1] * L[1] + nn[2] * L[2]) / m), mu = nz
      // Lommel-Seeliger, softened at the terminator.
      let lum = alb * (2 * mu0 / (mu0 + mu + 1e-4)) * 0.9
      // The bright young craters' rays, faint lines out across the face.
      for (const cr of craters) if (cr.ray) {
        const dx = n[0] - cr.c[0], dy = n[1] - cr.c[1], dz = n[2] - cr.c[2], d = Math.hypot(dx, dy, dz)
        const ang = Math.atan2(dy, dx), streak = Math.pow(Math.max(0, Math.sin(ang * 7 + cr.c[0] * 9)), 12)
        lum += mu0 > 0 ? 0.12 * streak * Math.exp(-d / 0.35) + 0.25 * Math.exp(-d / 0.02) : 0
      }
      const v = Math.min(1, lum)
      // The dark side all but gone against the sky (a little earthshine).
      const cover = Math.min(1, 0.12 + lum * 5)
      rr += v * 0.94 * cover; gg += v * 0.96 * cover; bb += v * 1.0 * cover; aa += cover
    }
    const k = (y * S + x) * 4
    if (!aa) continue
    const a = aa / 16
    px[k] = Math.round(Math.pow(rr / aa, 1 / 1.4) * 255); px[k + 1] = Math.round(Math.pow(gg / aa, 1 / 1.4) * 255); px[k + 2] = Math.round(Math.pow(bb / aa, 1 / 1.4) * 255); px[k + 3] = Math.round(a * 255)
  }
  await sharp(px, { raw: { width: S, height: S, channels: 4 } }).resize(320, 320, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(path.join(out, 'moon.png'))
}

/* ---- the moon's path on the sea: two sets of glints ---- */
for (const [name, s0] of [['glints-a', 77], ['glints-b', 991]]) {
  seed = s0
  // In site units ×2: 300 wide, 420 tall; the moon over the top middle.
  const W = 600, H = 840
  const a = new Float32Array(W * H)
  for (let k = 0; k < 2600; k++) {
    const t = Math.pow(rnd(), 0.8)                     // how far down the path (0 under the moon)
    const y = 10 + t * (H - 30)
    const spread = 18 + t * 150                        // wider as it comes nearer
    const g = (rnd() + rnd() + rnd() - 1.5) / 1.5       // roughly Gaussian across
    const x = W / 2 + g * spread + Math.sin(y * 0.031) * 6
    const len = 2 + rnd() * (5 + t * 16), th = 1 + rnd() * (0.6 + t * 1.6)
    const b = (0.35 + rnd() * 0.65) * (1 - 0.55 * t) * Math.exp(-g * g * 1.6)
    // A soft dash: brightest in its middle.
    for (let yy = Math.floor(y - th); yy <= Math.ceil(y + th); yy++) for (let xx = Math.floor(x - len); xx <= Math.ceil(x + len); xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
      const u = (xx - x) / len, v = (yy - y) / th
      const w = Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v)
      a[yy * W + xx] = Math.min(1, a[yy * W + xx] + b * w)
    }
  }
  const px = Buffer.alloc(W * H * 4)
  for (let k = 0; k < W * H; k++) { px[k * 4] = 236; px[k * 4 + 1] = 242; px[k * 4 + 2] = 255; px[k * 4 + 3] = Math.round(a[k] * 255) }
  await sharp(px, { raw: { width: W, height: H, channels: 4 } }).blur(0.6).png({ compressionLevel: 9 }).toFile(path.join(out, `${name}.png`))
}
console.log('night sky: ' + fs.readdirSync(out).map((f) => `${f} ${(fs.statSync(path.join(out, f)).size / 1e3).toFixed(0)} KB`).join(', '))

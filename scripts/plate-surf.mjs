/**
 * The realistic island's surf lines, from the Unity plate itself.
 *
 *   node scripts/plate-surf.mjs [--debug out.png]
 *
 * Reads src/lib/island/plate/ (scripts/unity-plate.mjs) and writes
 * plate/surf.json: lines in the sea a set distance out from the coast as
 * Unity drew it, for world.ts to break the surf along. The sea is what is
 * blue in the picture and joined to its edge (the pools and ponds inland are
 * not the sea); its distance from the land is measured as on the ground, not
 * on the picture (a tile is twice as wide as it is tall there), in tiles.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..')
const dir = path.join(root, 'src/lib/island/plate')
const m = JSON.parse(fs.readFileSync(path.join(dir, 'plate.json'), 'utf8'))
const debug = process.argv.includes('--debug') ? process.argv[process.argv.indexOf('--debug') + 1] : null

/** How far out each line of surf breaks, in tiles: the outer one first, where the shallows end. */
export const BANDS = { out: 0.72, mid: 0.47, in: 0.24 }
/** Pixels per map unit the sea is measured at. */
const RES = 1
/** A line's points kept no further than this from where it was traced (map units). */
const SIMPLIFY = 0.7
/** Shorter than this (map units), a line is a speck: dropped. Round a rock or a sandbar (shorter than ROCK) only the inner line breaks: the swell wraps it, it does not ring it. */
const MIN_LEN = 40, ROCK = 700

// The picture at RES, a tile at a time.
const tw = Math.round((m.tile / m.scale) * RES), W = m.cols * tw, H = m.rows * tw
const tiles = []
for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
  tiles.push({ input: await sharp(path.join(dir, `${r}_${c}.webp`)).resize(tw, tw, { kernel: 'lanczos3' }).png().toBuffer(), left: c * tw, top: r * tw })
}
const px = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(tiles).raw().toBuffer()

// Water: bluer than it is red (sand, grass, rock and roads never are); the fade at the edges is sea too.
const wet = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) {
  const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3]
  wet[i] = a < 200 || (b - r > 28 && b > 70 && g - r > 10) ? 1 : 0
}
// A pixel or two of wet in the sand (a shadow's blue, a puddle) is not the sea, nor a fleck of foam in the sea land.
const open = (src, val, k) => {
  const out = src.slice()
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src[y * W + x] !== val) continue
    let n = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && src[yy * W + xx] === val) n++ }
    if (n < k) out[y * W + x] = 1 - val
  }
  return out
}
let mask = open(open(wet, 1, 4), 0, 4)
// The sea: the water that reaches the picture's edge.
const sea = new Uint8Array(W * H), stack = []
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x)
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1)
while (stack.length) {
  const i = stack.pop()
  if (sea[i] || !mask[i]) continue
  sea[i] = 1
  const x = i % W, y = (i / W) | 0
  if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W)
}

// The distance from the land (all that is not the sea), exact (Felzenszwalb), on the ground: a pixel down is two across.
const INF = 1e12
function edt1(f, n, step) {
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1)
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF
  for (let q = 1; q < n; q++) {
    let s
    for (;;) { const p = v[k]; s = ((f[q] + (q * step) ** 2) - (f[p] + (p * step) ** 2)) / (2 * step * (q - p)) / step; if (s <= z[k]) k--; else break }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = ((q - v[k]) * step) ** 2 + f[v[k]] }
  return d
}
const dist = new Float64Array(W * H)
{
  const col = new Float64Array(H)
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) col[y] = sea[y * W + x] ? INF : 0
    const d = edt1(col, H, 2)
    for (let y = 0; y < H; y++) dist[y * W + x] = d[y]
  }
  const row = new Float64Array(W)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) row[x] = dist[y * W + x]
    const d = edt1(row, W, 1)
    // In tiles: a tile's side on the ground is 32√2 map units.
    for (let x = 0; x < W; x++) dist[y * W + x] = Math.sqrt(d[x]) / RES / (32 * Math.SQRT2)
  }
}

// The lines: marching squares at each distance, the pieces joined end to end.
function trace(level) {
  const at = (x, y) => dist[y * W + x] - level
  const segs = []
  const lerp = (x0, y0, x1, y1) => { const a = at(x0, y0), b = at(x1, y1), t = a / (a - b); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t] }
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const c = (at(x, y) > 0 ? 1 : 0) | (at(x + 1, y) > 0 ? 2 : 0) | (at(x + 1, y + 1) > 0 ? 4 : 0) | (at(x, y + 1) > 0 ? 8 : 0)
    if (c === 0 || c === 15) continue
    const T = () => lerp(x, y, x + 1, y), R = () => lerp(x + 1, y, x + 1, y + 1), B = () => lerp(x, y + 1, x + 1, y + 1), L = () => lerp(x, y, x, y + 1)
    const pairs = { 1: [L, T], 2: [T, R], 3: [L, R], 4: [R, B], 5: [L, T, R, B], 6: [T, B], 7: [L, B], 8: [B, L], 9: [B, T], 10: [T, R, B, L], 11: [B, R], 12: [R, L], 13: [R, T], 14: [T, L] }[c]
    for (let k = 0; k < pairs.length; k += 2) segs.push([pairs[k](), pairs[k + 1]()])
  }
  // Join: each end point, keyed to a grid finer than a pixel.
  const key = (p) => `${Math.round(p[0] * 64)},${Math.round(p[1] * 64)}`
  const ends = new Map()
  segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); (ends.get(k) ?? ends.set(k, []).get(k)).push(i) } })
  const used = new Uint8Array(segs.length), lines = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    used[i] = 1
    const line = [segs[i][0], segs[i][1]]
    for (const dir of [1, 0]) {
      for (;;) {
        const tip = dir ? line[line.length - 1] : line[0]
        const next = (ends.get(key(tip)) ?? []).find((j) => !used[j])
        if (next === undefined) break
        used[next] = 1
        const s = segs[next], far = key(s[0]) === key(tip) ? s[1] : s[0]
        if (dir) line.push(far); else line.unshift(far)
      }
    }
    lines.push(line)
  }
  return lines
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts
  const [a, b] = [pts[0], pts[pts.length - 1]]
  let best = -1, at = 0
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy)
  for (let i = 1; i < pts.length - 1; i++) {
    // (A closed line's ends are one point: from it, then.)
    const d = L < 1e-6 ? Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]) : Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / L
    if (d > best) { best = d; at = i }
  }
  return best > eps ? [...rdp(pts.slice(0, at + 1), eps).slice(0, -1), ...rdp(pts.slice(at), eps)] : [a, b]
}
const len = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0)
const [bx, by] = m.box
const f1 = (v) => Math.round(v * 10) / 10
const toMap = (p) => [bx + p[0] / RES, by + p[1] / RES]
const surf = {}
for (const [name, level] of Object.entries(BANDS)) {
  const lines = trace(level).map((l) => l.map(toMap)).filter((l) => len(l) >= (name === 'in' ? MIN_LEN : ROCK)).map((l) => {
    const closed = Math.hypot(l[0][0] - l[l.length - 1][0], l[0][1] - l[l.length - 1][1]) < 1.5
    const s = rdp(l, SIMPLIFY)
    return 'M' + s.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L') + (closed ? 'Z' : '')
  })
  surf[name] = lines.join('')
  console.log(`[plate-surf] ${name} (${level} tiles out): ${lines.length} lines, ${(surf[name].length / 1024).toFixed(1)} KB`)
}
fs.writeFileSync(path.join(dir, 'surf.json'), JSON.stringify({ id: m.id, ...surf }) + '\n')

if (debug) {
  // The plate with the sea it found tinted and the lines drawn over it.
  const out = Buffer.from(px)
  for (let i = 0; i < W * H; i++) if (!sea[i]) { out[i * 4] = out[i * 4] * 0.6 + 100; out[i * 4 + 1] *= 0.6; out[i * 4 + 2] *= 0.6 }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${bx} ${by} ${W / RES} ${H / RES}">${Object.values(surf).map((d, i) => `<path d="${d}" fill="none" stroke="${['#ff0', '#0f0', '#f0f'][i]}" stroke-width="1.2"/>`).join('')}</svg>`
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).composite([{ input: Buffer.from(svg) }]).png().toFile(debug)
  console.log('[plate-surf] debug:', debug)
}

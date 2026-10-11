/**
 * unity-registration — does Unity draw every tile exactly where the site does?
 *
 * Reads unity/Renders/registration.png (IslandBuild.Registration: each land
 * tile's top painted with its own number, red = i * 8 + 4, green = j * 8 + 4)
 * and, for every tile, looks where the site's projection (kit.ts, P) puts its
 * middle. Each tile whose top can be seen there must be painted with its own
 * number; and for tiles with nothing taller in front, the painted area's
 * middle must sit on the site's, to within a pixel.
 *
 * Not one of the npm test suites: it needs a render from Unity first.
 *
 *   node scripts/unity-registration.mjs [scale]
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const scale = Number(process.argv[2] ?? 1)
const d = JSON.parse(readFileSync(new URL('../unity/Assets/Island/Data/island.json', import.meta.url)))
const { data, info } = await sharp(fileURLToPathSafe('../unity/Renders/registration.png')).raw().toBuffer({ resolveWithObject: true })
function fileURLToPathSafe(p) { return new URL(p, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') }
const [vx, vy] = d.viewBox
const W = info.width, ch = info.channels
const px = (x, y) => { const k = (Math.round(y) * W + Math.round(x)) * ch; return [data[k], data[k + 1], data[k + 2]] }
const at = (i, j, z) => [((i - j) * 32 - vx) * scale, ((i + j) * 16 - z - vy) * scale]
const land = (i, j) => i >= 0 && j >= 0 && i < d.grid && j < d.grid && d.ground[i * d.grid + j] !== '0'
const Z = (i, j) => (land(i, j) ? d.height[i * d.grid + j] : d.sea)

let seen = 0, right = 0, open = 0
const offs = []
const wrong = []
for (let i = 0; i < d.grid; i++) for (let j = 0; j < d.grid; j++) {
  if (!land(i, j)) continue
  const z = Z(i, j), [cx, cy] = at(i + 0.5, j + 0.5, z)
  const [r, g, b] = px(cx, cy)
  if (b < 150) continue // a wall or something taller in front: not visible here
  seen++
  const ii = Math.round((r - 4) / 8), jj = Math.round((g - 4) / 8)
  if (ii === i && jj === j) right++
  else wrong.push(`${i},${j} drawn as ${ii},${jj}`)
  // Nothing taller in front (the three tiles nearer the viewer): the whole top is visible, and its middle is measured.
  if (Z(i + 1, j) <= z && Z(i, j + 1) <= z && Z(i + 1, j + 1) <= z) {
    let sx = 0, sy = 0, n = 0
    for (let y = Math.floor(cy - 18 * scale); y <= cy + 18 * scale; y++) for (let x = Math.floor(cx - 34 * scale); x <= cx + 34 * scale; x++) {
      const [r2, g2, b2] = px(x, y)
      if (b2 > 150 && Math.round((r2 - 4) / 8) === i && Math.round((g2 - 4) / 8) === j) { sx += x + 0.5; sy += y + 0.5; n++ }
    }
    if (n > 200 * scale * scale) { open++; offs.push([sx / n - cx, sy / n - cy, n]) }
  }
}
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
const dx = mean(offs.map((o) => o[0])), dy = mean(offs.map((o) => o[1]))
const worst = Math.max(...offs.map((o) => Math.hypot(o[0], o[1])))
const area = mean(offs.map((o) => o[2]))
console.log(`tiles visible at their middle: ${seen}; drawn as themselves: ${right} (${((right / seen) * 100).toFixed(1)}%)`)
if (wrong.length) console.log('  wrong:', wrong.slice(0, 8).join('; '))
console.log(`open tiles measured: ${open}; mean offset ${dx.toFixed(2)}, ${dy.toFixed(2)} px; worst ${worst.toFixed(2)} px; mean area ${area.toFixed(0)} px (a whole top is ${(1024 * scale * scale).toFixed(0)})`)
const ok = right / seen > 0.995 && Math.hypot(dx, dy) < 0.75 * scale && worst < 1.5 * scale
console.log(ok ? 'REGISTERED' : 'OFF')
process.exit(ok ? 0 : 1)

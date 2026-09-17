/**
 * deep-sea-sheet — every cut-out over the real water it will float on.
 *
 * The scenes are transparent now, so rendering one on its own tells you almost
 * nothing: the question is always whether you can see it against the colour of
 * its OWN depth, and below about a thousand metres that colour is very close to
 * black. This composites each subject onto the true interpolated sky of its
 * marker depth and lays them out in one sheet, which is the only honest way to
 * look at the set.
 *
 * Not a check — check-deep-sea-art.mjs measures this properly. This is for
 * eyes, and it is deliberately named so check-all does not pick it up.
 *
 *   node scripts/deep-sea-sheet.mjs out.png
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { MARKERS, ZONES } = await import('../src/data/deep-sea.ts')
const { DEEP_SEA_ART } = await import('../src/lib/deep-sea-art.ts')

const hex = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }
function waterAt(depth) {
  const z = ZONES.find((z) => depth >= z.from && depth <= z.to) ?? ZONES[ZONES.length - 1]
  const t = Math.min(1, Math.max(0, (depth - z.from) / Math.max(1, z.to - z.from)))
  const a = hex(z.sky[0]); const b = hex(z.sky[1])
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

const COLS = 4
const CW = 240
const CH = 160
const rows = Math.ceil(MARKERS.length / COLS)
let cells = ''
MARKERS.forEach((m, i) => {
  const x = (i % COLS) * CW
  const y = Math.floor(i / COLS) * CH
  const w = waterAt(m.depth)
  const art = DEEP_SEA_ART[m.title]
  cells +=
    `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" fill="rgb(${w})"/>` +
    `<svg x="${x + 10}" y="${y + 10}" width="${CW - 20}" height="${CH - 20}" viewBox="0 0 120 80">${art.draw()}</svg>`
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CW}" height="${rows * CH}">${cells}</svg>`
const out = process.argv[2]
fs.writeFileSync(out, new Resvg(svg, { fitTo: { mode: 'width', value: COLS * CW } }).render().asPng())
console.log('wrote ' + out)

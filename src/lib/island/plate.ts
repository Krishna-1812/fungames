/**
 * The ground as Unity renders it, read from the repo at build time.
 *
 * scripts/unity-plate.mjs writes src/lib/island/plate/: the picture in WebP
 * tiles, a small copy, and plate.json (where it lies on the map, in P()'s
 * units, at how many pixels a unit, and an id). The island's SVG draws the
 * small copy (world.ts, PlateRef); the bake paints the map from the tiles
 * (bake/draw.ts). With no plate.json, the island draws its own ground as it
 * always has; and the same until plate.json says it is live, or ISLAND_PLATE=1
 * asks for it (to look at the plate locally before the rest of the island
 * has caught up with it).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { PlateRef } from './world'

export type PlateInfo = { box: [number, number, number, number]; scale: number; tile: number; cols: number; rows: number; id: string; live?: boolean }
export type PlatePixels = PlateInfo & { width: number; height: number; px: Buffer }

// The project: builds (and the bake script) run from it.
const dir = () => path.join(process.cwd(), 'src', 'lib', 'island', 'plate')

export function plateInfo(): PlateInfo | null {
  const f = path.join(dir(), 'plate.json')
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as PlateInfo) : null
}

/** What the island's SVG draws: the small copy, inline. */
export function plateRef(): PlateRef | null {
  const p = plateInfo()
  if (!p || !(p.live || process.env.ISLAND_PLATE === '1')) return null
  const low = fs.readFileSync(path.join(dir(), 'low.png')).toString('base64')
  return { box: p.box, id: p.id, href: `data:image/png;base64,${low}` }
}

/** The whole picture at full size, straight (not premultiplied: sharp scales it right), for the bake to cut cells from. */
export async function platePixels(): Promise<PlatePixels | null> {
  const p = plateInfo()
  if (!p) return null
  const sharp = (await import('sharp')).default
  const width = p.cols * p.tile, height = p.rows * p.tile
  const tiles = []
  for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) tiles.push({ input: path.join(dir(), `${r}_${c}.webp`), left: c * p.tile, top: r * p.tile })
  const px = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }, limitInputPixels: false }).composite(tiles).raw().toBuffer()
  return { ...p, width, height, px }
}

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
 *
 * The night's light (scripts/unity-glow.mjs: the island lit by its own lamps
 * and windows alone) is kept the same way in src/lib/island/glow/, over the
 * same box, and shown whenever the plate is.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { PlateRef } from './world'

export type PlateInfo = { box: [number, number, number, number]; scale: number; tile: number; cols: number; rows: number; id: string; sea?: string; live?: boolean }
export type PlatePixels = PlateInfo & { width: number; height: number; px: Buffer }

export type PlateName = 'plate' | 'glow'
// The project: builds (and the bake script) run from it.
const dir = (name: PlateName = 'plate') => path.join(process.cwd(), 'src', 'lib', 'island', name)

export function plateInfo(name: PlateName = 'plate'): PlateInfo | null {
  const f = path.join(dir(name), `${name}.json`)
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as PlateInfo) : null
}

/** What the island's SVG draws: the small copy, inline. (The glow only with the plate, which says whether either is live; `force` asks for it regardless, for the realistic island's own page.) */
export function plateRef(name: PlateName = 'plate', force = false): PlateRef | null {
  const live = plateInfo('plate')
  const p = plateInfo(name)
  if (!p || !live || !(force || live.live || process.env.ISLAND_PLATE === '1')) return null
  const low = fs.readFileSync(path.join(dir(name), 'low.png')).toString('base64')
  return { box: p.box, id: p.id, href: `data:image/png;base64,${low}`, sea: live.sea }
}

/** The whole picture at full size, straight (not premultiplied: sharp scales it right), for the bake to cut cells from. */
export async function platePixels(name: PlateName = 'plate'): Promise<PlatePixels | null> {
  const p = plateInfo(name)
  if (!p) return null
  const sharp = (await import('sharp')).default
  const width = p.cols * p.tile, height = p.rows * p.tile
  const tiles = []
  for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) tiles.push({ input: path.join(dir(name), `${r}_${c}.webp`), left: c * p.tile, top: r * p.tile })
  const px = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }, limitInputPixels: false }).composite(tiles).raw().toBuffer()
  return { ...p, width, height, px }
}

/** The realistic night's moon and its glints on the sea (scripts/make-night-sky.mjs), inline. */
export type SkyArt = { moon: string; glintsA: string; glintsB: string }
export function skyArt(): SkyArt | null {
  const d = path.join(process.cwd(), 'src', 'lib', 'island', 'sky')
  const read = (n: string) => `data:image/png;base64,${fs.readFileSync(path.join(d, n)).toString('base64')}`
  if (!fs.existsSync(path.join(d, 'moon.png'))) return null
  return { moon: read('moon.png'), glintsA: read('glints-a.png'), glintsB: read('glints-b.png') }
}

/**
 * The island's trees and rocks as Unity renders them, read from the repo at
 * build time.
 *
 * scripts/unity-figures.mjs writes src/lib/island/figures/: a PNG for each
 * figure (a pine, a jacaranda, a boulder...), lit and seen exactly as the
 * island is, and figures.json: each one's size and where its foot is, in the
 * island's own units at a size of 1, and an id. props.ts draws a figure in
 * place of its own drawing of a tree (see setFigures there); the bake paints
 * it like anything else. Used whenever the plate is (lib/island/plate.ts):
 * the ground and what grows on it go real together.
 */
import fs from 'node:fs'
import path from 'node:path'

/** A figure: its picture's size, and its foot (the ground point it stands on) from the picture's top left. */
export type FigureInfo = { w: number; h: number; ax: number; ay: number }
export type FigureSet = { id: string; items: Record<string, FigureInfo & { href: string }> }
/** Unity's pictures of the buildings' solids: one for each run ("slug/run"), where it lies on the map (P()'s units). */
export type BuildingInfo = { x: number; y: number; w: number; h: number }
export type BuildingSet = { id: string; items: Record<string, BuildingInfo & { href: string }> }

const dir = () => path.join(process.cwd(), 'src', 'lib', 'island', 'figures')

export function figureSet(): FigureSet | null {
  const f = path.join(dir(), 'figures.json')
  if (!fs.existsSync(f)) return null
  const m = JSON.parse(fs.readFileSync(f, 'utf8')) as { id: string; items: Record<string, FigureInfo> }
  const items: FigureSet['items'] = {}
  for (const [name, it] of Object.entries(m.items)) {
    const png = path.join(dir(), `${name}.png`)
    if (fs.existsSync(png)) items[name] = { ...it, href: `data:image/png;base64,${fs.readFileSync(png).toString('base64')}` }
  }
  return { id: m.id, items }
}

/** The buildings, as Unity renders them (scripts/unity-buildings.mjs writes src/lib/island/buildings/). */
export function buildingSet(): BuildingSet | null {
  const d = path.join(process.cwd(), 'src', 'lib', 'island', 'buildings')
  const f = path.join(d, 'buildings.json')
  if (!fs.existsSync(f)) return null
  const m = JSON.parse(fs.readFileSync(f, 'utf8')) as { id: string; items: Record<string, BuildingInfo> }
  const items: BuildingSet['items'] = {}
  for (const [key, it] of Object.entries(m.items)) {
    const png = path.join(d, `${key.replace('/', '_')}.png`)
    if (fs.existsSync(png)) items[key] = { ...it, href: `data:image/png;base64,${fs.readFileSync(png).toString('base64')}` }
  }
  return { id: m.id, items }
}

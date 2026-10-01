/**
 * The island's build-time rasteriser: resvg, drawing an SVG to RGBA pixels.
 * Kept apart from world.ts so the drawing itself never needs a native module;
 * the homepage and check-island pass it in (buildIsland's `raster`).
 */
import { Resvg } from '@resvg/resvg-js'
import type { Raster } from './world'

export const resvgRaster: Raster = (svg, width) => {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } }).render()
  return { width: img.width, height: img.height, pixels: img.pixels }
}

/**
 * The sketchbook page: cold-pressed drawing paper, lit from the window.
 *
 * The relief comes from tooth.ts, the same relief the pencil deposits
 * against, so the grain you see in the paper and the grain in your line are
 * one grain. The paper is lit from the upper left, where the window is: each
 * bump is a touch brighter on that side and a touch darker on the other, and
 * the hollows sit very slightly in shade. A few per cent either way — at more
 * than that it stops being paper and starts being stucco.
 *
 * Over the tile go the things a tile cannot carry: cloudy variation in the
 * pulp, a few times larger than the repeat so the repeat never shows, and the
 * very slight darkening a sheet has towards its edges.
 *
 * Drawn once per size, never animated. Nothing on a page you are drawing on
 * should move.
 */
import { tooth, toothScale } from './tooth'

/** The paper's colour, fully lit. A cool white, as drawing paper really is. */
export const PAPER: [number, number, number] = [247, 248, 250]

const tiles = new Map<number, HTMLCanvasElement>()

/** One lit tile of paper at a device scale. */
export function paperTile(scale = 1): HTMLCanvasElement {
  const t = tooth(scale)
  const hit = tiles.get(t.scale)
  if (hit) return hit
  const { size: S, h } = t
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')!
  const img = g.createImageData(S, S)
  const d = img.data
  // Light from the upper left, a little above the paper.
  const lx = -0.62, ly = -0.78
  // Slopes per CSS pixel, so the paper looks the same at every density.
  const k = t.scale / 2
  for (let y = 0; y < S; y++) {
    const up = ((y - 1 + S) % S) * S, dn = ((y + 1) % S) * S, row = y * S
    for (let x = 0; x < S; x++) {
      const l = (x - 1 + S) % S, r = (x + 1) % S
      const dx = (h[row + r] - h[row + l]) * k
      const dy = (h[dn + x] - h[up + x]) * k
      const hv = h[row + x]
      // Facing the light brightens; the hollows sit a little in shade.
      const s = 1.006 + (-(dx * lx + dy * ly)) * 0.034 + (hv - 0.5) * 0.022
      const i = (row + x) * 4
      d[i] = Math.min(255, PAPER[0] * s)
      d[i + 1] = Math.min(255, PAPER[1] * s)
      d[i + 2] = Math.min(255, PAPER[2] * s)
      d[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  tiles.set(t.scale, cv)
  return cv
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/**
 * Paint a sheet of the paper into a canvas, at its current backing size.
 *
 * @param scale  the tooth's scale, from toothScale(), the same the pencil uses
 * @param origin where the drawing area starts, in device pixels, so that the
 *               tooth here lines up exactly with the tooth the pencil uses
 * @param seed   a different sheet each page: the pulp is never laid the same
 */
export function paintSheet(cv: HTMLCanvasElement, scale: number, origin = { x: 0, y: 0 }, seed = 1) {
  const g = cv.getContext('2d')!
  const W = cv.width, H = cv.height
  const pat = g.createPattern(paperTile(scale), 'repeat')!
  g.save()
  g.translate(origin.x, origin.y)
  g.fillStyle = pat
  g.fillRect(-origin.x, -origin.y, W, H)
  g.restore()

  // Pulp: broad, faint clouds, lighter and darker, larger than the tile.
  const r = rng(seed * 7919 + 3)
  const big = Math.max(W, H)
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = r() * H, rad = big * (0.12 + r() * 0.22)
    const light = r() < 0.5
    const grd = g.createRadialGradient(x, y, 0, x, y, rad)
    grd.addColorStop(0, light ? 'rgba(255,255,255,0.10)' : 'rgba(120,130,150,0.035)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, W, H)
  }

  // Towards the edges the sheet is a shade darker: it curls, very slightly,
  // and takes less of the light.
  const e = Math.min(W, H) * 0.06
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const grd = g.createLinearGradient(x0, y0, x1, y1)
    grd.addColorStop(0, 'rgba(70,80,100,0.07)')
    grd.addColorStop(1, 'rgba(70,80,100,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, W, H)
  }
  edge(0, 0, e, 0); edge(W, 0, W - e, 0); edge(0, H, 0, H - e)
}

/**
 * A sheet that fills its host and repaints when the host changes size, at the
 * same backing size the pencil's canvas uses, so their pixels coincide.
 */
export function mountSheet(host: HTMLElement, seed = 1) {
  const cv = document.createElement('canvas')
  cv.className = 'fm-paper'
  cv.setAttribute('aria-hidden', 'true')
  host.append(cv)
  let page = seed
  const paint = () => {
    const r = host.getBoundingClientRect()
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr))
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h }
    paintSheet(cv, toothScale(w), { x: 0, y: 0 }, page)
  }
  new ResizeObserver(paint).observe(host)
  return {
    canvas: cv,
    /** A fresh page: same paper, different pulp. */
    turn(next: number) { page = next; paint() },
  }
}

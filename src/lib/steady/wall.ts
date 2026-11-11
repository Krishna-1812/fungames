/**
 * The wall the neon hangs on: brick, painted a dark slate blue a long time
 * ago, in running bond.
 *
 * This is only what the wall *is* (its albedo, and the shape of the bricks
 * baked in as a little light on their upper edges). How bright it is at any
 * point is decided later, by the light the tubes throw on it (neon.ts), which
 * multiplies this. So it is painted fully lit, the way a texture is.
 *
 * It is a tile that repeats seamlessly: a whole number of bricks across and an
 * even number of courses down, so the bond carries on across the seam. Each
 * brick is its own small picture (colour, a little warp in the paint, the odd
 * chip where the paint has come away and the brick shows), so the repeat is
 * not something the eye picks up at this size.
 */

const BW = 82, BH = 27, MORTAR = 5
const COLS = 8, ROWS = 10

/** Deterministic: the same wall every visit. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

export function brickTile(dpr = 1): HTMLCanvasElement {
  const W = COLS * BW, H = ROWS * BH
  const cv = document.createElement('canvas')
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  const g = cv.getContext('2d')!
  g.scale(dpr, dpr)
  const r = rng(20261112)

  // Mortar: recessed, so darker, and gritty.
  g.fillStyle = '#283042'
  g.fillRect(0, 0, W, H)

  for (let row = 0; row < ROWS; row++) {
    const off = row % 2 ? -BW / 2 : 0
    for (let col = -1; col <= COLS; col++) {
      const x = col * BW + off + MORTAR / 2, y = row * BH + MORTAR / 2
      const w = BW - MORTAR, h = BH - MORTAR
      // Seeded per brick, not per draw: a brick cut by the tile's edge is drawn
      // again on the far side, and both halves must be the same brick.
      const r = rng(9001 + row * 131 + ((col + COLS) % COLS) * 17)
      // Old paint is never one colour: each brick took it a little differently.
      const v = (r() - 0.5) * 0.16
      const base = [70 + v * 70, 86 + v * 80, 118 + v * 96]
      const grd = g.createLinearGradient(x, y, x + w * 0.4, y + h)
      grd.addColorStop(0, `rgb(${base[0] + 10 | 0},${base[1] + 12 | 0},${base[2] + 14 | 0})`)
      grd.addColorStop(1, `rgb(${base[0] - 6 | 0},${base[1] - 6 | 0},${base[2] - 8 | 0})`)
      g.fillStyle = grd
      roundRect(g, x, y, w, h, 2.2)
      g.fill()
      // The upper edge catches the light; the lower one sits in the mortar's shadow.
      g.fillStyle = 'rgba(190, 210, 240, 0.10)'
      g.fillRect(x + 1.5, y, w - 3, 1.4)
      g.fillStyle = 'rgba(0, 0, 0, 0.32)'
      g.fillRect(x + 1, y + h - 1.6, w - 2, 1.6)
      g.fillStyle = 'rgba(0, 0, 0, 0.18)'
      g.fillRect(x + w - 1.4, y + 1, 1.4, h - 2)
      // Where the paint has flaked, the brick shows through: rare, small.
      if (r() < 0.16) {
        const n = 1 + (r() * 3) | 0
        for (let k = 0; k < n; k++) {
          const cx = x + 4 + r() * (w - 8), cy = y + 3 + r() * (h - 6)
          g.fillStyle = `rgba(${120 + r() * 30 | 0}, ${70 + r() * 20 | 0}, ${60 + r() * 16 | 0}, ${0.55 + r() * 0.3})`
          g.beginPath()
          const rx = 1.5 + r() * 4, ry = 1 + r() * 2.2
          for (let a = 0; a < 6.28; a += 0.9) {
            const q = 0.7 + r() * 0.5
            g.lineTo(cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q)
          }
          g.fill()
        }
      }
      // Drips and runs where the paint went on thick.
      if (r() < 0.12) {
        g.fillStyle = 'rgba(80, 100, 140, 0.18)'
        const dx = x + r() * w
        g.fillRect(dx, y + h * 0.3, 1.2, h * 0.7)
      }
    }
  }

  // Grain over everything: the paint's own texture and the grit in the mortar.
  const N = 160
  const nc = document.createElement('canvas')
  nc.width = nc.height = N
  const nx = nc.getContext('2d')!
  const img = nx.createImageData(N, N)
  for (let i = 0; i < N * N; i++) {
    const v = r()
    const k = v * 255
    img.data[i * 4] = k; img.data[i * 4 + 1] = k; img.data[i * 4 + 2] = k
    img.data[i * 4 + 3] = 34
  }
  nx.putImageData(img, 0, 0)
  g.globalCompositeOperation = 'overlay'
  const pat = g.createPattern(nc, 'repeat')!
  g.fillStyle = pat
  g.fillRect(0, 0, W, H)
  // A coarser mottling, so whole patches of paint read lighter or darker.
  g.globalCompositeOperation = 'soft-light'
  for (let i = 0; i < 70; i++) {
    const cx = r() * W, cy = r() * H, rad = 20 + r() * 70
    const m = g.createRadialGradient(cx, cy, 0, cx, cy, rad)
    const light = r() < 0.5
    m.addColorStop(0, light ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.14)')
    m.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = m
    // Drawn on every side of the tile too, so a patch at the edge wraps round.
    for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
      g.save(); g.translate(dx, dy); g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); g.restore()
    }
  }
  g.globalCompositeOperation = 'source-over'
  return cv
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rr: number) {
  g.beginPath()
  g.moveTo(x + rr, y)
  g.arcTo(x + w, y, x + w, y + h, rr)
  g.arcTo(x + w, y + h, x, y + h, rr)
  g.arcTo(x, y + h, x, y, rr)
  g.arcTo(x, y, x + w, y, rr)
  g.closePath()
}

/** Paint the wall over a whole W×H area (CSS px) of a context already scaled for dpr. */
export function wallCanvas(W: number, H: number, dpr: number): HTMLCanvasElement {
  const tile = brickTile(dpr)
  const cv = document.createElement('canvas')
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  const g = cv.getContext('2d')!
  const pat = g.createPattern(tile, 'repeat')!
  g.fillStyle = pat
  // Start the bond a little way in, so the board's edge does not fall on a joint.
  g.translate(-17 * dpr, -9 * dpr)
  g.fillRect(0, 0, cv.width + 17 * dpr, cv.height + 9 * dpr)
  return cv
}

/**
 * From Memory's pencil.
 *
 * It used to be a pen: a ribbon of solid ink that thinned when you hurried.
 * That was already a long way from a cursor trail, but it was still a line
 * laid *on top of* the paper. A pencil line is made *of* the paper. Graphite
 * is scraped off onto the tops of the paper's tiny bumps first and only
 * reaches the hollows when you press, so a light, quick line is grainy and
 * broken, a slow, heavy one is nearly solid, and both carry the grain of the
 * sheet under them. That grain is the thing the eye reads as "pencil".
 *
 * So each stroke is drawn twice. First as pressure: a soft ribbon whose
 * brightness is how hard the lead was pressing there, kept at its maximum
 * where the ribbon overlaps itself (a stroke never darkens itself just by
 * having two pieces meet). Then, a few pixels at a time as the pen moves, that
 * pressure is turned into graphite against the paper's relief (tooth.ts), the
 * very relief the sheet is lit from: a pixel takes graphite if the lead,
 * pressing that hard, reaches down to that bump. Crossing an earlier stroke
 * does darken, the way going over a pencil line does.
 *
 * Speed stands in for pressure on a mouse (a slow hand presses), and a real
 * stylus reports the real thing.
 *
 * Everything works in the reference space the answers are drawn in (200x140),
 * not in device pixels, so a stroke can be re-rendered at any size: the pad at
 * whatever the layout gives it, the gallery at thumbnail size, both from the
 * same numbers.
 */
import { tooth, toothScale, type Tooth } from './memo/tooth'
import { graphite } from './memo/graphite'

/** The coordinate space every stroke is stored in. Matches the answer SVGs. */
export const REF_W = 200
export const REF_H = 140

export type Pt = { x: number; y: number; w: number }
export type Stroke = Pt[]

/** HB graphite, fully laid down: a cool, dark grey, never black. */
export const GRAPHITE: [number, number, number] = [44, 47, 55]

/*
 * The weight of a sample, fast to slow. Stored as `w` on every point; the
 * pencil reads both its width and its pressure from it.
 */
const W_FAST = 0.55
const W_SLOW = 1.75

/** Speed, in reference units per millisecond, at which the lead is lightest. */
const V_FAST = 0.22

/**
 * Weight for a new sample.
 *
 * Smoothed against the previous width rather than taken raw: pointer timing is
 * noisy enough that the unfiltered value makes a stroke look corrugated.
 */
export function nibWidth(dist: number, dt: number, prev: number, pressure = 0) {
  const v = dt > 0 ? dist / dt : 0
  let w = W_SLOW + (W_FAST - W_SLOW) * Math.min(1, v / V_FAST)
  // A real stylus reports real pressure. A mouse reports exactly 0.5 for "held
  // down", which says nothing about the hand, so that value is not trusted.
  if (pressure > 0 && pressure !== 0.5) w *= 0.55 + pressure * 0.9
  return prev > 0 ? prev + (w - prev) * 0.35 : w
}

/** 0 at the lightest, quickest touch, 1 at the slowest and heaviest. */
const heft = (w: number) => Math.min(1, Math.max(0, (w - W_FAST) / (W_SLOW - W_FAST)))
/** A pencil's line hardly widens with pressure — it darkens. */
const radius = (w: number) => (0.68 + 0.5 * heft(w)) / 2
/** How hard the lead presses, 0..1. Never nothing: a moving pencil marks. */
const pressure = (w: number) => 0.56 + 0.44 * heft(w)

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: (a.w + b.w) / 2 })

/**
 * A drawing surface.
 *
 * Four bitmaps: the sheet of finished strokes, the pressure of the stroke
 * under the pen, the graphite that pressure has laid, and the canvas on
 * screen. Nothing is redrawn from scratch while drawing; only the few pixels
 * the newest piece of the stroke touched are turned from pressure into
 * graphite.
 */
export class InkSurface {
  private sheet: HTMLCanvasElement
  private sx: CanvasRenderingContext2D
  private press: HTMLCanvasElement
  private rx: CanvasRenderingContext2D
  private pen: HTMLCanvasElement
  private px: CanvasRenderingContext2D
  private vx: CanvasRenderingContext2D
  /** Device pixels per reference unit. */
  private s = 4
  /** The paper's relief, at the size this page is shown. */
  private relief: Tooth = tooth(1)
  /** Pixels touched since the last flush, and since the stroke began. */
  private dirty: [number, number, number, number] | null = null
  private stroke: [number, number, number, number] | null = null

  /**
   * @param fixed the caller has already set the backing store, and it must not
   *        be measured from the layout — an offscreen canvas has no box.
   */
  constructor(private view: HTMLCanvasElement, private fixed = false) {
    this.sheet = document.createElement('canvas')
    this.sx = this.sheet.getContext('2d')!
    this.press = document.createElement('canvas')
    this.rx = this.press.getContext('2d', { willReadFrequently: true })!
    this.pen = document.createElement('canvas')
    this.px = this.pen.getContext('2d')!
    this.vx = view.getContext('2d')!
    this.resize()
  }

  /** Device pixels per reference unit, for anything that needs to subdivide. */
  get scale() { return this.s }

  /**
   * Match the backing store to the element's real size, and report whether it
   * changed. Assigning canvas.width clears the bitmap, so a true here means
   * the caller has to replay.
   */
  resize() {
    let w: number, h: number
    if (this.fixed) {
      w = this.view.width
      h = this.view.height
    } else {
      const r = this.view.getBoundingClientRect()
      const dpr = Math.min(devicePixelRatio || 1, 2)
      w = Math.max(1, Math.round(r.width * dpr))
      h = Math.max(1, Math.round(r.height * dpr))
    }
    if (w === this.sheet.width && h === this.sheet.height) return false
    this.sheet.width = this.press.width = this.pen.width = this.view.width = w
    this.sheet.height = this.press.height = this.pen.height = this.view.height = h
    this.s = w / REF_W
    this.relief = tooth(toothScale(w))
    this.rx.fillStyle = '#000'
    this.rx.fillRect(0, 0, w, h)
    return true
  }

  clear() {
    this.sx.clearRect(0, 0, this.sheet.width, this.sheet.height)
    this.px.clearRect(0, 0, this.pen.width, this.pen.height)
    this.rx.globalCompositeOperation = 'source-over'
    this.rx.fillStyle = '#000'
    this.rx.fillRect(0, 0, this.press.width, this.press.height)
    this.dirty = this.stroke = null
  }

  /** Paint sheet and pen onto the visible canvas. */
  blit() {
    this.flush()
    const { view, vx } = this
    vx.clearRect(0, 0, view.width, view.height)
    vx.drawImage(this.sheet, 0, 0)
    vx.drawImage(this.pen, 0, 0)
  }

  private touch(x0: number, y0: number, x1: number, y1: number) {
    const grow = (b: [number, number, number, number] | null): [number, number, number, number] =>
      b ? [Math.min(b[0], x0), Math.min(b[1], y0), Math.max(b[2], x1), Math.max(b[3], y1)] : [x0, y0, x1, y1]
    this.dirty = grow(this.dirty)
    this.stroke = grow(this.stroke)
  }

  /** One disc of pressure: a soft fringe where only the side of the lead reaches, and the core. */
  private disc(x: number, y: number, r: number, p: number) {
    const g = this.rx
    g.fillStyle = grey(p * 0.42)
    g.beginPath(); g.arc(x, y, r * 1.45, 0, Math.PI * 2); g.fill()
    g.fillStyle = grey(p)
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
  }

  /**
   * Lay one straight piece of the stroke down as pressure.
   *
   * Filled, not stroked: a quad between the two widths plus a disc at the new
   * end, so the joins never notch. Drawn with 'lighten', which keeps the
   * greater of the two pressures wherever pieces overlap — a stroke's own
   * pieces must never stack up into darker beads.
   */
  segment(a: Pt, b: Pt) {
    const g = this.rx
    const s = this.s
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    const ra = radius(a.w) * s, rb = radius(b.w) * s
    const p = (pressure(a.w) + pressure(b.w)) / 2
    g.globalCompositeOperation = 'lighten'
    if (len > 1e-4) {
      const nx = -dy / len, ny = dx / len
      for (const [k, q] of [[1.45, p * 0.42], [1, p]] as const) {
        g.fillStyle = grey(q)
        g.beginPath()
        g.moveTo(a.x * s + nx * ra * k, a.y * s + ny * ra * k)
        g.lineTo(b.x * s + nx * rb * k, b.y * s + ny * rb * k)
        g.lineTo(b.x * s - nx * rb * k, b.y * s - ny * rb * k)
        g.lineTo(a.x * s - nx * ra * k, a.y * s - ny * ra * k)
        g.closePath()
        g.fill()
      }
    }
    this.disc(b.x * s, b.y * s, rb, pressure(b.w))
    g.globalCompositeOperation = 'source-over'
    const m = Math.max(ra, rb) * 1.5 + 2
    this.touch(Math.min(a.x, b.x) * s - m, Math.min(a.y, b.y) * s - m, Math.max(a.x, b.x) * s + m, Math.max(a.y, b.y) * s + m)
  }

  /** A stroke that never moved: the mark a pencil leaves just set down on paper. */
  dot(p: Pt) {
    const s = this.s, r = Math.max(radius(p.w) * 1.1, 0.3) * s
    this.rx.globalCompositeOperation = 'lighten'
    this.disc(p.x * s, p.y * s, r, pressure(p.w))
    this.rx.globalCompositeOperation = 'source-over'
    const m = r * 1.5 + 2
    this.touch(p.x * s - m, p.y * s - m, p.x * s + m, p.y * s + m)
  }

  /**
   * Turn the pressure laid since last time into graphite.
   *
   * A pixel takes graphite where the lead, pressing that hard, reaches down to
   * the paper there: the top fraction of the bumps, `reach` deep, with a soft
   * shoulder so the grain is not a hard stipple. Harder pressure also leaves
   * more graphite on each bump it touches.
   */
  private flush() {
    if (!this.dirty) return
    const W = this.press.width, H = this.press.height
    const x0 = Math.max(0, Math.floor(this.dirty[0])), y0 = Math.max(0, Math.floor(this.dirty[1]))
    const x1 = Math.min(W, Math.ceil(this.dirty[2])), y1 = Math.min(H, Math.ceil(this.dirty[3]))
    this.dirty = null
    const w = x1 - x0, h = y1 - y0
    if (w <= 0 || h <= 0) return
    const src = this.rx.getImageData(x0, y0, w, h).data
    const out = this.px.createImageData(w, h)
    const d = out.data
    const { size: S, h: T } = this.relief
    const [cr, cg, cb] = GRAPHITE
    for (let y = 0; y < h; y++) {
      const row = ((y0 + y) % S) * S
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const a = graphite(src[i] / 255, T[row + ((x0 + x) % S)])
        if (a <= 0) continue
        d[i] = cr; d[i + 1] = cg; d[i + 2] = cb
        d[i + 3] = a * 255
      }
    }
    this.px.putImageData(out, x0, y0)
  }

  /** Lift the pencil: the finished stroke joins the sheet. */
  commit() {
    this.flush()
    this.sx.drawImage(this.pen, 0, 0)
    const b = this.stroke
    if (b) {
      const x = Math.floor(b[0]) - 1, y = Math.floor(b[1]) - 1
      const w = Math.ceil(b[2] - b[0]) + 2, h = Math.ceil(b[3] - b[1]) + 2
      this.px.clearRect(x, y, w, h)
      this.rx.fillStyle = '#000'
      this.rx.fillRect(x, y, w, h)
    }
    this.stroke = this.dirty = null
  }

  /** Replay a whole list — after undo, clear, or a resize. */
  replay(strokes: Stroke[]) {
    this.clear()
    for (const st of strokes) {
      const nib = new Nib(this)
      for (const p of st) nib.push(p)
      nib.end()
      this.commit()
    }
  }
}

const grey = (p: number) => {
  const v = Math.round(Math.min(1, Math.max(0, p)) * 255)
  return `rgb(${v},${v},${v})`
}

/**
 * The lead itself: turns a stream of samples into a smooth ribbon.
 *
 * Each new sample closes a quadratic running from the midpoint of the previous
 * pair to the midpoint of this one, with the sample between them as the control
 * point. It is the standard trick for signature capture and it is worth the
 * three lines: the curve passes through the midpoints and only *near* the
 * samples, so pointer jitter is smoothed instead of drawn, and a fast stroke
 * that reported eight positions comes out as a curve rather than an octagon.
 *
 * Fully incremental — a sample only ever needs the two before it — so this
 * runs on the pointer event and never has to look at the rest of the stroke.
 */
export class Nib {
  private pts: Pt[] = []

  constructor(private ink: InkSurface) {}

  push(p: Pt) {
    const n = this.pts.length
    this.pts.push(p)
    if (n === 0) { this.ink.dot(p); return }
    // The opening piece runs from the very first sample, so the stroke starts
    // where the pen actually landed rather than half a sample later.
    if (n === 1) { this.ink.segment(this.pts[0], mid(this.pts[0], p)); return }
    this.curve(this.pts[n - 2], this.pts[n - 1], p)
  }

  /** And the closing piece, out to the last sample. */
  end() {
    const n = this.pts.length
    if (n >= 2) this.ink.segment(mid(this.pts[n - 2], this.pts[n - 1]), this.pts[n - 1])
  }

  private curve(a: Pt, b: Pt, c: Pt) {
    const m0 = mid(a, b), m1 = mid(b, c)
    // About three device pixels per piece: below that the subdivision costs
    // fill for nothing, above it the curve starts showing its own corners.
    const px = Math.hypot(m1.x - m0.x, m1.y - m0.y) * this.ink.scale
    const n = Math.max(2, Math.min(24, Math.round(px / 3)))
    let prev = m0
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t
      const q: Pt = {
        x: u * u * m0.x + 2 * u * t * b.x + t * t * m1.x,
        y: u * u * m0.y + 2 * u * t * b.y + t * t * m1.y,
        w: m0.w + (m1.w - m0.w) * t,
      }
      this.ink.segment(prev, q)
      prev = q
    }
  }
}

/**
 * Render strokes onto a fresh canvas at a chosen CSS width.
 *
 * The gallery keeps the drawings at thumbnail size. Rendering them from the
 * stroke list rather than scaling down the pad's bitmap is what keeps them
 * sharp, and it is only possible because strokes are stored in reference units.
 */
export function renderStrokes(strokes: Stroke[], cssWidth: number) {
  const c = document.createElement('canvas')
  const dpr = Math.min(devicePixelRatio || 1, 2)
  c.width = Math.round(cssWidth * dpr)
  c.height = Math.round((cssWidth * REF_H) / REF_W * dpr)
  const ink = new InkSurface(c, true)
  ink.replay(strokes)
  ink.blit()
  return c
}

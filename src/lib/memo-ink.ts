/**
 * From Memory's ink.
 *
 * The page asked you to draw a bicycle and then gave you a 5px round line of
 * constant width joining raw pointer samples with lineTo. That is a cursor
 * trail, not a pen: it has no weight, it does not thin when you move fast, and
 * every change of direction shows the polygon underneath, because samples
 * arrive a dozen pixels apart on a fast stroke.
 *
 * Three things a nib does that this did not. It varies with speed — ink has
 * time to spread when the hand slows and is dragged thin when it hurries. It
 * pools where strokes cross. And it curves: a pen has no way to produce a
 * corner that the hand did not make, whereas a polyline produces one at every
 * sample. All three are cheap, and on a page whose whole subject is your own
 * hand they are most of the difference between a drawing and a scribble.
 *
 * Everything works in the reference space the answers are drawn in (200x140),
 * not in device pixels, so a stroke can be re-rendered at any size: the pad at
 * whatever the layout gives it, the gallery at thumbnail size, both from the
 * same numbers. The old canvas had a backing store nailed to 800x560 whatever
 * the display did with it, so it was soft on a retina screen and wasteful on a
 * phone.
 */

/** The coordinate space every stroke is stored in. Matches the answer SVGs. */
export const REF_W = 200
export const REF_H = 140

export type Pt = { x: number; y: number; w: number }
export type Stroke = Pt[]

const INK = '42, 16, 38'          // #2a1026

/**
 * How hard the ink lands.
 *
 * Below 1 so that crossing your own line darkens it, which is what a wet pen
 * does and what makes a drawing look drawn. It cannot simply be the fill alpha:
 * the pieces of one stroke overlap each other, so painting them straight onto
 * the sheet at 0.93 would darken every join and turn a smooth curve into a
 * string of beads. The stroke under the pen is built opaque on a layer of its
 * own and composited once — see `commit`.
 */
const INK_ALPHA = 0.93

/*
 * Nib width in reference units, fast to slow.
 *
 * A real pen's range is wider than people expect — better than three to one —
 * and anything narrower reads as a constant line with a wobble in it.
 */
const W_FAST = 0.55
const W_SLOW = 1.75

/** Speed, in reference units per millisecond, at which the nib is fully thin. */
const V_FAST = 0.22

/**
 * Width for a new sample.
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

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: (a.w + b.w) / 2 })

/**
 * A drawing surface.
 *
 * Three bitmaps: the sheet of finished strokes, the stroke currently under the
 * pen, and the canvas on screen. Nothing is ever redrawn from scratch while
 * drawing — the page replayed every stroke on every pointermove, and pointer
 * events arrive faster than frames do.
 */
export class InkSurface {
  private sheet: HTMLCanvasElement
  private sx: CanvasRenderingContext2D
  private pen: HTMLCanvasElement
  private px: CanvasRenderingContext2D
  private vx: CanvasRenderingContext2D
  /** Device pixels per reference unit. */
  private s = 4

  /**
   * @param fixed the caller has already set the backing store, and it must not
   *        be measured from the layout — an offscreen canvas has no box.
   */
  constructor(private view: HTMLCanvasElement, private fixed = false) {
    this.sheet = document.createElement('canvas')
    this.sx = this.sheet.getContext('2d')!
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
    this.sheet.width = this.pen.width = this.view.width = w
    this.sheet.height = this.pen.height = this.view.height = h
    this.s = w / REF_W
    return true
  }

  clear() {
    this.sx.clearRect(0, 0, this.sheet.width, this.sheet.height)
    this.px.clearRect(0, 0, this.pen.width, this.pen.height)
  }

  /** Paint sheet and pen onto the visible canvas. */
  blit() {
    const { view, vx } = this
    vx.clearRect(0, 0, view.width, view.height)
    vx.drawImage(this.sheet, 0, 0)
    vx.globalAlpha = INK_ALPHA
    vx.drawImage(this.pen, 0, 0)
    vx.globalAlpha = 1
  }

  /**
   * Lay one straight piece of ribbon onto the stroke under the pen.
   *
   * Filled, not stroked: a quad between the two widths plus a disc at the new
   * end. The disc is what makes the joins invisible — a variable-width
   * polyline with round joins still shows a notch on the outside of every
   * corner, because the two half-widths do not match there.
   */
  segment(a: Pt, b: Pt) {
    const g = this.px
    const s = this.s
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    g.fillStyle = `rgb(${INK})`
    if (len > 1e-4) {
      const nx = (-dy / len) * s, ny = (dx / len) * s
      const ra = a.w / 2, rb = b.w / 2
      g.beginPath()
      g.moveTo(a.x * s + nx * ra, a.y * s + ny * ra)
      g.lineTo(b.x * s + nx * rb, b.y * s + ny * rb)
      g.lineTo(b.x * s - nx * rb, b.y * s - ny * rb)
      g.lineTo(a.x * s - nx * ra, a.y * s - ny * ra)
      g.closePath()
      g.fill()
    }
    g.beginPath()
    g.arc(b.x * s, b.y * s, Math.max(b.w / 2, 0.01) * s, 0, Math.PI * 2)
    g.fill()
  }

  /** A stroke that never moved: the mark a pen leaves just resting on paper. */
  dot(p: Pt) {
    const g = this.px
    g.fillStyle = `rgb(${INK})`
    g.beginPath()
    g.arc(p.x * this.s, p.y * this.s, Math.max(p.w * 0.62, 0.25) * this.s, 0, Math.PI * 2)
    g.fill()
  }

  /** Lift the pen: the finished stroke joins the sheet, once, at ink alpha. */
  commit() {
    this.sx.globalAlpha = INK_ALPHA
    this.sx.drawImage(this.pen, 0, 0)
    this.sx.globalAlpha = 1
    this.px.clearRect(0, 0, this.pen.width, this.pen.height)
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

/**
 * The pen itself: turns a stream of samples into a smooth ribbon.
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

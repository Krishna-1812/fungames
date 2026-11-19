/**
 * Who Was Alive — the map: where the people alive in a year were.
 *
 * The Earth at night, on its real coastline (Natural Earth 1:110m, the path
 * Every Second's map is drawn from), and a light for each person in the
 * record who was alive that year, at the town they were born in. If they
 * made their life in another country an arc runs from there to where they
 * made it, and the light is at the far end, where they did the thing they
 * are remembered for.
 *
 * The view frames whoever is alive: the Mediterranean and the Yellow River
 * in 300 BC, Europe in 1600, the whole world in 1950. It eases from one
 * frame to the next as the counter turns, so a century drawn with the wheel
 * is a camera moving across the world.
 *
 * On a phone the whole world does not fit across, so the view centres on
 * where most of them are, the map goes round, it can be dragged sideways,
 * and the people off either edge are counted at that edge.
 *
 * The land is the expensive part: a path of thousands of points, filled,
 * clipped and stroked eight times over. So it is drawn once into a picture
 * of the whole world, and while the view is moving each frame is that
 * picture, scaled; once the view settles it is drawn again from the path,
 * sharp, and kept until the view moves. The lights and names go on top of
 * whichever it is, every frame.
 *
 * Drawn with a 2D canvas and not a shader on purpose: the coastline is a
 * vector path, so it is sharp at any zoom, which a coastline texture is not
 * once the view is the size of Italy.
 */
import { LAND_PATH, MAP_W, MAP_H } from '../data/world'
import { fitView, toScreen, crowdOffset, nearLon, type View, type LatLon } from './who-places'

export type Light = {
  key: string
  name: string
  colour: string
  born: LatLon
  bornAt: string
  later?: LatLon
  laterAt?: string
  /** Where the light is: where they made their life, or where they were born. */
  at: LatLon
}

type Lit = Light & { a: number; target: number; x: number; y: number; bx: number; by: number; crowd: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Hex to [r, g, b]. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
/** A category colour brought up to be a light on a dark map: same hue, more of it. */
function glowOf(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex)
  const m = Math.max(r, g, b, 1)
  const k = 235 / m
  return [Math.min(255, r * k + 30), Math.min(255, g * k + 30), Math.min(255, b * k + 30)]
}

export class WhoMap {
  readonly canvas: HTMLCanvasElement
  private g: CanvasRenderingContext2D
  private land = new Path2D(LAND_PATH)
  private grain: CanvasPattern | null = null
  private w = 0
  private h = 0
  private dpr = 1
  private lights = new Map<string, Lit>()
  private view: View = { lon: 0, lat: 10, span: 136 }
  private from: View = this.view
  private to: View = this.view
  private t0 = 0
  private moving = false
  private raf = 0
  private labels: HTMLElement
  private labelPool: HTMLElement[] = []
  private edges: { left: HTMLButtonElement; right: HTMLButtonElement }
  private drag: { x: number; lon: number; moved: boolean } | null = null
  /** Where the page's own marks sit on the map, measured when the map changes size and not every frame. */
  private keepClear: { x0: number; y0: number; x1: number; y1: number }[] = []
  /** For sizing a label without asking the page to lay itself out. */
  private ruler = document.createElement('canvas').getContext('2d')!
  private labelFont = ''
  private labelH = 15
  /** The whole world's land, drawn once, for frames while the view moves. */
  private atlas: HTMLCanvasElement | null = null
  /** The sea and land for the view as it last settled, and which view that was. */
  private base = document.createElement('canvas')
  private baseKey = ''
  /** True while the camera is gliding or being dragged. */
  private gliding = false
  private reduce: boolean
  /** Called after each frame, with where the lights ended up. */
  onFrame?: () => void

  constructor(private host: HTMLElement, labels: HTMLElement, opts: { reduce?: boolean } = {}) {
    this.reduce = !!opts.reduce
    this.labels = labels
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'wm-canvas'
    this.canvas.setAttribute('aria-hidden', 'true')
    host.prepend(this.canvas)
    this.g = this.canvas.getContext('2d')!
    this.grain = this.makeGrain()
    const edge = (side: 'left' | 'right') => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `wm-edge wm-edge-${side}`
      b.hidden = true
      b.addEventListener('click', () => this.panTo(side))
      host.appendChild(b)
      return b
    }
    this.edges = { left: edge('left'), right: edge('right') }
    // Dragged sideways, the world turns under the view; up and down stays the page's.
    host.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.wm-edge')) return
      this.drag = { x: e.clientX, lon: this.view.lon, moved: false }
    })
    host.addEventListener('pointermove', (e) => {
      if (!this.drag) return
      const dx = e.clientX - this.drag.x
      if (!this.drag.moved && Math.abs(dx) < 6) return
      if (!this.drag.moved) { this.drag.moved = true; host.setPointerCapture(e.pointerId); host.classList.add('is-dragging') }
      const k = this.h / this.view.span
      this.view = this.from = this.to = { ...this.view, lon: this.drag.lon - dx / k }
      this.gliding = true
      if (!this.moving) this.draw()
    })
    const end = () => {
      const was = this.drag?.moved
      this.drag = null
      host.classList.remove('is-dragging')
      // Let go: drawn sharp again where it came to rest.
      if (was) { this.gliding = false; if (!this.moving) this.draw() }
    }
    host.addEventListener('pointerup', end)
    host.addEventListener('pointercancel', end)
    new ResizeObserver(() => this.resize()).observe(host)
    this.resize()
    // The world's picture takes a tenth of a second to make: made while nothing else is happening, not on the first turn of the wheel.
    const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback
    const make = () => { this.atlas ??= this.makeAtlas() }
    if (idle) idle(make, { timeout: 2500 }); else setTimeout(make, 1200)
  }

  /** Turn the world so the people off one edge come into the middle. */
  private panTo(side: 'left' | 'right') {
    const off = [...this.lights.values()].filter((l) => l.target > 0 && (side === 'left' ? l.x < 0 : l.x > this.w))
    if (!off.length) return
    const k = this.h / this.view.span
    let sum = 0
    for (const l of off) sum += l.x
    const lon = this.view.lon + (sum / off.length - this.w / 2) / k
    this.glide({ ...this.view, lon })
  }

  private glide(to: View) {
    this.from = { ...this.view }
    this.to = to
    this.t0 = performance.now()
    if (this.reduce) { this.view = this.from = this.to = to; this.draw(); return }
    if (!this.moving) { this.moving = true; this.raf = requestAnimationFrame(this.step) }
  }

  /** A fine speckle for the land, made once: ground is not a flat colour. */
  private makeGrain(): CanvasPattern | null {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const img = g.createImageData(128, 128)
    let s = 0x2545f491
    for (let i = 0; i < img.data.length; i += 4) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5
      const v = (s >>> 0) / 4294967296
      const lum = 110 + v * 60
      img.data[i] = lum * 0.86; img.data[i + 1] = lum * 0.93; img.data[i + 2] = lum
      img.data[i + 3] = 5 + v * 9
    }
    g.putImageData(img, 0, 0)
    return this.g.createPattern(c, 'repeat')
  }

  /* Sized from its own box, every time it changes. */
  private resize() {
    const r = this.host.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height))
    if (w === this.w && h === this.h && dpr === this.dpr) return
    this.w = w; this.h = h; this.dpr = dpr
    this.measureMarks()
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    // Re-framed for the new shape, at once.
    const target = this.frameFor()
    this.view = this.from = this.to = target
    this.draw()
  }

  /* The label font and the page's marks, read here, once a size: reading
     them in a frame forces the whole page to be laid out, and on a page this
     long that cost more than the drawing. */
  private measureMarks() {
    const probe = this.labelPool[0] ?? this.labels.appendChild(Object.assign(document.createElement('span'), { className: 'wm-label', textContent: 'Mg' }))
    this.labelPool[0] = probe
    const cs = getComputedStyle(probe)
    this.labelFont = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    this.labelH = probe.offsetHeight || 15
    const box = this.host.getBoundingClientRect()
    this.keepClear = [...this.host.querySelectorAll<HTMLElement>('[data-keep-clear]')].map((el) => {
      const r = el.getBoundingClientRect()
      return { x0: r.left - box.left - 6, y0: r.top - box.top - 4, x1: r.right - box.left + 6, y1: r.bottom - box.top + 4 }
    })
  }

  private frameFor(): View {
    const pts: LatLon[] = []
    for (const l of this.lights.values()) {
      if (l.target <= 0) continue
      pts.push(l.born)
      if (l.later) pts.push(l.later)
    }
    // Narrow maps get more room round the points: a phone is tall.
    const aspect = this.w / Math.max(1, this.h)
    return fitView(pts, aspect, aspect < 1.4 ? 36 : 30)
  }

  /** The people alive now. Lights not in the list fade out; new ones fade in; the view moves to hold them. */
  show(people: Light[]) {
    const keep = new Set(people.map((p) => p.key))
    for (const l of this.lights.values()) if (!keep.has(l.key)) l.target = 0
    for (const p of people) {
      const l = this.lights.get(p.key)
      if (l) l.target = 1
      else this.lights.set(p.key, { ...p, a: this.reduce ? 1 : 0, target: 1, x: 0, y: 0, bx: 0, by: 0, crowd: 1 })
    }
    const next = this.frameFor()
    if (this.reduce) for (const [k, l] of this.lights) { l.a = l.target; if (!l.target) this.lights.delete(k) }
    this.glide(next)
  }

  private step = (now: number) => {
    const t = Math.min(1, (now - this.t0) / 900)
    this.gliding = t < 1
    const e = ease(t)
    // Zoomed in the log of the span, so the camera moves at an even pace through scale.
    this.view = {
      // The short way round.
      lon: lerp(this.from.lon, nearLon(this.to.lon, this.from.lon), e),
      lat: lerp(this.from.lat, this.to.lat, e),
      span: Math.exp(lerp(Math.log(this.from.span), Math.log(this.to.span), e)),
    }
    let fading = false
    for (const [k, l] of this.lights) {
      const d = l.target - l.a
      if (Math.abs(d) > 0.01) { l.a += d * 0.16; fading = true }
      else { l.a = l.target; if (!l.target) this.lights.delete(k) }
    }
    this.draw()
    if (t < 1 || fading) this.raf = requestAnimationFrame(this.step)
    else this.moving = false
  }

  /** The person under a point on the canvas, in CSS pixels, if any. */
  hit(x: number, y: number): Lit | null {
    let best: Lit | null = null, bd = 16 * 16
    for (const l of this.lights.values()) {
      if (l.target <= 0) continue
      const d = (l.x - x) ** 2 + (l.y - y) ** 2
      if (d < bd) { bd = d; best = l }
    }
    return best
  }

  /** The world's land as one picture, `W` pixels across, equirectangular. */
  private makeAtlas(): HTMLCanvasElement {
    const W = (window.devicePixelRatio || 1) > 1.5 ? 4096 : 3200
    const c = document.createElement('canvas')
    c.width = W; c.height = W / 2
    const g = c.getContext('2d')!
    const s = W / MAP_W
    // Its strokes are sized for a view about eight pixels to the degree, the middle of the range.
    const css = (W / 360) / 8
    const at = () => g.setTransform(s, 0, 0, s, 0, 0)
    at()
    g.lineJoin = 'round'
    for (const [wid, a] of [[30, 0.03], [16, 0.045], [7, 0.07]] as const) {
      g.lineWidth = (wid * css) / s
      g.strokeStyle = `rgba(60,120,200,${a})`
      g.stroke(this.land)
    }
    const ground = g.createLinearGradient(0, 0, 0, MAP_H)
    ground.addColorStop(0, '#1b2330'); ground.addColorStop(0.45, '#151c27'); ground.addColorStop(1, '#10161f')
    g.fillStyle = ground
    g.fill(this.land)
    g.save()
    g.clip(this.land)
    for (const [wid, a] of [[12, 0.035], [5, 0.055], [2, 0.09]] as const) {
      g.lineWidth = (wid * css) / s
      g.strokeStyle = `rgba(150,180,230,${a})`
      g.stroke(this.land)
    }
    g.restore()
    g.lineWidth = (0.85 * css) / s
    g.strokeStyle = 'rgba(186,206,240,0.5)'
    g.stroke(this.land)
    return c
  }

  /** One copy of the world's land, `s` CSS pixels to a map unit, its corner at (tx, ty) device pixels. */
  private drawLand(g: CanvasRenderingContext2D, s: number, tx: number, ty: number) {
    const { dpr, w, h } = this
    const at = () => g.setTransform(dpr * s, 0, 0, dpr * s, tx, ty)
    const px = 1 / s // one CSS pixel, in map units
    g.save()
    at()
    // Shallow water off every coast: a few soft strokes outside the land.
    g.lineJoin = 'round'
    for (const [wid, a] of [[30, 0.03], [16, 0.045], [7, 0.07]] as const) {
      g.lineWidth = wid * px
      g.strokeStyle = `rgba(60,120,200,${a})`
      g.stroke(this.land)
    }
    const ground = g.createLinearGradient(0, 0, 0, MAP_H)
    ground.addColorStop(0, '#1b2330')
    ground.addColorStop(0.45, '#151c27')
    ground.addColorStop(1, '#10161f')
    g.fillStyle = ground
    g.fill(this.land)
    g.clip(this.land)
    if (this.grain) {
      g.save()
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = this.grain
      g.fillRect(0, 0, w, h)
      g.restore()
    }
    // The edge of the land catches a little light: a rim inside the coast.
    for (const [wid, a] of [[12, 0.035], [5, 0.055], [2, 0.09]] as const) {
      g.lineWidth = wid * px
      g.strokeStyle = `rgba(150,180,230,${a})`
      g.stroke(this.land)
    }
    g.restore()
    g.save()
    at()
    g.lineWidth = 0.85 * px
    g.strokeStyle = 'rgba(186,206,240,0.5)'
    g.stroke(this.land)
    g.restore()
  }

  /** Sea, lines and land for a view, onto `g`: from the path if `sharp`, from the atlas if not. */
  private drawBase(g: CanvasRenderingContext2D, v: View, sharp: boolean) {
    const { w, h, dpr } = this
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1
    const k = h / v.span

    /* ---- the sea ---- */
    const sea = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75)
    sea.addColorStop(0, '#0a1830')
    sea.addColorStop(0.6, '#061124')
    sea.addColorStop(1, '#030813')
    g.fillStyle = sea
    g.fillRect(0, 0, w, h)

    /* ---- the lines of latitude and longitude ---- */
    g.lineWidth = 1
    const step = v.span > 70 ? 30 : 15
    g.strokeStyle = 'rgba(120,150,210,0.07)'
    g.beginPath()
    const west = v.lon - (w / 2) / k, east = v.lon + (w / 2) / k
    for (let lo = Math.ceil(west / step) * step; lo <= east; lo += step) {
      const x = Math.round(w / 2 + (lo - v.lon) * k) + 0.5
      g.moveTo(x, 0); g.lineTo(x, h)
    }
    const south = v.lat - (h / 2) / k, north = v.lat + (h / 2) / k
    for (let la = Math.ceil(south / step) * step; la <= north; la += step) {
      const y = Math.round(h / 2 - (la - v.lat) * k) + 0.5
      g.moveTo(0, y); g.lineTo(w, y)
    }
    g.stroke()
    // The equator, a touch stronger.
    if (south < 0 && north > 0) {
      g.strokeStyle = 'rgba(120,150,210,0.13)'
      g.beginPath()
      const y = Math.round(h / 2 + v.lat * k) + 0.5
      g.moveTo(0, y); g.lineTo(w, y)
      g.stroke()
    }

    /* ---- the land ---- */
    const s = (360 / MAP_W) * k
    // The world goes round: as many copies of it as the view can see.
    const copies: number[] = []
    for (let c = -1; c <= 1; c++) {
      const x0 = w / 2 + (-180 + 360 * c - v.lon) * k
      if (x0 < w && x0 + 360 * k > 0) copies.push(c)
    }
    if (sharp) {
      for (const c of copies) this.drawLand(g, s, dpr * (w / 2 - (180 - 360 * c + v.lon) * k), dpr * (h / 2 - (90 - v.lat) * k))
    } else {
      this.atlas ??= this.makeAtlas()
      g.imageSmoothingEnabled = true
      g.imageSmoothingQuality = 'high'
      for (const c of copies) g.drawImage(this.atlas, w / 2 + (-180 + 360 * c - v.lon) * k, h / 2 - (90 - v.lat) * k, 360 * k, 180 * k)
    }
  }

  private draw() {
    const { g, w, h, dpr, view: v } = this
    if (!w || !h) return
    const k = h / v.span
    if (this.gliding) this.drawBase(g, v, false)
    else {
      const key = `${v.lon.toFixed(4)}|${v.lat.toFixed(4)}|${v.span.toFixed(4)}|${w}|${h}|${dpr}`
      if (key !== this.baseKey) {
        if (this.base.width !== this.canvas.width || this.base.height !== this.canvas.height) {
          this.base.width = this.canvas.width; this.base.height = this.canvas.height
        }
        this.drawBase(this.base.getContext('2d')!, v, true)
        this.baseKey = key
      }
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalCompositeOperation = 'copy'
      g.drawImage(this.base, 0, 0)
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1

    /* ---- where each light is, a crowd spread a little round its place ---- */
    const groups = new Map<string, Lit[]>()
    for (const l of this.lights.values()) {
      const key = `${l.at[0].toFixed(1)},${l.at[1].toFixed(1)}`
      const list = groups.get(key)
      if (list) list.push(l); else groups.set(key, [l])
    }
    const gap = Math.max(7, Math.min(11, k * 0.5))
    for (const list of groups.values()) {
      list.sort((a, b) => a.key.localeCompare(b.key))
      list.forEach((l, i) => {
        const [x, y] = toScreen(v, w, h, l.at[0], l.at[1])
        const [ox, oy] = crowdOffset(i, gap)
        l.x = x + ox; l.y = y + oy
        l.crowd = list.length
        l.bx = x + (nearLon(l.born[1], l.at[1]) - l.at[1]) * k
        l.by = h / 2 - (l.born[0] - v.lat) * k
      })
    }

    /* ---- journeys: from where they were born to where they made their life ---- */
    g.lineCap = 'round'
    for (const l of this.lights.values()) {
      if (!l.later || l.a <= 0.01) continue
      const dx = l.x - l.bx, dy = l.y - l.by
      const d = Math.hypot(dx, dy)
      if (d < 4) continue
      // Lifted to one side, as a path over a curved world would look.
      const cx = (l.x + l.bx) / 2 - dy * 0.22 * Math.sign(dx || 1), cy = (l.y + l.by) / 2 - Math.abs(dx) * 0.22 - d * 0.04
      const [r, gg, b] = glowOf(l.colour)
      const grad = g.createLinearGradient(l.bx, l.by, l.x, l.y)
      grad.addColorStop(0, `rgba(${r},${gg},${b},${0.08 * l.a})`)
      grad.addColorStop(1, `rgba(${r},${gg},${b},${0.75 * l.a})`)
      g.strokeStyle = grad
      g.lineWidth = 1.4
      g.setLineDash([2.5, 3.5])
      g.beginPath(); g.moveTo(l.bx, l.by); g.quadraticCurveTo(cx, cy, l.x, l.y); g.stroke()
      g.setLineDash([])
      // Where they started: a small open ring.
      g.strokeStyle = `rgba(${r},${gg},${b},${0.55 * l.a})`
      g.lineWidth = 1
      g.beginPath(); g.arc(l.bx, l.by, 2.6, 0, Math.PI * 2); g.stroke()
    }

    /* ---- the lights ---- */
    g.globalCompositeOperation = 'lighter'
    for (const l of this.lights.values()) {
      if (l.a <= 0.01) continue
      const [r, gg, b] = glowOf(l.colour)
      const R = 46
      const q = l.a / Math.sqrt(l.crowd || 1)
      const halo = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, R)
      halo.addColorStop(0, `rgba(${r},${gg},${b},${0.55 * q})`)
      halo.addColorStop(0.12, `rgba(${r},${gg},${b},${0.26 * q})`)
      halo.addColorStop(0.4, `rgba(${r},${gg},${b},${0.06 * q})`)
      halo.addColorStop(1, `rgba(${r},${gg},${b},0)`)
      g.fillStyle = halo
      g.beginPath(); g.arc(l.x, l.y, R, 0, Math.PI * 2); g.fill()
    }
    g.globalCompositeOperation = 'source-over'
    for (const l of this.lights.values()) {
      if (l.a <= 0.01) continue
      const [r, gg, b] = glowOf(l.colour)
      g.globalAlpha = l.a
      g.fillStyle = `rgb(${r},${gg},${b})`
      g.beginPath(); g.arc(l.x, l.y, 3.6, 0, Math.PI * 2); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.95)'
      g.beginPath(); g.arc(l.x, l.y, 1.7, 0, Math.PI * 2); g.fill()
    }
    g.globalAlpha = 1

    /* ---- a vignette, so the edge of the map is not the edge of a picture ---- */
    const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.72)
    vig.addColorStop(0, 'rgba(2,5,12,0)')
    vig.addColorStop(1, 'rgba(2,5,12,0.55)')
    g.fillStyle = vig
    g.fillRect(0, 0, w, h)

    this.placeLabels()
    this.onFrame?.()
  }

  /**
   * The names, as text over the canvas: one label to a place, listing who is
   * there, and moved out of each other's way. A label that cannot find room
   * is folded into its nearest neighbour's "and n more" rather than drawn on
   * top of it.
   */
  private placeLabels() {
    // Off either edge: counted there, not labelled.
    const live = [...this.lights.values()].filter((l) => l.target > 0)
    const offL = live.filter((l) => l.x < -4), offR = live.filter((l) => l.x > this.w + 4)
    const say = (b: HTMLButtonElement, list: Lit[], arrow: string) => {
      b.hidden = !list.length
      if (!list.length) return
      b.textContent = arrow === '‹' ? `‹ ${list.length}` : `${list.length} ›`
      const names = list.map((l) => l.name).join(', ')
      b.title = names
      b.setAttribute('aria-label', `${list.length} more off this edge: ${names}. Turn the map to them.`)
    }
    say(this.edges.left, offL, '‹')
    say(this.edges.right, offR, '›')
    const shown = [...this.lights.values()].filter((l) => l.a > 0.05 && l.target > 0 && l.x > -4 && l.x < this.w + 4)
    // Gathered by where they are on the screen, not by name of place: two towns ten pixels apart are one label.
    const clusters: { x: number; y: number; who: Lit[] }[] = []
    const near = Math.max(26, Math.min(44, this.w / 26))
    for (const l of shown.sort((a, b) => a.x - b.x)) {
      const c = clusters.find((c) => Math.hypot(c.x - l.x, c.y - l.y) < near)
      if (c) { c.who.push(l); c.x = (c.x * (c.who.length - 1) + l.x) / c.who.length; c.y = (c.y * (c.who.length - 1) + l.y) / c.who.length }
      else clusters.push({ x: l.x, y: l.y, who: [l] })
    }
    // Biggest first, so a crowd gets its pick of the room.
    clusters.sort((a, b) => b.who.length - a.who.length)
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = []
    const narrow = this.w < 520
    const max = narrow ? 2 : 3
    /* Written, then measured, then placed: three passes, so the page is laid
       out once a frame and not once for every label. Measuring each label
       straight after writing it cost more than drawing the whole map. */
    this.ruler.font = this.labelFont
    // The dots themselves are not to be written over, nor anything the page marks to keep clear.
    for (const l of shown) placed.push({ x0: l.x - 5, y0: l.y - 5, x1: l.x + 5, y1: l.y + 5 })
    placed.push(...this.keepClear)
    // The edge counts, where they are showing: they sit at the middle of each side.
    for (const [b, side] of [[this.edges.left, 0], [this.edges.right, 1]] as const) {
      if (b.hidden) continue
      const x0 = side ? this.w - 74 : 0
      placed.push({ x0, y0: this.h / 2 - 28, x1: x0 + 74, y1: this.h / 2 + 28 })
    }
    /* Measured on a canvas, not by the page, so a frame never makes the page
       lay itself out. A label that will not fit anywhere is tried shorter:
       first with fewer names and "+n", then as one name and "+n", then not
       at all; pointing at a light still names it. */
    const fits = (x: number, y: number, bw: number, bh: number) => {
      if (x < 4 || y < 4 || x + bw > this.w - 4 || y + bh > this.h - 4) return null
      const r = { x0: x - 3, y0: y - 2, x1: x + bw + 3, y1: y + bh + 2 }
      return placed.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0) ? null : r
    }
    let used = 0
    for (const c of clusters) {
      const names = c.who.map((l) => l.name.replace(/ \(.*\)$/, ''))
      const left = Math.min(...c.who.map((l) => l.x)), right = Math.max(...c.who.map((l) => l.x))
      const top = Math.min(...c.who.map((l) => l.y)), bottom = Math.max(...c.who.map((l) => l.y))
      const bh = this.labelH
      let chosen: { head: string; more: string; x: number; y: number } | null = null
      for (const keep of [...new Set([Math.min(max, names.length), 1])]) {
        const head = names.slice(0, keep).join(', '), more = names.length > keep ? ` +${names.length - keep}` : ''
        const bw = Math.ceil(this.ruler.measureText(head + more).width) + 2
        const tries: [number, number][] = [
          [right + 12, c.y - bh / 2], [left - 12 - bw, c.y - bh / 2],
          [c.x - bw / 2, top - 12 - bh], [c.x - bw / 2, bottom + 12],
          [right + 12, top - bh - 2], [left - 12 - bw, bottom + 2],
          [right + 12, bottom + 2], [left - 12 - bw, top - bh - 2],
          [c.x - bw / 2, top - 26 - bh], [c.x - bw / 2, bottom + 26],
        ]
        for (const [x, y] of tries) {
          const r = fits(x, y, bw, bh)
          if (r) { placed.push(r); chosen = { head, more, x, y }; break }
        }
        if (chosen) break
      }
      // No room even for one name: left unnamed here.
      if (!chosen) continue
      const el = this.labelPool[used] ?? this.labels.appendChild(Object.assign(document.createElement('span'), { className: 'wm-label' }))
      this.labelPool[used++] = el
      el.textContent = chosen.head
      if (chosen.more) el.insertAdjacentHTML('beforeend', `<i>${chosen.more}</i>`)
      el.style.opacity = String(Math.min(...c.who.map((l) => l.a)))
      el.style.transform = `translate(${chosen.x.toFixed(1)}px, ${chosen.y.toFixed(1)}px)`
      el.hidden = false
    }
    for (let k = used; k < this.labelPool.length; k++) this.labelPool[k].hidden = true
  }
}

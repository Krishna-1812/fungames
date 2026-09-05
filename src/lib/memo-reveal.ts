/**
 * From Memory's reveal.
 *
 * The whole payload of this game is the second you find out how wrong you
 * were. The page delivered it by setting `hidden = false` on an SVG and fading
 * it in over 380ms: the correct answer simply materialised on top of your
 * drawing, all at once, and the moment went past before you had read it.
 *
 * Here it is drawn. Stroke by stroke, in the order the shape is built, at a
 * speed roughly matched to the length of each line — so a bicycle's wheels go
 * round before the frame arrives to join them, and you get to watch the
 * distance between what you drew and what is actually there open up.
 *
 * The timing is bounded, not per-element: the whole thing takes TOTAL_MS
 * however many lines the answer has, because eight objects each pausing for a
 * different length of time would be an inconsistency you would feel without
 * being able to name.
 */

const TOTAL_MS = 1500
/** Nothing takes less than this, or a short tick just blinks. */
const MIN_MS = 110

type Part = {
  el: SVGGeometryElement
  len: number
  /** Dashed already (a guide line, a filament) or a filled dot: fade instead. */
  fade: boolean
  start: number
  dur: number
}

export class Reveal {
  private parts: Part[] = []
  private raf = 0
  private t0 = 0

  constructor(private svg: SVGSVGElement) {}

  /** Put the answer on the sheet. `instant` skips straight to the finished state. */
  play(markup: string, instant: boolean) {
    this.stop()
    this.svg.innerHTML = markup

    const els = [...this.svg.querySelectorAll<SVGGeometryElement>('path, circle, line, polyline')]
    this.parts = els.map((el) => {
      /* A dash pattern already on the element is part of the drawing — the
         Big Dipper's guide line, the filament in the bulb. Animating dashoffset
         on top of it would march the existing dashes along the path, which
         reads as a barber's pole rather than as a line being drawn. */
      const dashed = !!el.getAttribute('stroke-dasharray')
      const filled = (el.getAttribute('fill') ?? 'none') !== 'none'
      let len = 0
      try { len = el.getTotalLength() } catch { len = 0 }
      return { el, len: len || 1, fade: dashed || filled, start: 0, dur: 0 }
    })

    // Time shared out by length, so a long curve takes longer than a tick mark
    // but the total is fixed. Fades are given a nominal share of their own.
    const weight = (p: Part) => (p.fade ? 24 : p.len)
    const total = this.parts.reduce((a, p) => a + weight(p), 0) || 1
    let at = 0
    for (const p of this.parts) {
      p.dur = Math.max(MIN_MS, (weight(p) / total) * TOTAL_MS)
      p.start = at
      // Overlapped by a third: strictly sequential reads as a machine plotting,
      // and a hand has already started the next line before it finishes one.
      at += p.dur * 0.68
    }

    for (const p of this.parts) this.set(p, instant ? 1 : 0)
    if (instant) return

    this.t0 = performance.now()
    const step = (now: number) => {
      const t = now - this.t0
      let done = true
      for (const p of this.parts) {
        const u = Math.min(1, Math.max(0, (t - p.start) / p.dur))
        this.set(p, u)
        if (u < 1) done = false
      }
      if (done) { this.raf = 0; return }
      this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  private set(p: Part, u: number) {
    if (p.fade) {
      p.el.style.opacity = String(u)
      return
    }
    if (u >= 1) {
      // Cleared rather than left at "dasharray: L, dashoffset: 0". A dash
      // pattern exactly as long as the path still renders a hairline seam at
      // the join on some engines.
      p.el.style.strokeDasharray = ''
      p.el.style.strokeDashoffset = ''
      p.el.style.opacity = ''
      return
    }
    // Eased out: a pen decelerates into the end of a line.
    const e = 1 - Math.pow(1 - u, 2.2)
    p.el.style.strokeDasharray = String(p.len)
    p.el.style.strokeDashoffset = String(p.len * (1 - e))
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.parts = []
  }
}

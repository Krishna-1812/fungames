/**
 * Turning the page.
 *
 * The sketchbook is bound at the top, so a finished page goes up and over the
 * wire: its free edge lifts first, the sheet bends (paper is not a board, and
 * the edge you are lifting it by always leads), it stands on end, and then it
 * goes over the wire and down behind the book, its back to you for a moment,
 * your drawing showing faintly through it the wrong way up. Underneath, the
 * next page is already
 * there, in the shadow of the one going over.
 *
 * Built from a picture of the page taken just before it turns (the paper and
 * the pencil, flattened into one canvas, and a copy of the tracing laid over
 * it), cut into two strips hinged together so the sheet can bend, and turned
 * in 3D about the binding. Thrown away when it has gone over.
 */

type Opts = {
  /** Where the tracing sits on the page, if there is one to take with it. */
  trace?: HTMLElement | null
  /** The pad canvas and where it sits, and the paper under it. */
  paper: HTMLCanvasElement
  pad: HTMLCanvasElement
}

/** The two strips, top (at the binding) and the rest, as fractions of the page. */
const HINGE = 0.46

function slice(src: HTMLCanvasElement, y0: number, y1: number, flip: boolean) {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = Math.max(1, Math.round((y1 - y0) * src.height))
  const g = c.getContext('2d')!
  if (flip) { g.translate(0, c.height); g.scale(1, -1) }
  g.drawImage(src, 0, Math.round(y0 * src.height), src.width, c.height, 0, 0, c.width, c.height)
  return c
}

/**
 * Lift the current page off and turn it over the binding.
 * Call before the page is cleared; the returned function starts the turn
 * once the new page is in place, and resolves when the old one has gone.
 */
export function takeLeaf(page: HTMLElement, o: Opts) {
  const book = page.parentElement!
  const r = page.getBoundingClientRect()
  const pr = o.pad.getBoundingClientRect()
  const W = o.paper.width, H = o.paper.height
  const sx = W / r.width, sy = H / r.height

  // The page as it is: paper, then pencil where the pad is.
  const flat = document.createElement('canvas')
  flat.width = W; flat.height = H
  const g = flat.getContext('2d')!
  g.drawImage(o.paper, 0, 0)
  g.drawImage(o.pad, (pr.left - r.left) * sx, (pr.top - r.top) * sy, pr.width * sx, pr.height * sy)

  // The tracing, copied as it lies, its frosting baked to a flat milk because
  // a backdrop filter has nothing sensible to sample on a sheet in mid-air.
  let traceAt: { left: number; top: number; width: number; height: number } | null = null
  let traceCopy: HTMLElement | null = null
  if (o.trace && !o.trace.hidden) {
    const tr = o.trace.getBoundingClientRect()
    traceAt = { left: tr.left - r.left, top: tr.top - r.top, width: tr.width, height: tr.height }
    traceCopy = o.trace.cloneNode(true) as HTMLElement
    traceCopy.removeAttribute('id')
    traceCopy.querySelector('svg')?.removeAttribute('id')
  }

  const leaf = document.createElement('div')
  leaf.className = 'fm-leaf'
  leaf.setAttribute('aria-hidden', 'true')
  leaf.style.width = `${r.width}px`
  leaf.style.height = `${r.height}px`

  const strip = (y0: number, y1: number) => {
    const s = document.createElement('div')
    s.className = 'fm-leaf-strip'
    s.style.height = `${(y1 - y0) * r.height}px`
    const front = document.createElement('div')
    front.className = 'fm-leaf-face'
    const fc = slice(flat, y0, y1, false)
    front.append(fc)
    if (traceCopy && traceAt) {
      const t = traceCopy.cloneNode(true) as HTMLElement
      Object.assign(t.style, { left: `${traceAt.left}px`, top: `${traceAt.top - y0 * r.height}px`, width: `${traceAt.width}px`, height: `${traceAt.height}px`, right: 'auto', bottom: 'auto' })
      front.append(t)
    }
    const shade = document.createElement('i')
    shade.className = 'fm-leaf-shade'
    front.append(shade)
    // The back: the same sheet from behind, the drawing a ghost through it.
    const back = document.createElement('div')
    back.className = 'fm-leaf-face fm-leaf-back'
    back.append(slice(flat, y0, y1, true))
    s.append(front, back)
    return { s, shade }
  }
  const top = strip(0, HINGE), rest = strip(HINGE, 1)
  rest.s.classList.add('fm-leaf-rest')
  top.s.append(rest.s)
  leaf.append(top.s)

  return function turn(): Promise<void> {
    book.append(leaf)
    // The shadow the lifting sheet throws on the new page under it.
    const shadow = document.createElement('i')
    shadow.className = 'fm-leaf-shadow'
    book.append(shadow)
    const ms = 1000
    const ease = 'cubic-bezier(.45,.05,.35,1)'
    // Up and over the binding.
    const a = top.s.animate([
      { transform: 'rotateX(0deg)' },
      { transform: 'rotateX(14deg)', offset: 0.18 },
      { transform: 'rotateX(96deg)', offset: 0.56 },
      { transform: 'rotateX(150deg)' },
    ], { duration: ms, easing: ease, fill: 'forwards' })
    // The free edge lifts first and the sheet bends, then straightens as it
    // goes over and drops behind.
    rest.s.animate([
      { transform: 'rotateX(0deg)' },
      { transform: 'rotateX(34deg)', offset: 0.22 },
      { transform: 'rotateX(22deg)', offset: 0.5 },
      { transform: 'rotateX(-12deg)', offset: 0.8 },
      { transform: 'rotateX(0deg)' },
    ], { duration: ms, easing: ease, fill: 'forwards' })
    // Turning away from the window, each face darkens.
    for (const { shade } of [top, rest]) shade.animate(
      [{ opacity: 0 }, { opacity: 0.32, offset: 0.5 }, { opacity: 0.1 }],
      { duration: ms, easing: 'linear', fill: 'forwards' },
    )
    // Past upright it is going over the wire and down behind the book, out of sight.
    leaf.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.72 }, { opacity: 0 }], { duration: ms, fill: 'forwards' })
    shadow.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: ms * 0.8, easing: 'ease-out', fill: 'forwards' })
    return a.finished.then(() => {}, () => {}).finally(() => { leaf.remove(); shadow.remove() })
  }
}

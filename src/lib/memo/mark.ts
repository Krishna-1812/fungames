/**
 * The mark: your likeness, written on the tracing in blue pencil and ringed,
 * the way a drawing comes back marked.
 *
 * It goes in whichever corner of the sheet is emptiest, so it never sits on
 * your drawing or on the answer, and it avoids the top corners if it can,
 * because that is where the tape is. The number is written first, left to
 * right, then the ring goes round it in one loose loop that overshoots where
 * it started, as a ring drawn at speed does.
 */
import type { P } from '../memo-score'

const SVGNS = 'http://www.w3.org/2000/svg'

/** Where the mark can go, in the 200 by 140 page, best first when all are clear. */
const CORNERS = [
  { x: 164, y: 114, top: false },
  { x: 36, y: 114, top: false },
  { x: 164, y: 31, top: true },
  { x: 36, y: 31, top: true },
]

/** The corner with the least drawn there, yours or the answer's. */
export function emptiestCorner(points: P[]) {
  let best = CORNERS[0], least = Infinity
  for (const c of CORNERS) {
    let n = c.top ? 8 : 0
    for (const p of points) if (Math.abs(p.x - c.x) < 30 && Math.abs(p.y - c.y) < 21) n++
    if (n < least) { least = n; best = c }
  }
  return best
}

/** A loose hand-drawn ring, starting at the upper left and running a little past itself. */
function ring(cx: number, cy: number, rx: number, ry: number) {
  const pts: string[] = []
  const a0 = -2.4, turn = Math.PI * 2 * 1.1
  for (let k = 0; k <= 48; k++) {
    const t = k / 48, a = a0 + turn * t
    // Wider as it goes round, and a little lumpy: a hand, not a compass.
    const grow = 1 + 0.07 * t + 0.03 * Math.sin(a * 3 + 1)
    pts.push(`${(cx + Math.cos(a) * rx * grow).toFixed(2)} ${(cy + Math.sin(a) * ry * grow).toFixed(2)}`)
  }
  return `M${pts.join(' L')}`
}

type Opts = {
  score: number
  word: string
  at: { x: number; y: number }
  animate: boolean
  /** The pencil moving (true) and lifting (false), for its sound. */
  onScribble?: (on: boolean) => void
}

/** The mark's inside, as markup: the same for the sheet and the gallery. */
export function markMarkup(score: number, word: string, at: { x: number; y: number }) {
  return `
    <filter id="fmGrain" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="12" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.8 -0.5" result="a"/>
      <feComposite in="SourceGraphic" in2="a" operator="arithmetic" k1="0.5" k2="0.55" k3="0" k4="0"/>
    </filter>
    <g filter="url(#fmGrain)">
      <text class="fm-mark-num" x="${at.x}" y="${at.y + 3}" text-anchor="middle">${score}%</text>
      <text class="fm-mark-word" x="${at.x + 2}" y="${at.y + 15}" text-anchor="middle" font-size="${Math.min(9, 100 / word.length).toFixed(2)}">${word}</text>
      <path class="fm-mark-ring" d="${ring(at.x, at.y - 2, 20, 11.5)}"/>
    </g>`
}

/** The mark as a whole group, tilted the way a hand writes across a page. */
export function markGroup(score: number, word: string, at: { x: number; y: number }) {
  return `<g class="fm-mark" transform="rotate(-6 ${at.x} ${at.y})">${markMarkup(score, word, at)}</g>`
}

/** Write the mark into the tracing's SVG. */
export function writeMark(svg: SVGSVGElement, o: Opts) {
  const g = document.createElementNS(SVGNS, 'g')
  g.setAttribute('class', 'fm-mark')
  g.setAttribute('transform', `rotate(-6 ${o.at.x} ${o.at.y})`)
  g.innerHTML = markMarkup(o.score, o.word, o.at)
  svg.append(g)
  const num = g.querySelector<SVGTextElement>('.fm-mark-num')!
  const word = g.querySelector<SVGTextElement>('.fm-mark-word')!
  const loop = g.querySelector<SVGPathElement>('.fm-mark-ring')!
  if (!o.animate) return
  const len = loop.getTotalLength()
  loop.style.strokeDasharray = String(len)
  const write = (el: Element, delay: number, ms: number) => el.animate(
    [{ clipPath: 'inset(-30% 100% -30% -10%)' }, { clipPath: 'inset(-30% -10% -30% -10%)' }],
    { duration: ms, delay, easing: 'cubic-bezier(.4,.1,.5,1)', fill: 'backwards' },
  )
  o.onScribble?.(true)
  write(num, 0, 380)
  const ringAnim = loop.animate(
    [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
    { duration: 420, delay: 420, easing: 'cubic-bezier(.5,.05,.4,1)', fill: 'backwards' },
  )
  write(word, 880, 360).finished.then(() => o.onScribble?.(false), () => o.onScribble?.(false))
  ringAnim.finished.then(() => { loop.style.strokeDasharray = '' }, () => {})
}

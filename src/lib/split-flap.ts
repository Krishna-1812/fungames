/**
 * A split-flap counter, the mechanical kind on old station boards and on the
 * best "days since" signs: each digit is a drum of hinged cards, and to move
 * on one card is let go and falls.
 *
 * The fall is worked out, not keyframed. A card is a thin plate hinged along
 * its bottom edge, so once the catch lets it past upright, gravity pulls it
 * over with an angular acceleration of 3g/2L · sin θ (a uniform plate
 * swinging from one edge): slow at first, fast at the end. It strikes the
 * stack below, bounces back a little, and settles. With the module's 24 mm
 * cards that is about 150 ms down and 280 ms to rest, the clack-clack a real
 * board makes.
 *
 * A digit going from 3 to 7 turns through 4, 5 and 6 on the way, as a drum
 * must; the page asks for at most a drum's worth at once.
 */

/* -------------------------------------------------------------------------- */
/* The fall                                                                     */
/* -------------------------------------------------------------------------- */

const G = 9.81
/** The card, hinge to free edge, in metres. */
export const CARD_M = 0.024
/** A uniform plate hinged at one edge: α = (3g / 2L) sin θ. */
const K = (3 * G) / (2 * CARD_M)
/** How much of its speed a card keeps when it strikes the stack. */
export const RESTITUTION = 0.28
/** Where the catch lets go, and the push the drum gives it there. */
const RELEASE = 0.09, PUSH = 5.5

export type Fall = { theta: number; omega: number; t: number; hits: number; done: boolean }
export const startFall = (): Fall => ({ theta: RELEASE, omega: PUSH, t: 0, hits: 0, done: false })

/**
 * Advance a falling card by dt seconds, in small steps. θ runs from 0
 * (upright, showing the old top half) to π (down, showing the new bottom
 * half); past π it has struck the stack.
 */
export function stepFall(f: Fall, dt: number): Fall {
  let { theta, omega, t, hits, done } = f
  const n = Math.max(1, Math.ceil(dt / 0.0005))
  const h = dt / n
  for (let i = 0; i < n && !done; i++) {
    // Gravity, and a little air and hinge friction.
    omega += (K * Math.sin(theta) - 6 * omega) * h
    theta += omega * h
    if (theta >= Math.PI) {
      theta = Math.PI - (theta - Math.PI)
      omega = -omega * RESTITUTION
      hits++
      if (Math.abs(omega) < 3 || hits >= 4) { theta = Math.PI; omega = 0; done = true }
    }
    t += h
  }
  return { theta, omega, t, hits, done }
}

/* -------------------------------------------------------------------------- */
/* The board                                                                    */
/* -------------------------------------------------------------------------- */

/** The cards on a drum, in the order it turns: 9 is followed by 0. */
export const DRUM = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

/**
 * The cards a drum turns through to get from one to another, excluding where
 * it starts. A blank drum being set turns up from 0; blanking one is a single
 * card.
 */
export function cardsBetween(from: string, to: string): string[] {
  if (from === to) return []
  if (to === ' ' || !DRUM.includes(to as never)) return [' ']
  let i = from === ' ' || !DRUM.includes(from as never) ? -1 : DRUM.indexOf(from as never)
  const j = DRUM.indexOf(to as never)
  const out: string[] = []
  while (i !== j) { i = (i + 1) % DRUM.length; out.push(DRUM[i]) }
  return out
}

const cardHTML = (ch: string) => `<i>${ch === ' ' ? '&nbsp;' : ch}</i>`

/** Static markup for one flap digit, blank. */
export function flapCellHTML(): string {
  return '<span class="sf" data-v=" ">' +
    `<span class="sf-h sf-t">${cardHTML(' ')}</span>` +
    `<span class="sf-h sf-b">${cardHTML(' ')}</span>` +
    `<span class="sf-flap"><span class="sf-h sf-t sf-front">${cardHTML(' ')}</span><span class="sf-h sf-b sf-back">${cardHTML(' ')}</span></span>` +
    '<span class="sf-axle"></span></span>'
}

type Cell = { el: HTMLElement; shown: string; queue: string[]; fall: Fall | null }

/**
 * Drives the flap cells inside `host`. `set` asks for a value; each cell
 * then turns card by card toward its digit, each card falling as above.
 * With `still` the cards are simply changed.
 */
export class FlapBoard {
  private cells: Cell[]
  private raf = 0
  private last = 0
  private still: boolean
  private onLand?: (strength: number) => void
  constructor(host: HTMLElement, still = false, onLand?: (strength: number) => void) {
    this.still = still
    this.onLand = onLand
    this.cells = Array.from(host.querySelectorAll<HTMLElement>('.sf')).map((el) => ({ el, shown: el.dataset.v ?? ' ', queue: [], fall: null }))
  }

  /** Show `value`, right-aligned, blank-padded; `pad` pads with zeros instead (for hours, minutes, seconds). */
  set(value: string, pad = false) {
    const w = this.cells.length
    const v = value.length >= w ? value.slice(-w) : value.padStart(w, pad ? '0' : ' ')
    this.cells.forEach((c, i) => {
      const target = v[i]
      const end = c.queue.length ? c.queue[c.queue.length - 1] : c.shown
      if (end === target) return
      if (this.still) { c.queue = []; c.fall = null; this.paint(c, target, target); c.shown = target; this.face(c, 0); return }
      c.queue.push(...cardsBetween(end, target))
    })
    if (!this.still && !this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame) }
  }

  private paint(c: Cell, from: string, to: string) {
    const [top, bot, front, back] = c.el.querySelectorAll('i')
    top.innerHTML = to === ' ' ? '&nbsp;' : to
    bot.innerHTML = from === ' ' ? '&nbsp;' : from
    front.innerHTML = from === ' ' ? '&nbsp;' : from
    back.innerHTML = to === ' ' ? '&nbsp;' : to
    c.el.dataset.v = to
  }

  /** The card's angle, and its light: lit from above, its face darkens as it turns away and the back brightens as it comes down. */
  private face(c: Cell, theta: number) {
    c.el.style.setProperty('--a', `${(-theta * 180) / Math.PI}deg`)
    c.el.style.setProperty('--lf', (0.55 + 0.45 * Math.cos(Math.min(theta, Math.PI / 2))).toFixed(3))
    c.el.style.setProperty('--lb', (0.6 + 0.4 * Math.max(0, -Math.cos(theta))).toFixed(3))
    c.el.classList.toggle('turning', theta > 0 && theta < Math.PI)
  }

  private frame = (now: number) => {
    // A long pause (a hidden tab) is not a slow fall: it resumes from where it was.
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    let busy = false
    for (const c of this.cells) {
      if (!c.fall && c.queue.length) {
        const next = c.queue.shift()!
        this.paint(c, c.shown, next)
        c.shown = next
        c.fall = startFall()
        // A drum spinning through many cards runs its motor faster.
        if (c.queue.length > 2) c.fall.omega *= 2.2
      }
      if (!c.fall) continue
      busy = true
      const hitsBefore = c.fall.hits
      c.fall = stepFall(c.fall, dt)
      if (c.fall.hits > hitsBefore && c.fall.hits === 1) this.onLand?.(c.queue.length ? 0.4 : 1)
      this.face(c, c.fall.done ? 0 : c.fall.theta)
      if (c.fall.done) {
        // Down: the old card is behind the new one; the static halves both show the new digit.
        c.fall = null
        this.paint(c, c.shown, c.shown)
      }
    }
    this.raf = busy || this.cells.some((c) => c.queue.length) ? requestAnimationFrame(this.frame) : 0
  }
}

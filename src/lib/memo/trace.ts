/**
 * The tracing.
 *
 * How do you check a drawing against the real thing? You lay a sheet of
 * tracing paper over it and draw the real thing on that. Your pencil shows
 * through, a little frosted, and the answer sits on top in ink, so the two can
 * be read against each other line by line.
 *
 * So that is the reveal. The sheet drops onto the page and settles, two strips
 * of blue masking tape press it down at the corners, and then the answer is
 * inked onto it stroke by stroke (memo-reveal.ts does the strokes). The answer
 * is drawn where the score lined your drawing up with it (memo-score.ts,
 * `place`), so what you see is exactly what was measured: draw the bicycle
 * small in a corner and the tracing is drawn small in that corner too.
 *
 * Without motion it is all simply there.
 */
import type { Reveal } from '../memo-reveal'
import { overYours, type Place } from '../memo-score'

/**
 * Pen on drafting film: a deep ultramarine, very slightly uneven, as a
 * hand-inked line is, and finer than the pencil under it — a technical pen,
 * not a marker.
 */
const NIB = 1.7
const DEFS = `<defs><filter id="fmInk" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="0.3" xChannelSelector="R" yChannelSelector="G"/>
</filter></defs>`

type Opts = {
  animate: boolean
  /** A strip of tape pressed down. */
  onTape?: () => void
  /** The pen starting (true) and lifting (false). */
  onInk?: (on: boolean) => void
}

export function createTrace(host: HTMLElement, svg: SVGSVGElement, reveal: Reveal, opts: Opts) {
  const pane = host.querySelector<HTMLElement>('.fm-vellum')!
  const tapes = [...host.querySelectorAll<HTMLElement>('.fm-tape')]
  let timers: number[] = []
  const later = (ms: number, f: () => void) => { timers.push(window.setTimeout(f, ms)) }

  function hide() {
    timers.forEach(clearTimeout)
    timers = []
    reveal.stop()
    host.getAnimations({ subtree: true }).forEach((a) => a.cancel())
    host.hidden = true
    svg.innerHTML = ''
    opts.onInk?.(false)
  }

  /**
   * Lay the sheet and ink the answer.
   * @param done called when the last line is down
   */
  function show(markup: string, place: Place | undefined, done?: () => void) {
    hide()
    // A pen keeps its width however the answer had to be scaled to sit over
    // your drawing: the stroke is scaled back by the same amount.
    const k = place ? Math.sqrt(place.sx * place.sy) : 1
    const answer = `${DEFS}<g transform="${overYours(place)}" stroke-width="${(NIB * k).toFixed(3)}" filter="url(#fmInk)">${markup}</g>`
    host.hidden = false
    if (!opts.animate) {
      reveal.play(answer, true)
      done?.()
      return
    }
    svg.innerHTML = ''
    // The sheet: dropped from a little above and to the left, landing flat,
    // its shadow closing in as it meets the page.
    host.animate([
      { transform: 'translate(-2.5%, -9%) rotate(-2.2deg) scale(1.035)', opacity: 0 },
      { opacity: 1, offset: 0.35 },
      { transform: 'translate(0.3%, 0.6%) rotate(0.15deg) scale(0.998)', offset: 0.78 },
      { transform: 'none', opacity: 1 },
    ], { duration: 760, easing: 'cubic-bezier(.22,.8,.3,1)' })
    pane.animate([
      { boxShadow: '0 0 0 0.5px rgba(150,165,190,0.2), 10px 24px 34px rgba(40,50,70,0.22)' },
      { boxShadow: getComputedStyle(pane).boxShadow },
    ], { duration: 760, easing: 'cubic-bezier(.3,.7,.3,1)' })
    tapes.forEach((tp, i) => {
      tp.style.opacity = '0'
      later(560 + i * 150, () => {
        tp.style.opacity = ''
        tp.animate([
          { opacity: 0, scale: '1.2', translate: '0 -6px' },
          { opacity: 1, scale: '1', translate: '0 0' },
        ], { duration: 220, easing: 'cubic-bezier(.3,.8,.4,1)' })
        opts.onTape?.()
      })
    })
    later(900, () => {
      opts.onInk?.(true)
      reveal.play(answer, false, () => { opts.onInk?.(false); done?.() })
    })
  }

  return { show, hide }
}

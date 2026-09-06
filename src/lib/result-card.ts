/**
 * The picture you get when you finish something.
 *
 * `og-card.ts` already renders one share image per game at build time, from
 * the registry. That card says what the *game* is. This one says what *you
 * did* — and it cannot be built at build time, because a static site has no
 * server to render a result on request. So the same job runs in the browser
 * instead: this file produces the SVG, `share-card.ts` rasterises it there.
 *
 * Three things it reuses rather than reinvents:
 *
 *   - the game's accent pair, from the registry, so a result card and the
 *     game's own card are recognisably the same product;
 *   - the game's tile illustration, from `tile-art.ts`, so the picture on the
 *     card is the picture on the homepage rather than a third drawing of the
 *     same thing;
 *   - the wrapping and the ink-over-accent rule from `og-card.ts`, because
 *     both cards are 1200 by 630 and both have to stay readable on whatever
 *     colour the registry hands them.
 *
 * Text is measured, not guessed. The headline is one line and can be anything
 * from "Utilitarian" to a sum of money, so its size comes from an estimate of
 * how wide it will actually set; `check-result-card.mjs` renders the result
 * and measures the painted extent, which is the honest way round — the
 * estimate is the thing under test, not the assertion.
 */

import { gameBySlug } from '../data/games'
import { pickInk } from './og-card'
import { ART, PRESERVE, SLOT_BOX } from './tile-art'

export const CARD = {
  W: 1200,
  H: 630,
  /** Everything textual stays left of this; the drawing owns what is right. */
  TEXT_RIGHT: 640,
} as const

export type Stat = { label: string; value: string }

export type ResultCard = {
  /** Which game. Supplies the colours, the title and the drawing. */
  slug: string
  /** The one thing worth reading: a verdict, a score, a sum. */
  headline: string
  /** One line of context under it. Optional; some results need none. */
  sub?: string
  /** Up to four, along the bottom. More than four stops being a result. */
  stats?: Stat[]
  /** Passed in rather than imported, so the card stays a pure function. */
  siteName: string
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Rough width of a string in ems, for a sans-serif at its natural spacing.
 *
 * The same model `check-art.mjs` calibrated against `getClientRects` on the
 * live grid: narrow letters, wide letters, and everything else. It is an
 * estimate and it only has to be good enough to pick a size that fits — which
 * the checker then verifies by rendering.
 */
const HAIR = "il|'’.,:;!I"
const NARROW = 'jtfr() '
const WIDE = 'mwMW'
export const emWidth = (s: string) =>
  [...s].reduce(
    (u, c) => u + (HAIR.includes(c) ? 0.28 : NARROW.includes(c) ? 0.36 : WIDE.includes(c) ? 0.95 : 0.58),
    0,
  )

/** Break on word boundaries, at most `max` ems per line. */
function wrapEm(text: string, maxEm: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (emWidth(next) > maxEm && line) {
      lines.push(line)
      line = w
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  // Dropping the rest without saying so reads as a rendering fault rather
  // than as a sentence that was too long. The stat row throws instead,
  // because a truncated number would be a lie; a truncated sentence is not.
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = kept[maxLines - 1].replace(/[ ,;:]+$/, '') + '…'
  return kept
}

const FONT = 'Arial, Helvetica, sans-serif'

/**
 * The game's own tile drawing, placed in the right-hand third and faded out
 * towards the text.
 *
 * The illustrations are authored for a wide, short card and each declares
 * which part of it it occupies, so the same slot geometry is used here — a
 * drawing composed for the bottom band of a tile would sit in mid-air if this
 * pretended every one of them was centred.
 */
function art(slug: string) {
  const a = ART[slug]
  if (!a) return ''
  const box = SLOT_BOX[a.slot]
  const x = (box.l / 100) * CARD.W
  const y = (box.t / 100) * CARD.H
  const w = (box.w / 100) * CARD.W
  const h = (box.h / 100) * CARD.H
  return (
    `<mask id="rc-fade"><rect width="${CARD.W}" height="${CARD.H}" fill="url(#rc-fadeg)"/></mask>` +
    `<g mask="url(#rc-fade)">` +
    `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" ` +
    `viewBox="${a.viewBox}" preserveAspectRatio="${PRESERVE[a.slot]}">${a.draw(7)}</svg>` +
    `</g>`
  )
}

/**
 * A result card for one game.
 *
 * Every id is prefixed `rc-`: this is rasterised on its own most of the time,
 * but it is also inserted into a live page to be previewed, and the tile art
 * it embeds already carries slug-prefixed ids of its own.
 */
/** A block of the card, in card units. `y` is the top of the glyph box. */
export type Box = { name: string; x: number; y: number; w: number; h: number }

const AVAIL = CARD.TEXT_RIGHT - 84
const LABEL_PX = 20
const VALUE_PX = 32

/**
 * The largest size at which `text` fits the column in at most `maxLines`.
 *
 * The first version worked the other way round — it took a size from the
 * *unwrapped* width and then widened the wrap budget as the size fell, which
 * is circular, and a long verdict stayed on one line at a size that ran 400
 * units past the edge of the card.
 */
function fit(text: string, from: number, to: number, maxLines: number) {
  for (let size = from; size >= to; size -= 2) {
    const lines = wrapEm(text, AVAIL / size, maxLines)
    if (lines.length <= maxLines && lines.every((l) => emWidth(l) * size <= AVAIL)) return { size, lines }
  }
  return { size: to, lines: wrapEm(text, AVAIL / to, maxLines) }
}

const chipWidth = (s: Stat) =>
  Math.max(
    150,
    Math.ceil(Math.max(emWidth(s.label.toUpperCase()) * LABEL_PX * 1.16, emWidth(s.value) * VALUE_PX) + 44),
  )

/**
 * Where everything goes.
 *
 * Separated from the drawing so `check-result-card.mjs` can ask the layout
 * what it intends and then hold the render to it. Rendering the card once per
 * block with the other blocks removed does not work: taking the headline away
 * moves the sub-line, so the boxes compared are not the boxes the card draws.
 */
export function layout(r: ResultCard) {
  const head = fit(r.headline, 92, 30, 2)
  // An empty headline still occupies its line. Letting it collapse to zero
  // made `headLines.length - 1` negative and pushed the sub-line *upwards*.
  const headLines = head.lines.length ? head.lines : ['']
  const stats = (r.stats ?? []).slice(0, 4)
  const sub = r.sub ? fit(r.sub, 32, 22, 2) : null

  const size = head.size
  const headTop = 250 - (headLines.length - 1) * size * 0.5
  // A second line pushes the block up by half a line and down by a whole one.
  // The first version only did the first half, so "…,700 / spent" printed
  // straight through the line under it.
  const headBottom = headTop + (headLines.length - 1) * size * 1.1 + size * 0.26
  const subTop = headBottom + 52
  const chipY = CARD.H - 168

  const boxes: Box[] = []
  const wide = (lines: string[], px: number) => Math.max(...lines.map((l) => emWidth(l) * px), 0)
  if (r.headline)
    boxes.push({
      name: 'headline',
      x: 84,
      // Cap height above the baseline, plus a little for descenders below.
      y: headTop - size * 0.74,
      w: wide(headLines, size),
      h: (headLines.length - 1) * size * 1.1 + size,
    })
  if (sub)
    boxes.push({
      name: 'sub',
      x: 84,
      y: subTop - sub.size * 0.74,
      w: wide(sub.lines, sub.size),
      h: (sub.lines.length - 1) * sub.size * 1.3 + sub.size,
    })
  let w = 0
  for (const s of stats) w += chipWidth(s) + 16
  if (stats.length) boxes.push({ name: 'stats', x: 84, y: chipY, w: w - 16, h: 94 })

  return { head, headLines, sub, stats, size, headTop, subTop, chipY, boxes }
}

export function resultCardSvg(r: ResultCard): string {
  const game = gameBySlug(r.slug)
  if (!game) throw new Error(`result-card: no game "${r.slug}"`)

  // Shared with og-card.ts, and the reason it is shared is written there:
  // choosing the ink from accent2 alone put dark text on a near-black ground
  // on eight of the site's games.
  const { ink, soft, chip } = pickInk(game.accent, game.accent2)

  const L = layout(r)
  const { size, headLines, stats, headTop, subTop } = L
  const sub = L.sub
  const subLines = sub ? sub.lines : []

  let cx = 84
  const chips = stats
    .map((s) => {
      const w = chipWidth(s)
      const x = cx
      cx += w + 16
      const y = L.chipY
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="94" rx="16" fill="${chip}"/>` +
        `<text x="${x + 22}" y="${y + 36}" font-family="${FONT}" font-size="${LABEL_PX}" fill="${soft}" ` +
        `letter-spacing="1.4">${esc(s.label.toUpperCase())}</text>` +
        `<text x="${x + 22}" y="${y + 74}" font-family="${FONT}" font-size="${VALUE_PX}" font-weight="700" ` +
        `fill="${ink}">${esc(s.value)}</text>`
      )
    })
    .join('')

  if (cx - 16 > CARD.TEXT_RIGHT) {
    // Loud rather than silent: a stat row that does not fit used to slide
    // under the illustration, which looks like a rendering bug rather than
    // like a caller writing "Closest rival: Contractualist" on a card.
    throw new Error(
      `result-card: ${r.slug} stat row is ${Math.round(cx - 16 - 84)} wide, ` +
        `${CARD.TEXT_RIGHT - 84} available — shorten a label or a value`,
    )
  }

  return (
    `<svg width="${CARD.W}" height="${CARD.H}" viewBox="0 0 ${CARD.W} ${CARD.H}" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `<defs>` +
    `<linearGradient id="rc-bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${game.accent}"/><stop offset="1" stop-color="${game.accent2}"/>` +
    `</linearGradient>` +
    // Nothing on the left third, everything on the right — the same shape of
    // fade the homepage tiles use, so a drawing never fights the text.
    `<linearGradient id="rc-fadeg" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0.30" stop-color="#000"/><stop offset="0.62" stop-color="#fff"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="${CARD.W}" height="${CARD.H}" fill="url(#rc-bg)"/>` +
    art(r.slug) +
    // The game's name, small, above the result — the result is the headline,
    // not the game.
    `<text x="84" y="128" font-family="${FONT}" font-size="26" font-weight="700" fill="${soft}" ` +
    `letter-spacing="3">${esc(game.title.toUpperCase())}</text>` +
    `<text x="84" y="${headTop}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${ink}">` +
    headLines.map((l, i) => `<tspan x="84" dy="${i === 0 ? 0 : size * 1.1}">${esc(l)}</tspan>`).join('') +
    `</text>` +
    (subLines.length
      ? `<text x="84" y="${subTop}" font-family="${FONT}" font-size="${sub!.size}" fill="${soft}">` +
        subLines
          .map((l, i) => `<tspan x="84" dy="${i === 0 ? 0 : sub!.size * 1.3}">${esc(l)}</tspan>`)
          .join('') +
        `</text>`
      : '') +
    chips +
    `<text x="84" y="${CARD.H - 42}" font-family="${FONT}" font-size="25" font-weight="700" ` +
    `fill="${soft}">${esc(r.siteName)}</text>` +
    `</svg>`
  )
}

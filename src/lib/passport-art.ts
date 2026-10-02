/**
 * The passport's stamps: one per game, drawn at build time, in ink.
 *
 * Every district stamps in its own shape and its own ink, the way every
 * country's border post does: Sky Peaks a double ring, the Harbour a ring of
 * rope, the Funfair a scalloped rosette, the Badlands a hexagon, the Proving
 * Grounds a shield, Market Street a ticket with its corners clipped, Old Town
 * an oval. The game's own drawn icon is in the middle, its name runs round or
 * across the rim, and the day is left blank for the page to print in, since
 * only the visitor's browser knows it.
 *
 * Everything is `currentColor`, so a stamp is whatever ink its slot says.
 */
import { iconSvg } from './icons'

export type StampShape = 'ring' | 'rope' | 'rosette' | 'hex' | 'shield' | 'ticket' | 'oval'

export const STAMP: Record<string, { shape: StampShape; ink: string; word: string }> = {
  peaks: { shape: 'ring', ink: '#13806a', word: 'SKY PEAKS' },
  harbour: { shape: 'rope', ink: '#1b4f96', word: 'HARBOUR' },
  funfair: { shape: 'rosette', ink: '#c4306f', word: 'FUNFAIR' },
  badlands: { shape: 'hex', ink: '#6446c0', word: 'BADLANDS' },
  proving: { shape: 'shield', ink: '#1f67c9', word: 'PROVING GROUNDS' },
  market: { shape: 'ticket', ink: '#0d817c', word: 'MARKET ST' },
  oldtown: { shape: 'oval', ink: '#4637a6', word: 'OLD TOWN' },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** Roughly how wide a line of Fredoka capitals is, to know when to squeeze. */
const width = (s: string, size: number, track: number) => s.length * (size * 0.64 + track)

/**
 * A long name gets smaller type first, down to a floor, and is only squeezed
 * once it is at the floor: squeezing alone turns Days Since Incident into a
 * bar code.
 */
function fitted(text: string, size: number, max: number, floor = 6.4) {
  const want = width(text, size, 0.8)
  if (want <= max) return { size, fit: '' }
  const small = Math.max(floor, (size * max) / want)
  const fit = width(text, small, 0.8) > max ? ` textLength="${max.toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : ''
  return { size: +small.toFixed(2), fit }
}

function line(text: string, x: number, y: number, size: number, max: number, cls = '') {
  const t = fitted(text, size, max)
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${t.size}" letter-spacing="0.8"${t.fit}${cls ? ` class="${cls}"` : ''}>${esc(text)}</text>`
}

function arc(id: string, text: string, r: number, size: number, top: boolean, cls = '') {
  // The top arc runs left to right over the top, letters standing outward;
  // the bottom one left to right underneath, letters standing inward, so
  // both read the right way up.
  const d = top ? `M${60 - r} 60A${r} ${r} 0 0 1 ${60 + r} 60` : `M${60 - r} 60A${r} ${r} 0 0 0 ${60 + r} 60`
  const t = fitted(text, size, Math.PI * r * 0.8)
  return `<path id="${id}" d="${d}" fill="none"/><text font-size="${t.size}" letter-spacing="0.8"${cls ? ` class="${cls}"` : ''}><textPath href="#${id}" startOffset="50%" text-anchor="middle"${t.fit}>${esc(text)}</textPath></text>`
}

/**
 * An icon in one ink. The icons are flat shapes in a few colours with no
 * outline, so turning every colour into the same ink melts the Earth into a
 * disc. Each colour gets its own strength instead, the way a one-colour
 * print screens a tint: the first (nearly always the big base shape) light,
 * the details on top of it full. An icon of one colour is all full.
 */
export function stampIcon(key: string): string {
  const raw = iconSvg(key)
  const COLOUR = /\b(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g
  const hexes: string[] = []
  for (const m of raw.matchAll(COLOUR)) { const h = m[2].toLowerCase(); if (!hexes.includes(h)) hexes.push(h) }
  const TONES = [0.34, 1, 0.66, 0.5, 0.82]
  return raw.replace(COLOUR, (_, attr: string, hex: string) => {
    const o = hexes.length < 2 ? 1 : TONES[hexes.indexOf(hex.toLowerCase()) % TONES.length]
    return o === 1 ? `${attr}="currentColor"` : `${attr}="currentColor" ${attr}-opacity="${o}"`
  })
}

// The icons are drawn for an <svg> of their own, where an unset fill is
// black and an unset stroke is none; inside a stamp's outline group they
// would inherit no fill at all, so they get those defaults back, in ink.
const icon = (key: string, cx: number, cy: number, s: number) =>
  '<g fill="currentColor" stroke="none">' + stampIcon(key).replace('<svg ', `<svg x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" `).replace(/ style="[^"]*"/, '') + '</g>'

const star = (x: number, y: number, r = 3.2) => {
  let d = ''
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; d += `${k ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(2)} ${(y + Math.sin(a) * rr).toFixed(2)}` }
  return `<path d="${d}Z" stroke="none" fill="currentColor"/>`
}

function poly(n: number, r: number, rot: number) {
  const p: string[] = []
  for (let k = 0; k < n; k++) { const a = rot + (k * 2 * Math.PI) / n; p.push(`${(60 + Math.cos(a) * r).toFixed(2)} ${(60 + Math.sin(a) * r).toFixed(2)}`) }
  return `M${p.join('L')}Z`
}

/** One game's stamp as an `<svg>`, its date in a `.pp-date` for the page to fill. */
export function stampSvg(o: { slug: string; title: string; district: string; icon: string }): string {
  const st = STAMP[o.district] ?? STAMP.oldtown
  const T = o.title.toUpperCase()
  const id = `pp-${o.slug}`
  let body = ''
  switch (st.shape) {
    case 'ring':
    case 'rope':
    case 'rosette': {
      if (st.shape === 'ring') body += `<circle cx="60" cy="60" r="55" stroke-width="3.4"/><circle cx="60" cy="60" r="38.5" stroke-width="1.4"/>`
      if (st.shape === 'rope') body += `<circle cx="60" cy="60" r="55.5" stroke-width="2.2" stroke-dasharray="3.2 2.4"/><circle cx="60" cy="60" r="51.5" stroke-width="1.2"/><circle cx="60" cy="60" r="38.5" stroke-width="2.2"/>`
      if (st.shape === 'rosette') {
        let d = ''
        for (let k = 0; k < 28; k++) { const a0 = (k * 2 * Math.PI) / 28, a1 = ((k + 1) * 2 * Math.PI) / 28, am = (a0 + a1) / 2; d += `${k ? '' : `M${(60 + Math.cos(a0) * 53).toFixed(2)} ${(60 + Math.sin(a0) * 53).toFixed(2)}`}Q${(60 + Math.cos(am) * 59.5).toFixed(2)} ${(60 + Math.sin(am) * 59.5).toFixed(2)} ${(60 + Math.cos(a1) * 53).toFixed(2)} ${(60 + Math.sin(a1) * 53).toFixed(2)}` }
        body += `<path d="${d}Z" stroke-width="2.6"/><circle cx="60" cy="60" r="38.5" stroke-width="1.4" stroke-dasharray="1 2.6"/>`
      }
      body += arc(`${id}-t`, T, 42.5, 9.2, true, 'pp-t')
      body += arc(`${id}-d`, '', 48.5, 7.6, false, 'pp-date')
      body += star(13.5, 60) + star(106.5, 60)
      body += icon(o.icon, 60, 60, 40)
      break
    }
    case 'hex': {
      body += `<path d="${poly(6, 57, 0)}" stroke-width="3.2" stroke-linejoin="round"/><path d="${poly(6, 50, 0)}" stroke-width="1.2" stroke-linejoin="round"/>`
      body += `<path d="M24 41.5H96M24 78.5H96" stroke-width="1.2"/>`
      body += line(T, 60, 36.5, 8.6, 68, 'pp-t') + line('', 60, 90, 7.4, 60, 'pp-date')
      body += icon(o.icon, 60, 60, 31)
      break
    }
    case 'shield': {
      const sh = (i: number) => `M${12 + i} ${10 + i}H${108 - i}V${58}C${108 - i} ${86 - i * 0.4} ${86 - i * 0.6} ${102 - i} 60 ${113 - i}C${34 + i * 0.6} ${102 - i} ${12 + i} ${86 - i * 0.4} ${12 + i} 58Z`
      body += `<path d="${sh(0)}" stroke-width="3.2" stroke-linejoin="round"/><path d="${sh(6)}" stroke-width="1.2" stroke-linejoin="round"/>`
      body += `<path d="M18 33H102" stroke-width="1.2"/>`
      body += line(T, 60, 28, 8.6, 84, 'pp-t') + line('', 60, 96, 7.2, 46, 'pp-date')
      body += icon(o.icon, 60, 60, 34)
      break
    }
    case 'ticket': {
      const t = (i: number) => { const x0 = 4 + i, x1 = 116 - i, y0 = 18 + i, y1 = 102 - i, c = 9 - i * 0.5; return `M${x0 + c} ${y0}H${x1 - c}A${c} ${c} 0 0 0 ${x1} ${y0 + c}V${y1 - c}A${c} ${c} 0 0 0 ${x1 - c} ${y1}H${x0 + c}A${c} ${c} 0 0 0 ${x0} ${y1 - c}V${y0 + c}A${c} ${c} 0 0 0 ${x0 + c} ${y0}Z` }
      body += `<path d="${t(0)}" stroke-width="3.2"/><path d="${t(5)}" stroke-width="1.2" stroke-dasharray="4 2.4"/>`
      body += line(T, 60, 35, 8.8, 92, 'pp-t') + line('', 60, 93, 7.4, 80, 'pp-date')
      body += `<path d="M24 40H96M24 81H96" stroke-width="1"/>`
      body += icon(o.icon, 60, 60.5, 32)
      break
    }
    case 'oval': {
      body += `<ellipse cx="60" cy="60" rx="57" ry="44" stroke-width="3.2"/><ellipse cx="60" cy="60" rx="50" ry="37.5" stroke-width="1.2"/>`
      body += line(T, 60, 41, 8.4, 70, 'pp-t') + line('', 60, 86, 7.2, 56, 'pp-date')
      body += star(16, 60, 2.8) + star(104, 60, 2.8)
      body += icon(o.icon, 60, 62, 28)
      break
    }
  }
  return `<svg class="pp-stamp" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" font-family="Fredoka, system-ui, sans-serif" font-weight="700" filter="url(#pp-worn)">${body.replace(/<text /g, '<text fill="currentColor" stroke="none" ')}</g></svg>`
}

/** The district seal a page gets once every game in it is stamped. */
export function sealSvg(district: string, name: string): string {
  const id = `pp-seal-${district}`
  return `<svg class="pp-seal" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" font-family="Fredoka, system-ui, sans-serif" font-weight="700" filter="url(#pp-worn)">` +
    `<circle cx="60" cy="60" r="56" stroke-width="3"/><circle cx="60" cy="60" r="50" stroke-width="1.2"/><circle cx="60" cy="60" r="31" stroke-width="1.2"/>` +
    arc(`${id}-t`, name.toUpperCase(), 39.5, 10.5, true).replace('<text ', '<text fill="currentColor" stroke="none" ') +
    arc(`${id}-b`, 'ALL VISITED', 46, 9.5, false).replace('<text ', '<text fill="currentColor" stroke="none" ') +
    star(10, 60, 3) + star(110, 60, 3) +
    `<path d="M45 61l10 10 21-23" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`
}

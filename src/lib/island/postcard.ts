/**
 * Tiny Island — postcards.
 *
 * The camera button frames whatever the visitor is looking at as a postcard
 * they can keep or send: the view itself as the picture (painted afresh by
 * the engine at the card's own size, so it is as sharp on a phone as on a big
 * screen), "Greetings from" the district in view in big lettering across it,
 * a stamp in the corner with the nearest building on it, perforated, and a
 * postmark over the stamp with the day on it. Everything here is drawn on a
 * canvas in the page's own fonts; nothing is fetched.
 *
 * The page (index.astro) asks the engine for the two pictures (the view, and
 * the close-up for the stamp), hands them here, and shows what comes back.
 */

const INK = '#1b2340'
const FONT = 'Fredoka, system-ui, sans-serif'

/** The card, in pixels, landscape or portrait; and its white border. */
export const CARD = { long: 1800, short: 1200, border: 46 } as const
/** The stamp's picture as it is painted, in pixels (twice the size it is printed, for a sharp stamp). */
export const STAMP_PHOTO = { w: 400, h: 380 } as const

export type Shape = 'landscape' | 'portrait'
/** The card's size. */
export const cardSize = (shape: Shape) => (shape === 'landscape' ? { w: CARD.long, h: CARD.short } : { w: CARD.short, h: CARD.long })
/** The picture's size: the card less its border. */
export const photoSize = (shape: Shape) => { const c = cardSize(shape); return { w: c.w - CARD.border * 2, h: c.h - CARD.border * 2 } }
/** Landscape unless the view is clearly taller than it is wide. */
export const shapeFor = (w: number, h: number): Shape => (h > w * 1.05 ? 'portrait' : 'landscape')

/**
 * The part of a view (in map units, centred where the view is) that the
 * picture shows: as much of it as fits the picture's shape, so what the
 * visitor framed is what they get, trimmed at two sides at most.
 */
export function crop(view: { x: number; y: number; w: number; h: number }, shape: Shape) {
  const p = photoSize(shape), want = p.w / p.h
  const w = view.w / view.h > want ? view.h * want : view.w
  return { x: view.x, y: view.y, w, h: w / want, z: p.w / w }
}

export type PostcardInput = {
  /** The view, painted at photoSize(shape). */
  photo: HTMLCanvasElement
  /** The nearest building, painted at STAMP_PHOTO; or nothing, for a stamp of plain colour. */
  stamp: HTMLCanvasElement | null
  /** Where the card is from: a district's name, or the island's. */
  place: string
  /** The district's passport ink, for the lettering's shadow, the stamp and the postmark. */
  ink: string
  /** The value printed on the stamp (the number of games on the island). */
  value: string
  date: Date
  /** The site's address, printed small along the bottom. */
  host: string
  shape: Shape
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
/** "3 OCT 2026", as a postmark prints a day. */
export const postmarkDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`

/** The postcard, drawn. */
export function drawPostcard(i: PostcardInput): HTMLCanvasElement {
  const { w: W, h: H } = cardSize(i.shape), B = CARD.border
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const c = cv.getContext('2d')!
  c.imageSmoothingQuality = 'high'

  // The card: white, a little cooler towards the bottom.
  const paper = c.createLinearGradient(0, 0, 0, H)
  paper.addColorStop(0, '#ffffff'); paper.addColorStop(1, '#f1f5fe')
  c.fillStyle = paper; c.fillRect(0, 0, W, H)

  // The picture, with rounded corners, a soft darkening into its corners as a
  // photograph has, and an ink line round it.
  const pw = W - B * 2, ph = H - B * 2, R = 20
  c.save()
  round(c, B, B, pw, ph, R); c.clip()
  c.drawImage(i.photo, B, B, pw, ph)
  const vg = c.createRadialGradient(W / 2, H / 2, Math.min(pw, ph) * 0.42, W / 2, H / 2, Math.hypot(pw, ph) * 0.56)
  vg.addColorStop(0, 'rgba(27, 35, 64, 0)'); vg.addColorStop(1, 'rgba(27, 35, 64, 0.2)')
  c.fillStyle = vg; c.fillRect(B, B, pw, ph)
  c.restore()
  c.lineWidth = 4; c.strokeStyle = INK
  round(c, B, B, pw, ph, R); c.stroke()

  // The stamp, top right, a little askew; the postmark over its left edge.
  const SW = 280, SH = 318
  const sx = W - B - 40 - SW, sy = B + 34
  drawStamp(c, i, sx, sy, SW, SH)
  drawPostmark(c, i, sx + 8, sy + SH * 0.62)

  // Greetings from, bottom left: the place in big letters, white with an ink
  // edge and a shadow in the district's ink, the way the old ones were.
  const maxW = pw * (i.shape === 'landscape' ? 0.66 : 0.84)
  const word = i.place.toUpperCase()
  let size = i.shape === 'landscape' ? 168 : 150
  c.font = `700 ${size}px ${FONT}`
  ;(c as unknown as { letterSpacing: string }).letterSpacing = '4px'
  while (c.measureText(word).width > maxW && size > 70) { size -= 4; c.font = `700 ${size}px ${FONT}` }
  const lx = B + 58, ly = H - B - 64
  c.save()
  c.translate(lx, ly); c.rotate(-0.045)
  c.lineJoin = 'round'
  // The shadow, set back and down.
  c.lineWidth = size * 0.13; c.strokeStyle = INK; c.strokeText(word, size * 0.055, size * 0.06)
  c.fillStyle = i.ink; c.fillText(word, size * 0.055, size * 0.06)
  // The letters.
  c.strokeText(word, 0, 0)
  const fill = c.createLinearGradient(0, -size * 0.72, 0, 0)
  fill.addColorStop(0, '#ffffff'); fill.addColorStop(0.55, '#ffffff'); fill.addColorStop(1, '#d7f1ff')
  c.fillStyle = fill; c.fillText(word, 0, 0)
  // A line of shine across the top of each letter.
  c.save()
  c.beginPath(); c.rect(-20, -size * 0.74, maxW + 60, size * 0.12); c.clip()
  c.fillStyle = 'rgba(255, 255, 255, 0.9)'; c.fillText(word, 0, 0)
  c.restore()
  // "Greetings from", above it.
  const gs = Math.round(size * 0.34)
  c.font = `600 ${gs}px ${FONT}`
  ;(c as unknown as { letterSpacing: string }).letterSpacing = '1px'
  c.lineWidth = gs * 0.24; c.strokeStyle = INK
  c.strokeText('Greetings from', size * 0.04, -size * 0.86)
  c.fillStyle = '#ffffff'; c.fillText('Greetings from', size * 0.04, -size * 0.86)
  c.restore()
  ;(c as unknown as { letterSpacing: string }).letterSpacing = '0px'

  // Along the bottom edge of the card, small: where it came from.
  c.font = `600 21px ${FONT}`
  c.fillStyle = 'rgba(27, 35, 64, 0.62)'; c.textAlign = 'right'; c.textBaseline = 'middle'
  c.fillText(`Tiny Island · ${i.host}`, W - B - 6, H - B / 2)
  c.textAlign = 'left'
  c.fillText(postmarkDate(i.date).replace(/[A-Z]{3}/, (m) => m[0] + m.slice(1).toLowerCase()), B + 6, H - B / 2)
  return cv
}

/** A rounded rectangle, as a path. */
function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

/** A stamp's outline: a rectangle with its edges bitten into half-circles all round, as a sheet tears. */
function perforated(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 7, step = 21) {
  const nx = Math.max(2, Math.round(w / step)), ny = Math.max(2, Math.round(h / step)), gx = w / nx, gy = h / ny
  c.beginPath(); c.moveTo(x, y)
  for (let k = 0; k < nx; k++) { const cx = x + gx * (k + 0.5); c.lineTo(cx - r, y); c.arc(cx, y, r, Math.PI, 0, true) }
  c.lineTo(x + w, y)
  for (let k = 0; k < ny; k++) { const cy = y + gy * (k + 0.5); c.lineTo(x + w, cy - r); c.arc(x + w, cy, r, -Math.PI / 2, Math.PI / 2, true) }
  c.lineTo(x + w, y + h)
  for (let k = nx - 1; k >= 0; k--) { const cx = x + gx * (k + 0.5); c.lineTo(cx + r, y + h); c.arc(cx, y + h, r, 0, Math.PI, true) }
  c.lineTo(x, y + h)
  for (let k = ny - 1; k >= 0; k--) { const cy = y + gy * (k + 0.5); c.lineTo(x, cy + r); c.arc(x, cy, r, Math.PI / 2, -Math.PI / 2, true) }
  c.closePath()
}

function drawStamp(c: CanvasRenderingContext2D, i: PostcardInput, x: number, y: number, w: number, h: number) {
  c.save()
  c.translate(x + w / 2, y + h / 2); c.rotate(0.06); c.translate(-w / 2, -h / 2)
  // The paper, lifted off the card by its shadow.
  c.save()
  c.shadowColor = 'rgba(27, 35, 64, 0.32)'; c.shadowBlur = 18; c.shadowOffsetY = 7
  perforated(c, 0, 0, w, h)
  c.fillStyle = '#ffffff'; c.fill()
  c.restore()
  perforated(c, 0, 0, w, h)
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(27, 35, 64, 0.25)'; c.stroke()
  // The printed part: the district's ink as a frame round the picture.
  const m = 19, iw = w - m * 2, ih = h - m * 2
  c.fillStyle = i.ink; c.fillRect(m, m, iw, ih)
  const px = m + 7, py = m + 7, pw = iw - 14, ph = ih - 58
  if (i.stamp) c.drawImage(i.stamp, px, py, pw, ph)
  else { c.fillStyle = '#8ccbff'; c.fillRect(px, py, pw, ph) }
  c.lineWidth = 2.5; c.strokeStyle = INK; c.strokeRect(px, py, pw, ph)
  // Its value, in the corner, and the island's name below.
  c.font = `700 40px ${FONT}`; c.textBaseline = 'top'; c.textAlign = 'left'; c.lineJoin = 'round'
  c.lineWidth = 7; c.strokeStyle = INK; c.strokeText(i.value, px + 9, py + 6)
  c.fillStyle = '#ffffff'; c.fillText(i.value, px + 9, py + 6)
  c.font = `700 26px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'
  ;(c as unknown as { letterSpacing: string }).letterSpacing = '3px'
  c.fillStyle = '#ffffff'; c.fillText('TINY ISLAND', w / 2 + 1.5, py + ph + 26)
  ;(c as unknown as { letterSpacing: string }).letterSpacing = '0px'
  c.restore()
}

/** Text along an arc round (cx, cy): over the top reading left to right, or under the bottom the same way. */
function arcText(c: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, top: boolean) {
  const ws = [...text].map((ch) => c.measureText(ch).width + 2.5)
  const span = ws.reduce((a, b) => a + b, 0) / r
  let a = top ? -Math.PI / 2 - span / 2 : Math.PI / 2 + span / 2
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  ;[...text].forEach((ch, k) => {
    const half = ws[k] / 2 / r
    a += top ? half : -half
    c.save()
    c.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    c.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2)
    c.fillText(ch, 0, 0)
    c.restore()
    a += top ? half : -half
  })
}

function drawPostmark(c: CanvasRenderingContext2D, i: PostcardInput, x: number, y: number) {
  const R = 100, R2 = 72
  c.save()
  c.translate(x, y); c.rotate(-0.21)
  c.globalAlpha = 0.8
  c.strokeStyle = INK; c.fillStyle = INK
  // Wavy cancelling lines, off to the left.
  c.lineWidth = 4.5; c.lineCap = 'round'
  for (let k = -2; k <= 2; k++) {
    c.beginPath()
    for (let t = 0; t <= 300; t += 6) { const px = -R - 18 - t, py = k * 21 + Math.sin(t / 22) * 7; if (t) c.lineTo(px, py); else c.moveTo(px, py) }
    c.stroke()
  }
  // The rings, the words round them, and the day in the middle.
  c.lineWidth = 5; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke()
  c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R2, 0, Math.PI * 2); c.stroke()
  c.font = `700 22px ${FONT}`
  arcText(c, 'TINY ISLAND', 0, 0, R2 + 7, true)
  arcText(c, i.place.toUpperCase().replace(/^THE /, ''), 0, 0, R - 9, false)
  const d = postmarkDate(i.date).split(' ')
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.font = `700 34px ${FONT}`; c.fillText(`${d[0]} ${d[1]}`, 0, -12)
  c.font = `700 26px ${FONT}`; c.fillText(d[2], 0, 22)
  c.restore()
}

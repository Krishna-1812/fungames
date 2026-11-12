/**
 * The postcard: the page itself, torn out and photographed on the desk.
 *
 * A drawing deserves its own picture rather than a score card. So this is the
 * scene from the game, flattened into one image you can keep: the page torn
 * off along its perforations and lying a little crooked on the ash desk, your
 * pencil under the tracing, the answer inked over it where it was measured,
 * the mark in blue pencil, and the index card with what you were asked to
 * draw. The pencil lies beside them.
 */
import { renderStrokes, type Stroke } from './memo-ink'
import { overYours, type Place } from './memo-score'
import { paperTile } from './memo/paper'
import { deskTile } from './memo/desk'
import { ring } from './memo/mark'

const W = 1200, H = 800
const INK = '#1f43ad', BLUE_PENCIL = '#2f4f9a'

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('An image for the postcard could not be drawn'))
    im.src = src
  })
}
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** A page's outline, with the half-holes left along the top where it was torn off the wire. */
function tornPage(g: CanvasRenderingContext2D, w: number, h: number) {
  const pitch = 13, r = 3.4
  g.beginPath()
  g.moveTo(0, 0)
  for (let x = pitch / 2; x < w - r; x += pitch) {
    g.lineTo(x - r, 0)
    g.arc(x, 0, r, Math.PI, 0, true)
  }
  g.lineTo(w, 0)
  g.lineTo(w, h)
  g.lineTo(0, h)
  g.closePath()
}

/** Words wrapped to a width, at most `max` lines. */
function wrap(g: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width > width && line) { lines.push(line); line = word } else line = next
  }
  if (line) lines.push(line)
  return lines.slice(0, max)
}

export async function memoryPostcard(
  strokes: Stroke[], reference: string, title: string,
  likeness?: { score: number; verdict: string },
  extra: { place?: Place; mark?: { at: { x: number; y: number }; word: string } | null } = {},
): Promise<Blob> {
  const card = document.createElement('canvas')
  card.width = W; card.height = H
  const g = card.getContext('2d')
  if (!g) throw new Error('Drawing export is unavailable')
  const css = getComputedStyle(document.documentElement)
  const display = css.getPropertyValue('--display').trim() || 'Georgia, serif'
  const sans = css.getPropertyValue('--sans').trim() || 'system-ui, sans-serif'
  const hand = "'Caveat', 'Segoe Print', cursive"
  await document.fonts?.load?.(`600 40px Caveat`).catch(() => {})

  // The desk, and the window's light across it.
  const wood = await load(await deskTile())
  g.fillStyle = g.createPattern(wood, 'repeat')!
  g.fillRect(0, 0, W, H)
  let grd = g.createRadialGradient(160, -80, 0, 160, -80, 1100)
  grd.addColorStop(0, 'rgba(255,255,255,0.28)'); grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd; g.fillRect(0, 0, W, H)
  grd = g.createRadialGradient(W * 0.4, H * 0.35, H * 0.5, W * 0.4, H * 0.35, H * 1.15)
  grd.addColorStop(0, 'rgba(46,52,66,0)'); grd.addColorStop(1, 'rgba(46,52,66,0.3)')
  g.fillStyle = grd; g.fillRect(0, 0, W, H)

  // The page.
  const pw = 760, ph = pw * 0.7, u = pw / 200
  g.save()
  g.translate(56, 128)
  g.rotate(-0.026)
  g.save()
  g.shadowColor = 'rgba(40, 32, 24, 0.34)'; g.shadowBlur = 34; g.shadowOffsetX = 12; g.shadowOffsetY = 20
  tornPage(g, pw, ph); g.fillStyle = '#f7f8fa'; g.fill()
  g.restore()
  g.save()
  tornPage(g, pw, ph); g.clip()
  g.fillStyle = g.createPattern(paperTile(1), 'repeat')!
  g.fillRect(0, 0, pw, ph)
  g.drawImage(renderStrokes(strokes, pw), 0, 0, pw, ph)
  // The tracing over it, milky, with its own faint edge.
  const vx = pw * 0.02, vy = ph * 0.03, vw = pw * 0.96, vh = ph * 0.94
  g.fillStyle = 'rgba(240, 245, 252, 0.5)'; g.fillRect(vx, vy, vw, vh)
  g.strokeStyle = 'rgba(130, 146, 172, 0.45)'; g.lineWidth = 1; g.strokeRect(vx, vy, vw, vh)
  const k = extra.place ? Math.sqrt(extra.place.sx * extra.place.sy) : 1
  const answer = await load(svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 200 140"><g fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round" color="${INK}" transform="${overYours(extra.place)}" stroke-width="${(1.7 * k).toFixed(3)}">${reference}</g></svg>`))
  g.drawImage(answer, 0, 0, pw, ph)
  // The mark, in blue pencil.
  if (likeness && extra.mark) {
    const { at, word } = extra.mark
    g.save()
    g.scale(u, u)
    g.translate(at.x, at.y); g.rotate(-6 * Math.PI / 180); g.translate(-at.x, -at.y)
    g.fillStyle = g.strokeStyle = BLUE_PENCIL
    g.textAlign = 'center'
    g.font = `600 17px ${hand}`
    g.fillText(`${likeness.score}%`, at.x, at.y + 3)
    g.font = `600 ${Math.min(9, 100 / word.length)}px ${hand}`
    g.fillText(word, at.x + 2, at.y + 15)
    g.lineWidth = 1.15; g.lineCap = 'round'
    g.stroke(new Path2D(ring(at.x, at.y - 2, 20, 11.5)))
    g.restore()
  }
  g.restore()
  // Blue masking tape at the tracing's top corners.
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = 'rgba(110, 160, 230, 0.85)'
  for (const [x, a] of [[vx + 36, -0.6], [vx + vw - 36, 0.57]] as const) {
    g.save(); g.translate(x, vy + 14); g.rotate(a)
    g.beginPath()
    const tw = 100, th = 30
    g.moveTo(-tw / 2, -th / 2)
    for (let s = 0; s <= 6; s++) g.lineTo(tw / 2 - (s % 2) * 3, -th / 2 + (th * s) / 6)
    for (let s = 6; s >= 0; s--) g.lineTo(-tw / 2 + (s % 2) * 3, -th / 2 + (th * s) / 6)
    g.fill(); g.restore()
  }
  g.globalCompositeOperation = 'source-over'
  g.restore()

  // The pencil, beside the page.
  const pencil = document.querySelector<SVGSVGElement>('.fm-pencil')
  if (pencil) {
    const copy = pencil.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    copy.setAttribute('width', '600'); copy.setAttribute('height', '48')
    try {
      const im = await load(svgUrl(new XMLSerializer().serializeToString(copy)))
      g.save()
      g.translate(850, 660); g.rotate(-0.24)
      g.shadowColor = 'rgba(40, 32, 24, 0.32)'; g.shadowBlur = 10; g.shadowOffsetX = 6; g.shadowOffsetY = 10
      g.drawImage(im, 0, 0, 330, 26)
      g.restore()
    } catch { /* the pencil is a nicety */ }
  }

  // The index card: what you were asked to draw.
  g.save()
  g.translate(878, 150); g.rotate(0.035)
  const cw = 286, ch = likeness ? 300 : 236
  g.save()
  g.shadowColor = 'rgba(40, 32, 24, 0.26)'; g.shadowBlur = 22; g.shadowOffsetX = 8; g.shadowOffsetY = 12
  g.fillStyle = '#fbfcfd'; g.fillRect(0, 0, cw, ch)
  g.restore()
  g.fillStyle = '#5f6672'; g.font = `700 13px ${sans}`
  ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '1.5px'
  g.fillText('FROM MEMORY', 22, 34)
  ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'
  g.strokeStyle = 'rgba(84, 118, 178, 0.5)'; g.lineWidth = 1.5
  g.beginPath(); g.moveTo(22, 48); g.lineTo(cw - 22, 48); g.stroke()
  g.fillStyle = '#111318'; g.font = `600 38px ${display}`
  const lines = wrap(g, title, cw - 44, 3)
  lines.forEach((l, n) => g.fillText(l, 22, 92 + n * 40))
  let y = 92 + lines.length * 40 + 4
  g.fillStyle = '#5f6672'; g.font = `italic 19px ${display}`
  g.fillText('Drawn without looking.', 22, y)
  if (likeness) {
    y += 46
    g.fillStyle = BLUE_PENCIL; g.font = `600 40px ${hand}`
    g.fillText(`${likeness.score}% · ${likeness.verdict}`, 22, y, cw - 44)
  }
  g.restore()

  return await new Promise<Blob>((resolve, reject) => card.toBlob((blob) =>
    blob ? resolve(blob) : reject(new Error('Postcard could not be saved')), 'image/png'))
}

import { renderStrokes, type Stroke } from './memo-ink'

/** A drawing deserves its own picture, rather than a generic score card. */
export async function memoryPostcard(strokes: Stroke[], reference: string, title: string): Promise<Blob> {
  const image = new Image()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140"><g fill="none" stroke="#b44463" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" color="#b44463">${reference}</g></svg>`
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Reference could not be rendered'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
  const card = document.createElement('canvas')
  card.width = 1200; card.height = 800
  const ctx = card.getContext('2d')
  if (!ctx) throw new Error('Drawing export is unavailable')
  ctx.fillStyle = '#f6f0e5'; ctx.fillRect(0, 0, 1200, 800)
  ctx.fillStyle = '#775f51'; ctx.font = '16px sans-serif'
  ctx.fillText('FROM MEMORY / THE SKETCHBOOK', 60, 64)
  ctx.fillStyle = '#362b30'; ctx.font = 'bold 48px Georgia, serif'
  ctx.fillText(title, 60, 139, 1080)
  ctx.font = '20px sans-serif'
  ctx.fillText('What I remembered', 60, 207)
  ctx.fillText('The reference', 630, 207)
  ctx.fillStyle = '#fffcf7'
  ctx.fillRect(40, 235, 550, 385); ctx.fillRect(610, 235, 550, 385)
  ctx.drawImage(renderStrokes(strokes, 550), 40, 235, 550, 385)
  ctx.drawImage(image, 610, 235, 550, 385)
  ctx.strokeStyle = '#d9cabc'; ctx.beginPath(); ctx.moveTo(60, 671); ctx.lineTo(1140, 671); ctx.stroke()
  ctx.font = 'italic 26px Georgia, serif'; ctx.fillStyle = '#775f51'
  ctx.fillText('Perfectly imperfect. Drawn without looking.', 60, 730)
  return await new Promise<Blob>((resolve, reject) => card.toBlob(blob =>
    blob ? resolve(blob) : reject(new Error('Postcard could not be saved')), 'image/png'))
}

/**
 * make-favicon — rasterises the tab icon in src/lib/favicon.ts.
 *
 *   node scripts/make-favicon.mjs            write public/favicon.ico, favicon-96.png and apple-touch-icon.png
 *   node scripts/make-favicon.mjs --sheet    also write public/_mockups/favicon-sheet.html, every size side by side
 */
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { faviconSvg } = await import('../src/lib/favicon.ts')
const { Resvg } = await import('@resvg/resvg-js')

const png = (svg, w) => new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng()

// iOS rounds the corners itself and puts nothing behind the icon, so the
// home-screen icon is the same tile drawn full bleed with no outer ink ring.
const bleed = faviconSvg(true).replace(/<rect x=".75"[^>]*\/>/, '').replace(/ rx="7.5"/, '')
fs.writeFileSync('public/apple-touch-icon.png', png(bleed, 180))
// Search results ask for a multiple of 48 px.
fs.writeFileSync('public/favicon-96.png', png(faviconSvg(true), 96))
// favicon.ico, for whatever asks for it by name: PNGs inside an ICO wrapper.
const sizes = [16, 32, 48], imgs = sizes.map((w) => png(faviconSvg(true), w))
const head = Buffer.alloc(6 + 16 * sizes.length)
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4)
let off = head.length
sizes.forEach((w, i) => {
  const e = 6 + 16 * i
  head.writeUInt8(w, e); head.writeUInt8(w, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6)
  head.writeUInt32LE(imgs[i].length, e + 8); head.writeUInt32LE(off, e + 12); off += imgs[i].length
})
fs.writeFileSync('public/favicon.ico', Buffer.concat([head, ...imgs]))
console.log('wrote public/favicon.ico, favicon-96.png and apple-touch-icon.png')

if (process.argv.includes('--sheet')) {
  fs.mkdirSync('public/_mockups', { recursive: true })
  const uri = (b) => 'data:image/png;base64,' + Buffer.from(b).toString('base64')
  const row = (lit) => [16, 32, 64, 180].map((w) => `<img src="${uri(png(faviconSvg(lit), w))}" width="${w}">` +
    (w < 64 ? `<img src="${uri(png(faviconSvg(lit), w))}" width="${w * 4}" style="image-rendering:pixelated">` : '')).join('')
  const tab = (bg, fg) => `<div style="background:${bg};color:${fg};font:13px system-ui;display:flex;gap:8px;align-items:center;padding:8px 14px;border-radius:8px 8px 0 0;width:220px"><img src="${uri(png(faviconSvg(true), 32))}" width="16">Your Site Name — 31 small…</div>`
  fs.writeFileSync('public/_mockups/favicon-sheet.html', `<!doctype html><body style="margin:0;padding:24px;background:#e6e8ec;display:grid;gap:24px">` +
    `<div style="display:flex;gap:20px;align-items:end">${row(true)}</div><div style="display:flex;gap:20px;align-items:end">${row(false)}</div>` +
    `<div style="display:flex;gap:20px">${tab('#fff', '#222')}${tab('#35363a', '#eee')}${tab('#dfe1e5', '#222')}</div>` +
    `<img src="${uri(png(bleed, 180))}" width="90" style="border-radius:20px">`)
  console.log('wrote public/_mockups/favicon-sheet.html')
}

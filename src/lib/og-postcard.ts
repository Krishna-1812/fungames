/**
 * Share images as postcards from the island.
 *
 * A shared link is the first thing most new visitors see of the site, and the
 * old cards (lib/og-card.ts) were a gradient and a title: nothing of the
 * island at all. These are made from the island itself, at build time:
 *
 *  - a game's card is the island's sea, with that game's building on its
 *    plinth (the same drawing as its homepage card, lib/island/card-art.ts)
 *    beside its name and line;
 *  - the homepage's card is the whole island by day (the bake's still.webp),
 *    with the line under it.
 *
 * Text is set in Arimo from scripts/fonts (resvg has no network at build
 * time, and the system's fonts differ between this laptop and Vercel).
 */
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { homeIsland, homeBake } from './island/home'
import { cardSvg } from './island/card-art'
import { bakedFile } from './island/bake/index'

export const OG_W = 1200
export const OG_H = 630

const FONT_DIR = path.join(process.cwd(), 'scripts/fonts')
const font = { fontFiles: [path.join(FONT_DIR, 'Arimo-Bold.ttf'), path.join(FONT_DIR, 'Arimo-Regular.ttf')], loadSystemFonts: false, defaultFontFamily: 'Arimo' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Words into lines of at most `max` characters; the last allowed line ends in an ellipsis if there is more. */
export function wrapLines(text: string, max: number, lines: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const w of text.split(/\s+/)) {
    if (!cur) cur = w
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w
    else { out.push(cur); cur = w }
  }
  if (cur) out.push(cur)
  if (out.length > lines) { const kept = out.slice(0, lines); kept[lines - 1] = kept[lines - 1].replace(/[\s,.;:]*$/, '') + '…'; return kept }
  return out
}

/** The sea every card sits on: the homepage's own blue, its little white wave marks, and a pool of shallows. */
const sea = (glowX: number, glowY: number, glowR: number) => `
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a95da"/><stop offset="1" stop-color="#2b66aa"/></linearGradient>
    <radialGradient id="shallows" cx="${glowX}" cy="${glowY}" r="${glowR}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#bfe6ff" stop-opacity="0.75"/><stop offset="0.55" stop-color="#8fd0ff" stop-opacity="0.35"/><stop offset="1" stop-color="#8fd0ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#sea)"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#shallows)"/>
  <g fill="none" stroke="#d7ecff" stroke-width="3" stroke-linecap="round" opacity="0.45">
    ${[[90, 92], [520, 60], [980, 110], [160, 560], [470, 600], [1080, 570], [640, 540]].map(([x, y]) => `<path d="M${x} ${y}q9-7 18 0q9 7 18 0"/>`).join('')}
  </g>`

const png = (svg: string) => new Resvg(svg, { fitTo: { mode: 'width', value: OG_W }, font }).render().asPng()

/** A game's postcard: the building on the right, its name and line on the left. */
export async function gamePostcard(slug: string, title: string, blurb: string): Promise<Buffer | null> {
  const island = homeIsland('cartoon')
  const art = homeBake('cartoon').cards[slug]
  if (!art || !island.anchors[slug]) return null
  // Drawn large, cut to its own edges, then fitted to one box: a lighthouse and a yacht come out the same size.
  const drawn = new Resvg(cardSvg(island, art, slug, 1000), { fitTo: { mode: 'width', value: 1000 } }).render().asPng()
  const building = await sharp(await sharp(drawn).trim({ threshold: 1 }).png().toBuffer()).resize({ width: 540, height: 500, fit: 'inside' }).png().toBuffer()
  const { width: bw = 540, height: bh = 500 } = await sharp(building).metadata()
  const tLines = wrapLines(title, 16, 2)
  const bLines = wrapLines(blurb, 30, 3)
  const tSize = tLines.some((l) => l.length > 11) ? 70 : 82
  const titleY = 236 - (tLines.length - 1) * tSize * 0.5
  const text = `
    <rect x="72" y="${titleY - tSize - 46}" width="228" height="44" rx="22" fill="#4fe3c1" stroke="#1b2340" stroke-width="3"/>
    <text x="186" y="${titleY - tSize - 16}" text-anchor="middle" font-family="Arimo" font-weight="700" font-size="20" letter-spacing="2" fill="#1b2340">ON TINY ISLAND</text>
    ${tLines.map((l, i) => `<text x="72" y="${titleY + i * tSize * 1.02}" font-family="Arimo" font-weight="700" font-size="${tSize}" fill="#ffffff" stroke="#1b2340" stroke-width="2" paint-order="stroke" stroke-opacity="0.35">${esc(l)}</text>`).join('')}
    ${bLines.map((l, i) => `<text x="74" y="${titleY + (tLines.length - 1) * tSize * 1.02 + 70 + i * 42}" font-family="Arimo" font-size="32" fill="#eaf4ff">${esc(l)}</text>`).join('')}
    <text x="74" y="582" font-family="Arimo" font-weight="700" font-size="24" fill="#d7ecff" opacity="0.9">Every building on the island is a game</text>`
  const base = png(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">${sea(880, 330, 380)}${text}</svg>`)
  return sharp(base).composite([{ input: building, left: Math.round(890 - bw / 2), top: Math.round(OG_H / 2 - bh / 2 + 8) }]).png().toBuffer()
}

/** The homepage's postcard: the whole island by day, and the line. */
export async function homePostcard(count: number, tagline: string): Promise<Buffer> {
  const still = bakedFile(homeBake('cartoon'), 'still.webp')
  // The island fills the card from edge to edge; the sea around it is cropped, not the island.
  const isle = await sharp(still).resize({ width: OG_W, height: OG_H - 150, fit: 'cover', position: 'centre' }).png().toBuffer()
  const over = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b66aa" stop-opacity="0"/><stop offset="1" stop-color="#2b66aa"/></linearGradient></defs>
    <rect y="${OG_H - 260}" width="${OG_W}" height="110" fill="url(#fade)"/>
    <rect y="${OG_H - 150}" width="${OG_W}" height="150" fill="#2b66aa"/>
    <text x="600" y="${OG_H - 82}" text-anchor="middle" font-family="Arimo" font-weight="700" font-size="54" fill="#ffffff">${esc(`${count} small games on one tiny island`)}</text>
    <text x="600" y="${OG_H - 36}" text-anchor="middle" font-family="Arimo" font-size="28" fill="#d7ecff">${esc(tagline)}</text>
  </svg>`
  const base = await sharp({ create: { width: OG_W, height: OG_H, channels: 4, background: '#2b66aa' } }).composite([{ input: isle, left: 0, top: 0 }]).png().toBuffer()
  return sharp(base).composite([{ input: png(over), left: 0, top: 0 }]).png().toBuffer()
}

/**
 * A game's building, on its own: the picture on the homepage's card for it
 * (IslandHome.astro), framed the same way, as one standalone SVG that needs
 * nothing else on the page. The homepage's cards borrow the island's own
 * definitions (a rock drawn once and repeated, a clip, a gradient); here every
 * one a building refers to is written into its own <defs>, and the rules that
 * say how a building looks when nothing is playing (a night glow hidden by
 * day, a dash pattern) come with it as a <style>.
 *
 * pages/next/[world]/[slug].webp.ts rasterises it for the "Up next" cards
 * at the end of every game.
 */
import { parse, write, walk, type El } from './bake/xml'
import { cardCss } from './moves'
import { createHash } from 'node:crypto'

/**
 * The pictures inlined in a building's art (Unity's renders, on the realistic
 * island), and the file the bake writes each one to (scripts/bake-island.mjs):
 * the homepage's cards link them, cached for good, instead of carrying 2 MB of
 * them inside every visit's page. Named by their contents.
 */
export const cardImages = (art: string) => [...new Set(art.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g) ?? [])]
export const cardImageFile = (uri: string) => `k/${createHash('sha1').update(uri).digest('hex').slice(0, 12)}.webp`
/** A card's art with its pictures linked, not inlined: each <image> waits with its file in data-src (relative to the bake), for the page to fetch as the card comes near. */
export const linkCardImages = (art: string) => {
  for (const u of cardImages(art)) art = art.split(`href="${u}"`).join(`data-src="${cardImageFile(u)}"`).split(u).join(cardImageFile(u))
  return art
}

type IslandLike = { layers: { body: string }[]; css: string; anchors: Record<string, { foot: string; y0: number }> }

/**
 * The card's view of a building: framed by its footprint and its body, not by
 * everything it draws, since a lighthouse beam or a space elevator's cable
 * would shrink the building to a speck. 4:3.
 */
export function cardFrame(island: Pick<IslandLike, 'anchors'>, slug: string): [number, number, number, number] {
  const a = island.anchors[slug]
  const pts = a.foot.split(' ').map((p) => p.split(',').map(Number))
  const fx0 = Math.min(...pts.map((p) => p[0])), fx1 = Math.max(...pts.map((p) => p[0])), fy1 = Math.max(...pts.map((p) => p[1]))
  const footW = fx1 - fx0
  const top = Math.max(a.y0, fy1 - footW * 1.25)
  let h = Math.max(footW * 0.95, (fy1 - top) * 1.16)
  let w = (h * 4) / 3
  if (w < footW * 1.2) { w = footW * 1.2; h = (w * 3) / 4 }
  const cx = (fx0 + fx1) / 2, bottom = fy1 + h * 0.08
  return [cx - w / 2, bottom - h, w, h].map((v) => Number(v.toFixed(1))) as [number, number, number, number]
}

const defsMemo = new WeakMap<object, Map<string, El>>()
function defsOf(island: IslandLike): Map<string, El> {
  let m = defsMemo.get(island)
  if (!m) {
    m = new Map()
    for (const l of island.layers) for (const n of parse(l.body)) if (typeof n !== 'string') for (const el of walk(n)) if (el.attrs.id) m.set(el.attrs.id, el)
    defsMemo.set(island, m)
  }
  return m
}

const refsIn = (s: string) => new Set([...s.matchAll(/url\(#([^)]+)\)/g), ...s.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))

/** The building's picture as a whole SVG document, `px` wide. */
export function cardSvg(island: IslandLike, art: string, slug: string, px: number): string {
  const [x, y, w, h] = cardFrame(island, slug)
  const defs = defsOf(island)
  const a = island.anchors[slug]
  // Every definition the art refers to, and every one those refer to in turn.
  const done = new Set<string>()
  let out = ''
  const todo = [...refsIn(art)]
  while (todo.length) {
    const id = todo.pop()!
    if (done.has(id)) continue
    done.add(id)
    const d = defs.get(id)
    if (!d) continue
    const text = write(d)
    out += text
    for (const r of refsIn(text)) if (!done.has(r)) todo.push(r)
  }
  const style = cardCss('svg', art, island.css).replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x} ${y} ${w} ${h}" width="${px}" height="${Math.round((px * h) / w)}">`
    + (style ? `<style>${style}</style>` : '')
    + (out ? `<defs>${out}</defs>` : '')
    + `<polygon points="${a.foot}" fill="#ffffff" fill-opacity="0.75" stroke="#1b2340" stroke-opacity="0.18" stroke-width="1.5"/>`
    + art + '</svg>'
}

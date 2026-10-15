import type { APIRoute, GetStaticPaths } from 'astro'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { homeGames, homeIsland, homeBake, hasRealWorld, type World } from '../../../lib/island/home'
import { cardSvg } from '../../../lib/island/card-art'

/**
 * Every game's building, as a small picture, for the "Up next" cards at the
 * end of every game (lib/next-up.ts): the same building its homepage card
 * shows, in the island the visitor last chose. Made at build time; 480 px
 * wide, shown at 240.
 */
export const getStaticPaths: GetStaticPaths = () => {
  const worlds: World[] = hasRealWorld() ? ['cartoon', 'real'] : ['cartoon']
  return worlds.flatMap((world) => homeGames().map((g) => ({ params: { world, slug: g.slug } })))
}

export const GET: APIRoute = async ({ params }) => {
  const world = params.world as World
  const slug = params.slug!
  const island = homeIsland(world)
  const art = homeBake(world).cards[slug]
  if (!art || !island.anchors[slug]) return new Response('Not found', { status: 404 })
  const png = new Resvg(cardSvg(island, art, slug, 480), { fitTo: { mode: 'width', value: 480 } }).render().asPng()
  const webp = await sharp(png).webp({ quality: 82, alphaQuality: 90, effort: 5 }).toBuffer()
  return new Response(new Uint8Array(webp), {
    headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=86400' },
  })
}

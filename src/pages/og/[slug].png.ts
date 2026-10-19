import type { APIRoute, GetStaticPaths } from 'astro'
import { Resvg } from '@resvg/resvg-js'
import { listedGames } from '../../data/games'
import { SITE } from '../../site.config'
import { gameCardSvg } from '../../lib/og-card'
import { gamePostcard } from '../../lib/og-postcard'

// One PNG per listed game, made at build time: a postcard of its building on
// the island (lib/og-postcard.ts), or the plain card if it has no building.
export const getStaticPaths: GetStaticPaths = () => listedGames().map((g) => ({ params: { slug: g.slug } }))

export const GET: APIRoute = async ({ params }) => {
  const game = listedGames().find((g) => g.slug === params.slug)
  if (!game) return new Response('Not found', { status: 404 })

  const card = await gamePostcard(game.slug, game.title, game.blurb)
  if (card) return new Response(new Uint8Array(card), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' } })

  const svg = gameCardSvg({
    title: game.title,
    blurb: game.blurb,
    accent: game.accent,
    accent2: game.accent2,
    siteName: SITE.name,
  })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()

  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

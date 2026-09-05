import type { APIRoute, GetStaticPaths } from 'astro'
import { Resvg } from '@resvg/resvg-js'
import { listedGames } from '../../data/games'
import { SITE } from '../../site.config'
import { gameCardSvg } from '../../lib/og-card'

// One PNG per listed game, generated at build time from the registry — see
// lib/og-card.ts for why SVG isn't served directly.
export const getStaticPaths: GetStaticPaths = () => listedGames().map((g) => ({ params: { slug: g.slug } }))

export const GET: APIRoute = ({ params }) => {
  const game = listedGames().find((g) => g.slug === params.slug)
  if (!game) return new Response('Not found', { status: 404 })

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

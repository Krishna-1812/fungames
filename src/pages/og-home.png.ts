import type { APIRoute } from 'astro'
import { Resvg } from '@resvg/resvg-js'
import { SITE } from '../site.config'
import { siteCardSvg } from '../lib/og-card'

// The homepage's own share image — no single game's colours apply to it.
export const GET: APIRoute = () => {
  const svg = siteCardSvg({ name: SITE.name, tagline: SITE.tagline })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()

  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

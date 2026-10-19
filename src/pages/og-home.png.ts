import type { APIRoute } from 'astro'
import { SITE } from '../site.config'
import { homeGames } from '../lib/island/home'
import { homePostcard } from '../lib/og-postcard'

// The homepage's own share image: the whole island by day (lib/og-postcard.ts).
export const GET: APIRoute = async () => {
  const png = await homePostcard(homeGames().length, SITE.tagline)
  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

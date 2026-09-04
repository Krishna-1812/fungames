import type { APIRoute } from 'astro'
import { listedGames } from '../data/games'
import { SITE } from '../site.config'

// Generated from the game registry so a new game is indexed the moment it is
// added, with no extra step to forget.
export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL(SITE.url)).origin
  const urls = ['/', ...listedGames().map((g) => `/${g.slug}/`)]
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n') +
    `\n</urlset>\n`
  return new Response(body, { headers: { 'content-type': 'application/xml' } })
}

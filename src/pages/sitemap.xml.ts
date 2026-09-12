import type { APIRoute } from 'astro'
import { listedGames } from '../data/games'
import { SITE } from '../site.config'
import { withBase } from '../lib/base'

// Generated from the game registry so a new game is indexed the moment it is
// added, with no extra step to forget.
export const GET: APIRoute = ({ site }) => {
  // `site` is the origin alone (Astro's own rule); the base path — GitHub
  // Pages' `/fungames` subpath, empty at a domain root — has to be added by
  // hand for exactly the same reason every other literal path in this
  // codebase goes through `withBase`.
  const base = (site ?? new URL(SITE.url)).origin
  const urls = [withBase('/'), ...listedGames().map((g) => withBase(`/${g.slug}/`))]
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n') +
    `\n</urlset>\n`
  return new Response(body, { headers: { 'content-type': 'application/xml' } })
}

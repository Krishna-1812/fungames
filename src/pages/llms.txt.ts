import type { APIRoute } from 'astro'
import { listedGames } from '../data/games'
import { SITE } from '../site.config'
import { withBase } from '../lib/base'

// Generated from the registry, same as sitemap.xml and robots.txt — a new
// game is listed here the moment it's added, with no separate file to forget.
export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL(SITE.url)).origin
  const games = listedGames().sort((a, b) => b.added.localeCompare(a.added))

  const body =
    `# ${SITE.name}\n\n` +
    `> ${SITE.description}\n\n` +
    `Every game runs entirely in the browser: no accounts, no server-side ` +
    `state, no ads or analytics unless explicitly configured. Player progress ` +
    `(where a game has any) lives in that visitor's own browser storage.\n\n` +
    `## Games\n\n` +
    games.map((g) => `- [${g.title}](${base}${withBase(`/${g.slug}/`)}): ${g.description}`).join('\n') +
    `\n`

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

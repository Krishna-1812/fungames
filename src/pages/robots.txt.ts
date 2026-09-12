import type { APIRoute } from 'astro'
import { SITE } from '../site.config'
import { withBase } from '../lib/base'

export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL(SITE.url)).origin
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${base}${withBase('/sitemap.xml')}\n`, {
    headers: { 'content-type': 'text/plain' },
  })
}

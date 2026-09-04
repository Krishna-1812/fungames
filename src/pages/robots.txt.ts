import type { APIRoute } from 'astro'
import { SITE } from '../site.config'

export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL(SITE.url)).origin
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain' },
  })
}

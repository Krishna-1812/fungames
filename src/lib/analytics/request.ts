/**
 * What every analytics endpoint reads off a request: the visitor's address
 * (only ever hashed), and where Vercel says it came from.
 */
export function clientIp(req: Request, fallback: string | undefined): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || fallback || '0.0.0.0'
}

const dec = (v: string | null) => {
  if (!v) return null
  try { return decodeURIComponent(v).slice(0, 80) } catch { return v.slice(0, 80) }
}
/** Rounded to a tenth of a degree (about 11 km): a dot on a map, not an address. */
const deg = (v: string | null) => (v && Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : null)

export function geo(req: Request) {
  const h = req.headers
  const country = h.get('x-vercel-ip-country')
  return {
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    region: dec(h.get('x-vercel-ip-country-region')),
    city: dec(h.get('x-vercel-ip-city')),
    lat: deg(h.get('x-vercel-ip-latitude')),
    lon: deg(h.get('x-vercel-ip-longitude')),
  }
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })

/** A request from another site, which a browser marks with its Origin. */
export function foreign(req: Request): boolean {
  const o = req.headers.get('origin')
  if (!o) return false
  try { return new URL(o).host !== new URL(req.url).host } catch { return true }
}

/**
 * A rough per-address limit, held in this function instance's memory: enough
 * to stop one browser (or one script) filling the table, not a defence
 * against anyone determined, which Vercel's own firewall is for.
 */
const hits = new Map<string, { n: number; until: number }>()
export function limited(ip: string, cost: number, max: number, windowMs: number, now = Date.now()): boolean {
  if (hits.size > 5000) for (const [k, v] of hits) if (v.until < now) hits.delete(k)
  const h = hits.get(ip)
  if (!h || h.until < now) { hits.set(ip, { n: cost, until: now + windowMs }); return false }
  h.n += cost
  return h.n > max
}

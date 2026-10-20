/**
 * What every analytics endpoint reads off a request: the visitor's address
 * (only ever hashed), and where Vercel says it came from.
 */
import { createHmac, randomBytes } from 'node:crypto'
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

/**
 * The host the visitor asked for. Behind Vercel the function's own request.url
 * can name an internal address, so the forwarded host is the one to trust.
 */
export const siteHost = (req: Request) => req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host
/** Whether the visitor's connection is https (for the cookie's Secure flag). */
export const isHttps = (req: Request) => (req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')) === 'https'

/** A request from another site, which a browser marks with its Origin. */
export function foreign(req: Request): boolean {
  const o = req.headers.get('origin')
  if (!o) return false
  try { return new URL(o).host !== siteHost(req) } catch { return true }
}

/**
 * A rough per-address limit, held in this function instance's memory: enough
 * to stop one browser (or one script) filling the table, not a defence
 * against anyone determined, which Vercel's own firewall is for.
 */
const hits = new Map<string, { n: number; until: number }>()
// The table holds no address: each is keyed by an HMAC under a secret made fresh in this process's memory
// (as the privacy page says), which nothing else ever sees and which goes when the process does.
const rateSecret = randomBytes(32)
const CAP = 5000
export function limited(ip: string, cost: number, max: number, windowMs: number, now = Date.now()): boolean {
  if (hits.size >= CAP) for (const [k, v] of hits) if (v.until < now) hits.delete(k)
  const key = createHmac('sha256', rateSecret).update(ip).digest('base64url')
  const h = hits.get(key)
  if (!h || h.until < now) {
    // Full of live windows (a crowd, or a flood of addresses): a new address is let through untracked rather
    // than turned away, since the limit is there to stop one address hammering, not to shut out visitors.
    if (hits.size >= CAP && !h) return cost > max
    hits.set(key, { n: cost, until: now + windowMs })
    return cost > max
  }
  h.n += cost
  return h.n > max
}

/**
 * Analytics: the admin's login.
 *
 * One password, ADMIN_PASSWORD, set in Vercel's environment variables and
 * never in the repo. Logging in sets a cookie holding an expiry and an HMAC
 * of it, keyed by the password itself, so changing the password signs every
 * session out. The cookie is HttpOnly (no script can read it), SameSite=Strict
 * (no other site can send it), and Secure outside localhost.
 */
import { env } from './db'

export const COOKIE = 'funsite_admin'
export const SESSION_DAYS = 30

const enc = new TextEncoder()

async function key(password: string) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('funsite-admin:' + password))
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function signSession(password: string, now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_DAYS * 864e5)
  const sig = await crypto.subtle.sign('HMAC', await key(password), enc.encode(exp))
  return `${exp}.${b64(sig)}`
}

export async function verifySession(password: string | undefined, value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!password || !value) return false
  const [exp, sig] = value.split('.')
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false
  const want = await crypto.subtle.sign('HMAC', await key(password), enc.encode(exp))
  return timingSafeEqual(b64(want), sig)
}

/** Compare two strings in time that does not depend on where they differ. */
export function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

/** Check a typed password against the real one without leaking its length or contents through timing. */
export async function passwordMatches(real: string | undefined, typed: string): Promise<boolean> {
  if (!real) return false
  const h = async (s: string) => b64(await crypto.subtle.digest('SHA-256', enc.encode(s)))
  return timingSafeEqual(await h(real), await h(typed))
}

export const adminPassword = () => env('ADMIN_PASSWORD') || undefined

export function cookieHeader(value: string, secure: boolean, maxAge = SESSION_DAYS * 86400) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

/** The session cookie from a request's Cookie header. */
export function readCookie(header: string | null): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) return v.join('=')
  }
  return undefined
}

export async function isAdmin(req: Request): Promise<boolean> {
  return verifySession(adminPassword(), readCookie(req.headers.get('cookie')))
}

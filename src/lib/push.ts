/**
 * Daily reminders: a notification from the site, through the browser's own
 * push service, at the hour the visitor picked.
 *
 * Web Push is two small standards, and both are here rather than in a
 * dependency: the message is encrypted to the browser's key (RFC 8291,
 * aes128gcm), and the request is signed with the site's key so the push
 * service knows who is sending (RFC 8292, VAPID). WebCrypto does all of it.
 *
 * The keys are VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel's settings
 * (`node scripts/make-vapid-keys.mjs` makes a pair). Without them, reminders
 * say they are not available and nothing else changes.
 *
 * Who is reminded, and when, is `push_subs` (lib/analytics/db.ts): a browser's
 * push address, its time zone, the hour, and the day it last played the daily
 * challenge, so nobody is reminded of one they have already done.
 */
import type { Db } from './analytics/db'
import { env } from './analytics/db'
import { dailyFor } from '../data/game-meta'

/* ---- base64url ------------------------------------------------------------ */

export const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0))
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length } return o }
const utf8 = (s: string) => new TextEncoder().encode(s)
const buf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', buf(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, buf(data)))
}

/* ---- the message, encrypted (RFC 8291) ------------------------------------ */

export type Sub = { endpoint: string; p256dh: string; auth: string }

/** The body to POST to a subscription's endpoint: the payload, sealed for that browser only. */
export async function encrypt(sub: Sub, payload: Uint8Array, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array> {
  const uaPub = unb64u(sub.p256dh), secret = unb64u(sub.auth)
  const mine = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', mine.publicKey))
  const theirs = await crypto.subtle.importKey('raw', buf(uaPub), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, mine.privateKey, 256))
  // HKDF, by hand, the way the RFC writes it out.
  const prkKey = await hmac(secret, shared)
  const ikm = await hmac(prkKey, cat(utf8('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, cat(utf8('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, cat(utf8('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt'])
  // One record: the payload, then 0x02 to say it is the last.
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, key, buf(cat(payload, new Uint8Array([2])))))
  const rs = new Uint8Array([0, 0, 16, 0]) // 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, sealed)
}

/* ---- the sender, signed (RFC 8292) ----------------------------------------- */

export type Vapid = { publicKey: string; privateKey: string; subject: string }

/** In `astro dev`, a .env file's keys too (Vite reads it; the server's own environment is Vercel's). */
const devEnv = (k: 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY'): string | undefined =>
  import.meta.env?.DEV ? (k === 'VAPID_PUBLIC_KEY' ? import.meta.env.VAPID_PUBLIC_KEY : import.meta.env.VAPID_PRIVATE_KEY) : undefined

export function vapidKeys(): Vapid | null {
  const publicKey = env('VAPID_PUBLIC_KEY') || devEnv('VAPID_PUBLIC_KEY'), privateKey = env('VAPID_PRIVATE_KEY') || devEnv('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: env('VAPID_SUBJECT') || 'https://fungames-mu.vercel.app/' }
}

async function signingKey(v: Vapid) {
  const pub = unb64u(v.publicKey)
  const jwk = { kty: 'EC', crv: 'P-256', d: v.privateKey, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

/** The Authorization header for one push service, good for twelve hours. */
export async function vapidAuth(endpoint: string, v: Vapid, now = Date.now()): Promise<string> {
  const head = b64u(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64u(utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: v.subject })))
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(v), buf(utf8(`${head}.${body}`))))
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.publicKey}`
}

/** Push services a subscription may point at. Anything else is not a browser's, and is not sent to. */
const SERVICES = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9.-]+\.push\.apple\.com$/, /^android\.googleapis\.com$/]
export function okEndpoint(e: unknown): e is string {
  if (typeof e !== 'string' || e.length > 1000) return false
  try { const u = new URL(e); return u.protocol === 'https:' && !u.port && SERVICES.some((r) => r.test(u.hostname)) } catch { return false }
}

/** Send one notification. 'gone' means the browser has unsubscribed: forget it. */
export async function send(sub: Sub, msg: { title: string; body: string; url: string; tag?: string }, v: Vapid): Promise<'sent' | 'gone' | 'failed'> {
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { authorization: await vapidAuth(sub.endpoint, v), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(6 * 3600), urgency: 'normal' },
    body: buf(await encrypt(sub, utf8(JSON.stringify(msg)))),
  })
  if (r.status === 404 || r.status === 410) return 'gone'
  return r.ok ? 'sent' : 'failed'
}

/* ---- who is due ------------------------------------------------------------ */

/** The hour and the day where the visitor is. */
export function localNow(tz: string, now = new Date()): { hour: number; day: string } {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]))
    return { hour: Number(p.hour), day: `${p.year}-${p.month}-${p.day}` }
  } catch { return { hour: now.getUTCHours(), day: now.toISOString().slice(0, 10) } }
}
export const okTz = (tz: unknown): tz is string => { if (typeof tz !== 'string' || tz.length > 64) return false; try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true } catch { return false } }

export type SubRow = Sub & { tz: string; hour: number; streak: number; through: string | null; done: string | null; sent: string | null }

const day = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : typeof d === 'string' ? d.slice(0, 10) : null)
const yesterday = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10)

/**
 * The words of one reminder. The daily challenge is a UTC day's
 * (lib/daily.ts), so "today" here is UTC's, whatever the clock says locally.
 */
export function words(s: Pick<SubRow, 'streak' | 'through'>, now = new Date()): { title: string; body: string; url: string; tag: string } {
  const today = now.toISOString().slice(0, 10)
  const g = dailyFor(now)
  const alive = s.streak > 0 && s.through !== null && s.through >= yesterday(today)
  return {
    title: alive ? `Keep your ${s.streak}-day streak going` : 'Today’s challenge is waiting',
    body: `${g.title}: ${g.goal}`,
    url: `/${g.slug}/?ref=remind`,
    tag: 'daily',
  }
}

/**
 * Everyone whose hour it is (or was, in the last three: a late run still
 * reminds), who has not played today's challenge and has not been reminded today.
 */
export function due(rows: SubRow[], now = new Date()): SubRow[] {
  const today = now.toISOString().slice(0, 10)
  return rows.filter((r) => {
    const here = localNow(r.tz, now)
    return here.hour >= r.hour && here.hour < r.hour + 3 && day(r.done) !== today && day(r.sent) !== today
  })
}

/** The hourly run: remind whoever is due. Harmless to run twice in an hour (nobody is reminded twice a day). */
export async function remindAll(d: Db, now = new Date(), v = vapidKeys()): Promise<{ due: number; sent: number; gone: number; failed: number }> {
  if (!v) return { due: 0, sent: 0, gone: 0, failed: 0 }
  const rows = (await d.query<SubRow>('select endpoint, p256dh, auth, tz, hour, streak, through::text as through, done::text as done, sent::text as sent from push_subs')).map((r) => ({ ...r, through: day(r.through), done: day(r.done), sent: day(r.sent) }))
  const list = due(rows, now)
  const today = now.toISOString().slice(0, 10)
  let sent = 0, gone = 0, failed = 0
  for (const r of list) {
    // Marked first: a run that dies half way must not send twice.
    await d.query('update push_subs set sent = $2 where endpoint = $1', [r.endpoint, today])
    let out: 'sent' | 'gone' | 'failed' = 'failed'
    try { out = await send(r, words(r, now), v) } catch { /* counted as failed */ }
    if (out === 'gone') { await d.query('delete from push_subs where endpoint = $1', [r.endpoint]); gone++ }
    else if (out === 'sent') sent++
    else failed++
  }
  return { due: list.length, sent, gone, failed }
}

/** Whether this run is the hour's first (two runs in one hour: the second does nothing). */
export async function claimHour(d: Db, now = new Date()): Promise<boolean> {
  const hour = now.toISOString().slice(0, 13)
  const won = await d.query(
    `insert into meta (k, v, at) values ('remind_claim', $1, $2)
     on conflict (k) do update set v = excluded.v, at = excluded.at where meta.v <> excluded.v returning k`,
    [hour, now],
  )
  return won.length > 0
}

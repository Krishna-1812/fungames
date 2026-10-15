/**
 * The daily reminder, in the browser: asking for it, stopping it, and telling
 * the server when today's challenge is done so no reminder comes for it
 * (src/lib/push.ts sends them; public/sw.js shows them).
 *
 * Where a browser cannot take notifications (an iPhone's Safari, until the
 * site is on the Home Screen; any browser where the site has no keys yet), a
 * calendar file does the same job: a daily event at the same hour, which the
 * phone's own calendar reminds about.
 */
import { readDaily, streakOf, utcDay } from './daily'

const PREF = 'funsite:remind'
const API = '/api/remind/'

export type Pref = { on: boolean; hour: number }
export function readPref(): Pref | null {
  try {
    const o = JSON.parse(localStorage.getItem(PREF) ?? 'null')
    return o && typeof o.hour === 'number' && o.hour >= 0 && o.hour < 24 ? { on: !!o.on, hour: Math.floor(o.hour) } : null
  } catch { return null }
}
const writePref = (p: Pref) => { try { localStorage.setItem(PREF, JSON.stringify(p)) } catch { /* the server still has it */ } }

/** "7:00 PM" or "19:00": an hour, the way the visitor's own clock writes it. */
export const hourWords = (h: number) => new Date(2026, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

let key: Promise<string | null> | null = null
/** The site's push key, or null where reminders are not set up. */
export const serverKey = () => (key ??= fetch(API).then((r) => (r.ok ? r.json() : {})).then((j: { key?: string | null }) => j.key ?? null).catch(() => null))

const pushable = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
/** An iPhone or iPad, in a browser tab: notifications only come to a Home Screen app there. */
export const needsHomeScreen = () => {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  return ios && !standalone
}

/**
 * What can be offered here:
 * - 'on': reminders are on (at `hour`)
 * - 'off': they can be turned on
 * - 'blocked': this browser has said no to the site's notifications
 * - 'home': an iPhone, which needs the site on its Home Screen first
 * - 'calendar': no notifications here; the calendar file is the reminder
 */
export type State = 'on' | 'off' | 'blocked' | 'home' | 'calendar'
export async function state(): Promise<{ state: State; hour: number | null }> {
  const pref = readPref()
  const hour = pref?.hour ?? null
  if (!pushable()) return { state: needsHomeScreen() ? 'home' : 'calendar', hour }
  if (!(await serverKey())) return { state: 'calendar', hour }
  if (Notification.permission === 'denied') return { state: 'blocked', hour }
  const sub = await current()
  return { state: sub && pref?.on ? 'on' : 'off', hour }
}

async function current(): Promise<PushSubscription | null> {
  try { const reg = await navigator.serviceWorker.getRegistration('/'); return (await reg?.pushManager.getSubscription()) ?? null } catch { return null }
}

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0))
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' } }
/** The streak as the reminder should word it: how long, and the last day it was alive. */
function streakNow() {
  const f = readDaily(), today = utcDay(), st = streakOf(f.days, today, f.best)
  const yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10)
  return { streak: st.n, through: st.n === 0 ? null : st.today ? today : yesterday, done: st.today ? today : null }
}
const post = (body: Record<string, unknown>, keepalive = false) => fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive })

/** Ask for notifications and turn the reminder on. */
export async function turnOn(hour: number): Promise<'on' | 'blocked' | 'failed'> {
  const k = await serverKey()
  if (!k || !pushable()) return 'failed'
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'failed'
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k) }))
    const r = await post({ op: 'on', sub: sub.toJSON(), tz: tz(), hour, ...streakNow() })
    if (!r.ok) return 'failed'
    writePref({ on: true, hour })
    return 'on'
  } catch { return 'failed' }
}

export async function turnOff(): Promise<void> {
  const pref = readPref()
  writePref({ on: false, hour: pref?.hour ?? 18 })
  const sub = await current()
  if (!sub) return
  try { await post({ op: 'off', endpoint: sub.endpoint }) } catch { /* the push service forgets it below anyway */ }
  try { await sub.unsubscribe() } catch { /* fine */ }
}

/** Today's challenge is done: no reminder for it, and the streak as it now stands. */
export async function reportDone(): Promise<void> {
  if (!readPref()?.on) return
  const sub = await current()
  if (!sub) return
  const s = streakNow()
  try { await post({ op: 'done', endpoint: sub.endpoint, streak: s.streak, through: s.through }, true) } catch { /* the reminder comes anyway: harmless */ }
}

/* ---- the calendar instead ---------------------------------------------- */

/** A daily event at `hour` local time, from tomorrow, with an alert as it starts. */
export function calendarText(hour: number, origin: string, now = new Date()): string {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour)
  const p = (n: number) => String(n).padStart(2, '0')
  // Floating time (no Z, no zone): the same hour wherever the phone is.
  const at = `${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}T${p(hour)}0000`
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const url = `${origin}/?ref=calendar`
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tiny Island//Daily challenge//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:daily-${stamp}@tiny-island`, `DTSTAMP:${stamp}`, `DTSTART:${at}`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY',
    "SUMMARY:Tiny Island: today's challenge", 'DESCRIPTION:A new daily challenge is up. Keep your streak going.', `URL:${url}`, 'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', "DESCRIPTION:Today's challenge is waiting", 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n')
}

export function downloadCalendar(hour: number) {
  const blob = new Blob([calendarText(hour, location.origin)], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'tiny-island-daily.ics'
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  writePref({ on: readPref()?.on ?? false, hour })
}

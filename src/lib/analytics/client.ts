/**
 * Analytics: the tracker, in every page (Paper.astro and Base.astro start it).
 *
 * `track(name, props)` queues an event; the queue goes to /api/collect/ in
 * batches (the first a moment after load, then every fifteen seconds while
 * anything is waiting, and whatever is left as the page is hidden), so a
 * visit costs a few requests, not one per click. Every batch also carries
 * how long the page has really been looked at and how far down it was read.
 *
 * **The visitor ID.** A random string kept in this browser, so a visitor who
 * comes back is known to be the same one (and nothing else about them).
 * Where the law wants a yes first (the EU, the EEA, the UK, Switzerland: the
 * server says which, from the request), nothing is stored until the consent
 * bar is answered yes; answered no, or with Global Privacy Control switched
 * on, the visitor is still counted, without an ID. Everywhere else the ID is
 * made on the first visit, and the privacy page (/privacy/) can take it back.
 *
 * Nothing is sent from the admin's own browser (after logging in to
 * /admin/), from a browser driven by a script (unless it is a test run that
 * asks to be, which is stored as test traffic), or before the page is used.
 */
import { readPassport } from '../passport'
import { gameResult, type EventName, type Props } from './shape'

const ENDPOINT = '/api/collect/'
const K = { vid: 'funsite:vid', consent: 'funsite:consent', admin: 'funsite:admin', test: 'funsite:analytics-test' }

const ls = {
  get(k: string) { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* storage blocked: still counted, without an ID */ } },
  del(k: string) { try { localStorage.removeItem(k) } catch { /* nothing to remove */ } },
}

function rid() {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

type Consent = 'yes' | 'no' | 'gpc' | 'na' | 'pending'
type Queued = { n: EventName; t: number; p: Props; g?: string | null }

const state = {
  on: false,
  started: false,
  pid: '',
  vid: null as string | null,
  consent: 'pending' as Consent,
  test: false,
  view: null as Record<string, unknown> | null,
  queue: [] as Queued[],
  /** Visible time, counted only while the visitor has done something in the last two minutes. */
  engaged: 0,
  visibleSince: 0,
  lastInput: 0,
  scroll: 0,
  timer: 0,
  errors: 0,
}

/** The game a page is, if it is one: `/orbit/` → `orbit`. */
export const pageGame = () => location.pathname.match(/^\/([a-z][a-z0-9-]+)\/$/)?.[1] ?? null

/** Queue one event. Safe to call before `start()`, and from anywhere. */
export function track(n: EventName, p: Props = {}, g: string | null = null) {
  if (state.started && !state.on) return
  state.queue.push({ n, t: Date.now(), p, g })
  if (state.on && state.queue.length >= 20) flush()
}

/* ---- engaged time and scroll ------------------------------------------ */

const IDLE = 120_000
function tick(now = performance.now()) {
  if (state.visibleSince) {
    // Count up to the moment the visitor went quiet, at most.
    const until = Math.min(now, state.lastInput + IDLE)
    if (until > state.visibleSince) state.engaged += until - state.visibleSince
    state.visibleSince = document.visibilityState === 'visible' ? now : 0
  }
}
function input() {
  const now = performance.now()
  if (document.visibilityState === 'visible' && now - state.lastInput > IDLE) { tick(now); state.visibleSince = now }
  state.lastInput = now
}
function measureScroll() {
  const h = document.documentElement.scrollHeight - innerHeight
  const pct = h <= 0 ? 100 : Math.round(((scrollY || 0) / h) * 100)
  if (pct > state.scroll) state.scroll = Math.min(100, pct)
}

/* ---- sending ----------------------------------------------------------- */

function body(withView: boolean) {
  tick()
  const b: Record<string, unknown> = {
    v: 1, pid: state.pid, vid: state.vid, c: state.consent, test: state.test || undefined,
    e: state.queue.splice(0, 40),
    eng: { ms: Math.round(state.engaged), scroll: state.scroll },
  }
  if (withView && state.view) { b.view = state.view; state.view = null }
  return JSON.stringify(b)
}

let first: Promise<void> | null = null

/** The first batch is a fetch, because its answer says whether to ask before storing an ID. */
function sendFirst() {
  first = fetch(ENDPOINT, { method: 'POST', body: body(true), keepalive: true, headers: { 'content-type': 'text/plain' } })
    .then((r) => r.json())
    .then((a: { c?: string; admin?: boolean }) => {
      if (a.admin) { ls.set(K.admin, '1'); state.on = false; return }
      if (state.consent !== 'pending') return
      if (a.c === 'ok') { state.vid = ls.get(K.vid) ?? rid(); ls.set(K.vid, state.vid); state.consent = 'na'; flush() }
      else if (a.c === 'ask') showBar()
    })
    .catch(() => { /* offline or blocked: the visit goes uncounted */ })
}

const leaving: (() => void)[] = []
/** Run just before the page is hidden or closed, to queue a summary of the visit (the island's isl_session). */
export const onLeave = (f: () => void) => { leaving.push(f) }

export function flush(final = false) {
  if (!state.on) return
  if (final) for (const f of leaving) { try { f() } catch { /* a summary is not worth an error */ } }
  clearTimeout(state.timer)
  if (!first) { sendFirst(); return }
  const data = body(!!state.view)
  if (final && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([data], { type: 'text/plain' }))
  else fetch(ENDPOINT, { method: 'POST', body: data, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {})
}

function schedule() {
  clearTimeout(state.timer)
  state.timer = window.setTimeout(() => {
    // Every fifteen seconds while anything is waiting; a bare heartbeat a minute (the admin page's "right now").
    if (state.queue.length || performance.now() - lastBeat > 60_000) { lastBeat = performance.now(); flush() }
    schedule()
  }, 15_000)
}
let lastBeat = 0

/* ---- consent ----------------------------------------------------------- */

const BAR_ID = 'fs-consent'

function showBar() {
  if (document.getElementById(BAR_ID) || location.pathname.startsWith('/admin/')) return
  const bar = document.createElement('aside')
  bar.id = BAR_ID
  bar.className = 'fs-consent'
  bar.setAttribute('aria-label', 'Counting visits')
  bar.innerHTML = `
    <p class="fs-consent-text"><strong>Can we count your visits?</strong>
    A random number kept in this browser shows us which games people come back to. Nothing about who you are, and nothing sold.
    <a href="/privacy/">How it works</a></p>
    <div class="fs-consent-acts">
      <button type="button" class="fs-consent-yes" data-c="yes">Fine by me</button>
      <button type="button" class="fs-consent-no" data-c="no">No thanks</button>
    </div>`
  bar.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest('[data-c]') as HTMLElement | null
    if (!c) return
    setConsent(c.dataset.c === 'yes' ? 'yes' : 'no')
    bar.classList.add('is-gone')
    setTimeout(() => bar.remove(), 400)
  })
  document.body.append(bar)
  requestAnimationFrame(() => bar.classList.add('is-in'))
}

/** The visitor's answer, from the bar or the privacy page. */
export function setConsent(c: 'yes' | 'no') {
  ls.set(K.consent, c)
  if (c === 'yes') { state.vid = ls.get(K.vid) ?? rid(); ls.set(K.vid, state.vid) }
  else { state.vid = null; ls.del(K.vid) }
  state.consent = c
  track('consent', { choice: c })
  flush()
}

/** Everything held under this browser's ID, deleted on the server and here. */
export async function forgetMe(): Promise<boolean> {
  const vid = ls.get(K.vid)
  ls.del(K.vid)
  ls.set(K.consent, 'no')
  state.vid = null
  state.consent = 'no'
  if (!vid) return true
  try {
    const r = await fetch('/api/forget/', { method: 'POST', body: JSON.stringify({ vid }), headers: { 'content-type': 'application/json' } })
    return r.ok
  } catch { return false }
}

/** What this browser holds, for the privacy page to show. */
export const held = () => ({ vid: ls.get(K.vid), consent: ls.get(K.consent), gpc: gpc() })
const gpc = () => (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true

/* ---- start ------------------------------------------------------------- */

function viewOf(status?: number) {
  const q = new URLSearchParams(location.search)
  const pass = readPassport()
  const visits = Object.values(pass.visits)
  const firstDay = visits.reduce<string | null>((m, v) => (!m || v.first < m ? v.first : m), null)
  const nav = navigator as Navigator & { connection?: { effectiveType?: string }; deviceMemory?: number }
  const mq = (s: string) => matchMedia(s).matches
  return {
    path: location.pathname,
    ref: document.referrer || undefined,
    title: document.title,
    utm_source: q.get('utm_source') ?? undefined,
    utm_medium: q.get('utm_medium') ?? undefined,
    utm_campaign: q.get('utm_campaign') ?? undefined,
    sref: q.get('ref') ?? undefined,
    sw: screen.width, sh: screen.height, vw: innerWidth, vh: innerHeight,
    dpr: devicePixelRatio,
    touch: navigator.maxTouchPoints > 1,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dark: mq('(prefers-color-scheme: dark)'),
    rm: mq('(prefers-reduced-motion: reduce)'),
    conn: nav.connection?.effectiveType,
    mem: nav.deviceMemory,
    cpu: navigator.hardwareConcurrency,
    first_days: firstDay ? Math.max(0, Math.round((Date.now() - new Date(firstDay + 'T00:00').getTime()) / 864e5)) : undefined,
    games_seen: visits.length,
    visit_days: visits.reduce((m, v) => Math.max(m, v.days), 0),
    status,
  }
}

export function start(opts: { status?: number } = {}) {
  if (state.started) return
  state.started = true
  state.test = ls.get(K.test) === '1'
  const robot = (navigator as Navigator & { webdriver?: boolean }).webdriver === true
  if (ls.get(K.admin) === '1' || (robot && !state.test) || location.pathname.startsWith('/admin/')) {
    state.queue.length = 0
    return
  }
  state.on = true
  state.pid = rid()
  const said = ls.get(K.consent)
  if (gpc()) state.consent = 'gpc'
  else if (said === 'no') state.consent = 'no'
  else if (said === 'yes') { state.consent = 'yes'; state.vid = ls.get(K.vid) ?? rid(); ls.set(K.vid, state.vid) }
  else if (ls.get(K.vid)) { state.consent = 'na'; state.vid = ls.get(K.vid) }
  if (state.consent !== 'yes' && state.consent !== 'na') ls.del(K.vid)
  state.view = viewOf(opts.status)
  if (opts.status === 404) track('notfound', { path: location.pathname })

  const now = performance.now()
  state.lastInput = now
  state.visibleSince = document.visibilityState === 'visible' ? now : 0
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const) addEventListener(ev, input, { passive: true, capture: true })
  addEventListener('scroll', measureScroll, { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { tick(); state.visibleSince = 0; flush(true) }
    else { state.visibleSince = performance.now(); state.lastInput = state.visibleSince }
  })
  addEventListener('pagehide', () => flush(true))

  // Links that leave the site (Buy Me a Coffee among them).
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
    if (!a || !/^https?:$/.test(a.protocol) || a.host === location.host) return
    track('outbound', { host: a.hostname.replace(/^www\./, ''), path: a.pathname.slice(0, 60) })
  }, { capture: true })

  // What broke, and where (the message and the file, never the page's contents).
  const err = (msg: string, src: string, line: number, col: number, kind: string) => {
    if (state.errors++ >= 5) return
    track('error', { msg, src: src.split('/').pop()?.split('?')[0] ?? '', line, col, kind })
  }
  addEventListener('error', (e) => { if (e.message) err(e.message, e.filename ?? '', e.lineno ?? 0, e.colno ?? 0, 'error') })
  addEventListener('unhandledrejection', (e) => err(String((e.reason as Error)?.message ?? e.reason ?? 'rejected'), '', 0, 0, 'promise'))

  // What a game reports at its ending (lib/stats.ts sends it this way, to stay free of this module).
  document.addEventListener('funsite:result', (e) => {
    const d = (e as CustomEvent<{ slug: string; props: Props }>).detail
    if (d?.slug) track('game_result', gameResult(d.slug, d.props ?? {}), d.slug)
  })

  // The first batch once the page has settled; then the clock.
  setTimeout(() => flush(), 1500)
  schedule()

  // Core Web Vitals, in a chunk of their own fetched after load.
  const vitals = () => import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
    const send = (m: { name: string; value: number; rating: string }) => track('vital', { metric: m.name, value: m.value, rating: m.rating })
    onLCP(send); onINP(send); onCLS(send); onFCP(send); onTTFB(send)
  }).catch(() => {})
  if (document.readyState === 'complete') vitals()
  else addEventListener('load', vitals, { once: true })
}

/**
 * Analytics: what may be sent, and what the server makes of it.
 *
 * Pure functions over plain data, shared by the collection endpoint
 * (src/pages/api/collect.ts), the tracker (./client.ts) and the checker
 * (scripts/check-analytics.mjs), so the rules about what is kept are written
 * once and proved headlessly.
 *
 * The rules, in short:
 *
 * - **Only known events.** Every event name is in `EVENTS`; anything else is
 *   dropped, so a typo or a stranger's script cannot invent columns.
 * - **Small, flat props.** At most twelve, each a finite number, a boolean
 *   or a string of at most 80 characters. Nothing nested.
 * - **Nothing typed by a player.** The tracker never reads an input's value;
 *   what a game reports goes through `gameResult`, which knows the few fields
 *   that would say something personal (Life in Weeks' age) and coarsens them.
 * - **No IP address and no user agent are stored.** The server reads them
 *   for exactly three things (the country the request came from, the kind
 *   of device, and a daily hash that counts visitors who have no ID) and
 *   keeps only the results.
 * - **Referrers lose their query strings**, which is where search terms and
 *   tokens live.
 */

/* ---- events ----------------------------------------------------------- */

/** Every event the site sends, and what it means. */
export const EVENTS = {
  // the page
  vital: 'a Core Web Vital, once the browser has settled it',
  error: 'a script error or a rejected promise',
  outbound: 'a link to another site was followed',
  notfound: 'a 404 page was shown',
  consent: 'the visitor answered the consent bar',
  // every game, through the shell
  game_start: 'the first touch, click or key on a game',
  game_end: 'a game reached an ending (win or lose)',
  game_result: 'the numbers a game keeps from an ending',
  game_best: 'a personal best was set or beaten',
  game_level: 'a level-up or milestone inside a game',
  game_restart: 'a game was restarted',
  game_pause: 'the pause panel was opened',
  game_howto: 'the how-to-play panel was opened',
  game_pick: 'a choice, discovery or step inside a game (the crowd statistics)',
  game_quit: 'a page was left while a game was going: where it stopped',
  sound: 'sound was switched on or off',
  share: 'a result was shared, saved or copied',
  next_show: 'the Up next games were seen, at an ending or at the foot of a game',
  daily_done: 'a round of the daily challenge was finished: beaten or not, and the streak it made',
  next_go: 'an Up next game (or the island) was picked: why it was offered, and which',
  // the island
  isl_dive: 'a game was entered from the island',
  isl_card: 'a building’s card was opened',
  isl_search: 'the games list was searched',
  isl_filter: 'the games list was filtered',
  isl_surprise: 'Surprise me',
  isl_today: 'the Today button',
  isl_board: 'the noticeboard was opened',
  isl_board_go: 'a noticeboard line’s button was used',
  isl_poke: 'something on the map was poked',
  isl_bottle: 'a message in a bottle was found',
  isl_postcard: 'a postcard was made, saved or shared',
  isl_passport: 'the passport was opened, or a page in it turned',
  isl_cover: 'a passport cover was put on',
  isl_time: 'day or night was picked by hand',
  isl_world: 'the cartoon island or the realistic one was picked',
  isl_welcome: 'the first-visit welcome was answered or closed',
  isl_minimap: 'the mini-map was used to move',
  isl_ball: 'the beach ball was thrown or kicked',
  isl_pigeons: 'the pigeons were put up',
  isl_session: 'how the island was explored, sent as the page closes',
  isl_fps: 'how smoothly the island drew on this device',
  isl_tap: 'a tap or click on the island, where it landed on the map (the heat-map)',
} as const

export type EventName = keyof typeof EVENTS
export const isEvent = (n: unknown): n is EventName => typeof n === 'string' && Object.hasOwn(EVENTS, n)

export type Props = Record<string, number | string | boolean>

export const LIMITS = {
  /** Bytes in one request body. */
  body: 16_384,
  events: 40,
  props: 12,
  str: 80,
  path: 160,
  ref: 200,
} as const

const KEY = /^[a-z][a-z0-9_]{0,31}$/
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g

export function cleanString(v: unknown, max: number = LIMITS.str): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(CONTROL, ' ').trim()
  return s ? s.slice(0, max) : null
}

/** Flat, small, finite. Anything else is left out rather than refused. */
export function cleanProps(p: unknown): Props {
  const out: Props = {}
  if (!p || typeof p !== 'object' || Array.isArray(p)) return out
  let n = 0
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (n >= LIMITS.props) break
    if (!KEY.test(k)) continue
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) continue
      out[k] = Math.round(v * 1e4) / 1e4
    } else if (typeof v === 'boolean') out[k] = v
    else {
      const s = cleanString(v)
      if (s === null) continue
      out[k] = s
    }
    n++
  }
  return out
}

/** A page's path, and nothing after it. */
export function cleanPath(v: unknown): string | null {
  if (typeof v !== 'string' || !v.startsWith('/')) return null
  const p = v.split(/[?#]/)[0].replace(CONTROL, '')
  return p.slice(0, LIMITS.path) || '/'
}

/* ---- what a game reports --------------------------------------------- */

/**
 * What a game's ending reports (the `last` it hands `recordPlay`), made safe
 * to send. Every game's numbers are kept as they are, except the few that
 * would say something about the person rather than the game.
 */
export function gameResult(slug: string, last: Props): Props {
  const p = cleanProps(last)
  if (slug === 'life-in-weeks') {
    // Weeks lived is an age to the week. A decade is enough to chart.
    const w = typeof p.weeks === 'number' ? p.weeks : NaN
    delete p.weeks
    if (Number.isFinite(w)) p.age_decade = Math.min(120, Math.floor(w / 52.1775 / 10) * 10)
  }
  return p
}

/**
 * The top three frames of an error's stack, as `function file:line:col`, from
 * Chrome's shape (`at f (url:1:2)`) or Firefox's and Safari's (`f@url:1:2`).
 * Only this site's own scripts are named (`host`); anything else, an
 * extension's or another site's, is `(other)`.
 */
export function framesOf(stack: string, host: string): string[] {
  const out: string[] = []
  for (const raw of stack.split('\n')) {
    const l = raw.trim()
    const m = l.match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/) ?? l.match(/^(.*?)@(.+?):(\d+):(\d+)$/)
    if (!m) continue
    const [, fn, url, ln, cl] = m
    let own = false
    try { own = new URL(url).host === host } catch { /* not a url: native code, eval */ }
    const file = own ? url.split(/[?#]/)[0].split('/').pop() : '(other)'
    out.push(`${(fn || '(anonymous)').slice(0, 40)} ${file}:${ln}:${cl}`.slice(0, LIMITS.str))
    if (out.length === 3) break
  }
  return out
}

/**
 * Games whose score is the player: Life in Weeks' score, best and title are
 * the weeks they have lived and their share of ninety years. The shell's own
 * events (an ending, a best, a level, a page left mid-game) carry them like
 * any game's, so they are cut from every event about that game, here, on the
 * server, whatever an old or altered page sends.
 */
const PERSONAL: Record<string, string[]> = { 'life-in-weeks': ['score', 'title', 'value', 'text', 'at'] }
export function scrub(game: string | null, p: Props): Props {
  const cut = game ? PERSONAL[game] : undefined
  if (!cut) return p
  const out = { ...p }
  for (const k of cut) delete out[k]
  return out
}
/** The same, as SQL, for rows stored before the rule (the nightly run applies it). */
export const SCRUB_SQL = Object.entries(PERSONAL).map(([g, ks]) =>
  `update events set props = props ${ks.map((k) => `- '${k}'`).join(' ')} where game = '${g}' and name <> 'game_result' and (${ks.map((k) => `props ? '${k}'`).join(' or ')})`)

/* ---- the batch -------------------------------------------------------- */

/** What the tracker knows about the page and the device, sent with its first batch. */
export type ViewIn = {
  path: string
  ref?: string
  title?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  /** `?ref=` on a shared link: how it was shared. */
  sref?: string
  sw?: number
  sh?: number
  vw?: number
  vh?: number
  dpr?: number
  touch?: boolean
  lang?: string
  tz?: string
  dark?: boolean
  rm?: boolean
  conn?: string
  mem?: number
  cpu?: number
  /** From the passport this browser already keeps. */
  first_days?: number
  games_seen?: number
  visit_days?: number
  status?: number
}

export type EventIn = { n: EventName; t: number; p: Props; g: string | null }

export type Batch = {
  pid: string
  vid: string | null
  view: ViewIn | null
  events: EventIn[]
  eng: { ms: number; scroll: number } | null
  test: boolean
  /** yes or no (the bar was answered), gpc (Global Privacy Control), na (not asked: not needed here), pending (asked, not yet answered). */
  consent: Consent | null
}

export const CONSENTS = ['yes', 'no', 'gpc', 'na', 'pending'] as const
export type Consent = (typeof CONSENTS)[number]

/** Random ids the tracker makes: 16 to 32 url-safe characters. */
const ID = /^[A-Za-z0-9_-]{16,32}$/
export const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)

const SLUG = /^[a-z][a-z0-9-]{1,40}$/
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : undefined)
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined)
const str = (v: unknown, max: number = LIMITS.str) => cleanString(v, max) ?? undefined

function cleanView(v: unknown): ViewIn | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const path = cleanPath(o.path)
  if (!path) return null
  return {
    path,
    ref: str(o.ref, 2048),
    title: str(o.title, 120),
    utm_source: str(o.utm_source, 60),
    utm_medium: str(o.utm_medium, 60),
    utm_campaign: str(o.utm_campaign, 80),
    sref: str(o.sref, 40),
    sw: num(o.sw, 0, 20000), sh: num(o.sh, 0, 20000),
    vw: num(o.vw, 0, 20000), vh: num(o.vh, 0, 20000),
    dpr: num(o.dpr, 0, 10),
    touch: bool(o.touch),
    lang: str(o.lang, 35),
    tz: str(o.tz, 60),
    dark: bool(o.dark),
    rm: bool(o.rm),
    conn: str(o.conn, 12),
    mem: num(o.mem, 0, 1024),
    cpu: num(o.cpu, 0, 1024),
    first_days: num(o.first_days, 0, 100000),
    games_seen: num(o.games_seen, 0, 1000),
    visit_days: num(o.visit_days, 0, 100000),
    status: num(o.status, 100, 599),
  }
}

/**
 * Parse a request body into a batch, or null if it is not one. `now` is the
 * server's clock: an event's own time is kept only if it is within a day of
 * it (and never in the future), since a device's clock can be anything.
 */
export function parseBatch(body: string, now: number): Batch | null {
  if (body.length > LIMITS.body) return null
  let o: unknown
  try { o = JSON.parse(body) } catch { return null }
  if (!o || typeof o !== 'object') return null
  const b = o as Record<string, unknown>
  if (b.v !== 1 || !isId(b.pid)) return null
  const events: EventIn[] = []
  if (Array.isArray(b.e)) {
    for (const e of b.e.slice(0, LIMITS.events)) {
      if (!e || typeof e !== 'object') continue
      const x = e as Record<string, unknown>
      if (!isEvent(x.n)) continue
      const t = typeof x.t === 'number' && x.t <= now && now - x.t < 864e5 ? Math.round(x.t) : now
      const g = typeof x.g === 'string' && SLUG.test(x.g) ? x.g : null
      events.push({ n: x.n, t, p: x.n === 'game_result' && g ? gameResult(g, cleanProps(x.p)) : scrub(g, cleanProps(x.p)), g })
    }
  }
  let eng: Batch['eng'] = null
  if (b.eng && typeof b.eng === 'object') {
    const g = b.eng as Record<string, unknown>
    eng = { ms: num(g.ms, 0, 864e5) ?? 0, scroll: num(g.scroll, 0, 100) ?? 0 }
  }
  return { pid: b.pid, vid: isId(b.vid) ? b.vid : null, view: cleanView(b.view), events, eng, test: b.test === true, consent: (CONSENTS as readonly unknown[]).includes(b.c) ? (b.c as Consent) : null }
}

/* ---- the request ------------------------------------------------------ */

/** EU, EEA, the UK and Switzerland: where storing an ID needs a yes first. */
export const CONSENT_COUNTRIES = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH'.split(' '),
)
/** Whether to ask before storing an ID. An unknown country is asked. */
export const mustAsk = (country: string | null) => !country || CONSENT_COUNTRIES.has(country)

const BOT = /bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|slack|vkshare|w3c_validator|curl|wget|python|java\/|go-http|axios|node-fetch|httpclient|phantom|selenium|puppeteer|playwright|cypress|monitor|uptime|pingdom|statuscake/i
export const isBot = (ua: string | null) => !ua || ua.length < 20 || BOT.test(ua)

export type Device = { device: 'phone' | 'tablet' | 'desktop'; os: string; browser: string; bver: string }

/**
 * The kind of device, from the user agent (which is then forgotten). `touch`
 * is the page's own `maxTouchPoints > 1`: an iPad asks for desktop pages and
 * says it is a Mac, and touch is the only thing that gives it away.
 */
export function parseUa(ua: string, touch = false): Device {
  let os = 'Other'
  if (/Windows NT/.test(ua)) os = 'Windows'
  else if (/iPhone|iPod/.test(ua)) os = 'iOS'
  else if (/iPad/.test(ua)) os = 'iPadOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/CrOS/.test(ua)) os = 'ChromeOS'
  else if (/Mac OS X|Macintosh/.test(ua)) os = touch ? 'iPadOS' : 'macOS'
  else if (/Linux/.test(ua)) os = 'Linux'

  let device: Device['device'] = 'desktop'
  if (/iPad|Tablet/.test(ua) || os === 'iPadOS' || (/Android/.test(ua) && !/Mobile/.test(ua))) device = 'tablet'
  else if (/Mobi|iPhone|iPod|Android/.test(ua)) device = 'phone'

  const m = (re: RegExp) => ua.match(re)?.[1] ?? ''
  let browser = 'Other', bver = ''
  if (/Edg(e|A|iOS)?\//.test(ua)) { browser = 'Edge'; bver = m(/Edg(?:e|A|iOS)?\/(\d+)/) }
  else if (/OPR\/|Opera/.test(ua)) { browser = 'Opera'; bver = m(/OPR\/(\d+)/) }
  else if (/SamsungBrowser/.test(ua)) { browser = 'Samsung Internet'; bver = m(/SamsungBrowser\/(\d+)/) }
  else if (/Firefox|FxiOS/.test(ua)) { browser = 'Firefox'; bver = m(/(?:Firefox|FxiOS)\/(\d+)/) }
  else if (/Chrome|CriOS/.test(ua)) { browser = 'Chrome'; bver = m(/(?:Chrome|CriOS)\/(\d+)/) }
  else if (/Safari/.test(ua)) { browser = 'Safari'; bver = m(/Version\/(\d+)/) }
  return { device, os, browser, bver }
}

/**
 * Where a visitor came from. Another site's referrer keeps its host and path
 * (no query, no fragment); this site's own pages are kept as the path they
 * came from, which is how the island leads into the games.
 */
export function parseRef(ref: string | undefined, host: string): { ref_host: string | null; ref_path: string | null; from_path: string | null } {
  const none = { ref_host: null, ref_path: null, from_path: null }
  if (!ref) return none
  let u: URL
  try { u = new URL(ref) } catch { return none }
  if (!/^https?:$/.test(u.protocol)) return none
  const h = u.hostname.replace(/^www\./, '')
  if (h === host.replace(/^www\./, '').split(':')[0]) return { ref_host: null, ref_path: null, from_path: cleanPath(u.pathname) }
  return { ref_host: h.slice(0, 100), ref_path: cleanPath(u.pathname), from_path: null }
}

/** Pages at the top level that are not games. */
const NOT_GAMES = new Set(['privacy', 'admin', 'island', 'og', 'api'])
/** The games' slugs, as a path names them: `/orbit/` is `orbit` (and `/privacy/` is no game). */
export function slugOf(path: string) {
  const s = path.match(/^\/([a-z][a-z0-9-]{1,40})\/$/)?.[1] ?? null
  return s && !NOT_GAMES.has(s) ? s : null
}

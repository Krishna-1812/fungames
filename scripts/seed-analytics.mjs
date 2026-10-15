/**
 * seed-analytics — fill the DEV analytics database (PGlite, in
 * node_modules/.cache/funsite-pglite) with a month of made-up traffic, written
 * through the real ingest, so the admin page has something to draw in
 * `npm run dev`. Stop the dev server first (PGlite allows one process).
 *
 *   node scripts/seed-analytics.mjs
 *
 * It wipes the dev tables first, and refuses to run at all if DATABASE_URL or
 * POSTGRES_URL is set: it must never touch a real database.
 */
if (process.env.DATABASE_URL || process.env.POSTGRES_URL) { console.error('seed-analytics: a real database is configured; refusing.'); process.exit(1) }
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const S = await import('../src/lib/analytics/shape.ts')
const DB = await import('../src/lib/analytics/db.ts')
const I = await import('../src/lib/analytics/ingest.ts')
const { PGlite } = await import('@electric-sql/pglite')
const pg = new PGlite('./node_modules/.cache/funsite-pglite')
DB.useDb({ query: async (t, p = []) => (await pg.query(t, p)).rows })
const d = await DB.getDb()
for (const t of ['events', 'views', 'visitors', 'daily_counts', 'daily_props', 'meta']) await d.query('delete from ' + t)
// The island itself, for taps and looks that land where the buildings are.
const W = await import('../src/lib/island/world.ts'), Ra = await import('../src/lib/island/raster.ts'), G = await import('../src/data/games.ts')
const ISLE = W.buildIsland(G.listedGames().map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: `/${g.slug}/` })), { raster: Ra.resvgRaster })
const [BX, BY, BW, BH] = ISLE.viewBox

let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const wpick = (a) => { const t = a.reduce((s, x) => s + x[1], 0); let r = rnd() * t; for (const x of a) { r -= x[1]; if (r <= 0) return x[0] } return a[0][0] }
const id = () => Array.from({ length: 22 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(rnd() * 62)]).join('')
const PLACES = [
  [['IN', 'MH', 'Mumbai', 19.1, 72.9, 'Asia/Kolkata', 'en-IN'], 30], [['IN', 'KA', 'Bengaluru', 12.97, 77.6, 'Asia/Kolkata', 'en-IN'], 14], [['IN', 'MH', 'Pune', 18.5, 73.9, 'Asia/Kolkata', 'hi-IN'], 10],
  [['US', 'CA', 'San Francisco', 37.8, -122.4, 'America/Los_Angeles', 'en-US'], 16], [['US', 'NY', 'New York', 40.7, -74, 'America/New_York', 'en-US'], 14], [['US', 'TX', 'Austin', 30.3, -97.7, 'America/Chicago', 'en-US'], 6],
  [['GB', 'ENG', 'London', 51.5, -0.1, 'Europe/London', 'en-GB'], 10], [['DE', 'BE', 'Berlin', 52.5, 13.4, 'Europe/Berlin', 'de-DE'], 7], [['FR', 'IDF', 'Paris', 48.9, 2.35, 'Europe/Paris', 'fr-FR'], 5],
  [['BR', 'SP', 'São Paulo', -23.5, -46.6, 'America/Sao_Paulo', 'pt-BR'], 6], [['JP', '13', 'Tokyo', 35.7, 139.7, 'Asia/Tokyo', 'ja-JP'], 6], [['CA', 'ON', 'Toronto', 43.7, -79.4, 'America/Toronto', 'en-CA'], 5],
  [['AU', 'NSW', 'Sydney', -33.9, 151.2, 'Australia/Sydney', 'en-AU'], 4], [['NL', 'NH', 'Amsterdam', 52.4, 4.9, 'Europe/Amsterdam', 'nl-NL'], 3], [['SG', '', 'Singapore', 1.35, 103.8, 'Asia/Singapore', 'en-SG'], 3],
  [['ZA', 'GT', 'Johannesburg', -26.2, 28, 'Africa/Johannesburg', 'en-ZA'], 2], [['MX', 'CMX', 'Mexico City', 19.4, -99.1, 'America/Mexico_City', 'es-MX'], 3], [['KR', '11', 'Seoul', 37.6, 127, 'Asia/Seoul', 'ko-KR'], 2],
]
const UAS = [
  [['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 1536, 864, 1.25, false], 30],
  [['desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15', 1512, 982, 2, false], 14],
  [['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0', 1920, 1080, 1, false], 6],
  [['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', 1920, 1080, 1, false], 6],
  [['phone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 390, 844, 3, true], 24],
  [['phone', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', 412, 915, 2.6, true], 18],
  [['phone', 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36', 384, 854, 3, true], 6],
  [['tablet', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15', 1024, 1366, 2, true], 5],
]
const GAMES = [['orbit', 12], ['asteroid', 14], ['trolley', 11], ['not-a-robot', 9], ['powder', 3], ['deep-sea', 10], ['space-elevator', 7], ['auction', 6], ['life-in-weeks', 9], ['progress', 5], ['who-was-alive', 6], ['spend-it', 7], ['steady-hand', 6], ['fusion', 8], ['rule-cascade', 6], ['paper-folds', 5], ['scale', 6], ['deep-time', 5], ['dark-patterns', 5], ['earth-reviews', 4], ['share-this-page', 3], ['constellation-draw', 4], ['universe-forecast', 3], ['every-second', 3], ['speed', 3], ['day-go', 3], ['internet-artifacts', 4], ['printing-money', 3], ['days-since-incident', 2], ['from-memory', 4], ['overstimulated', 4], ['ambient-mix', 3]]
const RESULT = {
  orbit: () => ({ goal: pick(['circular', 'comet', 'binary', 'assist']), seconds: Math.round(20 + rnd() * 200) }),
  asteroid: () => ({ megatonnes: Math.round(10 ** (rnd() * 6)), place: pick(['Mumbai', 'New York', 'London', 'Tokyo', 'Paris', 'Pune', 'Sydney']), dead: Math.round(10 ** (rnd() * 7)) }),
  trolley: () => ({ position: pick(['Utilitarian', 'Utilitarian', 'Kantian', 'Contractualist', 'Virtue ethicist']), pulls: Math.round(5 + rnd() * 20), saved: Math.round(20 + rnd() * 80) }),
  'not-a-robot': () => ({ verdict: pick(['human', 'human', 'probably human', 'robot']), humanity: Math.round(40 + rnd() * 60), retries: Math.round(rnd() * 6), seconds: Math.round(60 + rnd() * 300) }),
  'life-in-weeks': () => ({ age_decade: pick([10, 20, 20, 20, 30, 30, 40, 50]) }),
  'steady-hand': () => ({ shape: pick(['line', 'circle', 'square', 'spiral']), score: Math.round(300 + rnd() * 650) / 10 }),
  'rule-cascade': () => ({ keystrokes: Math.round(150 + rnd() * 900), seconds: Math.round(120 + rnd() * 900), length: Math.round(20 + rnd() * 60) }),
  'paper-folds': () => ({ folds: Math.round(5 + rnd() * 98), sheet: pick(['a4', 'tissue', 'foil']) }),
  auction: () => ({ net: Math.round(-6000 + rnd() * 9000), bought: Math.round(rnd() * 8) }),
  'deep-sea': () => ({ depthM: 10935 }),
  'space-elevator': () => ({ altitudeM: 100000 }),
  'spend-it': () => ({ kinds: Math.round(3 + rnd() * 27), things: Math.round(5 + rnd() * 400) }),
}
const REFS = [[undefined, 50], ['https://www.google.com/search?q=fun+games', 18], ['https://www.reddit.com/r/InternetIsBeautiful/comments/abc', 9], ['https://t.co/xyz', 5], ['https://news.ycombinator.com/item?id=1', 4], ['https://www.facebook.com/', 3], ['https://duckduckgo.com/', 3], ['https://neal.fun/', 2]]
const POKES = ['whale', 'sheep', 'windmill', 'balloon', 'crab', 'fountain', 'kite', 'gull', 'castaway', 'treasure', 'house32', 'ufo']
const SEARCH = ['space', 'orbit', 'asteroid', 'money', 'trolley', 'robot', 'password game', 'wordle', 'draw', 'ocean', 'infinite craft', 'time']
// What each game's crowd chose (game_pick): a few games in detail, as their pages send them.
const DILEMMAS = [['The classic', [['Pull the lever', 8], ['Do nothing', 2]]], ['The footbridge', [['Push them', 2], ['Do nothing', 8]]], ['The loop', [['Pull the lever', 6], ['Do nothing', 4]]], ['Five old, one young', [['Pull the lever', 4], ['Do nothing', 6]]], ['Your own child', [['Pull the lever', 1], ['Do nothing', 9]]], ['The surgeon', [['Harvest the organs', 1], ['Do nothing', 9]]], ['The self-driving car', [['Swerve', 5], ['Stay the course', 3], ['Override it', 2]]], ['The villain on the track', [['Pull the lever', 7], ['Do nothing', 3]]]]
const PICKS = {
  trolley: () => DILEMMAS.slice(0, 2 + Math.floor(rnd() * 7)).map(([of, opts]) => ['Choice on each dilemma', wpick(opts), of]),
  asteroid: () => [['City hit', wpick([['Mumbai, India', 6], ['New York, USA', 5], ['Chelyabinsk, Russia', 3], ['London, UK', 3], ['Tokyo, Japan', 3], ['Open ocean', 2], ['A spot clicked on land', 4]])], ['Rock size (m)', +(10 ** (1 + rnd() * 3.2)).toPrecision(2)], ['Material', wpick([['Stone', 5], ['Iron', 4], ['Comet ice', 2]])], ['Speed (km/s)', Math.round(11 + rnd() * 60)], ['Entry angle (°)', Math.round(15 + rnd() * 75)]],
  fusion: () => Array.from({ length: Math.floor(rnd() * 6) }, () => ['Element discovered', pick(['Steam', 'Mud', 'Lava', 'Stone', 'Plant', 'Life', 'Cloud', 'Rain', 'Glass', 'Brick', 'Human', 'Volcano'])]),
  'steady-hand': () => ['Line', 'Circle', 'Square', 'Spiral'].map((sh) => ['Score kept, per shape', Math.round({ Line: 82, Circle: 70, Square: 64, Spiral: 48 }[sh] + (rnd() - 0.5) * 40), sh]),
  'dark-patterns': () => ['Confirmshaming', 'Roach motel', 'Hidden costs', 'Sneak into basket', 'Forced continuity', 'Disguised ads'].map((p, i) => ['Fell for each pattern', rnd() < [0.2, 0.5, 0.35, 0.6, 0.45, 0.3][i], p]),
  'rule-cascade': () => Array.from({ length: 3 + Math.floor(rnd() * 12) }, (_, i) => ['Seconds to clear each rule', Math.round(5 + rnd() * (10 + i * 8)), 'Rule ' + (i + 1)]),
  'deep-sea': () => ['Sperm whale', 'Giant squid', 'Anglerfish', 'Gulper eel', 'Dumbo octopus'].slice(0, 1 + Math.floor(rnd() * 5)).map((c) => ['Creature reached', c]),
  'ambient-mix': () => [['Preset picked', wpick([['Thunderstorm', 5], ['3am office', 3], ['Cafe', 4], ['Night train', 2]])], ['Layer brought in', pick(['Rain', 'Dial-up modem', 'Fireplace', 'Birds', 'Keyboard'])]],
  auction: () => ['A Banksy print', 'A signed guitar', 'Moon rock', 'A vintage Rolex', 'The first tweet'].map((lot) => ['What people did on each lot', wpick([['Bought it', 3], ['Bid, then lost it', 4], ['Never bid', 3]]), lot]),
  orbit: () => [['Challenge completed', pick(['A stable orbit', 'A moon', 'A slingshot', 'A binary star', 'A figure eight'])], ['Launch size picked', wpick([['Moon', 4], ['Planet', 5], ['Star', 1]])]],
}
// Where runs stop, when they stop: a number for the games that count their way through.
const STOP = { 'rule-cascade': () => 1 + Math.floor(rnd() * rnd() * 25), trolley: () => 1 + Math.floor(rnd() * 8), 'not-a-robot': () => 1 + Math.floor(rnd() * rnd() * 12), 'deep-sea': () => Math.floor(rnd() * rnd() * 110) * 100, 'space-elevator': () => Math.floor(rnd() * 100) }
const LEVELS = { 'not-a-robot': (i) => 'Check ' + (i + 1), 'rule-cascade': (i) => 'Rule ' + (i + 2), orbit: (i) => (i + 1) + ' / 8 challenges' }
const STACKS = { "Cannot read properties of null (reading 'getContext')": ['TypeError', 'setup orbit-render.js:1:4211', 'start orbit.js:1:902'], 'WebGL context lost': ['Error', 'restore gl.js:1:1880', '(anonymous) fusion.js:1:12044'] }
const NOW = Date.now()
let views = 0, evs = 0
for (let v = 0; v < 420; v++) {
  const [cc, rg, city, lat, lon, tz, lang] = wpick(PLACES)
  const [dev, ua, sw, sh, dpr, touch] = wpick(UAS)
  const eu = S.mustAsk(cc)
  const consent = eu ? wpick([['yes', 6], ['no', 3], ['pending', 1]]) : wpick([['na', 9], ['gpc', 1]])
  const vid = consent === 'yes' || consent === 'na' ? id() : null
  const ip = `10.${v % 250}.${Math.floor(rnd() * 250)}.${Math.floor(rnd() * 250)}`
  const days = wpick([[1, 60], [2, 20], [3, 10], [5, 6], [9, 4]])
  // Most first came this month; some long ago, past the 90 days raw events are kept.
  const firstAgo = rnd() < 0.18 ? 90 + rnd() * 40 : rnd() * 34 + 1
  let gamesSeen = 0
  for (let k = 0; k < days; k++) {
    const dayAgo = Math.max(0, firstAgo - (k * firstAgo) / days - rnd())
    // Evenings are busier, in the visitor's own clock.
    const base = NOW - dayAgo * 864e5
    let t = base - (rnd() * 6 * 3600e3)
    const ref = k === 0 ? wpick(REFS) : undefined
    const utm = ref === undefined && rnd() < 0.08 ? { utm_source: pick(['newsletter', 'twitter']), utm_medium: 'social', utm_campaign: 'launch' } : {}
    const sref = !ref && rnd() < 0.06 ? 'share' : undefined
    const path0 = rnd() < 0.7 ? '/' : '/' + wpick(GAMES) + '/'
    let from
    const pages = [path0, ...Array.from({ length: Math.floor(rnd() * 3.2) }, () => '/' + wpick(GAMES) + '/')]
    for (const [pi, path] of pages.entries()) {
      const pid = id()
      const now = new Date(t)
      const game = S.slugOf(path)
      const e = []
      const at = (dt) => t + dt
      e.push({ n: 'vital', t: at(800), p: { metric: 'LCP', value: Math.round((dev === 'phone' ? 1400 : 900) + rnd() * 2600), rating: 'good' } })
      e.push({ n: 'vital', t: at(900), p: { metric: 'FCP', value: Math.round(500 + rnd() * 1500) } })
      e.push({ n: 'vital', t: at(900), p: { metric: 'TTFB', value: Math.round(40 + rnd() * 500) } })
      e.push({ n: 'vital', t: at(900), p: { metric: 'CLS', value: Math.round(rnd() * rnd() * 300) / 1000 } })
      if (rnd() < 0.6) e.push({ n: 'vital', t: at(9000), p: { metric: 'INP', value: Math.round(40 + rnd() * rnd() * 600) } })
      let engaged = Math.round(4000 + rnd() * 140000)
      if (path === '/') {
        engaged = Math.round(8000 + rnd() * 90000)
        for (let c = 0; c < Math.floor(rnd() * 5); c++) e.push({ n: 'isl_card', t: at(3000 + c * 2000), g: wpick(GAMES) })
        // Taps where they land: mostly on buildings, some round them, on the things to poke or on nothing.
        for (let c = 0; c < Math.floor(rnd() * 9); c++) {
          const a = ISLE.anchors[wpick(GAMES.filter(([g]) => ISLE.anchors[g]))]
          const off = rnd() < 0.7 ? 18 : 140
          e.push({ n: 'isl_tap', t: at(2000 + c * 900), p: { x: Math.round((a.bx + (rnd() - 0.5) * off) / 10) * 10, y: Math.round((a.by - 20 + (rnd() - 0.5) * off) / 10) * 10, z: 1, hit: off < 100 ? 'game' : rnd() < 0.4 ? 'poke' : 'none', what: '' } })
        }
        if (rnd() < 0.45) e.push({ n: 'isl_poke', t: at(5000), p: { kind: pick(POKES.slice(0, rnd() < 0.85 ? 8 : 12)), first: rnd() < 0.6 } })
        if (rnd() < 0.15) e.push({ n: 'isl_bottle', t: at(7000), p: { n: 1 + Math.floor(rnd() * 12), first: true, total: 1 + Math.floor(rnd() * 5) } })
        if (rnd() < 0.2) e.push({ n: 'isl_search', t: at(6000), p: (() => { const q = pick(SEARCH); return { q, results: ['password game', 'wordle', 'infinite craft'].includes(q) ? 0 : 1 + Math.floor(rnd() * 3) } })() })
        if (rnd() < 0.12) e.push({ n: 'isl_surprise', t: at(8000), p: { fresh: 20 }, g: wpick(GAMES) })
        if (rnd() < 0.15) { e.push({ n: 'isl_today', t: at(4000) }); e.push({ n: 'isl_board', t: at(4100), p: { from: 'today' } }); if (rnd() < 0.6) e.push({ n: 'isl_board_go', t: at(5000), p: { row: pick(['today', 'parade', 'ferry', 'whale', 'lighthouse']) } }) }
        if (rnd() < 0.08) e.push({ n: 'isl_postcard', t: at(9000), p: { action: 'made', place: pick(['The Harbour', 'Sky Peaks', 'Old Town']) } })
        if (rnd() < 0.04) e.push({ n: 'isl_postcard', t: at(9500), p: { action: pick(['save', 'share']) } })
        if (rnd() < 0.1) e.push({ n: 'isl_passport', t: at(9000), p: { tab: 'open' } })
        if (rnd() < 0.1) e.push({ n: 'isl_ball', t: at(9000), p: { touch } })
        if (rnd() < 0.15) e.push({ n: 'isl_pigeons', t: at(9000), p: { bell: false } })
        if (rnd() < 0.05) e.push({ n: 'isl_filter', t: at(9000), p: { filter: pick(['science', 'you', 'fun']) } })
        const ds = ['peaks', 'badlands', 'proving', 'harbour', 'funfair', 'market', 'oldtown'].filter(() => rnd() < 0.35)
        // Where the screen rested, every two seconds: round the buildings, wandering.
        const look = new Array(70).fill(0)
        for (let q = 0; q < Math.round(engaged / 2000); q++) {
          const a = ISLE.anchors[wpick(GAMES.filter(([g]) => ISLE.anchors[g]))]
          const cx = Math.floor(((a.bx + (rnd() - 0.5) * 200 - BX) / BW) * 10), cy = Math.floor(((a.by + (rnd() - 0.5) * 160 - BY) / BH) * 7)
          if (cx >= 0 && cx < 10 && cy >= 0 && cy < 7) look[cy * 10 + cx] = Math.min(35, look[cy * 10 + cx] + 1)
        }
        e.push({ n: 'isl_session', t: at(engaged), p: { drags: Math.floor(rnd() * 20), wheels: Math.floor(rnd() * 10), secs: Math.round(engaged / 1000), districts: ds.join(' '), n_districts: ds.length, cards: 2, look: look.map((c) => c.toString(36)).join('') } })
        e.push({ n: 'isl_fps', t: at(13000), p: { fps: Math.round((dev === 'phone' ? 44 : 56) + rnd() * 6), slow: Math.floor(rnd() * 3) } })
        if (pages[pi + 1]) e.push({ n: 'isl_dive', t: at(engaged - 500), p: { from: rnd() < 0.15 ? 'surprise' : 'map' }, g: S.slugOf(pages[pi + 1]) })
      } else if (game) {
        gamesSeen++
        if (rnd() < 0.82) {
          e.push({ n: 'game_start', t: at(3000), p: { after_ms: 3000 } })
          if (rnd() < 0.08) e.push({ n: 'game_howto', t: at(2000) })
          for (const [what, v, of] of PICKS[game]?.() ?? []) e.push({ n: 'game_pick', t: at(4000), p: of ? { what, v, of } : { what, v } })
          const lv = Math.floor(rnd() * rnd() * 7)
          for (let i = 0; i < lv; i++) e.push({ n: 'game_level', t: at(5000 + i * 3000), p: { text: LEVELS[game]?.(i) ?? ['Halfway', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6'][i], i: i + 1 } })
          if (rnd() >= 0.55) e.push({ n: 'game_quit', t: at(30000), p: { ms: Math.round(5000 + rnd() * 120000), levels: lv, ...(STOP[game] ? { at: STOP[game]() } : lv ? { at: LEVELS[game]?.(lv - 1) ?? 'Level ' + (lv + 1) } : {}) } })
          else {
            const ms = Math.round(20000 + rnd() * rnd() * 400000)
            e.push({ n: 'game_end', t: at(ms), p: { kind: rnd() < 0.7 ? 'win' : 'lose', score: String(Math.round(rnd() * 100)), ms } })
            if (RESULT[game]) e.push({ n: 'game_result', t: at(ms), p: RESULT[game](), g: game })
            if (rnd() < 0.2) e.push({ n: 'game_best', t: at(ms), p: { kind: 'beaten' } })
            if (rnd() < 0.15) e.push({ n: 'share', t: at(ms + 3000), p: { outcome: wpick([['shared', 5], ['copied', 3], ['downloaded', 2], ['dismissed', 1]]) } })
            if (rnd() < 0.25) e.push({ n: 'game_restart', t: at(ms + 5000), p: { from: 'again' } })
          }
          if (rnd() < 0.1) e.push({ n: 'sound', t: at(4000), p: { on: true } })
        }
        if (rnd() < 0.02) {
          const msg = pick(["Cannot read properties of null (reading 'getContext')", 'WebGL context lost', 'ResizeObserver loop limit exceeded'])
          const st = STACKS[msg]
          e.push({ n: 'error', t: at(5000), g: game, p: { msg, src: `${game}.js`, line: 1, col: 1 + Math.floor(rnd() * 3) * 400, kind: 'error', ...(st ? { type: st[0], st1: st[1], st2: st[2] } : {}) } })
        }
      }
      if (rnd() < 0.015) e.push({ n: 'outbound', t: at(6000), p: { host: 'buymeacoffee.com', path: '/krishna18' } })
      const view = { path, ref: pi === 0 ? ref : undefined, title: path, sw, sh, vw: sw, vh: sh - 120, dpr, touch, lang, tz, dark: rnd() < 0.42, rm: rnd() < 0.05, conn: ua.includes('Chrome') ? pick(['4g', '4g', '4g', '3g']) : undefined, mem: 8, cpu: 8, first_days: Math.round(Math.max(0, firstAgo - dayAgo)), games_seen: gamesSeen, visit_days: k + 1, sref: pi === 0 ? sref : undefined, ...(pi === 0 ? utm : {}) }
      if (from) view.ref = 'http://localhost:4321' + from
      const body = JSON.stringify({ v: 1, pid, vid, c: consent, view, e: e.map((x) => ({ ...x, t: Math.min(x.t, t + 86e6) })), eng: { ms: engaged, scroll: Math.round(rnd() * 100) } })
      const b = S.parseBatch(body, t + 864e5 - 1000)
      if (!b) throw new Error('bad batch')
      // The events' own times are kept as given; the view is stamped when the page opened.
      await I.ingest(d, b, { ip, ua, host: 'localhost:4321', country: cc, region: rg || null, city, lat, lon }, now)
      views++; evs += b.events.length
      from = path
      t += engaged + 2000
    }
  }
}
// A crowd for every game that shows its players one (lib/analytics/crowd.ts),
// big enough to pass its minimum, with the games' own names and answers.
{
  const Dl = await import('../src/data/dilemmas.ts'), DP = await import('../src/lib/dark-patterns.ts'), Lt = await import('../src/data/lots.ts'), Me = await import('../src/data/memory.ts'), CT = await import('../src/lib/constellation-trace.ts'), SC = await import('../src/lib/star-catalog.ts')
  const figs = SC.CONSTELLATIONS.slice(0, 12).map((c) => CT.figureName(c.id ?? c.abbr ?? c))
  const lean = DP.PATTERNS.map(() => 0.2 + rnd() * 0.6)
  const CROWD = {
    trolley: () => Dl.DILEMMAS.map((x) => { const p = 0.15 + (Math.sin(x.title.length * 7.1) + 1) * 0.35; return ['Choice on each dilemma', rnd() < p ? x.left.label : x.right.label, x.title] }),
    'dark-patterns': () => DP.PATTERNS.map((p, i) => ['Fell for each pattern', rnd() < lean[i], p.title]),
    auction: () => Lt.CATALOGUE.slice(0, 8).map((lot) => ['What people did on each lot', wpick([['Bought it', 3], ['Bid, then lost it', 4], ['Never bid', 3]]), lot.title]),
    'steady-hand': () => ['Line', 'Circle', 'Square', 'Spiral'].map((sh) => ['Score kept, per shape', Math.max(5, Math.min(99, Math.round({ Line: 82, Circle: 70, Square: 64, Spiral: 48 }[sh] + (rnd() - 0.5) * 40))), sh]),
    'from-memory': () => Me.ITEMS.map((it) => ['Likeness for each thing (%)', Math.round(15 + rnd() * rnd() * 80), it.reveal]),
    'constellation-draw': () => figs.map((n) => ['Accuracy, per figure', Math.round(20 + rnd() * 75), n]),
    'rule-cascade': () => Array.from({ length: 31 }, (_, i) => ['Seconds to clear each rule', Math.round(3 + rnd() * (8 + (i % 7) * 9)), 'Rule ' + (i + 1)]),
    'spend-it': () => { const p = Math.round(rnd() < 0.12 ? 100 : rnd() * 99); return [['Spent it all', p === 100], ['Fortune spent (%)', p]] },
  }
  for (const [game, make] of Object.entries(CROWD)) for (let k = 0; k < 140; k++) {
    const t = NOW - rnd() * 20 * 864e5
    const e = make().map(([what, v, of]) => ({ n: 'game_pick', t: t + 4000, p: of ? { what, v, of } : { what, v } }))
    const b = S.parseBatch(JSON.stringify({ v: 1, pid: id(), c: 'na', view: { path: '/' + game + '/' }, e: [{ n: 'game_start', t: t + 3000 }, ...e] }), t + 864e5 - 1000)
    if (!b) throw new Error('bad crowd batch ' + game)
    await I.ingest(d, b, { ip: '10.9.' + (k % 250) + '.1', ua: UAS[0][0][1], host: 'localhost:4321', country: 'IN', region: null, city: null, lat: null, lon: null }, new Date(t))
    views++; evs += b.events.length
  }
}
// A few broken links.
for (const p of ['/powdr/', '/orbit/x/', '/old-page/']) {
  const b = S.parseBatch(JSON.stringify({ v: 1, pid: id(), view: { path: p, status: 404 }, e: [{ n: 'notfound', t: NOW - 3600e3, p: { path: p } }] }), NOW)
  await I.ingest(d, b, { ip: '1.1.1.1', ua: UAS[0][0][1], host: 'localhost:4321', country: 'US', region: null, city: null, lat: null, lon: null }, new Date(NOW - 3600e3))
}
// Someone here now.
for (const [cc, city, lat, lon, path] of [['IN', 'Mumbai', 19.1, 72.9, '/orbit/'], ['US', 'Austin', 30.3, -97.7, '/'], ['GB', 'London', 51.5, -0.1, '/trolley/']]) {
  const b = S.parseBatch(JSON.stringify({ v: 1, pid: id(), vid: id(), c: 'na', view: { path }, e: [{ n: 'game_start', t: NOW - 30000 }] }), NOW)
  await I.ingest(d, b, { ip: '9.9.9.' + Math.floor(rnd() * 200), ua: UAS[4][0][1], host: 'localhost:4321', country: cc, region: null, city, lat, lon }, new Date(NOW - 60000))
}
// The nightly summaries, over everything just written: days past 90 are counted, then their raw events go.
const R0 = await import('../src/lib/analytics/rollup.ts')
const run = await R0.nightly(d, new Date(), 200)
console.log('seeded', views, 'views', evs, 'events; summarised', run.rolled.length, 'days and trimmed', run.trimmed, 'events past 90 days')
await pg.close()

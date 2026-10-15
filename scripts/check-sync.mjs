/**
 * check-sync — save codes and daily reminders: does progress survive the trip
 * between devices, and does a reminder reach only the right browser at the
 * right hour?
 *
 * The merge (src/lib/sync.ts):
 * - each record keeps the better of both sides: every stamp, the earliest
 *   first visit, the higher best (the lower, where lower is better), the
 *   longest streak, everything found;
 * - merging is order-free and a merge of a merge changes nothing, so any
 *   number of devices can check in any number of times;
 * - only progress is carried, never a preference or anything personal, and
 *   nothing over the size limits; LOW_BESTS names every game that records a
 *   lower-is-better best.
 *
 * The server (src/lib/saves.ts), on a real Postgres (PGlite, in memory): a
 * code is made, read back, refused on a stale revision with what is there
 * now, and deleted; only a hash of the code is stored.
 *
 * The reminders (src/lib/push.ts): a message encrypted for one browser
 * decrypts with that browser's key (RFC 8291, checked by decrypting it here
 * the way a browser would); the sender's signature verifies (RFC 8292); a
 * reminder is due only in its hour, never twice a day, never once the day's
 * challenge is played; push addresses outside the browsers' push services are
 * refused; the calendar file is a daily event at the hour asked for.
 *
 *   node scripts/check-sync.mjs
 */
import { register } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
register('./resolve-ts.mjs', import.meta.url)

const S = await import('../src/lib/sync.ts')
const DB = await import('../src/lib/analytics/db.ts')
const SV = await import('../src/lib/saves.ts')
const P = await import('../src/lib/push.ts')
const R = await import('../src/lib/remind.ts')
const { PGlite } = await import('@electric-sql/pglite')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const J = (o) => JSON.stringify(o)
const P_ = (s) => JSON.parse(s)

/* ---- the merge ---------------------------------------------------------- */
console.log('merge')
const laptop = {
  'funsite:stats': J({ v: 1, games: {
    'steady-hand': { plays: 5, at: '2026-10-10', bests: { score: { value: 80, at: '2026-10-01' } }, last: { score: 70 } },
    'rule-cascade': { plays: 2, at: '2026-10-09', bests: { seconds: { value: 120, at: '2026-10-09' }, keystrokes: { value: 400, at: '2026-10-09' } }, last: {} },
  } }),
  'funsite:passport': J({ v: 1, visits: { trolley: { first: '2026-09-01', last: '2026-10-01', days: 4 }, auction: { first: '2026-10-02', last: '2026-10-02', days: 1, old: true } }, seen: ['trolley'] }),
  'funsite:daily': J({ v: 1, days: { '2026-10-14': { g: 'auction', ok: false }, '2026-10-15': { g: 'trolley', ok: true } }, best: 3 }),
  'funsite:quests': J({ v: 1, done: { landfall: '2026-09-01' }, seen: ['landfall'], sent: 2, won: 0 }),
  'funsite:bottles': J({ v: 1, found: { 1: '2026-09-03', 4: '2026-09-10' }, cover: 'navy' }),
  'isl-found': J(['ufo', 'whale']),
  'isl-welcomed': '1',
  'paper:best:steady-hand': J({ value: 80, text: '80%' }),
  'fusion:v1': J({ items: [{ text: 'Water' }, { text: 'Steam' }], recipes: { '["fire","water"]': { text: 'Steam' } }, version: 2 }),
  'isl-world': 'real', 'sound:muted': '1', 'life-in-weeks:dob': '1990-01-01', 'funsite:sync': J({ code: 'X' }),
}
const phone = {
  'funsite:stats': J({ v: 1, games: {
    'steady-hand': { plays: 3, at: '2026-10-12', bests: { score: { value: 91, at: '2026-10-12' } }, last: { score: 91 } },
    'rule-cascade': { plays: 4, at: '2026-10-11', bests: { seconds: { value: 95, at: '2026-10-11' }, keystrokes: { value: 450, at: '2026-10-11' } }, last: {} },
    trolley: { plays: 1, at: '2026-10-12', bests: {}, last: { kind: 'utilitarian' } },
  } }),
  'funsite:passport': J({ v: 1, visits: { trolley: { first: '2026-08-20', last: '2026-09-15', days: 6 }, auction: { first: '2026-09-28', last: '2026-10-05', days: 2 }, deep: { first: '2026-10-11', last: '2026-10-11', days: 1 } }, seen: ['deep'] }),
  'funsite:daily': J({ v: 1, days: { '2026-10-14': { g: 'auction', ok: true }, '2026-10-16': { g: 'rule-cascade', ok: false } }, best: 2 }),
  'funsite:quests': J({ v: 1, done: { landfall: '2026-08-20', regular: '2026-09-01' }, seen: [], sent: 1, won: 1 }),
  'funsite:bottles': J({ v: 1, found: { 4: '2026-09-01', 7: '2026-09-20' }, cover: 'glacier' }),
  'isl-found': J(['whale', 'ferry']),
  'paper:best:steady-hand': J({ value: 91, text: '91%' }),
  'paper:best:auction': J({ value: 1000500, text: '+£500' }),
  'fusion:v1': J({ items: [{ text: 'water' }, { text: 'Cloud' }], recipes: { '["air","water"]': { text: 'Cloud' } }, version: 2 }),
}
const m = S.merge(laptop, phone)
const st = P_(m['funsite:stats']).games
check(st['steady-hand'].bests.score.value === 91 && st['steady-hand'].plays === 5 && st['steady-hand'].at === '2026-10-12', 'stats: the higher best, the most plays, the latest day')
check(st['rule-cascade'].bests.seconds.value === 95 && st['rule-cascade'].bests.keystrokes.value === 400, 'stats: lower-is-better bests keep the lower (Rule Cascade)')
check(st.trolley?.plays === 1 && st['steady-hand'].last.score === 91, 'stats: a game only one side played is kept; the last result is the newer side’s')
const pp = P_(m['funsite:passport'])
check(pp.visits.trolley.first === '2026-08-20' && pp.visits.trolley.last === '2026-10-01' && pp.visits.trolley.days === 6, 'passport: earliest first visit, latest last, most days')
check(!pp.visits.auction.old && pp.visits.deep && pp.seen.includes('trolley') && pp.seen.includes('deep'), 'passport: a guessed day loses to a known one; stamps and seen-marks from both')
const dl = P_(m['funsite:daily'])
check(Object.keys(dl.days).length === 3 && dl.days['2026-10-14'].ok === true && dl.best === 3, 'daily: every day played on either, a day beaten on either is beaten, the longer best streak')
const q = P_(m['funsite:quests'])
check(q.done.landfall === '2026-08-20' && q.done.regular && q.sent === 2 && q.won === 1, 'quests: every quest done, dated when first done; the higher counts')
const bt = P_(m['funsite:bottles'])
check(Object.keys(bt.found).length === 3 && bt.found[4] === '2026-09-01' && bt.cover === 'glacier', 'bottles: every bottle, first found date; a chosen cover beats the as-issued one')
check(J(P_(m['isl-found']).sort()) === J(['ferry', 'ufo', 'whale']), 'sightings: everything seen on either')
check(P_(m['paper:best:steady-hand']).value === 91 && P_(m['paper:best:auction']).value === 1000500, 'each game’s best: the higher, and one only one side has')
check(P_(m['fusion:v1']).items.length === 3 && Object.keys(P_(m['fusion:v1']).recipes).length === 2, 'Fusion: elements from both (case-blind), recipes from both')
check(m['isl-welcomed'] === '1', 'welcomed on one is welcomed on both')
check(!('isl-world' in m) && !('sound:muted' in m) && !('life-in-weeks:dob' in m) && !('funsite:sync' in m), 'preferences, a date of birth and the code itself are never carried')
const m2 = S.merge(phone, laptop)
const norm = (r) => J(Object.fromEntries(Object.keys(r).sort().map((k) => [k, k === 'funsite:bottles' ? { ...P_(r[k]), cover: 0 } : k === 'fusion:v1' ? sortDeep(P_(r[k].toLowerCase())) : k.startsWith('isl-welcomed') ? r[k] : sortDeep(P_(r[k]))])))
function sortDeep(v) { return Array.isArray(v) ? v.map(sortDeep).sort((a, b) => (J(a) < J(b) ? -1 : 1)) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])])) : v }
check(norm(m) === norm(m2), 'the merge is order-free (but for the cover, each device’s own choice, and the order things are listed in)')
check(J(S.merge(m, phone)) === J(m) && J(S.merge(m, m)) === J(m), 'a merge of a merge changes nothing')
check(S.merge({ 'funsite:stats': '{broken' }, phone)['funsite:stats'] === S.merge({}, phone)['funsite:stats'], 'an unreadable record gives way to the other side’s')
check(S.merge({ 'paper:best:../../x': '{}', 'paper:best:ok': J({ value: 1, text: '1' }) }, {})['paper:best:ok'] && !S.merge({ 'paper:best:../../x': '{}' }, {})['paper:best:../../x'], 'only well-formed best keys are carried')
const proto = S.merge({ 'funsite:quests': '{"done":{"__proto__":{"x":1}}}' }, { 'funsite:quests': '{"done":{"a":"2026-01-01"}}' })
check(!({}).x && !Object.keys(P_(proto['funsite:quests']).done).includes('__proto__'), 'a __proto__ key in a record is dropped, not merged')
const big = S.fit({ 'funsite:stats': 'x'.repeat(S.MAX_ONE + 1), 'isl-found': '[]' })
check(!big['funsite:stats'] && big['isl-found'] === '[]', 'a record over the size limit stays behind; the rest still goes')

// Every recordPlay with a 'low' best is in LOW_BESTS.
const lows = []
for (const f of readdirSync('src/pages').filter((f) => f.endsWith('.astro'))) {
  for (const mm of readFileSync(`src/pages/${f}`, 'utf8').matchAll(/recordPlay\(\s*'([a-z0-9-]+)'[^\n]*?\{([^}]*'low'[^}]*)\}\s*\)/g)) {
    for (const k of mm[2].matchAll(/(\w+)\s*:\s*'low'/g)) lows.push(`${mm[1]}.${k[1]}`)
  }
}
const listed = Object.entries(S.LOW_BESTS).flatMap(([g, ks]) => ks.map((k) => `${g}.${k}`))
check(lows.length > 0 && lows.every((l) => listed.includes(l)), `LOW_BESTS covers every lower-is-better best (${lows.join(', ')})`)

// The codes.
const codes = new Set(Array.from({ length: 2000 }, () => SV.newCode()))
check(codes.size === 2000 && [...codes].every((c) => S.CODE_RE.test(c)), 'codes: 16 characters from the alphabet, no repeats in 2,000')
const freq = {}; for (const c of codes) for (const ch of c) freq[ch] = (freq[ch] ?? 0) + 1
const counts = Object.values(freq)
check(Object.keys(freq).length === 30 && Math.max(...counts) / Math.min(...counts) < 1.25, 'codes: every character about as likely as every other')
const c0 = [...codes][0]
check(S.cleanCode(` ${S.showCode(c0).toLowerCase()} `) === c0 && S.cleanCode(`https://x.app/#save=${c0}`) === c0 && S.cleanCode('ABCD-EFGH') === null && S.cleanCode('0000-1111-OOOO-IIII') === null, 'a typed code: dashes, spaces, case and a whole link forgiven; anything else refused')

/* ---- the server --------------------------------------------------------- */
console.log('server')
const pg = new PGlite()
DB.useDb({ query: async (t, p = []) => (await pg.query(t, p)).rows })
const d = await DB.getDb()
check(SV.cleanRecords({ 'isl-world': 'x' }) === null && SV.cleanRecords({ 'isl-found': 5 }) === null && SV.cleanRecords([]) === null && J(SV.cleanRecords({ 'isl-found': '[]' })) === J({ 'isl-found': '[]' }), 'only carried records, as text, are accepted')
const made = await SV.makeSave(d, { 'isl-found': '["ufo"]' })
const raw = await d.query('select id from saves')
check(made.rev === 1 && raw.length === 1 && raw[0].id !== made.code && !raw[0].id.includes(made.code), 'a save is made; the table holds a hash, not the code')
const got = await SV.getSave(d, made.code)
check(got?.rev === 1 && got.data['isl-found'] === '["ufo"]', 'read back by its code')
check((await SV.getSave(d, SV.newCode())) === null && (await SV.getSave(d, 'not-a-code')) === null, 'an unknown or malformed code finds nothing')
const put1 = await SV.putSave(d, made.code, 1, { 'isl-found': '["ufo","whale"]' })
check(put1?.ok === true && put1.rev === 2, 'a write on the current revision goes through')
const stale = await SV.putSave(d, made.code, 1, { 'isl-found': '["ferry"]' })
check(stale?.ok === false && stale.rev === 2 && stale.data['isl-found'] === '["ufo","whale"]', 'a write on a stale revision is refused, with what is there now')
check((await SV.dropSave(d, made.code)) === true && (await SV.getSave(d, made.code)) === null, 'a save deleted is gone')

/* ---- the reminders ------------------------------------------------------ */
console.log('reminders')
const te = new TextEncoder()
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length } return o }
const hmac = async (k, d) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), d))
// A browser: its key pair and auth secret.
const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey))
const auth = crypto.getRandomValues(new Uint8Array(16))
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: P.b64u(uaPub), auth: P.b64u(auth) }
const msg = { title: 'Keep your 4-day streak going', body: 'Steady Hand: draw it', url: '/steady-hand/' }
const body = await P.encrypt(sub, te.encode(J(msg)))
// Decrypt it as the browser would (RFC 8291 §3.4, from the receiving side).
const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset).getUint32(16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen)
const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256))
const ikm = await hmac(await hmac(auth, shared), cat(te.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])))
const prk = await hmac(salt, ikm)
const cek = (await hmac(prk, cat(te.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
const nonce = (await hmac(prk, cat(te.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
let plain = null
try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct)) } catch { /* fails below */ }
check(rs === 4096 && idlen === 65 && plain && plain[plain.length - 1] === 2 && new TextDecoder().decode(plain.slice(0, -1)) === J(msg), 'a reminder decrypts with the browser’s key, and only as one final record')
const other = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
const wrongShared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, other.privateKey, 256))
check(J(wrongShared) !== J(shared), 'and another browser’s key gets a different secret')

// The sender's signature.
const vk = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const vPub = new Uint8Array(await crypto.subtle.exportKey('raw', vk.publicKey)), vJwk = await crypto.subtle.exportKey('jwk', vk.privateKey)
const vapid = { publicKey: P.b64u(vPub), privateKey: vJwk.d, subject: 'https://fungames-mu.vercel.app/' }
const header = await P.vapidAuth(sub.endpoint, vapid, Date.parse('2026-10-16T12:00:00Z'))
const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/) ?? []
const [h64, c64, s64] = (jwt ?? '..').split('.')
const claims = jwt ? JSON.parse(new TextDecoder().decode(P.unb64u(c64))) : {}
const verified = jwt && (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk.publicKey, P.unb64u(s64), te.encode(`${h64}.${c64}`)))
check(verified && k === vapid.publicKey && claims.aud === 'https://fcm.googleapis.com' && claims.exp === Date.parse('2026-10-16T12:00:00Z') / 1000 + 43200, 'the sender’s signature verifies; addressed to the push service, good for 12 hours')
process.env.VAPID_PUBLIC_KEY = vapid.publicKey; process.env.VAPID_PRIVATE_KEY = vapid.privateKey
check(P.vapidKeys()?.publicKey === vapid.publicKey, 'the keys are read from the environment')
delete process.env.VAPID_PRIVATE_KEY
check(P.vapidKeys() === null, 'and with one missing, reminders are off')

check(['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://db5p.notify.windows.com/w/?token=x'].every(P.okEndpoint), 'push addresses: Chrome’s, Firefox’s, Safari’s and Edge’s')
check(!['http://fcm.googleapis.com/x', 'https://evil.example/x', 'https://fcm.googleapis.com.evil.example/x', 'https://localhost/x', 'https://fcm.googleapis.com:8443/x', 'https://169.254.169.254/x'].some(P.okEndpoint), 'anything else (another host, plain http, a port, an internal address) is refused')

// Who is due, and when.
const now = new Date('2026-10-16T12:40:00Z') // 18:10 in Kolkata, 05:40 in Los Angeles
const row = (o) => ({ ...sub, tz: 'Asia/Kolkata', hour: 18, streak: 0, through: null, done: null, sent: null, ...o })
check(P.due([row({})], now).length === 1, 'due in its hour, where the visitor is')
check(P.due([row({ hour: 17 })], now).length === 1 && P.due([row({ hour: 15 })], now).length === 0, 'a late run still reminds within three hours; not after')
check(P.due([row({ hour: 19 })], now).length === 0, 'not before its hour')
check(P.due([row({ sent: '2026-10-16' })], now).length === 0, 'never twice in a day')
check(P.due([row({ done: '2026-10-16' })], now).length === 0, 'never once today’s challenge is played')
check(P.due([row({ tz: 'America/Los_Angeles', hour: 5 })], now).length === 1 && P.due([row({ tz: 'America/Los_Angeles' })], now).length === 0, 'time zones: the visitor’s own hour')
check(P.localNow('Not/AZone', now).hour === 12 && !P.okTz('Not/AZone') && P.okTz('Europe/London'), 'an unknown time zone is refused (and would fall back to UTC)')
const w1 = P.words({ streak: 4, through: '2026-10-15' }, now), w0 = P.words({ streak: 4, through: '2026-10-13' }, now)
check(/4-day streak/.test(w1.title) && !/streak/.test(w0.title) && w1.url.endsWith('/?ref=remind') && w1.body.length > 5, 'the words: a live streak named, a lapsed one not; the link goes to today’s game')

// The run itself, against the table, with a push service that answers as asked.
process.env.VAPID_PRIVATE_KEY = vapid.privateKey
const sent = []
const realFetch = globalThis.fetch
globalThis.fetch = async (url) => { sent.push(url); return new Response(null, { status: url.endsWith('/gone') ? 410 : 201 }) }
for (const [ep, o] of [['https://fcm.googleapis.com/a', {}], ['https://fcm.googleapis.com/gone', {}], ['https://fcm.googleapis.com/later', { hour: 21 }], ['https://fcm.googleapis.com/played', { done: '2026-10-16' }]]) {
  const r = row({ endpoint: ep, ...o })
  await d.query('insert into push_subs (endpoint, p256dh, auth, tz, hour, done) values ($1, $2, $3, $4, $5, $6)', [r.endpoint, r.p256dh, r.auth, r.tz, r.hour, r.done])
}
const run1 = await P.remindAll(d, now)
const run2 = await P.remindAll(d, now)
globalThis.fetch = realFetch
const left = (await d.query('select endpoint from push_subs order by endpoint')).map((r) => r.endpoint)
check(run1.sent === 1 && run1.gone === 1 && sent.length === 2 && run2.due === 0, 'a run reminds whoever is due, once; a second run that day sends nothing')
check(!left.includes('https://fcm.googleapis.com/gone') && left.length === 3, 'a browser that has unsubscribed is forgotten')
check((await P.claimHour(d, now)) === true && (await P.claimHour(d, now)) === false && (await P.claimHour(d, new Date(now.getTime() + 3600e3))) === true, 'one run an hour: the second ask in an hour does nothing')

// The calendar instead.
const ics = R.calendarText(19, 'https://fungames-mu.vercel.app', new Date(2026, 9, 16, 9))
check(/DTSTART:20261017T190000\r\n/.test(ics) && /RRULE:FREQ=DAILY\r\n/.test(ics) && /BEGIN:VALARM/.test(ics) && ics.split('\r\n').every((l) => l.length <= 75), 'the calendar file: daily from tomorrow at the hour asked, with an alert, in short lines')

/* ---- wiring ---------------------------------------------------------------- */
console.log('wiring')
const paper = readFileSync('src/layouts/Paper.astro', 'utf8'), home = readFileSync('src/components/IslandHome.astro', 'utf8'), sw = readFileSync('public/sw.js', 'utf8')
check(/startSync\(\)/.test(paper) && /rel="manifest"/.test(paper), 'every page checks in its save code, and names the manifest')
check(/data-sheet="save"/.test(home) && /#save/.test(home), 'the passport has its Save page, and a save link opens it')
check(/addEventListener\('push'/.test(sw) && /notificationclick/.test(sw) && !/addEventListener\('fetch'/.test(sw), 'the service worker shows reminders and caches nothing')
const daily = readFileSync('src/lib/daily-ui.ts', 'utf8')
check(/reportDone\(\)/.test(daily), 'finishing the daily challenge tells the reminders')
const wf = readFileSync('.github/workflows/remind.yml', 'utf8')
check(/cron: '2 \* \* \* \*'/.test(wf) && /\/api\/cron\/remind\//.test(wf), 'the reminders run every hour')

console.log(failures ? `\n${failures} failed` : '\nall passed')
process.exit(failures ? 1 : 0)

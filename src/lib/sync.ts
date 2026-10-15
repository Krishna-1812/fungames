/**
 * Your progress on another device: a save code.
 *
 * Everything the site remembers lives in this browser's storage, which is
 * lost with a cleared profile and does not follow you from a laptop to a
 * phone. A save code fixes both without an account, a password or an email
 * address: the browser asks for a code (16 random letters and digits, made
 * on the server), sends its records up under it, and any browser given the
 * code brings them down.
 *
 * The records are merged, never replaced. Both devices may have played since
 * they last met, so each record keeps the better of both: every stamp either
 * one has, the earliest first visit, the higher best, the longest streak, the
 * union of what has been found. A merge of a merge is the same merge, which is
 * what makes it safe to run on every visit and from any number of devices.
 *
 * What is carried is the progress, not the preferences or anything personal:
 * not the island's world or sound setting (those belong to the device), not a
 * date of birth typed into Life in Weeks, not the half-built scene in a
 * sandbox. `check-sync.mjs` holds every merge to that.
 *
 * The server keeps the records as the browser wrote them, under a hash of the
 * code (src/pages/api/save.ts), and the code itself only ever travels in a
 * request body or a URL fragment, which no server log or Referer sees.
 */
import { siteStore, type Store } from './stats'

/** Where this browser keeps its own code. Not itself carried. */
export const SYNC_KEY = 'funsite:sync'

/** The records carried, by exact key. */
export const CARRIED = [
  'funsite:stats', 'funsite:passport', 'funsite:daily', 'funsite:quests', 'funsite:bottles',
  'isl-found', 'isl-seasons', 'isl-welcomed',
  'steady-hand:bests.v1', 'orbit.progress.v1', 'powder.found.v1', 'powder.scenarios.v1', 'fusion:v1',
] as const
/** And by prefix: each game's best (lib/game-shell.ts). */
export const CARRIED_PREFIX = 'paper:best:'

export const carried = (k: string) => (CARRIED as readonly string[]).includes(k) || (k.startsWith(CARRIED_PREFIX) && /^[a-z0-9-]{1,40}$/.test(k.slice(CARRIED_PREFIX.length)))

/** Bests where lower is better (stats.ts recordPlay's 'low'); every other best is higher-is-better. */
export const LOW_BESTS: Record<string, string[]> = { 'rule-cascade': ['keystrokes', 'seconds'] }

/** The most one record, and all of them, may weigh (the server holds the same limits). */
export const MAX_ONE = 64_000
export const MAX_ALL = 200_000

/** A code: 16 of these, shown in fours. No 0/O, 1/I/L or U, so it can be read aloud and typed back. */
export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CODE_RE = new RegExp(`^[${ALPHABET}]{16}$`)
/** Whatever was typed or pasted (a whole link, too), as a code if it can be one: spaces, dashes and case forgiven. */
export function cleanCode(s: string): string | null {
  const c = s.replace(/^.*#save=/, '').toUpperCase().replace(/[\s-]/g, '')
  return CODE_RE.test(c) ? c : null
}
export const showCode = (c: string) => c.replace(/(.{4})(?=.)/g, '$1-')

export type Records = Record<string, string>

/* ---- merging ------------------------------------------------------------ */

type O = Record<string, unknown>
const isObj = (v: unknown): v is O => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown) => (typeof v === 'string' ? v : null)
const maxN = (a: unknown, b: unknown) => { const x = num(a), y = num(b); return x === null ? y ?? 0 : y === null ? x : Math.max(x, y) }
/** The earlier (or later) of two ISO days; either may be missing. */
const earlier = (a: unknown, b: unknown) => { const x = str(a), y = str(b); return !x ? y : !y ? x : x < y ? x : y }
const later = (a: unknown, b: unknown) => { const x = str(a), y = str(b); return !x ? y : !y ? x : x > y ? x : y }
const union = (a: unknown, b: unknown): unknown[] => {
  const out: unknown[] = [], seen = new Set<string>()
  for (const v of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) { const k = JSON.stringify(v); if (!seen.has(k)) { seen.add(k); out.push(v) } }
  return out
}
/** Each key of either object, merged by `f`. A key only one side has is merged with itself, so it comes out in the same shape as a merged one. */
const byKey = (a: unknown, b: unknown, f: (x: unknown, y: unknown, k: string) => unknown): O => {
  const x = isObj(a) ? a : {}, y = isObj(b) ? b : {}, out: O = {}
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
    out[k] = !(k in y) ? f(x[k], x[k], k) : !(k in x) ? f(y[k], y[k], k) : f(x[k], y[k], k)
  }
  return out
}

function stats(a: unknown, b: unknown) {
  const x = isObj(a) ? a : {}, y = isObj(b) ? b : {}
  return {
    ...x, v: maxN(x.v, y.v) || 1,
    games: byKey(x.games, y.games, (g, h, slug) => {
      const p = isObj(g) ? g : {}, q = isObj(h) ? h : {}
      const newer = (str(q.at) ?? '') > (str(p.at) ?? '') ? q : p
      const low = LOW_BESTS[slug] ?? []
      return {
        plays: maxN(p.plays, q.plays), at: later(p.at, q.at), last: newer.last ?? {},
        bests: byKey(p.bests, q.bests, (m, n, field) => {
          const mv = num(isObj(m) ? m.value : null), nv = num(isObj(n) ? n.value : null)
          if (mv === null) return n
          if (nv === null) return m
          return (low.includes(field) ? nv < mv : nv > mv) ? n : m
        }),
      }
    }),
  }
}

function passport(a: unknown, b: unknown) {
  const x = isObj(a) ? a : {}, y = isObj(b) ? b : {}
  return {
    ...x, v: maxN(x.v, y.v) || 1,
    visits: byKey(x.visits, y.visits, (m, n) => {
      const p = isObj(m) ? m : {}, q = isObj(n) ? n : {}
      const v: O = { first: earlier(p.first, q.first), last: later(p.last, q.last), days: Math.max(1, maxN(p.days, q.days)) }
      // A guessed day stays a guess only if neither side knows better.
      if (p.old && q.old) v.old = true
      return v
    }),
    seen: union(x.seen, y.seen),
  }
}

function daily(a: unknown, b: unknown) {
  const x = isObj(a) ? a : {}, y = isObj(b) ? b : {}
  return {
    ...x, v: maxN(x.v, y.v) || 1,
    days: byKey(x.days, y.days, (m, n) => { const p = isObj(m) ? m : {}, q = isObj(n) ? n : {}; return { g: p.g ?? q.g, ok: !!(p.ok || q.ok) } }),
    best: maxN(x.best, y.best),
  }
}

function quests(a: unknown, b: unknown) {
  const x = isObj(a) ? a : {}, y = isObj(b) ? b : {}
  return { ...x, v: maxN(x.v, y.v) || 1, done: byKey(x.done, y.done, earlier), seen: union(x.seen, y.seen), sent: maxN(x.sent, y.sent), won: maxN(x.won, y.won) }
}

function bottles(a: unknown, b: unknown) {
  const x = isObj(a) ? a : {}, y = isObj(b) ? b : {}
  // The cover is a choice: this device's, unless it never chose one.
  const cover = str(x.cover) && x.cover !== 'navy' ? x.cover : str(y.cover) ?? 'navy'
  return { ...x, v: maxN(x.v, y.v) || 1, found: byKey(x.found, y.found, earlier), cover }
}

function fusion(a: unknown, b: unknown) {
  const x = isObj(a) ? a : {}, y = isObj(b) ? b : {}
  const items: O[] = [], seen = new Set<string>()
  for (const it of [...(Array.isArray(x.items) ? x.items : []), ...(Array.isArray(y.items) ? y.items : [])]) {
    const t = isObj(it) ? str(it.text)?.trim().toLowerCase() : null
    if (t && !seen.has(t)) { seen.add(t); items.push(it as O) }
  }
  return { ...x, items, recipes: { ...(isObj(y.recipes) ? y.recipes : {}), ...(isObj(x.recipes) ? x.recipes : {}) }, version: maxN(x.version, y.version) || 2 }
}

const MERGE: Record<string, (a: unknown, b: unknown) => unknown> = {
  'funsite:stats': stats,
  'funsite:passport': passport,
  'funsite:daily': daily,
  'funsite:quests': quests,
  'funsite:bottles': bottles,
  'isl-found': union,
  'isl-seasons': union,
  'isl-welcomed': (a, b) => (a || b ? '1' : a),
  'steady-hand:bests.v1': (a, b) => byKey(a, b, maxN),
  'orbit.progress.v1': (a, b) => { const x = isObj(a) ? a : {}, y = isObj(b) ? b : {}; return { ...x, done: union(x.done, y.done), bestLaps: maxN(x.bestLaps, y.bestLaps) } },
  'powder.found.v1': union,
  'powder.scenarios.v1': union,
  'fusion:v1': fusion,
}
/** A game's best ({value, text}, higher is better: every considerBest is). */
const paperBest = (a: unknown, b: unknown) => { const x = num(isObj(a) ? a.value : null), y = num(isObj(b) ? b.value : null); return x === null ? b : y === null ? a : y > x ? b : a }

/** isl-welcomed is a bare '1', not JSON; everything else is JSON. */
const parse = (k: string, s: string | undefined): unknown => { if (s === undefined) return undefined; if (k === 'isl-welcomed') return s; try { return JSON.parse(s) } catch { return undefined } }
const write = (k: string, v: unknown) => (k === 'isl-welcomed' ? String(v) : JSON.stringify(v))

/** Two sets of records as one: each record the better of both. Records that cannot be read are dropped for the other side's. */
export function merge(mine: Records, theirs: Records): Records {
  const out: Records = {}
  for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
    if (!carried(k)) continue
    const a = parse(k, mine[k]), b = parse(k, theirs[k])
    if (a === undefined && b === undefined) continue
    // One side only: merged with itself, which tidies it into the shape a two-sided merge gives.
    const x = a === undefined ? b : a, y = b === undefined ? a : b
    const f = MERGE[k] ?? paperBest
    try { out[k] = write(k, f(x, y)) } catch { out[k] = (a === undefined ? theirs[k] : mine[k])! }
  }
  return out
}

/** Records that fit (and which do not: one too big is left behind, not the lot). */
export function fit(r: Records): Records {
  const out: Records = {}
  let total = 0
  for (const [k, v] of Object.entries(r)) {
    if (!carried(k) || typeof v !== 'string' || v.length > MAX_ONE || total + v.length > MAX_ALL) continue
    out[k] = v; total += v.length
  }
  return out
}

/** This browser's carried records, as stored. */
export function snapshot(s: Store | null = siteStore()): Records {
  const out: Records = {}
  if (!s) return out
  const keys: string[] = [...CARRIED]
  try {
    const ls = s as unknown as Storage
    if (typeof ls.length === 'number' && typeof ls.key === 'function') for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(CARRIED_PREFIX)) keys.push(k) }
  } catch { /* a store that cannot list is still read by exact key */ }
  for (const k of keys) { if (!carried(k)) continue; try { const v = s.getItem(k); if (v !== null) out[k] = v } catch { /* skip it */ } }
  return fit(out)
}

/** Write records back. Returns the keys that changed. */
export function apply(r: Records, s: Store | null = siteStore()): string[] {
  const changed: string[] = []
  if (!s) return changed
  for (const [k, v] of Object.entries(r)) {
    if (!carried(k)) continue
    try { if (s.getItem(k) !== v) { s.setItem(k, v); changed.push(k) } } catch { /* storage refused: next visit tries again */ }
  }
  return changed
}

/** A short fingerprint of a set of records: has anything changed since the last save? */
export function fingerprint(r: Records): string {
  let h = 2166136261
  for (const k of Object.keys(r).sort()) for (const c of k + '\u0000' + r[k] + '\u0001') { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}

/* ---- this browser's code ---------------------------------------------- */

export type Link = { code: string; rev: number; fp: string; at: string }

export function readLink(s: Store | null = siteStore()): Link | null {
  try {
    const o = JSON.parse(s?.getItem(SYNC_KEY) ?? 'null')
    return o && typeof o.code === 'string' && CODE_RE.test(o.code) ? { code: o.code, rev: num(o.rev) ?? 0, fp: str(o.fp) ?? '', at: str(o.at) ?? '' } : null
  } catch { return null }
}
export function writeLink(l: Link | null, s: Store | null = siteStore()) {
  try { if (l) s?.setItem(SYNC_KEY, JSON.stringify(l)); else s?.removeItem(SYNC_KEY) } catch { /* storage refused */ }
}

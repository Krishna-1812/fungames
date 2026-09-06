/**
 * What the site remembers about you.
 *
 * Six games already persisted something before this existed, and every one of
 * them invented its own key and its own shape: `steady-hand:best`, and five
 * more behind local constants called `KEY`, `SAVE`, `STORE`, `SCENE_KEY` and
 * `SC_SAVE`. That is fine until you want to answer a question that crosses
 * games — "what have I finished?" — or until one of them writes something that
 * cannot be read back, which nothing would notice.
 *
 * So: one key, one version, one shape. Games keep their own bulky save state
 * where it is (Orbit's scene, Powder's discoveries, Fusion's elements are all
 * large and game-specific); what lives here is the small durable record of
 * *finishing* — how many times, when, and the handful of numbers worth keeping
 * a best of.
 *
 * **Storage is assumed hostile.** `localStorage` throws on access in Safari's
 * private mode, is absent in a sandboxed iframe, is full often enough to
 * matter, and can contain whatever a previous version of this file wrote or
 * whatever another script on the origin has scribbled. Every path through this
 * file survives all four, and `check-stats.mjs` proves it by handing the store
 * each failure in turn.
 *
 * The store is injectable for exactly that reason: this is pure functions over
 * plain data, and the browser's storage is an argument to it rather than an
 * assumption inside it.
 */

export const KEY = 'funsite:stats'
export const VERSION = 1

/** A number, kept because higher (or lower) is better. */
export type Best = { value: number; at: string }

export type GameStat = {
  /** Times this game reached an ending. Not page views. */
  plays: number
  /** ISO day of the most recent ending. Day, not instant: a timestamp here
   *  would be a more precise record of when someone plays than anything on
   *  this site needs. */
  at: string
  /** Named bests, each with the day it was set. */
  bests: Record<string, Best>
  /** The most recent result, as the game described it. Small values only. */
  last: Record<string, number | string | boolean>
}

export type StatsFile = { v: number; games: Record<string, GameStat> }

/** The minimal shape of `localStorage` this needs. */
export type Store = {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

let store: Store | null | undefined

/** Point this at something else. Used by the checker; also the escape hatch
 *  for anyone embedding a game where `localStorage` is not the right place. */
export function setStore(s: Store | null) {
  store = s
}

function getStore(): Store | null {
  if (store !== undefined) return store
  try {
    // Touching `localStorage` at all is what throws in a blocked context, so
    // this is inside the try rather than guarded by a typeof check.
    const s = globalThis.localStorage
    // Presence is not permission: a store can exist and refuse to write.
    const probe = `${KEY}:probe`
    s.setItem(probe, '1')
    s.removeItem(probe)
    store = s
    return s
  } catch {
    store = null
    return null
  }
}

const today = () => new Date().toISOString().slice(0, 10)

const emptyFile = (): StatsFile => ({ v: VERSION, games: {} })

/** One game's record, with every field present and of the right type. */
function coerce(raw: unknown): GameStat | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const plays = typeof o.plays === 'number' && Number.isFinite(o.plays) ? Math.max(0, Math.floor(o.plays)) : 0
  const at = typeof o.at === 'string' ? o.at : today()
  const bests: Record<string, Best> = {}
  if (o.bests && typeof o.bests === 'object')
    for (const [k, v] of Object.entries(o.bests as Record<string, unknown>)) {
      const b = v as Record<string, unknown>
      if (b && typeof b.value === 'number' && Number.isFinite(b.value))
        bests[k] = { value: b.value, at: typeof b.at === 'string' ? b.at : at }
    }
  const last: Record<string, number | string | boolean> = {}
  if (o.last && typeof o.last === 'object')
    for (const [k, v] of Object.entries(o.last as Record<string, unknown>))
      if (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' || typeof v === 'boolean')
        last[k] = v as number | string | boolean
  return { plays, at, bests, last }
}

/**
 * Everything, or an empty file.
 *
 * Never throws and never returns a partially-typed object: anything that does
 * not survive `coerce` is dropped rather than handed to a caller that will
 * then do arithmetic on a string.
 */
export function readAll(): StatsFile {
  const s = getStore()
  if (!s) return emptyFile()
  let raw: string | null = null
  try {
    raw = s.getItem(KEY)
  } catch {
    return emptyFile()
  }
  if (!raw) return emptyFile()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Somebody else's data, or a truncated write. Start again rather than
    // fail; there is nothing here worth an error message.
    return emptyFile()
  }
  const o = parsed as Record<string, unknown>
  if (!o || typeof o !== 'object' || typeof o.v !== 'number') return emptyFile()
  // A file from a future version is not ours to interpret. Reading it as if it
  // were v1 would be worse than starting over.
  if (o.v > VERSION) return emptyFile()
  const games: Record<string, GameStat> = {}
  if (o.games && typeof o.games === 'object')
    for (const [slug, g] of Object.entries(o.games as Record<string, unknown>)) {
      const c = coerce(g)
      if (c) games[slug] = c
    }
  return { v: VERSION, games }
}

/** Write, or don't. Returns whether it stuck. */
function writeAll(file: StatsFile): boolean {
  const s = getStore()
  if (!s) return false
  try {
    s.setItem(KEY, JSON.stringify(file))
    return true
  } catch {
    // Full, or refused mid-session. The in-memory result is still correct for
    // this page; there is no version of this worth interrupting a game for.
    return false
  }
}

export function readGame(slug: string): GameStat | null {
  return readAll().games[slug] ?? null
}

/**
 * Record that a game ended.
 *
 * `bests` says which of `last`'s numbers to keep a record of and which way is
 * better, because only the game knows — a lower time is good and a lower score
 * is not. Returns the game's record as it now stands, whether or not the write
 * survived, so a caller can show the result either way.
 */
export function recordPlay(
  slug: string,
  last: Record<string, number | string | boolean> = {},
  bests: Record<string, 'high' | 'low'> = {},
): GameStat {
  const file = readAll()
  const prev = file.games[slug] ?? { plays: 0, at: today(), bests: {}, last: {} }
  const now = today()
  const next: GameStat = { plays: prev.plays + 1, at: now, bests: { ...prev.bests }, last: { ...last } }

  for (const [field, dir] of Object.entries(bests)) {
    const v = last[field]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    const old = next.bests[field]
    const better = !old || (dir === 'high' ? v > old.value : v < old.value)
    if (better) next.bests[field] = { value: v, at: now }
  }

  file.games[slug] = next
  writeAll(file)
  return next
}

/** Wipe everything this file owns, and nothing else. */
export function clearAll(): boolean {
  const s = getStore()
  if (!s) return false
  try {
    s.removeItem(KEY)
    return true
  } catch {
    return false
  }
}

/**
 * Pull the keys games wrote before this file existed into it, once.
 *
 * Only `steady-hand:best` is claimed: the others hold save state that still
 * belongs to its game (a scene, a set of discovered elements, a grid), and
 * moving those here would be a migration with nothing to gain. The old key is
 * left where it is — the game still reads it, and deleting somebody's best
 * score to tidy up a schema is not a trade worth making.
 */
export function migrateLegacy(): boolean {
  const s = getStore()
  if (!s) return false
  const file = readAll()
  if (file.games['steady-hand']) return false
  let raw: string | null = null
  try {
    raw = s.getItem('steady-hand:best')
  } catch {
    return false
  }
  if (!raw) return false
  let value: number | null = null
  try {
    const p = JSON.parse(raw)
    // It was stored either as a bare number or as a per-shape object.
    if (typeof p === 'number') value = p
    else if (p && typeof p === 'object') {
      const nums = Object.values(p).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      if (nums.length) value = nums.reduce((a, b) => a + b, 0) / nums.length
    }
  } catch {
    return false
  }
  if (value === null || !Number.isFinite(value)) return false
  file.games['steady-hand'] = {
    plays: 1,
    at: today(),
    bests: { rating: { value, at: today() } },
    last: { rating: value },
  }
  return writeAll(file)
}

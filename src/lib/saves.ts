/**
 * Save codes, on the server: the records a browser sent up (lib/sync.ts), kept
 * under a hash of their code.
 *
 * The code is made here, from 80 random bits, and is the only key there is:
 * there is no account behind it, and no way to look one up but to know it. A
 * save untouched for 400 days is let go (the nightly run, lib/analytics/rollup.ts).
 *
 * A write names the revision it was based on. If another device has written
 * since, it is refused with what is there now, and the browser merges and
 * tries again: two devices saving at once both keep everything.
 */
import type { Db } from './analytics/db'
import { sha256 } from './analytics/db'
import { ALPHABET, CODE_RE, carried, MAX_ONE, MAX_ALL, type Records } from './sync'

export const KEEP_DAYS = 400

export function newCode(): string {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  // 256 is not a multiple of 30; re-draw the few bytes that would tilt the odds.
  let out = ''
  for (let i = 0; out.length < 16; i++) {
    if (i >= a.length) { crypto.getRandomValues(a); i = 0 }
    if (a[i] < 240) out += ALPHABET[a[i] % 30]
  }
  return out
}

const idOf = (code: string) => sha256('save:' + code)

/** Records as sent, or null if they are not records: an object of carried keys to JSON text, within the limits. */
export function cleanRecords(v: unknown): Records | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const out: Records = {}
  let total = 0
  for (const [k, s] of Object.entries(v as Record<string, unknown>)) {
    if (!carried(k) || typeof s !== 'string' || s.length > MAX_ONE) return null
    total += s.length
    out[k] = s
  }
  return total <= MAX_ALL ? out : null
}

export async function makeSave(d: Db, data: Records): Promise<{ code: string; rev: number }> {
  for (;;) {
    const code = newCode()
    const rows = await d.query('insert into saves (id, data) values ($1, $2) on conflict (id) do nothing returning rev', [await idOf(code), JSON.stringify(data)])
    if (rows.length) return { code, rev: 1 }
  }
}

export async function getSave(d: Db, code: string): Promise<{ rev: number; data: Records } | null> {
  if (!CODE_RE.test(code)) return null
  const [row] = await d.query<{ rev: number; data: Records | string }>('select rev, data from saves where id = $1', [await idOf(code)])
  if (!row) return null
  return { rev: row.rev, data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data }
}

/** Write, if nobody has since `rev`. Otherwise what is there now, to merge with. */
export async function putSave(d: Db, code: string, rev: number, data: Records): Promise<{ ok: true; rev: number } | { ok: false; rev: number; data: Records } | null> {
  if (!CODE_RE.test(code)) return null
  const id = await idOf(code)
  const rows = await d.query<{ rev: number }>('update saves set data = $3, rev = rev + 1, at = now() where id = $1 and rev = $2 returning rev', [id, rev, JSON.stringify(data)])
  if (rows.length) return { ok: true, rev: rows[0].rev }
  const now = await getSave(d, code)
  return now ? { ok: false, ...now } : null
}

export async function dropSave(d: Db, code: string): Promise<boolean> {
  if (!CODE_RE.test(code)) return false
  return (await d.query('delete from saves where id = $1 returning rev', [await idOf(code)])).length > 0
}

/** Saves nobody has opened in KEEP_DAYS. */
export async function trimSaves(d: Db): Promise<number> {
  return (await d.query(`delete from saves where at < now() - interval '${KEEP_DAYS} days' returning rev`)).length
}

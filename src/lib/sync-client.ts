/**
 * Save codes, in the browser: making one, bringing one here, and keeping the
 * two sides level (lib/sync.ts has the merge and the why).
 *
 * A browser with a code checks in when a page opens (at most once a minute)
 * and saves when a page is left, if anything changed. Nothing is ever lost to
 * a race: a save the server refuses because another device got there first is
 * merged and sent again, and one sent while leaving that cannot wait for the
 * answer is merged on the next visit instead.
 */
import { snapshot, apply, merge, fit, fingerprint, readLink, writeLink, type Records, type Link } from './sync'

const API = '/api/save/'
const CHECKED = 'funsite:sync-checked'

type Res = { status: number; body: Record<string, unknown> }
async function call(op: string, payload: Record<string, unknown>, keepalive = false): Promise<Res> {
  const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, ...payload }), keepalive, credentials: 'same-origin' })
  let body: Record<string, unknown> = {}
  try { body = await r.json() } catch { /* empty */ }
  return { status: r.status, body }
}

const now = () => new Date().toISOString()
/** The page's own copy of the code, for the passport's Save page to show. */
export const linked = (): Link | null => readLink()

export type Outcome = { ok: true; changed: string[] } | { ok: false; why: 'unknown' | 'offline' | 'busy' }

/** Merge with the server's copy and leave both the same. */
async function level(code: string, server: { rev: number; data: Records }): Promise<Outcome> {
  let { rev, data } = server
  for (let tries = 0; tries < 4; tries++) {
    const mine = snapshot()
    const both = fit(merge(mine, data))
    const changed = apply(both)
    const fp = fingerprint(both)
    if (fp === fingerprint(fit(data))) { writeLink({ code, rev, fp, at: now() }); listen(); return { ok: true, changed } }
    const r = await call('put', { code, rev, data: both })
    if (r.status === 200) { writeLink({ code, rev: Number(r.body.rev), fp, at: now() }); listen(); return { ok: true, changed } }
    if (r.status === 409) { rev = Number(r.body.rev); data = (r.body.data as Records) ?? {}; continue }
    if (r.status === 404) return { ok: false, why: 'unknown' }
    return { ok: false, why: r.status === 429 ? 'busy' : 'offline' }
  }
  return { ok: false, why: 'busy' }
}

/** A new code for this browser's progress. */
export async function makeCode(): Promise<{ ok: true; code: string } | { ok: false; why: 'offline' | 'busy' }> {
  try {
    const data = snapshot()
    const r = await call('make', { data })
    if (r.status !== 200 || typeof r.body.code !== 'string') return { ok: false, why: r.status === 429 ? 'busy' : 'offline' }
    writeLink({ code: r.body.code, rev: Number(r.body.rev), fp: fingerprint(data), at: now() })
    listen()
    return { ok: true, code: r.body.code }
  } catch { return { ok: false, why: 'offline' } }
}

/** Bring a code's progress here (merged with what is here), and keep this browser on it. */
export async function useCode(code: string): Promise<Outcome> {
  try {
    const r = await call('get', { code })
    if (r.status === 404) return { ok: false, why: 'unknown' }
    if (r.status !== 200) return { ok: false, why: r.status === 429 ? 'busy' : 'offline' }
    return await level(code, { rev: Number(r.body.rev), data: (r.body.data as Records) ?? {} })
  } catch { return { ok: false, why: 'offline' } }
}

/** Check in now: bring down what other devices saved, send up what this one did. */
export async function syncNow(): Promise<Outcome | null> {
  const l = readLink()
  if (!l) return null
  const out = await useCode(l.code)
  // Deleted from another device: this browser keeps its progress and lets the code go.
  if (!out.ok && out.why === 'unknown') writeLink(null)
  return out
}

/** Stop using the code here (the save stays for the other devices). */
export const forgetCode = () => writeLink(null)

/** Delete the save itself, for every device. */
export async function deleteSave(): Promise<boolean> {
  const l = readLink()
  if (!l) return true
  try {
    const r = await call('drop', { code: l.code })
    if (r.status !== 200) return false
  } catch { return false }
  writeLink(null)
  return true
}

/** Leaving the page: send what changed, without waiting for the answer. */
function flush() {
  const l = readLink()
  if (!l) return
  const data = snapshot(), fp = fingerprint(data)
  if (fp === l.fp) return
  // The new fingerprint is only kept once the server says yes (it may refuse: the next visit merges).
  call('put', { code: l.code, rev: l.rev, data }, true).then((r) => { if (r.status === 200) writeLink({ ...l, rev: Number(r.body.rev), fp, at: now() }) }).catch(() => {})
}

let listening = false
/** Save on the way out of the page, once there is a code to save under. */
function listen() {
  if (listening || typeof document === 'undefined') return
  listening = true
  addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
}

/**
 * On every page (layouts/Paper.astro). Fires `funsite:synced` on the document
 * when another device's progress arrived, so a page already showing it can
 * paint it again.
 */
export function startSync() {
  if (!readLink()) return
  listen()
  let last = 0
  try { last = Number(sessionStorage.getItem(CHECKED)) || 0 } catch { /* fine */ }
  if (Date.now() - last < 60_000) return
  try { sessionStorage.setItem(CHECKED, String(Date.now())) } catch { /* fine */ }
  syncNow().then((r) => { if (r?.ok && r.changed.length) document.dispatchEvent(new CustomEvent('funsite:synced', { detail: r.changed })) }).catch(() => {})
}

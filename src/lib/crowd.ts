/**
 * The crowd, in the page: how everyone else answered, for a game to set
 * beside its player's own answer ("62% of 1,840 players chose the same").
 *
 * The counts come from /api/crowd/ (lib/analytics/crowd.ts), which only ever
 * answers with real answers people gave, and leaves out any group too small
 * to mean anything. So there are three states, and each game says something
 * different in each:
 *
 * - `null` from `loadCrowd`: no answer from the server at all (offline, no
 *   database, blocked). Say nothing: there is nothing true to say.
 * - a crowd, but no group for this question: too few answers yet. `few()`.
 * - a group: a share or a standing to show.
 *
 * The player's own answer is never in what comes back (their answer is still
 * on its way to the server, and is counted in a later batch), so every figure
 * here is about *other* players, and is worded that way.
 */
import type { CrowdCounts } from './analytics/crowd'

const loads = new Map<string, Promise<CrowdCounts | null>>()

/** Everyone else's answers to this game's public questions, once per page. */
export function loadCrowd(slug: string): Promise<CrowdCounts | null> {
  let p = loads.get(slug)
  if (!p) {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 6000)
    p = fetch(`/api/crowd/?g=${encodeURIComponent(slug)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => (b && typeof b.q === 'object' && b.q ? (b.q as CrowdCounts) : null))
      .catch(() => null)
      .finally(() => clearTimeout(t))
    loads.set(slug, p)
  }
  return p
}

type Group = Record<string, number>
const groupOf = (c: CrowdCounts, what: string, of = ''): Group | null => c[what]?.[of] ?? null
const totalOf = (g: Group) => Object.values(g).reduce((a, n) => a + n, 0)

/** Whole percent, but never a 0% or a 100% that is not exactly that. */
export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  const p = Math.round((part / whole) * 100)
  if (p === 0 && part > 0) return 1
  if (p === 100 && part < whole) return 99
  return p
}

/**
 * Text for HTML. The counts' answers come from the server, and the server
 * takes them from anyone who posts to it: a game shows one only after
 * matching it against its own list, and escapes it all the same.
 */
export const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)

/** A count as people read it: 1,840. */
export const people = (n: number) => n.toLocaleString('en-US')

export type Share = { pct: number; n: number; top: string; topPct: number }

/**
 * What share of the other players gave this same answer, how many players
 * that is out of, and what the most common answer was.
 */
export function share(c: CrowdCounts, what: string, of: string, answer: string | boolean): Share | null {
  const g = groupOf(c, what, of)
  if (!g) return null
  const n = totalOf(g)
  const [top, topN] = Object.entries(g).sort((a, b) => b[1] - a[1])[0]
  return { pct: pct(g[String(answer)] ?? 0, n), n, top, topPct: pct(topN, n) }
}

export type Standing = { pct: number; n: number }

/**
 * Where a number stands among everyone else's: the share of other players it
 * beats (a tie counts half), with `better` saying which way is better.
 */
export function standing(c: CrowdCounts, what: string, of: string, value: number, better: 'high' | 'low' = 'high'): Standing | null {
  const g = groupOf(c, what, of)
  if (!g) return null
  let n = 0, beaten = 0
  for (const [v, k] of Object.entries(g)) {
    const x = Number(v)
    if (!Number.isFinite(x)) continue
    n += k
    if (x === value) beaten += k / 2
    else if (better === 'high' ? x < value : x > value) beaten += k
  }
  return n ? { pct: Math.min(99, pct(beaten, n)), n } : null
}

/** The middle answer of a group of numbers, and how many gave one. */
export function median(c: CrowdCounts, what: string, of = ''): { v: number; n: number } | null {
  const g = groupOf(c, what, of)
  if (!g) return null
  const xs = Object.entries(g).map(([v, k]) => [Number(v), k] as const).filter(([v]) => Number.isFinite(v)).sort((a, b) => a[0] - b[0])
  const n = xs.reduce((a, [, k]) => a + k, 0)
  let seen = 0
  for (const [v, k] of xs) { seen += k; if (seen >= n / 2) return { v, n } }
  return null
}

/** The crowd answered, but not enough of it for this question yet. */
export const few = (c: CrowdCounts | null, what: string, of = '') => !!c && !groupOf(c, what, of)

/** What a game says when the crowd answered but this question has too few answers yet. */
export const FEW = 'Too few answers to compare yet. You are one of the first.'

const filling = new WeakMap<HTMLElement, number>()
let fills = 0
/**
 * Empty `el`, then put the crowd's line in it once the counts are here:
 * `say` returns the game's own words for them, or null for nothing. An
 * answer that arrives after `el` was filled again (the player moved on) is
 * dropped, so a slow network never writes the last question's crowd under
 * the next one.
 */
export async function fillCrowd(el: HTMLElement, slug: string, say: (c: CrowdCounts) => string | null, cls = ''): Promise<void> {
  const me = ++fills
  filling.set(el, me)
  el.replaceChildren()
  const c = await loadCrowd(slug)
  if (!c || filling.get(el) !== me) return
  const text = say(c)
  if (text) el.append(crowdNote(text, cls))
}

/** Empty `el`, and forget any crowd line still on its way to it. */
export function clearCrowd(el: HTMLElement) {
  filling.set(el, ++fills)
  el.replaceChildren()
}

/**
 * The line a game sets beside an answer: a short paragraph with the crowd
 * mark, styled once in game-shell.css. `html` is the game's own text, never
 * anything a player typed.
 */
export function crowdNote(html: string, cls = ''): HTMLParagraphElement {
  const p = document.createElement('p')
  p.className = `crowd-note ${cls}`.trim()
  p.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="6.5" r="3" fill="currentColor"/><circle cx="14" cy="7.5" r="2.4" fill="currentColor" opacity=".6"/><path d="M1.5 17c0-3.3 2.5-5.6 5.5-5.6s5.5 2.3 5.5 5.6z" fill="currentColor"/><path d="M13.6 11.4c2.7 0 4.9 2 4.9 5H14" fill="currentColor" opacity=".6"/></svg><span>${html}</span>`
  return p
}

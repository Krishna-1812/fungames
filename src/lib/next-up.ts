/**
 * Up next: three more games, offered where a game ends and at the foot of
 * every game's page, so that finishing one is the start of another rather
 * than a dead end.
 *
 * Three different reasons, so the three are never three of a kind:
 *
 * 1. **Today's challenge**, when it is another game and not yet played today:
 *    the one game everybody is playing on this date.
 * 2. **More like this**: the same kind of game (the registry's category).
 * 3. **Something different**: the other kind of play (a game with an ending
 *    after something to explore, or the other way round), from another
 *    category, so a player who is tiring of one thing is offered a change.
 *
 * and anything left goes to the newest game this browser has not opened, then
 * to whatever it has gone longest without. Within a reason, a game not yet in
 * the passport always comes first: a new stamp is the better offer. The order
 * is shuffled by the day, so the same page offers the same three all day and
 * a different three tomorrow.
 *
 * `pickNext` is pure (scripts/check-next-up.mjs holds it to the above);
 * `mountNext` draws it.
 */
import type { Visit } from './passport'

export type NextGame = {
  slug: string
  title: string
  blurb: string
  cat: string
  /** 'play' has an ending to reach; 'explore' is something to look through. */
  kind: 'play' | 'explore'
  /** ISO date it was added. */
  added: string
  /** Its district's colour on the island, behind its building. */
  tint: string
}

export type Why = 'daily' | 'like' | 'different' | 'new' | 'fresh' | 'again'
export type Offer = { g: NextGame; why: Why }

export const WHY_LABEL: Record<Why, string> = {
  daily: 'Today’s challenge',
  like: 'More like this',
  different: 'Something different',
  new: 'New on the island',
  fresh: 'Not tried yet',
  again: 'Worth another go',
}

/** A small stable hash, for the day's order. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const DAY = 864e5

export function pickNext(
  current: string,
  games: NextGame[],
  visits: Record<string, Pick<Visit, 'last'>>,
  o: { today: string; daily?: string | null; count?: number },
): Offer[] {
  const count = o.count ?? 3
  const cur = games.find((g) => g.slug === current)
  const taken = new Set<string>([current])
  const out: Offer[] = []
  const fresh = (g: NextGame) => !visits[g.slug]
  // Not yet visited first; then the longest since a visit; then the day's shuffle.
  const order = (a: NextGame, b: NextGame) => {
    const fa = fresh(a), fb = fresh(b)
    if (fa !== fb) return fa ? -1 : 1
    if (!fa) { const la = visits[a.slug].last, lb = visits[b.slug].last; if (la !== lb) return la < lb ? -1 : 1 }
    return hash(o.today + current + a.slug) - hash(o.today + current + b.slug)
  }
  const take = (why: Why, ok: (g: NextGame) => boolean, sort = order) => {
    if (out.length >= count) return
    const g = games.filter((x) => !taken.has(x.slug) && ok(x)).sort(sort)[0]
    if (g) { taken.add(g.slug); out.push({ g, why }) }
  }

  if (o.daily && o.daily !== current && visits[o.daily]?.last !== o.today) take('daily', (g) => g.slug === o.daily)
  if (cur) {
    take('like', (g) => g.cat === cur.cat)
    take('different', (g) => g.kind !== cur.kind && g.cat !== cur.cat)
    take('different', (g) => g.cat !== cur.cat)
  }
  const recent = (g: NextGame) => Date.parse(o.today) - Date.parse(g.added) <= 45 * DAY
  take('new', (g) => fresh(g) && recent(g), (a, b) => b.added.localeCompare(a.added))
  while (out.length < count) {
    const before = out.length
    take('fresh', fresh)
    if (out.length === before) take('again', () => true)
    if (out.length === before) break
  }
  return out
}

/* ---- in the page ------------------------------------------------------ */

const escT = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)

export type NextData = {
  games: NextGame[]
  /** Which island's buildings to show: what the visitor last chose, else the site's default. */
  worlds: string[]
  world: string
  /** Where the island is, per world. */
  home: Record<string, string>
  base: string
}

/** The island this visitor last looked at (the homepage's switch keeps it), if it can be shown. */
export function worldFor(d: Pick<NextData, 'worlds' | 'world'>): string {
  let w: string | null = null
  try { w = localStorage.getItem('isl-world') } catch { /* storage blocked */ }
  return w && d.worlds.includes(w) ? w : d.world
}

/** One card: the building, why it is offered, its name and its line. */
export function cardHtml(p: Offer, d: NextData, world: string, stamp: boolean): string {
  const g = p.g
  return `<a class="nx-card" href="${d.base}/${g.slug}/" data-to="${g.slug}" data-why="${p.why}" style="--tint:${g.tint}">`
    + `<span class="nx-art"><img src="${d.base}/next/${world}/${g.slug}.webp" alt="" width="240" height="180" loading="lazy" decoding="async"></span>`
    + `<span class="nx-body">`
    + `<span class="nx-why nx-why--${p.why}">${WHY_LABEL[p.why]}</span>`
    + `<span class="nx-title">${escT(g.title)}</span>`
    + `<span class="nx-blurb">${escT(g.blurb)}</span>`
    + (stamp ? `<span class="nx-stamp">New passport stamp</span>` : '')
    + `</span></a>`
}

/**
 * Fill the page's two "Up next" blocks (GameShell.astro: one in the result
 * card, one at the foot of the page) and keep the foot one out of the way
 * while the result card is showing the same three. Returns what the shell
 * calls when a game ends and when it starts again.
 */
export function mountNext(slug: string, deps: {
  visits: Record<string, Pick<Visit, 'last'>>
  today: string
  daily: string | null
  track: (n: 'next_show' | 'next_go', p: Record<string, string>, g: string) => void
}): { ended: () => void; reset: () => void } {
  const none = { ended() {}, reset() {} }
  const raw = document.getElementById('next-data')?.textContent
  const end = document.querySelector<HTMLElement>('[data-next-end]')
  const foot = document.querySelector<HTMLElement>('[data-next-foot]')
  if (!raw || !end || !foot) return none
  let d: NextData
  try { d = JSON.parse(raw) } catch { return none }
  const offers = pickNext(slug, d.games, deps.visits, { today: deps.today, daily: deps.daily })
  if (!offers.length) return none
  const world = worldFor(d)
  const home = d.home[world] ?? d.home[d.world]
  const others = d.games.length - 1
  // Somebody who has only ever opened this one game (a shared link, most likely) hears that there are more.
  const newcomer = Object.keys(deps.visits).filter((s) => s !== slug).length === 0
  for (const block of [end, foot]) {
    const where = block === end ? 'end' : 'foot'
    block.querySelector('[data-next-row]')!.innerHTML = offers.map((p) => cardHtml(p, d, world, !deps.visits[p.g.slug])).join('')
    const link = block.querySelector<HTMLAnchorElement>('[data-next-home]')!
    link.href = home
    if (where === 'foot') {
      block.querySelector('[data-next-title]')!.textContent = newcomer ? 'Liked this one?' : 'Keep exploring'
      link.firstElementChild!.textContent = newcomer ? `There are ${others} more on Tiny Island` : `All ${others + 1} games on Tiny Island`
    }
    block.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a')
      if (!a || !block.contains(a)) return
      deps.track('next_go', a.dataset.to ? { where, why: a.dataset.why ?? '', to: a.dataset.to } : { where, why: 'island', to: '' }, slug)
    })
    // Seen: half of it on screen, once a page.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        if (!es.some((e) => e.isIntersecting)) return
        io.disconnect()
        deps.track('next_show', { where, first: offers[0].why }, slug)
      }, { threshold: 0.5 })
      io.observe(block)
    }
  }
  foot.hidden = false
  return {
    ended() { end.hidden = false; foot.hidden = true },
    reset() { end.hidden = true; foot.hidden = false },
  }
}

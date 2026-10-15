/**
 * Analytics: the crowd, as the games show it back to their players.
 *
 * Every game already reports its choices as `game_pick` (lib/game-shell.ts,
 * `shell.pick`), for the admin page. A few of those questions are worth
 * showing to the player too ("62% of 1,840 players chose the same"), and this
 * is where they are added up: every answer ever given, from the nightly
 * summaries (`daily_props`, kept for good) for the days they hold and from the
 * raw events for the days since, test traffic left out.
 *
 * Only the questions named in `PUBLIC` leave the server, and only counts:
 * nothing about any one player. A group of answers (one question, one `of`)
 * with fewer than `MIN_N` in it is left out entirely, so a rare answer cannot
 * be traced back to the few people who could have given it, and a page never
 * shows a percentage of nine people as if it meant something.
 */
import type { Db } from './db'
import { getMeta } from './rollup'

/** The questions each game shows its players, as `shell.pick` names them. */
export const PUBLIC: Record<string, string[]> = {
  trolley: ['Choice on each dilemma'],
  'dark-patterns': ['Fell for each pattern'],
  auction: ['What people did on each lot'],
  'steady-hand': ['Score kept, per shape'],
  'from-memory': ['Likeness for each thing (%)'],
  'constellation-draw': ['Accuracy, per figure'],
  'rule-cascade': ['Seconds to clear each rule'],
  'spend-it': ['Spent it all', 'Fortune spent (%)'],
}

/** Fewer answers than this in a group, and the group is not shown. */
export const MIN_N = 10
/** At most this many different answers per group (a number spread out has the most). */
const MAX_V = 400

/** question → of → answer → how many gave it. `of` is '' for a question asked once. */
export type CrowdCounts = Record<string, Record<string, Record<string, number>>>

const DAY = 864e5

export async function crowdFor(d: Db, game: string): Promise<CrowdCounts> {
  const what = PUBLIC[game]
  if (!what) return {}
  // The summaries hold every day up to `rolled_through`; the raw events cover the days after it.
  const through = await getMeta(d, 'rolled_through')
  const lastDay = through?.v ?? '0001-01-01'
  const rawFrom = through ? new Date(new Date(through.v + 'T00:00:00Z').getTime() + DAY) : new Date(0)
  const rows = await d.query<{ k: string; of: string; v: string; n: number | string }>(`
    select k, of, v, sum(n) as n from (
      select k, of, v, n from daily_props
        where name = 'game_pick' and game = $1 and k = any($2) and day <= $3::date
      union all
      select e.props->>'what', coalesce(e.props->>'of', ''), e.props->>'v', count(*)
        from events e join views v on v.pid = e.pid
        where e.name = 'game_pick' and coalesce(e.game, v.game) = $1 and e.props->>'what' = any($2)
          and e.props ? 'v' and e.ts >= $4 and not v.test
        group by 1, 2, 3
    ) x group by 1, 2, 3`, [game, what, lastDay, rawFrom])
  const out: CrowdCounts = {}
  const groups = new Map<string, { k: string; of: string; vs: [string, number][] }>()
  for (const r of rows) {
    const key = r.k + '\u0000' + r.of
    const g = groups.get(key) ?? groups.set(key, { k: r.k, of: r.of, vs: [] }).get(key)!
    g.vs.push([r.v, Number(r.n)])
  }
  for (const g of groups.values()) {
    const total = g.vs.reduce((a, [, n]) => a + n, 0)
    if (total < MIN_N) continue
    g.vs.sort((a, b) => b[1] - a[1])
    ;(out[g.k] ??= {})[g.of] = Object.fromEntries(g.vs.slice(0, MAX_V))
  }
  return out
}

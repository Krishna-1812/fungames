/**
 * check-next-up — does "Up next" (src/lib/next-up.ts) offer what it says?
 *
 * Run against the real registry, from every game's page, for a newcomer,
 * a regular and somebody who has played everything:
 *
 * - always three games, never the one being played, never one twice;
 * - today's challenge first when it is another game not yet played today,
 *   and never when it was;
 * - "more like this" really is the same category, and "something different"
 *   really is another category;
 * - a game not yet in the passport is offered before one that is;
 * - the same three all day, and not the same three every day;
 * - every building picture the cards ask for is one the site makes.
 *
 *   node scripts/check-next-up.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./resolve-ts.mjs', import.meta.url)

const N = await import('../src/lib/next-up.ts')
const G = await import('../src/data/games.ts')
const M = await import('../src/data/game-meta.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const games = G.listedGames().map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, cat: g.category, added: g.added, kind: M.META[g.slug]?.difficulty === 'Explore' ? 'explore' : 'play', tint: '#fff' }))
const bySlug = Object.fromEntries(games.map((g) => [g.slug, g]))
const TODAY = '2026-10-15'
const daily = M.dailyFor(new Date(TODAY + 'T12:00:00Z')).slug
const visit = (last) => ({ first: '2026-09-01', last, days: 1 })

console.log('\nfrom every game, for a newcomer')
{
  let three = true, self = true, twice = true, dailyFirst = true, like = true, diff = true
  for (const g of games) {
    const out = N.pickNext(g.slug, games, {}, { today: TODAY, daily })
    if (out.length !== 3) three = false
    if (out.some((p) => p.g.slug === g.slug)) self = false
    if (new Set(out.map((p) => p.g.slug)).size !== out.length) twice = false
    if (g.slug !== daily && (out[0].why !== 'daily' || out[0].g.slug !== daily)) dailyFirst = false
    if (g.slug === daily && out.some((p) => p.why === 'daily')) dailyFirst = false
    for (const p of out) {
      if (p.why === 'like' && p.g.cat !== g.cat) like = false
      if (p.why === 'different' && p.g.cat === g.cat) diff = false
    }
  }
  check(three, 'every game is offered exactly three more')
  check(self, 'never the game being played')
  check(twice, 'never one game twice')
  check(dailyFirst, "today's challenge comes first, except on its own page")
  check(like, '"More like this" is always the same category')
  check(diff, '"Something different" is always another category')
  const reasons = new Set(games.flatMap((g) => N.pickNext(g.slug, games, {}, { today: TODAY, daily }).map((p) => p.why)))
  check(reasons.has('like') && reasons.has('different'), 'both "like" and "different" turn up')
}

console.log('\nfor a regular')
{
  const cur = 'trolley'
  const sameCat = games.filter((g) => g.cat === bySlug[cur].cat && g.slug !== cur)
  // Every game in its category visited but one: that one is the "more like this".
  const visits = Object.fromEntries(sameCat.slice(1).map((g) => [g.slug, visit('2026-10-10')]))
  const out = N.pickNext(cur, games, visits, { today: TODAY, daily })
  const like = out.find((p) => p.why === 'like')
  check(like?.g.slug === sameCat[0].slug, 'a game not yet in the passport is offered before one that is')
  check(N.pickNext(cur, games, { [daily]: visit(TODAY) }, { today: TODAY, daily }).every((p) => p.why !== 'daily'), "today's challenge is not offered once it was played today")
  check(N.pickNext(cur, games, { [daily]: visit('2026-10-14') }, { today: TODAY, daily }).some((p) => p.why === 'daily') || cur === daily, "it is offered again if it was last played yesterday")
  // All visited: the one gone longest without comes first among the like.
  const all = Object.fromEntries(games.map((g, i) => [g.slug, visit(`2026-09-${String(10 + (i % 20)).padStart(2, '0')}`)]))
  const out2 = N.pickNext(cur, games, all, { today: TODAY, daily: null })
  check(out2.length === 3 && out2.every((p) => p.why !== 'new' && p.why !== 'fresh'), 'somebody who has played everything still gets three, none called new')
  const like2 = out2.find((p) => p.why === 'like')
  const oldest = sameCat.map((g) => all[g.slug].last).sort()[0]
  check(like2 && all[like2.g.slug].last === oldest, 'among played games, the one gone longest without comes first')
}

console.log('\nthe day')
{
  const a = N.pickNext('deep-sea', games, {}, { today: TODAY, daily: null }).map((p) => p.g.slug).join()
  const b = N.pickNext('deep-sea', games, {}, { today: TODAY, daily: null }).map((p) => p.g.slug).join()
  check(a === b, 'the same three all day')
  let changed = 0
  for (let d = 1; d <= 20; d++) {
    const day = `2026-11-${String(d).padStart(2, '0')}`
    if (N.pickNext('deep-sea', games, {}, { today: day, daily: null }).map((p) => p.g.slug).join() !== a) changed++
  }
  check(changed >= 10, `a different three on most other days (${changed} of 20)`)
}

console.log('\nthe pictures')
{
  const page = readFileSync('src/pages/next/[world]/[slug].webp.ts', 'utf8')
  check(/homeGames\(\)/.test(page) && /\['cartoon', 'real'\]/.test(page), 'a building picture is made for every listed game, in both islands')
  const html = N.cardHtml({ g: { ...games[0], title: 'A <b>"bad"</b> title' }, why: 'like' }, { games, worlds: ['cartoon'], world: 'cartoon', home: { cartoon: '/' }, base: '' }, 'cartoon', true)
  check(html.includes(`src="/next/cartoon/${games[0].slug}.webp"`) && html.includes(`href="/${games[0].slug}/"`), 'a card links to its game and asks for its picture')
  check(!html.includes('<b>"bad"') && html.includes('New passport stamp'), 'a card escapes its text, and says when it is a new stamp')
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0

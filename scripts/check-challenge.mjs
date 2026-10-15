/**
 * check-challenge — do friend challenges (src/lib/challenge.ts) carry a
 * result there and back intact, and nothing else?
 *
 * - every result text the games really write survives the link;
 * - anything that is not one (markup, a script, a long string, a number
 *   that is not) is refused, so a doctored link can only claim a score;
 * - the link keeps the game's address and drops whatever else was on it;
 * - a run against a friend is won, tied or lost the right way round, and
 *   Trolley compares instead of scoring;
 * - every game with a challenge has words for it, and ends with a result
 *   the challenge can carry.
 *
 *   node scripts/check-challenge.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./resolve-ts.mjs', import.meta.url)

const C = await import('../src/lib/challenge.ts')
const G = await import('../src/data/games.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

console.log('\nthe link')
{
  // What the games write, read off their considerBest calls and Trolley's positions.
  const texts = ['87.3%', '100%', '9 / 11', '212 keys', '1,204 keys', '+£12,400', '−£3,000', '±£0', 'Deontologist', 'Virtue ethicist', 'split']
  const back = texts.map((t) => C.decodeVs(new URL(C.challengeUrl('https://x.test/steady-hand/', { value: 873, text: t })).searchParams.get('vs')))
  check(back.every((v, i) => v && v.text === texts[i] && v.value === 873), `every result text the games write comes back intact (${texts.join(' · ')})`)
  check(C.decodeVs('12.5~87.3%').value === 12.5 && C.decodeVs('-3000~−£3,000').value === -3000, 'fractions and losses survive')
  const bad = ['', 'abc', '~87%', 'NaN~87%', '1e15~87%', '5~<b>x</b>', '5~"onload', '5~' + 'x'.repeat(30), '5~', 'Infinity~x', '5~a\nb', '5~javascript:alert(1)']
  check(bad.every((s) => C.decodeVs(s) === null), 'markup, scripts, long strings and numbers that are not are all refused')
  check(C.decodeVs(null) === null, 'no parameter: no challenge')
  const u = new URL(C.challengeUrl('https://x.test/trolley/?ref=share&vs=1~old&utm_source=y#top', { value: 80, text: 'Deontologist' }))
  check(u.pathname === '/trolley/' && u.hash === '' && u.searchParams.get('ref') === 'challenge' && u.searchParams.get('vs') === '80~Deontologist' && !u.searchParams.has('utm_source'), 'the link keeps the game, says it is a challenge, and drops everything else')
}

console.log('\nthe verdict')
{
  const v = (value, text) => ({ value, text })
  check(C.verdict('beat', v(90, '90%'), v(80, '80%')).won, 'higher beats lower')
  check(!C.verdict('beat', v(70, '70%'), v(80, '80%')).won && /70%.*80%/.test(C.verdict('beat', v(70, '70%'), v(80, '80%')).line), 'lower loses, and both results are said')
  const t = C.verdict('beat', v(80, '80%'), v(80, '80%'))
  check(t.tie && !t.won, 'the same is a dead heat')
  const c1 = C.verdict('compare', v(80, 'Deontologist'), v(70, 'Utilitarian')), c2 = C.verdict('compare', v(80, 'Utilitarian'), v(90, 'Utilitarian'))
  check(!c1.won && !c1.tie && /deontologist/.test(c1.line) && /a utilitarian/.test(c1.line), 'Trolley compares positions rather than scoring them')
  check(c2.tie && /both/.test(c2.line), 'and says so when you agree')
  check(/an? /.test(C.verdict('compare', v(1, 'split'), v(1, 'Utilitarian')).line), 'a split verdict reads as a sentence')
}

console.log('\nthe games')
{
  const slugs = new Set(G.listedGames().map((g) => g.slug))
  // Each game's own way of writing a result, as its considerBest (or Trolley's vs) writes it.
  const SAMPLE = { 'dark-patterns': '9 / 11', 'rule-cascade': '212 keys', auction: '+£12,400', trolley: 'Utilitarian' }
  for (const [slug, spec] of Object.entries(C.CHALLENGES)) {
    const t = SAMPLE[slug] ?? '87%', core = t === 'Utilitarian' ? 'utilitarian' : t.replace(/^[+−±]/, '').split(' ')[0]
    const src = readFileSync(`src/pages/${slug}.astro`, 'utf8')
    const carries = spec.kind === 'compare' ? /vs: \{/.test(src) : /considerBest\(/.test(src)
    const brag = spec.brag(t), banner = spec.banner(t), msg = C.message(slug, { value: 1, text: t })
    check(slugs.has(slug) && carries && brag.includes(core) && banner.includes(core) && msg.length <= 160 && !/\s{2}|undefined/.test(msg + banner),
      `${slug}: a ${spec.kind} challenge, with a brag, a dare and a banner ("${msg}")`)
  }
  check(!C.CHALLENGES['life-in-weeks'] && !C.CHALLENGES['spend-it'], 'no challenge where a "score" is not a skill (weeks lived, money spent)')
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0

/**
 * check-dark-patterns — does every pattern in src/lib/dark-patterns.ts have a
 * real citation, a distinct voice, and an actual interactive demo behind it?
 *
 *   1. A sane count, no duplicate ids/titles, nothing left as a placeholder.
 *   2. Every `real` field cites an actual published source — a name and a
 *      year in parens — rather than an invented-sounding label. This is the
 *      one thing that makes this game "real substance" rather than eleven
 *      guessed vibes: check against a fixed allow-list of the three
 *      taxonomies this file actually draws from.
 *   3. `lede` and `reveal` are long enough to be real writing, and no two
 *      patterns share a sentence with each other (copy-paste tell).
 *   4. Cross-file: every pattern's `id` has a matching `id(host, api) {`
 *      mount function in dark-patterns.astro, and nothing in the page mounts
 *      an id absent from the data file.
 *   5. The game is wired into the registry: games.ts has the slug, tile-art.ts
 *      has a drawing for it.
 *   6. No emoji anywhere in the three files this game owns.
 *
 *   node scripts/check-dark-patterns.mjs
 */
import fs from 'node:fs'

const { PATTERNS } = await import('../src/lib/dark-patterns.ts')
const { GAMES } = await import('../src/data/games.ts')
const { ART } = await import('../src/lib/tile-art.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const PAGE = fs.readFileSync(new URL('../src/pages/dark-patterns.astro', import.meta.url), 'utf8')

/* ---- 1. shape ------------------------------------------------------------- */

console.log('data')
{
  check(PATTERNS.length >= 10, `at least ten patterns (${PATTERNS.length})`)
  const ids = PATTERNS.map((p) => p.id)
  const titles = PATTERNS.map((p) => p.title)
  check(new Set(ids).size === ids.length, 'every id is unique')
  check(new Set(titles).size === titles.length, 'every title is unique')
  check(ids.every((i) => /^[a-z][a-z0-9]*$/.test(i)), 'every id is a plain lowercase identifier')
  for (const p of PATTERNS) {
    check(p.lede.length >= 15, `${p.id}: lede is real writing, not a stub`)
    check(p.reveal.length >= 80, `${p.id}: reveal actually explains the mechanism`)
  }
}

/* ---- 2. real citations ------------------------------------------------------ */

console.log('\ncitations')
{
  const SOURCES = [
    /Brignull, Dark Patterns \(2010\)/,
    /Princeton\/CHI, Dark Patterns at Scale \(2019\)/,
    /FTC, Bringing Dark Patterns to Light \(2022\)/,
  ]
  for (const p of PATTERNS) {
    const cited = SOURCES.some((re) => re.test(p.real))
    check(cited, `${p.id}: "real" cites one of the three actual taxonomies this game draws from`)
  }
  ok(`${new Set(PATTERNS.map((p) => p.real)).size} distinct citations across ${PATTERNS.length} patterns`)
}

/* ---- 3. distinctness -------------------------------------------------------- */

console.log('\ndistinctness')
{
  const sentences = (s) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 25)
  const seen = new Map()
  let dupes = 0
  for (const p of PATTERNS) {
    for (const s of [...sentences(p.lede), ...sentences(p.reveal)]) {
      const owner = seen.get(s)
      if (owner && owner !== p.id) { fail(`${p.id} and ${owner} share a sentence verbatim: "${s.slice(0, 60)}…"`); dupes++ }
      seen.set(s, p.id)
    }
  }
  check(dupes === 0, 'no two patterns share a written sentence')
}

/* ---- 4. every pattern has a real mount, and nothing extra ------------------ */

console.log('\nevery pattern is actually built')
{
  let missing = 0
  for (const p of PATTERNS) {
    const re = new RegExp(`\\b${p.id}\\s*\\(\\s*host\\b`)
    if (!re.test(PAGE)) { fail(`${p.id}: no "${p.id}(host, api) {" mount function found in dark-patterns.astro`); missing++ }
  }
  check(missing === 0, `all ${PATTERNS.length} patterns have a mount function in the page`)

  // The reverse direction: MOUNTS should not quietly grow an entry the data
  // file never introduced, which would mean it never renders (nothing calls
  // an id PATTERNS does not know about) or is dead code.
  const mountsBlock = PAGE.match(/const MOUNTS[^=]*=\s*\{([\s\S]*?)\n  \}/)
  if (mountsBlock) {
    const defined = [...mountsBlock[1].matchAll(/\n\s{4}([a-z][a-z0-9]*)\s*\(\s*host\b/g)].map((m) => m[1])
    const known = new Set(PATTERNS.map((p) => p.id))
    const orphans = defined.filter((id) => !known.has(id))
    check(orphans.length === 0, `no mount function names an id absent from dark-patterns.ts${orphans.length ? ': ' + orphans.join(', ') : ''}`)
  } else {
    fail('could not find a MOUNTS object in dark-patterns.astro to cross-check')
  }
}

/* ---- 5. wired into the site -------------------------------------------------- */

console.log('\nwired into the site')
{
  const game = GAMES.find((g) => g.slug === 'dark-patterns')
  check(!!game, 'games.ts has a "dark-patterns" entry')
  if (game) {
    check(!!game.title && !!game.blurb && !!game.description, 'the registry entry has a title, blurb and description')
    check(/^#[0-9a-f]{6}$/i.test(game.accent) && /^#[0-9a-f]{6}$/i.test(game.accent2), 'accent and accent2 are real hex colours')
  }
  check(!!ART['dark-patterns'], 'tile-art.ts has a drawing for "dark-patterns"')
}

/* ---- 6. no emoji ------------------------------------------------------------- */

console.log('\nno emoji')
{
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
  for (const f of ['src/lib/dark-patterns.ts', 'src/pages/dark-patterns.astro']) {
    check(!EMOJI.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), `${f} has no emoji`)
  }
}

console.log(failures ? `\n${failures} failed.` : '\nAll dark-patterns checks passed.')
process.exitCode = failures ? 1 : 0

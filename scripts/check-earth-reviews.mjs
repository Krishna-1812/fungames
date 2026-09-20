/**
 * check-earth-reviews — is the comedy backed by real arithmetic, and is every
 * product actually drawn?
 *
 * Earth Reviews is the one page on this site whose *copy* is invented on
 * purpose, which makes it the page where a wrong number is hardest to notice:
 * nobody reading a joke about gravity double-checks that 2.3 is really the
 * mean of 1, 5, 2 and 1. So this file does, for every phenomenon, and it does
 * it three independent ways rather than calling `averageRating` and agreeing
 * with itself:
 *
 *   1. Against means worked out by hand and typed in here, with the raw
 *      rating list written beside them so the expected value can be checked
 *      by eye without running anything.
 *   2. Against a mean recomputed from the reviews with plain arithmetic.
 *   3. Against a mean reconstructed from `ratingDistribution`'s counts —
 *      which knows nothing about the individual reviews, so a distribution
 *      that had drifted out of step with the reviews could not agree with the
 *      other two by accident.
 *
 * Twelve of the twenty-two phenomena average to exactly x.x5, so the stated
 * rounding rule (one decimal place, halves away from zero) is doing real work
 * rather than being a formality — it decides more than half the numbers on the
 * page. There is a direct test of it below on synthetic input.
 *
 * Then the things a data file quietly rots into: a review body pasted twice, a
 * reviewer name reused so often it reads as one person, a "most recent" sort
 * that happens to produce the same order as "most helpful" and so does
 * nothing, a cross-sell pointing at a product that no longer exists, a
 * phenomenon with no drawing or a drawing with no phenomenon, and an SVG id
 * that is not prefixed with its own key — which on this page, where all
 * twenty-two drawings inline into one document, means one of them silently
 * renders with another's gradient.
 *
 *   node scripts/check-earth-reviews.mjs [--sheet out.png]
 */
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  PHENOMENA,
  STARS,
  averageRating,
  ratingDistribution,
  totalHelpful,
  sortReviews,
  sortPhenomena,
  catalogueStats,
  phenomenonById,
} = await import('../src/data/earth-reviews.ts')
const { ART, VIEWBOX, moodMap, dominantMood, starsSvg, symbolId } = await import(
  '../src/lib/earth-reviews-art.ts'
)
const { GAMES } = await import('../src/data/games.ts')
const { ART: TILE_ART } = await import('../src/lib/tile-art.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/* ---- 1. the catalogue ----------------------------------------------------- */

console.log('catalogue')
{
  check(
    PHENOMENA.length >= 30 && PHENOMENA.length <= 34,
    `between 30 and 34 phenomena (${PHENOMENA.length})`,
  )
  const ids = PHENOMENA.map((p) => p.id)
  check(new Set(ids).size === ids.length, 'every id is unique')
  check(
    ids.every((i) => /^[a-z][a-z0-9-]*$/.test(i)),
    'every id is a plain lowercase slug',
  )
  const names = PHENOMENA.map((p) => p.name)
  check(new Set(names).size === names.length, 'every product name is unique')

  let bad = 0
  for (const p of PHENOMENA) {
    if (!p.name || !p.department) { fail(`${p.id}: missing a name or a department`); bad++ }
    if (p.tagline.length < 30 || p.tagline.length > 110)
      { fail(`${p.id}: tagline is ${p.tagline.length} chars, wanted 30–110`); bad++ }
    if (!/[.!]$/.test(p.tagline)) { fail(`${p.id}: tagline does not end in a full stop`); bad++ }
  }
  check(bad === 0, 'every product has a name, a department and one line of catalogue copy')
  ok(`${new Set(PHENOMENA.map((p) => p.department)).size} departments across ${PHENOMENA.length} products`)
}

/* ---- 2. the reviews ------------------------------------------------------- */

console.log('\nreviews')
{
  const FLOOR = 3
  const CEILING = 6
  let bad = 0
  for (const p of PHENOMENA) {
    const n = p.reviews.length
    if (n < FLOOR || n > CEILING) { fail(`${p.id}: ${n} reviews, wanted ${FLOOR}–${CEILING}`); bad++ }
    for (const r of p.reviews) {
      if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5)
        { fail(`${p.id}: "${r.title}" has rating ${r.rating}, wanted an integer 1–5`); bad++ }
      if (!r.name || r.name.length < 4) { fail(`${p.id}: a review has no reviewer name`); bad++ }
      if (!r.title || r.title.length < 4 || r.title.length > 80)
        { fail(`${p.id}: review title "${r.title}" is ${r.title?.length} chars, wanted 4–80`); bad++ }
      // Bodies are written at one to three sentences; the staccato ones run
      // longer on purpose, so the ceiling is six rather than three.
      const sentences = r.body.split(/(?<=[.!?])\s+/).filter(Boolean).length
      // The floor is 24 rather than 40 because Deserts' one-star review is
      // "This is the entire review." and the brevity is the joke. Anything
      // shorter than that is a stub rather than a punchline.
      if (r.body.length < 24 || r.body.length > 340)
        { fail(`${p.id}: review body "${r.title}" is ${r.body.length} chars, wanted 24–340`); bad++ }
      if (sentences < 1 || sentences > 6)
        { fail(`${p.id}: review body "${r.title}" is ${sentences} sentences, wanted 1–6`); bad++ }
      if (!Number.isInteger(r.helpful) || r.helpful < 0)
        { fail(`${p.id}: "${r.title}" has a non-integer helpful count`); bad++ }
    }
  }
  check(bad === 0, `all ${PHENOMENA.reduce((s, p) => s + p.reviews.length, 0)} reviews are well formed`)

  const counts = PHENOMENA.map((p) => p.reviews.length)
  ok(`review counts run ${Math.min(...counts)}–${Math.max(...counts)} per product`)

  // Every star value has to appear somewhere, or the "distribution" is really
  // a two-value histogram dressed up as five bars.
  const used = new Set(PHENOMENA.flatMap((p) => p.reviews.map((r) => r.rating)))
  check(used.size === 5, `all five star values are actually used (${[...used].sort().join(', ')})`)
}

/* ---- 3. the rounding rule itself ------------------------------------------ */

console.log('\nthe rounding rule, on input whose answer is not in doubt')
{
  const synth = (ratings) => averageRating({ reviews: ratings.map((rating) => ({ rating })) })
  const cases = [
    [[1, 1, 1, 1], 1.0, 'all ones'],
    [[5, 5, 5], 5.0, 'all fives'],
    [[1, 5, 2, 1], 2.3, 'an exact 2.25 goes up, not down'],
    [[1, 1, 3, 2], 1.8, 'an exact 1.75 goes up, not down'],
    [[5, 1, 3, 4], 3.3, 'an exact 3.25 goes up, not down'],
    [[3, 1, 5, 2], 2.8, 'an exact 2.75 goes up, not down'],
    [[1, 2], 1.5, 'a mean already on one decimal place is left alone'],
    [[1, 1, 1, 2, 2, 2, 3], 1.7, 'a recurring 1.714… truncates correctly'],
    [[4, 4, 4, 5, 5, 5], 4.5, 'a clean half'],
  ]
  let bad = 0
  for (const [ratings, want, why] of cases) {
    const got = synth(ratings)
    if (got !== want) { fail(`[${ratings}] -> ${got}, expected ${want} (${why})`); bad++ }
  }
  check(bad === 0, `all ${cases.length} rounding cases, including five exact halves`)
  check(averageRating({ reviews: [] }) === 0, 'an empty product averages 0 rather than NaN')
}

/* ---- 4. hand-computed averages -------------------------------------------- */

console.log('\naverages, against sums done by hand')
{
  // The rating list is written out beside each expected value so the maths can
  // be checked by reading rather than by trusting the same function twice.
  const HAND = {
    gravity: [[1, 5, 2, 1], 9, 4, 2.3],
    'the-sun': [[1, 4, 1, 5, 2], 13, 5, 2.6],
    'the-moon': [[3, 1, 5, 2], 11, 4, 2.8],
    mondays: [[1, 1, 4, 2], 8, 4, 2.0],
    'jet-lag': [[1, 1, 3, 2], 7, 4, 1.8],
    volcanoes: [[1, 4, 2, 5], 12, 4, 3.0],
    photosynthesis: [[5, 1, 3, 4], 13, 4, 3.3],
    'growing-old': [[1, 2, 5, 3, 1], 12, 5, 2.4],
    mosquitoes: [[1, 1, 2, 1, 5], 10, 5, 2.0],
  }
  let bad = 0
  for (const [id, [ratings, sum, n, want]] of Object.entries(HAND)) {
    const p = phenomenonById(id)
    if (!p) { fail(`${id}: no such phenomenon any more — the hand-checked table is stale`); bad++; continue }
    const actual = p.reviews.map((r) => r.rating)
    if (String(actual) !== String(ratings))
      { fail(`${id}: ratings are now [${actual}], the hand-checked table says [${ratings}]`); bad++; continue }
    if (ratings.reduce((s, r) => s + r, 0) !== sum || ratings.length !== n)
      { fail(`${id}: the hand-written sum ${sum}/${n} does not match its own list`); bad++; continue }
    const got = averageRating(p)
    if (got !== want) { fail(`${id}: averageRating gave ${got}, hand-computed ${sum}/${n} rounds to ${want}`); bad++ }
  }
  check(bad === 0, `${Object.keys(HAND).length} products' averages match a sum done by hand`)
}

/* ---- 5. every average, two more ways -------------------------------------- */

console.log('\nevery average, recomputed independently')
{
  let badPlain = 0
  let badDist = 0
  let halves = 0
  for (const p of PHENOMENA) {
    const shown = averageRating(p)

    // (a) plain arithmetic over the reviews.
    const sum = p.reviews.reduce((s, r) => s + r.rating, 0)
    const raw = sum / p.reviews.length
    const plain = Math.round(raw * 10 + (Number.isInteger(raw * 10 * 2) && !Number.isInteger(raw * 10) ? 0 : 0)) / 10
    // Math.round on a float can land the wrong side of an exact half, which is
    // exactly the bug the one-division rule exists to avoid — so compare in
    // integers instead: shown*10 must equal round(sum*10/n) exactly.
    const wantTenths = Math.round((sum * 10) / p.reviews.length)
    if (Math.round(shown * 10) !== wantTenths)
      { fail(`${p.id}: shows ${shown}, integer arithmetic says ${wantTenths / 10}`); badPlain++ }
    if (Math.abs(plain - shown) > 0.051)
      { fail(`${p.id}: shows ${shown}, float arithmetic says about ${plain}`); badPlain++ }
    if ((sum * 20) % p.reviews.length === 0 && (sum * 10) % p.reviews.length !== 0) halves++

    // (b) from the distribution alone, which never sees an individual review.
    const dist = ratingDistribution(p)
    const distSum = STARS.reduce((s, v) => s + v * dist[v], 0)
    const distN = STARS.reduce((s, v) => s + dist[v], 0)
    if (Math.round((distSum * 10) / distN) !== wantTenths)
      { fail(`${p.id}: the bars imply ${Math.round((distSum * 10) / distN) / 10}, the page shows ${shown}`); badDist++ }
  }
  check(badPlain === 0, `all ${PHENOMENA.length} averages survive being recomputed from the reviews`)
  check(badDist === 0, `all ${PHENOMENA.length} averages survive being recomputed from the bars alone`)
  ok(`${halves} of ${PHENOMENA.length} averages land on an exact half, so the rounding rule decides them`)
}

/* ---- 6. the bars add up ---------------------------------------------------- */

console.log('\nthe bars add up')
{
  let bad = 0
  for (const p of PHENOMENA) {
    const dist = ratingDistribution(p)
    const keys = Object.keys(dist).map(Number).sort()
    if (String(keys) !== '1,2,3,4,5') { fail(`${p.id}: distribution has keys [${keys}], wanted 1–5`); bad++ }
    const total = STARS.reduce((s, v) => s + dist[v], 0)
    if (total !== p.reviews.length)
      { fail(`${p.id}: bars sum to ${total} but there are ${p.reviews.length} reviews`); bad++ }
    for (const v of STARS) {
      const byHand = p.reviews.filter((r) => r.rating === v).length
      if (dist[v] !== byHand) { fail(`${p.id}: ${v}-star bar says ${dist[v]}, counting says ${byHand}`); bad++ }
    }
  }
  check(bad === 0, `every product's five bars sum to its own review count, and each bar is the real count`)
}

/* ---- 7. the site-wide numbers in the storefront header --------------------- */

console.log('\nthe storefront header')
{
  const all = PHENOMENA.flatMap((p) => p.reviews)
  const s = catalogueStats()
  check(s.phenomena === PHENOMENA.length, `product count is ${s.phenomena}`)
  check(s.reviews === all.length, `review count is ${s.reviews}`)
  const sum = all.reduce((a, r) => a + r.rating, 0)
  check(
    Math.round(s.mean * 10) === Math.round((sum * 10) / all.length),
    `site-wide mean ${s.mean} is the mean of all ${all.length} reviews, not the mean of the per-product means`,
  )
  const ones = all.filter((r) => r.rating === 1).length
  check(s.oneStarShare === Math.round((ones * 100) / all.length), `one-star share ${s.oneStarShare}% matches ${ones}/${all.length}`)
  // The mean of the averages is a different number, and using it would be a
  // quiet lie whenever the products do not all carry the same review count.
  const meanOfMeans = Math.round((PHENOMENA.reduce((a, p) => a + averageRating(p), 0) * 10) / PHENOMENA.length) / 10
  ok(`(the mean of the per-product averages would be ${meanOfMeans} — deliberately not what is shown)`)
}

/* ---- 8. nothing is copy-pasted --------------------------------------------- */

console.log('\nnothing is written twice')
{
  const bodies = new Map()
  const seenTitles = new Map()
  let dupes = 0
  for (const p of PHENOMENA) {
    for (const r of p.reviews) {
      const key = r.body.trim().toLowerCase()
      if (bodies.has(key)) { fail(`${p.id} and ${bodies.get(key)} share a review body verbatim`); dupes++ }
      bodies.set(key, p.id)
      const tkey = `${p.id}::${r.title.toLowerCase()}`
      if (seenTitles.has(tkey)) { fail(`${p.id} uses the review title "${r.title}" twice`); dupes++ }
      seenTitles.set(tkey, true)
    }
  }
  check(dupes === 0, `all ${bodies.size} review bodies are distinct`)

  // A whole sentence appearing under two different products is the real
  // copy-paste tell; a short one shared by chance is not worth failing on.
  const sentences = new Map()
  let shared = 0
  for (const p of PHENOMENA)
    for (const r of p.reviews)
      for (const s of r.body.split(/(?<=[.!?])\s+/).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 30)) {
        if (sentences.has(s) && sentences.get(s) !== p.id) {
          fail(`${p.id} and ${sentences.get(s)} share a sentence: "${s.slice(0, 54)}…"`)
          shared++
        }
        sentences.set(s, p.id)
      }
  check(shared === 0, 'no two products share a written sentence')
}

/* ---- 9. the reviewers ------------------------------------------------------ */

console.log('\nthe reviewers')
{
  const all = PHENOMENA.flatMap((p) => p.reviews)
  const seen = new Map()
  for (const r of all) seen.set(r.name, (seen.get(r.name) ?? 0) + 1)
  const repeats = [...seen].filter(([, n]) => n > 3)
  check(
    repeats.length === 0,
    `no reviewer name is used more than three times${repeats.length ? ': ' + repeats.map(([n, c]) => `${n} x${c}`).join(', ') : ''}`,
  )
  check(
    seen.size >= all.length * 0.8,
    `${seen.size} distinct display names across ${all.length} reviews`,
  )
  // Two reviewers under one product with the same name reads as a bug rather
  // than a coincidence, whatever the site-wide count says.
  let clash = 0
  for (const p of PHENOMENA) {
    const names = p.reviews.map((r) => r.name)
    if (new Set(names).size !== names.length) { fail(`${p.id} has two reviews under one name`); clash++ }
  }
  check(clash === 0, 'no product has the same reviewer twice')
}

/* ---- 10. the dates, and the sort control they exist for -------------------- */

console.log('\ndates and sorting')
{
  let bad = 0
  for (const p of PHENOMENA)
    for (const r of p.reviews) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) { fail(`${p.id}: "${r.date}" is not an ISO date`); bad++; continue }
      const t = Date.parse(r.date + 'T00:00:00Z')
      if (Number.isNaN(t)) { fail(`${p.id}: "${r.date}" does not parse`); bad++; continue }
      if (r.date < '2024-01-01' || r.date > '2026-12-31')
        { fail(`${p.id}: "${r.date}" is outside the range these were written in`); bad++ }
    }
  check(bad === 0, 'every review carries a real, in-range ISO date')

  // If "most recent" produced the same order as "most helpful" everywhere, the
  // control would be decoration. It does not have to differ on every product —
  // a three-review product can legitimately agree — but it has to differ often.
  let differ = 0
  for (const p of PHENOMENA) {
    const a = sortReviews(p, 'helpful').map((r) => r.title)
    const b = sortReviews(p, 'recent').map((r) => r.title)
    if (String(a) !== String(b)) differ++
  }
  check(
    differ >= PHENOMENA.length / 2,
    `the two review sorts give a different order on ${differ} of ${PHENOMENA.length} products`,
  )

  // Both sorts must be total (no ties left to engine order) and must not
  // mutate the source array, which the page re-reads on every re-sort.
  let unstable = 0
  for (const p of PHENOMENA) {
    const before = p.reviews.map((r) => r.title).join('|')
    for (const mode of ['helpful', 'recent']) {
      const one = sortReviews(p, mode).map((r) => r.title).join('|')
      const two = sortReviews(p, mode).map((r) => r.title).join('|')
      if (one !== two) { fail(`${p.id}: sortReviews("${mode}") is not deterministic`); unstable++ }
    }
    if (p.reviews.map((r) => r.title).join('|') !== before)
      { fail(`${p.id}: sortReviews mutated the source array`); unstable++ }
  }
  check(unstable === 0, 'both review sorts are deterministic and leave the data alone')

  // The storefront's three orderings, same two properties.
  const ids = PHENOMENA.map((p) => p.id).join('|')
  let storeBad = 0
  for (const mode of ['reviewed', 'lowest', 'name']) {
    const a = sortPhenomena(PHENOMENA, mode).map((p) => p.id)
    const b = sortPhenomena(PHENOMENA, mode).map((p) => p.id)
    if (String(a) !== String(b)) { fail(`sortPhenomena("${mode}") is not deterministic`); storeBad++ }
    if (a.length !== PHENOMENA.length || new Set(a).size !== PHENOMENA.length)
      { fail(`sortPhenomena("${mode}") lost or duplicated a product`); storeBad++ }
  }
  if (PHENOMENA.map((p) => p.id).join('|') !== ids) { fail('sortPhenomena mutated the source array'); storeBad++ }
  const byLowest = sortPhenomena(PHENOMENA, 'lowest')
  for (let i = 1; i < byLowest.length; i++)
    if (averageRating(byLowest[i]) < averageRating(byLowest[i - 1]))
      { fail('sortPhenomena("lowest") is not actually ascending'); storeBad++; break }
  check(storeBad === 0, 'all three storefront orderings are total, stable and leave the data alone')
  ok(`worst-reviewed: ${byLowest[0].name} at ${averageRating(byLowest[0])}; best: ${byLowest[byLowest.length - 1].name} at ${averageRating(byLowest[byLowest.length - 1])}`)
}

/* ---- 11. the cross-sell row ------------------------------------------------ */

console.log('\ncustomers also regretted')
{
  let bad = 0
  for (const p of PHENOMENA) {
    if (!Array.isArray(p.alsoRegretted) || p.alsoRegretted.length !== 2)
      { fail(`${p.id}: alsoRegretted is not exactly two products`); bad++; continue }
    if (p.alsoRegretted[0] === p.alsoRegretted[1]) { fail(`${p.id}: cross-sells the same product twice`); bad++ }
    for (const other of p.alsoRegretted) {
      if (other === p.id) { fail(`${p.id}: cross-sells itself`); bad++ }
      if (!phenomenonById(other)) { fail(`${p.id}: cross-sells "${other}", which does not exist`); bad++ }
    }
  }
  check(bad === 0, 'every product cross-sells two other real products')
  // Everything should be reachable from somewhere, or a product exists that
  // nothing on the page ever links to.
  const linked = new Set(PHENOMENA.flatMap((p) => p.alsoRegretted))
  const orphans = PHENOMENA.filter((p) => !linked.has(p.id)).map((p) => p.id)
  check(orphans.length <= 4, `${PHENOMENA.length - orphans.length} products are linked from another product's page${orphans.length ? ` (not: ${orphans.join(', ')})` : ''}`)
}

/* ---- 12. every product is drawn, and every drawing has a product ----------- */

console.log('\nevery product is drawn')
{
  const drawn = Object.keys(ART)
  const known = new Set(PHENOMENA.map((p) => p.id))
  const missing = [...known].filter((id) => !ART[id])
  const orphan = drawn.filter((id) => !known.has(id))
  check(missing.length === 0, `every phenomenon has a drawing${missing.length ? ': missing ' + missing.join(', ') : ''}`)
  check(orphan.length === 0, `no drawing is orphaned${orphan.length ? ': ' + orphan.join(', ') : ''}`)
  check(drawn.length === PHENOMENA.length, `${drawn.length} drawings for ${PHENOMENA.length} products`)

  let bad = 0
  for (const id of drawn) {
    const d = ART[id]
    if (!d.subject || d.subject.length < 20) { fail(`${id}: subject line is a stub`); bad++ }
    if (d.draw() !== d.draw()) { fail(`${id}: draw() is not deterministic`); bad++ }
    if (d.draw().length < 200) { fail(`${id}: drawing is ${d.draw().length} chars — too thin to be a picture`); bad++ }
  }
  check(bad === 0, 'every drawing is deterministic, described, and has real markup in it')
  check(VIEWBOX === '0 0 120 120', `all drawings share one stage (${VIEWBOX})`)
}

/* ---- 13. ids are safe to inline twenty-two at a time ----------------------- */

console.log('\nids are safe to inline twenty-two at a time')
{
  const seen = new Map()
  let bad = 0
  for (const id of Object.keys(ART)) {
    const markup = ART[id].draw()
    for (const m of markup.matchAll(/\sid="([^"]+)"/g)) {
      const attr = m[1]
      if (!attr.startsWith(id)) { fail(`${id}: id "${attr}" is not prefixed with its own key`); bad++ }
      if (seen.has(attr)) { fail(`id "${attr}" is defined by both ${seen.get(attr)} and ${id}`); bad++ }
      seen.set(attr, id)
    }
    for (const m of markup.matchAll(/url\(#([^)]+)\)/g))
      if (!markup.includes(`id="${m[1]}"`)) { fail(`${id}: refers to #${m[1]}, which it does not define`); bad++ }
    // The symbol ids the sprite defines must not collide with each other or
    // with anything a drawing defines internally.
    if (seen.has(symbolId(id))) { fail(`symbol id ${symbolId(id)} collides with a drawing's own id`); bad++ }
  }
  check(bad === 0, `${seen.size} internal ids, all key-prefixed and unique across the module`)
  check(new Set(Object.keys(ART).map(symbolId)).size === Object.keys(ART).length, 'every symbol id is unique')
}

/* ---- 14. palettes and moods ------------------------------------------------ */

console.log('\npalettes and moods')
{
  let bad = 0
  for (const id of Object.keys(ART)) {
    const markup = ART[id].draw()
    const used = new Set(
      [...markup.matchAll(/(?:fill|stroke|stop-color)="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]),
    )
    const declared = new Set(ART[id].palette)
    const extra = [...used].filter((c) => !declared.has(c))
    const unused = [...declared].filter((c) => !used.has(c))
    if (extra.length) { fail(`${id}: uses ${extra.join(', ')}, which its palette does not list`); bad++ }
    if (unused.length) { fail(`${id}: palette lists ${unused.join(', ')}, which it never uses`); bad++ }
    if (declared.size < 4) { fail(`${id}: only ${declared.size} colours — too flat for a product shot`); bad++ }
  }
  check(bad === 0, 'every drawing uses exactly the colours its palette declares, and at least four')

  const moods = moodMap()
  let moodBad = 0
  for (const id of Object.keys(ART)) {
    const mood = moods[id]
    if (!/^#[0-9a-f]{6}$/i.test(mood)) { fail(`${id}: mood "${mood}" is not a hex colour`); moodBad++; continue }
    // The glow has to be a colour that is genuinely in the drawing, not a
    // plausible one chosen to sit beside it.
    if (!ART[id].draw().includes(mood)) { fail(`${id}: mood ${mood} does not appear in its own drawing`); moodBad++ }
    if (!ART[id].palette.includes(mood)) { fail(`${id}: mood ${mood} is not in its own declared palette`); moodBad++ }
    if (dominantMood(ART[id].draw()) !== mood) { fail(`${id}: moodMap disagrees with dominantMood`); moodBad++ }
  }
  check(moodBad === 0, 'every mood is a colour really present in the drawing it lights')
  const distinct = new Set(Object.values(moods)).size
  check(
    distinct === Object.keys(ART).length,
    `all ${Object.keys(ART).length} tiles glow a different colour (${distinct} distinct)`,
  )
}

/* ---- 15. the stars ---------------------------------------------------------- */

console.log('\nthe stars')
{
  // Filled and empty must differ by more than hue, or a colourblind reader
  // cannot count them. A filled star carries a `fill="#…"`; an empty one is
  // `fill="none"` with a stroke. Counting fills is therefore counting stars.
  const fills = (svg) => (svg.match(/fill="#f5a623"/g) ?? []).length
  const outlines = (svg) => (svg.match(/fill="none"/g) ?? []).length
  // [value, gold shapes, `fill="none"` outlines]. A half star contributes one
  // of each: the left-half polygon is gold, and it sits inside a complete
  // outline so the missing half still reads as a star rather than a wedge.
  const cases = [
    [5, 5, 0],
    [4, 4, 1],
    [1, 1, 4],
    [2.3, 3, 3],
    [2.8, 3, 3],
    [3.0, 3, 2],
    [4.8, 5, 1],
  ]
  let bad = 0
  for (const [value, wantFilled, wantOutline] of cases) {
    const svg = starsSvg(value)
    if (fills(svg) !== wantFilled) { fail(`starsSvg(${value}) painted ${fills(svg)} gold shapes, expected ${wantFilled}`); bad++ }
    if (outlines(svg) !== wantOutline) { fail(`starsSvg(${value}) drew ${outlines(svg)} outlines, expected ${wantOutline}`); bad++ }
  }
  check(bad === 0, 'filled and empty stars differ by fill, not only by colour')
  check(
    /role="img"/.test(starsSvg(2.3)) && /aria-label="2.3 out of 5 stars"/.test(starsSvg(2.3)),
    'a star row names its own value for a screen reader',
  )
  check(
    starsSvg(4.8).includes('M0 -10 L-2.245'),
    'a partial star is a real half polygon rather than a clipped rectangle',
  )
  // Nothing drawn for a rating should ever exceed five marks.
  const groups = (starsSvg(4.8).match(/<g transform/g) ?? []).length
  check(groups === 5, `a star row is always exactly five marks (${groups})`)
}

/* ---- 16. wired into the site ------------------------------------------------ */

console.log('\nwired into the site')
{
  const game = GAMES.find((g) => g.slug === 'earth-reviews')
  check(!!game, 'games.ts has an "earth-reviews" entry')
  if (game) {
    check(!!game.title && !!game.blurb && !!game.description, 'the registry entry has a title, blurb and description')
    check(game.category === 'fun', `category is "fun" (${game.category})`)
    check(
      /^#[0-9a-f]{6}$/i.test(game.accent) && /^#[0-9a-f]{6}$/i.test(game.accent2),
      'accent and accent2 are real hex colours',
    )
    check(/^\d{4}-\d{2}-\d{2}$/.test(game.added), `added date is an ISO date (${game.added})`)
  }
  check(!!TILE_ART['earth-reviews'], 'tile-art.ts has a drawing for "earth-reviews"')

  // The page has to actually use the data module rather than having grown its
  // own copy of the arithmetic.
  const page = fs.readFileSync(new URL('../src/pages/earth-reviews.astro', import.meta.url), 'utf8')
  check(/from '\.\.\/data\/earth-reviews'/.test(page), 'the page imports the data module')
  check(
    /averageRating/.test(page) && /ratingDistribution/.test(page),
    'the page calls averageRating and ratingDistribution rather than summing on its own',
  )
  // The trap every game on this site has hit at least once: a scoped rule that
  // can never match markup built at runtime.
  const runtimeBuilt = /\.innerHTML\s*=/.test(page)
  const globalStyle = /<style is:global>/.test(page)
  check(
    !runtimeBuilt || globalStyle,
    'the page builds markup at runtime, so its stylesheet is is:global rather than scoped',
  )
  check(!/:global\(/.test(page), 'no :global() inside the is:global block, where it would be wrong')
}

/* ---- 17. no emoji ----------------------------------------------------------- */

console.log('\nno emoji')
{
  const EMOJI = /\p{Extended_Pictographic}/u
  for (const f of [
    'src/data/earth-reviews.ts',
    'src/lib/earth-reviews-art.ts',
    'src/pages/earth-reviews.astro',
    'scripts/check-earth-reviews.mjs',
  ]) {
    const body = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
    check(!EMOJI.test(body), `${f} has no emoji`)
  }
}

/* ---- looking at what it measured -------------------------------------------- */

const sheetArg = process.argv.indexOf('--sheet')
if (sheetArg > -1) {
  const { Resvg } = await import('@resvg/resvg-js')
  const moods = moodMap()
  const keys = Object.keys(ART)
  const COLS = 6
  const S = 190
  const GAP = 10
  const rows = Math.ceil(keys.length / COLS)
  const W = COLS * (S + GAP) + GAP
  const H = rows * (S + GAP) + GAP
  const sheet =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#14110d"/>` +
    keys
      .map((id, i) => {
        const x = GAP + (i % COLS) * (S + GAP)
        const y = GAP + Math.floor(i / COLS) * (S + GAP)
        const inner = ART[id].draw().replace(/id="/g, `id="s${i}-`).replace(/url\(#/g, `url(#s${i}-`)
        return (
          `<rect x="${x}" y="${y}" width="${S}" height="${S}" rx="10" fill="${moods[id]}" opacity="0.2"/>` +
          `<svg x="${x}" y="${y}" width="${S}" height="${S}" viewBox="${VIEWBOX}">${inner}</svg>`
        )
      })
      .join('') +
    '</svg>'
  fs.writeFileSync(
    process.argv[sheetArg + 1],
    new Resvg(sheet, { fitTo: { mode: 'width', value: W } }).render().asPng(),
  )
  console.log(`\ncontact sheet written to ${process.argv[sheetArg + 1]}`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll earth-reviews checks passed.')
process.exitCode = failures ? 1 : 0

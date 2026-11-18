/**
 * check-constellation-trace — proves the memory round's scoring has the
 * properties it is supposed to have, against figures whose right answer is
 * known because they are the real figures themselves.
 *
 *   1. Every figure a round can draw resolves to real stars, all of them bright
 *      enough to see, and the tiers really do get bigger.
 *   2. A perfect drawing scores 100 however it was drawn: backwards, in any
 *      order, split into any number of strokes.
 *   3. Half the figure scores about two thirds; the whole figure plus as many
 *      wrong lines as right ones does too. Neither drawing too little nor
 *      joining everything pays.
 *   4. Nothing drawn, or a different constellation drawn perfectly, scores 0.
 *   5. Peeks cost what they say, and never take a score below zero.
 *
 *   node scripts/check-constellation-trace.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const T = await import('../src/lib/constellation-trace.ts')
const { starById, STARS } = await import('../src/lib/star-catalog.ts')
const { project, skyToScreen, angularSeparationDeg } = await import('../src/lib/sky-projection.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

console.log('every figure a round can draw is real, visible, and the tiers grow')
{
  let prevMax = 0
  for (const [i, tier] of T.TIERS.entries()) {
    const sizes = tier.map((id) => T.figureEdges(id).length)
    for (const [j, id] of tier.entries()) {
      const stars = T.figureStars(id).map(starById)
      check(sizes[j] >= 2 && stars.every(Boolean), `${T.figureName(id)} resolves to ${sizes[j]} lines between ${stars.length} real stars`)
      const faintest = Math.max(...stars.map((s) => s.mag))
      check(faintest <= 5.2, `${T.figureName(id)}'s faintest star is naked-eye (mag ${faintest.toFixed(2)})`)
      const v = T.figureView(id)
      check(v.halfW > 0 && v.halfH >= 0 && v.halfW < 1 && v.halfH < 1, `${T.figureName(id)} fits comfortably in one view`)
    }
    const min = Math.min(...sizes)
    check(min >= prevMax * 0.8, `tier ${i + 1} (${sizes.join(', ')} lines) is no easier than tier ${i}`)
    prevMax = Math.max(...sizes)
  }
  const r = T.pickRound(() => 0.999)
  check(r.length === T.TIERS.length && new Set(r).size === r.length, `a round is ${r.length} different figures, one per tier`)
}

console.log('\nclicking a figure\'s star picks that star, even a little off, at any size of sky')
{
  // Faint figure stars sit next to brighter ones and inside double stars; if a
  // click on one lands on a neighbour, that line can never be drawn. Aiming
  // exactly at the middle is not enough: a click arrives in whole pixels and
  // the canvas rarely starts on one, so on a phone a click aimed at 10 Tau
  // landed a pixel toward ξ Tau and took it. Every click within SLIP of the
  // star has to pick it.
  const SLIP = 2
  const ring = [[0, 0], ...Array.from({ length: 8 }, (_, a) => [SLIP * Math.cos(a * Math.PI / 4), SLIP * Math.sin(a * Math.PI / 4)])]
  for (const [W, H] of [[340, 380], [362, 519], [620, 480], [1280, 760]]) {
    const bad = []
    let total = 0
    for (const id of T.TIERS.flat()) {
      const v = T.fitView(id, W, H)
      for (const sid of T.figureStars(id)) {
        const s = starById(sid)
        const p = project(s.ra, s.dec, v.ra0, v.dec0)
        const [sx, sy] = skyToScreen(p.x, p.y, v)
        total++
        for (const [ox, oy] of ring) {
          const got = T.pickStar(sx + ox, sy + oy, v)
          if (got?.id !== sid) { bad.push(`${T.figureName(id)}: ${s.name || sid}→${got?.name || got?.id} at ${Math.hypot(ox, oy).toFixed(0)}px`); break }
        }
      }
    }
    check(!bad.length, `${W}×${H}: all ${total} figure stars pick themselves within ${SLIP}px${bad.length ? ' — ' + bad.join(', ') : ''}`)
  }
  // The head start line stars get must not make the rest unreachable. In the
  // free sky you can join any star: every naked-eye-bright one that no figure
  // uses is still picked when clicked dead on, zoomed all the way in. (At the
  // opening zoom θ¹ Tau and θ² Tau are a pixel apart and one of them has to
  // win; it is now the one Taurus is drawn through.) The only exceptions are
  // doubles a few arcseconds apart, which are one point at any zoom and never
  // could be picked apart.
  const SCALE_MAX = 6400
  const UNRESOLVED_ARCSEC = 30
  const off = STARS.filter((s) => s.mag < 4 && !T.isLineStar(s.id))
  const lost = []
  let doubles = 0
  for (const s of off) {
    const v = { ra0: s.ra, dec0: s.dec, scale: SCALE_MAX, W: 390, H: 600 }
    const got = T.pickStar(v.W / 2, v.H / 2, v)
    if (got?.id === s.id) continue
    if (got && angularSeparationDeg(s.ra, s.dec, got.ra, got.dec) * 3600 < UNRESOLVED_ARCSEC) doubles++
    else lost.push(`${s.name || s.id}→${got?.name || got?.id}`)
  }
  check(!lost.length, `all ${off.length - doubles} stars brighter than 4 that no figure uses are picked dead on, zoomed in (${doubles} unresolvable doubles aside)${lost.length ? ' — not: ' + lost.join(', ') : ''}`)
}

console.log('\na perfect drawing is 100 however it was drawn')
{
  for (const id of ['Cas', 'Leo', 'Sco']) {
    const real = T.figureEdges(id)
    check(T.traceScore(real, real).score === 100, `${T.figureName(id)}, as drawn in the figure: 100`)
    const backwards = [...real].reverse().map(([a, b]) => [b, a])
    check(T.traceScore(real, backwards).score === 100, `${T.figureName(id)}, every line backwards and in reverse order: 100`)
    // One stroke per line: the chains the page produces when you lift off after every pair.
    const chains = real.map(([a, b]) => [a, b])
    check(T.traceScore(real, T.chainsToEdges(chains)).score === 100, `${T.figureName(id)}, one stroke per line: 100`)
    const doubled = [...real, ...real]
    check(T.traceScore(real, doubled).score === 100, `${T.figureName(id)}, every line drawn twice: still 100, not a penalty`)
  }
}

console.log('\nneither too little nor too much pays')
{
  const real = T.figureEdges('Leo')
  const half = real.slice(0, Math.ceil(real.length / 2))
  const h = T.traceScore(real, half)
  check(h.precision === 1 && h.score >= 60 && h.score <= 72, `half of Leo scores about two thirds (${h.score})`)
  const stars = T.figureStars('Leo')
  const wrong = []
  const realKeys = new Set(real.map(([a, b]) => T.edgeKey(a, b)))
  for (let i = 0; i < stars.length && wrong.length < real.length; i++)
    for (let j = i + 1; j < stars.length && wrong.length < real.length; j++)
      if (!realKeys.has(T.edgeKey(stars[i], stars[j]))) wrong.push([stars[i], stars[j]])
  const padded = T.traceScore(real, [...real, ...wrong])
  check(padded.recall === 1 && padded.score >= 60 && padded.score <= 72, `all of Leo plus as many wrong lines scores about two thirds (${padded.score})`)
  const every = []
  for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) every.push([stars[i], stars[j]])
  const all = T.traceScore(real, every)
  check(all.recall === 1 && all.score <= 40 && all.score < h.score, `joining every one of Leo's stars to every other scores 40 at most, below drawing half of it honestly (${all.score})`)
  check(h.missed.length === real.length - half.length && padded.extra.length === wrong.length, 'the missed and extra lists count what they should')
}

console.log('\nnothing, or the wrong constellation, is 0')
{
  const real = T.figureEdges('Cyg')
  check(T.traceScore(real, []).score === 0, 'an empty drawing: 0')
  check(T.traceScore(real, T.figureEdges('Lyr')).score === 0, 'Lyra drawn perfectly, when Cygnus was asked for: 0')
}

console.log('\npeeks')
{
  check(T.withPeeks(80, 0) === 80 && T.withPeeks(80, 2) === 80 - 2 * T.PEEK_COST, `each peek costs ${T.PEEK_COST}`)
  check(T.withPeeks(15, 3) === 0, 'and never goes below zero')
  check(T.verdictFor(100).name && T.verdictFor(0).name && T.verdictFor(0) !== T.verdictFor(100), 'every score has a verdict, and the ends differ')
  check(T.memoMs(2) < T.memoMs(13), 'a bigger figure gets longer to memorise')
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exit(failures ? 1 : 0)

/**
 * check-memo-pencil — does From Memory's paper and pencil behave like paper
 * and pencil?
 *
 * The page's grain and the pencil's grain are the same relief (tooth.ts), and
 * how dark a line comes out is decided pixel by pixel against it (graphite()
 * in memo/graphite.ts). None of that is visible in source, and most ways of
 * getting it wrong still produce *a* picture — just a flat grey line, a
 * stipple, or a seam across the page. This checks:
 *
 *   1. the relief is spread evenly from hollow to peak, so that pressing to a
 *      depth touches that share of the paper, and it repeats without a seam;
 *   2. the grain is a size on the page, not on the screen: a phone and a
 *      desktop show the same number of bumps across the page;
 *   3. the pencil never marks without pressure, marks more the harder it
 *      presses and the higher the bump, never lays down solid black, and a
 *      light, quick line is broken by the grain while a heavy one is nearly
 *      solid;
 *   4. the blue-pencil mark goes in the emptiest corner, and keeps out of the
 *      top corners (where the tape is) unless the bottom ones are taken.
 *
 *   node scripts/check-memo-pencil.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { tooth, toothScale, TILE } = await import('../src/lib/memo/tooth.ts')
const { graphite } = await import('../src/lib/memo/graphite.ts')
const { emptiestCorner } = await import('../src/lib/memo/mark.ts')

let failures = 0
const check = (c, m) => { if (!c) failures++; if (!c || process.env.VERBOSE) console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`) }

console.log('\nthe paper')
for (const scale of [1, 2]) {
  const { size: S, h } = tooth(scale)
  check(S === TILE * scale, `the tile at ${scale}x is ${S} pixels across`)
  check(h.every((v) => v >= 0 && v <= 1 && Number.isFinite(v)), `every height is a number from 0 to 1 (${scale}x)`)
  const decile = new Array(10).fill(0)
  for (const v of h) decile[Math.min(9, Math.floor(v * 10))]++
  const worst = Math.max(...decile.map((n) => Math.abs(n / h.length - 0.1)))
  check(worst < 0.006, `heights are spread evenly, hollow to peak (worst tenth off by ${(worst * 100).toFixed(2)}%) (${scale}x)`)
  // Across the seam the paper changes no faster than anywhere else.
  let inner = 0, seam = 0, innerY = 0, seamY = 0
  for (let y = 0; y < S; y++) {
    seam += Math.abs(h[y * S + S - 1] - h[y * S])
    for (let x = 0; x < S - 1; x++) inner += Math.abs(h[y * S + x + 1] - h[y * S + x])
  }
  for (let x = 0; x < S; x++) {
    seamY += Math.abs(h[(S - 1) * S + x] - h[x])
    for (let y = 0; y < S - 1; y++) innerY += Math.abs(h[(y + 1) * S + x] - h[y * S + x])
  }
  const rx = (seam / S) / (inner / (S * (S - 1))), ry = (seamY / S) / (innerY / (S * (S - 1)))
  check(rx < 1.25 && ry < 1.25, `the tile repeats without a seam (seam steps ${rx.toFixed(2)}x and ${ry.toFixed(2)}x the usual) (${scale}x)`)
}
{
  // Bumps across the page: the page's width over the bump's width in pixels.
  const across = (w) => w / (TILE * toothScale(w) / 96)
  const phone = across(680), desk = across(1800)
  check(Math.abs(phone / desk - 1) < 0.2, `a phone and a desktop show about as many bumps across the page (${phone.toFixed(0)} and ${desk.toFixed(0)})`)
}

console.log('\nthe pencil')
{
  const ps = Array.from({ length: 51 }, (_, k) => k / 50)
  const ts = Array.from({ length: 101 }, (_, k) => k / 100)
  check(ts.every((t) => graphite(0, t) === 0), 'no pressure, no mark')
  let monoP = true, monoT = true, max = 0
  for (const t of ts) for (let k = 1; k < ps.length; k++) if (graphite(ps[k], t) < graphite(ps[k - 1], t) - 1e-9) monoP = false
  for (const p of ps) for (let k = 1; k < ts.length; k++) if (graphite(p, ts[k]) < graphite(p, ts[k - 1]) - 1e-9) monoT = false
  for (const p of ps) for (const t of ts) max = Math.max(max, graphite(p, t))
  check(monoP, 'pressing harder never lays down less')
  check(monoT, 'a higher bump never takes less than a lower one')
  check(max <= 0.95, `the paper always shows through a little: never solid black (most is ${max.toFixed(2)})`)

  // Over the real paper: how much of it a line covers, and how dark it is.
  const { h } = tooth(1)
  const at = (p) => {
    let covered = 0, dark = 0
    for (const t of h) { const a = graphite(p, t); if (a > 0.05) covered++; dark += a }
    return { covered: covered / h.length, dark: dark / h.length }
  }
  // The lightest a moving pencil presses (0.56), the heaviest (1), and the
  // fringe at the edge of the lead (0.42 of the lightest).
  const light = at(0.56), heavy = at(1), fringe = at(0.56 * 0.42)
  check(heavy.covered > 0.95, `a slow, heavy line is nearly solid (${(heavy.covered * 100).toFixed(0)}% of the paper)`)
  check(light.covered > 0.4 && light.covered < 0.85, `a quick, light line is broken by the grain but still a line (${(light.covered * 100).toFixed(0)}%)`)
  check(fringe.covered < 0.3, `the edge of the lead only catches the peaks (${(fringe.covered * 100).toFixed(0)}%)`)
  check(heavy.dark > light.dark * 1.8, `heavy is clearly darker than light (${heavy.dark.toFixed(2)} against ${light.dark.toFixed(2)})`)
}

console.log('\nthe mark')
{
  const fill = (x0, y0, x1, y1) => Array.from({ length: 200 }, (_, k) => ({ x: x0 + ((k * 37) % 100) / 100 * (x1 - x0), y: y0 + ((k * 61) % 100) / 100 * (y1 - y0) }))
  const blank = emptiestCorner([])
  check(blank.y > 70 && blank.x > 100, 'on a clear page it goes bottom right')
  const br = emptiestCorner(fill(120, 80, 200, 140))
  check(br.y > 70 && br.x < 100, 'with the bottom right drawn on, it goes bottom left')
  const bottoms = emptiestCorner(fill(0, 80, 200, 140))
  check(bottoms.y < 70, 'with both bottom corners drawn on, it goes to the top')
  const lightTop = emptiestCorner([...fill(0, 80, 200, 140).slice(0, 4), ...fill(120, 80, 200, 140).slice(0, 4)])
  check(lightTop.y > 70, 'a stray line or two at the bottom is not enough to send it up by the tape')
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall pencil checks passed\n')
process.exit(failures ? 1 : 0)

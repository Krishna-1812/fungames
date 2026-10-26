/**
 * check-island — holds the homepage's island to its promises.
 *
 *   1. Every listed game has exactly one building and one place on the map,
 *      and no building exists for a game that is not listed.
 *   2. No two footprints overlap. Land buildings stand mostly on land the
 *      districts already made (so no plaza floats alone in the sea); water
 *      buildings stand in the sea.
 *   3. Every building measured itself: a finite box of a sensible size.
 *   4. The roads reach every district.
 *   5. The canvas can draw it: few shapes from outlines, a hit mask for every
 *      building and thing to poke, a card for every game.
 *   6. The twelve messages in bottles are all there, apart, each with its
 *      number and its note; the signposts point down real roads to districts;
 *      the pigeons have a square, the ball a beach, every game a parade route.
 *   7. The markup is real SVG: resvg parses and rasterises the whole island.
 *
 *   node scripts/check-island.mjs            check
 *   node scripts/check-island.mjs --preview  also write public/_mockups/island-preview.html and .png
 */
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { listedGames } = await import('../src/data/games.ts')
const { LANDMARKS, PLACES, DISTRICTS } = await import('../src/lib/island/landmarks.ts')
const { buildIsland, GRID } = await import('../src/lib/island/world.ts')
const { Resvg } = await import('@resvg/resvg-js')
const { resvgRaster } = await import('../src/lib/island/raster.ts')
const { BOTTLE_COUNT, NOTES } = await import('../src/lib/bottles.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const games = listedGames()
const slugs = new Set(games.map((g) => g.slug))

console.log('registry')
for (const s of slugs) { if (!LANDMARKS[s]) fail(`${s} has no building`); if (!PLACES.some((p) => p[0] === s)) fail(`${s} has no place on the map`) }
for (const s of Object.keys(LANDMARKS)) if (!slugs.has(s)) fail(`building "${s}" is for a game that is not listed`)
check(PLACES.length === new Set(PLACES.map((p) => p[0])).size, `every place is a different game (${PLACES.length})`)
check(PLACES.every((p) => DISTRICTS.some((d) => d.key === p[1])), 'every place is in a real district')

console.log('footprints')
const cells = new Map()
for (const [slug, , i, j] of PLACES) {
  const [w, d] = LANDMARKS[slug]?.size ?? [0, 0]
  for (let a = Math.floor(i); a < Math.ceil(i + w); a++) for (let b = Math.floor(j); b < Math.ceil(j + d); b++) {
    const k = `${a},${b}`
    if (cells.has(k)) fail(`${slug} overlaps ${cells.get(k)} at ${k}`)
    cells.set(k, slug)
  }
}
ok(`${PLACES.length} footprints checked for overlap`)
// The districts' own land, before any building forces its cells to be land.
const baseLand = (i, j) => DISTRICTS.some((d) => {
  const wob = 0.55 * Math.sin(i * 1.27 + j * 0.71) + 0.4 * Math.cos(j * 1.93 - i * 0.43)
  return Math.hypot(i + 0.5 - d.at[0], j + 0.5 - d.at[1]) < d.r + wob
})
for (const [slug, , i, j] of PLACES) {
  const lm = LANDMARKS[slug]; if (!lm) continue
  const [w, d] = lm.size, own = []
  for (let a = Math.floor(i); a < Math.ceil(i + w); a++) for (let b = Math.floor(j); b < Math.ceil(j + d); b++) own.push([a, b])
  const onLand = own.filter(([a, b]) => a >= 0 && b >= 0 && a < GRID && b < GRID && baseLand(a, b)).length / own.length
  if (lm.water) check(onLand === 0, `${slug} floats: none of its ${own.length} cells were land`)
  else check(onLand >= 0.75, `${slug} stands on land (${Math.round(onLand * 100)}% of its cells were already island)`)
}

console.log('the drawing')
const island = buildIsland(games.map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: `/${g.slug}/` })), { raster: resvgRaster })
for (const g of games) {
  const a = island.anchors[g.slug]
  if (!a) { fail(`${g.slug} was never drawn`); continue }
  const w = a.x1 - a.x0, h = a.y1 - a.y0
  // (A district's set piece is drawn up to 1.5 times bigger on the cartoon island: world.ts, HERO.)
  if (!(Number.isFinite(w) && Number.isFinite(h) && w > 50 && h > 40 && w < 680 && h < 620)) fail(`${g.slug} measured itself oddly: ${Math.round(w)} × ${Math.round(h)}`)
}
ok(`${Object.keys(island.anchors).length} buildings measured`)
const links = (island.svg.match(/<a class="lm"/g) ?? []).length
check(links === games.length, `every building is a link (${links})`)
check(!/NaN|undefined|Infinity/.test(island.svg), 'no NaN, undefined or Infinity anywhere in the markup')
const roadPaths = (island.svg.match(/class="walker[ "]/g) ?? []).length
check(roadPaths >= 16, `people are walking the roads (${roadPaths})`)
console.log(`  size  ${(island.svg.length / 1024).toFixed(0)} KB of markup, ${island.lights.length} lights`)
// At night no window may glow through whatever stands in front of it; the
// island hides those, and most lights should still be seen.
check(island.hiddenLights > 0 && island.hiddenLights < island.lights.length * 0.4, `lights hidden behind something are left dark at night (${island.hiddenLights} of ${island.lights.length})`)
{
  // The moon and its path are over open water: nothing from the island's grid within a tile of the disc or
  // anywhere down its path, and no building's picture there (the path once crossed the Badlands at night).
  const { x, y, run } = island.moon, rows = island.grid.match(new RegExp(`.{${GRID}}`, 'g'))
  const land = (px, py) => { const u = (py - 12) / 32 + px / 64, v = (py - 12) / 32 - px / 64; for (let a = Math.floor(u - 1); a <= u + 1; a++) for (let b = Math.floor(v - 1); b <= v + 1; b++) if (rows[a]?.[b] && rows[a][b] !== '0') return true; return false }
  const onArt = (px, py) => Object.values(island.anchors).some((a) => px > a.x0 && px < a.x1 && py > a.y0 && py < a.y1)
  let bad = 0
  for (let dx = -30; dx <= 30; dx += 10) for (let dy = -30; dy <= 40 + run; dy += 6) if (land(x + dx * (dy > 30 ? 0.3 : 1), y + dy) || onArt(x + dx * (dy > 30 ? 0.3 : 1), y + dy)) bad++
  check(!bad, `the moon and its path lie over open sea (${Math.round(x)}, ${Math.round(y)}, a path ${run} long)`)
}
// The page no longer ships this markup (the canvas draws the bake of it), so
// this is not a download limit: it is what the bake has to read and paint, and
// how long a build takes when the island changes.
check(island.svg.length < 1600 * 1024, 'the island is under 1600 KB of markup')

console.log('bottles and signposts')
{
  const ns = island.bottles.map((b) => b.n).sort((a, b) => a - b)
  check(ns.length === BOTTLE_COUNT && ns.every((n, k) => n === k + 1), `every bottle is washed up somewhere (${ns.length} of ${BOTTLE_COUNT}, numbered 1 to ${BOTTLE_COUNT})`)
  check(ns.every((n) => NOTES[n]?.text && NOTES[n]?.from), 'and every one has a note in it, and who it is from')
  check(ns.every((n) => (island.svg.match(new RegExp(`data-n="${n}"`, 'g')) ?? []).length === 1), 'each is drawn once, with its number on it')
  // On the island's own beaches, and not in a heap: a hunt round the whole coast.
  const ashore = island.bottles.filter((b) => b.n !== BOTTLE_COUNT)
  let near = Infinity
  for (const a of ashore) for (const b of ashore) if (a !== b) near = Math.min(near, Math.hypot(a.i - b.i, a.j - b.j))
  check(near >= 3, `no two bottles on the beaches lie within three tiles of each other (nearest ${near.toFixed(1)})`)
  check(new Set(ashore.map((b) => b.district)).size >= 5, `they are spread round the shores of most districts (${new Set(ashore.map((b) => b.district)).size})`)
  const posts = island.signposts
  check(posts.length >= 4, `there are signposts at the crossroads (${posts.length})`)
  check(posts.every((p) => p.boards.length >= 2 && p.boards.length <= 3), 'each has two or three boards')
  check(posts.every((p) => new Set(p.boards.map((b) => `${b.dx},${b.dy}`)).size === p.boards.length && new Set(p.boards.map((b) => b.to)).size === p.boards.length), 'no two boards on a post point the same way, or to the same place')
  check(posts.every((p) => p.boards.every((b) => Math.abs(b.dx) + Math.abs(b.dy) === 1 && Number.isFinite(b.steps) && b.steps > 0)), 'every board points along a road to somewhere that road reaches')
  const to = new Set(posts.flatMap((p) => p.boards.map((b) => b.to)))
  check(to.size >= 5, `and between them they point the way to most districts (${[...to].join(', ')})`)
  const { play: pl, grid } = island
  const g = (i, j) => (i < 0 || j < 0 || i >= GRID || j >= GRID ? '0' : grid[i * GRID + j])
  check(grid.length === GRID * GRID && /^[01b]+$/.test(grid), 'the page gets the island’s ground, a letter a tile')
  check(g(...pl.square) === '1' && g(...pl.board) === '1' && Math.abs(pl.square[0] - pl.board[0]) + Math.abs(pl.square[1] - pl.board[1]) === 1, 'the pigeons’ square and the noticeboard stand side by side, on land')
  check(pl.ball.cells.length >= 4 && pl.ball.cells.every(([i, j]) => g(i, j) === 'b'), `the ball has a stretch of beach to roll on (${pl.ball.cells.length} tiles)`)
  const routes = Object.entries(pl.routes)
  check(games.every((x) => pl.routes[x.slug]?.length), 'the parade has a way to every game')
  const start = routes[0]?.[1][0]?.join()
  check(routes.every(([, r]) => r[0].join() === start && r.every((c, k) => !k || Math.abs(c[0] - r[k - 1][0]) + Math.abs(c[1] - r[k - 1][1]) === 1)), 'every route sets off from the same square and goes a tile at a time')
  check(island.svg.includes('data-poke="notice"'), 'the noticeboard is something to poke')
}

// What it costs to keep the map moving, now that a canvas draws it from the
// bake (lib/island/bake). Each of these was a measured loss in headless
// Chrome, and none of them shows in a screenshot, so they are checked here.
console.log('what the canvas has to draw')
{
  const { build } = await import('../src/lib/island/bake/build.ts')
  const { SKIP_LAYERS } = await import('../src/lib/island/bake/index.ts')
  const b = build({ ...island, layers: island.layers.filter((l) => !SKIP_LAYERS.has(l.kind)) })
  const count = { g: 0, run: 0, spr: 0, v: 0, txt: 0, sea: 0 }
  const lms = new Set(), pokes = new Set()
  const walk = (n) => { count[n.k]++; if (n.lm) lms.add(n.lm); if (n.poke) pokes.add(n.poke); if (n.k === 'g') n.kids.forEach(walk) }
  b.root.forEach(walk)
  check(!b.warnings.length, `the bake understands every part of the drawing${b.warnings.length ? ` (${b.warnings.join('; ')})` : ''}`)
  // Shapes drawn again from their outlines every frame: fifteen hundred of
  // them held the map to twelve frames a second; as sprites, sixty.
  check(count.v <= 320, `few shapes are drawn from their outlines every frame (${count.v}; ${count.spr} sprites, ${count.run} runs of still painting, ${count.txt} lines of lettering)`)
  check(games.every((g) => lms.has(g.slug)), 'every building is something the canvas can pick out')
  const masked = new Set(b.masks.map((m) => m.key))
  check(games.every((g) => masked.has(`lm:${g.slug}`)), 'and every building has a hit mask, so a click lands on its art')
  check(b.pokes.length === pokes.size && b.masks.filter((m) => m.key.startsWith('pk:')).length >= pokes.size, `every thing to poke has one too (${pokes.size} kinds)`)
  check(games.every((g) => b.cards[g.slug]), 'every game has its building for its card')
  // The page tells the bottles apart by their numbers, and hides the ones found.
  const nums = []
  const look = (n) => { if (n.k !== 'g') return; if (n.poke === 'bottle') nums.push(n.data?.mask ? Number(n.data?.n) : NaN); n.kids.forEach(look) }
  b.root.forEach(look)
  check(nums.length === BOTTLE_COUNT && new Set(nums).size === BOTTLE_COUNT && nums.every((n) => n >= 1 && n <= BOTTLE_COUNT), `every bottle reaches the canvas with its number and a hit mask (${nums.length})`)
}

console.log('rasterise')
const [vx, vy, vw, vh] = island.viewBox
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${Math.round(vw)}" height="${Math.round(vh)}">${island.svg}</svg>`
let png
try { png = new Resvg(svg, { fitTo: { mode: 'width', value: 2400 }, font: { loadSystemFonts: false } }).render().asPng(); ok(`resvg renders it (${(png.length / 1024).toFixed(0)} KB png)`) }
catch (e) { fail(`resvg could not render the island: ${e.message}`) }

if (process.argv.includes('--preview') && png) {
  fs.mkdirSync('public/_mockups', { recursive: true })
  fs.writeFileSync('public/_mockups/island-preview.png', png)
  fs.writeFileSync('public/_mockups/island-preview.html', `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Silkscreen&display=swap"><style>html,body{margin:0;background:#8ccbff}svg{width:100vw;height:100vh;display:block}</style>${svg}`)
  console.log('  wrote public/_mockups/island-preview.{html,png}')
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0

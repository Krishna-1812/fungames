/**
 * check-sound — the island's soundscape keeps its promises.
 *
 * Sound is easy to break without noticing: nobody runs the checks with the
 * speakers on. What can be checked without ears is checked here.
 *
 *   - **No audio files.** Every sound on the site is made live (lib/audio.ts);
 *     a stray .mp3 in public/ would quietly end that.
 *   - **The surf is heard from the real coastline.** A beach filling the view is
 *     loud, the middle of the island is quiet, and a coast off to one side is
 *     heard from that side.
 *   - **The surf breaks when the drawn waves do.** The sound's timing is read
 *     from the same loops the picture uses (moves.ts), so it is the keyframe's
 *     brightest moment that is checked: change one and this says so.
 *   - **Each game has its own note** for the circle between the island and the
 *     game, worked out the same way on both sides of the page change.
 *
 *   node scripts/check-sound.mjs
 */
import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { register } = await import('node:module')
register('./resolve-ts.mjs', import.meta.url)
const { listedGames } = await import('../src/data/games.ts')
const { buildIsland, GRID } = await import('../src/lib/island/world.ts')
const { resvgRaster } = await import('../src/lib/island/raster.ts')
const { LAYERS } = await import('../src/lib/island/moves.ts')
const moves = await import('../src/lib/island/moves.ts')
const { coastline, shoreOf, BREAKS } = await import('../src/lib/island/sound.ts')
const { portalNote, scaleFreq } = await import('../src/lib/audio.ts')

let n = 0
const ok = (m) => { n++; if (process.env.VERBOSE) console.log('ok', m) }

/* ---- not one audio file --------------------------------------------------- */
const root = fileURLToPath(new URL('..', import.meta.url))
const AUDIO = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba|mid|midi)$/i
const found = []
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (AUDIO.test(f)) found.push(p.slice(root.length))
  }
}
for (const d of ['public', 'src']) walk(join(root, d))
assert.deepEqual(found, [], 'audio files in the site: every sound is meant to be made live')
ok('no audio files')

/* ---- the coastline ------------------------------------------------------------ */
const games = listedGames()
const island = buildIsland(games.map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: `/${g.slug}/` })), { raster: resvgRaster })
const coast = coastline(island.grid, GRID).map(([x, y]) => ({ x, y }))
assert.ok(coast.length > 60, `a coastline of ${coast.length} points is too short`)
const [lx0, ly0, lx1, ly1] = island.land
for (const c of coast) assert.ok(c.x >= lx0 - 120 && c.x <= lx1 + 120 && c.y >= ly0 - 80 && c.y <= ly1 + 100, `surf point ${c.x},${c.y} is nowhere near the island`)
// Out in the sea, every one: no surf breaking on dry land.
for (const c of coast) {
  const u = c.x / 32, v = (c.y - 12) / 16, i = Math.floor((u + v) / 2), j = Math.floor((v - u) / 2)
  assert.ok(i < 0 || j < 0 || i >= GRID || j >= GRID || island.grid[i * GRID + j] === '0', `surf point ${c.x},${c.y} is on land (tile ${i},${j})`)
}
ok(`${coast.length} surf points, all round the island and all at sea`)

/* ---- heard from the coast --------------------------------------------------- */
// A close view, as the island is usually played: about 580 by 370 map units.
const view = (x, y, w = 580) => ({ x, y, w, h: w * 0.632 })
// The island's western tip: the land tile furthest west.
let west = null
for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (island.grid[i * GRID + j] !== '0' && (!west || (i - j) * 32 < west.x)) west = { x: (i - j) * 32, y: (i + j) * 16 + 16 }
// The point on the island furthest from any coast, by the same ground distance the sound uses.
let inland = null, far = 0
for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
  if (island.grid[i * GRID + j] === '0') continue
  const x = (i - j) * 32, y = (i + j) * 16
  const d = Math.min(...coast.map((c) => Math.hypot(c.x - x, (c.y - y) * 2)))
  if (d > far) { far = d; inland = { x, y } }
}
const beach = shoreOf(coast, view(west.x, west.y)), middle = shoreOf(coast, view(inland.x, inland.y))
assert.ok(beach.near > 0.6, `on the west beach the surf is only ${beach.near.toFixed(2)}`)
assert.ok(middle.near < 0.15, `in the middle of the island (${far.toFixed(0)} from the sea) the surf is ${middle.near.toFixed(2)}`)
assert.ok(beach.near > middle.near * 4, 'the beach is not much louder than the middle of the island')
ok(`surf: ${beach.near.toFixed(2)} on the beach, ${middle.near.toFixed(2)} inland`)
// Heard from its side: everywhere on the island within earshot of the sea,
// where the nearest surf is clearly to the left or the right (a shore, a
// harbour's inlet), the surf is heard from that side.
let sided = 0, right = 0
for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
  if (island.grid[i * GRID + j] === '0') continue
  const x = (i - j) * 32, y = (i + j) * 16 + 16, s = shoreOf(coast, view(x, y))
  const c = coast.reduce((a, b) => (Math.hypot(b.x - x, (b.y - y) * 2) < Math.hypot(a.x - x, (a.y - y) * 2) ? b : a))
  if (s.near < 0.25 || Math.abs(c.x - x) < 0.7 * Math.hypot(c.x - x, (c.y - y) * 2)) continue
  sided++
  if (Math.sign(s.pan) === Math.sign(c.x - x) && Math.abs(s.pan) > 0.15) right++
}
assert.ok(sided > 40 && right / sided > 0.8, `the surf is heard from the side of the nearest sea at only ${right} of ${sided} places`)
ok(`heard from the side of the nearest sea at ${right} of ${sided} places`)
// Out at sea off the western tip, the island's surf is all to the right.
assert.ok(shoreOf(coast, view(west.x - 200, west.y)).pan > 0.4, 'out at sea to the west, the surf is not heard from the island')
ok('out at sea, heard from the island')
// Far out, the whole coast is in earshot: the swell is all round.
assert.ok(shoreOf(coast, view(0, 450, 2400)).wide > 0.9, 'zoomed out, the sea is not heard all round')
ok('zoomed out, the sea all round')

/* ---- in time with the drawn waves ------------------------------------------- */
const css = Object.values(moves).filter((v) => typeof v === 'string').join('\n')
const kf = css.match(/@keyframes isl-surf\s*\{([^}]*\}[^}]*\}[^}]*\}[^}]*\})/)
assert.ok(kf, 'the isl-surf keyframes are not where they were (moves.ts)')
const stops = [...kf[1].matchAll(/([\d.,\s%]+)\{\s*opacity:\s*([\d.]+)/g)].flatMap(([, at, o]) => at.split(',').map((a) => [parseFloat(a) / 100, Number(o)]))
const brightest = stops.reduce((a, b) => (b[1] > a[1] ? b : a))
assert.equal(BREAKS[0], brightest[0], `the surf sound breaks at ${BREAKS[0]} of the roll, the drawn wave at ${brightest[0]}`)
assert.equal(LAYERS.surfOut.loop.kf, 'isl-surf'); assert.equal(LAYERS.surfIn.loop.kf, 'isl-surf')
assert.ok(BREAKS[1] > BREAKS[0] && BREAKS[1] < 1, 'the inner wave breaks after the outer one, within the roll')
ok(`breaks at ${BREAKS.map((b) => b.toFixed(3)).join(' and ')} of a ${LAYERS.surfOut.loop.dur} s roll`)

/* ---- a note for every game ------------------------------------------------------ */
const notes = games.map((g) => portalNote(`/${g.slug}/`))
const scale = new Set(Array.from({ length: 10 }, (_, k) => scaleFreq(k, 330)))
for (const [k, g] of games.entries()) {
  assert.ok(scale.has(notes[k]), `${g.slug}: its note ${notes[k]} is off the scale`)
  assert.equal(portalNote(`/${g.slug}`), notes[k], `${g.slug}: the note changes without the trailing slash`)
}
assert.ok(new Set(notes).size >= 6, `only ${new Set(notes).size} different notes across ${games.length} games`)
ok(`${new Set(notes).size} notes across ${games.length} games`)

console.log(`Sound: ${n} checks passed (${coast.length} surf points; surf ${beach.near.toFixed(2)} on the beach, ${middle.near.toFixed(2)} inland).`)

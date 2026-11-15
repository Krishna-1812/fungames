/**
 * check-time-earth — is what Deep Time says beside its globe true to the
 * globe, and to itself?
 *
 * The globe is drawn by a shader this cannot run. What it can check is
 * everything round it that goes wrong silently:
 *
 *   1. The events: in order, each with a note, none twice.
 *   2. Places. A mark on the globe is only in the right place for as long as
 *      the coastline is the real one, so only recent events may have one —
 *      and each must be on land, on the map the globe actually reads. A
 *      latitude and longitude the wrong way round puts Giza in the Indian
 *      Ocean, and nothing else would notice.
 *   3. The map itself: there, the size the shader expects, small enough to
 *      send, published, and about the right amount of it land.
 *   4. The three gauges: the day lengthens, oxygen arrives when the page says
 *      it does, the Sun brightens, and all three end at today's values.
 *   5. The shader and the page agree on what is handed across.
 *
 *   node scripts/check-time-earth.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
import sharp from 'sharp'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { EVENTS } = await import('../src/lib/time-events.ts')
const { EARTH_FRAG, dayHours, oxygenPct, sunPct } = await import('../src/lib/time-earth.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const list = (a) => (a.length ? ' — ' + a.join(', ') : '')

/* ---- 1: the events ------------------------------------------------------ */
console.log('\nevents')
const unordered = EVENTS.filter((e, i) => i > 0 && e.at >= EVENTS[i - 1].at).map((e) => e.title)
check(!unordered.length, `oldest first, no two at once${list(unordered)}`)
const titles = new Set(EVENTS.map((e) => e.title))
check(titles.size === EVENTS.length, 'no title twice')
const bare = EVENTS.filter((e) => !e.note || e.note.length < 8).map((e) => e.title)
check(!bare.length, `every event says something${list(bare)}`)
const long = EVENTS.filter((e) => e.note && e.note.length > 80).map((e) => e.title)
check(!long.length, `no note longer than a card in a narrow lane can hold${list(long)}`)
check(EVENTS[0].at === 4_540_000_000 && EVENTS[EVENTS.length - 1].at === 0, 'from the Earth forming to today')

/* ---- 2, 3: places, and the map they are on ------------------------------ */
console.log('\nthe map')
const file = path.join(root, 'public', 'deep-time', 'land.webp')
if (!fs.existsSync(file)) {
  fail('public/deep-time/land.webp is missing — run node scripts/make-time-earth.mjs')
} else {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true })
  check(info.width === 1024 && info.height === 512, `is ${info.width}x${info.height}`)
  const kb = fs.statSync(file).size / 1024
  check(kb < 40, `is ${kb.toFixed(0)} kB (limit 40)`)
  // Each row of an equirectangular map is a ring round the globe, shorter towards the poles.
  let land = 0, all = 0
  for (let y = 0; y < info.height; y++) {
    const w = Math.cos(((y + 0.5) / info.height - 0.5) * Math.PI)
    for (let x = 0; x < info.width; x++) { all += w; if (data[y * info.width + x] > 127) land += w }
  }
  const pct = (land / all) * 100
  check(pct > 26 && pct < 32, `${pct.toFixed(1)}% of it is land (the Earth: 29)`)
  const allow = fs.readFileSync(path.join(root, 'scripts', 'check-public-boundary.mjs'), 'utf8')
  check(allow.includes(`'deep-time'`), 'its folder is one the build will publish')

  console.log('\nplaces')
  /** How far inland, in the field's own units: 127.5 is the coast. */
  const at = (lon, lat) => data[Math.min(info.height - 1, Math.floor((0.5 - lat / 180) * info.height)) * info.width + ((Math.floor((lon / 360 + 0.5) * info.width) % info.width) + info.width) % info.width]
  const early = EVENTS.filter((e) => e.where && e.at > 7_000_000).map((e) => e.title)
  check(!early.length, `nothing is marked on a coastline older than the real one${list(early)}`)
  const half = EVENTS.filter((e) => !!e.where !== !!e.place).map((e) => e.title)
  check(!half.length, `a place has a name and a name has a place${list(half)}`)
  const placed = EVENTS.filter((e) => Array.isArray(e.where))
  const off = placed.filter((e) => Math.abs(e.where[0]) > 180 || Math.abs(e.where[1]) > 90).map((e) => e.title)
  check(!off.length, `every place is a longitude and then a latitude${list(off)}`)
  // A crossing of the sea is at sea: allow a place within two degrees of a coast.
  const wet = placed.filter((e) => at(e.where[0], e.where[1]) < 127.5 - (2 / (64 * 360 / 2048)) * 127.5).map((e) => `${e.title} (${e.place})`)
  check(!wet.length, `all ${placed.length} are on land${list(wet)}`)
  check(EVENTS.filter((e) => e.where === 'moon').length === 1, 'exactly one thing happened on the Moon')
}

/* ---- 4: the gauges ------------------------------------------------------ */
console.log('\ngauges')
const span = Array.from({ length: 455 }, (_, i) => i * 1e7)
check(span.every((y, i) => i === 0 || dayHours(y) <= dayHours(span[i - 1]) + 1e-9), 'the day has only ever lengthened')
check(dayHours(0) === 24 && dayHours(4.54e9) >= 4 && dayHours(4.54e9) <= 7, `24 hours now, ${dayHours(4.54e9)} at the start`)
check(Math.abs(dayHours(400e6) - 21.9) < 0.2, 'about 21.9 hours in the Devonian, which the corals recorded')
check(oxygenPct(0) === 21, 'oxygen is 21% today')
check(oxygenPct(2.6e9) === 0 && oxygenPct(2.3e9) > 0, 'and arrives with the Great Oxidation, not before')
const peak = span.reduce((a, y) => (oxygenPct(y) > oxygenPct(a) ? y : a), 0)
check(peak > 280e6 && peak < 320e6, `and peaks in the Carboniferous (${peak / 1e6} Ma)`)
check(Math.abs(sunPct(0) - 100) < 1e-9 && sunPct(4.54e9) > 70 && sunPct(4.54e9) < 73, `the Sun: ${sunPct(4.54e9).toFixed(0)}% then, 100% now`)
check(span.every((y, i) => i === 0 || sunPct(y) < sunPct(span[i - 1])), 'and brighter every year between')

/* ---- 5: the handover ---------------------------------------------------- */
console.log('\nshader and page')
const page = fs.readFileSync(path.join(root, 'src', 'pages', 'deep-time.astro'), 'utf8')
const declared = [...EARTH_FRAG.matchAll(/uniform\s+\w+\s+(u_\w+)/g)].map((m) => m[1]).filter((u) => !['u_time', 'u_res', 'u_pointer', 'u_dpr'].includes(u))
const unset = declared.filter((u) => !new RegExp(`\\b${u}\\b`).test(page))
check(declared.length >= 7 && !unset.length, `the page sets all ${declared.length} of the shader's uniforms${list(unset)}`)
const stray = [...page.matchAll(/\b(u_\w+):/g)].map((m) => m[1]).filter((u) => !declared.includes(u))
check(!stray.length, `and none the shader does not have${list(stray)}`)
check(/w >= 860/.test(page) && /max-width: 859px/.test(page), 'script and stylesheet change layout at the same width')
check(/yearsPerPx: 250_000/.test(page) && EARTH_FRAG.includes('u_years'), 'the globe is driven by years, not by pixels')

console.log(failures ? `\n${failures} failed` : '\nall passed')
process.exit(failures ? 1 : 0)

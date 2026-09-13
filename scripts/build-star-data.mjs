/**
 * Generates src/data/star-catalog.ts and src/data/constellation-lines.ts —
 * the real star field and the real constellation figures Constellation Draw
 * needs — from real public sources, once, at author time.
 *
 *   node scripts/build-star-data.mjs
 *
 * Same reasoning as build-world-data.mjs and build-population-geo.mjs:
 * committing the generated file keeps the page dependency-free and
 * offline-capable, rather than fetching a 13MB catalogue from the browser.
 *
 * Sources:
 *   stars               HYG v4.4 (Hipparcos-Yale-Gliese combined catalogue),
 *                       astronexus/hyg on Codeberg, CC BY-SA 4.0. 119,614
 *                       stars; kept here down to magnitude 6.5 — the real,
 *                       commonly-cited naked-eye limit under a dark sky,
 *                       which is ~8,900 of them, not a round number chosen
 *                       for convenience.
 *   constellation lines constellations.lines.json, d3-celestial (Olaf Frohn,
 *                       BSD-3-Clause), itself derived from Stellarium's
 *                       western sky culture — the de facto standard line
 *                       figures every planetarium app draws, since the IAU
 *                       only standardises constellation *boundaries*, not
 *                       the artistic lines connecting stars within them.
 *   constellation names constellations.json, same repo/license — real Latin
 *                       names, genitive forms and English translations.
 */
import { writeFileSync } from 'fs'
import { gunzipSync } from 'zlib'

const MAG_LIMIT = 6.5

/** Handles the handful of quoted fields (names with commas) HYG's CSV has. */
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { q = !q; continue }
    if (c === ',' && !q) { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out
}

/* ---- stars ---------------------------------------------------------------- */

console.log('fetching HYG v4.4...')
const hygBuf = Buffer.from(
  await (await fetch('https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz')).arrayBuffer(),
)
const hygCsv = gunzipSync(hygBuf).toString('utf8')
const hygLines = hygCsv.split('\n').filter(Boolean)
const header = parseCsvLine(hygLines[0]).map((h) => h.replace(/"/g, ''))
const col = Object.fromEntries(header.map((h, i) => [h, i]))

const stars = []
for (let i = 1; i < hygLines.length; i++) {
  const f = parseCsvLine(hygLines[i])
  const id = Number(f[col.id])
  if (id === 0) continue // HYG's id 0 is the Sun, a placeholder with no fixed sky position
  const mag = parseFloat(f[col.mag])
  if (!Number.isFinite(mag) || mag > MAG_LIMIT) continue
  const ra = parseFloat(f[col.ra]) * 15 // HYG stores RA in decimal hours; degrees (0-360) from here on
  const dec = parseFloat(f[col.dec])
  const ci = f[col.ci] !== '' ? parseFloat(f[col.ci]) : null
  const proper = f[col.proper].replace(/"/g, '')
  const bayer = f[col.bayer].replace(/"/g, '')
  const flam = f[col.flam].replace(/"/g, '')
  const con = f[col.con].replace(/"/g, '')
  stars.push({ id, ra, dec, mag, ci, proper, bayer, flam, con })
}
stars.sort((a, b) => a.mag - b.mag)
console.log(`  kept ${stars.length} stars at mag <= ${MAG_LIMIT}`)

/* ---- constellation lines ---------------------------------------------------- */

console.log('fetching constellation line figures...')
const linesGeo = await (
  await fetch('https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json')
).json()

/** d3-celestial's RA is in degrees, wrapped to [-180, 180]; normalise to [0, 360)
 *  to match the star catalogue above. */
const norm360 = (deg) => ((deg % 360) + 360) % 360

// Serpens is the one real exception among the 88 IAU constellations: it is a
// single constellation drawn as two disconnected pieces either side of
// Ophiuchus (Serpens Caput, the head, and Serpens Cauda, the tail), and
// d3-celestial's source data — correctly — gives both pieces the same "Ser"
// id rather than inventing two constellations. Merging them back into one
// entry keeps "88 constellations" a real, checkable fact rather than 89.
const linesById = new Map()
for (const f of linesGeo.features) {
  const segments = f.geometry.coordinates.map((line) => line.map(([ra, dec]) => [Number(norm360(ra).toFixed(4)), dec]))
  if (linesById.has(f.id)) linesById.get(f.id).push(...segments)
  else linesById.set(f.id, segments)
}
const constellationLines = Array.from(linesById, ([id, segments]) => ({ id, segments }))

/* ---- constellation names ----------------------------------------------------- */

console.log('fetching constellation names...')
const namesGeo = await (
  await fetch('https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json')
).json()

// The source data uses assorted Unicode space-separator characters (found:
// U+2005, four-per-em space) inside some English names, e.g. "Bird of
// Paradise" — real typography choices from the app this was built for, not
// meaningful content. Normalising to a plain space changes no fact.
const cleanSpaces = (s) => s.replace(/[  -  　]/g, ' ')

// Same Serpens exception as above: collapse "Serpens Caput"/"Serpens Cauda"
// (two rows, one real constellation) into the one real umbrella name.
const namesById = new Map()
for (const f of namesGeo.features) {
  if (namesById.has(f.id)) continue
  const name = f.id === 'Ser' ? 'Serpens' : f.properties.name
  namesById.set(f.id, {
    id: f.id, name: cleanSpaces(name), genitive: cleanSpaces(f.properties.gen), english: cleanSpaces(f.properties.en),
  })
}
const constellationNames = Array.from(namesById.values())

console.log(`  ${constellationLines.length} line figures, ${constellationNames.length} named`)

/* ---- write ------------------------------------------------------------------ */

// A tuple per star rather than an object: the same nine fields repeated
// 8,920 times as JSON object keys cost about 400KB for nothing. starAt()
// below is the one place that knows the column order.
const starTuples = stars.map((s) => [s.id, s.ra, s.dec, s.mag, s.ci, s.proper, s.bayer, s.flam, s.con])

const starsFile = `/**
 * The real night sky, down to magnitude ${MAG_LIMIT} — the commonly-cited
 * naked-eye limit under a dark sky. ${stars.length} real stars, generated by
 * scripts/build-star-data.mjs from HYG v4.4 (astronexus/hyg, CC BY-SA 4.0).
 * Do not hand-edit; re-run the script instead.
 *
 * Each row is a tuple, not an object — the field names below would otherwise
 * be repeated ${stars.length} times over in the committed file for nothing.
 * Use starAt() (lib/star-catalog.ts) rather than indexing a row by hand.
 *
 * [id, ra, dec, mag, ci, proper, bayer, flam, con]
 *
 * ra/dec: real J2000 equatorial coordinates, in degrees.
 * mag: real apparent visual magnitude (lower is brighter).
 * ci: real B-V colour index, or null where unknown — see lib/star-color.ts
 *     for how this becomes an actual RGB colour, the same real formula
 *     astronomers use.
 * proper: real proper name, e.g. "Sirius" — most stars have none ("").
 * bayer: Bayer designation, e.g. "Alp" for Alpha — raw, unparsed. flam is
 *     the Flamsteed number, also raw.
 * con: the real IAU three-letter constellation abbreviation this star sits in.
 */
export type StarTuple = [
  id: number, ra: number, dec: number, mag: number, ci: number | null,
  proper: string, bayer: string, flam: string, con: string,
]

export const STAR_TUPLES: StarTuple[] = ${JSON.stringify(starTuples)}
`
writeFileSync('src/data/star-catalog.ts', starsFile)

const linesFile = `/**
 * The real western constellation line figures — which stars a planetarium
 * draws a line between — for all 88 IAU-recognised constellations.
 * Generated by scripts/build-star-data.mjs from d3-celestial's
 * constellations.lines.json and constellations.json (Olaf Frohn,
 * BSD-3-Clause), itself derived from Stellarium's western sky culture.
 *
 * The IAU standardises each constellation's *boundary*, not the artistic
 * lines joining stars within it — those are convention, and this is the
 * convention every planetarium app in practice draws. Do not hand-edit;
 * re-run the script instead.
 */
export interface ConstellationLines {
  /** Real IAU three-letter abbreviation, e.g. "Ori" for Orion. */
  id: string
  /** One or more open polylines, each a real path of [ra, dec] degree pairs. */
  segments: [number, number][][]
}
export interface ConstellationName {
  id: string
  /** Real Latin name, e.g. "Orion". */
  name: string
  /** Real Latin genitive (possessive) form, used in star names like "Alpha Orionis". */
  genitive: string
  /** Real published English translation, e.g. "The Hunter". */
  english: string
}

export const CONSTELLATION_LINES: ConstellationLines[] = ${JSON.stringify(constellationLines)}
export const CONSTELLATION_NAMES: ConstellationName[] = ${JSON.stringify(constellationNames)}
`
writeFileSync('src/data/constellation-lines.ts', linesFile)

console.log('wrote src/data/star-catalog.ts and src/data/constellation-lines.ts')

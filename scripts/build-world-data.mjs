/**
 * Generates src/data/world.ts — the coastline and the city table the asteroid
 * game needs — from real public sources, once, at author time.
 *
 *   node scripts/build-world-data.mjs
 *
 * Committing the generated file rather than fetching at runtime keeps the page
 * dependency-free and offline-capable, which is the same reason sitemap.xml and
 * the OG images are generated at build time rather than served dynamically.
 *
 * Sources:
 *   coastline  world-atlas land-110m (Natural Earth, public domain)
 *   cities     GeoNames via OpenDataSoft (CC BY 4.0)
 */
import { writeFileSync } from 'fs'

const CITY_COUNT = 6000
const MAP_W = 2000 // SVG user units for the full 360° of longitude
const MAP_H = 1000

/* -------------------------------------------------------------------------- */
/* Coastline                                                                  */
/* -------------------------------------------------------------------------- */

/** TopoJSON stores arcs delta-encoded in a quantised integer grid. */
function decodeArcs(topo) {
  const [sx, sy] = topo.transform.scale
  const [tx, ty] = topo.transform.translate
  return topo.arcs.map((arc) => {
    let x = 0
    let y = 0
    return arc.map(([dx, dy]) => {
      x += dx
      y += dy
      return [x * sx + tx, y * sy + ty]
    })
  })
}

/** Equirectangular. The whole game's geography is lon/lat, so anything fancier
 *  would mean projecting the damage rings too, for no gain at this scale. */
const project = ([lon, lat]) => [
  ((lon + 180) / 360) * MAP_W,
  ((90 - lat) / 180) * MAP_H,
]

/** Stitch a ring's arc references back into one closed loop of lon/lat points. */
function ringPoints(ring, arcs) {
  const pts = []
  for (const idx of ring) {
    const arc = idx >= 0 ? arcs[idx] : [...arcs[~idx]].reverse()
    // Consecutive arcs share an endpoint; dropping it avoids a duplicate vertex.
    for (const p of pts.length ? arc.slice(1) : arc) pts.push(p)
  }
  return pts
}

/**
 * Project a ring to SVG, breaking it wherever it crosses the antimeridian.
 *
 * Chukotka, Fiji and Antarctica all straddle ±180°, and in an equirectangular
 * projection a segment from +179.9° to −179.9° is a hair's width of real
 * coastline that draws as a line straight across the entire map. Any step wider
 * than half the world is that, not geography, so the path restarts there.
 */
function pointsToPath(pts) {
  const projected = pts.map(project)
  let d = ''
  let prevX = null
  for (const [x, y] of projected) {
    const wrapped = prevX !== null && Math.abs(x - prevX) > MAP_W / 2
    d += `${d === '' || wrapped ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    prevX = x
  }
  return d + 'Z'
}

async function buildCoastline() {
  const topo = await (
    await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
  ).json()
  const arcs = decodeArcs(topo)
  // world-atlas wraps the land in a GeometryCollection holding one MultiPolygon;
  // flatten either shape down to a flat list of rings.
  const geom = topo.objects.land
  const parts =
    geom.type === 'GeometryCollection' ? geom.geometries : [geom]

  const polygons = []
  for (const part of parts) {
    if (part.type === 'MultiPolygon') polygons.push(...part.arcs)
    else if (part.type === 'Polygon') polygons.push(part.arcs)
  }

  const rings = []
  let d = ''
  for (const poly of polygons) {
    for (const ring of poly) {
      const pts = ringPoints(ring, arcs)
      rings.push(pts)
      d += pointsToPath(pts)
    }
  }
  return { path: d, rings }
}

/* -------------------------------------------------------------------------- */
/* Land mask                                                                  */
/* -------------------------------------------------------------------------- */

const MASK_COLS = 720 // half-degree cells
const MASK_ROWS = 360

/** Even-odd ray casting. Rings are closed, so a plain crossing count is enough. */
function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * A half-degree land/ocean grid, packed one bit per cell and base64'd.
 *
 * Worth the 32 KB: two thirds of the planet is water, and an impact model that
 * cannot tell you that you just hit the middle of the Pacific is missing the
 * single most likely outcome of a random strike.
 */
function buildLandMask(rings) {
  // Bounding boxes first — testing 259,200 cells against every ring directly is
  // minutes of work; skipping rings that cannot contain the point is seconds.
  const boxed = rings.map((r) => {
    let minX = 180, maxX = -180, minY = 90, maxY = -90
    for (const [x, y] of r) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    return { r, minX, maxX, minY, maxY }
  })

  const bits = new Uint8Array(Math.ceil((MASK_COLS * MASK_ROWS) / 8))
  for (let row = 0; row < MASK_ROWS; row++) {
    const lat = 90 - (row + 0.5) * (180 / MASK_ROWS)
    for (let col = 0; col < MASK_COLS; col++) {
      const lon = -180 + (col + 0.5) * (360 / MASK_COLS)
      let inside = false
      for (const b of boxed) {
        if (lon < b.minX || lon > b.maxX || lat < b.minY || lat > b.maxY) continue
        if (pointInRing(lon, lat, b.r)) inside = !inside // holes flip it back off
      }
      if (inside) {
        const i = row * MASK_COLS + col
        bits[i >> 3] |= 1 << (i & 7)
      }
    }
  }
  return Buffer.from(bits).toString('base64')
}

/* -------------------------------------------------------------------------- */
/* Cities                                                                     */
/* -------------------------------------------------------------------------- */

async function buildCities() {
  const base =
    'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/' +
    'geonames-all-cities-with-a-population-1000/records'
  const out = []

  for (let offset = 0; offset < CITY_COUNT; offset += 100) {
    const url =
      `${base}?order_by=population%20DESC&limit=100&offset=${offset}` +
      '&select=name,cou_name_en,population,coordinates'
    const j = await (await fetch(url)).json()
    if (!j.results?.length) break
    for (const r of j.results) {
      if (!r.coordinates || !r.population) continue
      out.push({
        n: r.name,
        c: r.cou_name_en ?? '',
        p: Math.round(r.population / 1000) * 1000,
        // Three decimals is ~110 m — far finer than the damage rings care about.
        lat: Number(r.coordinates.lat.toFixed(3)),
        lon: Number(r.coordinates.lon.toFixed(3)),
      })
    }
    process.stdout.write(`\r  cities: ${out.length}`)
  }
  process.stdout.write('\n')
  return dedupe(out)
}

/**
 * Drop settlements that are really districts of a larger one already in the list.
 *
 * GeoNames lists Brent and Islington as their own populated places, a few km
 * from a London entry that already counts all nine million of them. Left alone,
 * every blast over a big city double-counts its own boroughs and the death toll
 * comes out far too high.
 *
 * The test is the same disc the casualty model uses: walking down from the
 * largest, if a place falls inside the footprint of one already kept, it is part
 * of that place rather than a neighbour of it.
 */
function dedupe(cities) {
  const radiusKm = (pop) => Math.sqrt(pop / 5000 / Math.PI)
  const kept = []
  let dropped = 0

  for (const c of [...cities].sort((a, b) => b.p - a.p)) {
    const swallowed = kept.some((k) => {
      const r = radiusKm(k.p)
      // Cheap latitude gate before the real distance, which is the expensive bit.
      if (Math.abs(k.lat - c.lat) > r / 111 + 0.02) return false
      const dx = (c.lon - k.lon) * 111.32 * Math.cos((c.lat * Math.PI) / 180)
      const dy = (c.lat - k.lat) * 110.57
      return Math.hypot(dx, dy) < r
    })
    if (swallowed) dropped++
    else kept.push(c)
  }

  console.log(`  deduped: dropped ${dropped} districts of larger cities`)
  return kept
}

/* -------------------------------------------------------------------------- */

const [coast, cities] = await Promise.all([buildCoastline(), buildCities()])
const land = coast.path
process.stdout.write('  building land mask…')
const landMask = buildLandMask(coast.rings)
process.stdout.write(' done\n')

const file = `/**
 * GENERATED by scripts/build-world-data.mjs — do not edit by hand.
 *
 * Coastline: Natural Earth 1:110m land via world-atlas, public domain,
 * projected equirectangular into a ${MAP_W}x${MAP_H} viewBox.
 *
 * Cities: the ${cities.length} most populous settlements on Earth, from GeoNames
 * via OpenDataSoft (CC BY 4.0). Population is the city proper as GeoNames
 * records it, rounded to the nearest thousand.
 */

export const MAP_W = ${MAP_W}
export const MAP_H = ${MAP_H}

/** One SVG path covering every landmass. */
export const LAND_PATH = ${JSON.stringify(land)}

/** Half-degree land/ocean grid, one bit per cell, row-major from 90°N/180°W. */
export const MASK_COLS = ${MASK_COLS}
export const MASK_ROWS = ${MASK_ROWS}
export const LAND_MASK = ${JSON.stringify(landMask)}

/* Decoded once on first use, not per call — this gets asked on every pointer
   move across the map. */
let maskBits: Uint8Array | null = null
function bits(): Uint8Array {
  if (maskBits) return maskBits
  const raw =
    typeof atob === 'function'
      ? atob(LAND_MASK)
      : Buffer.from(LAND_MASK, 'base64').toString('binary')
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  maskBits = out
  return out
}

/** True if that coordinate is on land. */
export function isLand(lat: number, lon: number): boolean {
  const col = Math.floor(((lon + 180) / 360) * MASK_COLS)
  const row = Math.floor(((90 - lat) / 180) * MASK_ROWS)
  if (col < 0 || col >= MASK_COLS || row < 0 || row >= MASK_ROWS) return false
  const i = row * MASK_COLS + col
  return (bits()[i >> 3] & (1 << (i & 7))) !== 0
}

export type City = {
  /** name */ n: string
  /** country */ c: string
  /** population */ p: number
  lat: number
  lon: number
}

export const CITIES: City[] = ${JSON.stringify(cities)}
`

writeFileSync('src/data/world.ts', file)
console.log(
  `wrote src/data/world.ts — ${cities.length} cities, ` +
    `coastline path ${(land.length / 1024).toFixed(0)} KB`,
)

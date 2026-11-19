/**
 * Printing Money — the US government's spending, as a strip of dollar bills
 * laid end to end round the world.
 *
 * The government spends about $214,000 a second. A $1 bill is 6.14 inches
 * long, so that is 33 kilometres of bills a second, and the strip the page
 * draws starts at the Capitol the moment the page opens and runs east along
 * a great circle, the straight line on a sphere. It crosses the Atlantic in
 * about three minutes and is back at the Capitol, having gone right round
 * the Earth, in twenty.
 *
 * The globe is the Earth as it is at the minute you are looking: day where
 * the Sun is up and night where it is not, from the date and the clock; the
 * real coastline and the real cities (lib/data world.ts, painted into one
 * picture by `worldPicture`), and the strip drawn far wider than its 6.6 cm
 * so that it can be seen at all. The clouds are invented.
 *
 * The camera frames the strip as it grows: the US east coast at first, the
 * Atlantic after a minute, the whole planet after ten, and from then on it
 * follows the end of the strip round.
 *
 * The arithmetic is here, import-free, so a check can read it as it is; the
 * shader is lib/money-globe-shader.ts.
 */

/* -------------------------------------------------------------------------- */
/* The path                                                                     */
/* -------------------------------------------------------------------------- */

export const EARTH_RADIUS_KM = 6371.0088
export const EARTH_CIRCUMFERENCE_KM = 2 * Math.PI * EARTH_RADIUS_KM
/** Where the strip starts: the United States Capitol. */
export const CAPITOL = { lat: 38.8899, lon: -77.0091 }

export type V3 = [number, number, number]
const D2R = Math.PI / 180

/** A place as a direction from the Earth's centre: x toward 90°E on the equator, y toward the north pole, z toward 0°, 0°. */
export function dirOf(lat: number, lon: number): V3 {
  const a = lat * D2R, o = lon * D2R
  return [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)]
}
export function latLonOf(v: V3): { lat: number; lon: number } {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return { lat: Math.asin(Math.max(-1, Math.min(1, v[1] / len))) / D2R, lon: Math.atan2(v[0], v[2]) / D2R }
}
/** Due east along the ground at a place. */
export function eastAt(lat: number, lon: number): V3 {
  const o = lon * D2R
  return [Math.cos(o), 0, -Math.sin(o)]
}

/** The strip's line: it starts at the Capitol heading due east, and goes on round. */
export const START = dirOf(CAPITOL.lat, CAPITOL.lon)
export const HEADING = eastAt(CAPITOL.lat, CAPITOL.lon)

/** The point `s` radians along the line from the Capitol. */
export function along(s: number): V3 {
  const c = Math.cos(s), n = Math.sin(s)
  return [c * START[0] + n * HEADING[0], c * START[1] + n * HEADING[1], c * START[2] + n * HEADING[2]]
}

/** How far along, in radians of the Earth, a strip this many kilometres long reaches. */
export const angleOf = (km: number) => km / EARTH_RADIUS_KM

/* -------------------------------------------------------------------------- */
/* The camera                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A view of the globe: where its middle is, and how big the globe is drawn,
 * as its radius over half the picture's height (over 1 is closer than the
 * whole Earth; 0.86 is the whole Earth with room round it).
 */
export type GlobeView = { lat: number; lon: number; scale: number }

/** Never closer than this: about the eastern US and the western Atlantic. */
export const CLOSEST_HALF_ANGLE = 22 * D2R
export const WHOLE_EARTH = 0.86

/**
 * The view that holds a strip `s` radians long on a picture of this aspect
 * (width over height). Until it is too long to fit on the near side it is
 * centred on its middle and as close as it can be while holding it all; past
 * that, the whole Earth, turned so the end of the strip is coming round
 * toward you from the right.
 */
export function viewFor(s: number, aspect: number): GlobeView {
  const half = s / 2 + 8 * D2R
  // A point this far from the middle sits sin(angle) of the globe's radius out.
  const room = Math.min(1, aspect) * 0.92
  if (half < Math.PI / 2 * 0.86) {
    const reach = Math.sin(Math.max(half, CLOSEST_HALF_ANGLE))
    const scale = Math.max(WHOLE_EARTH, room / reach)
    const mid = latLonOf(along(s / 2))
    if (scale > WHOLE_EARTH) return { ...mid, scale }
  }
  // The whole Earth, the end of the strip a little to the right of the middle.
  const lead = s - 0.75
  return { ...latLonOf(along(Math.max(lead, s / 2))), scale: WHOLE_EARTH }
}

/** A place on the picture, as x and y in -aspect..aspect and -1..1 (y up), and whether it faces us. */
export function project(v: GlobeView, p: V3): { x: number; y: number; front: boolean } {
  const f = dirOf(v.lat, v.lon)
  const e = eastAt(v.lat, v.lon)
  const n: V3 = [f[1] * e[2] - f[2] * e[1], f[2] * e[0] - f[0] * e[2], f[0] * e[1] - f[1] * e[0]]
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return { x: dot(p, e) * v.scale, y: dot(p, n) * v.scale, front: dot(p, f) > 0 }
}

/* -------------------------------------------------------------------------- */
/* Where the Sun is                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The place on the Earth with the Sun straight overhead at an instant: the
 * declination from the day of the year, the longitude from the clock and the
 * equation of time (NOAA's short series). Good to a fraction of a degree,
 * which on a globe this size is under a pixel.
 */
export function subsolar(at: Date): { lat: number; lon: number } {
  const start = Date.UTC(at.getUTCFullYear(), 0, 1)
  const day = (+at - start) / 86_400_000
  const g = (2 * Math.PI / 365.25) * (day - 0.5)
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const minutes = at.getUTCHours() * 60 + at.getUTCMinutes() + at.getUTCSeconds() / 60
  let lon = -(minutes + eot - 720) / 4
  lon = ((lon + 540) % 360) - 180
  return { lat: decl / D2R, lon }
}

/* -------------------------------------------------------------------------- */
/* The picture of the world the shader reads                                   */
/* -------------------------------------------------------------------------- */

/**
 * The world as one picture, equirectangular, `w` pixels across: red is land,
 * green is the light of cities at night. Painted in the browser from the
 * coastline path and the city list the site already carries, so the globe's
 * coast is the vector coast at this resolution and its night lights are where
 * people actually live, brighter where more of them do.
 */
export function worldPicture(
  w: number,
  landPath: string, mapW: number, mapH: number,
  cities: { lat: number; lon: number; p: number }[],
): HTMLCanvasElement {
  const h = w / 2
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  g.save()
  g.scale(w / mapW, h / mapH)
  g.fillStyle = '#f00'
  g.fill(new Path2D(landPath))
  g.restore()
  // Cities: a soft spot each, its size and brightness growing with the square root of the people.
  g.globalCompositeOperation = 'lighter'
  const k = w / 4096
  for (const city of cities) {
    const x = ((city.lon + 180) / 360) * w, y = ((90 - city.lat) / 180) * h
    const r = Math.max(1.1, Math.min(5, Math.sqrt(city.p / 1e6) * 1.9)) * k * 1.6
    const a = Math.min(0.85, 0.16 + Math.sqrt(city.p / 2e7))
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, `rgba(0,255,0,${a})`)
    grad.addColorStop(1, 'rgba(0,255,0,0)')
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  return c
}


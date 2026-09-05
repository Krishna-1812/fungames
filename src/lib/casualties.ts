/**
 * Who is standing where the blast goes.
 *
 * The impact physics in impact.ts is peer-reviewed and I have checked it against
 * four real events. This file is not that, and it should not pretend to be:
 * turning overpressure into a death toll means assuming how people are
 * distributed, what they are standing inside, and how a building failing
 * translates into a person dying. Every one of those is a judgement call.
 *
 * So the method is stated plainly rather than hidden behind a number:
 *
 *   - Each of the 1,200 cities in the dataset is modelled as a uniform disc,
 *     with its radius derived from its real population and one assumed urban
 *     density. Real cities are neither uniform nor circular.
 *   - The population inside each damage ring is the geometric overlap of that
 *     disc with the ring.
 *   - Fatality and injury fractions per overpressure band are taken from the
 *     standard blast-effects bands used in nuclear weapons effects estimates.
 *   - Everyone outside those 1,200 cities counts as zero. This is why a strike
 *     in the Pacific kills nobody here, which is roughly right, and why one in
 *     rural Bangladesh is badly under-counted, which is not.
 *
 * The output is an order-of-magnitude estimate. It is presented as one.
 */
import type { ImpactResult } from './impact'
import { CITIES, type City } from '../data/world'

const EARTH_RADIUS = 6_371_000 // m

/**
 * People per square kilometre used to give a city its footprint.
 *
 * A blunt single figure across the whole planet. Real densities run from about
 * 1,500/km² in sprawling North American metros to over 30,000/km² in Dhaka, so
 * this is deliberately mid-range and the resulting radii are sanity-checked in
 * scripts/check-impact.mjs against a few cities whose extent is well known.
 */
const URBAN_DENSITY_KM2 = 5_000

/**
 * What each overpressure band does to the people inside it.
 *
 * Anchored to two events rather than picked to feel dramatic:
 *
 *   Hiroshima — inside ~1 km of ground zero (roughly the 120 kPa contour)
 *   fatality ran above 90%; out at 2 km (roughly 40 kPa) it was near 40%.
 *
 *   Chelyabinsk — about 1,500 people hurt out of the ~1.1 million living under
 *   it, essentially all by flying glass, and nobody killed. That is an injury
 *   rate near 0.1% at the window-breaking band, which is the single most
 *   important correction here: the conventional weapons-effects tables imply
 *   something like 25%, and using that number made the model claim a quarter of
 *   a million casualties for an event that hospitalised a small town's worth.
 */
const LETHALITY: { pa: number; fatal: number; injured: number }[] = [
  { pa: 426_000, fatal: 1.0, injured: 0.0 },
  { pa: 121_000, fatal: 0.9, injured: 0.1 },
  { pa: 42_600, fatal: 0.4, injured: 0.45 },
  { pa: 20_000, fatal: 0.05, injured: 0.3 },
  { pa: 6_900, fatal: 0.0001, injured: 0.02 },
  // Calibrated directly on Chelyabinsk: ~1,500 hurt out of 1.1 million under a
  // 2 kPa wave, nobody killed.
  { pa: 2_000, fatal: 0, injured: 0.0015 },
]

/** Great-circle distance in metres. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLon = (lon2 - lon1) * toRad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Radius of the disc we use to stand in for a city, metres. */
export function cityRadius(population: number): number {
  const areaKm2 = population / URBAN_DENSITY_KM2
  return Math.sqrt(areaKm2 / Math.PI) * 1000
}

/**
 * Area shared by two circles: one of radius `a` whose centre is `d` away, and
 * one of radius `b` centred on the impact. Standard circular-lens formula, with
 * the two containment cases handled first because the general form divides by
 * zero on them.
 */
function overlapArea(d: number, a: number, b: number): number {
  if (d >= a + b) return 0
  if (d <= Math.abs(a - b)) return Math.PI * Math.min(a, b) ** 2
  const t1 = a * a * Math.acos((d * d + a * a - b * b) / (2 * d * a))
  const t2 = b * b * Math.acos((d * d + b * b - a * a) / (2 * d * b))
  const t3 = 0.5 * Math.sqrt((-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b))
  return t1 + t2 - t3
}

export type CityToll = {
  city: City
  distance: number
  /** Strongest overpressure this city sees, Pa. */
  peakPressure: number
  dead: number
  injured: number
}

export type Casualties = {
  dead: number
  injured: number
  /** Cities with any casualties at all, worst first. */
  cities: CityToll[]
  /** People inside the third-degree-burn radius, whether or not the blast reaches them. */
  burned: number
}

export function estimateCasualties(
  result: ImpactResult,
  lat: number,
  lon: number,
): Casualties {
  // Rings must run largest first so each city is charged at the worst band it
  // falls inside and then excluded from the gentler ones.
  const rings = [...result.blast].sort((a, b) => b.pa - a.pa)
  const burnRadius =
    result.thermal.find((t) => t.effect === 'thirdDegreeBurns')?.radius ?? 0

  const tolls = new Map<City, CityToll>()
  let burned = 0

  const reach = result.maxRadius
  for (const city of CITIES) {
    const d = haversine(lat, lon, city.lat, city.lon)
    const r = cityRadius(city.p)
    if (d - r > reach && d - r > burnRadius) continue

    const cityArea = Math.PI * r * r
    const share = (ringRadius: number) => overlapArea(d, r, ringRadius) / cityArea

    let claimed = 0 // fraction of the city already counted in a harsher ring
    let dead = 0
    let injured = 0
    let peak = 0

    for (const ring of rings) {
      const inside = share(ring.radius)
      const band = Math.max(0, inside - claimed)
      if (band <= 0) continue
      const rates = LETHALITY.find((l) => l.pa === ring.pa)
      if (!rates) continue
      dead += city.p * band * rates.fatal
      injured += city.p * band * rates.injured
      if (peak === 0) peak = ring.pa
      claimed = inside
    }

    if (burnRadius > 0) burned += city.p * share(burnRadius)

    if (dead >= 1 || injured >= 1) {
      tolls.set(city, { city, distance: d, peakPressure: peak, dead, injured })
    }
  }

  const cities = [...tolls.values()].sort((a, b) => b.dead + b.injured - (a.dead + a.injured))
  return {
    dead: Math.round(cities.reduce((s, c) => s + c.dead, 0)),
    injured: Math.round(cities.reduce((s, c) => s + c.injured, 0)),
    burned: Math.round(burned),
    cities,
  }
}

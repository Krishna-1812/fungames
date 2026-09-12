/**
 * The map "Every Second, Somewhere" draws its dots on, and the one piece of
 * real maths the live simulation runs on.
 *
 * The projection is plain equirectangular — real latitude and longitude,
 * linearly mapped to x/y, in the exact same 360x180 space
 * `src/data/population-geo.ts`'s real country shapes are already projected
 * into. A capital city's coordinates and its own country's real outline are
 * drawn from two different sources, so they only ever agree if both are
 * actually right — which is also what `check-population-live.mjs` checks.
 *
 * The first version of this page drew its own hand-placed continent blobs —
 * twenty-odd guessed points per landmass — rather than a real coastline.
 * That is gone. Every shape on the map now is real Natural Earth geometry;
 * see `scripts/build-population-geo.mjs`.
 */

export const LON_MIN = -180
export const LON_MAX = 180
export const LAT_MIN = -90
export const LAT_MAX = 90
export const MAP_W = 360
export const MAP_H = 180

/** Real latitude/longitude to map coordinates — the same projection
 *  `build-population-geo.mjs` used to draw the real country shapes, so a
 *  capital city and its own country's outline agree. */
export function project(lat: number, lon: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H
  return [x, y]
}

/* ---- the live simulation's one piece of real maths --------------------- */

/**
 * A Poisson process's inter-arrival times are exponentially distributed:
 * given a mean rate of `perSecond` events per second and a uniform random
 * draw `u` in (0, 1), this returns real seconds until the next event.
 *
 * Used exactly this way on both sides: the page schedules each country's
 * next birth and death with it against `Math.random()`, and
 * `check-population-live.mjs` calls the identical function against a seeded
 * generator and checks the distribution it produces is the one a real
 * Poisson process actually has — not just that events happen "about often
 * enough", which a wrong distribution with the right mean would also pass.
 */
export function nextInterval(perSecond: number, u: number): number {
  return -Math.log(1 - u) / perSecond
}

/** Deterministic pseudo-random in [0,1) — same generator as the art
 *  modules, so the checker's Monte Carlo runs are reproducible. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

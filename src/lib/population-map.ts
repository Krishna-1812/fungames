/**
 * The map "Every Second, Somewhere" draws its dots on, and the one piece of
 * real maths the live simulation runs on.
 *
 * The projection is plain equirectangular — real latitude and longitude,
 * linearly mapped to x/y. Nothing fancy, and nothing hidden: a country's dot
 * sits exactly where its real capital-city coordinates project to, which is
 * the part of this page that has to be exactly right.
 *
 * The continent outlines are the part that is deliberately *not* claiming
 * precision. They are twenty-odd hand-placed points per landmass, smoothed
 * into a blob — recognisable, not surveyed. The honest version of a world
 * map here would need a real coastline dataset this project does not carry;
 * the dishonest version would draw these rough shapes and let you assume
 * they were exact. This is neither: the shapes are context for where the
 * real dots are, not data themselves.
 */

export const LON_MIN = -180
export const LON_MAX = 180
export const LAT_MIN = -58
export const LAT_MAX = 78
export const MAP_W = 360
export const MAP_H = LAT_MAX - LAT_MIN

/** Real latitude/longitude to map coordinates. The one function every dot
 *  on this page — real or decorative — is placed by. */
export function project(lat: number, lon: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H
  return [x, y]
}

/** Rough continent silhouettes: a lat/lon point list per landmass, in the
 *  order a pen would actually trace the coastline. Deliberately coarse. */
export const CONTINENTS: { name: string; points: [number, number][] }[] = [
  {
    name: 'North America',
    points: [
      [70, -165], [68, -130], [60, -95], [50, -80], [45, -83], [45, -67],
      [25, -80], [18, -95], [16, -92], [14, -90], [23, -106], [32, -117],
      [49, -125], [60, -140],
    ],
  },
  {
    name: 'South America',
    points: [
      [12, -72], [10, -62], [-5, -35], [-23, -43], [-34, -58], [-55, -68],
      [-40, -73], [-18, -70], [-4, -81], [5, -77],
    ],
  },
  {
    name: 'Africa',
    points: [
      [37, 10], [32, 32], [12, 43], [2, 45], [-26, 32], [-34, 18],
      [-18, 12], [-5, 12], [5, 9], [14, -17], [28, -13], [35, -6],
    ],
  },
  {
    name: 'Europe',
    points: [
      [71, 25], [60, 30], [52, 40], [45, 38], [37, 23], [36, -6],
      [43, -9], [48, -4], [51, 3], [55, 8], [58, 10],
    ],
  },
  {
    name: 'Asia',
    points: [
      [77, 105], [70, 140], [66, 170], [55, 160], [45, 140], [35, 130],
      [22, 120], [10, 106], [1, 104], [-9, 120], [-8, 115], [6, 95],
      [8, 77], [24, 68], [30, 48], [36, 36], [41, 29], [45, 38],
      [50, 45], [55, 60], [60, 75], [68, 90],
    ],
  },
  {
    name: 'Australia',
    points: [
      [-11, 132], [-12, 137], [-17, 146], [-28, 153], [-38, 148],
      [-35, 137], [-35, 117], [-22, 114], [-14, 126],
    ],
  },
]

/** Closed smooth blob through a list of already-projected points, via the
 *  standard "quadratic through midpoints" trick — cheap, and it never
 *  overshoots the points the way a full spline can. */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ]
  const f = (v: number) => v.toFixed(1)
  const start = mid(pts[n - 1], pts[0])
  let d = `M${f(start[0])} ${f(start[1])} `
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n]
    const m = mid(pts[i], next)
    d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])} `
  }
  return d + 'Z'
}

/** A continent's lat/lon outline, projected and smoothed into one path. */
export function continentPath(points: [number, number][]): string {
  return smoothPath(points.map(([lat, lon]) => project(lat, lon)))
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

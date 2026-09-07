/**
 * A weather forecast for the sky.
 *
 * Everything on the Universe Forecast page is computed here from orbital
 * mechanics, not looked up in a table of dates somebody typed in. That matters
 * for one reason: a hardcoded list is a page that quietly starts lying on a
 * date nobody chose, and this site has already been through the exercise of
 * replacing a number typed into a page (Paper Folds' 103 folds) with the
 * property of a real thing.
 *
 * The algorithms are Jean Meeus, *Astronomical Algorithms* (2nd ed.):
 *
 *   ch. 27  equinoxes and solstices
 *   ch. 49  phases of the Moon
 *   ch. 54  which of those phases are eclipses, and what kind
 *   ch. 38  Earth at perihelion and aphelion
 *
 * They are worth the length. The four seasons come out to within a minute of
 * the published times for any year you try, and chapter 54 does something that
 * looks like a magic trick from the outside: it decides whether a given new
 * moon is a solar eclipse — and whether that eclipse is total, annular or
 * hybrid — out of five angles and no eclipse catalogue at all.
 *
 * `scripts/check-forecast.mjs` holds all of it to Meeus's own worked examples
 * and to eclipses people have stood outside and watched.
 *
 * Times are UTC. Everything internal is in Julian Ephemeris Days on the
 * Terrestrial Time scale, which is what these series are written in; the
 * conversion out to civil time subtracts ΔT once, at the boundary.
 */

const RAD = Math.PI / 180
const sin = (deg: number) => Math.sin(deg * RAD)
const cos = (deg: number) => Math.cos(deg * RAD)

/* -------------------------------------------------------------------------- */
/* Time                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * ΔT, the gap between Terrestrial Time and UT, in seconds.
 *
 * The Earth's rotation is not a clock you can predict, so this is a fit to
 * observation rather than a formula — Espenak and Meeus's polynomial for
 * 2005–2050, extended flat on either side because pretending otherwise would
 * be inventing precision. It is currently around 69 seconds, which is why every
 * time here is quoted to the minute and not to the second.
 */
export function deltaT(year: number): number {
  const t = Math.min(50, Math.max(5, year - 2000))
  return 62.92 + 0.32217 * t + 0.005589 * t * t
}

/** Julian Day from a UTC instant. */
export function dateToJulian(d: Date): number {
  return d.getTime() / 86_400_000 + 2440587.5
}

/** UTC instant from a Julian Day. */
export function julianToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86_400_000)
}

/** Rough calendar year of a Julian Day, good enough to pick a ΔT with. */
const yearOf = (jd: number) => 2000 + (jd - 2451545.0) / 365.25

/** A Julian Ephemeris Day (TT) as a civil UTC instant. */
export function tdToUtc(jde: number): Date {
  return julianToDate(jde - deltaT(yearOf(jde)) / 86400)
}

/* -------------------------------------------------------------------------- */
/* Equinoxes and solstices — Meeus ch. 27                                      */
/* -------------------------------------------------------------------------- */

export type Season = 'march' | 'june' | 'september' | 'december'

/** Mean season, before the periodic terms. Valid 1000–3000. */
function meanSeason(year: number, which: Season): number {
  const y = (year - 2000) / 1000
  const p = (a: number, b: number, c: number, d: number, e: number) =>
    a + b * y + c * y * y + d * y ** 3 + e * y ** 4
  switch (which) {
    case 'march': return p(2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057)
    case 'june': return p(2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030)
    case 'september': return p(2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078)
    case 'december': return p(2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032)
  }
}

/**
 * The twenty-four periodic terms of Meeus table 27.C.
 *
 * Their combined effect is under twenty minutes, and leaving them off is the
 * difference between a page that agrees with the almanac and one that is
 * confidently a quarter of an hour out.
 */
const SEASON_TERMS: [number, number, number][] = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
  [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
  [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
  [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
  [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
  [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
  [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
]

/** An equinox or solstice, as a Julian Ephemeris Day. */
export function seasonJde(year: number, which: Season): number {
  const jde0 = meanSeason(year, which)
  const t = (jde0 - 2451545.0) / 36525
  const w = 35999.373 * t - 2.47
  const dl = 1 + 0.0334 * cos(w) + 0.0007 * cos(2 * w)
  let s = 0
  for (const [a, b, c] of SEASON_TERMS) s += a * cos(b + c * t)
  return jde0 + (0.00001 * s) / dl
}

/* -------------------------------------------------------------------------- */
/* Phases of the Moon — Meeus ch. 49                                           */
/* -------------------------------------------------------------------------- */

export type Phase = 'new' | 'first' | 'full' | 'last'

const PHASE_OFFSET: Record<Phase, number> = { new: 0, first: 0.25, full: 0.5, last: 0.75 }

/** The lunation number nearest a given moment, for `phaseJde`. */
export function lunationNear(d: Date): number {
  const y = yearOf(dateToJulian(d))
  return Math.floor((y - 2000) * 12.3685)
}

/** The five angles every phase and eclipse term is built out of. */
function moonArgs(k: number) {
  const t = k / 1236.85
  return {
    t,
    e: 1 - 0.002516 * t - 0.0000074 * t * t,
    /** Sun's mean anomaly. */
    m: 2.5534 + 29.1053567 * k - 0.0000014 * t * t - 0.00000011 * t ** 3,
    /** Moon's mean anomaly. */
    mp: 201.5643 + 385.81693528 * k + 0.0107582 * t * t
      + 0.00001238 * t ** 3 - 0.000000058 * t ** 4,
    /** Moon's argument of latitude — the one that decides eclipses. */
    f: 160.7108 + 390.67050284 * k - 0.0016118 * t * t
      - 0.00000227 * t ** 3 + 0.000000011 * t ** 4,
    /** Longitude of the ascending node. */
    om: 124.7746 - 1.56375588 * k + 0.0020672 * t * t + 0.00000215 * t ** 3,
  }
}

/** Mean phase, before corrections. */
function meanPhase(k: number): number {
  const t = k / 1236.85
  return 2451550.09766 + 29.530588861 * k
    + 0.00015437 * t * t - 0.00000015 * t ** 3 + 0.00000000073 * t ** 4
}

/** The fourteen planetary arguments, Meeus p. 351. Worth about half a minute. */
function planetary(k: number, t: number): number {
  const a = [
    [0.000325, 299.77 + 0.107408 * k - 0.009173 * t * t],
    [0.000165, 251.88 + 0.016321 * k],
    [0.000164, 251.83 + 26.651886 * k],
    [0.000126, 349.42 + 36.412478 * k],
    [0.000110, 84.66 + 18.206239 * k],
    [0.000062, 141.74 + 53.303771 * k],
    [0.000060, 207.14 + 2.453732 * k],
    [0.000056, 154.84 + 7.30686 * k],
    [0.000047, 34.52 + 27.261239 * k],
    [0.000042, 207.19 + 0.121824 * k],
    [0.000040, 291.34 + 1.844379 * k],
    [0.000037, 161.72 + 24.198154 * k],
    [0.000035, 239.56 + 25.513099 * k],
    [0.000023, 331.55 + 3.592518 * k],
  ]
  return a.reduce((s, [amp, ang]) => s + amp * sin(ang), 0)
}

/**
 * A phase of the Moon, as a Julian Ephemeris Day.
 *
 * `k` counts lunations from the new moon of 2000 January 6; the quarter is
 * added to it, which is Meeus's own convention and the reason the same series
 * serves all four phases.
 */
export function phaseJde(k: number, phase: Phase): number {
  const kk = k + PHASE_OFFSET[phase]
  const { t, e, m, mp, f, om } = moonArgs(kk)
  let jde = meanPhase(kk)

  if (phase === 'new' || phase === 'full') {
    // The two lists differ only in their first two coefficients; sharing the
    // rest is not a shortcut, it is what the book prints.
    const c0 = phase === 'new' ? -0.4072 : -0.40614
    const c1 = phase === 'new' ? 0.17241 : 0.17302
    jde += c0 * sin(mp)
      + c1 * e * sin(m)
      + 0.01608 * sin(2 * mp)
      + 0.01039 * sin(2 * f)
      + 0.00739 * e * sin(mp - m)
      - 0.00514 * e * sin(mp + m)
      + 0.00208 * e * e * sin(2 * m)
      - 0.00111 * sin(mp - 2 * f)
      - 0.00057 * sin(mp + 2 * f)
      + 0.00056 * e * sin(2 * mp + m)
      - 0.00042 * sin(3 * mp)
      + 0.00042 * e * sin(m + 2 * f)
      + 0.00038 * e * sin(m - 2 * f)
      - 0.00024 * e * sin(2 * mp - m)
      - 0.00017 * sin(om)
      - 0.00007 * sin(mp + 2 * m)
      + 0.00004 * sin(2 * mp - 2 * f)
      + 0.00004 * sin(3 * m)
      + 0.00003 * sin(mp + m - 2 * f)
      + 0.00003 * sin(2 * mp + 2 * f)
      - 0.00003 * sin(mp + m + 2 * f)
      + 0.00003 * sin(mp - m + 2 * f)
      - 0.00002 * sin(mp - m - 2 * f)
      - 0.00002 * sin(3 * mp + m)
      + 0.00002 * sin(4 * mp)
  } else {
    jde += -0.62801 * sin(mp)
      + 0.17172 * e * sin(m)
      - 0.01183 * e * sin(mp + m)
      + 0.00862 * sin(2 * mp)
      + 0.00804 * sin(2 * f)
      + 0.00454 * e * sin(mp - m)
      + 0.00204 * e * e * sin(2 * m)
      - 0.0018 * sin(mp - 2 * f)
      - 0.0007 * sin(mp + 2 * f)
      - 0.0004 * sin(3 * mp)
      - 0.00034 * e * sin(2 * mp - m)
      + 0.00032 * e * sin(m + 2 * f)
      + 0.00032 * e * sin(m - 2 * f)
      - 0.00028 * e * e * sin(mp + 2 * m)
      + 0.00027 * e * sin(2 * mp + m)
      - 0.00017 * sin(om)
      - 0.00005 * sin(mp - m - 2 * f)
      + 0.00004 * sin(2 * mp + 2 * f)
      - 0.00004 * sin(mp + m + 2 * f)
      + 0.00004 * sin(mp - 2 * m)
      + 0.00003 * sin(mp + m - 2 * f)
      + 0.00003 * sin(3 * m)
      + 0.00002 * sin(2 * mp - 2 * f)
      + 0.00002 * sin(mp - m + 2 * f)
      - 0.00002 * sin(3 * mp + m)
    const w = 0.00306 - 0.00038 * e * cos(m) + 0.00026 * cos(mp)
      - 0.00002 * cos(mp - m) + 0.00002 * cos(mp + m) + 0.00002 * cos(2 * f)
    jde += phase === 'first' ? w : -w
  }

  return jde + planetary(kk, t)
}

/* -------------------------------------------------------------------------- */
/* Eclipses — Meeus ch. 54                                                     */
/* -------------------------------------------------------------------------- */

export type SolarKind = 'total' | 'annular' | 'hybrid' | 'partial'
export type LunarKind = 'total' | 'partial' | 'penumbral'

export type Eclipse = {
  kind: 'solar' | 'lunar'
  type: SolarKind | LunarKind
  jde: number
  /** How far the shadow axis passes from the Earth's centre, in Earth radii. */
  gamma: number
  /** Fraction of the disc covered. Above 1 for a total lunar eclipse. */
  magnitude: number
  /**
   * The radius of the shadow cone where it meets the fundamental plane, in
   * Earth radii. Negative when the umbra reaches us — which is the whole
   * total-or-annular decision — and it is here because it is also the exact
   * size of the shadow the page draws the Moon crossing.
   */
  u: number
  /** True when the shadow's axis touches the Earth at all. */
  central: boolean
}

/**
 * Is the lunation `k` an eclipse, and what kind?
 *
 * The whole decision turns on F, the Moon's argument of latitude — how far it
 * is from the plane the Earth goes round the Sun in. When |sin F| is above
 * about 0.36 the Moon passes too far above or below the line to cast or catch
 * a shadow, and Meeus's first move is simply to stop. Everything after that is
 * working out how close a miss it was.
 */
export function eclipseAt(k: number, kind: 'solar' | 'lunar'): Eclipse | null {
  const kk = k + (kind === 'lunar' ? 0.5 : 0)
  const { t, e, m, mp, f, om } = moonArgs(kk)

  // The gate. Meeus: no eclipse is possible outside this, and it is cheap.
  if (Math.abs(sin(f)) > 0.36) return null

  const f1 = f - 0.02665 * sin(om)
  const a1 = 299.77 + 0.107408 * k - 0.009173 * t * t

  const c0 = kind === 'solar' ? -0.4075 : -0.4065
  const c1 = kind === 'solar' ? 0.1721 : 0.1727
  const jde = meanPhase(kk)
    + c0 * sin(mp)
    + c1 * e * sin(m)
    + 0.0161 * sin(2 * mp)
    - 0.0097 * sin(2 * f1)
    + 0.0073 * e * sin(mp - m)
    - 0.005 * e * sin(mp + m)
    - 0.0023 * sin(mp - 2 * f1)
    + 0.0021 * e * sin(2 * m)
    + 0.0012 * sin(mp + 2 * f1)
    + 0.0006 * e * sin(2 * mp + m)
    - 0.0004 * sin(3 * mp)
    - 0.0003 * e * sin(m + 2 * f1)
    + 0.0003 * sin(a1)
    - 0.0002 * e * sin(m - 2 * f1)
    - 0.0002 * e * sin(2 * mp - m)
    - 0.0002 * sin(om)

  const p = 0.207 * e * sin(m)
    + 0.0024 * e * sin(2 * m)
    - 0.0392 * sin(mp)
    + 0.0116 * sin(2 * mp)
    - 0.0073 * e * sin(mp + m)
    + 0.0067 * e * sin(mp - m)
    + 0.0118 * sin(2 * f1)

  const q = 5.2207
    - 0.0048 * e * cos(m)
    + 0.002 * e * cos(2 * m)
    - 0.3299 * cos(mp)
    - 0.006 * e * cos(mp + m)
    + 0.0041 * e * cos(mp - m)

  const w = Math.abs(cos(f1))
  const gamma = (p * cos(f1) + q * sin(f1)) * (1 - 0.0048 * w)
  const u = 0.0059
    + 0.0046 * e * cos(m)
    - 0.0182 * cos(mp)
    + 0.0004 * cos(2 * mp)
    - 0.0005 * cos(m + mp)

  const g = Math.abs(gamma)

  if (kind === 'solar') {
    if (g > 1.5433 + u) return null
    const central = g < 0.9972
    if (!central) {
      // Partial, including the awkward band where a central eclipse clips the
      // pole and the axis still misses the Earth.
      const magnitude = (1.5433 + u - g) / (0.5461 + 2 * u)
      return { kind, type: 'partial', jde, gamma, magnitude, u, central: false }
    }
    let type: SolarKind
    if (u < 0) type = 'total'
    else if (u > 0.0047) type = 'annular'
    else type = u < 0.00464 * Math.sqrt(1 - gamma * gamma) ? 'hybrid' : 'annular'
    return { kind, type, jde, gamma, magnitude: 1, u, central: true }
  }

  // Lunar. Two shadows: the umbra, which is the eclipse people photograph, and
  // the penumbra, which is a subtle greying most people would not notice.
  const penumbral = (1.5573 + u - g) / 0.545
  const umbral = (1.0128 - u - g) / 0.545
  if (penumbral <= 0) return null
  const type: LunarKind = umbral >= 1 ? 'total' : umbral > 0 ? 'partial' : 'penumbral'
  return {
    kind,
    type,
    jde,
    gamma,
    magnitude: type === 'penumbral' ? penumbral : umbral,
    u,
    central: false,
  }
}

/* -------------------------------------------------------------------------- */
/* Earth at perihelion and aphelion — Meeus ch. 38                             */
/* -------------------------------------------------------------------------- */

/**
 * When the Earth is nearest to, or furthest from, the Sun.
 *
 * Worth having on the page because it is the fact that most reliably surprises
 * people: in the northern hemisphere the Earth is closest to the Sun in the
 * first week of January.
 */
export function apsisJde(year: number, which: 'perihelion' | 'aphelion'): number {
  const k = Math.round(year - 2000.01) + (which === 'aphelion' ? 0.5 : 0)
  const jde = 2451547.507 + 365.2596358 * k + 0.0000000156 * k * k
  const a = [
    328.41 + 132.788585 * k,
    316.13 + 584.903153 * k,
    346.20 + 450.380738 * k,
    136.95 + 659.306737 * k,
    249.52 + 329.653368 * k,
  ]
  const c = which === 'perihelion'
    ? [1.278, -0.055, -0.091, -0.056, -0.045]
    : [-1.352, 0.061, 0.062, 0.029, 0.031]
  return jde + c.reduce((s, ci, i) => s + ci * sin(a[i]), 0)
}

/* -------------------------------------------------------------------------- */
/* Where the Moon is, and how big — Meeus ch. 47, 48 and 25                    */
/* -------------------------------------------------------------------------- */

/**
 * The five mean arguments every lunar series in Meeus is built from.
 *
 * `phaseJde` above has its own set indexed by lunation number, because that is
 * how chapter 49 is written. These are the chapter 47 versions, indexed by
 * time, which is what you need to ask about the Moon on a day that is not a
 * quarter phase — a question the page has to answer every time somebody loads
 * it, since "tonight" is almost never a quarter phase.
 */
function lunarArgs(jde: number) {
  const t = (jde - 2451545.0) / 36525
  return {
    t,
    /** Mean elongation: 0° at new moon, 180° at full. */
    d: 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t
      + t ** 3 / 545868 - t ** 4 / 113065000,
    /** Sun's mean anomaly. */
    m: 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t + t ** 3 / 24490000,
    /** Moon's mean anomaly. */
    mp: 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t
      + t ** 3 / 69699 - t ** 4 / 14712000,
    /** Argument of latitude. */
    f: 93.2720950 + 483202.0175233 * t - 0.0036539 * t * t
      - t ** 3 / 3526000 + t ** 4 / 863310000,
    /** The eccentricity factor, applied once per power of M in an argument. */
    e: 1 - 0.002516 * t - 0.0000074 * t * t,
  }
}

/**
 * The distance terms of Meeus table 47.A, as [D, M, M', F, Σr], Σr in metres.
 *
 * The full table is sixty terms in three columns; only the distance column is
 * here, and only down to about a kilometre, because the one thing this is used
 * for is how big the Moon looks — and a kilometre out of 385,000 moves the
 * apparent diameter by three ten-thousandths of an arcsecond.
 *
 * The first term is the whole story: the Moon's distance swings ±21,000 km
 * every anomalistic month, which is 5% either way, and that swing is the
 * entire difference between an eclipse that goes dark and one that leaves a
 * ring showing.
 */
const MOON_R: [number, number, number, number, number][] = [
  [0, 0, 1, 0, -20905355], [2, 0, -1, 0, -3699111], [2, 0, 0, 0, -2955968],
  [0, 0, 2, 0, -569925], [2, 0, -2, 0, 246158], [2, -1, 0, 0, -204586],
  [2, 0, 1, 0, -170733], [2, -1, -1, 0, -152138], [0, 1, -1, 0, -129620],
  [1, 0, 0, 0, 108743], [0, 1, 1, 0, 104755], [0, 0, 1, -2, 79661],
  [0, 1, 0, 0, 48888], [4, 0, -1, 0, -34782], [2, 1, 0, 0, 30824],
  [2, 1, -1, 0, 24208], [0, 0, 3, 0, -23210], [4, 0, -2, 0, -21636],
  [1, 1, 0, 0, -16675], [2, 0, -3, 0, 14403], [2, -1, 1, 0, -12831],
  [4, 0, 0, 0, -11650], [2, 0, 2, 0, -10445], [2, 0, 0, -2, 10321],
  [2, -1, -2, 0, 10056], [2, -2, 0, 0, -9884], [0, 2, 1, 0, 8752],
  [1, 0, -1, 0, -8379], [0, 1, -2, 0, -7003], [1, 0, 1, 0, 6322],
  [2, 0, -1, -2, -6111], [0, 1, 2, 0, 5751], [2, -2, -1, 0, -4950],
  [0, 0, 2, -2, -4421], [2, 0, 1, -2, 4130], [4, -1, -1, 0, -3958],
  [3, 0, -1, 0, 3258], [0, 0, 0, 2, -3149], [2, 1, 1, 0, 2616],
  [2, 2, -1, 0, 2354], [0, 2, -1, 0, -2117], [4, -1, -2, 0, -1897],
  [4, -1, 0, 0, -1571], [4, 0, 1, 0, -1423], [1, 0, -2, 0, -1739],
  [4, 0, -3, 0, 1165], [0, 0, 4, 0, -1117],
]

/**
 * How far away the Moon is, in kilometres, centre to centre.
 *
 * Ranges from about 356,400 km to 406,700 km, and the checker holds it to
 * exactly that — a range nobody chose, which falls out of the terms above.
 */
export function moonDistanceKm(date: Date): number {
  const jd = dateToJulian(date)
  const { d, m, mp, f, e } = lunarArgs(jd + deltaT(yearOf(jd)) / 86400)
  let r = 0
  for (const [cd, cm, cmp, cf, amp] of MOON_R) {
    const arg = cd * d + cm * m + cmp * mp + cf * f
    r += amp * Math.pow(e, Math.abs(cm)) * cos(arg)
  }
  return 385000.56 + r / 1000
}

/**
 * How far away the Sun is, in astronomical units. Meeus ch. 25, the low
 * accuracy version, which is good to about a hundredth of an arcsecond of
 * apparent diameter — three orders of magnitude finer than anything here needs.
 */
export function sunDistanceAu(date: Date): number {
  const t = (dateToJulian(date) - 2451545.0) / 36525
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(m)
    + (0.019993 - 0.000101 * t) * sin(2 * m)
    + 0.000289 * sin(3 * m)
  return (1.000001018 * (1 - e * e)) / (1 + e * cos(m + c))
}

export type Discs = {
  /** Apparent semidiameter of the Sun, in arcseconds. */
  sun: number
  /** Apparent semidiameter of the Moon from the Earth's centre, in arcseconds. */
  moonGeocentric: number
  /** The same, from the ground under it — which is what an observer sees. */
  moonTopocentric: number
  /**
   * Moon over Sun, apparent. Above 1 the Moon is big enough to cover the Sun
   * and the eclipse is total; below it, a ring is left showing.
   */
  ratio: number
  distanceKm: number
}

const EARTH_RADIUS_KM = 6378.14

/**
 * How big the two discs look, and which is bigger.
 *
 * This is the whole difference between a total eclipse and an annular one, and
 * it is worth noticing that at the Moon's *average* distance the ratio comes
 * out just under 1 — the Moon is, on average, slightly too small. Total
 * eclipses need the Moon nearer than usual, which is why annular ones are the
 * commoner kind. Nothing here was arranged to produce that; it comes out of
 * two distances and two diameters.
 *
 * `gamma` is how far the shadow's axis passes from the Earth's centre, in
 * Earth radii, from `eclipseAt`. It matters because an observer under a
 * grazing shadow stands further from the Moon than one directly beneath it,
 * and that is enough to turn a total eclipse annular at the ends of a hybrid
 * track.
 */
export function discs(date: Date, gamma = 0): Discs {
  const distanceKm = moonDistanceKm(date)
  const lift = EARTH_RADIUS_KM * Math.sqrt(Math.max(0, 1 - gamma * gamma))
  const moonGeocentric = 358473400 / distanceKm
  const moonTopocentric = 358473400 / (distanceKm - lift)
  const sun = 959.63 / sunDistanceAu(date)
  return { sun, moonGeocentric, moonTopocentric, ratio: moonTopocentric / sun, distanceKm }
}

export type Illumination = {
  /** Sun–Moon–Earth angle. 0° is full, 180° is new. */
  phaseAngle: number
  /** Fraction of the disc lit, 0 to 1. */
  fraction: number
  /** True while the lit part is growing. */
  waxing: boolean
  /** Days since the last new moon. */
  age: number
}

/**
 * How much of the Moon is lit, right now. Meeus ch. 48.
 *
 * The low accuracy form, which is seven terms and good to a fifth of a degree
 * of phase angle — about a thousandth in the fraction. It is here rather than
 * the long version because the page draws the result at 96 pixels across, and
 * a thousandth of that is a tenth of a pixel.
 *
 * What makes it worth trusting is not its own accuracy but that it comes from
 * a different chapter than everything else on this page. The checker takes two
 * hundred new moons out of `phaseJde` — chapter 49 — and asks this function
 * what the Moon looks like at each of them. If either series is wrong, they
 * stop agreeing.
 */
export function moonIllumination(date: Date): Illumination {
  const jd = dateToJulian(date)
  const { d, m, mp } = lunarArgs(jd + deltaT(yearOf(jd)) / 86400)
  const i = 180 - d
    - 6.289 * sin(mp)
    + 2.100 * sin(m)
    - 1.274 * sin(2 * d - mp)
    - 0.658 * sin(2 * d)
    - 0.214 * sin(2 * mp)
    - 0.110 * sin(d)
  const phaseAngle = ((i % 360) + 360) % 360
  const dd = ((d % 360) + 360) % 360
  return {
    phaseAngle,
    fraction: (1 + cos(phaseAngle)) / 2,
    waxing: dd < 180,
    age: ageOfMoon(date),
  }
}

/**
 * Days since the last new moon.
 *
 * The tempting version of this is mean elongation over 360, times a synodic
 * month, and it is one line. It is also wrong by up to a third of a day,
 * because mean elongation reaches zero when the *average* Moon catches the Sun
 * and the real one is running early or late by the equation of the centre. The
 * checker caught it reporting a Moon a quarter of a day old at the moment of
 * new moon.
 *
 * So the age is measured against the real thing instead: step back through the
 * lunations until one of chapter 49's new moons is behind us, and subtract.
 * That is the same series the page's own dates come from, so the number under
 * the drawing and the number in the list cannot disagree.
 */
function ageOfMoon(date: Date): number {
  const jd = dateToJulian(date)
  let k = lunationNear(date) + 1
  // Never more than two steps; the guard is against a pathological date, not
  // against the arithmetic.
  for (let i = 0; i < 4 && dateToJulian(tdToUtc(phaseJde(k, 'new'))) > jd; i++) k--
  return jd - dateToJulian(tdToUtc(phaseJde(k, 'new')))
}

/* -------------------------------------------------------------------------- */
/* The geometry the drawings are made of                                       */
/* -------------------------------------------------------------------------- */

/**
 * Radii of the Earth's shadow where the Moon crosses it, in Earth radii.
 *
 * These are not in chapter 54; they have to be read back out of it, and doing
 * that wrong is a mistake with no symptom until you draw the result.
 *
 * The chapter gives the umbral magnitude as `(1.0128 - u - |γ|) / 0.545`. That
 * is zero when the Moon first touches the umbra and one when it is entirely
 * inside, and the distance the Moon's centre travels between those two moments
 * is two Moon radii. So `0.545` is the Moon's *diameter*, not its radius — the
 * Moon is 0.2725 Earth radii across the radius, which is 1737 km over 6378,
 * and that is a check on the reading rather than a coincidence.
 *
 * It follows that `1.0128 - u` is the umbra plus the Moon, so the umbra alone
 * is `0.7403 - u`, and likewise the penumbra is `1.2848 + u`.
 *
 * Taking the printed constants at face value — umbra 1.0128, Moon 0.545 —
 * makes the shadow and the Moon each about twice the size they should be, and
 * the Moon twice as big *relative to* the shadow. The classification stays
 * right, because it never uses these; only the picture is wrong, and it is
 * wrong in a way that draws a penumbral eclipse sitting deep inside the umbra.
 */
export type Shadow = {
  /** Radius of the umbra at the Moon's distance, in Earth radii. */
  umbra: number
  /** Radius of the penumbra, likewise. */
  penumbra: number
  /** The Moon's own radius, in the same units. */
  moon: number
  /** How far the Moon's centre passes from the shadow's axis. */
  gamma: number
}

/** The Moon's radius in Earth radii: 1737.4 / 6378.14. */
const MOON_RADII = 0.2725

export function shadowGeometry(e: Eclipse): Shadow {
  return {
    umbra: 1.0128 - e.u - MOON_RADII,
    penumbra: 1.5573 + e.u - MOON_RADII,
    moon: MOON_RADII,
    gamma: Math.abs(e.gamma),
  }
}

/**
 * How much of the Moon's diameter is inside a shadow of radius `r` when its
 * centre passes `gamma` from the axis. The definition of eclipse magnitude,
 * and the thing `shadowGeometry` has to reproduce if the drawing is to be the
 * same event as the sentence beside it.
 */
export function immersion(s: Shadow, r: number): number {
  return (r + s.moon - s.gamma) / (2 * s.moon)
}

export type Transit = {
  /** The Moon's apparent radius over the Sun's, on the day. */
  ratio: number
  /** Closest approach of the two centres, in Sun radii. Zero if central. */
  sMin: number
}

/**
 * The Moon's path across the Sun, in units of the Sun's radius.
 *
 * Magnitude for a solar eclipse is the fraction of the Sun's *diameter*
 * covered, so with the Sun's radius as the unit, m = (1 + ratio − s) / 2 and
 * the separation at greatest eclipse falls straight out of it.
 */
export function transitGeometry(e: Eclipse, when: Date): Transit {
  const ratio = discs(when, e.gamma).ratio
  return {
    ratio,
    sMin: e.central ? 0 : Math.max(0, 1 + ratio - 2 * e.magnitude),
  }
}

/* -------------------------------------------------------------------------- */
/* Meteor showers — observation, not computation, and labelled as such         */
/* -------------------------------------------------------------------------- */

/**
 * Peak nights and rates for the showers worth going outside for.
 *
 * These are the one thing on the page that is a table rather than a
 * calculation, because they are not calculable: a shower's peak is where the
 * Earth meets a debris stream laid down over centuries, and the rate is what
 * observers counted. The page says so rather than passing them off as
 * ephemeris.
 *
 * Dates are the peak in UTC, which drifts by about a day across the leap-year
 * cycle; the solar longitude is the fixed thing and is given as the reason.
 */
export type Shower = {
  name: string
  /** Peak, as [month (1-12), day]. */
  peak: [number, number]
  /** Zenithal hourly rate at peak, under a dark sky. */
  zhr: number
  parent: string
  note: string
}

export const SHOWERS: Shower[] = [
  {
    name: 'Quadrantids', peak: [1, 3], zhr: 110, parent: 'asteroid 2003 EH1',
    note: 'The sharpest peak of the year — a few hours wide, and easy to miss entirely.',
  },
  {
    name: 'Lyrids', peak: [4, 22], zhr: 18, parent: 'comet Thatcher',
    note: 'Observed for 2,700 years. The Chinese record of 687 BC is the oldest of any shower.',
  },
  {
    name: 'Eta Aquariids', peak: [5, 6], zhr: 50, parent: "comet Halley",
    note: 'Debris from Halley, arriving very fast and low. Better from the south.',
  },
  {
    name: 'Perseids', peak: [8, 12], zhr: 100, parent: 'comet Swift–Tuttle',
    note: 'The one everybody knows, and warm enough at night to actually sit through.',
  },
  {
    name: 'Orionids', peak: [10, 21], zhr: 20, parent: 'comet Halley',
    note: 'Halley again, from the other side of its orbit. The same comet twice a year.',
  },
  {
    name: 'Leonids', peak: [11, 17], zhr: 15, parent: 'comet Tempel–Tuttle',
    note: 'Usually modest. About every 33 years it produces a storm instead.',
  },
  {
    name: 'Geminids', peak: [12, 14], zhr: 150, parent: 'asteroid 3200 Phaethon',
    note: 'The richest shower there is, and the only major one from a rock rather than a comet.',
  },
]

/* -------------------------------------------------------------------------- */
/* The forecast                                                                */
/* -------------------------------------------------------------------------- */

export type EventKind = 'season' | 'phase' | 'eclipse' | 'apsis' | 'shower'

export type SkyEvent = {
  kind: EventKind
  /** Short label, e.g. "Total lunar eclipse". */
  title: string
  /** The sentence under it. */
  detail: string
  when: Date
  /** True when the time is meaningful to the minute rather than the day. */
  timed: boolean
  /** How much of a fuss it is, 0–3. Drives the page's typographic weight. */
  rank: number
  /**
   * The numbers behind the row, when there are any.
   *
   * The page draws every event rather than picking an icon for it, and a
   * drawing wants the quantity, not the label: an eclipse row shows the actual
   * bite taken out of the Sun, a moon row the actual terminator on the night
   * it happens. Passing the model's own output through means the picture
   * cannot drift away from the sentence beside it.
   */
  eclipse?: Eclipse
  phase?: Phase
  season?: Season
  apsis?: 'perihelion' | 'aphelion'
  shower?: Shower
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const SEASON_TITLE: Record<Season, string> = {
  march: 'March equinox',
  june: 'June solstice',
  september: 'September equinox',
  december: 'December solstice',
}

const SEASON_NOTE: Record<Season, string> = {
  march: 'Day and night the same length everywhere. The Sun crosses the equator going north.',
  june: 'The longest day in the north, the shortest in the south. The Sun stops climbing and turns back.',
  september: 'Equal day and night again, and the Sun crosses the equator going the other way.',
  december: 'The shortest day in the north. Everything after this gets lighter.',
}

const PHASE_TITLE: Record<Phase, string> = {
  new: 'New moon', first: 'First quarter', full: 'Full moon', last: 'Last quarter',
}

const solarNote: Record<SolarKind, string> = {
  total: 'The Moon covers the Sun completely. Somewhere on Earth it goes dark in the daytime.',
  annular: 'The Moon is too far away to cover the Sun, and leaves a ring of it showing.',
  hybrid: 'Total from some places along the track and annular from others — the rarest kind.',
  partial: 'A bite out of the Sun. Nowhere on Earth sees it covered.',
}

const lunarNote: Record<LunarKind, string> = {
  total: 'The Moon passes entirely into the Earth’s shadow and turns red — sunsets, refracted round the edge of the world.',
  partial: 'Part of the Moon enters the Earth’s shadow. The edge of the shadow is visibly curved.',
  penumbral: 'The Moon passes through the soft outer shadow only. A slight greying, easy to miss.',
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/**
 * Everything happening in the sky between two instants, in order.
 *
 * Built by walking the lunations and years that overlap the window rather than
 * by searching, because every series here is indexed by an integer that is a
 * direct function of the date — the position in the queue is arithmetic, and
 * the only thing that needs computing is the answer.
 */
export function forecast(from: Date, to: Date): SkyEvent[] {
  const out: SkyEvent[] = []
  const push = (e: SkyEvent) => {
    if (e.when >= from && e.when <= to) out.push(e)
  }

  const k0 = lunationNear(from) - 2
  const k1 = lunationNear(to) + 2

  for (let k = k0; k <= k1; k++) {
    for (const phase of ['new', 'first', 'full', 'last'] as Phase[]) {
      const when = tdToUtc(phaseJde(k, phase))
      push({
        kind: 'phase',
        title: PHASE_TITLE[phase],
        detail: phase === 'full'
          ? 'The Moon is opposite the Sun and lit all the way across.'
          : phase === 'new'
            ? 'The Moon is between us and the Sun, and invisible. The darkest skies of the month.'
            : 'Half lit. The best night for looking at craters, because the shadows are long.',
        when,
        timed: true,
        rank: phase === 'full' || phase === 'new' ? 1 : 0,
        phase,
      })
    }

    for (const kind of ['solar', 'lunar'] as const) {
      const e = eclipseAt(k, kind)
      if (!e) continue
      const type = e.type as SolarKind & LunarKind
      push({
        kind: 'eclipse',
        title: `${cap(e.type)} ${kind} eclipse`,
        detail: kind === 'solar' ? solarNote[e.type as SolarKind] : lunarNote[e.type as LunarKind],
        when: tdToUtc(e.jde),
        timed: true,
        rank: type === 'total' ? 3 : 2,
        eclipse: e,
      })
    }
  }

  for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
    for (const s of ['march', 'june', 'september', 'december'] as Season[]) {
      push({
        kind: 'season',
        title: SEASON_TITLE[s],
        detail: SEASON_NOTE[s],
        when: tdToUtc(seasonJde(y, s)),
        timed: true,
        rank: 1,
        season: s,
      })
    }
    for (const a of ['perihelion', 'aphelion'] as const) {
      push({
        kind: 'apsis',
        title: a === 'perihelion' ? 'Earth closest to the Sun' : 'Earth furthest from the Sun',
        detail: a === 'perihelion'
          ? 'Perihelion. Five million kilometres nearer than in July, in the middle of the northern winter, which is the whole answer to why seasons are not about distance.'
          : 'Aphelion. The Earth is at its slowest here, which is why northern summers are a few days longer than southern ones.',
        when: tdToUtc(apsisJde(y, a)),
        timed: true,
        rank: 1,
        apsis: a,
      })
    }
    for (const sh of SHOWERS) {
      push({
        kind: 'shower',
        title: `${sh.name} peak`,
        detail: `${sh.note} Up to ${sh.zhr} an hour under a dark sky, from ${sh.parent}.`,
        when: new Date(Date.UTC(y, sh.peak[0] - 1, sh.peak[1], 12)),
        timed: false,
        rank: sh.zhr >= 100 ? 2 : 1,
        shower: sh,
      })
    }
  }

  out.sort((a, b) => +a.when - +b.when)
  return out
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

export function formatWhen(d: Date, timed: boolean): string {
  const day = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  if (!timed) return `the night of ${day}`
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${day}, ${hh}:${mm} UTC`
}

/** "in 3 days", "in 4 hours", "in 11 minutes" — the countdown, in words. */
export function countdown(from: Date, to: Date): string {
  const ms = +to - +from
  if (ms < 0) return 'now'
  const mins = Math.round(ms / 60000)
  if (mins < 1) return 'any minute'
  if (mins < 60) return `in ${mins} minute${mins === 1 ? '' : 's'}`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  if (days < 90) return `in ${days} days`
  const months = Math.round(days / 30.44)
  if (months < 24) return `in ${months} months`
  return `in ${(days / 365.25).toFixed(1)} years`
}

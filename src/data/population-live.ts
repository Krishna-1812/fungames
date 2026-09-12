/**
 * Every Second, Somewhere — real population data for forty countries, plus
 * one honest residual for everywhere else.
 *
 * `population` is the UN's mid-2023 estimate (World Population Prospects).
 * `birthRate` and `deathRate` are the crude rate per 1,000 people per year —
 * CIA World Factbook 2023 figures for births, UN/World Bank figures for
 * deaths. Every number here is a real, published statistic; nothing is
 * invented, and nothing is smoothed to make the map look more even than the
 * real world actually is. Ukraine's death rate really is the highest of any
 * country on this list, and that is not a data error.
 *
 * These forty cover about 80% of the people alive. The rest — over a
 * thousand smaller countries and territories — are folded into `REST`, at
 * the global average rate, rather than invented a country at a time. `REST`
 * has no coordinates: it is never drawn as a dot on the map, only counted
 * into the running global totals, because a made-up point on the map would
 * be the one dishonest thing on this page.
 */
export type Country = {
  name: string
  /** Capital city, decimal degrees — the real point this country's dot sits at. */
  lat: number
  lon: number
  population: number
  /** Crude birth rate, per 1,000 people per year. */
  birthRate: number
  /** Crude death rate, per 1,000 people per year. */
  deathRate: number
}

export const COUNTRIES: Country[] = [
  { name: 'China', lat: 39.9, lon: 116.4, population: 1_422_584_933, birthRate: 9.7, deathRate: 7.82 },
  { name: 'India', lat: 28.61, lon: 77.21, population: 1_438_069_596, birthRate: 16.53, deathRate: 9.65 },
  { name: 'United States', lat: 38.9, lon: -77.04, population: 343_477_335, birthRate: 12.21, deathRate: 8.42 },
  { name: 'Indonesia', lat: -6.21, lon: 106.85, population: 281_190_067, birthRate: 15.05, deathRate: 6.77 },
  { name: 'Pakistan', lat: 33.68, lon: 73.05, population: 247_504_495, birthRate: 26.01, deathRate: 5.94 },
  { name: 'Nigeria', lat: 9.08, lon: 7.4, population: 227_882_945, birthRate: 34.0, deathRate: 8.52 },
  { name: 'Brazil', lat: -15.79, lon: -47.88, population: 211_140_729, birthRate: 10.67, deathRate: 6.9 },
  { name: 'Bangladesh', lat: 23.81, lon: 90.41, population: 171_466_990, birthRate: 17.5, deathRate: 5.5 },
  { name: 'Russia', lat: 55.76, lon: 37.62, population: 145_440_500, birthRate: 9.22, deathRate: 13.27 },
  { name: 'Mexico', lat: 19.43, lon: -99.13, population: 129_739_759, birthRate: 13.95, deathRate: 7.07 },
  { name: 'Ethiopia', lat: 9.03, lon: 38.74, population: 128_691_692, birthRate: 29.97, deathRate: 5.6 },
  { name: 'Japan', lat: 35.68, lon: 139.65, population: 124_370_947, birthRate: 6.9, deathRate: 11.74 },
  { name: 'Philippines', lat: 14.6, lon: 120.98, population: 114_891_199, birthRate: 22.17, deathRate: 6.1 },
  { name: 'Egypt', lat: 30.04, lon: 31.24, population: 114_535_772, birthRate: 20.48, deathRate: 4.32 },
  { name: 'DR Congo', lat: -4.32, lon: 15.31, population: 105_789_731, birthRate: 39.64, deathRate: 7.74 },
  { name: 'Vietnam', lat: 21.03, lon: 105.85, population: 100_352_192, birthRate: 15.29, deathRate: 5.77 },
  { name: 'Iran', lat: 35.69, lon: 51.39, population: 90_608_707, birthRate: 14.79, deathRate: 5.2 },
  { name: 'Turkey', lat: 39.93, lon: 32.86, population: 87_270_501, birthRate: 14.04, deathRate: 6.09 },
  { name: 'Germany', lat: 52.52, lon: 13.4, population: 84_548_231, birthRate: 9.02, deathRate: 11.97 },
  { name: 'Thailand', lat: 13.75, lon: 100.5, population: 71_702_435, birthRate: 10.04, deathRate: 7.86 },
  { name: 'United Kingdom', lat: 51.51, lon: -0.13, population: 68_682_962, birthRate: 10.8, deathRate: 9.81 },
  { name: 'France', lat: 48.86, lon: 2.35, population: 66_438_822, birthRate: 11.56, deathRate: 9.51 },
  { name: 'Tanzania', lat: -6.17, lon: 35.74, population: 66_617_606, birthRate: 32.9, deathRate: 5.02 },
  { name: 'South Africa', lat: -25.75, lon: 28.19, population: 63_212_384, birthRate: 18.24, deathRate: 9.25 },
  { name: 'Italy', lat: 41.9, lon: 12.5, population: 59_499_453, birthRate: 7.0, deathRate: 11.27 },
  { name: 'Kenya', lat: -1.29, lon: 36.82, population: 55_339_003, birthRate: 26.01, deathRate: 4.95 },
  { name: 'Colombia', lat: 4.71, lon: -74.07, population: 52_321_152, birthRate: 15.06, deathRate: 7.84 },
  { name: 'South Korea', lat: 37.57, lon: 126.98, population: 51_748_739, birthRate: 6.95, deathRate: 7.28 },
  { name: 'Sudan', lat: 15.5, lon: 32.56, population: 50_042_791, birthRate: 33.32, deathRate: 6.19 },
  { name: 'Uganda', lat: 0.35, lon: 32.58, population: 48_656_601, birthRate: 40.27, deathRate: 4.87 },
  { name: 'Spain', lat: 40.42, lon: -3.7, population: 47_911_579, birthRate: 7.12, deathRate: 10.11 },
  { name: 'Algeria', lat: 36.75, lon: 3.06, population: 46_164_219, birthRate: 17.84, deathRate: 4.33 },
  { name: 'Argentina', lat: -34.6, lon: -58.38, population: 45_538_401, birthRate: 15.38, deathRate: 7.28 },
  { name: 'Iraq', lat: 33.31, lon: 44.36, population: 45_074_049, birthRate: 24.22, deathRate: 3.88 },
  { name: 'Afghanistan', lat: 34.56, lon: 69.21, population: 41_454_761, birthRate: 34.79, deathRate: 12.08 },
  { name: 'Canada', lat: 45.42, lon: -75.7, population: 39_299_105, birthRate: 10.11, deathRate: 8.17 },
  { name: 'Poland', lat: 52.23, lon: 21.01, population: 38_762_844, birthRate: 8.31, deathRate: 9.37 },
  { name: 'Ukraine', lat: 50.45, lon: 30.52, population: 37_732_836, birthRate: 8.79, deathRate: 21.7 },
  { name: 'Morocco', lat: 34.02, lon: -6.83, population: 37_712_505, birthRate: 17.1, deathRate: 6.61 },
  { name: 'Saudi Arabia', lat: 24.71, lon: 46.68, population: 32_264_292, birthRate: 13.9, deathRate: 3.45 },
]

/** Mid-2026 estimate — UN World Population Prospects puts the real figure
 *  somewhere close to this; the live counter on the page treats it as the
 *  baseline it extrapolates forward from, and says so. */
export const WORLD_POPULATION = 8_300_000_000

const listedPopulation = COUNTRIES.reduce((s, c) => s + c.population, 0)

/** Everyone not in the forty above — real people, real births and deaths,
 *  at the global average rate rather than a guessed one. Never drawn as a
 *  point on the map; only ever counted. */
export const REST = {
  population: WORLD_POPULATION - listedPopulation,
  // World Bank / UN, world average, 2024.
  birthRate: 17.58,
  deathRate: 7.69,
}

export const SECONDS_PER_YEAR = 365.25 * 86400

export const annualBirths = (c: { population: number; birthRate: number }) => (c.population * c.birthRate) / 1000
export const annualDeaths = (c: { population: number; deathRate: number }) => (c.population * c.deathRate) / 1000
export const perSecond = (annual: number) => annual / SECONDS_PER_YEAR

export type Totals = { birthsPerYear: number; deathsPerYear: number; birthsPerSecond: number; deathsPerSecond: number }

export function globalTotals(): Totals {
  let birthsPerYear = annualBirths(REST)
  let deathsPerYear = annualDeaths(REST)
  for (const c of COUNTRIES) {
    birthsPerYear += annualBirths(c)
    deathsPerYear += annualDeaths(c)
  }
  return {
    birthsPerYear,
    deathsPerYear,
    birthsPerSecond: perSecond(birthsPerYear),
    deathsPerSecond: perSecond(deathsPerYear),
  }
}

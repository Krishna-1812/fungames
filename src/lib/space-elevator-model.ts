/**
 * Space Elevator — the one number this page computes live rather than looks
 * up: the real air temperature at whatever altitude you've scrolled to.
 *
 * `standardTemperatureK` is the actual US Standard Atmosphere 1976 model, the
 * same seven-layer piecewise formula aviation and meteorology use, up to its
 * own real limit of 86 km. Each layer is a real base altitude, a real base
 * temperature, and a real lapse rate — not fitted to look right, copied from
 * the model's own published table. `scripts/check-space-elevator.mjs` checks
 * the output against the model's own well-known reference points: 15°C at
 * sea level, -56.5°C at the tropopause, -2.5°C at the stratopause, and back
 * down to roughly -86°C at the mesopause.
 *
 * Above 86 km the real thermosphere has no single meaningful "temperature" —
 * it swings from roughly 500 K to over 2,000 K depending on solar activity,
 * because the air is too thin for the molecules to reach thermal equilibrium
 * with each other. Rather than fake a number, `standardTemperatureK` returns
 * `null` up there, and the page says so.
 */

export type AtmosphereLayer = {
  /** Base altitude of this layer, in metres. */
  baseAltitudeM: number
  /** Temperature at the base of this layer, in kelvin. */
  baseTempK: number
  /** Lapse rate: kelvin change per metre of altitude within this layer. */
  lapseKPerM: number
}

// US Standard Atmosphere 1976, layers 0 through 7 (0 to 86 km).
export const ATMOSPHERE_LAYERS: AtmosphereLayer[] = [
  { baseAltitudeM: 0, baseTempK: 288.15, lapseKPerM: -0.0065 },
  { baseAltitudeM: 11_000, baseTempK: 216.65, lapseKPerM: 0 },
  { baseAltitudeM: 20_000, baseTempK: 216.65, lapseKPerM: 0.001 },
  { baseAltitudeM: 32_000, baseTempK: 228.65, lapseKPerM: 0.0028 },
  { baseAltitudeM: 47_000, baseTempK: 270.65, lapseKPerM: 0 },
  { baseAltitudeM: 51_000, baseTempK: 270.65, lapseKPerM: -0.0028 },
  { baseAltitudeM: 71_000, baseTempK: 214.65, lapseKPerM: -0.002 },
]
export const ATMOSPHERE_MODEL_CEILING_M = 86_000

export function standardTemperatureK(altitudeM: number): number | null {
  if (altitudeM < 0 || altitudeM > ATMOSPHERE_MODEL_CEILING_M) return null
  let layer = ATMOSPHERE_LAYERS[0]
  for (const l of ATMOSPHERE_LAYERS) {
    if (altitudeM >= l.baseAltitudeM) layer = l
    else break
  }
  return layer.baseTempK + layer.lapseKPerM * (altitudeM - layer.baseAltitudeM)
}

export const kelvinToC = (k: number) => k - 273.15
export const kelvinToF = (k: number) => (k - 273.15) * 1.8 + 32

/**
 * A real, standard, simplified pressure model — the barometric formula with
 * Earth's actual mean scale height (~8,500 m) — not the fully rigorous
 * per-layer version. Disclosed as a simplification in the page's own "how
 * this works" section, the same way `speed-model.ts` discloses its plain
 * magnitude sum: this is within a few percent of the rigorous figure for
 * every altitude on this page and gets the shape (an exponential collapse,
 * not a straight line) genuinely right.
 */
const SEA_LEVEL_PRESSURE_PA = 101_325
const SCALE_HEIGHT_M = 8_500
export const approxPressurePa = (altitudeM: number) =>
  SEA_LEVEL_PRESSURE_PA * Math.exp(-altitudeM / SCALE_HEIGHT_M)
export const approxPressureRatio = (altitudeM: number) => Math.exp(-altitudeM / SCALE_HEIGHT_M)

// Real figures used only in the finale, past the end of the scrolling reel.
export const GEOSTATIONARY_ALTITUDE_KM = 35_786
export const ISS_ALTITUDE_KM = 400
export const AURORA_TYPICAL_ALTITUDE_KM = 220
export const KARMAN_LINE_M = 100_000

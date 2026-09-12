/**
 * How Fast Are You Moving? — every speed here is a real, published figure
 * (or, for Earth's own rotation, a real formula run on your real latitude),
 * not an invented one. Seven motions stack, each one a real frame of
 * reference nested inside the last: the ground under your feet drifting on
 * its tectonic plate, the planet turning under you, the planet's orbit
 * around the Sun, the Sun's own drift against its neighbouring stars, the
 * Sun's orbit around the galaxy's centre, the whole galaxy falling toward
 * Andromeda, and the Local Group's motion against the cosmic microwave
 * background — the closest thing cosmology has to a shared rest frame.
 *
 * The combination is a plain sum of magnitudes, the same way most popular
 * explanations of this present it — not a true instantaneous vector sum,
 * which would require this moment's exact direction of all seven motions
 * and would change from second to second in a way nobody could see
 * reflected in a number anyway. `scripts/check-speed-model.mjs` checks the
 * one thing that matters about that simplification: it is applied
 * consistently and disclosed, not hidden.
 */

/** WGS84 equatorial radius, km. */
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.137
/** The sidereal day — one true rotation of the Earth, not the 24h solar day. */
export const SIDEREAL_DAY_SECONDS = 86164.0905

/** Real, cited magnitudes. Every one of these is the speed a stage moves at
 *  — km/s except tectonic drift, which is cm/year (it needs its own unit;
 *  nothing here moves slowly enough otherwise to need one). */
export const EARTH_ORBIT_KM_S = 29.78
export const SOLAR_APEX_KM_S = 19.7
export const GALACTIC_ORBIT_KM_S = 220
export const ANDROMEDA_APPROACH_KM_S = 110
export const CMB_DIPOLE_KM_S = 627
export const TECTONIC_CM_PER_YEAR = 2.3

export const SPEED_OF_LIGHT_KM_S = 299_792.458
export const HUBBLE_PLANCK_KM_S_MPC = 67.4
export const HUBBLE_SH0ES_KM_S_MPC = 73.0
export const OBSERVABLE_UNIVERSE_RADIUS_GLY = 46.5
/** Gigalight-years to megaparsecs — 1 Mpc = 3.2616 million ly. */
const GLY_TO_MPC = 1000 / 3.2616

export const SOURCES = {
  tectonic:
    'Tectonic plates move at a few centimetres a year — the U.S. Geological Survey cites rates from about 2 to 15 cm/year across different plates. This uses 2.3 cm/year, the commonly cited rate for the North American Plate.',
  rotation:
    "Computed directly from your latitude, the Earth's real equatorial radius (6,378.137 km, WGS84) and its real sidereal day (23h 56m 4.09s — one true rotation, not the 24-hour solar day) — not looked up.",
  orbit: "Earth's mean orbital speed around the Sun: 29.78 km/s (a standard, precisely measured constant).",
  apex:
    'The Sun moves at about 19.7 km/s relative to the average of nearby stars, toward the "solar apex" in Hercules, near Vega — Wikipedia, "Solar apex"; some modern re-analyses (Hipparcos-based) give a smaller ~13–14 km/s.',
  galactic:
    "The Sun orbits the galactic centre at roughly 220 km/s, the long-standing IAU-recommended value for the Local Standard of Rest; some newer measurements put it closer to 230–240 km/s.",
  andromeda:
    'The Milky Way and Andromeda are closing at about 110 km/s, measured from Andromeda’s real proper motion across ten years of Hubble Space Telescope images — van der Marel et al., "The M31 Velocity Vector" (Astrophysical Journal, 2012).',
  cmb:
    "The Local Group moves at 627 ± 22 km/s relative to the cosmic microwave background's rest frame, toward the Hydra-Centaurus supercluster — measured from the CMB's own dipole anisotropy (COBE, WMAP and Planck all agree).",
  hubble:
    "H₀, the Hubble constant, is measured two different ways that still disagree: about 67.4 km/s/Mpc from the cosmic microwave background (Planck, 2018) and about 73.0 km/s/Mpc from nearby supernovae (SH0ES) — the unresolved \"Hubble tension.\" Multiplied across the ~46.5-billion-light-year radius of the observable universe, either figure gives a recession speed many times the speed of light — not a violation of relativity, since nothing is moving *through* space faster than light; space itself is doing the expanding.",
}

export function earthRotationSpeedKmS(latitudeDeg: number): number {
  const clampedLat = Math.max(-90, Math.min(90, latitudeDeg))
  const circumferenceAtLat = 2 * Math.PI * EARTH_EQUATORIAL_RADIUS_KM * Math.cos((clampedLat * Math.PI) / 180)
  return circumferenceAtLat / SIDEREAL_DAY_SECONDS
}

export type Stage = { key: string; label: string; kmPerSec: number; source: string }

/** The seven stages, in the order they stack — each one's speed is real,
 *  and every one after the first is a speed *on top of* the ones before it,
 *  the same nested-frames structure the real motions actually have. */
export function buildStages(latitudeDeg: number): Stage[] {
  return [
    { key: 'tectonic', label: 'The ground beneath you, drifting on its tectonic plate', kmPerSec: (TECTONIC_CM_PER_YEAR / 100 / 1000) / (365.25 * 86400), source: SOURCES.tectonic },
    { key: 'rotation', label: "The Earth, turning beneath your feet", kmPerSec: earthRotationSpeedKmS(latitudeDeg), source: SOURCES.rotation },
    { key: 'orbit', label: 'The Earth, orbiting the Sun', kmPerSec: EARTH_ORBIT_KM_S, source: SOURCES.orbit },
    { key: 'apex', label: 'The Sun, drifting against its neighbouring stars', kmPerSec: SOLAR_APEX_KM_S, source: SOURCES.apex },
    { key: 'galactic', label: 'The Sun, orbiting the centre of the galaxy', kmPerSec: GALACTIC_ORBIT_KM_S, source: SOURCES.galactic },
    { key: 'andromeda', label: 'The Milky Way, falling toward Andromeda', kmPerSec: ANDROMEDA_APPROACH_KM_S, source: SOURCES.andromeda },
    { key: 'cmb', label: 'The Local Group, against the afterglow of the Big Bang', kmPerSec: CMB_DIPOLE_KM_S, source: SOURCES.cmb },
  ]
}

/** Plain sum of magnitudes for however many stages have been revealed so
 *  far, times however many seconds have really elapsed. Disclosed as a
 *  simplification in SOURCES/the page itself, not hidden. */
export function cumulativeDistanceKm(stages: Stage[], activeCount: number, elapsedSeconds: number): number {
  const n = Math.max(0, Math.min(activeCount, stages.length))
  let speed = 0
  for (let i = 0; i < n; i++) speed += stages[i].kmPerSec
  return speed * Math.max(0, elapsedSeconds)
}

/** The recession speed of the edge of the observable universe, in units of
 *  c — real, and genuinely faster than light, because it is metric
 *  expansion rather than motion through space. */
export function horizonRecessionSpeedC(hubbleKmSPerMpc: number): number {
  const distanceMpc = OBSERVABLE_UNIVERSE_RADIUS_GLY * GLY_TO_MPC
  const speedKmS = hubbleKmSPerMpc * distanceMpc
  return speedKmS / SPEED_OF_LIGHT_KM_S
}

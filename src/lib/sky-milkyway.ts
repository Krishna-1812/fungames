/**
 * The Milky Way, for Constellation Draw's sky.
 *
 * The catalogue stops at magnitude 6.5, which is every star an eye can pick
 * out one at a time. What it cannot hold is the light of the hundred billion
 * it cannot pick out, and under a dark sky that is the most obvious thing
 * there is: a band right round the sky, brightest and widest toward the
 * middle of the galaxy in Sagittarius, faintest opposite it in Auriga, split
 * down its length from Cygnus to Centaurus by a lane of dust.
 *
 * This is that band, as a function of where you look. It is a model, not a
 * photograph: the band is put where the galaxy's plane really is (the
 * standard conversion from the sky's coordinates to the galaxy's), given
 * its real overall shape, and the mottling on it is invented. The two
 * Magellanic Clouds are at their real places.
 *
 * No imports, so the node check reads it as it is.
 */

const D2R = Math.PI / 180

// The galaxy's north pole and the direction of its centre, in the sky's own coordinates (J2000).
const POLE_RA = 192.85948 * D2R
const POLE_DEC = 27.12825 * D2R
const L_NCP = 122.93192 * D2R

/** Sky coordinates (degrees) to galactic longitude and latitude (degrees; longitude -180..180, 0 toward the centre). */
export function toGalactic(raDeg: number, decDeg: number): { l: number; b: number } {
  const ra = raDeg * D2R, dec = decDeg * D2R
  const sinB = Math.sin(dec) * Math.sin(POLE_DEC) + Math.cos(dec) * Math.cos(POLE_DEC) * Math.cos(ra - POLE_RA)
  const b = Math.asin(Math.max(-1, Math.min(1, sinB)))
  const y = Math.cos(dec) * Math.sin(ra - POLE_RA)
  const x = Math.sin(dec) * Math.cos(POLE_DEC) - Math.cos(dec) * Math.sin(POLE_DEC) * Math.cos(ra - POLE_RA)
  let l = (L_NCP - Math.atan2(y, x)) / D2R
  l = ((l + 180) % 360 + 360) % 360 - 180
  return { l, b: b / D2R }
}

// Smooth noise on a plane, the same every time.
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x: number, y: number) => noise(x, y) * 0.55 + noise(x * 2.1 + 5, y * 2.1 + 9) * 0.3 + noise(x * 4.3 + 11, y * 4.3 + 3) * 0.15

const blob = (ra: number, dec: number, ra0: number, dec0: number, size: number) => {
  const dra = (ra - ra0) * Math.cos(dec0 * D2R)
  const d2 = dra * dra + (dec - dec0) * (dec - dec0)
  return Math.exp(-d2 / (size * size))
}

/**
 * How bright the unresolved sky is in a direction, 0..1, and how warm
 * (0 blue-white, 1 the yellower light of the old stars round the centre).
 */
export function milkyWay(raDeg: number, decDeg: number): { glow: number; warm: number } {
  const { l, b } = toGalactic(raDeg, decDeg)
  const toCentre = Math.cos(l * D2R)                        // 1 toward the centre, -1 away
  const central = Math.exp(-(l * l) / (38 * 38))            // the bulge
  // Wider toward the centre, and brighter.
  const width = 7.5 + 7 * central
  const strength = 0.42 + 0.22 * toCentre + 0.55 * central
  let band = Math.exp(-(b * b) / (width * width)) * strength
  // A thin bright spine with a broad faint skirt, which is how it looks.
  band += Math.exp(-(b * b) / (26 * 26)) * 0.10 * (0.6 + 0.4 * toCentre)
  // Mottling: clouds of stars along it.
  band *= 0.62 + 0.76 * fbm(l / 9, b / 4.5)
  // The Great Rift: dust down the middle, from Cygnus round through the centre to Centaurus.
  if (l > -55 && l < 85) {
    const edge = Math.min(1, (l + 55) / 20, (85 - l) / 20)
    const lane = b - (1.5 + 3.5 * (fbm(l / 14 + 7, 0.5) - 0.5))
    band *= 1 - 0.62 * edge * Math.exp(-(lane * lane) / (2.2 * 2.2)) * (0.5 + 0.9 * noise(l / 5, 3))
  }
  // The two small galaxies that go round ours.
  const clouds = blob(raDeg, decDeg, 80.9, -69.8, 3.4) * 0.55 + blob(raDeg, decDeg, 13.2, -72.8, 1.7) * 0.45
  return { glow: Math.max(0, Math.min(1, band + clouds)), warm: Math.min(1, central * Math.exp(-(b * b) / (14 * 14)) * 1.2) }
}

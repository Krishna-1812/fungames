/**
 * The things Scale draws, and how big they really are.
 *
 * Lifted out of the page so `scripts/check-scale-art.mjs` can read the same
 * list the page renders. `m` is the object's real size in metres along the
 * dimension the entry is quoted by — usually a diameter, sometimes a height
 * (a tower is not quoted by its width), and `lib/scale-art.ts` is where that
 * gets said out loud for the objects that have a drawing.
 */

/**
 * `kind` decides how a thing is drawn. Several entries are not objects at all:
 *  - the orbits and the "distance to X" entries are radii, so a ring is
 *    literally the correct shape and a filled ball was misleading;
 *  - a galaxy is a flat spiral seen at a tilt, not a ball;
 *  - nebulae, clusters and an electron cloud have no surface to shade;
 *  - a wavelength is a wave.
 *
 * Everything left over used to be a lit sphere, which is honest for a planet
 * and a lie for a whale. Those now carry a drawing instead — see `scale-art`,
 * and `KINDS` below for which is which.
 */
export type Kind = 'sphere' | 'ring' | 'disc' | 'cloud' | 'wave'
export type Thing = { m: number; name: string; note?: string; color: string; kind?: Kind }

// `m` is the object's real size in metres (see the header on which dimension).
export const THINGS: Thing[] = [
  { m: 1.7e-15, name: 'Proton', note: 'A single one, at the centre of a hydrogen atom.', color: '#ff6b8a' },
  { m: 5.0e-15, name: 'Carbon nucleus', color: '#ff8f6b' },
  { m: 1.5e-14, name: 'Uranium nucleus', note: 'The heaviest nucleus that occurs naturally.', color: '#ffb36b' },
  { m: 1.0e-12, name: 'Wavelength of a gamma ray', kind: 'wave', color: '#c6ff6b' },
  { m: 1.0e-11, name: 'Wavelength of an X-ray', kind: 'wave', color: '#8affe0' },
  { m: 1.0e-10, name: 'Hydrogen atom', kind: 'cloud', note: 'Almost all of it is empty space.', color: '#7ec8ff' },
  { m: 2.8e-10, name: 'Water molecule', color: '#6bb7ff' },
  { m: 1.0e-9, name: 'Buckyball', note: 'Sixty carbon atoms in a football.', color: '#9d8bff' },
  { m: 2.0e-9, name: 'DNA, across the helix', color: '#8affc4' },
  { m: 9.0e-8, name: 'Influenza virus', color: '#c58aff' },
  { m: 7.0e-7, name: 'Wavelength of red light', kind: 'wave', note: 'Anything smaller than this cannot be seen with light.', color: '#ff5f5f' },
  { m: 2.0e-6, name: 'E. coli', color: '#a4e05a' },
  { m: 8.0e-6, name: 'Red blood cell', color: '#ff4d5e' },
  { m: 7.0e-5, name: 'Human hair, across', color: '#c9a06b' },
  { m: 5.0e-4, name: 'Grain of sand', color: '#e8c88a' },
  { m: 5.0e-3, name: 'Ant', color: '#8c5a3c' },
  { m: 2.45e-2, name: 'A coin', color: '#d8d2c0' },
  { m: 1.7, name: 'A person', note: 'You are here. Roughly the geometric middle of everything.', color: '#ffd08a' },
  { m: 4.5, name: 'A car', color: '#7fb2ff' },
  { m: 30, name: 'Blue whale', note: 'The largest animal that has ever lived.', color: '#2f6285' },
  { m: 105, name: 'Football pitch', color: '#5fbf72' },
  { m: 330, name: 'Eiffel Tower', color: '#b0a99a' },
  { m: 828, name: 'Burj Khalifa', color: '#cfd6de' },
  { m: 8849, name: 'Mount Everest', color: '#e6eef5' },
  { m: 21000, name: 'Manhattan', color: '#b5ac9b' },
  { m: 446000, name: 'The Grand Canyon', note: 'End to end.', color: '#c47a4a' },
  { m: 3.474e6, name: 'The Moon', color: '#c8c4bb' },
  { m: 1.2742e7, name: 'Earth', note: 'Everything that has ever happened to anyone.', color: '#4d90d9' },
  { m: 1.3982e8, name: 'Jupiter', color: '#d9a06b' },
  { m: 1.392e9, name: 'The Sun', note: 'You could fit 1.3 million Earths inside it.', color: '#ffcc33' },
  { m: 2.99e11, name: "Earth's orbit", kind: 'ring', color: '#7ec8ff' },
  { m: 9.0e12, name: "Neptune's orbit", kind: 'ring', note: 'The edge of the planets.', color: '#5f7fd4' },
  { m: 2.4e13, name: "Voyager 1's distance", kind: 'ring', note: 'Launched in 1977 and still going.', color: '#9fb4ff' },
  { m: 7.8e14, name: 'One light month', kind: 'ring', color: '#8f9fe8' },
  { m: 9.461e15, name: 'One light year', kind: 'ring', color: '#a98aff' },
  { m: 4.014e16, name: 'To Proxima Centauri', kind: 'ring', note: 'The nearest star. Four years at the speed of light.', color: '#ff8ac4' },
  { m: 2.4e17, name: 'The Orion Nebula', kind: 'cloud', color: '#ff6bb0' },
  { m: 1.5e18, name: 'A globular cluster', kind: 'cloud', note: 'A million stars packed into a ball.', color: '#ffd28a' },
  { m: 2.47e20, name: 'To the centre of the galaxy', kind: 'ring', color: '#b58aff' },
  { m: 9.5e20, name: 'The Milky Way', kind: 'disc', note: 'A hundred billion stars, and this is one galaxy.', color: '#cbb6ff' },
  { m: 9.5e22, name: 'The Local Group', kind: 'cloud', color: '#8ad4ff' },
  { m: 5.0e24, name: 'Laniakea Supercluster', kind: 'cloud', note: 'Our galaxy is a speck inside this.', color: '#7affd8' },
  { m: 8.8e26, name: 'The observable universe', kind: 'cloud', note: 'That is everything. There is no more scrolling.', color: '#ffffff' },
]

/** The numeric codes the shader takes; kept next to the type they encode. */
export const KIND_CODE: Record<Kind, number> = { sphere: 0, ring: 1, disc: 2, cloud: 3, wave: 4 }

/* ---- the sky -----------------------------------------------------------

   Keyed to the exponent, so the journey reads as a sequence of worlds rather
   than one long gradient. Lifted out with THINGS because it is the background
   every drawing has to stay visible against, and `check-scale-art.mjs` cannot
   measure that without it.

   The WebGL layer paints over this when it comes up. The palettes are the
   same family by construction — the shader is fed these same regimes — but
   the checker measures this one, which is the documented fallback and the
   only version that exists without a GPU. */
export const SKY_STOPS: [number, number[], number[]][] = [
  [-15, [16, 8, 26], [46, 14, 48]],
  [-9, [10, 22, 52], [16, 52, 82]],
  [-6, [8, 38, 44], [16, 70, 66]],
  [-3, [30, 44, 26], [72, 92, 54]],
  [0, [96, 138, 176], [186, 214, 232]],
  [4, [58, 96, 140], [122, 168, 206]],
  [7, [10, 22, 48], [30, 58, 102]],
  [12, [6, 10, 30], [22, 20, 66]],
  [18, [10, 4, 26], [46, 18, 74]],
  [24, [2, 2, 8], [14, 10, 34]],
]

/** The gradient's top and bottom colour at a given exponent. */
export function skyAt(exp: number): { top: number[]; bot: number[] } {
  let a = SKY_STOPS[0]
  let b = SKY_STOPS[SKY_STOPS.length - 1]
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (exp >= SKY_STOPS[i][0] && exp <= SKY_STOPS[i + 1][0]) {
      a = SKY_STOPS[i]
      b = SKY_STOPS[i + 1]
      break
    }
    if (exp > SKY_STOPS[SKY_STOPS.length - 1][0]) a = b = SKY_STOPS[SKY_STOPS.length - 1]
  }
  const span = b[0] - a[0] || 1
  const t = Math.min(1, Math.max(0, (exp - a[0]) / span))
  const mix = (p: number[], q: number[]) => p.map((v, i) => Math.round(v + (q[i] - v) * t))
  return { top: mix(a[1], b[1]), bot: mix(a[2], b[2]) }
}

/** The screen-width exponent at which a thing is 40% of the viewport — the
 *  moment it is the subject rather than a speck or a wall. */
export const primeExp = (longestMetres: number) => Math.log10(longestMetres / 0.4)

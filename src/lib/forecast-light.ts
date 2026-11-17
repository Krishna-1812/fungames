/**
 * The light in Universe Forecast's eclipses: the parts that are sums, done
 * once a frame here and not once a pixel in the shader.
 *
 * Three things, each the same for every pixel of a frame:
 *
 *   how much of the Sun is left   A solar eclipse is exposed for whatever
 *       photosphere is still showing, and the glare comes from wherever it
 *       is showing. That is a walk round the Sun's edge asking how far each
 *       point is outside the Moon's, whose own edge is not a circle.
 *   how bright the Moon is        A lunar eclipse is exposed for the
 *       brightest part of the Moon, which is a few samples of the light in
 *       the Earth's shadow across it.
 *   the light in that shadow      Not a gradient somebody chose: outside the
 *       umbra it is the fraction of the Sun's disc still showing past the
 *       Earth, and inside it is sunset bent round the Earth.
 *
 * The shader needs the Moon's edge and the shadow's light too, pixel by
 * pixel, so the GLSL for those is written out of the same constants here:
 * there is one copy of every number.
 *
 * No imports, so the node check reads it as it is.
 */

const g = (n: number, places = 4) => { const s = n.toFixed(places); return s.includes('.') ? s : s + '.0' }
const g3 = (v: number[]) => `vec3(${v.map((x) => g(x, 3)).join(', ')})`

/* -------------------------------------------------------------------------- */
/* The Moon's edge                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Mountains and valleys on the Moon's limb: [height as a fraction of its
 * radius, how many to a turn, where they start]. About a part in a thousand,
 * which is five kilometres in 1,737 and is what breaks the last sliver of
 * Sun into beads. Their real places are not modelled.
 */
export const LIMB: [number, number, number][] = [
  [0.0011, 23, 1.3], [0.0008, 41, 4.1], [0.0006, 67, 2.2], [0.0004, 113, 5.7],
]

/** The Moon's radius toward an angle, for a mean radius `rm`. */
export function moonLimb(th: number, rm: number): number {
  let k = 1
  for (const [a, n, p] of LIMB) k += a * Math.sin(th * n + p)
  return rm * k
}

export const LIMB_GLSL = `
// The Moon's edge is not a circle: mountains and valleys, a part in a thousand.
float moonLimb(float th, float rm) {
  return rm * (1.0 + ${LIMB.map(([a, n, p]) => `${g(a)} * sin(th * ${g(n, 1)} + ${g(p, 1)})`).join(' + ')});
}
`

/* -------------------------------------------------------------------------- */
/* What is left of the Sun                                                     */
/* -------------------------------------------------------------------------- */

/** How many places the shader spreads glare from. */
export const GLINTS = 16
/** How thick a sliver of Sun still counts as a whole piece of it, in Sun radii. */
export const SLIVER = 0.05

/**
 * Walk the Sun's edge and ask, at each point, how far it stands outside the
 * Moon. `mx, my` is the Moon's centre from the Sun's and `rm` its size, all
 * in Sun radii. The walk is closest together round the place the last of the
 * Sun will be (straight away from the Moon), because that is where a few
 * thousandths of a radius decide whether there is a bead or not.
 *
 * `open` is 1 with the whole edge clear and 0 with all of it covered.
 * `glints` is GLINTS of [x, y, how much], where the light is coming from.
 */
export function sunLeft(mx: number, my: number, rm: number, samples = 128): { open: number; glints: Float32Array } {
  const th0 = Math.atan2(-my, -mx)
  let open = 0, weight = 0
  const lit: [number, number, number][] = []
  for (let i = 0; i < samples; i++) {
    const u = ((i + 0.5) / samples) * 2 - 1
    const a = Math.abs(u)
    const th = th0 + Math.PI * u * a * Math.sqrt(a)
    const w = 2.5 * a * Math.sqrt(a) + 0.002
    const sx = Math.cos(th) * 0.996, sy = Math.sin(th) * 0.996
    const dx = sx - mx, dy = sy - my
    const depth = Math.hypot(dx, dy) - moonLimb(Math.atan2(dy, dx), rm)
    const o = Math.max(0, Math.min(1, depth / SLIVER)) * w
    open += o; weight += w
    if (o > 0) lit.push([sx, sy, o])
  }
  // Sixteen places is all the shader spreads from, so neighbours along the
  // edge are gathered into one: their light summed, at its own middle.
  const glints = new Float32Array(GLINTS * 3)
  const per = Math.max(1, Math.ceil(lit.length / GLINTS))
  for (let b = 0; b * per < lit.length && b < GLINTS; b++) {
    let x = 0, y = 0, o = 0
    for (const [sx, sy, so] of lit.slice(b * per, (b + 1) * per)) { x += sx * so; y += sy * so; o += so }
    glints[b * 3] = x / o; glints[b * 3 + 1] = y / o; glints[b * 3 + 2] = o / weight
  }
  return { open: open / weight, glints }
}

/**
 * The corona's brightness against the middle of the Sun's disc at `r` Sun
 * radii from its centre: Baumbach's fit to the eclipse photographs, as
 * [millionths, falling as this power of r]. It is why the inner corona is a
 * million times fainter than the Sun and still far too bright to see past.
 */
export const BAUMBACH: [number, number][] = [[0.0532, 2.5], [1.425, 7], [2.565, 17]]
export function coronaFall(r: number): number {
  r = Math.max(r, 1)
  return 1e-6 * BAUMBACH.reduce((s, [a, p]) => s + a * Math.pow(r, -p), 0)
}
export const CORONA_GLSL = `
// The corona's brightness against the middle of the Sun's disc, r in Sun radii (Baumbach).
float coronaFall(float r) {
  r = max(r, 1.0);
  return 1e-6 * (${BAUMBACH.map(([a, p]) => `${g(a)} * pow(r, -${g(p, 1)})`).join(' + ')});
}
`

/* -------------------------------------------------------------------------- */
/* The light in the Earth's shadow                                             */
/* -------------------------------------------------------------------------- */

/**
 * The fraction of the Sun's disc showing past the Earth, from a place `rho`
 * Earth radii off the shadow's axis, in a shadow whose umbra and penumbra
 * are that many Earth radii wide at the Moon.
 *
 * Seen from the Moon the Earth is a dark disc and the Sun a bright one, and
 * the two widths fix their sizes: the umbra's edge is where the Sun has just
 * gone wholly behind (centres apart by the difference of the radii), the
 * penumbra's where it has just come wholly out (their sum). In between it is
 * the area of one circle outside another.
 */
export function sunSeen(rho: number, umbra: number, penumbra: number): number {
  if (rho >= penumbra) return 1
  if (rho <= umbra) return 0
  const s = (penumbra - umbra) / 2, e = (penumbra + umbra) / 2, d = rho
  const c = (x: number) => Math.acos(Math.max(-1, Math.min(1, x)))
  const a = s * s * c((d * d + s * s - e * e) / (2 * d * s))
    + e * e * c((d * d + e * e - s * s) / (2 * d * e))
    - 0.5 * Math.sqrt(Math.max(0, (-d + s + e) * (d + s - e) * (d - s + e) * (d + s + e)))
  return Math.max(0, Math.min(1, 1 - a / (Math.PI * s * s)))
}

/** The red of the umbra, deep in and near its edge; the blue-grey of its very edge; and how bright it is against sunlight. */
export const UMBRA = {
  deep: [0.92, 0.11, 0.028], edge: [1.0, 0.29, 0.085], ozone: [0.42, 0.62, 0.78],
  /** Against full sunlight, at the umbra's edge. A total eclipse is ten thousand times dimmer than a full Moon. */
  glow: 1.9e-4,
  /** How fast it darkens toward the middle: e to the minus this, at the axis. */
  fade: 3.0,
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)

/**
 * All the light reaching a place in or near the shadow, as red, green and
 * blue against full sunlight: what is left of the Sun, and the sunsets of
 * the whole Earth bent inward, red, dimmer toward the middle.
 */
export function shadowLight(rho: number, umbra: number, penumbra: number): number[] {
  const k = rho / umbra
  const inside = 1 - smooth(0.96, 1.22, k)
  // Ozone takes the red out of the light that only just clears the Earth.
  const red = mix3(mix3(UMBRA.deep, UMBRA.edge, smooth(0.3, 1, k)), UMBRA.ozone, smooth(0.86, 1.02, k) * 0.55)
  const sun = sunSeen(rho, umbra, penumbra)
  const glow = UMBRA.glow * Math.exp(-UMBRA.fade * (1 - Math.min(k, 1))) * inside
  return red.map((c) => sun + c * glow)
}

export const SHADOW_GLSL = `
// The fraction of the Sun's disc showing past the Earth, from a place rho Earth radii off the shadow's axis.
float sunSeen(float rho) {
  float um = u_shadow.x, pn = u_shadow.y;
  float s = (pn - um) * 0.5, e = (pn + um) * 0.5;
  float d = clamp(rho, um + 1e-4, pn - 1e-4);
  float a = s * s * acos(clamp((d * d + s * s - e * e) / (2.0 * d * s), -1.0, 1.0))
          + e * e * acos(clamp((d * d + e * e - s * s) / (2.0 * d * e), -1.0, 1.0))
          - 0.5 * sqrt(max(0.0, (-d + s + e) * (d + s - e) * (d - s + e) * (d + s + e)));
  return rho >= pn ? 1.0 : rho <= um ? 0.0 : clamp(1.0 - a / (PI * s * s), 0.0, 1.0);
}

// All the light reaching a place in or near the shadow: what is left of the Sun,
// and the sunsets of the whole Earth bent inward, red, dimmer toward the middle.
vec3 shadowLight(float rho) {
  float k = rho / u_shadow.x;
  float inside = 1.0 - smoothstep(0.96, 1.22, k);
  vec3 red = mix(${g3(UMBRA.deep)}, ${g3(UMBRA.edge)}, smoothstep(0.3, 1.0, k));
  // Ozone takes the red out of the light that only just clears the Earth: a blue-grey edge.
  red = mix(red, ${g3(UMBRA.ozone)}, smoothstep(0.86, 1.02, k) * 0.55);
  return vec3(sunSeen(rho)) + red * ${UMBRA.glow.toExponential(2)} * exp(-${g(UMBRA.fade, 1)} * (1.0 - min(k, 1.0))) * inside;
}
`

const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

/**
 * What the eye is adapted to during a lunar eclipse: the brightest part of
 * the Moon, mostly. The Moon's centre is `mx, my` from the shadow's axis and
 * `mr` its size, in Earth radii. While any of it is in sunlight this is
 * about 1 and the part in the umbra looks black; once all of it is inside,
 * it drops ten thousandfold and the red is what there is to see.
 */
export function moonLevel(mx: number, my: number, mr: number, umbra: number, penumbra: number): number {
  const sep = Math.hypot(mx, my)
  const ax = sep > 1e-4 ? mx / sep : 1, ay = sep > 1e-4 ? my / sep : 0
  let top = 0, mean = 0
  const N = 9
  for (let i = 0; i < N; i++) {
    const f = (i / (N - 1)) * 2 - 1
    const l = lum(shadowLight(Math.hypot(mx + ax * f * mr * 0.92, my + ay * f * mr * 0.92), umbra, penumbra))
    top = Math.max(top, l); mean += l / N
  }
  return mean + (top - mean) * 0.6
}

/* -------------------------------------------------------------------------- */
/* Where the Sun stands at a solstice or an equinox                            */
/* -------------------------------------------------------------------------- */

/**
 * The latitude the Sun is over at each of the four (which is what the event
 * is: the equator, or a tropic, the tilt of the Earth's axis), and how many
 * minutes a sundial runs ahead of a clock at that time of year (the equation
 * of time), which is the only other thing needed to say where it is noon.
 */
export const SEASON_SUN: Record<string, { lat: number; sundial: number }> = {
  march: { lat: 0, sundial: -7.4 },
  june: { lat: 23.44, sundial: -1.8 },
  september: { lat: 0, sundial: 7.5 },
  december: { lat: -23.44, sundial: 1.6 },
}

/**
 * Where on the Earth the Sun is straight overhead at an instant on the day
 * of one of the four: degrees north, and degrees east in -180..180. It is
 * noon by the Sun where the clock, the longitude and the sundial's error add
 * up to twelve.
 */
export function sunOverhead(season: string, at: Date): { lat: number; lon: number } {
  const s = SEASON_SUN[season]
  const hours = at.getUTCHours() + at.getUTCMinutes() / 60 + at.getUTCSeconds() / 3600
  const lon = -15 * (hours - 12 + s.sundial / 60)
  return { lat: s.lat, lon: ((lon % 360) + 540) % 360 - 180 }
}

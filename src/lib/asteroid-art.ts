/**
 * The rock, drawn — and actually turning.
 *
 * Every other lit sphere on this site (the Moon, Earth, Jupiter, in
 * scale-art.ts) is a static "near side": craters scattered in flat disc
 * space, because the object never has to move. This one does — the whole
 * point of the build panel is that you are looking at a body that is about
 * to hit something, and a body that just sits there facing you full-on
 * reads as a sticker, not a rock in space.
 *
 * So the craters here are genuine points on a unit sphere (`craterField`),
 * spun by an angle the page owns (`rotation`) and projected with real
 * orthographic foreshortening (`projectFeature`): a crater's radius along
 * the sphere's own radial direction shrinks by the cosine of its angle from
 * the camera, which is why one nearing the limb draws as a sliver rather
 * than a smaller circle. That is the one piece of this file that is actual
 * 3D, cheaply done — everything else is the same flat gradient-and-blotch
 * technique the Moon uses, at a size where nobody will ask for more.
 *
 * Materials are grounded in real bodies, not invented to look nice:
 *   - "Comet ice" (917 kg/m³, pure water ice) is drawn the pale blue-white
 *     of a fresh icy surface — Europa, Enceladus. A real comet nucleus
 *     (67P) is famously almost coal-black, but that is a dust-mantled crust
 *     over the ice this density actually models, not the ice itself.
 *   - "Porous rock" (1500 kg/m³) matches the two rubble-pile asteroids we
 *     have close-up photographs of, Bennu and Ryugu — both nearly charcoal.
 *   - "Dense rock" (3000 kg/m³) is an ordinary chondrite: mid grey-brown,
 *     the colour of most meteorites that make it to the ground.
 *   - "Iron" (7800 kg/m³) is a Canyon Diablo analogue — the Meteor Crater
 *     impactor — drawn as the bare metal, with rust streaks.
 *   - "Solid gold" is not a real asteroid material at all. It is the game's
 *     one joke entry and is drawn like the sport it is.
 */
import type { Composition } from './impact'

/* -------------------------------------------------------------------------- */
/* Colour                                                                     */
/* -------------------------------------------------------------------------- */

const chan = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hexOf = (a: number[]) =>
  '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

/** Plain sRGB mixing, same approach as scale-art.ts's palette. */
export const mix = (a: string, b: string, t: number) => {
  const [x, y] = [chan(a), chan(b)]
  return hexOf(x.map((v, i) => v + (y[i] - v) * t))
}
export const lt = (c: string, t: number) => mix(c, '#ffffff', t)
export const dk = (c: string, t: number) => mix(c, '#000000', t)

/** Seeded so the surface is the same rock on every visit and the checker's
 *  numbers are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* -------------------------------------------------------------------------- */
/* Material                                                                   */
/* -------------------------------------------------------------------------- */

export type RockMaterial = {
  name: string
  base: string
  fleck: string
  /** Fraction of the generated feature field that shows up as a crater at all. */
  craterDensity: number
  /** How dark the shadowed half of a crater reads, 0..1. */
  craterDepth: number
  /** Of the features that show, the fraction drawn as a bright fleck (a rust
   *  streak, a vein, a crack) instead of a dark crater. */
  fleckDensity: number
  /** Sharpness/brightness of the single specular highlight, 0..1. Metal and
   *  gold get one; matte rock does not. */
  metallic: number
  /** Colour of the ambient halo behind the rock. */
  glow: string
}

export const ROCK_MATERIAL: Record<Composition, RockMaterial> = {
  ice: {
    name: 'Comet ice', base: '#d7eef6', fleck: '#79c6e8',
    craterDensity: 0.30, craterDepth: 0.30, fleckDensity: 0.45, metallic: 0.24, glow: '#8fd7f2',
  },
  porous: {
    name: 'Porous rock', base: '#635646', fleck: '#372e26',
    craterDensity: 0.92, craterDepth: 0.70, fleckDensity: 0.00, metallic: 0.03, glow: '#786a56',
  },
  rock: {
    name: 'Dense rock', base: '#8a725a', fleck: '#4d4033',
    craterDensity: 0.68, craterDepth: 0.55, fleckDensity: 0.00, metallic: 0.08, glow: '#8f7860',
  },
  iron: {
    name: 'Iron', base: '#7d818c', fleck: '#a35a34',
    craterDensity: 0.55, craterDepth: 0.60, fleckDensity: 0.38, metallic: 0.70, glow: '#9aa1ae',
  },
  gold: {
    name: 'Solid gold', base: '#e8ba3a', fleck: '#fff3c4',
    craterDensity: 0.16, craterDepth: 0.30, fleckDensity: 0.55, metallic: 0.92, glow: '#f6d876',
  },
}

/* -------------------------------------------------------------------------- */
/* Surface features, on an actual sphere                                     */
/* -------------------------------------------------------------------------- */

export type Feature = { lon: number; lat: number; r: number; prominence: number }

export const FEATURE_SEED = 4021
export const FEATURE_COUNT = 42

/**
 * Uniform placement on a sphere. `asin(2u - 1)` for latitude, not a plain
 * linear scaling of u, is load-bearing — a linear lat crowds features at the
 * poles, because lines of latitude near a pole cover far less surface area
 * per degree than they do at the equator. This is the same correction
 * `craterField`'s checker verifies statistically.
 */
export function craterField(seed: number, count: number): Feature[] {
  const rnd = mulberry32(seed)
  const out: Feature[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      lon: rnd() * Math.PI * 2,
      lat: Math.asin(rnd() * 2 - 1),
      r: 0.045 + rnd() * 0.10,
      prominence: rnd(),
    })
  }
  return out
}

export type Projected = {
  /** Sphere-local screen position, -1..1. */
  x: number
  y: number
  /** Ellipse radii, as a fraction of the feature's own radius: rx is the
   *  foreshortened (radial) axis, ry the untouched (tangential) one. */
  rx: number
  ry: number
  /** Degrees to rotate the ellipse so rx points along the sphere's own
   *  radial direction at that point, not along the screen's x-axis. */
  angle: number
  /** 0 at the limb, 1 facing the camera dead-on. */
  front: number
}

/**
 * Orthographic projection of a small tangent-plane disc on a unit sphere
 * rotated by `rotation` about its vertical axis.
 *
 * The disc's radius along the sphere's radial direction shrinks by the
 * cosine of the angle between the surface normal and the view direction —
 * which for a point already given as `(x, y, z)` on a unit sphere is just
 * `z` itself, since the normal at a point on a sphere centred at the origin
 * is that same point. Real foreshortening, not a size fade standing in for
 * it: a crater near the limb draws as a sliver, correctly oriented, rather
 * than a smaller circle facing the wrong way.
 *
 * Returns null once a feature has rotated far enough onto the far side that
 * it should not be drawn at all. The threshold is a little past the true
 * horizon (z < -0.06, not z < 0) so a feature does not pop out abruptly —
 * it fades through `front` first.
 */
export function projectFeature(f: Feature, rotation: number): Projected | null {
  const clat = Math.cos(f.lat)
  const x = clat * Math.cos(f.lon + rotation)
  const y = Math.sin(f.lat)
  const z = clat * Math.sin(f.lon + rotation)
  if (z < -0.06) return null
  const front = Math.max(0, z)
  const rim = Math.hypot(x, y)
  const angle = rim > 1e-4 ? (Math.atan2(y, x) * 180) / Math.PI : 0
  // A small floor under the foreshortening keeps a limb feature a visible
  // sliver rather than a literal zero-width line.
  return { x, y, rx: 0.12 + 0.88 * front, ry: 1, angle, front }
}

/* -------------------------------------------------------------------------- */
/* Starfield                                                                  */
/* -------------------------------------------------------------------------- */

export type Star = { x: number; y: number; r: number; warm: boolean }

/** A fixed sprinkle behind the rock — never animated, so it costs nothing
 *  after the first paint. Coordinates are on a 0..200 field. */
export function starField(seed: number, count: number): Star[] {
  const rnd = mulberry32(seed)
  return Array.from({ length: count }, () => ({
    x: rnd() * 200,
    y: rnd() * 200,
    // rnd*rnd skews toward small stars, the way a real field has many more
    // faint points than bright ones.
    r: 0.35 + rnd() * rnd() * 1.5,
    warm: rnd() > 0.5,
  }))
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                    */
/* -------------------------------------------------------------------------- */

/** A lit-sphere gradient, the Moon's technique: light from the upper-left,
 *  same 34%/28% centre as scale-art.ts's `ballShade` so every sphere on this
 *  site is lit from the same place. */
function ballGradient(id: string, base: string): string {
  return `<radialGradient id="${id}-lit" cx="34%" cy="28%" r="80%">
    <stop offset="0%" stop-color="${lt(base, 0.55)}"/>
    <stop offset="55%" stop-color="${base}"/>
    <stop offset="100%" stop-color="${dk(base, 0.62)}"/>
  </radialGradient>`
}

export type RockOpts = {
  id: string
  composition: Composition
  seed?: number
  count?: number
}

/**
 * Defs, glow, starfield and the base sphere — everything that does not
 * change frame to frame. Call once on mount and again only when the
 * composition changes.
 */
export function rockStatic(o: RockOpts & { stars?: Star[] }): string {
  const m = ROCK_MATERIAL[o.composition]
  const id = o.id
  const stars = o.stars ?? []
  const starDots = stars
    .map(
      (s) =>
        `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.r.toFixed(2)}" ` +
        `fill="${s.warm ? '#ffe3c2' : '#cfe4ff'}" opacity="${(0.4 + s.r * 0.3).toFixed(2)}"/>`,
    )
    .join('')
  return `
    <defs>
      ${ballGradient(id, m.base)}
      <radialGradient id="${id}-limb" cx="50%" cy="50%" r="50%">
        <stop offset="68%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.58"/>
      </radialGradient>
      <radialGradient id="${id}-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${m.glow}" stop-opacity="0.5"/>
        <stop offset="55%" stop-color="${m.glow}" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="${m.glow}" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="${id}-disc"><circle cx="100" cy="100" r="86"/></clipPath>
    </defs>
    <g class="ast-stars">${starDots}</g>
    <circle cx="100" cy="100" r="132" fill="url(#${id}-glow)"/>
    <circle cx="100" cy="100" r="86" fill="url(#${id}-lit)"/>
  `
}

/**
 * The rotating part, unwrapped: craters, flecks, the one specular highlight
 * and the limb shading — everything that changes as the rock turns, without
 * the clip-path group around it. The page keeps one stable `<g clip-path>`
 * element and replaces only its contents every frame (throttled — the rock
 * turns slowly, it does not need 60fps of DOM churn); `rockFeatures` below
 * adds that wrapper for standalone use.
 */
export function rockFeaturesInner(o: RockOpts & { rotation: number }): string {
  const m = ROCK_MATERIAL[o.composition]
  const fields = craterField(o.seed ?? FEATURE_SEED, o.count ?? FEATURE_COUNT)
  const R = 86
  const cx = 100
  const cy = 100
  const parts: string[] = []

  for (const f of fields) {
    if (f.prominence > m.craterDensity) continue
    const p = projectFeature(f, o.rotation)
    if (!p) continue
    // Smooth the pop at the visibility cutoff rather than letting a feature
    // appear/disappear at a hard edge.
    const fade = Math.min(1, (p.front + 0.06) / 0.2)
    const sx = cx + p.x * R
    const sy = cy - p.y * R
    const rx = (p.rx * f.r * R).toFixed(1)
    const ry = (p.ry * f.r * R).toFixed(1)
    const rot = p.angle.toFixed(1)

    const isFleck = f.prominence > m.craterDensity * (1 - m.fleckDensity)
    if (isFleck) {
      const op = (0.4 + m.craterDepth * 0.35) * fade
      parts.push(
        `<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" rx="${rx}" ry="${ry}" ` +
          `transform="rotate(${rot} ${sx.toFixed(1)} ${sy.toFixed(1)})" ` +
          `fill="${m.fleck}" opacity="${op.toFixed(2)}"/>`,
      )
      continue
    }

    // dk/lt are pushed hard on purpose: gamma-decoded luminance compresses
    // differences between two dark colours far more than their sRGB values
    // suggest, so a crater on a dark material (porous rock) needs a much
    // bigger nominal spread than one on a light material to read as an edge
    // at all — check-asteroid-art.mjs's structure test is what caught this.
    const op = (0.35 + m.craterDepth * 0.55) * fade
    parts.push(
      `<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" rx="${rx}" ry="${ry}" ` +
        `transform="rotate(${rot} ${sx.toFixed(1)} ${sy.toFixed(1)})" ` +
        `fill="${dk(m.base, 0.62)}" opacity="${op.toFixed(2)}"/>`,
    )
    // The rim highlight sits toward the fixed key light, not toward the
    // crater's own centre — same trick as the Moon's craters in scale-art.ts.
    const hx = sx - Number(rx) * 0.22
    const hy = sy - Number(ry) * 0.22
    parts.push(
      `<ellipse cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" rx="${(Number(rx) * 0.7).toFixed(1)}" ` +
        `ry="${(Number(ry) * 0.7).toFixed(1)}" transform="rotate(${rot} ${hx.toFixed(1)} ${hy.toFixed(1)})" ` +
        `fill="${lt(m.base, 0.48)}" opacity="${(op * 0.62).toFixed(2)}"/>`,
    )
  }

  // One specular highlight, fixed at the key-light position rather than
  // rotating with the surface — correct, not a simplification: a specular
  // reflection depends on where the light and camera are, not on which bit
  // of crust happens to be under it.
  if (m.metallic > 0.15) {
    const hlX = cx - R * 0.32
    const hlY = cy - R * 0.44
    const s = R * (0.09 + m.metallic * 0.15)
    parts.push(
      `<ellipse cx="${hlX.toFixed(1)}" cy="${hlY.toFixed(1)}" rx="${s.toFixed(1)}" ry="${(s * 0.68).toFixed(
        1,
      )}" fill="${m.fleck === '#fff3c4' ? m.fleck : lt(m.fleck, 0.4)}" opacity="${(
        0.35 +
        m.metallic * 0.45
      ).toFixed(2)}"/>`,
    )
  }

  parts.push(`<circle cx="100" cy="100" r="86" fill="url(#${o.id}-limb)" opacity="0.7"/>`)
  return parts.join('')
}

/** `rockFeaturesInner`, wrapped in its own clip-path group — for standalone
 *  use (the checker) rather than the page's stable-element update loop. */
export function rockFeatures(o: RockOpts & { rotation: number }): string {
  return `<g class="ast-features" clip-path="url(#${o.id}-disc)">${rockFeaturesInner(o)}</g>`
}

/** Both halves together — what the checker renders, and what the page draws
 *  once on mount before it starts updating the features group alone. */
export function renderRock(o: RockOpts & { rotation: number; stars?: Star[] }): string {
  return rockStatic(o) + rockFeatures(o)
}

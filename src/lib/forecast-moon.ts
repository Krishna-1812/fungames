/**
 * The Moon's near side, for Universe Forecast.
 *
 * The Moon keeps one face to us, so the picture of it is always the same
 * picture, and a page that draws it from numbers should have the right one:
 * the Sea of Crises alone on the right-hand edge, the Sea of Rains top left
 * with Plato a dark dot on its shore, Tycho low down with rays right across
 * the southern highlands. This is that face as a table: each sea where it
 * is (selenographic latitude and longitude, degrees; east is the side
 * Crisium is on) and as big as it is, and the bright rayed craters that are
 * the other thing an eye picks out.
 *
 * It is a model, not a photograph. Where the seas are and how far across
 * is real; their shorelines are a noise the shader adds, and the small
 * craters it scatters are nobody's craters. The page says so.
 *
 * No imports, so the node check reads it as it is. The shader does not have
 * the table at all: `moonMap` makes a picture of the near side out of it,
 * once, and the shader looks places up in that.
 */

const D2R = Math.PI / 180

/** [name, latitude, longitude, half-width east-west, half-height north-south, turn (all degrees), how dark 0..1] */
export type Sea = [name: string, lat: number, lon: number, across: number, up: number, turn: number, dark: number]

export const SEAS: Sea[] = [
  ['Mare Imbrium', 32.8, -15.6, 18.5, 15.5, 0, 1],
  ['Sinus Iridum', 44.1, -31.5, 4.2, 3.6, 0, 1],
  ['Mare Serenitatis', 28.0, 17.5, 10.6, 10.2, 0, 1],
  ['Mare Tranquillitatis', 8.5, 31.4, 13.6, 10.2, -18, 1],
  ['Mare Crisium', 17.0, 59.1, 9.0, 6.9, 0, 1],
  ['Mare Fecunditatis', -7.8, 51.3, 9.4, 13.4, 8, 0.9],
  ['Mare Nectaris', -15.2, 35.5, 5.6, 5.6, 0, 0.9],
  ['Mare Vaporum', 13.3, 3.6, 4.2, 3.9, 0, 0.8],
  ['Sinus Medii', 2.4, 1.7, 4.2, 2.6, 0, 0.6],
  ['Sinus Aestuum', 10.9, -8.8, 4.6, 4.2, 0, 0.7],
  ['Mare Insularum', 7.5, -30.9, 8.6, 6.4, 0, 0.75],
  ['Mare Cognitum', -10.0, -23.1, 6.2, 5.6, 0, 0.8],
  ['Mare Nubium', -21.3, -16.6, 11.2, 10.0, 0, 0.85],
  ['Mare Humorum', -24.4, -38.6, 6.4, 6.4, 0, 1],
  ['Palus Epidemiarum', -32.0, -28.2, 4.6, 3.0, 0, 0.6],
  ['Oceanus Procellarum', 14.0, -55.0, 16.0, 16.0, 0, 0.9],
  ['Oceanus Procellarum, north', 31.0, -58.0, 11.0, 15.0, 12, 0.85],
  ['Oceanus Procellarum, south', -4.0, -47.0, 12.0, 11.0, 0, 0.85],
  ['Sinus Roris', 50.0, -50.0, 10.0, 5.0, -14, 0.75],
  ['Mare Frigoris, west', 57.5, -27.0, 13.0, 3.4, -4, 0.7],
  ['Mare Frigoris', 56.0, 1.4, 13.0, 3.2, 0, 0.7],
  ['Mare Frigoris, east', 54.0, 26.0, 10.0, 3.2, 8, 0.65],
  ['Lacus Somniorum', 38.0, 29.2, 5.5, 4.0, 0, 0.45],
  ['Lacus Mortis', 45.0, 27.2, 2.5, 2.5, 0, 0.5],
  ['Mare Humboldtianum', 56.8, 81.5, 4.5, 4.5, 0, 0.8],
  ['Mare Marginis', 13.3, 86.1, 6.0, 6.0, 0, 0.7],
  ['Mare Smythii', 1.3, 87.5, 6.0, 6.0, 0, 0.8],
  ['Mare Undarum', 6.8, 68.4, 3.6, 3.0, 0, 0.5],
  ['Mare Spumans', 1.1, 65.1, 2.3, 2.3, 0, 0.55],
  ['Mare Australe', -38.9, 93.0, 8.0, 10.0, 0, 0.5],
  ['Grimaldi', -5.2, -68.6, 2.9, 2.9, 0, 1],
  ['Plato', 51.6, -9.3, 1.7, 1.5, 0, 1],
  ['Schickard', -44.4, -54.6, 3.4, 3.4, 0, 0.4],
]

/** [name, latitude, longitude, how far its bright ground reaches, how far its rays do (degrees), how bright 0..1] */
export type Rayed = [name: string, lat: number, lon: number, halo: number, reach: number, bright: number]

export const RAYED: Rayed[] = [
  ['Tycho', -43.3, -11.4, 2.6, 40, 1],
  ['Copernicus', 9.6, -20.1, 3.0, 12, 0.8],
  ['Kepler', 8.1, -38.0, 1.6, 8, 0.7],
  ['Aristarchus', 23.7, -47.4, 1.5, 5, 1],
  ['Proclus', 16.1, 46.8, 1.2, 6, 0.8],
  ['Langrenus', -8.9, 61.1, 2.4, 5, 0.5],
  ['Byrgius A', -24.5, -63.7, 1.0, 7, 0.6],
  ['Anaxagoras', 73.4, -10.1, 1.4, 10, 0.6],
  ['Thales', 61.8, 50.3, 1.0, 6, 0.5],
  ['Menelaus', 16.3, 16.0, 0.9, 4, 0.5],
]

export type Vec3 = [number, number, number]

/**
 * A place on the Moon as a direction from its centre: x toward the east limb
 * (the right, from the northern half of the Earth), y toward its north pole,
 * z toward the Earth.
 */
export function moonDir(lat: number, lon: number): Vec3 {
  const a = lat * D2R, o = lon * D2R
  return [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)]
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** East and north along the ground at a place, as unit directions. */
function compass(lat: number, lon: number): { east: Vec3; north: Vec3 } {
  const a = lat * D2R, o = lon * D2R
  return {
    east: [Math.cos(o), 0, -Math.sin(o)],
    north: [-Math.sin(a) * Math.sin(o), Math.cos(a), -Math.sin(a) * Math.cos(o)],
  }
}

/**
 * A sea as a test of a place: where its middle points, and two directions
 * along the ground scaled so that a place is inside the sea when its two
 * dot products make a vector shorter than one.
 */
export function seaAxes(s: Sea): { c: Vec3; a: Vec3; b: Vec3; dark: number } {
  const [, lat, lon, across, up, turn, dark] = s
  const { east, north } = compass(lat, lon)
  const t = turn * D2R, ct = Math.cos(t), st = Math.sin(t)
  const ka = 1 / Math.sin(across * D2R), kb = 1 / Math.sin(up * D2R)
  return {
    c: moonDir(lat, lon),
    a: [(ct * east[0] + st * north[0]) * ka, (ct * east[1] + st * north[1]) * ka, (ct * east[2] + st * north[2]) * ka],
    b: [(-st * east[0] + ct * north[0]) * kb, (-st * east[1] + ct * north[1]) * kb, (-st * east[2] + ct * north[2]) * kb],
    dark,
  }
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

// With how nearly a place must face a sea's middle to be anywhere near it:
// most of the Moon is nowhere near most seas, and saying so first is most of
// the speed of making the map.
const AXES = SEAS.map((s) => ({ ...seaAxes(s), near: Math.cos(Math.min(89, Math.max(s[3], s[4]) * 1.25) * D2R) }))

/** How much of the ground at a place is still highland, 0..1: every sea there takes its share. Smooth shores; the shader roughens them. */
function clearOf(m: Vec3): number {
  let clear = 1
  for (const s of AXES) {
    if (dot(m, s.c) < s.near) continue
    const r = Math.hypot(dot(m, s.a), dot(m, s.b))
    if (r < 1.08) clear *= 1 - s.dark * (1 - smooth(0.86, 1.08, r))
  }
  return clear
}

/** How much of a sea there is at a place, 0 (highland) to 1 (the darkest basalt). */
export function seaAt(lat: number, lon: number): number {
  return 1 - clearOf(moonDir(lat, lon))
}

const RAYS = RAYED.map(([, lat, lon, halo, reach, bright]) => ({
  c: moonDir(lat, lon), ...compass(lat, lon),
  halo: Math.sin(halo * D2R), reach: Math.sin(Math.min(89, reach) * D2R), bright,
  near: Math.cos(Math.min(89, reach) * D2R),
}))

/**
 * The bright ground thrown out of the young craters at a place: a patch
 * round each, and rays along the ground from it. A few strong spokes and
 * many faint ones, each thinning with distance. Which way the spokes point
 * is invented; that there are spokes, and how far they reach, is not.
 */
function thrownOf(m: Vec3): number {
  let lit = 0
  RAYS.forEach((ray, i) => {
    if (dot(m, ray.c) < ray.near) return
    const x = dot(m, ray.east), y = dot(m, ray.north)
    const r = Math.hypot(x, y)
    if (r > ray.reach) return
    const th = Math.atan2(y, x)
    const spokes = Math.pow(0.5 + 0.5 * Math.sin(th * 5 + i * 2.1), 3) * (0.55 + 0.45 * Math.sin(th * 13 + i))
      + Math.pow(0.5 + 0.5 * Math.sin(th * 19 + i * 4.7), 6) * 0.7
    const along = smooth(ray.halo * 0.6, ray.halo * 1.6, r) * (1 - smooth(ray.reach * 0.35, ray.reach, r))
    lit += ray.bright * (Math.exp(-(r * r) / (ray.halo * ray.halo)) * 0.6 + spokes * along * 0.3)
  })
  return lit
}

/** How bright the ground is at a place, highland = 1. The seas reflect about half what the highlands do. */
export const SEA_DIM = 0.56
export function toneAt(lat: number, lon: number): number {
  const m = moonDir(lat, lon)
  return 1 - SEA_DIM * (1 - clearOf(m)) + thrownOf(m)
}

/** How much thrown ground the map's green channel can hold: it stores a half of it. */
export const THROWN_SCALE = 2

/**
 * The near side as a picture the shader can look things up in: the disc as
 * it faces us, `size` pixels across, north at the top and east at the right.
 * Red is how much sea, green is the thrown ground (over THROWN_SCALE), and
 * outside the disc the edge is carried outward so a lookup that lands just
 * off it reads the limb and not a hole.
 *
 * The table is forty-odd rows and a pixel asks every one of them. Asked in
 * the shader, sixty times a second, that was most of the cost of drawing the
 * Moon; asked here, once, it is a few hundredths of a second when the Moon
 * first takes the stage.
 */
export function moonMap(size = 384): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let x = ((i + 0.5) / size) * 2 - 1
      let y = 1 - ((j + 0.5) / size) * 2
      const r = Math.hypot(x, y)
      if (r > 0.999) { x *= 0.999 / r; y *= 0.999 / r }
      const m: Vec3 = [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))]
      const k = (j * size + i) * 4
      px[k] = Math.round(255 * (1 - clearOf(m)))
      px[k + 1] = Math.round(255 * Math.min(1, thrownOf(m) / THROWN_SCALE))
      px[k + 2] = 0
      px[k + 3] = 255
    }
  }
  return px
}

/* -------------------------------------------------------------------------- */
/* The shader's half                                                           */
/* -------------------------------------------------------------------------- */

const f = (n: number) => { const s = n.toFixed(5); return s.includes('.') ? s : s + '.0' }

/**
 * GLSL: `moonAt(m, sun, rough)` — the Moon at the place `m` points to (x east,
 * y north, z toward the Earth). Wants `hash33` and `noise3` from the site's
 * shader library, the batch (`NP`, `NV`, `noises`, `UPTO`) the stage defines,
 * and `u_moonmap`, the picture `moonMap` makes.
 */
export const MOON_GLSL = `
uniform sampler2D u_moonmap;

/*
 * The Moon at a place. rgb is how bright the ground is there against a patch
 * of highland (its tone and its slight colour); a is how much sunlight it is
 * sending back toward the eye, 0 in the dark. rough is how much of the small
 * relief to light (0 for a full Moon, where no shadow can be seen).
 */
vec4 moonAt(vec3 m, vec3 sun, float rough) {
  // Every noise the ground wants depends only on the place, so one batch.
  ask2(0, m * 4.0 + 3.0); ask2(2, m * 4.0 + 11.0);
  NP[4] = m * 14.0; NP[5] = m * 14.0 + 5.0;
  ask2(6, m * 7.0 + 21.0);
  NP[8] = m * 41.0 + 2.0;
  ask3(9, m * 9.0 + 1.7);
  noises(12);
  // The seas. Push the place about before asking the map which one it is in:
  // the shores wander, and are not the ellipses the table is made of.
  vec2 w = m.xy + (vec2(got2(0), got2(2)) - 0.5) * 0.15 + (vec2(NV[4], NV[5]) - 0.5) * 0.045;
  float len = length(w);
  w = len > 0.995 ? w * 0.995 / len : w;
  // The lava is not one flow: older and younger sheets, lighter and darker.
  float sea = texture(u_moonmap, w * 0.5 + 0.5).r * (0.72 + 0.5 * got2(6));
  // The bright ground thrown out of the young craters, where it really is.
  float thrown = texture(u_moonmap, m.xy * 0.4975 + 0.5).g * ${f(THROWN_SCALE)};
  float grain = NV[8];

  float tone = 1.0 - ${f(SEA_DIM)} * sea;
  // The highlands are not one colour either, and are cratered to saturation: a grain.
  tone *= 0.80 + 0.38 * got3(9);
  tone *= 0.93 + 0.14 * grain * (1.0 - sea);
  tone += thrown * (0.7 + 0.6 * grain) * (1.0 - 0.35 * sea);
  // Small young craters are bright dots at any phase.
  tone += pow(grain, 22.0) * 5.0 * (1.0 - 0.6 * sea);

  vec3 n = m;
  if (rough > 0.0) {
    // Bowls, one to a cell at each of several sizes, each giving the ground a
    // slope: up the wall inside the rim, down the apron outside it. Shadows
    // cannot be seen from where the light is coming from, so there is no
    // relief at full Moon and all of it at the quarters; and none at the very
    // edge, where the walls that face us hide the ones that do not.
    vec3 slope = vec3(0.0);
    float fq = 7.0;
    for (int o = 0; o < UPTO(5); o++) {
      vec3 g = m * fq + 17.0 * float(o);
      vec3 id = floor(g);
      vec3 h = hash33(id + 0.5);
      vec3 d = (g - (id + 0.5 + h * 0.2)) / (0.15 + 0.13 * fract(h.y * 7.31 + 0.5));
      float r = length(d);
      float s = r < 1.0 ? r * r * 1.5 : -1.7 * exp(-(r - 1.0) * 5.0);
      // The seas were flooded after most of the big ones were made: fewer there.
      float keep = step(mix(-0.5, 0.35, sea), h.x) * (0.50 + 0.10 * float(o));
      slope += keep * s * d / max(r, 1e-3);
      fq *= 2.17;
    }
    slope *= rough * smoothstep(0.02, 0.4, m.z) * sqrt(max(1.0 - sun.z * sun.z, 0.0));
    n = normalize(m - (slope - m * dot(slope, m)) * 0.42);
  }
  float mu0 = dot(n, sun);
  float mu = max(m.z, 0.0);
  // Dust scatters light back the way it came: no darkening toward the edge at
  // full Moon, which is why the full Moon looks like a flat disc.
  float lit = mu0 <= 0.0 ? 0.0 : mix(2.0 * mu0 / (mu0 + mu + 1e-3), mu0, 0.25);
  // Long shadows near the edge of the light.
  lit *= smoothstep(-0.03, 0.05, dot(m, sun));
  vec3 tint = mix(vec3(1.0, 0.975, 0.93), vec3(0.88, 0.91, 1.0), sea * 0.7);
  return vec4(tint * tone, lit);
}
`

/**
 * The night sky's own lights (daylight.ts): the stars where they really are, and the moon in its phase.
 *
 * The stars: the ninety brightest of the real sky, each at its right ascension and declination, with its magnitude
 * and its colour (B−V: blue-white Rigel and Spica, white Vega and Sirius, yellow Capella, orange Arcturus and
 * Aldebaran, red Antares and Betelgeuse) — so the island's night has Orion, Scorpius, the Plough and the Southern
 * Cross where a sky at 24° north has them — and a few thousand fainter ones made up, the fainter the more of
 * them (as the real count grows, about 2.5 times per magnitude), crowding towards the Milky Way. They turn with the
 * sky about the pole, dim and redden low down (more air), twinkle there, and come out only as the sky darkens.
 *
 * The moon: a sphere lit by the sun from where the sun really is, so its phase is the true one for where the two
 * stand in the sky — a thin crescent near the sun at dusk, full opposite it at midnight — its seas (the maria) dark,
 * its unlit side faintly grey with earthshine, dimmed and reddened low down like the sun.
 */
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Matrix3, Mesh, Points, ShaderMaterial, SphereGeometry, Vector3 } from 'three'

/** Right ascension (hours), declination (degrees), visual magnitude, colour index B−V. */
export const BRIGHT: [number, number, number, number][] = [
  [6.752, -16.72, -1.46, 0.0], [6.399, -52.7, -0.74, 0.15], [14.261, 19.18, -0.05, 1.23], [14.66, -60.83, -0.27, 0.71], [18.616, 38.78, 0.03, 0.0],
  [5.278, 46.0, 0.08, 0.8], [5.242, -8.2, 0.13, -0.03], [7.655, 5.22, 0.34, 0.42], [1.629, -57.24, 0.46, -0.16], [5.919, 7.41, 0.5, 1.85],
  [14.064, -60.37, 0.61, -0.23], [19.846, 8.87, 0.76, 0.22], [12.443, -63.1, 0.76, -0.24], [4.599, 16.51, 0.86, 1.54], [16.49, -26.43, 0.96, 1.83],
  [13.42, -11.16, 0.97, -0.23], [7.755, 28.03, 1.14, 1.0], [22.961, -29.62, 1.16, 0.09], [20.69, 45.28, 1.25, 0.09], [12.795, -59.69, 1.25, -0.24],
  [10.14, 11.97, 1.35, -0.11], [6.977, -28.97, 1.5, -0.21], [7.577, 31.89, 1.58, 0.03], [17.56, -37.1, 1.62, -0.22], [12.519, -57.11, 1.63, 1.59],
  [5.419, 6.35, 1.64, -0.22], [5.438, 28.61, 1.65, -0.13], [9.22, -69.72, 1.67, 0.07], [5.604, -1.2, 1.69, -0.18], [22.137, -46.96, 1.74, -0.13],
  [5.679, -1.94, 1.77, -0.21], [12.9, 55.96, 1.77, -0.02], [11.062, 61.75, 1.79, 1.07], [3.405, 49.86, 1.79, 0.48], [7.14, -26.39, 1.83, 0.68],
  [17.622, -43.0, 1.86, 0.4], [18.403, -34.38, 1.85, -0.03], [8.375, -59.51, 1.86, 1.28], [13.792, 49.31, 1.86, -0.19], [5.992, 44.95, 1.9, 0.08],
  [16.811, -69.03, 1.91, 1.45], [6.629, 16.4, 1.93, 0.0], [20.427, -56.74, 1.94, -0.2], [8.745, -54.71, 1.96, 0.04], [6.378, -17.96, 1.98, -0.23],
  [9.46, -8.66, 1.98, 1.44], [2.53, 89.26, 1.98, 0.6], [2.12, 23.46, 2.0, 1.15], [10.333, 19.84, 2.01, 1.13], [0.727, -17.99, 2.04, 1.02],
  [18.921, -26.3, 2.05, -0.13], [14.111, -36.37, 2.06, 1.01], [1.162, 35.62, 2.07, 1.58], [0.14, 29.09, 2.07, -0.11], [17.582, 12.56, 2.08, 0.15],
  [14.845, 74.16, 2.08, 1.47], [5.796, -9.67, 2.09, -0.17], [11.818, 14.57, 2.14, 0.09], [3.136, 40.96, 2.12, -0.05], [22.711, -46.88, 2.07, 1.61],
  [12.692, -48.96, 2.2, -0.01], [9.285, -59.28, 2.21, 0.18], [9.133, -43.43, 2.21, 1.66], [15.578, 26.71, 2.22, -0.02], [13.399, 54.93, 2.23, 0.02],
  [20.37, 40.26, 2.23, 0.67], [0.675, 56.54, 2.24, 1.17], [17.943, 51.49, 2.24, 1.52], [5.533, -0.3, 2.25, -0.22], [0.153, 59.15, 2.28, 0.34],
  [16.006, -22.62, 2.29, -0.12], [16.836, -34.29, 2.29, 1.15], [11.031, 56.38, 2.37, -0.02], [21.736, 9.88, 2.39, 1.52], [0.438, -42.31, 2.4, 1.09],
  [11.897, 53.69, 2.44, 0.0], [17.173, -15.72, 2.43, 0.06], [23.063, 28.08, 2.42, 1.67], [7.402, -29.3, 2.45, -0.08], [23.079, 15.21, 2.49, -0.04],
  [3.038, 4.09, 2.54, 1.64], [15.283, -9.38, 2.61, -0.07], [15.738, 6.43, 2.63, 1.17], [1.911, 20.81, 2.64, 0.13], [12.573, -23.4, 2.65, 0.89],
  [12.263, -17.54, 2.59, -0.11], [1.43, 60.24, 2.68, 0.13], [14.848, -16.04, 2.75, 0.15], [19.512, 27.96, 3.05, 1.13], [13.036, 10.96, 2.83, 0.94],
  [19.771, 10.61, 2.72, 1.52], [3.791, 24.11, 2.87, -0.09],
]

/** A star's colour from its B−V index (a blackbody's, roughly: Ballesteros' temperature, then its tint). */
export function starColour(bv: number, out = new Color()) {
  const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
  // (Tanner Helland's fit of a blackbody's colour, in sRGB, taken to linear.)
  const t = T / 100
  const r = t <= 66 ? 1 : Math.min(1, 1.292936 * Math.pow(t - 60, -0.1332047592))
  const g = t <= 66 ? Math.min(1, Math.max(0, 0.39008157 * Math.log(t) - 0.6318414437)) : Math.min(1, 1.129890861 * Math.pow(t - 60, -0.0755148492))
  const b = t >= 66 ? 1 : t <= 19 ? 0 : Math.min(1, Math.max(0, 0.543206789 * Math.log(t - 10) - 1.19625408675))
  return out.setRGB(r, g, b).convertSRGBToLinear()
}

/** A unit vector for a right ascension (hours) and declination (degrees), in the equatorial frame (z to the pole). */
export const equatorial = (ra: number, dec: number, out = new Vector3()) => {
  const a = (ra / 12) * Math.PI, d = (dec * Math.PI) / 180
  return out.set(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d))
}

/** The galaxy's north pole, in the equatorial frame (RA 12h51m, Dec +27.1°): the fainter stars crowd away from it. */
const NGP = equatorial(12.857, 27.13)

/** The star field: the bright ones from the list, the faint ones made up (seeded, so the same each visit). */
export function starField(faint = 4200) {
  const pos: number[] = [], mag: number[] = [], col: number[] = [], seed: number[] = []
  const c = new Color(), v = new Vector3()
  const push = (p: Vector3, m: number, bv: number) => { pos.push(p.x, p.y, p.z); mag.push(m); starColour(bv, c); col.push(c.r, c.g, c.b); seed.push(Math.random() * 100) }
  for (const [ra, dec, m, bv] of BRIGHT) push(equatorial(ra, dec, v), m, bv)
  let s = 0x51f3a
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  let made = 0
  while (made < faint) {
    const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z)
    v.set(r * Math.cos(a), r * Math.sin(a), z)
    // (Fainter stars crowd towards the galaxy's plane.)
    const b = Math.abs(v.dot(NGP))
    if (rnd() > 0.35 + 0.65 * Math.exp(-b * b * 8)) continue
    // Magnitudes 3 to 6.5, each step fainter about 2.5 times as many.
    const m = 3 + Math.log(1 + rnd() * (Math.pow(2.5, 3.5) - 1)) / Math.log(2.5)
    const bv = -0.2 + Math.pow(rnd(), 1.4) * 1.8
    push(v, m, bv); made++
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('aMag', new Float32BufferAttribute(mag, 1))
  geo.setAttribute('aCol', new Float32BufferAttribute(col, 3))
  geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1))
  const mat = new ShaderMaterial({
    uniforms: { uEq: { value: new Matrix3() }, uShow: { value: 0 }, uTime: { value: 0 }, uPR: { value: 1 }, uTwinkle: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aMag, aSeed; attribute vec3 aCol;
      uniform mat3 uEq; uniform float uShow, uTime, uPR, uTwinkle;
      varying vec3 vCol;
      void main() {
        vec3 d = uEq * position;
        // Through more air low down: dimmer and redder (an airmass, then the air's colour-dependent extinction).
        float el = max(d.y, 0.0), am = 1.0 / (el + 0.15 * pow(el * 57.3 + 3.885, -1.253));
        vec3 ext = exp(-vec3(0.12, 0.18, 0.32) * am);
        float b = 1.2 * pow(10.0, -0.4 * (aMag + 1.46));
        // Twinkling, strongest near the horizon (none with less motion).
        float tw = 1.0 + uTwinkle * 0.45 * (1.0 - smoothstep(0.05, 0.6, el)) * sin(uTime * (11.0 + mod(aSeed, 7.0)) + aSeed);
        vCol = aCol * ext * b * tw * uShow * step(0.0, d.y);
        gl_PointSize = uPR * clamp(1.8 + 0.7 * (2.5 - aMag), 1.4, 5.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(d * 420.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol;
      void main() { vec2 q = gl_PointCoord - 0.5; float a = exp(-dot(q, q) * 14.0); gl_FragColor = vec4(vCol * a * 140.0, 1.0); }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false; points.renderOrder = -1.5
  return { points, mat }
}

/** The moon: lit by the sun from where it is (its phase follows), its seas dark, earthshine on its night side. */
export function moonDisc(radius: number) {
  const mat = new ShaderMaterial({
    uniforms: { uSun: { value: new Vector3(0, 1, 0) }, uBright: { value: 0 }, uTint: { value: new Color(1, 1, 1) } },
    vertexShader: /* glsl */ `varying vec3 vN, vL; void main() { vN = normalize(mat3(modelMatrix) * normal); vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun, uTint; uniform float uBright; varying vec3 vN, vL;
      float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main() {
        vec3 p = normalize(vL);
        // The seas: broad dark patches; the highlands brighter, speckled with craters.
        float mare = smoothstep(0.48, 0.62, n(p * 2.2 + 3.1) * 0.65 + n(p * 5.0) * 0.35);
        float crater = n(p * 18.0) * 0.5 + n(p * 41.0) * 0.5;
        float alb = mix(0.16, 0.08, mare) * (0.85 + 0.3 * crater);
        float lit = max(dot(normalize(vN), uSun), 0.0);
        // (The moon's soil sends light back towards the light more than a plain matte surface would: flatter, as the full moon looks.)
        lit = pow(lit, 0.6);
        vec3 c = uTint * alb * (lit + 0.012) * uBright;
        gl_FragColor = vec4(c, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  })
  const mesh = new Mesh(new SphereGeometry(radius, 48, 24), mat)
  mesh.frustumCulled = false; mesh.renderOrder = -1.4
  return { mesh, mat }
}

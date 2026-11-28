/**
 * The walk's air (round two, phase 2): one physically based atmosphere, from which the sky, the sun's and the moon's
 * colour, the haze on everything far off and the light that fills the shade all come — so they can never disagree.
 *
 * Hillaire's model (EGSR 2020, "A Scalable and Production Ready Sky and Atmosphere Rendering Technique"), in the
 * walk's own WebGL, as small tables made on the graphics card:
 *
 *   - transmittance (256 × 64): how much of the light gets through the air from any height, along any angle — the
 *     sun white at noon, yellow low down, red as it sets, gone below the Earth's edge;
 *   - multiple scattering (32 × 32): the light that has bounced off the air more than once (what keeps twilight blue,
 *     and the shade of a hazy day bright) — worked out once for every sun angle, as a factor;
 *   - the sky from where you stand (192 × 108, each frame): every direction's radiance, lit by the sun and by the
 *     moon (a moonlit sky is the same blue, a few hundred thousand times fainter: here brighter than that, as
 *     night in films is), the Earth's shadow rising opposite a sunset, the belt of pink above it;
 *   - the haze (32 slices of 32 × 32 over the picture, each frame): the light the air between you and a point adds,
 *     and what it lets through — far hills blue, the far side of the bay softened.
 *
 * The air itself: Rayleigh scattering by the molecules (blue), Mie by the haze (white, forward), ozone (which keeps
 * the blue hour blue), each thinning with height as the real ones do; the haze heavier here than a dry continent's
 * (a humid sea-level island: some twenty times the textbook clear sky's aerosol) and heavier still on a damp or rainy day (`haze`). Distances in kilometres; the island's
 * own units (a tile, 9.09 m) are turned into them where it meets the world.
 *
 * Also: the night sky's own glow (airglow, and the town's light low in the sky), and the Milky Way across it.
 */
import {
  BackSide, Color, FloatType, HalfFloatType, LinearFilter, Matrix3, Mesh, ShaderMaterial, SphereGeometry, type TextureDataType, Vector3, type WebGLRenderer, WebGLRenderTarget,
} from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

/** A world unit in kilometres (a metre is 0.11 of a unit). */
export const UNIT_KM = 1 / 0.11 / 1000
/** The sun's irradiance above the air, in the walk's light units (a white card at noon then reads about what it did before). */
export const SUN_E = 80

/* ---- the air, on the processor too (the sun's colour each frame, and the checks) ---- */
const RG = 6360, RT = 6460
const RAY = [5.802e-3, 13.558e-3, 33.1e-3], RAY_H = 8
const MIE_S = 3.996e-3, MIE_E = 4.44e-3, MIE_H = 1.2
const OZONE = [0.65e-3, 1.881e-3, 0.085e-3]

/** How much of the light gets through the air from a height (km) along a direction `mu` (cosine from the zenith): r, g, b. */
export function transmittance(h: number, mu: number, haze = 1): [number, number, number] {
  const r = RG + Math.max(h, 0.001)
  // Does the ray hit the Earth? Then nothing gets through.
  const b = r * mu, disc = b * b - (r * r - RG * RG)
  if (mu < 0 && disc > 0 && -b - Math.sqrt(disc) > 0) return [0, 0, 0]
  const top = -b + Math.sqrt(Math.max(0, b * b - (r * r - RT * RT)))
  const n = 48, dt = top / n
  const od = [0, 0, 0]
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) * dt
    const hh = Math.sqrt(r * r + t * t + 2 * r * t * mu) - RG
    const ray = Math.exp(-hh / RAY_H), mie = Math.exp(-hh / MIE_H) * haze, oz = Math.max(0, 1 - Math.abs(hh - 25) / 15)
    for (let c = 0; c < 3; c++) od[c] += (RAY[c] * ray + MIE_E * mie + OZONE[c] * oz) * dt
  }
  return [Math.exp(-od[0]), Math.exp(-od[1]), Math.exp(-od[2])]
}

/* ---- the air, on the graphics card ---- */
export const ATMO_GLSL = /* glsl */ `
  #define RG 6360.0
  #define RT 6460.0
  #define PI_A 3.14159265
  uniform float uHaze;
  const vec3 RAY_S = vec3(5.802e-3, 13.558e-3, 33.1e-3);
  const vec3 OZONE_A = vec3(0.65e-3, 1.881e-3, 0.085e-3);
  struct Medium { vec3 ray; float mie; vec3 ext; };
  Medium medium(float h) {
    float r = exp(-h / 8.0), m = exp(-h / 1.2) * uHaze, oz = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
    Medium o; o.ray = RAY_S * r; o.mie = 3.996e-3 * m; o.ext = RAY_S * r + vec3(4.44e-3 * m) + OZONE_A * oz; return o;
  }
  /** The nearest positive distance along a ray to a sphere about the Earth's centre (or -1). */
  float sphere(vec3 ro, vec3 rd, float R) {
    float b = dot(ro, rd), c = dot(ro, ro) - R * R, d = b * b - c;
    if (d < 0.0) return -1.0;
    float s = sqrt(d), t0 = -b - s, t1 = -b + s;
    return t0 > 0.0 ? t0 : t1 > 0.0 ? t1 : -1.0;
  }
  float phaseRay(float c) { return 3.0 / (16.0 * PI_A) * (1.0 + c * c); }
  float phaseMie(float c) { float g = 0.8, g2 = g * g; return 3.0 / (8.0 * PI_A) * ((1.0 - g2) * (1.0 + c * c)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
  // The transmittance table's coordinates (Bruneton's: the distance to the top of the air, over its range).
  vec2 transUv(float r, float mu) {
    float H = sqrt(RT * RT - RG * RG), rho = sqrt(max(r * r - RG * RG, 0.0));
    float disc = r * r * (mu * mu - 1.0) + RT * RT, d = max(0.0, -r * mu + sqrt(max(disc, 0.0)));
    float dmin = RT - r, dmax = rho + H;
    return vec2((d - dmin) / max(dmax - dmin, 1e-4), rho / H);
  }
`

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

/** The sky from where you stand, as a direction is laid out in it: around (azimuth), and up — the horizon in the middle, finer near it. */
export const SKYVIEW_GLSL = /* glsl */ `
  vec2 skyUv(vec3 d) {
    float az = atan(d.z, d.x), el = asin(clamp(d.y, -1.0, 1.0));
    return vec2(fract(az / (2.0 * PI_A) + 1.0), 0.5 + 0.5 * sign(el) * sqrt(abs(el) / (0.5 * PI_A)));
  }
`

export type Atmosphere = ReturnType<typeof atmosphere>

export function atmosphere(renderer: WebGLRenderer) {
  const haze = { value: 22 }
  const rt = (w: number, h: number, type: TextureDataType = HalfFloatType) => new WebGLRenderTarget(w, h, { type, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false })
  const trans = rt(256, 64, FloatType), multi = rt(32, 32, FloatType), view = rt(192, 108), ap = rt(32 * 32, 32)
  const quad = new FullScreenQuad()
  const draw = (m: ShaderMaterial, into: WebGLRenderTarget) => { const was = renderer.getRenderTarget(); quad.material = m; renderer.setRenderTarget(into); quad.render(renderer); renderer.setRenderTarget(was) }

  const transMat = new ShaderMaterial({
    uniforms: { uHaze: haze }, vertexShader: VERT,
    fragmentShader: ATMO_GLSL + /* glsl */ `
      varying vec2 vUv;
      void main() {
        float H = sqrt(RT * RT - RG * RG), rho = H * vUv.y, r = sqrt(rho * rho + RG * RG);
        float dmin = RT - r, dmax = rho + H, d = dmin + vUv.x * (dmax - dmin);
        float mu = d == 0.0 ? 1.0 : clamp((H * H - rho * rho - d * d) / (2.0 * r * d), -1.0, 1.0);
        vec3 ro = vec3(0.0, r, 0.0), rd = vec3(sqrt(max(1.0 - mu * mu, 0.0)), mu, 0.0);
        float len = sphere(ro, rd, RT);
        vec3 od = vec3(0.0); const int N = 40;
        for (int k = 0; k < N; k++) { float t = (float(k) + 0.5) / float(N) * len; od += medium(length(ro + rd * t) - RG).ext * (len / float(N)); }
        gl_FragColor = vec4(exp(-od), 1.0);
      }`,
  })
  const COMMON = ATMO_GLSL + /* glsl */ `
    uniform sampler2D tTrans;
    vec3 sunT(float r, float mu) { return texture2D(tTrans, transUv(r, mu)).rgb; }
    /** The light reaching a point from a body in a direction (zero where the Earth is in the way). */
    vec3 litBy(vec3 p, vec3 toL) {
      float r = length(p); vec3 up = p / r; float mu = dot(up, toL);
      float b = r * mu, d = b * b - (r * r - RG * RG);
      if (mu < 0.0 && d > 0.0 && -b - sqrt(d) > 0.0) return vec3(0.0);
      return sunT(r, mu);
    }
  `
  const multiMat = new ShaderMaterial({
    uniforms: { uHaze: haze, tTrans: { value: trans.texture } }, vertexShader: VERT,
    fragmentShader: COMMON + /* glsl */ `
      varying vec2 vUv;
      void main() {
        float muS = vUv.x * 2.0 - 1.0, r = RG + max(vUv.y, 0.002) * (RT - RG);
        vec3 ro = vec3(0.0, r, 0.0), toSun = vec3(sqrt(max(1.0 - muS * muS, 0.0)), muS, 0.0);
        vec3 L2 = vec3(0.0), fms = vec3(0.0);
        const int D = 8, N = 20;
        for (int i = 0; i < D; i++) for (int j = 0; j < D; j++) {
          float th = PI_A * (float(i) + 0.5) / float(D), ph = 2.0 * PI_A * (float(j) + 0.5) / float(D);
          vec3 rd = vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph));
          float tg = sphere(ro, rd, RG), tt = sphere(ro, rd, RT), len = tg > 0.0 ? tg : tt;
          vec3 T = vec3(1.0), Lf = vec3(0.0), Ff = vec3(0.0);
          for (int k = 0; k < N; k++) {
            float dt = len / float(N); vec3 p = ro + rd * (float(k) + 0.5) * dt;
            Medium m = medium(length(p) - RG); vec3 sc = m.ray + vec3(m.mie);
            vec3 Tstep = exp(-m.ext * dt);
            vec3 S = litBy(p, toSun) * sc / (4.0 * PI_A);
            vec3 integ = (S - S * Tstep) / max(m.ext, vec3(1e-7));
            vec3 fin = (sc - sc * Tstep) / max(m.ext, vec3(1e-7));
            Lf += T * integ; Ff += T * fin; T *= Tstep;
          }
          // The ground, lit by the sun and giving some of it back.
          if (tg > 0.0) { vec3 p = ro + rd * tg; Lf += T * litBy(p, toSun) * max(dot(normalize(p), toSun), 0.0) * vec3(0.1, 0.11, 0.1) / PI_A; }
          L2 += Lf / float(D * D); fms += Ff / float(D * D);
        }
        gl_FragColor = vec4(L2 / (1.0 - fms), 1.0);
      }`,
  })
  const MS = /* glsl */ `
    uniform sampler2D tMulti;
    vec3 msAt(float r, float muS) { return texture2D(tMulti, vec2(muS * 0.5 + 0.5, (r - RG) / (RT - RG))).rgb; }
    /** The light the air between two points sends towards the first (from the sun and the moon), and what it lets through. */
    void march(vec3 ro, vec3 rd, float len, int N, vec3 toSun, vec3 toMoon, float moonE, out vec3 L, out vec3 T) {
      L = vec3(0.0); T = vec3(1.0);
      float cs = dot(rd, toSun), cm = dot(rd, toMoon);
      float prS = phaseRay(cs), pmS = phaseMie(cs), prM = phaseRay(cm), pmM = phaseMie(cm);
      for (int k = 0; k < 40; k++) {
        if (k >= N) break;
        float dt = len / float(N); vec3 p = ro + rd * (float(k) + 0.5) * dt;
        float r = length(p); vec3 up = p / r;
        Medium m = medium(r - RG); vec3 sc = m.ray + vec3(m.mie);
        vec3 S = litBy(p, toSun) * (m.ray * prS + m.mie * pmS) + msAt(r, dot(up, toSun)) * sc;
        if (moonE > 0.0) S += moonE * (litBy(p, toMoon) * (m.ray * prM + m.mie * pmM) + msAt(r, dot(up, toMoon)) * sc);
        vec3 Tstep = exp(-m.ext * dt);
        L += T * (S - S * Tstep) / max(m.ext, vec3(1e-7)); T *= Tstep;
      }
    }
  `
  const viewMat = new ShaderMaterial({
    uniforms: { uHaze: haze, tTrans: { value: trans.texture }, tMulti: { value: multi.texture }, uSun: { value: new Vector3(0, 1, 0) }, uMoon: { value: new Vector3(0, -1, 0) }, uMoonE: { value: 0 }, uH: { value: 0.002 } },
    vertexShader: VERT,
    fragmentShader: COMMON + MS + /* glsl */ `
      uniform vec3 uSun, uMoon; uniform float uMoonE, uH;
      varying vec2 vUv;
      void main() {
        float az = vUv.x * 2.0 * PI_A, v = vUv.y * 2.0 - 1.0, el = sign(v) * v * v * 0.5 * PI_A;
        vec3 rd = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az)), ro = vec3(0.0, RG + uH, 0.0);
        float tg = sphere(ro, rd, RG), tt = sphere(ro, rd, RT), len = tg > 0.0 ? tg : tt;
        vec3 L, T; march(ro, rd, min(len, 400.0), 32, uSun, uMoon, uMoonE, L, T);
        gl_FragColor = vec4(L, 1.0);
      }`,
  })
  const apMat = new ShaderMaterial({
    uniforms: { uHaze: haze, tTrans: { value: trans.texture }, tMulti: { value: multi.texture }, uSun: { value: new Vector3(0, 1, 0) }, uMoon: { value: new Vector3(0, -1, 0) }, uMoonE: { value: 0 }, uH: { value: 0.002 }, uInvVP: { value: new Matrix3() }, uMax: { value: 8 } },
    vertexShader: VERT,
    fragmentShader: COMMON + MS + /* glsl */ `
      uniform vec3 uSun, uMoon; uniform float uMoonE, uH, uMax; uniform mat3 uInvVP;
      varying vec2 vUv;
      void main() {
        // Which slice (a distance, squared out so the near ones are finer) and which point across the picture.
        float slice = floor(vUv.x * 32.0); vec2 uv = vec2(fract(vUv.x * 32.0), vUv.y);
        vec3 rd = normalize(uInvVP * vec3(uv * 2.0 - 1.0, 1.0));
        float dist = uMax * pow((slice + 1.0) / 32.0, 2.0);
        vec3 ro = vec3(0.0, RG + uH, 0.0);
        vec3 L, T; march(ro, rd, dist, 8 + int(slice) / 2, uSun, uMoon, uMoonE, L, T);
        gl_FragColor = vec4(L, dot(T, vec3(0.3333)));
      }`,
  })

  /* ---- the sky's dome: the table looked up, the sun's disc, the night's own glow and the Milky Way ---- */
  const skyMat = new ShaderMaterial({
    uniforms: {
      tView: { value: view.texture }, tTrans: { value: trans.texture }, uHaze: haze, uSun: { value: new Vector3(0, 1, 0) }, uE: { value: SUN_E }, uDisc: { value: 1 },
      uEq: { value: new Matrix3() }, uNight: { value: new Color(0, 0, 0) }, uTown: { value: new Color(0, 0, 0) }, uMilky: { value: 0 }, uH: { value: 0.002 },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = (modelMatrix * vec4(position, 0.0)).xyz; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: ATMO_GLSL + SKYVIEW_GLSL + /* glsl */ `
      uniform sampler2D tView, tTrans; uniform vec3 uSun, uNight, uTown; uniform float uE, uDisc, uMilky, uH; uniform mat3 uEq;
      varying vec3 vDir;
      float h1(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h1(i), h1(i + vec3(1, 0, 0)), f.x), mix(h1(i + vec3(0, 1, 0)), h1(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(h1(i + vec3(0, 0, 1)), h1(i + vec3(1, 0, 1)), f.x), mix(h1(i + vec3(0, 1, 1)), h1(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      void main() {
        vec3 d = normalize(vDir);
        // (Below the horizon the sea and the land stand in front; the haze there is the horizon's own.)
        vec3 dd = d; dd.y = max(dd.y, 0.0005); dd = normalize(dd);
        vec3 c = texture2D(tView, skyUv(dd)).rgb * uE;
        float up = max(d.y, 0.0);
        vec3 T = texture2D(tTrans, transUv(RG + uH, max(up, 0.0))).rgb;
        // The night's own glow: airglow, faint and greenish all over, stronger low down; the town's light low in the sky.
        c += (uNight * (0.6 + 0.4 * (1.0 - up)) + uTown * exp(-up * 12.0)) * T;
        // The Milky Way: a band along the galaxy's plane, brightest towards its centre (in Sagittarius), dark lanes of dust down it.
        if (uMilky > 0.0) {
          vec3 e = uEq * d; // equatorial
          vec3 ngp = vec3(-0.8676, -0.1981, 0.4560), gc = vec3(-0.0549, -0.8734, -0.4838);
          float b = asin(clamp(dot(e, ngp), -1.0, 1.0)), l = dot(e, gc);
          float band = exp(-pow(b / 0.2, 2.0)) * (0.55 + 0.45 * smoothstep(-0.2, 1.0, l)) * (1.0 + 1.2 * exp(-pow(b / 0.08, 2.0)) * smoothstep(0.5, 1.0, l));
          float dust = smoothstep(0.35, 0.7, n3(e * 9.0) * 0.6 + n3(e * 23.0) * 0.4) * exp(-pow(b / 0.06, 2.0));
          float mottle = 0.6 + 0.8 * n3(e * 14.0);
          c += uMilky * band * mottle * (1.0 - 0.75 * dust) * vec3(0.85, 0.88, 1.0) * T;
        }
        // The sun's disc: its light through the air, darker towards its rim (limb darkening); held below what the
        // picture's numbers can carry.
        if (uDisc > 0.5) {
          float cs = dot(d, uSun), rad = 0.00467;
          float x = acos(clamp(cs, -1.0, 1.0)) / rad;
          if (x < 1.0) {
            vec3 Ts = texture2D(tTrans, transUv(RG + uH, clamp(uSun.y, -1.0, 1.0))).rgb;
            float limb = 1.0 - 0.6 * (1.0 - sqrt(max(1.0 - x * x, 0.0)));
            c += uE * Ts * limb * 900.0 * smoothstep(1.0, 0.85, x);
          }
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: BackSide, depthWrite: false, fog: false,
  })
  const geo = new SphereGeometry(1, 64, 32)
  /** A dome of the sky (for the picture, and another for the sky that lights the world, without the sun's disc). */
  const dome = (disc: boolean) => {
    const m = disc ? skyMat : new ShaderMaterial({ uniforms: { ...skyMat.uniforms, uDisc: { value: 0 } }, vertexShader: skyMat.vertexShader, fragmentShader: skyMat.fragmentShader, side: BackSide, depthWrite: false, fog: false })
    const o = new Mesh(geo, m); o.frustumCulled = false; o.renderOrder = -2
    return o
  }

  let madeFor = -1
  const camH = { km: 0.002 }
  return {
    haze, trans, multi, view, ap, skyMat, dome,
    /** Make the tables that depend only on the air (again when the haze changes much). */
    prepare() {
      if (Math.abs(haze.value - madeFor) < 0.02 * madeFor) return
      madeFor = haze.value
      draw(transMat, trans); draw(multiMat, multi)
    },
    /**
     * Each frame: the sky from where you stand, and the haze through the picture (the camera's directions, unjittered,
     * as a matrix from the picture's corners to the world).
     */
    update(o: { toSun: Vector3; toMoon: Vector3; moonE: number; camY: number; invViewProj: Matrix3; apMax: number }) {
      this.prepare()
      camH.km = Math.max(0.002, o.camY * UNIT_KM + 0.002)
      for (const m of [viewMat, apMat]) {
        const u = m.uniforms
        u.uSun.value.copy(o.toSun); u.uMoon.value.copy(o.toMoon); u.uMoonE.value = o.moonE; u.uH.value = camH.km
      }
      skyMat.uniforms.uSun.value.copy(o.toSun); skyMat.uniforms.uH.value = camH.km
      apMat.uniforms.uInvVP.value.copy(o.invViewProj); apMat.uniforms.uMax.value = o.apMax
      draw(viewMat, view); draw(apMat, ap)
    },
    /** The sun's (or any body's) light at the island through the air, per colour (0–1). */
    through(toBody: Vector3, out = new Color()) {
      const [r, g, b] = transmittance(camH.km, toBody.y, haze.value)
      return out.setRGB(r, g, b)
    },
    dispose() { for (const t of [trans, multi, view, ap]) t.dispose(); for (const m of [transMat, multiMat, viewMat, apMat, skyMat]) m.dispose(); geo.dispose(); quad.dispose() },
  }
}

/** The haze table's lookup, for the pass that lays it over the picture (lens.ts). */
export const AP_GLSL = /* glsl */ `
  uniform sampler2D tAP; uniform float uApMax;
  vec4 apAt(vec2 uv, float km) {
    float s = clamp(sqrt(km / uApMax) * 32.0 - 1.0, 0.0, 31.0);
    float s0 = floor(s), f = s - s0, s1 = min(s0 + 1.0, 31.0);
    vec2 c = vec2(clamp(uv.x, 0.5 / 32.0, 1.0 - 0.5 / 32.0), clamp(uv.y, 0.5 / 32.0, 1.0 - 0.5 / 32.0));
    vec4 a = texture2D(tAP, vec2((s0 + c.x) / 32.0, c.y)), b = texture2D(tAP, vec2((s1 + c.x) / 32.0, c.y));
    // (Nearer than the first slice: scaled down towards nothing at the camera.)
    vec4 r = mix(a, b, f);
    float near = clamp(km / (uApMax / 1024.0), 0.0, 1.0);
    return mix(vec4(0.0, 0.0, 0.0, 1.0), r, near);
  }
`

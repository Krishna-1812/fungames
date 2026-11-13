/**
 * Orbit's renderer.
 *
 * The physics in orbit.astro is untouched — this only replaces how the result
 * is drawn. Bodies stop being flat filled circles and become lit spheres:
 * a quad per body whose fragment shader reconstructs a sphere normal and
 * shades it against the actual stars in the simulation, so a planet's
 * terminator genuinely points at whatever is lighting it and swings round as
 * it orbits.
 *
 * The pipeline is HDR end to end:
 *
 *   trails + bodies ──► scene RT ──► bloom chain ──► ACES ──► screen
 *
 * Trails are each body's own history — the last four seconds of where it has
 * been, recorded once per simulation tick — drawn as a ribbon that tapers and
 * fades towards its tail. They used to come from feeding the previous frame
 * back at 90%, which is cheap and draws a string of beads: every frame stamped
 * a whole disc, so a fast body left a dotted line of copies of itself and a
 * slow one a fat smear. A ribbon is a line. It also survives a pause — the
 * history simply stops growing — where the feedback trail faded to nothing.
 *
 * Colours are emitted well above 1.0 on purpose. Nothing clips until the ACES
 * curve at the very end, which is what stops every star core turning into the
 * same flat white disc.
 *
 * WebGL2 is not assumed. `createRenderer` hands back a 2D-canvas implementation
 * with the same interface if it cannot get a context, so the page keeps working
 * on machines that have no GPU to give it.
 */
/*
 * Named imports, not `import * as THREE`. three.js is a large library — loaders,
 * controls, dozens of materials and geometries this game never touches — and a
 * namespace import defeats Rollup's tree-shaking because the bundler can no
 * longer prove which properties of the namespace object are actually read.
 * Twenty-one symbols cover everything this file uses.
 */
import {
  AddEquation,
  AdditiveBlending,
  BufferGeometry,
  CustomBlending,
  Camera,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  GLSL3,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  NormalBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  Sphere,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import type { IUniform } from 'three'
import { GLSL, GLSL_LIB } from './gl'

/**
 * Light that adds: colour and alpha both summed. Colour is the light; alpha is
 * how much of the sky behind it is covered, which only a star's disc sets.
 * (three's AdditiveBlending would multiply the colour by that alpha.)
 */
const LIGHT_BLEND = {
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneFactor,
} as const

/** Body shaders are not fullscreen passes, so they take the library only. */
const BODY_HEAD = `#version 300 es
precision highp float;
` + GLSL_LIB

/**
 * three prepends its own `#version 300 es` whenever glslVersion is GLSL3, and a
 * second directive further down is a hard compile error — `#version` must be
 * the first thing in the file. The sources here keep their directive so they
 * stay valid standalone (and readable next to the ones gl.ts compiles
 * directly); it is stripped on the way into three.
 */
const noVersion = (src: string) => src.replace(/^\s*#version[^\n]*\r?\n/, '')

export type RenderBody = {
  id: number; x: number; y: number; m: number; r: number; hue: number; star: boolean
}
export type Aim = { x0: number; y0: number; x1: number; y1: number } | null

export interface Renderer {
  resize(w: number, h: number, dpr: number): void
  /** Note where everything is. Called once per simulation tick, so a trail's
   *  length is a length of time, whatever the display's refresh rate. */
  record(bodies: RenderBody[]): void
  draw(bodies: RenderBody[], aim: Aim, trails: boolean, launchRadius: number): void
  /** Wipe the trail history. */
  clear(): void
  /** True when the GPU path is live, so the page can say so in the readout. */
  readonly hdr: boolean
  dispose(): void
}

const MAX_LIGHTS = 4

/* -------------------------------------------------------------------------- */
/* Shaders                                                                    */
/* -------------------------------------------------------------------------- */

/* Screen-space quads. The camera matrices are ignored entirely: positions come
   in as pixels and are converted straight to clip space, which keeps the
   renderer in the same coordinate system the physics already uses. */
const BODY_VERT = `#version 300 es
precision highp float;

in vec3 position;
in vec2 iPos;
in float iRadius;
in vec3 iColor;
in float iSeed;
in float iSpin;
/* mass, heat (0..1, from a recent impact), and the quad's padding in body
   radii — a ringed giant needs far more room than a bare moon. Zero padding
   means "use u_pad", which is what the stars do. */
in vec3 iInfo;

uniform vec2 u_res;
uniform float u_pad;

out vec2 vQuad;
out vec3 vColor;
out float vRadius;
out float vSeed;
out float vSpin;
out vec3 vInfo;
out vec2 vCentre;

void main() {
  vQuad = position.xy;
  vColor = iColor;
  vRadius = iRadius;
  vSeed = iSeed;
  vSpin = iSpin;
  vInfo = iInfo;
  vCentre = iPos;

  float pad = iInfo.z > 0.0 ? iInfo.z : u_pad;
  vec2 px = iPos + position.xy * iRadius * pad;
  vec2 clip = px / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`

/** Shared by both body passes: reconstructs the sphere and its lighting. */
const BODY_COMMON = `
uniform vec2  u_res;
uniform float u_pad;
uniform float u_time;
uniform int   u_lightCount;
uniform float u_disc;
uniform vec2  u_lightPos[${MAX_LIGHTS}];
uniform vec3  u_lightCol[${MAX_LIGHTS}];

in vec2 vQuad;
in vec3 vColor;
in float vRadius;
in float vSeed;
in float vSpin;
in vec2 vCentre;

out vec4 fragColor;

/* Rotate the sample point about Y so the surface turns with the body. Sampling
   the noise in the body's own frame — rather than in screen space — is what
   makes the texture stay stuck to the sphere as it moves. */
vec3 spun(vec3 n, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
}
`

/*
 * A planet, lit by whatever stars there are.
 *
 * The camera looks down on the plane everything orbits in, and the stars are
 * in that plane, so a planet is seen side-lit: the half facing its star is
 * day, the other half night, with the terminator straight across it. That is
 * the look of every real photograph taken from beside a planet rather than
 * between it and the Sun, and it is what makes these read as worlds instead
 * of coloured dots — the terminator swings round as the planet goes round.
 *
 * Every body has a spin axis tipped forty to seventy degrees towards the
 * viewer, so latitude — bands, ice caps, a ring's plane — curves across the
 * disc the way it does in a photograph, rather than being seen pole-on.
 *
 * What a body is follows from its mass, as it does in nature. Under 1.5 it is
 * a small airless moon, grey and cratered. Up to 16 it is rocky, and which
 * kind of rocky is down to the body: an ocean world with continents, clouds
 * and ice caps; a rust desert; a grey cratered world; an ice moon scored with
 * cracks; or a Venus under a cream cloud deck. Up to 100 it is a giant — belted
 * and storm-spotted, or pale gold, or an ice giant — and some giants carry
 * rings. From 100 to the 200 that ignites a star it is a brown dwarf, a failed
 * star glowing a dull magenta through its own cloud bands.
 *
 * Rings are real geometry: the ray through each pixel is intersected with the
 * ring plane, so a ring passes in front of the planet on one side and behind
 * it on the other, the planet casts its shadow across the ring, and the ring
 * casts its own back across the planet.
 */
const PLANET_FRAG = BODY_HEAD + `
${BODY_COMMON}
in vec3 vInfo;
uniform float u_falloff;

vec3 axisFor(float s) {
  float ob = 0.70 + 0.52 * fract(s * 7.13);
  float az = fract(s * 3.71) * TAU;
  return vec3(sin(ob) * cos(az), sin(ob) * sin(az), cos(ob));
}

/* A crater field: negative in the bowls, a bright lip at the rims. */
float craters(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float res = 0.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 h = hash33(i + g) * 0.5 + 0.5;
    float rad = 0.12 + 0.30 * h.x * h.y;
    float d = length(g + h - f) / rad;
    if (d < 1.4) {
      res += d < 1.0 ? -(1.0 - d * d) * 0.55 : 0.0;
      res += exp(-pow((d - 1.0) * 5.0, 2.0)) * 0.45;
    }
  }
  return res;
}

float ringDensity(float rho, float s) {
  float u = (rho - 1.32) / 0.93;
  if (u < 0.0 || u > 1.0) return 0.0;
  float d = 0.62 + 0.22 * sin(rho * 71.0 + s * 20.0) + 0.30 * (noise(vec2(rho * 38.0, s * 13.0)) - 0.5);
  d *= smoothstep(0.0, 0.04, u) * (1.0 - smoothstep(0.92, 1.0, u));
  d *= mix(0.30, 1.0, smoothstep(0.12, 0.28, u));          // the faint inner ring
  d *= 1.0 - 0.92 * exp(-pow((u - 0.70) * 36.0, 2.0));      // a Cassini division
  return clamp(d, 0.0, 0.92);
}

/* The colour and thickness of a body's air: no noise, so it is cheap enough
   to ask for at every pixel of the halo round it. */
void airOf(float m, float s, out vec3 air, out float k) {
  air = vec3(0.0); k = 0.0;
  if (m < 1.5) return;
  if (m < 16.0) {
    float kind = floor(fract(s * 5.31) * 5.0);
    if (kind < 1.0) { air = vec3(0.30, 0.55, 1.0); k = 1.0; }
    else if (kind < 2.0) { air = vec3(0.75, 0.55, 0.42); k = 0.25; }
    else if (kind < 3.0) { }
    else if (kind < 4.0) { air = vec3(0.55, 0.70, 0.90); k = 0.12; }
    else { air = vec3(0.85, 0.70, 0.45); k = 0.8; }
    return;
  }
  if (m < 100.0) {
    float g = floor(fract(s * 3.17) * 3.0);
    k = 0.7;
    air = g < 1.0 ? vec3(0.70, 0.62, 0.50)
        : g < 2.0 ? vec3(0.75, 0.65, 0.48)
        : fract(s * 13.3) < 0.4 ? vec3(0.55, 0.85, 0.90) : vec3(0.35, 0.55, 1.0);
    return;
  }
  air = vec3(0.6, 0.15, 0.2); k = 0.4;
}

struct Surf { vec3 albedo; float ocean; vec3 air; float airK; vec3 emit; };

void surface(float m, float s, vec3 q, out Surf o) {
  o.albedo = vec3(0.1); o.ocean = 0.0; o.emit = vec3(0.0);
  airOf(m, s, o.air, o.airK);
  float lat = q.z;
  vec3 sp = q + vec3(s * 17.0, s * 31.0, s * 7.0);

  if (m < 1.5) {
    // A small airless moon: grey regolith, darker lava plains, craters.
    float base = fbm3(sp * 2.6, 4);
    float mare = smoothstep(0.52, 0.62, fbm3(sp * 1.3 + 9.0, 3));
    float cr = craters(sp * 4.0) + 0.5 * craters(sp * 9.0 + 3.0);
    o.albedo = vec3(0.15, 0.145, 0.14) * (0.8 + 0.4 * base) * (1.0 - 0.45 * mare) * (1.0 + 0.35 * cr);
    return;
  }

  if (m < 16.0) {
    float kind = floor(fract(s * 5.31) * 5.0);
    if (kind < 1.0) {
      // An ocean world.
      float h = fbm3(sp * 1.5, 5);
      const float sea = 0.53;
      float land = smoothstep(sea, sea + 0.015, h);
      vec3 ocean = mix(vec3(0.008, 0.03, 0.09), vec3(0.02, 0.10, 0.16), smoothstep(sea - 0.10, sea, h));
      float dry = fbm3(sp * 3.2 + 5.0, 3) + (0.35 - abs(abs(lat) - 0.35)) * 0.6;
      vec3 ground = mix(vec3(0.045, 0.09, 0.03), vec3(0.32, 0.23, 0.13), smoothstep(0.62, 0.78, dry));
      ground = mix(ground, vec3(0.17, 0.15, 0.13), smoothstep(0.64, 0.74, h));
      vec3 alb = mix(ocean, ground, land);
      float ice = smoothstep(0.88, 0.92, abs(lat) + (h - 0.5) * 0.2);
      alb = mix(alb, vec3(0.78, 0.82, 0.86), ice);
      // Clouds turn a little faster than the ground, in bands by latitude.
      vec3 cq = vec3(q.xy, q.z * 1.6) * 2.3 + vec3(u_time * 0.015, s * 4.0, 0.0);
      float cl = smoothstep(0.54, 0.82, fbm3(cq, 5) + 0.10 * sin(lat * 9.0));
      alb = mix(alb, vec3(0.80, 0.82, 0.85), cl * 0.85);
      o.albedo = alb;
      o.ocean = (1.0 - land) * (1.0 - ice) * (1.0 - cl);
    } else if (kind < 2.0) {
      // A rust desert, thin dusty air, a polar cap.
      float h = fbm3(sp * 1.9, 5);
      float dark = smoothstep(0.50, 0.64, fbm3(sp * 1.1 + 3.0, 4));
      vec3 alb = mix(vec3(0.30, 0.12, 0.05), vec3(0.44, 0.23, 0.11), h);
      alb = mix(alb, vec3(0.12, 0.06, 0.035), dark * 0.7);
      alb *= 1.0 + 0.25 * craters(sp * 5.0);
      alb = mix(alb, vec3(0.80, 0.80, 0.82), smoothstep(0.86, 0.9, abs(lat) + (h - 0.5) * 0.1));
      o.albedo = alb;
    } else if (kind < 3.0) {
      // A grey cratered world with no air to soften anything.
      float base = fbm3(sp * 2.2, 4);
      float cr = craters(sp * 3.2) + 0.6 * craters(sp * 7.5 + 2.0);
      o.albedo = vec3(0.17, 0.155, 0.14) * (0.75 + 0.5 * base) * (1.0 + 0.4 * cr);
    } else if (kind < 4.0) {
      // An ice moon: bright, cracked, the cracks stained.
      float base = fbm3(sp * 2.0, 4);
      float crack = smoothstep(0.62, 0.8, ridge3(sp * 2.4, 4));
      vec3 alb = vec3(0.66, 0.66, 0.64) * (0.85 + 0.25 * base);
      o.albedo = mix(alb, vec3(0.36, 0.21, 0.13), crack * 0.75);
    } else {
      // A world under a cream cloud deck, swirled by its winds.
      float swirl = fbm3(vec3(q.xy * 1.6, q.z * 5.0) + vec3(u_time * 0.01, s * 3.0, 0.0), 5);
      o.albedo = mix(vec3(0.52, 0.45, 0.31), vec3(0.68, 0.60, 0.44), swirl);
    }
    return;
  }

  if (m < 100.0) {
    float g = floor(fract(s * 3.17) * 3.0);
    // Belts and zones, wavering with the turbulence between them; streaks
    // stretched along the lines of latitude.
    float turb = fbm3(sp * 2.6 + vec3(0.0, 0.0, u_time * 0.008), 4) - 0.5;
    float tl = lat + turb * 0.07;
    float bands = 0.5 + 0.5 * sin(tl * 19.0 + s * 9.0);
    float broad = 0.5 + 0.5 * sin(tl * 7.0 + s * 3.0);
    float streak = fbm3(vec3(q.xy * 3.0, q.z * 34.0) + s * 5.0, 3);
    vec3 alb;
    if (g < 1.0) {
      vec3 zone = vec3(0.66, 0.59, 0.46), belt = vec3(0.40, 0.25, 0.14);
      alb = mix(belt, zone, smoothstep(0.25, 0.75, bands * 0.7 + broad * 0.3 + (streak - 0.5) * 0.5));
      alb = mix(alb, vec3(0.34, 0.33, 0.33), smoothstep(0.62, 0.85, abs(lat)));
      // A great storm: an oval in the southern belts, slowly turning.
      vec3 c = normalize(vec3(cos(s * 40.0), sin(s * 40.0), -0.38));
      vec3 dq = q - c;
      float oval = length(vec2(length(dq.xy) * 0.62, dq.z * 1.5));
      float storm = 1.0 - smoothstep(0.10, 0.16, oval);
      alb = mix(alb, vec3(0.50, 0.20, 0.10), storm * 0.85);
    } else if (g < 2.0) {
      vec3 hi = vec3(0.64, 0.54, 0.35), lo = vec3(0.52, 0.42, 0.27);
      alb = mix(lo, hi, smoothstep(0.2, 0.8, bands * 0.5 + broad * 0.5 + (streak - 0.5) * 0.3));
      alb = mix(alb, vec3(0.42, 0.42, 0.40), smoothstep(0.75, 0.95, abs(lat)));
    } else {
      bool pale = fract(s * 13.3) < 0.4;
      vec3 deep = pale ? vec3(0.36, 0.60, 0.66) : vec3(0.08, 0.18, 0.52);
      vec3 light = pale ? vec3(0.46, 0.70, 0.74) : vec3(0.16, 0.32, 0.66);
      alb = mix(deep, light, smoothstep(0.3, 0.8, bands * 0.4 + broad * 0.6) * (pale ? 0.4 : 1.0));
      // High white cloud streaks.
      alb = mix(alb, vec3(0.80, 0.84, 0.88), smoothstep(0.66, 0.8, streak) * (pale ? 0.2 : 0.7));
    }
    o.albedo = alb;
    return;
  }

  // A brown dwarf: too light to fuse, still hot from forming, glowing through
  // its own cloud bands.
  float turb = fbm3(sp * 2.4 + vec3(0.0, 0.0, u_time * 0.01), 4) - 0.5;
  float bands = 0.5 + 0.5 * sin((lat + turb * 0.1) * 16.0 + s * 7.0);
  // Mostly what the nearby star lights, in dark rust; the heat of its own
  // only a faint glow through the gaps between the bands.
  o.albedo = mix(vec3(0.16, 0.07, 0.06), vec3(0.26, 0.12, 0.09), bands);
  o.emit = vec3(0.075, 0.012, 0.02) * (0.3 + 0.9 * (1.0 - bands)) * (0.8 + 0.4 * turb);
  return;
}

void main() {
  float pad = vInfo.z;
  vec2 p = vQuad * pad;
  float r2 = dot(p, p);
  float rr = sqrt(r2);
  float px = 1.0 / max(vRadius, 1.0);
  float s = vSeed;
  float m = vInfo.x;
  bool ringed = pad > 2.0;
  if (rr > (ringed ? 2.3 : 1.3)) discard;

  vec3 ax = axisFor(s);
  vec3 e1 = normalize(cross(ax, abs(ax.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 e2 = cross(ax, e1);

  // The lights, gathered once: direction (tipped a little towards the viewer,
  // so a little more than half the disc is day) and what arrives here.
  vec3 Ls[${MAX_LIGHTS}];
  vec3 Es[${MAX_LIGHTS}];
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    Ls[i] = vec3(0.0, 0.0, 1.0); Es[i] = vec3(0.0);
    if (i >= u_lightCount) continue;
    vec2 d = u_lightPos[i] - vCentre;
    float dist = max(length(d), 1e-3);
    Ls[i] = normalize(vec3(d / dist, 0.22));
    Es[i] = u_lightCol[i] / (1.0 + dist * dist / (u_falloff * u_falloff));
  }

  // Premultiplied colour and coverage, built back to front.
  vec3 col = vec3(0.0);
  float cover = 0.0;

  // ---- the ring, where the ray through this pixel crosses its plane
  float ringA = 0.0;
  vec3 ringC = vec3(0.0);
  float ringZ = -1e3;
  if (ringed && abs(ax.z) > 0.05) {
    float z = -(p.x * ax.x + p.y * ax.y) / ax.z;
    vec3 X = vec3(p, z);
    float rho = length(X);
    float dens = ringDensity(rho, s);
    if (dens > 0.0) {
      vec3 lit = vec3(0.0);
      for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= u_lightCount) break;
        vec3 L = Ls[i];
        // The planet's shadow across the ring.
        float bq = dot(X, L), cq = dot(X, X) - 1.0, disc = bq * bq - cq;
        float shade = (disc > 0.0 && -bq - sqrt(disc) > 0.0) ? 0.06 : 1.0;
        lit += Es[i] * (0.30 + 0.70 * abs(dot(ax, L))) * shade;
      }
      vec3 tone = vec3(0.60, 0.54, 0.45) * (0.85 + 0.3 * noise(vec2(rho * 90.0, s)));
      ringA = dens;
      ringC = tone * lit + tone * vec3(0.004, 0.005, 0.008);
      ringZ = z;
    }
  }

  float edge = 1.0 - smoothstep(1.0 - px, 1.0 + px, rr);
  float surfZ = sqrt(max(0.0, 1.0 - r2));

  // Ring behind the planet (or with no planet in this pixel).
  if (ringA > 0.0 && (ringZ < surfZ || edge <= 0.0)) {
    col = ringC * ringA;
    cover = ringA;
  }

  vec3 airC = vec3(0.0);
  float airK = 0.0;
  if (rr < 1.0 + px) {
    vec3 n = vec3(p, surfZ);
    vec3 q = vec3(dot(n, e1), dot(n, e2), dot(n, ax));
    float sa = vSpin + s * TAU;
    q.xy = mat2(cos(sa), sin(sa), -sin(sa), cos(sa)) * q.xy;
    Surf S;
    surface(m, s, q, S);
    airC = S.air; airK = S.airK;

    vec3 lit = vec3(0.0);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (i >= u_lightCount) break;
      vec3 L = Ls[i], E = Es[i];
      float ndl = dot(n, L);
      // Air carries light a little way round onto the night side.
      float diff = max(0.0, (ndl + 0.12 * S.airK) / (1.0 + 0.12 * S.airK));
      // The ring's shadow on the planet.
      float rs = 1.0;
      if (ringed && abs(dot(L, ax)) > 1e-3) {
        float tt = -dot(n, ax) / dot(L, ax);
        if (tt > 0.0) rs = 1.0 - 0.85 * ringDensity(length(n + L * tt), s);
      }
      lit += S.albedo * E * diff * rs;
      // Sunlight off open water.
      vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
      lit += E * S.ocean * pow(max(dot(n, H), 0.0), 70.0) * 0.9 * step(0.0, ndl) * rs;
      // The lit limb glows through its atmosphere; the terminator reddens.
      float limb = pow(1.0 - n.z, 2.5);
      lit += S.air * E * limb * smoothstep(-0.2, 0.5, ndl) * 0.55 * S.airK;
      lit += vec3(0.9, 0.45, 0.25) * E * exp(-abs(ndl) * 9.0) * 0.05 * S.airK * step(-0.1, ndl);
    }
    lit += S.albedo * vec3(0.006, 0.008, 0.014) + S.emit;
    col = mix(col, lit, edge);
    cover = mix(cover, 1.0, edge);
  } else {
    // Outside the disc only the air's colour is needed, for the halo.
    airOf(m, s, airC, airK);
  }

  // Ring in front of the planet.
  if (ringA > 0.0 && ringZ >= surfZ && edge > 0.0) {
    col = col * (1.0 - ringA) + ringC * ringA;
    cover = cover + ringA * (1.0 - cover);
  }

  // A thin halo of lit air just outside the limb: light, not cover.
  if (airK > 0.0 && rr > 1.0) {
    float w = max(0.06, 1.4 * px);
    float h = exp(-(rr - 1.0) / w * 2.2) * (1.0 - edge);
    vec2 dir = p / rr;
    vec3 glow = vec3(0.0);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (i >= u_lightCount) break;
      glow += Es[i] * smoothstep(-0.35, 0.6, dot(dir, normalize(Ls[i].xy)));
    }
    col += airC * glow * h * 0.35 * airK;
  }

  // Premultiplied out; the blend is set for it.
  fragColor = vec4(col, cover);
}`

/*
 * A star, as a telescope would see it.
 *
 * vColor is the colour of a black body at the star's temperature, already
 * scaled by how bright it is, so a red dwarf is a dim ember and a heavy star
 * a white-hot disc — see starLight() below.
 *
 * The disc is kept below the point where ACES flattens it to white, which is
 * the whole difference between a star and a lamp: what is on it has to be
 * visible. Limb darkening is per channel, because a star's edge is not only
 * darker but redder — the line of sight there ends higher up, in cooler gas.
 * Granulation is the convection cells boiling on the surface; the dark patches
 * are spots, where magnetic field holds the heat in. Outside the disc a thin
 * chromosphere, then a corona combed into streamers, then four faint
 * diffraction spikes of the kind any reflecting telescope puts on a bright
 * point — the one cue that says photographed rather than drawn.
 */
const STAR_FRAG = BODY_HEAD + `
${BODY_COMMON}

void main() {
  float sr = 1.0 / u_pad;
  vec2 p = vQuad / sr;
  float d = length(p);
  // One screen pixel, in units of this star's radius.
  float px = 1.0 / max(vRadius, 1.0);

  vec3 col = vec3(0.0);

  if (d < 1.0 + px) {
    vec3 n = vec3(p, sqrt(max(0.0, 1.0 - min(d * d, 1.0))));
    float mu = n.z;
    // The Sun's own limb darkening is about this: half as bright at mu = 0.3,
    // and redder, because blue light darkens towards the edge faster.
    vec3 limb = 1.0 - vec3(0.66, 0.76, 0.88) * (1.0 - mu);
    vec3 sp = spun(n, vSpin * 0.3 + vSeed * 6.283);
    // Convection cells, slowly turning over.
    float gran = fbm3(sp * 9.0 + vec3(0.0, u_time * 0.12, vSeed * 7.0), 3);
    float fine = noise3(sp * 26.0 + vec3(u_time * 0.2));
    // Spots: rare, clustered, darker in the middle than at the edge.
    float field = fbm3(sp * 2.4 + vec3(vSeed * 13.0), 3);
    float spot = smoothstep(0.66, 0.74, field);
    float umbra = smoothstep(0.72, 0.78, field);
    // Faculae: bright magnetic patches that only show near the limb.
    float fac = smoothstep(0.55, 0.65, field) * (1.0 - spot) * pow(1.0 - mu, 2.0) * 0.6;
    // Granulation is a few percent on a real star; this is more, so it reads at
    // thirty pixels across, and no more, or a small star turns to orange peel.
    float surf = (0.80 + 0.34 * gran + 0.07 * fine) * (1.0 - 0.45 * spot - 0.35 * umbra) + fac;
    // About half the light's own level: bright enough that the bloom round it
    // reads as blinding, dim enough that ACES leaves the surface on it.
    // A touch more of the star's own colour than a sensor would record, so a
    // sun reads as sunlight rather than as a grey disc after tonemapping.
    vec3 tint = mix(vColor, vColor * vColor / max(max(vColor.r, vColor.g), vColor.b), 0.35);
    vec3 disc = tint * limb * surf * u_disc;
    col += disc * (1.0 - smoothstep(1.0 - px, 1.0 + px, d));
  }
  // What the disc covers, so the sky's stars do not show through it.
  float cover = 1.0 - smoothstep(1.0 - px, 1.0 + px, d);

  // Outside the disc, the glow starts at the brightness of the limb and falls
  // away from it, so nothing round the star is brighter than its own edge —
  // the mistake that makes a star look like a cut-out on a halo.
  float r = max(d - 1.0, 0.0);
  float outside = smoothstep(1.0 - px, 1.0 + px, d);
  float ang = atan(p.y, p.x);
  float streak = fbm(vec2(ang * 2.6 + vSeed * 9.0, r * 1.2 - u_time * 0.02), 4);
  float glow = 0.26 * exp(-r * 4.0) + 0.06 * exp(-r * 1.1) * (0.5 + streak) + 0.025 * exp(-r * 0.5);
  col += vColor * vec3(1.0, 0.92, 0.86) * u_disc * glow * outside;

  // Diffraction spikes: four, on the diagonals, a pixel or so wide.
  vec2 q = mat2(0.7071, 0.7071, -0.7071, 0.7071) * p;
  float across = min(abs(q.x), abs(q.y)) / px;
  float along = max(abs(q.x), abs(q.y));
  float spike = exp(-across * across * 0.7) * exp(-along * 1.5) * smoothstep(0.9, 1.3, along);
  col += vColor * spike * 0.16;

  fragColor = vec4(col, cover);
}`

/* Trails: a ribbon per body, built on the CPU from its history. aSide runs
   -1..1 across the ribbon, so the fragment shader can give it a soft core and
   an antialiased edge however thin it gets. */
const TRAIL_VERT = `#version 300 es
precision highp float;
in vec3 position;
in vec4 aColor;
in float aSide;
uniform vec2 u_res;
out vec4 vColor;
out float vSide;
void main() {
  vColor = aColor;
  vSide = aSide;
  vec2 clip = position.xy / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`

const TRAIL_FRAG = `#version 300 es
precision highp float;
in vec4 vColor;
in float vSide;
out vec4 fragColor;
void main() {
  float d = abs(vSide);
  float aa = max(fwidth(vSide), 1e-3);
  float edge = 1.0 - smoothstep(1.0 - aa * 1.5, 1.0, d);
  float core = exp(-d * d * 2.2);
  fragColor = vec4(vColor.rgb * (vColor.a * core * edge), 0.0);
}`

const FS_VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

/*
 * The sky behind everything: what a long exposure from deep space shows.
 *
 * Drawn once into its own target and only redrawn on resize — it never
 * changes, so re-rendering it every frame would be pure waste.
 *
 * A band of the Milky Way crosses it: the glow of stars too faint and too many
 * to resolve, brighter towards one end where the view looks into the bulge,
 * split down its length by dark lanes of dust. Over that, stars, counted the
 * way real ones are — every step fainter there are several times more of
 * them, so the sky is mostly faint stars and a handful of bright ones — and
 * thicker in the band than out of it. Each takes a colour from a temperature,
 * most of them near white, some orange, a few blue. The brightest few carry a
 * small glow, as they do through any lens.
 *
 * Everything is placed in CSS pixels, so a star field has the same density on
 * a phone as on a monitor, and drawn at device resolution, so it is sharp.
 */
const SKY_FRAG = GLSL + `
float starLayer(vec2 css, float cell, float chance, float gain, float seed, float dens, out vec3 tint) {
  vec2 g = css / cell;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h = hash21(id + seed);
  tint = vec3(1.0);
  if (h > chance * dens) return 0.0;
  vec2 at = 0.2 + 0.6 * hash22(id + seed * 1.7);
  // Distance in device pixels, so every star is as sharp as the screen allows.
  float d = length((f - at) * cell) * u_dpr;
  float mag = hash21(id + seed * 3.1);
  float bright = gain * pow(mag, 4.0) + gain * 0.06;
  float temp = hash21(id + seed * 5.3);
  tint = temp < 0.12 ? vec3(1.0, 0.70, 0.48)
       : temp < 0.32 ? vec3(1.0, 0.88, 0.74)
       : temp < 0.86 ? vec3(0.96, 0.97, 1.0)
       :               vec3(0.70, 0.80, 1.0);
  float core = exp(-d * d / 0.9);
  float halo = exp(-d / (2.5 * u_dpr)) * smoothstep(0.55, 1.0, mag) * 0.06;
  return bright * (core + halo);
}

void main() {
  vec2 css = vUv * u_res / u_dpr;
  vec2 c = css - 0.5 * u_res / u_dpr;
  float scale = 0.5 * min(u_res.x, u_res.y) / u_dpr;

  // The band, at an angle, wandering a little along its length.
  vec2 dir = normalize(vec2(1.0, 0.42));
  vec2 nrm = vec2(-dir.y, dir.x);
  float along = dot(c, dir) / scale;
  float across = dot(c, nrm) / scale;
  float wander = (fbm(vec2(along * 0.9, 4.0), 3) - 0.5) * 0.5;
  float x = across - 0.15 + wander;
  float band = exp(-x * x / 0.16);
  float bulge = exp(-pow(along + 0.55, 2.0) / 0.9);

  // Unresolved starlight: grainy, clumped into star clouds.
  float clouds = fbm(c * 0.010 + 7.0, 6);
  float grain = fbm(c * 0.045 - 3.0, 4);
  float light = band * (0.45 + 0.9 * clouds) * (0.75 + 0.5 * grain) * (0.55 + 0.9 * bulge);
  vec3 glow = mix(vec3(0.050, 0.058, 0.080), vec3(0.075, 0.068, 0.062), bulge * 0.7) * light;

  // Dust lanes down the middle of the band, ragged at the edges.
  float lane = exp(-pow(x + 0.04 + (fbm(vec2(along * 2.4, 1.0), 3) - 0.5) * 0.12, 2.0) / 0.012);
  float dust = smoothstep(0.38, 0.72, fbm(c * 0.006 + 13.0, 5) + lane * 0.45);
  glow *= 1.0 - 0.82 * dust * band;

  // A faint glowing cloud of hydrogen in the band, and a reflection nebula.
  vec2 hp = c / scale - vec2(-0.55, -0.12);
  float ha = exp(-dot(hp, hp) / 0.05) * smoothstep(0.35, 0.8, fbm(c * 0.02 + 21.0, 5));
  glow += vec3(0.060, 0.012, 0.022) * ha * (1.0 - 0.7 * dust);
  vec2 rp = c / scale - vec2(0.62, 0.3);
  glow += vec3(0.010, 0.020, 0.045) * exp(-dot(rp, rp) / 0.03) * fbm(c * 0.03 + 5.0, 4);

  // Stars: more of them in the band, fewer through the dust.
  float dens = 1.0 + 2.2 * band * (1.0 - 0.8 * dust);
  vec3 stars = vec3(0.0);
  vec3 tint;
  float s;
  // Kept well under the bodies: the sky is a backdrop, and a field this
  // full at full strength hides a small planet among its own stars.
  s = starLayer(css, 3.2, 0.07, 0.10, 1.0, dens, tint); stars += tint * s;
  s = starLayer(css, 6.5, 0.11, 0.22, 2.0, dens, tint); stars += tint * s;
  s = starLayer(css, 15.0, 0.15, 0.55, 3.0, 1.0 + 0.6 * band, tint); stars += tint * s;
  s = starLayer(css, 42.0, 0.22, 1.50, 4.0, 1.0, tint); stars += tint * s;

  vec3 col = vec3(0.004, 0.005, 0.009) + glow * 0.75 + stars;
  fragColor = vec4(col, 1.0);
}`

const BRIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D u_src;
uniform float u_threshold;
void main() {
  vec3 c = texture(u_src, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Soft knee rather than a hard cut, so a body drifting past the threshold
  // does not pop into bloom.
  float k = smoothstep(u_threshold, u_threshold * 2.0, l);
  fragColor = vec4(c * k, 1.0);
}`

/* 13-tap downsample / 9-tap tent upsample — the dual-filter chain. Cheaper and
   far more stable under motion than a wide separable gaussian, which crawls. */
const DOWN_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D u_src;
uniform vec2 u_texel;
void main() {
  vec2 t = u_texel;
  vec3 a = texture(u_src, vUv + vec2(-2, 2) * t).rgb;
  vec3 b = texture(u_src, vUv + vec2( 0, 2) * t).rgb;
  vec3 c = texture(u_src, vUv + vec2( 2, 2) * t).rgb;
  vec3 d = texture(u_src, vUv + vec2(-2, 0) * t).rgb;
  vec3 e = texture(u_src, vUv).rgb;
  vec3 f = texture(u_src, vUv + vec2( 2, 0) * t).rgb;
  vec3 g = texture(u_src, vUv + vec2(-2,-2) * t).rgb;
  vec3 h = texture(u_src, vUv + vec2( 0,-2) * t).rgb;
  vec3 i = texture(u_src, vUv + vec2( 2,-2) * t).rgb;
  vec3 j = texture(u_src, vUv + vec2(-1, 1) * t).rgb;
  vec3 k = texture(u_src, vUv + vec2( 1, 1) * t).rgb;
  vec3 l = texture(u_src, vUv + vec2(-1,-1) * t).rgb;
  vec3 m = texture(u_src, vUv + vec2( 1,-1) * t).rgb;
  vec3 o = e * 0.125;
  o += (a + c + g + i) * 0.03125;
  o += (b + d + f + h) * 0.0625;
  o += (j + k + l + m) * 0.125;
  fragColor = vec4(o, 1.0);
}`

const UP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_radius;
void main() {
  vec2 t = u_texel * u_radius;
  vec3 o = texture(u_src, vUv + vec2(-1, 1) * t).rgb * 1.0;
  o += texture(u_src, vUv + vec2( 0, 1) * t).rgb * 2.0;
  o += texture(u_src, vUv + vec2( 1, 1) * t).rgb * 1.0;
  o += texture(u_src, vUv + vec2(-1, 0) * t).rgb * 2.0;
  o += texture(u_src, vUv).rgb * 4.0;
  o += texture(u_src, vUv + vec2( 1, 0) * t).rgb * 2.0;
  o += texture(u_src, vUv + vec2(-1,-1) * t).rgb * 1.0;
  o += texture(u_src, vUv + vec2( 0,-1) * t).rgb * 2.0;
  o += texture(u_src, vUv + vec2( 1,-1) * t).rgb * 1.0;
  fragColor = vec4(o / 16.0, 1.0);
}`

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_sky;
uniform vec2 u_res;
uniform float u_bloomStrength;
uniform float u_time;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash21(vec2 p) {
  uvec2 q = uvec2(ivec2(p * 1000.0)) * uvec2(1597334673U, 3812015801U);
  uint n = (q.x ^ q.y) * 1597334673U;
  return float(n & 0x7fffffffU) / float(0x7fffffff);
}

void main() {
  vec4 S = texture(u_scene, vUv);
  vec3 scene = S.rgb;
  vec3 bloom = texture(u_bloom, vUv).rgb;
  vec3 sky = texture(u_sky, vUv).rgb;

  // The scene's alpha is how much of each pixel a body covers: a planet's
  // night side and a star's disc hide the stars behind them, where adding the
  // sky underneath everything let them shine straight through.
  vec3 col = sky * (1.0 - clamp(S.a, 0.0, 1.0)) + scene + bloom * u_bloomStrength;

  // Slight desaturation of the very brightest cores, which is what a sensor
  // does and what stops a hot star reading as a pure hue.
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l), smoothstep(1.2, 6.0, l) * 0.5);

  col = aces(col * 1.05);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));

  // Vignette, then dither before the 8-bit write — a dark gradient this wide
  // bands very visibly without it.
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.55;
  col += (hash21(vUv * u_res + fract(u_time)) - 0.5) / 255.0;

  fragColor = vec4(col, 1.0);
}`

/* -------------------------------------------------------------------------- */
/* GPU renderer                                                               */
/* -------------------------------------------------------------------------- */

const BLOOM_LEVELS = 4

class GLRenderer implements Renderer {
  readonly hdr = true
  private renderer: WebGLRenderer
  private cam = new Camera()
  private w = 0
  private h = 0
  private dpr = 1

  private scene = new Scene()
  private planetMesh!: Mesh
  private starMesh!: Mesh
  private planetMat!: RawShaderMaterial
  private starMat!: RawShaderMaterial
  private planetGeo!: InstancedBufferGeometry
  private starGeo!: InstancedBufferGeometry

  private sceneRT!: WebGLRenderTarget
  private skyRT!: WebGLRenderTarget
  private bloomRT: WebGLRenderTarget[] = []

  private trailGeo = new BufferGeometry()
  private trailMat!: RawShaderMaterial
  private trailMesh!: Mesh
  /** Vertices the trail buffers have room for. */
  private trailCap = 0
  private hist = new Map<number, Trail>()

  private fsScene = new Scene()
  private fsQuad: Mesh
  private passes: Record<string, RawShaderMaterial> = {}

  private cap = 512
  private t0 = performance.now()

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      depth: false,
      stencil: false,
    })
    // Everything is tonemapped by hand in the composite pass, so three must not
    // also convert on the way out.
    this.renderer.outputColorSpace = LinearSRGBColorSpace
    this.renderer.autoClear = false
    // Render targets clear to no coverage; the scene's alpha is what bodies cover.
    this.renderer.setClearColor(0x000000, 0)

    // The fullscreen pass builds its triangle from gl_VertexID, so the contents
    // of this attribute are never read — but three sizes the draw call from
    // `position`, so three vertices of it have to exist.
    const fsGeo = new BufferGeometry()
    fsGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3))
    this.fsQuad = new Mesh(fsGeo)
    this.fsQuad.frustumCulled = false
    this.fsScene.add(this.fsQuad)

    this.buildPasses()
    this.buildTrails()
    this.buildBodies()
  }

  private pass(frag: string, uniforms: Record<string, IUniform>) {
    return new RawShaderMaterial({
      vertexShader: noVersion(FS_VERT),
      fragmentShader: noVersion(frag),
      uniforms,
      glslVersion: GLSL3,
      depthTest: false,
      depthWrite: false,
    })
  }

  private buildPasses() {
    this.passes.sky = this.pass(SKY_FRAG, {
      u_time: { value: 0 }, u_res: { value: new Vector2() },
      u_pointer: { value: new Vector2(0.5, 0.5) }, u_dpr: { value: 1 },
    })
    this.passes.bright = this.pass(BRIGHT_FRAG, {
      u_src: { value: null }, u_threshold: { value: 1.05 },
    })
    this.passes.down = this.pass(DOWN_FRAG, {
      u_src: { value: null }, u_texel: { value: new Vector2() },
    })
    this.passes.up = this.pass(UP_FRAG, {
      u_src: { value: null }, u_texel: { value: new Vector2() }, u_radius: { value: 1.0 },
    })
    this.passes.composite = this.pass(COMPOSITE_FRAG, {
      u_scene: { value: null }, u_bloom: { value: null }, u_sky: { value: null },
      u_res: { value: new Vector2() }, u_bloomStrength: { value: 0.34 },
      u_time: { value: 0 },
    })
  }

  private buildTrails() {
    this.trailMat = new RawShaderMaterial({
      vertexShader: noVersion(TRAIL_VERT),
      fragmentShader: noVersion(TRAIL_FRAG),
      uniforms: { u_res: { value: new Vector2() } },
      glslVersion: GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      ...LIGHT_BLEND,
      // The same Y flip as the bodies, so the same DoubleSide (see below).
      side: DoubleSide,
    })
    this.growTrails(8192)
    this.trailMesh = new Mesh(this.trailGeo, this.trailMat)
    this.trailMesh.frustumCulled = false
    // Drawn first: a planet passing over its own wake hides it.
    this.trailMesh.renderOrder = -1
    this.scene.add(this.trailMesh)
  }

  private growTrails(verts: number) {
    if (verts <= this.trailCap) return
    this.trailCap = Math.max(verts, this.trailCap * 2)
    const g = this.trailGeo
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(this.trailCap * 3), 3))
    g.setAttribute('aColor', new Float32BufferAttribute(new Float32Array(this.trailCap * 4), 4))
    g.setAttribute('aSide', new Float32BufferAttribute(new Float32Array(this.trailCap), 1))
    g.setIndex(new Uint32BufferAttribute(new Uint32Array(this.trailCap * 3), 1))
    g.boundingSphere = new Sphere(new Vector3(), 1e6)
  }

  record(bodies: RenderBody[]) {
    // Fewer points each when there are many bodies, so a crowd costs no more
    // to draw than a solar system does.
    const len = Math.max(48, Math.min(TRAIL_TICKS, Math.floor(TRAIL_BUDGET / Math.max(1, bodies.length))))
    const live = new Set<number>()
    for (const b of bodies) {
      live.add(b.id)
      let t = this.hist.get(b.id)
      if (!t || t.xs.length !== len) {
        const old = t
        t = { xs: new Float32Array(len), ys: new Float32Array(len), head: 0, count: 0 }
        // Keep what there was when the length changes, newest last.
        if (old) for (let i = Math.max(0, old.count - len); i < old.count; i++) {
          const k = (old.head - old.count + i + old.xs.length) % old.xs.length
          pushTrail(t, old.xs[k], old.ys[k])
        }
        this.hist.set(b.id, t)
      }
      pushTrail(t, b.x, b.y)
    }
    for (const id of this.hist.keys()) if (!live.has(id)) this.hist.delete(id)
  }

  /** Build every ribbon into the trail buffers. Returns the index count. */
  private buildRibbons(bodies: RenderBody[]) {
    let need = 0
    for (const b of bodies) need += (this.hist.get(b.id)?.count ?? 0) * 2
    this.growTrails(need)
    const g = this.trailGeo
    const pos = (g.getAttribute('position') as Float32BufferAttribute).array as Float32Array
    const col = (g.getAttribute('aColor') as Float32BufferAttribute).array as Float32Array
    const side = (g.getAttribute('aSide') as Float32BufferAttribute).array as Float32Array
    const idx = g.getIndex()!.array as Uint32Array
    const dpr = this.dpr
    let v = 0, k = 0
    for (const b of bodies) {
      const t = this.hist.get(b.id)
      if (!t || t.count < 2) continue
      const c = b.star ? starLight(b.m).multiplyScalar(0.5) : hueToLinear(b.hue, false)
      // Stars leave a bright wake; planets a fainter one in their own colour.
      const gain = b.star ? 0.9 : 0.55
      const head = Math.min(2.2, Math.max(0.9, b.r * 0.3)) * dpr
      const n = t.count, L = t.xs.length
      const at = (i: number) => (t.head - n + i + L) % L
      // A trail starts at the body's edge, not its centre. Under a planet it
      // would be hidden anyway; under a star, which adds light rather than
      // covering, a slowly drifting sun drew its own wake as a speck in the
      // middle of its disc.
      const hx = t.xs[at(n - 1)], hy = t.ys[at(n - 1)]
      let nx = 0, ny = 1
      const first = v
      for (let i = 0; i < n; i++) {
        const p = at(i), a = at(Math.max(0, i - 1)), z = at(Math.min(n - 1, i + 1))
        const tx = t.xs[z] - t.xs[a], ty = t.ys[z] - t.ys[a]
        const tl = Math.hypot(tx, ty)
        if (tl > 1e-4) { nx = -ty / tl; ny = tx / tl }
        // 0 at the tail, 1 at the body.
        const age = i / (n - 1)
        const hw = head * (0.35 + 0.65 * age)
        const out = Math.hypot(t.xs[p] - hx, t.ys[p] - hy) / b.r
        const clearOf = Math.min(1, Math.max(0, (out - 0.9) / 0.6))
        const alpha = gain * Math.pow(age, 1.6) * clearOf * clearOf * (3 - 2 * clearOf)
        const x = t.xs[p] * dpr, y = t.ys[p] * dpr
        for (let s = -1; s <= 1; s += 2) {
          pos[v * 3] = x + nx * hw * s; pos[v * 3 + 1] = y + ny * hw * s; pos[v * 3 + 2] = 0
          col[v * 4] = c.x; col[v * 4 + 1] = c.y; col[v * 4 + 2] = c.z; col[v * 4 + 3] = alpha
          side[v] = s
          v++
        }
      }
      for (let i = 0; i < n - 1; i++) {
        const a = first + i * 2
        idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + 2
        idx[k++] = a + 1; idx[k++] = a + 3; idx[k++] = a + 2
      }
    }
    for (const name of ['position', 'aColor', 'aSide']) {
      const attr = g.getAttribute(name) as Float32BufferAttribute
      attr.clearUpdateRanges()
      attr.addUpdateRange(0, v * attr.itemSize)
      attr.needsUpdate = true
    }
    const ia = g.getIndex()!
    ia.clearUpdateRanges()
    ia.addUpdateRange(0, k)
    ia.needsUpdate = true
    g.setDrawRange(0, k)
    return k
  }

  private makeGeo(cap: number) {
    const g = new InstancedBufferGeometry()
    // itemSize 3, not 2: three reads x/y/z when it computes bounds and a
  // 2-component attribute gives it a NaN radius on every geometry.
  g.setAttribute('position', new Float32BufferAttribute(
      [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setAttribute('iPos', new InstancedBufferAttribute(new Float32Array(cap * 2), 2))
    g.setAttribute('iRadius', new InstancedBufferAttribute(new Float32Array(cap), 1))
    g.setAttribute('iColor', new InstancedBufferAttribute(new Float32Array(cap * 3), 3))
    g.setAttribute('iSeed', new InstancedBufferAttribute(new Float32Array(cap), 1))
    g.setAttribute('iSpin', new InstancedBufferAttribute(new Float32Array(cap), 1))
    g.setAttribute('iInfo', new InstancedBufferAttribute(new Float32Array(cap * 3), 3))
    g.instanceCount = 0
    g.boundingSphere = new Sphere(new Vector3(), 1e6)
    return g
  }

  private bodyUniforms() {
    return {
      u_res: { value: new Vector2() },
      u_pad: { value: 1.0 },
      u_time: { value: 0 },
      u_lightCount: { value: 0 },
      u_disc: { value: 0.36 },
      u_falloff: { value: 420 },
      u_lightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new Vector2()) },
      u_lightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new Vector3()) },
    }
  }

  private buildBodies() {
    this.planetGeo = this.makeGeo(this.cap)
    this.starGeo = this.makeGeo(this.cap)

    this.planetMat = new RawShaderMaterial({
      vertexShader: noVersion(BODY_VERT),
      fragmentShader: noVersion(PLANET_FRAG),
      uniforms: this.bodyUniforms(),
      glslVersion: GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Premultiplied: the shader composites ring, disc and halo itself, and
      // the halo adds light without covering anything.
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
      // DoubleSide is load-bearing. The vertex shader flips Y to convert
      // screen space (Y down) to clip space (Y up), and that negation reverses
      // every triangle's winding -- so with the default FrontSide every body
      // quad is back-facing and silently culled. Nothing errors; they simply
      // never appear.
      side: DoubleSide,
    })
    this.starMat = new RawShaderMaterial({
      vertexShader: noVersion(BODY_VERT),
      fragmentShader: noVersion(STAR_FRAG),
      uniforms: this.bodyUniforms(),
      glslVersion: GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Stars and their coronae add light to whatever is behind them, and their
      // discs add coverage, so the sky is hidden behind them.
      ...LIGHT_BLEND,
      // DoubleSide is load-bearing. The vertex shader flips Y to convert
      // screen space (Y down) to clip space (Y up), and that negation reverses
      // every triangle's winding -- so with the default FrontSide every body
      // quad is back-facing and silently culled. Nothing errors; they simply
      // never appear.
      side: DoubleSide,
    })

    this.planetMesh = new Mesh(this.planetGeo, this.planetMat)
    this.starMesh = new Mesh(this.starGeo, this.starMat)
    this.planetMesh.frustumCulled = false
    this.starMesh.frustumCulled = false
    this.scene.add(this.planetMesh, this.starMesh)
  }

  resize(w: number, h: number, dpr: number) {
    this.dpr = dpr
    this.w = Math.max(1, Math.round(w * dpr))
    this.h = Math.max(1, Math.round(h * dpr))
    // Let three own the drawing buffer. Setting canvas.width by hand after
    // setSize leaves three's viewport at the CSS size while the buffer is at
    // the device size, so everything renders into a corner.
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)

    const opts = {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    } as const

    for (const rt of [this.sceneRT, this.skyRT, ...this.bloomRT]) rt?.dispose()
    this.bloomRT = []

    this.sceneRT = new WebGLRenderTarget(this.w, this.h, opts)
    this.skyRT = new WebGLRenderTarget(this.w, this.h, opts)
    let bw = this.w, bh = this.h
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1)
      this.bloomRT.push(new WebGLRenderTarget(bw, bh, opts))
    }

    for (const m of [this.planetMat, this.starMat, this.trailMat]) m.uniforms.u_res.value.set(this.w, this.h)
    this.passes.composite.uniforms.u_res.value.set(this.w, this.h)
    this.passes.sky.uniforms.u_res.value.set(this.w, this.h)
    this.passes.sky.uniforms.u_dpr.value = dpr

    // The sky is static, so it is rendered once here rather than every frame.
    this.blit(this.passes.sky, this.skyRT)
    this.renderer.setRenderTarget(null)
  }

  private blit(mat: RawShaderMaterial, target: WebGLRenderTarget | null) {
    this.fsQuad.material = mat
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.fsScene, this.cam)
  }

  private grow(need: number) {
    if (need <= this.cap) return
    this.cap = Math.max(need, this.cap * 2)
    this.scene.remove(this.planetMesh, this.starMesh)
    this.planetGeo.dispose(); this.starGeo.dispose()
    this.planetGeo = this.makeGeo(this.cap)
    this.starGeo = this.makeGeo(this.cap)
    this.planetMesh.geometry = this.planetGeo
    this.starMesh.geometry = this.starGeo
    this.scene.add(this.planetMesh, this.starMesh)
  }

  draw(bodies: RenderBody[], aim: Aim, trails: boolean, _launchRadius: number) {
    if (!this.w) return
    this.grow(bodies.length)
    const t = (performance.now() - this.t0) / 1000
    const dpr = this.dpr

    /* Fill the instance buffers. Stars and planets go into separate meshes so
       each can use the blend mode it needs. */
    let np = 0, ns = 0
    const pg = this.planetGeo, sg = this.starGeo
    const pPos = pg.getAttribute('iPos') as InstancedBufferAttribute
    const pRad = pg.getAttribute('iRadius') as InstancedBufferAttribute
    const pCol = pg.getAttribute('iColor') as InstancedBufferAttribute
    const pSeed = pg.getAttribute('iSeed') as InstancedBufferAttribute
    const pSpin = pg.getAttribute('iSpin') as InstancedBufferAttribute
    const pInfo = pg.getAttribute('iInfo') as InstancedBufferAttribute
    const sPos = sg.getAttribute('iPos') as InstancedBufferAttribute
    const sRad = sg.getAttribute('iRadius') as InstancedBufferAttribute
    const sCol = sg.getAttribute('iColor') as InstancedBufferAttribute
    const sSeed = sg.getAttribute('iSeed') as InstancedBufferAttribute
    const sSpin = sg.getAttribute('iSpin') as InstancedBufferAttribute
    const sInfo = sg.getAttribute('iInfo') as InstancedBufferAttribute

    const lights: { x: number; y: number; c: Vector3 }[] = []

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]
      // A stable per-body seed from its id, which survives everything but being
      // eaten — so a planet keeps its look when the list reorders round it.
      const seed = fract(b.id * 0.6180339887 + 0.137)
      const col = b.star ? starLight(b.m) : hueToLinear(b.hue, false)
      if (b.star) {
        sPos.setXY(ns, b.x * dpr, b.y * dpr)
        sRad.setX(ns, b.r * dpr)
        sCol.setXYZ(ns, col.x, col.y, col.z)
        sSeed.setX(ns, seed)
        sSpin.setX(ns, t * 0.12)
        sInfo.setXYZ(ns, b.m, 0, 0)
        ns++
        if (lights.length < MAX_LIGHTS) {
          // What reaches a planet, not what the disc shows: a planet in full
          // sun is a fraction as bright as the sun itself, as it should be.
          lights.push({ x: b.x * dpr, y: b.y * dpr, c: col.clone().multiplyScalar(0.62) })
        }
      } else {
        pPos.setXY(np, b.x * dpr, b.y * dpr)
        pRad.setX(np, b.r * dpr)
        pCol.setXYZ(np, col.x, col.y, col.z)
        pSeed.setX(np, seed)
        // Rotation rate falls with size, so big bodies feel heavy.
        pSpin.setX(np, t * (0.5 / Math.max(1, Math.cbrt(b.m))))
        pInfo.setXYZ(np, b.m, 0, ringed(b.m, seed) ? 2.35 : 1.3)
        np++
      }
    }

    // With no star in the system the planets would be lit by nothing at all, so
    // a dim fill sits off-screen to keep shapes readable.
    if (!lights.length) {
      lights.push({ x: this.w * 0.5, y: -this.h * 0.6, c: new Vector3(0.35, 0.38, 0.48) })
    }

    for (const a of [pPos, pRad, pCol, pSeed, pSpin, pInfo]) a.needsUpdate = true
    for (const a of [sPos, sRad, sCol, sSeed, sSpin, sInfo]) a.needsUpdate = true
    pg.instanceCount = np
    sg.instanceCount = ns

    for (const m of [this.planetMat, this.starMat]) {
      m.uniforms.u_time.value = t
      m.uniforms.u_lightCount.value = lights.length
      for (let i = 0; i < lights.length; i++) {
        m.uniforms.u_lightPos.value[i].set(lights[i].x, lights[i].y)
        m.uniforms.u_lightCol.value[i].copy(lights[i].c)
      }
    }
    // A star's corona needs a lot of room round it; each planet says how much
    // it needs itself (iInfo.z), since only a ringed one needs much.
    this.starMat.uniforms.u_pad.value = 6.0
    this.planetMat.uniforms.u_falloff.value = 420 * dpr

    // 1. trails, then bodies -> sceneRT
    this.trailMesh.visible = trails && this.buildRibbons(bodies) > 0
    this.renderer.setRenderTarget(this.sceneRT)
    this.renderer.clear(true, false, false)
    this.renderer.render(this.scene, this.cam)
    const next = this.sceneRT

    // 2. bloom chain
    this.passes.bright.uniforms.u_src.value = next.texture
    this.blit(this.passes.bright, this.bloomRT[0])
    for (let i = 1; i < BLOOM_LEVELS; i++) {
      const src = this.bloomRT[i - 1]
      this.passes.down.uniforms.u_src.value = src.texture
      this.passes.down.uniforms.u_texel.value.set(1 / src.width, 1 / src.height)
      this.blit(this.passes.down, this.bloomRT[i])
    }
    this.passes.up.uniforms.u_radius.value = 1.0
    for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
      const src = this.bloomRT[i]
      this.passes.up.uniforms.u_src.value = src.texture
      this.passes.up.uniforms.u_texel.value.set(1 / src.width, 1 / src.height)
      // Additive so each level layers onto the one below it, which is what
      // gives the glow its long tail.
      this.passes.up.blending = AdditiveBlending
      this.blit(this.passes.up, this.bloomRT[i - 1])
    }
    this.passes.up.blending = NormalBlending

    // 3. composite to screen
    this.passes.composite.uniforms.u_scene.value = next.texture
    this.passes.composite.uniforms.u_bloom.value = this.bloomRT[0].texture
    this.passes.composite.uniforms.u_sky.value = this.skyRT.texture
    this.passes.composite.uniforms.u_time.value = t
    this.blit(this.passes.composite, null)

    void aim
  }

  clear() {
    this.hist.clear()
  }

  dispose() {
    for (const rt of [this.sceneRT, this.skyRT, ...this.bloomRT]) rt?.dispose()
    this.planetGeo.dispose(); this.starGeo.dispose(); this.trailGeo.dispose()
    this.planetMat.dispose(); this.starMat.dispose(); this.trailMat.dispose()
    for (const k in this.passes) this.passes[k].dispose()
    this.renderer.dispose()
  }
}

const fract = (x: number) => x - Math.floor(x)

/** Whether a body wears rings: some giants do. Matches the shader's kinds. */
function ringed(m: number, seed: number) {
  if (m < 16 || m >= 100) return false
  return Math.floor(fract(seed * 3.17) * 3) === 1 || fract(seed * 11.7) < 0.25
}

/** Ticks of history a trail keeps: four seconds at the page's sixty a second. */
const TRAIL_TICKS = 240
/** Points across every trail together, so a crowd does not cost more. */
const TRAIL_BUDGET = 24000

type Trail = { xs: Float32Array; ys: Float32Array; head: number; count: number }

function pushTrail(t: Trail, x: number, y: number) {
  t.xs[t.head] = x
  t.ys[t.head] = y
  t.head = (t.head + 1) % t.xs.length
  t.count = Math.min(t.count + 1, t.xs.length)
}

/**
 * The colour of a black body at temperature T kelvin, in linear RGB with its
 * brightest channel at 1. Tanner Helland's fit to the CIE data, which is good
 * to a few percent from 1,000 K to 40,000 K — far wider than needed here.
 */
export function blackbody(T: number) {
  const t = T / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const lin = (c: number) => Math.pow(Math.min(255, Math.max(0, c)) / 255, 2.2)
  const v = new Vector3(lin(r), lin(g), lin(b))
  return v.multiplyScalar(1 / Math.max(v.x, v.y, v.z))
}

/**
 * How a star of mass m looks: its temperature and its brightness.
 *
 * Heavier stars are hotter — on the main sequence the surface temperature
 * goes as roughly the mass to the half — and far brighter. The sun of the
 * presets is put at the Sun's 5,800 K. A launched star, a tenth of that, is a
 * red dwarf at 3,000 K, as a tenth of a solar mass really is; the two stars
 * of the binary are orange K dwarfs; everything collapsed into one body burns
 * white. Brightness is compressed hard — the real range is millions to one —
 * so a red dwarf is dim but still there.
 */
export function starLight(m: number) {
  const T = Math.min(14000, Math.max(3100, 5800 * Math.pow(m / 2600, 0.4)))
  const glow = Math.min(1.4, Math.max(0.78, Math.pow(m / 2600, 0.2)))
  return blackbody(T).multiplyScalar(2.6 * glow)
}

/** Body hue -> linear HDR colour. Stars are emitted well above 1. */
function hueToLinear(hue: number, star: boolean) {
  const c = new Color()
  c.setHSL(hue / 360, star ? 0.55 : 0.62, star ? 0.72 : 0.55)
  // setHSL gives sRGB; the pipeline is linear throughout.
  return new Vector3(
    Math.pow(c.r, 2.2) * (star ? 1.6 : 1.0),
    Math.pow(c.g, 2.2) * (star ? 1.6 : 1.0),
    Math.pow(c.b, 2.2) * (star ? 1.6 : 1.0),
  )
}

/* -------------------------------------------------------------------------- */
/* 2D fallback                                                                */
/* -------------------------------------------------------------------------- */

/** The original renderer, kept intact for machines without WebGL2. */
class Canvas2DRenderer implements Renderer {
  readonly hdr = false
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.fillStyle = '#05060f'
    this.ctx.fillRect(0, 0, w, h)
  }

  record() {}

  draw(bodies: RenderBody[], _aim: Aim, trails: boolean) {
    const ctx = this.ctx
    ctx.fillStyle = trails ? 'rgba(5, 6, 15, 0.16)' : '#05060f'
    ctx.fillRect(0, 0, this.w, this.h)
    for (const b of bodies) {
      if (b.star) {
        const R = b.r * 3.4
        const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.5, b.x, b.y, R)
        g.addColorStop(0, `hsla(${b.hue} 100% 78% / 0.5)`)
        g.addColorStop(0.35, `hsla(${b.hue} 100% 66% / 0.14)`)
        g.addColorStop(1, `hsla(${b.hue} 100% 60% / 0)`)
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = b.star
        ? `hsl(${b.hue} 100% 74%)`
        : `hsl(${b.hue} 78% ${Math.min(86, 58 + b.r * 2)}%)`
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill()
    }
  }

  clear() {
    this.ctx.fillStyle = '#05060f'
    this.ctx.fillRect(0, 0, this.w, this.h)
  }

  dispose() {}
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  try {
    if (canvas.getContext('webgl2')) return new GLRenderer(canvas)
  } catch (e) {
    console.warn('[orbit] WebGL2 unavailable, falling back to 2D', e)
  }
  return new Canvas2DRenderer(canvas)
}

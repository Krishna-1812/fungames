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

uniform vec2 u_res;
uniform float u_pad;

out vec2 vQuad;
out vec3 vColor;
out float vRadius;
out float vSeed;
out float vSpin;
out vec2 vCentre;

void main() {
  vQuad = position.xy;
  vColor = iColor;
  vRadius = iRadius;
  vSeed = iSeed;
  vSpin = iSpin;
  vCentre = iPos;

  vec2 px = iPos + position.xy * iRadius * u_pad;
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

const PLANET_FRAG = BODY_HEAD + `
${BODY_COMMON}

void main() {
  // vQuad spans -1..1 across the padded quad, so the sphere itself has radius
  // 1/u_pad within it.
  float sr = 1.0 / u_pad;
  vec2 p = vQuad / sr;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;

  vec3 n = vec3(p, sqrt(max(0.0, 1.0 - r2)));

  // Surface. Two octave sets: continents at low frequency, relief on top.
  vec3 sp = spun(n, vSpin + vSeed * 6.283);
  float land = fbm3(sp * 2.1 + vSeed * 31.0, 5);
  float relief = ridge3(sp * 5.5 + vSeed * 17.0, 4);

  // Bands for the gas giants, latitude-only so they read as circulation.
  float bands = sin(sp.y * 11.0 + fbm3(sp * 3.0 + vSeed * 5.0, 3) * 4.0) * 0.5 + 0.5;
  float gas = smoothstep(0.45, 0.85, fract(vSeed * 7.31));

  vec3 rock = mix(vColor * 0.55, vColor * 1.25, smoothstep(0.35, 0.72, land));
  rock = mix(rock, rock * 1.5, relief * 0.55);
  vec3 giant = mix(vColor * 0.7, vColor * 1.35, bands);
  vec3 albedo = mix(rock, giant, gas);

  // Ice at the poles, only on the rocky ones.
  float ice = smoothstep(0.78, 0.95, abs(sp.y)) * (1.0 - gas);
  albedo = mix(albedo, vec3(0.92, 0.95, 1.0), ice * 0.85);

  vec3 lit = vec3(0.0);
  float keyFacing = 0.0;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= u_lightCount) break;
    // The light is a point in the same 2D plane as the bodies. Giving it a
    // small +z lifts it out of the plane so a planet directly between the
    // camera and a star is not left completely unlit.
    vec2 d = u_lightPos[i] - vCentre;
    vec3 L = normalize(vec3(d / max(vRadius, 1.0), 2.2));
    float ndl = dot(n, L);
    // Wrapped diffuse. A hard terminator on a body this small aliases badly;
    // wrapping softens it the way a real atmosphere scatters light round the
    // edge.
    float diff = max(0.0, (ndl + 0.22) / 1.22);
    float atten = 1.0 / (1.0 + dot(d, d) * 0.000018);
    lit += albedo * u_lightCol[i] * diff * atten;
    keyFacing = max(keyFacing, ndl);
  }

  // Ambient from the galaxy, tinted cool so the night side is not dead black.
  lit += albedo * vec3(0.055, 0.07, 0.11);

  // Atmospheric rim: brightest where the limb is still catching the key light.
  float rim = pow(1.0 - abs(n.z), 3.0);
  lit += vColor * rim * (0.35 + max(0.0, keyFacing) * 1.5) * 0.9;

  // Antialias the silhouette — one pixel of coverage in quad units.
  float px = fwidth(length(p));
  float cov = 1.0 - smoothstep(1.0 - px, 1.0, length(p));

  fragColor = vec4(lit, cov);
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

/* The starfield and nebula. Drawn once into its own target and only redrawn on
   resize — it never changes, so re-rendering it every frame would be pure
   waste. */
const SKY_FRAG = GLSL + `
void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);

  // Nebula: two ridged layers, warm behind cool, both very dim.
  float n1 = ridge(p * 1.1 + 3.0, 5);
  float n2 = fbm(p * 0.7 - 2.0, 4);
  vec3 neb = vec3(0.16, 0.09, 0.30) * pow(n1, 2.2) * 0.9;
  neb += vec3(0.05, 0.12, 0.26) * pow(n2, 2.6) * 0.7;

  // Stars over several density layers so the field has depth rather than one
  // uniform sprinkle.
  vec3 stars = vec3(0.0);
  for (int L = 0; L < 3; L++) {
    float scale = 90.0 * pow(2.1, float(L));
    vec2 g = uv * u_res / u_res.y * scale;
    vec2 cell = floor(g);
    vec2 f = fract(g);
    vec2 jitter = hash22(cell + float(L) * 37.0);
    float present = step(0.965 - float(L) * 0.006, hash21(cell + float(L) * 91.0));
    float dist = length(f - jitter);
    float mag = hash21(cell + float(L) * 13.0);
    // Colour by a crude temperature ramp — real fields are not white.
    vec3 tint = mix(vec3(1.0, 0.78, 0.62), vec3(0.72, 0.83, 1.0), mag);
    float core = present * pow(max(0.0, 1.0 - dist * (7.0 + float(L) * 3.0)), 7.0);
    stars += tint * core * (0.5 + mag * 2.4) / (1.0 + float(L));
  }

  vec3 col = neb + stars;
  col += vec3(0.012, 0.014, 0.028); // deep-space floor, never pure black
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
      blending: NormalBlending,
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
    const sPos = sg.getAttribute('iPos') as InstancedBufferAttribute
    const sRad = sg.getAttribute('iRadius') as InstancedBufferAttribute
    const sCol = sg.getAttribute('iColor') as InstancedBufferAttribute
    const sSeed = sg.getAttribute('iSeed') as InstancedBufferAttribute
    const sSpin = sg.getAttribute('iSpin') as InstancedBufferAttribute

    const lights: { x: number; y: number; c: Vector3 }[] = []

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]
      // A stable per-body seed. Position would make the texture crawl, so this
      // uses mass and index, which stay put for a body's lifetime.
      const seed = ((b.m * 97.13 + i * 13.7) % 1000) / 1000
      const col = b.star ? starLight(b.m) : hueToLinear(b.hue, false)
      if (b.star) {
        sPos.setXY(ns, b.x * dpr, b.y * dpr)
        sRad.setX(ns, b.r * dpr)
        sCol.setXYZ(ns, col.x, col.y, col.z)
        sSeed.setX(ns, seed)
        sSpin.setX(ns, t * 0.12)
        ns++
        if (lights.length < MAX_LIGHTS) {
          lights.push({ x: b.x * dpr, y: b.y * dpr, c: col.clone().multiplyScalar(1.35) })
        }
      } else {
        pPos.setXY(np, b.x * dpr, b.y * dpr)
        pRad.setX(np, b.r * dpr)
        pCol.setXYZ(np, col.x, col.y, col.z)
        pSeed.setX(np, seed)
        // Rotation rate falls with size, so big bodies feel heavy.
        pSpin.setX(np, t * (0.5 / Math.max(1, Math.cbrt(b.m))))
        np++
      }
    }

    // With no star in the system the planets would be lit by nothing at all, so
    // a dim fill sits off-screen to keep shapes readable.
    if (!lights.length) {
      lights.push({ x: this.w * 0.5, y: -this.h * 0.6, c: new Vector3(0.5, 0.55, 0.7) })
    }

    for (const a of [pPos, pRad, pCol, pSeed, pSpin]) a.needsUpdate = true
    for (const a of [sPos, sRad, sCol, sSeed, sSpin]) a.needsUpdate = true
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
    // Planets need only a sliver of padding for the atmosphere; a star's corona
    // needs a lot, and paying that cost on every planet would be wasteful.
    this.planetMat.uniforms.u_pad.value = 1.35
    this.starMat.uniforms.u_pad.value = 6.0

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

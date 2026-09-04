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
 *   bodies ──► scene RT ──► accumulation RT ──► bloom chain ──► ACES ──► screen
 *                              ▲     │
 *                              └─────┘  previous frame × fade = trails
 *
 * Trails still come from feeding the previous frame back rather than storing
 * history, exactly as the 2D version did — but in linear HDR, so a bright star
 * leaves a trail that actually glows through the bloom instead of a grey smear.
 *
 * Colours are emitted well above 1.0 on purpose. Nothing clips until the ACES
 * curve at the very end, which is what stops every star core turning into the
 * same flat white disc.
 *
 * WebGL2 is not assumed. `createRenderer` hands back a 2D-canvas implementation
 * with the same interface if it cannot get a context, so the page keeps working
 * on machines that have no GPU to give it.
 */
import * as THREE from 'three'
import { GLSL, GLSL_LIB } from './gl'

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
  x: number; y: number; m: number; r: number; hue: number; star: boolean
}
export type Aim = { x0: number; y0: number; x1: number; y1: number } | null

export interface Renderer {
  resize(w: number, h: number, dpr: number): void
  draw(bodies: RenderBody[], aim: Aim, trails: boolean, launchRadius: number): void
  /** Wipe the trail history, so Clear does not leave ghosts fading for seconds. */
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

const STAR_FRAG = BODY_HEAD + `
${BODY_COMMON}

void main() {
  float sr = 1.0 / u_pad;
  float d = length(vQuad) / sr;

  vec3 col = vec3(0.0);

  if (d < 1.0) {
    vec3 n = vec3(vQuad / sr, sqrt(max(0.0, 1.0 - d * d)));
    // Limb darkening: a real star is measurably dimmer at its edge because the
    // line of sight there passes through cooler upper photosphere. Without it
    // the disc reads as a flat sticker.
    float limb = 0.42 + 0.58 * pow(max(n.z, 0.0), 0.42);
    // Granulation, slowly boiling.
    vec3 sp = spun(n, vSpin * 0.3 + vSeed * 6.283);
    float gran = fbm3(sp * 7.0 + vec3(0.0, u_time * 0.25, 0.0), 4);
    col += vColor * limb * (2.4 + gran * 1.3);
  }

  // Corona. Two falloffs: a tight one that reads as the star's own light, and
  // a wide faint one that gives the bloom something to catch.
  float g1 = exp(-d * 3.4) * 0.85;
  float g2 = exp(-d * 1.15) * 0.10;
  // Faint anisotropy so the glow is not a perfect circle.
  float ang = atan(vQuad.y, vQuad.x);
  float rays = 1.0 + 0.16 * sin(ang * 6.0 + vSeed * 12.0);
  col += vColor * (g1 + g2) * rays;

  fragColor = vec4(col, 1.0);
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

/** accum = scene + previous × fade. */
const ACCUM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D u_scene;
uniform sampler2D u_prev;
uniform float u_fade;
void main() {
  vec3 s = texture(u_scene, vUv).rgb;
  vec3 p = texture(u_prev, vUv).rgb * u_fade;
  // Floor the feedback so trails actually reach zero. Without this the last
  // fraction of a percent lingers forever and the screen slowly greys over.
  p = max(p - 0.004, 0.0);
  fragColor = vec4(s + p, 1.0);
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
  vec3 scene = texture(u_scene, vUv).rgb;
  vec3 bloom = texture(u_bloom, vUv).rgb;
  vec3 sky = texture(u_sky, vUv).rgb;

  vec3 col = sky + scene + bloom * u_bloomStrength;

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
  private renderer: THREE.WebGLRenderer
  private cam = new THREE.Camera()
  private w = 0
  private h = 0
  private dpr = 1

  private scene = new THREE.Scene()
  private planetMesh!: THREE.Mesh
  private starMesh!: THREE.Mesh
  private planetMat!: THREE.RawShaderMaterial
  private starMat!: THREE.RawShaderMaterial
  private planetGeo!: THREE.InstancedBufferGeometry
  private starGeo!: THREE.InstancedBufferGeometry

  private sceneRT!: THREE.WebGLRenderTarget
  private accum: THREE.WebGLRenderTarget[] = []
  private skyRT!: THREE.WebGLRenderTarget
  private bloomRT: THREE.WebGLRenderTarget[] = []
  private cur = 0

  private fsScene = new THREE.Scene()
  private fsQuad: THREE.Mesh
  private passes: Record<string, THREE.RawShaderMaterial> = {}

  private cap = 512
  private t0 = performance.now()

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      depth: false,
      stencil: false,
    })
    // Everything is tonemapped by hand in the composite pass, so three must not
    // also convert on the way out.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.renderer.autoClear = false

    // The fullscreen pass builds its triangle from gl_VertexID, so the contents
    // of this attribute are never read — but three sizes the draw call from
    // `position`, so three vertices of it have to exist.
    const fsGeo = new THREE.BufferGeometry()
    fsGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3))
    this.fsQuad = new THREE.Mesh(fsGeo)
    this.fsQuad.frustumCulled = false
    this.fsScene.add(this.fsQuad)

    this.buildPasses()
    this.buildBodies()
  }

  private pass(frag: string, uniforms: Record<string, THREE.IUniform>) {
    return new THREE.RawShaderMaterial({
      vertexShader: noVersion(FS_VERT),
      fragmentShader: noVersion(frag),
      uniforms,
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
    })
  }

  private buildPasses() {
    this.passes.sky = this.pass(SKY_FRAG, {
      u_time: { value: 0 }, u_res: { value: new THREE.Vector2() },
      u_pointer: { value: new THREE.Vector2(0.5, 0.5) }, u_dpr: { value: 1 },
    })
    this.passes.accum = this.pass(ACCUM_FRAG, {
      u_scene: { value: null }, u_prev: { value: null }, u_fade: { value: 0.86 },
    })
    this.passes.bright = this.pass(BRIGHT_FRAG, {
      u_src: { value: null }, u_threshold: { value: 1.05 },
    })
    this.passes.down = this.pass(DOWN_FRAG, {
      u_src: { value: null }, u_texel: { value: new THREE.Vector2() },
    })
    this.passes.up = this.pass(UP_FRAG, {
      u_src: { value: null }, u_texel: { value: new THREE.Vector2() }, u_radius: { value: 1.0 },
    })
    this.passes.composite = this.pass(COMPOSITE_FRAG, {
      u_scene: { value: null }, u_bloom: { value: null }, u_sky: { value: null },
      u_res: { value: new THREE.Vector2() }, u_bloomStrength: { value: 0.34 },
      u_time: { value: 0 },
    })
  }

  private makeGeo(cap: number) {
    const g = new THREE.InstancedBufferGeometry()
    // itemSize 3, not 2: three reads x/y/z when it computes bounds and a
  // 2-component attribute gives it a NaN radius on every geometry.
  g.setAttribute('position', new THREE.Float32BufferAttribute(
      [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2))
    g.setAttribute('iRadius', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1))
    g.setAttribute('iColor', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3))
    g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1))
    g.setAttribute('iSpin', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1))
    g.instanceCount = 0
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return g
  }

  private bodyUniforms() {
    return {
      u_res: { value: new THREE.Vector2() },
      u_pad: { value: 1.0 },
      u_time: { value: 0 },
      u_lightCount: { value: 0 },
      u_lightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector2()) },
      u_lightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
    }
  }

  private buildBodies() {
    this.planetGeo = this.makeGeo(this.cap)
    this.starGeo = this.makeGeo(this.cap)

    this.planetMat = new THREE.RawShaderMaterial({
      vertexShader: noVersion(BODY_VERT),
      fragmentShader: noVersion(PLANET_FRAG),
      uniforms: this.bodyUniforms(),
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      // DoubleSide is load-bearing. The vertex shader flips Y to convert
      // screen space (Y down) to clip space (Y up), and that negation reverses
      // every triangle's winding -- so with the default FrontSide every body
      // quad is back-facing and silently culled. Nothing errors; they simply
      // never appear.
      side: THREE.DoubleSide,
    })
    this.starMat = new THREE.RawShaderMaterial({
      vertexShader: noVersion(BODY_VERT),
      fragmentShader: noVersion(STAR_FRAG),
      uniforms: this.bodyUniforms(),
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Stars and their coronae add light to whatever is behind them; they never
      // occlude it.
      blending: THREE.AdditiveBlending,
      // DoubleSide is load-bearing. The vertex shader flips Y to convert
      // screen space (Y down) to clip space (Y up), and that negation reverses
      // every triangle's winding -- so with the default FrontSide every body
      // quad is back-facing and silently culled. Nothing errors; they simply
      // never appear.
      side: THREE.DoubleSide,
    })

    this.planetMesh = new THREE.Mesh(this.planetGeo, this.planetMat)
    this.starMesh = new THREE.Mesh(this.starGeo, this.starMat)
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
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    } as const

    for (const rt of [this.sceneRT, this.skyRT, ...this.accum, ...this.bloomRT]) rt?.dispose()
    this.accum = []
    this.bloomRT = []

    this.sceneRT = new THREE.WebGLRenderTarget(this.w, this.h, opts)
    this.skyRT = new THREE.WebGLRenderTarget(this.w, this.h, opts)
    this.accum = [
      new THREE.WebGLRenderTarget(this.w, this.h, opts),
      new THREE.WebGLRenderTarget(this.w, this.h, opts),
    ]
    let bw = this.w, bh = this.h
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1)
      this.bloomRT.push(new THREE.WebGLRenderTarget(bw, bh, opts))
    }

    for (const m of [this.planetMat, this.starMat]) m.uniforms.u_res.value.set(this.w, this.h)
    this.passes.composite.uniforms.u_res.value.set(this.w, this.h)
    this.passes.sky.uniforms.u_res.value.set(this.w, this.h)

    // The sky is static, so it is rendered once here rather than every frame.
    this.blit(this.passes.sky, this.skyRT)

    // A resize invalidates the trail history; clearing avoids a stretched ghost.
    for (const rt of this.accum) {
      this.renderer.setRenderTarget(rt)
      this.renderer.clear(true, false, false)
    }
    this.renderer.setRenderTarget(null)
  }

  private blit(mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null) {
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
    const pPos = pg.getAttribute('iPos') as THREE.InstancedBufferAttribute
    const pRad = pg.getAttribute('iRadius') as THREE.InstancedBufferAttribute
    const pCol = pg.getAttribute('iColor') as THREE.InstancedBufferAttribute
    const pSeed = pg.getAttribute('iSeed') as THREE.InstancedBufferAttribute
    const pSpin = pg.getAttribute('iSpin') as THREE.InstancedBufferAttribute
    const sPos = sg.getAttribute('iPos') as THREE.InstancedBufferAttribute
    const sRad = sg.getAttribute('iRadius') as THREE.InstancedBufferAttribute
    const sCol = sg.getAttribute('iColor') as THREE.InstancedBufferAttribute
    const sSeed = sg.getAttribute('iSeed') as THREE.InstancedBufferAttribute
    const sSpin = sg.getAttribute('iSpin') as THREE.InstancedBufferAttribute

    const lights: { x: number; y: number; c: THREE.Vector3 }[] = []

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]
      // A stable per-body seed. Position would make the texture crawl, so this
      // uses mass and index, which stay put for a body's lifetime.
      const seed = ((b.m * 97.13 + i * 13.7) % 1000) / 1000
      const col = hueToLinear(b.hue, b.star)
      if (b.star) {
        sPos.setXY(ns, b.x * dpr, b.y * dpr)
        sRad.setX(ns, b.r * dpr)
        sCol.setXYZ(ns, col.x, col.y, col.z)
        sSeed.setX(ns, seed)
        sSpin.setX(ns, t * 0.12)
        ns++
        if (lights.length < MAX_LIGHTS) {
          lights.push({ x: b.x * dpr, y: b.y * dpr, c: col.clone().multiplyScalar(2.6) })
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
      lights.push({ x: this.w * 0.5, y: -this.h * 0.6, c: new THREE.Vector3(0.5, 0.55, 0.7) })
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
    this.starMat.uniforms.u_pad.value = 7.0

    // 1. bodies -> sceneRT
    this.renderer.setRenderTarget(this.sceneRT)
    this.renderer.clear(true, false, false)
    this.renderer.render(this.scene, this.cam)

    // 2. accumulate trails
    const prev = this.accum[this.cur]
    const next = this.accum[this.cur ^ 1]
    this.passes.accum.uniforms.u_scene.value = this.sceneRT.texture
    this.passes.accum.uniforms.u_prev.value = prev.texture
    this.passes.accum.uniforms.u_fade.value = trails ? 0.9 : 0.0
    this.blit(this.passes.accum, next)
    this.cur ^= 1

    // 3. bloom chain
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
      this.passes.up.blending = THREE.AdditiveBlending
      this.blit(this.passes.up, this.bloomRT[i - 1])
    }
    this.passes.up.blending = THREE.NormalBlending

    // 4. composite to screen
    this.passes.composite.uniforms.u_scene.value = next.texture
    this.passes.composite.uniforms.u_bloom.value = this.bloomRT[0].texture
    this.passes.composite.uniforms.u_sky.value = this.skyRT.texture
    this.passes.composite.uniforms.u_time.value = t
    this.blit(this.passes.composite, null)

    void aim
  }

  clear() {
    if (!this.w) return
    for (const rt of [...this.accum, this.sceneRT]) {
      this.renderer.setRenderTarget(rt)
      this.renderer.clear(true, false, false)
    }
    this.renderer.setRenderTarget(null)
  }

  dispose() {
    for (const rt of [this.sceneRT, this.skyRT, ...this.accum, ...this.bloomRT]) rt?.dispose()
    this.planetGeo.dispose(); this.starGeo.dispose()
    this.planetMat.dispose(); this.starMat.dispose()
    for (const k in this.passes) this.passes[k].dispose()
    this.renderer.dispose()
  }
}

/** Body hue -> linear HDR colour. Stars are emitted well above 1. */
function hueToLinear(hue: number, star: boolean) {
  const c = new THREE.Color()
  c.setHSL(hue / 360, star ? 0.55 : 0.62, star ? 0.72 : 0.55)
  // setHSL gives sRGB; the pipeline is linear throughout.
  return new THREE.Vector3(
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

/**
 * The shader runtime: everything on this site that draws with the GPU goes
 * through here.
 *
 * Three things this solves that a per-page `getContext('webgl2')` does not:
 *
 * 1. **One frame loop.** Browsers cap live WebGL contexts (~8–16) and every
 *    extra `requestAnimationFrame` driver costs a callback per frame. Surfaces
 *    register with one shared ticker, so ten shaders on a page cost one rAF.
 * 2. **Off-screen surfaces stop costing anything.** An IntersectionObserver
 *    parks a surface that has scrolled away, and `visibilitychange` parks the
 *    whole page. A long scroll with shaders in it stays at 60 fps.
 * 3. **First paint never waits on rAF.** rAF is throttled to zero in a
 *    background tab, so a page opened in one and switched to later would render
 *    nothing at all. Surfaces draw one frame synchronously on mount, exactly as
 *    Powder, Orbit and Fusion already do with 2D canvas.
 *
 * Reduced motion is honoured by drawing that single frame and then never
 * animating — the art still lands, it just holds still.
 */

/** Clamped because a 3× phone screen costs 9× the fragments for no visible gain. */
const MAX_DPR = 2

export const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

/* -------------------------------------------------------------------------- */
/* Shared ticker                                                              */
/* -------------------------------------------------------------------------- */

type Tick = (t: number, dt: number) => void

const ticks = new Set<Tick>()
let raf = 0
let last = 0

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  // Clamped so a tab that was parked for a minute does not resume with a
  // one-minute dt and blow every simulation apart on the first step.
  const dt = Math.min((now - last) / 1000, 1 / 20)
  last = now
  for (const fn of ticks) fn(now / 1000, dt)
}

function addTick(fn: Tick) {
  ticks.add(fn)
  if (!raf) {
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
}

function removeTick(fn: Tick) {
  ticks.delete(fn)
  if (!ticks.size && raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (raf) { cancelAnimationFrame(raf); raf = 0 }
  } else if (ticks.size && !raf) {
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
})

/* -------------------------------------------------------------------------- */
/* Shader compilation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A fullscreen triangle, not a quad. One triangle that overhangs the viewport
 * covers every pixel with three vertices instead of six and avoids the diagonal
 * seam where two triangles meet, which shows up in derivative-based effects.
 */
const VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

function shader(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    // Surfaced with line numbers — a silent black canvas is the worst possible
    // failure mode for something purely decorative.
    const log = gl.getShaderInfoLog(s) ?? ''
    const numbered = src.split('\n').map((l, i) => `${String(i + 1).padStart(3)} | ${l}`).join('\n')
    console.error(`[gl] shader failed to compile\n${log}\n${numbered}`)
    gl.deleteShader(s)
    return null
  }
  return s
}

export function program(gl: WebGL2RenderingContext, frag: string, vert = VERT) {
  const v = shader(gl, gl.VERTEX_SHADER, vert)
  const f = shader(gl, gl.FRAGMENT_SHADER, frag)
  if (!v || !f) return null
  const p = gl.createProgram()!
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[gl] link failed\n' + gl.getProgramInfoLog(p))
    gl.deleteProgram(p)
    return null
  }
  return p
}

/* -------------------------------------------------------------------------- */
/* ShaderSurface                                                              */
/* -------------------------------------------------------------------------- */

export type SurfaceOpts = {
  /**
   * Extra uniforms, re-read every frame. A number, a 2–4 element array for a
   * vec, or a Float32Array for a GLSL array uniform (`uniform float x[N]`).
   */
  uniforms?: () => Record<string, number | number[] | Float32Array>
  /** Draw behind page content and ignore pointer events. Default true. */
  decorative?: boolean
  /** Render one frame and stop. Implied by prefers-reduced-motion. */
  still?: boolean
  /** Scale the backing store below DPR — useful for expensive fragment work. */
  scale?: number
  /** Called after the context is lost and successfully restored. */
  onRestore?: () => void
}

/**
 * A shader painted across an element. Handles sizing, uniforms, pausing and
 * WebGL context loss, which browsers do trigger in the wild when a machine
 * sleeps or the GPU process is recycled.
 */
export class ShaderSurface {
  readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext | null = null
  private prog: WebGLProgram | null = null
  private locs = new Map<string, WebGLUniformLocation | null>()
  private vao: WebGLVertexArrayObject | null = null
  private ro: ResizeObserver | null = null
  private io: IntersectionObserver | null = null
  private tick: Tick
  private visible = true
  private running = false
  private t0 = performance.now()
  private w = 0
  private h = 0
  private pointer = [0.5, 0.5]
  private frag: string

  constructor(private host: HTMLElement, frag: string, private opts: SurfaceOpts = {}) {
    this.frag = frag
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'gl-surface'
    if (opts.decorative !== false) this.canvas.setAttribute('aria-hidden', 'true')

    this.tick = (t) => this.render(t)

    host.appendChild(this.canvas)
    this.init()
  }

  private init() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      // The compositor never reads back from these, and telling it so lets the
      // driver keep the surface in tiled memory on mobile GPUs.
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    })

    // No WebGL2 means the CSS underneath this element is what the visitor gets.
    // Every page that uses a surface keeps a real gradient behind it for exactly
    // this case, so the fallback is a still image rather than a hole.
    if (!gl) {
      this.canvas.remove()
      return
    }

    this.gl = gl
    this.prog = program(gl, this.frag)
    if (!this.prog) { this.canvas.remove(); this.gl = null; return }

    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)

    this.canvas.addEventListener('webglcontextlost', this.onLost, false)
    this.canvas.addEventListener('webglcontextrestored', this.onRestored, false)

    // Size immediately rather than in rAF — see the module docblock.
    this.resize()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.host)

    this.render(0)

    if (this.opts.still || prefersReducedMotion) return

    this.io = new IntersectionObserver(
      ([e]) => {
        this.visible = e.isIntersecting
        this.visible ? this.start() : this.stop()
      },
      { rootMargin: '120px' },
    )
    this.io.observe(this.host)
  }

  private onLost = (e: Event) => {
    e.preventDefault() // without this the context is never restorable
    this.stop()
  }

  private onRestored = () => {
    this.locs.clear()
    this.init()
    this.opts.onRestore?.()
  }

  /** Pointer in 0..1 element space. Pages feed this from their own listeners. */
  setPointer(x: number, y: number) {
    this.pointer[0] = x
    this.pointer[1] = y
  }

  private resize() {
    const gl = this.gl
    if (!gl) return
    const r = this.host.getBoundingClientRect()
    const scale = (this.opts.scale ?? 1) * Math.min(devicePixelRatio || 1, MAX_DPR)
    // A zero-size host means the element is not laid out yet; the
    // ResizeObserver will call back the moment it is.
    const w = Math.max(1, Math.round(r.width * scale))
    const h = Math.max(1, Math.round(r.height * scale))
    if (w === this.w && h === this.h) return
    this.w = w
    this.h = h
    this.canvas.width = w
    this.canvas.height = h
    gl.viewport(0, 0, w, h)
    // Redraw at the new size straight away so a resize never shows a stretched
    // or blank frame, even while parked.
    if (!this.running) this.render((performance.now() - this.t0) / 1000)
  }

  private uniform(name: string, value: number | number[] | Float32Array) {
    const gl = this.gl!
    if (!this.locs.has(name)) this.locs.set(name, gl.getUniformLocation(this.prog!, name))
    const loc = this.locs.get(name)
    if (!loc) return
    if (typeof value === 'number') gl.uniform1f(loc, value)
    // A Float32Array means a GLSL array uniform, whatever its length — it is the
    // only way to hand a shader a variable-length list without a texture.
    else if (value instanceof Float32Array) gl.uniform1fv(loc, value)
    else if (value.length === 2) gl.uniform2f(loc, value[0], value[1])
    else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2])
    else if (value.length === 4) gl.uniform4f(loc, value[0], value[1], value[2], value[3])
  }

  private render(t: number) {
    const gl = this.gl
    if (!gl || !this.prog) return
    gl.useProgram(this.prog)
    gl.bindVertexArray(this.vao)

    this.uniform('u_time', t)
    this.uniform('u_res', [this.w, this.h])
    this.uniform('u_pointer', this.pointer)
    this.uniform('u_dpr', Math.min(devicePixelRatio || 1, MAX_DPR))

    const extra = this.opts.uniforms?.()
    if (extra) for (const k in extra) this.uniform(k, extra[k])

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /**
   * Draw one frame now.
   *
   * Needed by surfaces driven by page state rather than by time — Scale's
   * environment is a function of scroll position. Under reduced motion, or
   * with `still`, the ticker never runs, so without this a scroll would leave
   * the first frame frozen on screen while the page around it changed.
   */
  redraw() {
    this.render((performance.now() - this.t0) / 1000)
  }

  start() {
    if (this.running || !this.gl || this.opts.still || prefersReducedMotion) return
    this.running = true
    addTick(this.tick)
  }

  stop() {
    if (!this.running) return
    this.running = false
    removeTick(this.tick)
  }

  dispose() {
    this.stop()
    this.ro?.disconnect()
    this.io?.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    const ext = this.gl?.getExtension('WEBGL_lose_context')
    ext?.loseContext()
    this.canvas.remove()
    this.gl = null
  }
}

/* -------------------------------------------------------------------------- */
/* GLSL library                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Prepended to every fragment shader on the site. Keeping one copy means the
 * noise in Powder's smoke and the noise in the homepage nebula are literally
 * the same function, which is a large part of why the pages read as one place.
 */
export const GLSL_PRELUDE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform float u_time;
uniform vec2  u_res;
uniform vec2  u_pointer;
uniform float u_dpr;
`

/**
 * The pure half: no uniforms, no in/out declarations. Shaders that are not
 * fullscreen passes — Orbit's instanced sphere impostors, for one — need the
 * noise and the tonemapper without inheriting a fullscreen pass's plumbing.
 */
export const GLSL_LIB = `
#define PI  3.14159265359
#define TAU 6.28318530718

// Integer hash — no trig, so it stays identical across GPU vendors. The sin()
// hashes everyone copies drift between drivers and make noise look different
// on a phone than on a laptop.
float hash11(float p) {
  // Via int, not straight to uint: converting a negative float to uint is
  // undefined in GLSL ES, and half of every coordinate space is negative.
  uint n = uint(int(p * 1000.0));
  n = (n << 13U) ^ n;
  n = n * (n * n * 15731U + 789221U) + 1376312589U;
  return float(n & 0x7fffffffU) / float(0x7fffffff);
}
float hash21(vec2 p) {
  uvec2 q = uvec2(ivec2(p * 1000.0)) * uvec2(1597334673U, 3812015801U);
  uint n = (q.x ^ q.y) * 1597334673U;
  return float(n & 0x7fffffffU) / float(0x7fffffff);
}
vec2 hash22(vec2 p) {
  uvec2 q = uvec2(ivec2(p * 1000.0)) * uvec2(1597334673U, 3812015801U);
  q = (q.x ^ q.y) * uvec2(1597334673U, 3812015801U);
  return vec2(q) / float(0xffffffffU);
}

// Gradient noise. Quintic fade so the second derivative is continuous, which
// matters the moment anything lights or embosses the result.
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, int oct) {
  float v = 0.0, a = 0.5;
  // Irrational rotation between octaves kills the axis-aligned grid that plain
  // scaling leaves behind.
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    v += a * noise(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

/* 3D value noise. Needed the moment anything is textured on a sphere: sampling
   2D noise by latitude/longitude pinches at the poles and shows a seam down
   the back, which is exactly where a planet's terminator draws the eye. */
float hash31(vec3 p) {
  uvec3 q = uvec3(ivec3(p * 1000.0)) * uvec3(1597334673U, 3812015801U, 2798796415U);
  uint n = (q.x ^ q.y ^ q.z) * 1597334673U;
  return float(n & 0x7fffffffU) / float(0x7fffffff);
}

float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(mix(hash31(i + vec3(0, 0, 0)), hash31(i + vec3(1, 0, 0)), u.x),
        mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), u.x),
        mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
}

float fbm3(vec3 p, int oct) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    v += a * noise3(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

float ridge3(vec3 p, int oct) {
  float v = 0.0, a = 0.5, prev = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(noise3(p) * 2.0 - 1.0);
    n *= n * prev;
    prev = n;
    v += a * n;
    p *= 2.07;
    a *= 0.5;
  }
  return v;
}

// Ridged variant — the sharp filaments in nebulae, lava and smoke.
float ridge(vec2 p, int oct) {
  float v = 0.0, a = 0.5, prev = 1.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
    n *= n * prev;
    prev = n;
    v += a * n;
    p = rot * p * 2.06;
    a *= 0.5;
  }
  return v;
}

// ACES filmic tonemap. Everything here renders in unbounded HDR and lands
// through this, which is what stops bright cores clipping to flat white.
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 toSRGB(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }

// Ordered dithering before quantisation to 8 bits. Without it, any smooth
// gradient across a large dark area bands visibly — the single most common
// reason a nice shader looks cheap on a real monitor.
vec3 ditherAt(vec3 c, vec2 px, float t) {
  float n = hash21(px + fract(t) * 17.0);
  return c + (n - 0.5) / 255.0;
}

/** Pixel coords normalised to -1..1 on the short axis, origin centred. */
vec2 centredAt(vec2 uv, vec2 res) {
  return (uv * res * 2.0 - res) / min(res.x, res.y);
}
`

/** Prelude, library, and the uniform-aware wrappers a fullscreen pass expects. */
export const GLSL = GLSL_PRELUDE + GLSL_LIB + `
vec3 dither(vec3 c, vec2 px) { return ditherAt(c, px, u_time); }
vec2 centred(vec2 uv) { return centredAt(uv, u_res); }
`

/** Concatenate the shared library with a shader body. */
export const glsl = (body: string) => GLSL + '\n' + body

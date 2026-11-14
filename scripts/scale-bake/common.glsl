#version 300 es
/* Scale's studio.
 *
 * Every solid object in Scale is a small signed-distance model, photographed
 * here once: an orthographic camera, one key light from the upper left (the
 * same direction the page's live planets are lit from), a sky dome, a cool
 * rim from behind, soft shadows and ambient occlusion. `bake-scale.mjs` runs
 * this in a headless browser at sixteen samples a pixel and saves the picture;
 * the page only ever shows the picture, so a phone gets the same render a
 * desktop does and nothing here has to be fast.
 *
 * A model supplies three things after this file:
 *
 *   vec2 map(vec3 p)                      distance, material id
 *   Mat  material(float id, vec3 p, vec3 n)
 *   and may #define VIEW_YAW / VIEW_PITCH (radians), STEP (0..1), EXPOSURE.
 *
 * Units: the object's longest real dimension is 1, centred on the origin,
 * x right, y up, z towards the camera.
 */
precision highp float;
precision highp int;

uniform vec2 u_res;   // image size in pixels
uniform vec2 u_jit;   // sub-pixel jitter for this sample, in pixels
uniform vec2 u_half;  // half the framed window, in model units
out vec4 o;

#define PI 3.14159265359
#define TAU 6.28318530718

struct Mat {
  vec3 alb;     // base colour, linear
  float rough;  // 0 mirror .. 1 chalk
  float metal;  // 0 dielectric .. 1 metal
  float sss;    // 0 none .. 1 light passes through (skin, cells, wax)
  vec3 emit;    // self-light
};
Mat mat(vec3 alb, float rough, float metal) { return Mat(alb, rough, metal, 0.0, vec3(0.0)); }

/* ---- colour ---- */
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 hex(int h) { return lin(vec3(float((h >> 16) & 255), float((h >> 8) & 255), float(h & 255)) / 255.0); }

/* ---- hash and noise ---- */
float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
vec2 hash22(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }

float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float ridged(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { float n = 1.0 - abs(noise(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.07 + 9.3; a *= 0.5; } return s; }

/** Cell noise: x = distance to the nearest point, y = to the second, z = an id. */
vec3 voronoi(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 q = g + hash33(i + g) - f;
    float d = dot(q, q);
    if (d < d1) { d2 = d1; d1 = d; id = hash31(i + g + 7.7); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
vec3 voronoi(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
    vec2 g = vec2(float(x), float(y));
    vec2 q = g + hash22(i + g) - f;
    float d = dot(q, q);
    if (d < d1) { d2 = d1; d1 = d; id = hash21(i + g + 7.7); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}

/* ---- shapes ---- */
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRound(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
/** A capsule whose radius runs from ra at a to rb at b. */
float sdCone(vec3 p, vec3 a, vec3 b, float ra, float rb) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(ra, rb, h); }
float sdTorus(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }
/** A cylinder along y. */
float sdCyl(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
/** Union that carries the material of the nearer surface. */
vec2 U(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

/**
 * The nearest of a scatter of roughly 4*PI*k*k points on the unit sphere:
 * xyz is the point, w an id for it. Jittered cells in one shell, so the
 * spacing is even enough to be spikes on a virus and uneven enough not to be
 * a lattice.
 */
vec4 scatter(vec3 d, float k) {
  vec3 g = d * k, i = floor(g);
  float best = 9.0; vec4 res = vec4(d, 0.0);
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 c = i + vec3(float(x), float(y), float(z));
    vec3 q = c + 0.15 + 0.7 * hash33(c);
    float l = length(q);
    if (abs(l - k) > 0.5) continue;
    vec3 s = q / l;
    float dd = dot(s - d, s - d);
    if (dd < best) { best = dd; res = vec4(s, hash31(c + 3.1)); }
  }
  return res;
}

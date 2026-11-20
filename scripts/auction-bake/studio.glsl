/* The Auction Game's catalogue photographer.
 *
 * Appended after scale-bake/common.glsl (the shared hashes, noise, shapes and
 * the Mat struct) and one lot's model from auction-bake/lots/. Every lot is
 * shot the way a saleroom shoots its catalogue: on a seamless sweep, a large
 * softbox high on the left, a cool strip light behind on the right, a pool of
 * light on the backdrop behind the lot and the sweep falling away to the
 * colour the page's rostrum is painted, so the photograph has no edge on the
 * page. `bake-auction.mjs` renders it at sixteen samples a pixel, each with
 * the key light moved to a different point of the softbox, so the shadows are
 * really soft rather than blurred.
 *
 * A model supplies, before this file:
 *
 *   #define BOUND vec3(...)   half-extents of the lot, which stands on y = 0,
 *                             centred on x and z, facing +z (CENTRE moves
 *                             the box when the lot is not centred)
 *   vec2 map(vec3 p)          distance, material id (1 or more)
 *   Mat  material(float id, vec3 p, vec3 n)
 *
 * and may define VIEW_YAW / VIEW_PITCH (radians: the camera walks round to the
 * right and climbs), FILL (how much of the frame the lot's box fills), STEP,
 * EXPOSURE, COAT(id) (0..1 of a varnish or lacquer over the material),
 * GEM (the id of a cut stone) and SHEEN(id) (0..1 of a velvet or fur edge).
 */

#ifndef VIEW_YAW
#define VIEW_YAW 0.42
#endif
#ifndef VIEW_PITCH
#define VIEW_PITCH 0.24
#endif
#ifndef STEP
#define STEP 0.9
#endif
#ifndef EXPOSURE
#define EXPOSURE 1.0
#endif
#ifndef FILL
#define FILL 0.72
#endif
#ifndef COAT
#define COAT(id) 0.0
#endif
#ifndef SHEEN
#define SHEEN(id) 0.0
#endif
#ifndef GEM
#define GEM -1.0
#endif
#ifndef CENTRE
#define CENTRE vec3(0.0, BOUND.y, 0.0)
#endif
#ifndef DROP
#define DROP 0.05
#endif

#define SC max(BOUND.x, max(BOUND.y, BOUND.z))

/* The sweep, in display colour: the pool of light behind the lot and the
   colour it falls to, which is the rostrum's own (#151b22). */
const vec3 EDGE = vec3(0.0823, 0.1059, 0.1333);
const vec3 POOL = vec3(0.415, 0.462, 0.522);

/* Lights in the camera's frame (x right, y up, z towards the camera), so a
   turned view keeps the same lighting. */
const vec3 KEY_C = vec3(-0.62, 0.66, 0.42);
const vec3 RIM_C = vec3(0.70, 0.42, -0.58);
const vec3 FILL_C = vec3(0.86, 0.12, 0.50);

vec3 camR, camU, camF;
vec3 toWorld(vec3 c) { return normalize(c.x * camR + c.y * camU - c.z * camF); }
vec3 toCam(vec3 w) { return vec3(dot(w, camR), dot(w, camU), -dot(w, camF)); }

float map1(vec3 p) { return map(p).x; }

vec3 normalAt(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.00025 * SC;
  return normalize(e.xyy * map1(p + e.xyy) + e.yyx * map1(p + e.yyx) + e.yxy * map1(p + e.yxy) + e.xxx * map1(p + e.xxx));
}

float shadow(vec3 p, vec3 l) {
  float res = 1.0, t = 0.002 * SC;
  for (int i = 0; i < 120; i++) {
    float h = map1(p + l * t);
    res = min(res, 14.0 * h / t);
    t += clamp(h * STEP, 0.0015 * SC, 0.05 * SC);
    if (res < 0.002 || t > 5.0 * SC) break;
  }
  return clamp(res, 0.0, 1.0);
}

float occlusion(vec3 p, vec3 n, float reach) {
  float occ = 0.0, w = 1.0;
  for (int i = 1; i <= 7; i++) {
    float h = reach * (0.02 + 0.13 * float(i * i) / 49.0);
    occ += (h - min(map1(p + n * h), h)) * w / reach;
    w *= 0.75;
  }
  return clamp(1.0 - 3.2 * occ, 0.0, 1.0);
}

/* The studio as reflections see it, in the camera's frame. */
vec3 env(vec3 d) {
  vec3 c = mix(vec3(0.010, 0.013, 0.017), vec3(0.06, 0.07, 0.085), smoothstep(-0.4, 0.8, d.y));
  // The sweep below and behind: the lit pool.
  c += pow(POOL, vec3(2.2)) * 0.5 * smoothstep(0.1, -0.5, d.y);
  // The softbox: a big rectangle, bright and slightly cool-white.
  vec3 k = normalize(KEY_C), kx = normalize(cross(vec3(0.0, 1.0, 0.0), k)), ky = cross(k, kx);
  float kb = smoothstep(0.30, 0.26, abs(dot(d, kx))) * smoothstep(0.22, 0.18, abs(dot(d, ky))) * step(0.0, dot(d, k));
  c += vec3(1.0, 0.985, 0.96) * 7.0 * kb * (0.85 + 0.15 * smoothstep(0.3, 0.0, abs(dot(d, kx))));
  // The strip behind on the right: tall and narrow, a little cooler.
  vec3 r = normalize(RIM_C), rx = normalize(cross(vec3(0.0, 1.0, 0.0), r));
  float rb = smoothstep(0.075, 0.05, abs(dot(d, rx))) * smoothstep(0.5, 0.42, abs(d.y - r.y)) * step(0.0, dot(d, r));
  c += vec3(0.80, 0.88, 1.0) * 5.0 * rb;
  // A white bounce card on the right, low.
  vec3 f = normalize(FILL_C);
  c += vec3(0.85, 0.88, 0.92) * 0.9 * smoothstep(0.82, 0.95, dot(d, f));
  // The ceiling: one dim overhead panel.
  c += vec3(0.6, 0.64, 0.7) * 0.6 * smoothstep(0.86, 0.97, d.y);
  return c;
}

float ggx(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }

vec3 lightFrom(vec3 l, vec3 lc, vec3 n, vec3 v, Mat m, vec3 f0, float sheen) {
  float nl = dot(n, l);
  float wrap = m.sss * 0.6;
  float diff = max(0.0, (nl + wrap) / (1.0 + wrap));
  vec3 h = normalize(l + v);
  float nh = max(dot(n, h), 0.0), vh = max(dot(v, h), 0.0);
  float a = max(m.rough * m.rough, 0.003);
  vec3 f = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  float spec = ggx(nh, a) * 0.25 / max(0.1, mix(1.0, vh * vh * 4.0, 0.5));
  // Velvet and fur light up at the silhouette, where the fibres face you.
  float nv = max(dot(n, v), 0.0);
  vec3 sh = m.alb * sheen * pow(1.0 - nv, 3.0) * max(nl + 0.3, 0.0) * 1.2;
  return lc * (m.alb * (1.0 - m.metal) * diff / PI * 3.0 + f * spec * max(nl, 0.0) + sh);
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

/* Display colour back to the linear light the darkroom expects (it encodes
   sRGB on the way out), exactly, so the sweep's edge is the page's colour. */
vec3 unSrgb(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

/* The backdrop at a point of the picture, in display colour. */
vec3 sweep(vec2 s) {
  float r = length((s - vec2(0.0, 0.16)) * vec2(0.58, 0.92));
  // The sweep gets a touch darker towards the camera, as paper does when the
  // light is behind the lot — the pool only, so the edge stays the stage's.
  vec3 pool = POOL * (1.0 - 0.18 * smoothstep(-0.2, -1.0, s.y));
  return mix(pool, EDGE, smoothstep(0.0, 1.12, r));
}

void main() {
  vec2 res = u_res;
  float aspect = res.x / res.y;
  vec2 uv = ((gl_FragCoord.xy + u_jit) / res) * 2.0 - 1.0;

  // Walk the camera round and up, aim at the lot's middle.
  vec3 ctr = CENTRE;
  vec3 back = vec3(sin(VIEW_YAW) * cos(VIEW_PITCH), sin(VIEW_PITCH), cos(VIEW_YAW) * cos(VIEW_PITCH));
  camF = -back;
  camR = normalize(cross(camF, vec3(0.0, 1.0, 0.0)));
  camU = cross(camR, camF);

  // Stand back far enough to see every corner of the box through a ~70mm
  // lens, then fit the picture to where the corners actually land.
  const float LENS = 0.30;
  float D = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 q = vec3(float(i & 1) * 2.0 - 1.0, float((i >> 1) & 1) * 2.0 - 1.0, float((i >> 2) & 1) * 2.0 - 1.0) * BOUND;
    float x = dot(q, camR), y = dot(q, camU), z = dot(q, back);
    D = max(D, z + max(abs(x) / (LENS * aspect), abs(y) / LENS));
  }
  vec3 eye = ctr + back * D;
  vec2 lo = vec2(1e9), hi = vec2(-1e9);
  for (int i = 0; i < 8; i++) {
    vec3 q = vec3(float(i & 1) * 2.0 - 1.0, float((i >> 1) & 1) * 2.0 - 1.0, float((i >> 2) & 1) * 2.0 - 1.0) * BOUND + ctr - eye;
    float z = dot(q, camF);
    vec2 s = vec2(dot(q, camR), dot(q, camU)) / z;
    lo = min(lo, s); hi = max(hi, s);
  }
  vec2 mid = (lo + hi) * 0.5;
  float hy = max((hi.y - lo.y) * 0.5 / FILL, (hi.x - lo.x) * 0.5 / (aspect * FILL));
  vec2 sc = mid + vec2(uv.x * aspect, uv.y + DROP * 2.0) * hy;
  vec3 ro = eye, rd = normalize(camF + sc.x * camR + sc.y * camU);

  // Where the floor is, and the lot before it.
  float tf = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  float t = 0.0; vec2 h = vec2(1.0, 0.0); bool hit = false;
  float tmax = min(tf, D * 3.0);
  // Start at the box, not the eye: nothing is out there.
  t = max(0.0, D - 2.0 * length(BOUND));
  for (int i = 0; i < 480; i++) {
    h = map(ro + rd * t);
    if (h.x < 0.00012 * SC * (1.0 + t / D)) { hit = true; break; }
    t += h.x * STEP;
    if (t > tmax) break;
  }

  // Each sample sees the key from a different point on the softbox.
  vec2 jr = fract(hash22(floor(gl_FragCoord.xy)) + u_jit + 0.5);
  float ja = jr.x * TAU, jl = sqrt(jr.y) * 0.16;
  vec3 keyC = normalize(KEY_C) + (normalize(cross(vec3(0.0, 1.0, 0.0), normalize(KEY_C))) * cos(ja) + vec3(0.0, 1.0, 0.0) * sin(ja) * 0.7) * jl;
  vec3 key = toWorld(keyC), rim = toWorld(RIM_C), fil = toWorld(FILL_C);

  vec2 bgs = uv * vec2(aspect, 1.0);
  if (!hit) {
    vec3 bg = sweep(bgs);
    if (tf < 1e8) {
      // The floor: the same sweep, darkened where the lot keeps light off it.
      vec3 p = ro + rd * tf;
      float sk = shadow(p + vec3(0.0, 0.001 * SC, 0.0), key);
      float sr = shadow(p + vec3(0.0, 0.001 * SC, 0.0), rim);
      float ao = occlusion(p, vec3(0.0, 1.0, 0.0), SC * 0.9);
      float lit = (0.56 * sk + 0.12 * sr + 0.32) * mix(0.25, 1.0, ao);
      bg *= lit;
    }
    o = vec4(unSrgb(bg), 1.0);
    return;
  }

  vec3 p = ro + rd * t;
  vec3 n = normalAt(p);
  vec3 v = -rd;
  Mat m = material(h.y, p, n);
  vec3 f0 = mix(vec3(0.04), m.alb, m.metal);
  float coat = COAT(h.y), sheen = SHEEN(h.y);
  float nv = max(dot(n, v), 0.0);
  vec3 col;

  if (h.y == GEM) {
    // A cut stone: a mirror on the outside and the studio, split into its
    // colours, bouncing about inside.
    vec3 r = toCam(reflect(rd, n));
    float fr = 0.17 + 0.83 * pow(1.0 - nv, 5.0);
    col = env(r) * fr;
    vec3 facet = normalize(hash33(floor(n * 9.0 + 31.0)) - 0.5);
    vec3 inside = toCam(normalize(reflect(refract(rd, n, 1.0 / 2.42), facet)));
    col += vec3(env(inside + vec3(0.04, 0.0, 0.0)).r, env(inside).g, env(inside - vec3(0.04, 0.0, 0.0)).b) * (1.0 - fr) * 0.95;
    col = aces(col * EXPOSURE);
    o = vec4(col, 1.0);
    return;
  }

  float sk = shadow(p + n * 0.0015 * SC, key);
  float sr = shadow(p + n * 0.0015 * SC, rim);
  float ao = occlusion(p, n, SC * 0.35);
  col = lightFrom(key, vec3(1.0, 0.975, 0.95) * 2.5, n, v, m, f0, sheen) * sk;
  col += lightFrom(rim, vec3(0.78, 0.86, 1.0) * 1.5, n, v, m, f0, sheen) * sr;
  col += lightFrom(fil, vec3(0.82, 0.86, 0.92) * 0.32, n, v, m, f0, sheen);
  // The sweep lights everything gently from below and behind; the dark room
  // from everywhere else.
  float up = n.y * 0.5 + 0.5;
  vec3 amb = mix(pow(POOL, vec3(2.2)) * 0.55, vec3(0.16, 0.18, 0.21), up);
  col += m.alb * (1.0 - m.metal) * amb * ao;

  // The studio in the surface.
  vec3 rr = toCam(reflect(rd, n));
  vec3 fres = f0 + (max(vec3(1.0 - m.rough), f0) - f0) * pow(1.0 - nv, 5.0);
  vec3 refl = mix(env(rr), vec3(0.09, 0.1, 0.12), smoothstep(0.15, 0.85, m.rough));
  float occl = mix(1.0, sk * 0.7 + 0.3, step(0.0, dot(reflect(rd, n), key)) * 0.0);
  col += refl * fres * ao * mix(1.0, 0.3, m.rough) * occl;

  // A varnish: a second, sharp reflection over everything else.
  if (coat > 0.0) {
    float cf = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
    col = col * (1.0 - coat * cf);
    vec3 hk = normalize(key + v);
    col += coat * (ggx(max(dot(n, hk), 0.0), 0.012) * 0.25 * cf * 2.5 * sk * max(dot(n, key), 0.0) + env(rr) * cf * ao);
  }
  if (m.sss > 0.0) {
    float bk = pow(clamp(dot(v, -key) * 0.5 + 0.5, 0.0, 1.0), 2.0) * (1.0 - nv);
    col += m.alb * bk * m.sss * 0.6;
  }
  col += m.emit;
  col = aces(col * EXPOSURE);
  o = vec4(col, 1.0);
}

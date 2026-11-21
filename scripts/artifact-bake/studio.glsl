/* Internet Artifacts' museum photographer.
 *
 * The Auction's studio (auction-bake/studio.glsl) cut out: the same softbox
 * high on the left, cool strip behind on the right and bounce card, but no
 * backdrop. What is not the object is transparent, except the shadow the
 * object throws on the floor it stands on, which comes out as black of the
 * right strength, so the photograph lies on whatever era of the page is
 * behind it as though the object stood there. The darkroom averages
 * premultiplied samples, so the edges and the shadow are clean.
 *
 * It also sees through glass: a surface whose id is GLASS reflects the room,
 * lets the rest through (tinted by GLASS_TINT) and the ray carries on, up to
 * four walls deep, so a coffee pot shows the coffee inside it and the page
 * behind it. A photograph is transparent where it is glass.
 *
 * Appended after scale-bake/common.glsl and one artifact's model, which
 * supplies, before this file:
 *
 *   #define BOUND vec3(...)   half-extents of the object, standing on y = 0,
 *                             centred on x and z, facing +z (CENTRE moves
 *                             the box when it is not centred)
 *   vec2 map(vec3 p)          distance, material id (1 or more)
 *   Mat  material(float id, vec3 p, vec3 n)
 *
 * and may define VIEW_YAW / VIEW_PITCH (radians: the camera walks round to the
 * right and climbs), FILL, STEP, EXPOSURE, COAT(id), SHEEN(id), GLASS (an id),
 * GLASS_TINT (a vec3) and FLOOR (0..1, how dark the floor shadow is; 1 is a
 * table's, 0 none). A model's picture, if it has one, is u_tex (UNPACK_FLIP_Y:
 * uv 0,0 is the picture's bottom left). Units: whatever the model likes, the
 * camera fits the box.
 */

#ifndef VIEW_YAW
#define VIEW_YAW 0.42
#endif
#ifndef VIEW_PITCH
#define VIEW_PITCH 0.30
#endif
#ifndef STEP
#define STEP 0.9
#endif
#ifndef EXPOSURE
#define EXPOSURE 1.35
#endif
#ifndef FILL
#define FILL 0.78
#endif
#ifndef COAT
#define COAT(id) 0.0
#endif
#ifndef SHEEN
#define SHEEN(id) 0.0
#endif
#ifndef GLASS
#define GLASS -1.0
#endif
#ifndef GLASS_TINT
#define GLASS_TINT vec3(0.96, 0.98, 0.97)
#endif
#ifndef FLOOR
#define FLOOR 1.0
#endif
#ifndef CENTRE
#define CENTRE vec3(0.0, BOUND.y, 0.0)
#endif

#define SC max(BOUND.x, max(BOUND.y, BOUND.z))

/* The room the object is in, for its reflections and its ambient light: a
   dark gallery, a lit plinth below. */
const vec3 POOL = vec3(0.415, 0.462, 0.522);
const vec3 ROOM_LO = vec3(0.010, 0.013, 0.017), ROOM_HI = vec3(0.06, 0.07, 0.085), AMB_TOP = vec3(0.16, 0.18, 0.21);

/* Lights in the camera's frame (x right, y up, z towards the camera). */
const vec3 KEY_C = vec3(-0.62, 0.66, 0.42);
const vec3 RIM_C = vec3(0.70, 0.42, -0.58);
const vec3 FILL_C = vec3(0.86, 0.12, 0.50);

vec3 camR, camU, camF;
vec3 toWorld(vec3 c) { return normalize(c.x * camR + c.y * camU - c.z * camF); }
vec3 toCam(vec3 w) { return vec3(dot(w, camR), dot(w, camU), -dot(w, camF)); }

float boxDist(vec3 p) { return sdBox(p - CENTRE, BOUND * 1.08 + 0.02 * SC); }
float map1(vec3 p) { return max(map(p).x, boxDist(p)); }

vec3 normalAt(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.00025 * SC;
  return normalize(e.xyy * map1(p + e.xyy) + e.yyx * map1(p + e.yyx) + e.yxy * map1(p + e.yxy) + e.xxx * map1(p + e.xxx));
}

float shadow(vec3 p, vec3 l) {
  float res = 1.0, t = 0.002 * SC;
  for (int i = 0; i < 120; i++) {
    vec2 h = map(p + l * t);
    float d = max(h.x, boxDist(p + l * t));
    // Glass lets most of the light through: it shadows a little, not like a wall.
    float k = h.y == GLASS ? 3.0 : 14.0;
    res = min(res, max(k * d / t, h.y == GLASS ? 0.55 : 0.0));
    t += clamp(d * STEP, 0.0015 * SC, 0.05 * SC);
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

vec3 env(vec3 d) {
  vec3 c = mix(ROOM_LO, ROOM_HI, smoothstep(-0.4, 0.8, d.y));
  c += pow(POOL, vec3(2.2)) * 0.5 * smoothstep(0.1, -0.5, d.y);
  vec3 k = normalize(KEY_C), kx = normalize(cross(vec3(0.0, 1.0, 0.0), k)), ky = cross(k, kx);
  float kb = smoothstep(0.30, 0.26, abs(dot(d, kx))) * smoothstep(0.22, 0.18, abs(dot(d, ky))) * step(0.0, dot(d, k));
  c += vec3(1.0, 0.985, 0.96) * 7.0 * kb * (0.85 + 0.15 * smoothstep(0.3, 0.0, abs(dot(d, kx))));
  vec3 r = normalize(RIM_C), rx = normalize(cross(vec3(0.0, 1.0, 0.0), r));
  float rb = smoothstep(0.075, 0.05, abs(dot(d, rx))) * smoothstep(0.5, 0.42, abs(d.y - r.y)) * step(0.0, dot(d, r));
  c += vec3(0.80, 0.88, 1.0) * 5.0 * rb;
  vec3 f = normalize(FILL_C);
  c += vec3(0.85, 0.88, 0.92) * 0.9 * smoothstep(0.82, 0.95, dot(d, f));
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
  float nv = max(dot(n, v), 0.0);
  vec3 sh = m.alb * sheen * pow(1.0 - nv, 3.0) * max(nl + 0.3, 0.0) * 1.2;
  return lc * (m.alb * (1.0 - m.metal) * diff / PI * 3.0 + f * spec * max(nl, 0.0) + sh);
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

vec3 key, rim, fil;

/* One opaque surface, lit, tonemapped. */
vec3 shade(vec3 p, vec3 rd, float id) {
  vec3 n = normalAt(p);
  vec3 v = -rd;
  Mat m = material(id, p, n);
  vec3 f0 = mix(vec3(0.04), m.alb, m.metal);
  float coat = COAT(id), sheen = SHEEN(id);
  float nv = max(dot(n, v), 0.0);
  float sk = shadow(p + n * 0.0015 * SC, key);
  float sr = shadow(p + n * 0.0015 * SC, rim);
  float ao = occlusion(p, n, SC * 0.35);
  vec3 col = lightFrom(key, vec3(1.0, 0.975, 0.95) * 2.5, n, v, m, f0, sheen) * sk;
  col += lightFrom(rim, vec3(0.78, 0.86, 1.0) * 1.5, n, v, m, f0, sheen) * sr;
  col += lightFrom(fil, vec3(0.82, 0.86, 0.92) * 0.32, n, v, m, f0, sheen);
  float up = n.y * 0.5 + 0.5;
  vec3 amb = mix(pow(POOL, vec3(2.2)) * 0.55, AMB_TOP, up);
  col += m.alb * (1.0 - m.metal) * amb * ao;
  vec3 rr = toCam(reflect(rd, n));
  vec3 fres = f0 + (max(vec3(1.0 - m.rough), f0) - f0) * pow(1.0 - nv, 5.0);
  vec3 refl = mix(env(rr), vec3(0.09, 0.1, 0.12), smoothstep(0.15, 0.85, m.rough));
  col += refl * fres * ao * mix(1.0, 0.3, m.rough);
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
  return aces(col * EXPOSURE);
}

void main() {
  vec2 res = u_res;
  float aspect = res.x / res.y;
  vec2 uv = ((gl_FragCoord.xy + u_jit) / res) * 2.0 - 1.0;

  vec3 ctr = CENTRE;
  vec3 back = vec3(sin(VIEW_YAW) * cos(VIEW_PITCH), sin(VIEW_PITCH), cos(VIEW_YAW) * cos(VIEW_PITCH));
  camF = -back;
  camR = normalize(cross(camF, vec3(0.0, 1.0, 0.0)));
  camU = cross(camR, camF);

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
  vec2 sc = mid + vec2(uv.x * aspect, uv.y) * hy;
  vec3 ro = eye, rd = normalize(camF + sc.x * camR + sc.y * camU);

  vec2 jr = fract(hash22(floor(gl_FragCoord.xy)) + u_jit + 0.5);
  float ja = jr.x * TAU, jl = sqrt(jr.y) * 0.16;
  vec3 keyC = normalize(KEY_C) + (normalize(cross(vec3(0.0, 1.0, 0.0), normalize(KEY_C))) * cos(ja) + vec3(0.0, 1.0, 0.0) * sin(ja) * 0.7) * jl;
  key = toWorld(keyC); rim = toWorld(RIM_C); fil = toWorld(FILL_C);

  float tf = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  float tmax = min(tf, D * 3.0);
  float t = max(0.0, D - 2.0 * length(BOUND));

  // Layers, front to back: premultiplied colour and coverage gathered so far,
  // and how much of what lies behind still shows through.
  vec3 acc = vec3(0.0);
  float cover = 0.0;
  vec3 through = vec3(1.0);
  for (int layer = 0; layer < 5; layer++) {
    vec2 h = vec2(1.0, 0.0); bool hit = false;
    for (int i = 0; i < 480; i++) {
      h = map(ro + rd * t);
      h.x = max(h.x, boxDist(ro + rd * t));
      if (h.x < 0.00012 * SC * (1.0 + t / D)) { hit = true; break; }
      t += h.x * STEP;
      if (t > tmax) break;
    }
    float tr = dot(through, vec3(0.3333));
    if (!hit) {
      // The floor: transparent, but for the shadow, which lets go before the
      // edge of the frame so the picture never has an edge on the page.
      if (tf < 1e8 && FLOOR > 0.0) {
        vec3 p = ro + rd * tf;
        float sk = shadow(p + vec3(0.0, 0.001 * SC, 0.0), key);
        float sr = shadow(p + vec3(0.0, 0.001 * SC, 0.0), rim);
        float ao = occlusion(p, vec3(0.0, 1.0, 0.0), SC * 0.9);
        float lit = (0.62 * sk + 0.12 * sr + 0.26) * mix(0.2, 1.0, ao);
        float a = (1.0 - pow(lit, 1.0 / 2.2)) * FLOOR;
        a *= 1.0 - smoothstep(0.62, 0.95, max(abs(uv.x), abs(uv.y)));
        cover += tr * a;
      }
      break;
    }
    vec3 p = ro + rd * t;
    if (h.y != GLASS) {
      acc += through * shade(p, rd, h.y);
      cover += tr;
      break;
    }
    // Glass: the room reflected in it, the rest let through, and on.
    vec3 n = normalAt(p);
    float nv = abs(dot(n, rd));
    float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
    vec3 rr = toCam(reflect(rd, n));
    vec3 hk = normalize(key - rd);
    vec3 g = env(rr) * fr + vec3(1.0) * ggx(max(dot(n, hk), 0.0), 0.004) * 0.25 * fr * 2.5 * max(dot(n, key), 0.0);
    g = aces(g * EXPOSURE);
    float ga = clamp(fr * 1.6 + 0.05, 0.0, 1.0);
    acc += through * g * ga;
    cover += tr * ga;
    through *= (1.0 - ga) * GLASS_TINT;
    // Out the far side of this wall.
    for (int k = 0; k < 48; k++) {
      float d = map(ro + rd * t).x;
      if (d > 0.0004 * SC) break;
      t += max(-d, 0.0) + 0.0006 * SC;
    }
  }
  cover = clamp(cover, 0.0, 1.0);
  o = vec4(cover > 0.0 ? acc / cover : vec3(0.0), cover);
}

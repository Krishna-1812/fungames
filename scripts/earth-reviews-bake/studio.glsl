#version 300 es
/* Earth Reviews' product studio.
 *
 * Every product in the shop is photographed in its packaging, the way a shop
 * photographs anything: one pack standing on a seamless paper sweep, a big
 * softbox up to the left, a fill card to the right, a strip light behind for
 * the rim, a slightly high three-quarter camera on a long lens. The pack is a
 * signed-distance model — a carton, a tin can or a glass jar with a screw lid
 * (lib/earth-reviews-packs.ts says which) — and its printed label is a
 * picture made by bake-earth-reviews.mjs, wrapped round it as u_tex.
 *
 * A jar is glass: it reflects the room, and what is inside shows through it
 * below and above its label — the Ocean as water with a surface, a Desert as
 * sand, Fog as fog, the Sun as a light — and at the back, the back of the
 * label and the studio behind.
 *
 * The bake defines, per product: KIND (0 carton, 1 tin, 2 jar), SIZE (w, h,
 * d), TURN (radians), METAL (0 steel, 1 black, 2 white), PAPER (the label's
 * ground, linear), CONTENT (0 none, 1 liquid, 2 grain, 3 glow, 4 haze), CCOL
 * and CLEVEL. Offline only: nothing here has to be fast.
 */
precision highp float;
precision highp int;

uniform vec2 u_res;
uniform vec2 u_jit;
uniform vec2 u_half;
uniform sampler2D u_tex;
out vec4 o;

#define PI 3.14159265359
#define TAU 6.28318530718

const vec3 KEY = normalize(vec3(-0.62, 0.78, 0.62));
const vec3 FILL = normalize(vec3(0.9, 0.32, 0.55));
const vec3 RIM = normalize(vec3(0.35, 0.55, -0.85));

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }

/* ---- the pack ------------------------------------------------------------ */

const float W = SIZE.x, H = SIZE.y, D = SIZE.z, R = SIZE.x * 0.5;
// A jar's glass body and its lid.
const float HB = H * 0.82;
// A tin's label runs between its rims.
const float TIN_LO = H * 0.07, TIN_HI = H * 0.93;
// A jar's label is a band round its middle, or low down when what is inside is light or air.
#if CONTENT == 3 || CONTENT == 4
const float JAR_LO = HB * 0.07, JAR_HI = HB * 0.51;
#else
const float JAR_LO = HB * 0.26, JAR_HI = HB * 0.7;
#endif

float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdCyl(vec3 p, float r, float h, float rr) { vec2 d = vec2(length(p.xz) - r + rr, abs(p.y) - h + rr); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rr; }
float sdTorus(vec3 p, float R0, float r) { return length(vec2(length(p.xz) - R0, p.y)) - r; }

vec3 local(vec3 p) { p.xz = rot(-TURN) * p.xz; return p; }

// distance, material: 1 the pack's printed body or glass, 2 metal
vec2 pack(vec3 p) {
  p = local(p);
#if KIND == 0
  return vec2(sdRoundBox(p - vec3(0.0, H * 0.5, 0.0), vec3(W, H, D) * 0.5, 0.012), 1.0);
#elif KIND == 1
  float body = sdCyl(p - vec3(0.0, H * 0.5, 0.0), R - 0.006, H * 0.5, 0.01);
  float rims = min(sdTorus(p - vec3(0.0, 0.018, 0.0), R - 0.004, 0.014), sdTorus(p - vec3(0.0, H - 0.018, 0.0), R - 0.004, 0.014));
  // The beads rolled into the can's side above and below the label.
  float bead = min(sdTorus(p - vec3(0.0, TIN_LO * 0.6, 0.0), R - 0.004, 0.006), sdTorus(p - vec3(0.0, H - TIN_LO * 0.6, 0.0), R - 0.004, 0.006));
  float metal = min(rims, bead);
  return body < metal ? vec2(body, 1.0) : vec2(metal, 2.0);
#else
  float body = sdCyl(p - vec3(0.0, HB * 0.5, 0.0), R, HB * 0.5, R * 0.22);
  float lidH = (H - HB) * 0.5;
  vec3 q = p - vec3(0.0, HB + lidH - 0.012, 0.0);
  // The lid's knurled skirt.
  float a = atan(q.x, q.z);
  float lid = sdCyl(q, R * 0.9 + 0.0022 * smoothstep(-0.5, 0.5, sin(a * 140.0)) * step(abs(q.y), lidH * 0.8), lidH, 0.012);
  return body < lid ? vec2(body, 1.0) : vec2(lid, 2.0);
#endif
}

vec3 packNormal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0004;
  return normalize(e.xyy * pack(p + e.xyy).x + e.yyx * pack(p + e.yyx).x + e.yxy * pack(p + e.yxy).x + e.xxx * pack(p + e.xxx).x);
}

/* Where on the label a point of the pack is: u round it (the front, facing
   the camera before the turn, at 0.5; rightwards increasing), v up it. */
vec2 labelUV(vec3 lp) {
#if KIND == 0
  float P = 2.0 * W + 2.0 * D, s0 = (P - W) * 0.5, s;
  vec3 a = abs(lp) / vec3(W, 1.0, D);
  if (a.z >= a.x) s = lp.z > 0.0 ? s0 + lp.x + W * 0.5 : s0 + W + D + (W * 0.5 - lp.x);
  else s = lp.x > 0.0 ? s0 + W + (D * 0.5 - lp.z) : s0 + 2.0 * W + D + (lp.z + D * 0.5);
  return vec2(fract(s / P), lp.y / H);
#elif KIND == 1
  return vec2(0.5 + atan(lp.x, lp.z) / TAU, (lp.y - TIN_LO) / (TIN_HI - TIN_LO));
#else
  return vec2(0.5 + atan(lp.x, lp.z) / TAU, (lp.y - JAR_LO) / (JAR_HI - JAR_LO));
#endif
}

/* ---- the room ------------------------------------------------------------ */

// The softbox, the fill card, the strip light and the room's walls, as a
// surface sees them in reflection.
vec3 room(vec3 d) {
  vec3 c = mix(vec3(0.18, 0.2, 0.23), vec3(0.42, 0.46, 0.52), smoothstep(-0.4, 0.8, d.y));
  float k = dot(d, KEY);
  c += vec3(1.0, 0.99, 0.97) * 7.0 * smoothstep(0.86, 0.93, k);
  c += vec3(0.9, 0.95, 1.0) * 1.6 * smoothstep(0.88, 0.97, dot(d, FILL));
  c += vec3(0.85, 0.92, 1.0) * 3.0 * smoothstep(0.93, 0.985, dot(d, RIM)) * smoothstep(0.5, 0.2, abs(d.x - RIM.x * 0.6));
  return c;
}

// The seamless paper the pack stands on, curving up into the wall behind.
const vec3 PAPER_SWEEP = vec3(0.62, 0.66, 0.71);

float packShadow(vec3 p, vec3 l, float k) {
  float res = 1.0, t = 0.01;
  for (int i = 0; i < 80; i++) {
    float h = pack(p + l * t).x;
    res = min(res, k * h / t);
    t += clamp(h, 0.006, 0.08);
    if (res < 0.001 || t > 3.0) break;
  }
  float s = clamp(res, 0.0, 1.0);
#if KIND == 2
  // Glass lets most of the light through; the label and the lid do not.
  s = mix(1.0, s, 0.55);
#endif
  return s;
}

// Light reaching a point on the paper: the softbox (big, so its shadow is soft), the fill, the room.
vec3 sweepLight(vec3 p) {
  float sh = packShadow(p + vec3(0.0, 0.002, 0.0), KEY, 5.0);
  float sf = packShadow(p + vec3(0.0, 0.002, 0.0), FILL, 6.0);
  // Contact: the paper right under and around the pack sees less of the room.
  float near = pack(p + vec3(0.0, 0.06, 0.0)).x;
  float ao = 0.45 + 0.55 * smoothstep(0.0, 0.22, near);
  vec3 c = vec3(1.0, 0.98, 0.96) * 1.1 * max(KEY.y, 0.0) * sh + vec3(0.9, 0.95, 1.0) * 0.25 * max(FILL.y, 0.0) * sf;
  c += vec3(0.55, 0.6, 0.68) * 0.22 * ao;
  return c * PAPER_SWEEP * mix(0.75, 1.0, ao);
}

// What lies behind the pack along a ray: the paper floor, fading up into the wall.
vec3 backdrop(vec3 ro, vec3 rd) {
  vec3 wall = mix(vec3(0.42, 0.46, 0.52), vec3(0.2, 0.22, 0.26), smoothstep(-0.05, 0.35, rd.y)) * PAPER_SWEEP * 1.1;
  if (rd.y < -1e-3) {
    float t = -ro.y / rd.y;
    vec3 p = ro + rd * t;
    vec3 floorCol = sweepLight(p);
    // The sweep curves up a metre and a half back: past that it reads as wall.
    return mix(floorCol, wall, smoothstep(-0.4, -2.6, p.z));
  }
  return wall;
}

/* ---- surfaces ------------------------------------------------------------ */

float ggx(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }

vec3 shade(vec3 p, vec3 n, vec3 v, vec3 alb, float rough, float metal, float occl) {
  vec3 f0 = mix(vec3(0.04), alb, metal);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 l = i == 0 ? KEY : i == 1 ? FILL : RIM;
    vec3 lc = i == 0 ? vec3(1.0, 0.98, 0.95) * 1.6 : i == 1 ? vec3(0.9, 0.95, 1.0) * 0.32 : vec3(0.85, 0.92, 1.0) * 1.1;
    float s = i == 0 ? packShadow(p + n * 0.003, l, 8.0) : 1.0;
    float nl = max(dot(n, l), 0.0);
    vec3 h = normalize(l + v);
    float a = max(rough * rough, 0.015);
    vec3 F = f0 + (1.0 - f0) * pow(1.0 - max(dot(v, h), 0.0), 5.0);
    col += lc * s * (alb * (1.0 - metal) / PI * 3.0 * nl + F * ggx(max(dot(n, h), 0.0), a) * 0.25 * nl);
  }
  float sky = 0.5 + 0.5 * n.y;
  col += alb * (1.0 - metal) * mix(vec3(0.16, 0.17, 0.19), vec3(0.42, 0.46, 0.52), sky) * 0.42 * occl;
  // The room in the surface.
  vec3 r = reflect(-v, n);
  float nv = max(dot(n, v), 0.0);
  vec3 fr = f0 + (max(vec3(1.0 - rough), f0) - f0) * pow(1.0 - nv, 5.0);
  vec3 env = r.y < 0.0 ? mix(room(r), PAPER_SWEEP * 0.9, smoothstep(0.0, -0.3, r.y)) : room(r);
  col += mix(env, vec3(0.35, 0.38, 0.42), smoothstep(0.15, 0.85, rough)) * fr * occl * mix(1.0, 0.4, rough);
  return col;
}

float occlusion(vec3 p, vec3 n) {
  float occ = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.015 * float(i * i);
    float d = min(pack(p + n * h).x, p.y + n.y * h);
    occ += (h - d) * w;
    w *= 0.7;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

vec3 metalAlb() {
#if METAL == 1
  return vec3(0.04, 0.045, 0.05);
#elif METAL == 2
  return vec3(0.86, 0.88, 0.9);
#else
  return vec3(0.74, 0.76, 0.79);
#endif
}

// The printed body of a carton or a tin, or a jar's label, from outside.
vec3 printed(vec3 p, vec3 n, vec3 v, vec3 lp, float occl) {
  vec2 uv = labelUV(lp);
  vec3 alb;
#if KIND == 0
  vec3 ln = n; ln.xz = rot(-TURN) * ln.xz;
  // The top flap is plain board in the label's ground.
  alb = ln.y > 0.6 ? PAPER : texture(u_tex, uv).rgb;
  alb = pow(alb, vec3(2.2));
  float rough = 0.5;
  // Board shows its fibre in the light.
  alb *= 0.96 + 0.06 * noise(lp * 380.0);
#else
  alb = pow(texture(u_tex, uv).rgb, vec3(2.2));
  float rough = KIND == 1 ? 0.28 : 0.55;
#endif
  return shade(p, n, v, alb, rough, 0.0, occl);
}

/* ---- inside a jar -------------------------------------------------------- */

#if KIND == 2
const float IR = R - 0.022;                 // the glass's inner radius
const float FLOOR_Y = 0.03;                 // the glass bottom's thickness
const float TOP_Y = FLOOR_Y + CLEVEL * (HB - 0.09);

// Where a ray inside the jar meets the glass again, as a distance along it.
float exitT(vec3 ro, vec3 rd) {
  float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - IR * IR;
  float t = (-b + sqrt(max(b * b - a * c, 0.0))) / max(a, 1e-6);
  if (rd.y < 0.0) t = min(t, (FLOOR_Y - ro.y) / rd.y);
  if (rd.y > 0.0) t = min(t, (HB - 0.05 - ro.y) / rd.y);
  return max(t, 0.0);
}

// The top of a heap or a sea: a level plane, stirred.
float surfaceY(vec2 xz) {
#if CONTENT == 1
  return TOP_Y + 0.006 * sin(xz.x * 38.0 + 1.3) * sin(xz.y * 31.0) + 0.004 * noise(vec3(xz * 24.0, 1.0));
#else
  return TOP_Y + 0.05 * (fbm(vec3(xz * 5.0, 2.0)) - 0.5) - 0.06 * dot(xz, xz) / (IR * IR) + 0.02;
#endif
}

// How near a ray (o, unit d) passes to the segment a-b: the closest approach of two lines, clamped to the segment.
float raySeg(vec3 o, vec3 d, vec3 a, vec3 b) {
  vec3 u = b - a, w = a - o;
  float uu = dot(u, u), ud = dot(u, d), uw = dot(u, w), dw = dot(d, w);
  float den = uu - ud * ud;
  float s = clamp(den > 1e-9 ? (ud * dw - uw) / den : 0.0, 0.0, 1.0);
  vec3 q = a + u * s;
  float tr = max(dot(q - o, d), 0.0);
  return length(o + d * tr - q);
}

// Glowing contents: a ball of light for the Sun, a tangle of filaments for lightning.
float glowAt(vec3 q) {
  vec3 c = vec3(0.0, HB * 0.7, 0.0);
  float d = length(q - c);
#if 1
  if (CCOL.b > CCOL.r) {
    // Lightning: bright forked filaments and only a faint core.
    float fil = pow(max(0.0, 1.0 - abs(fbm(q * vec3(7.0, 3.0, 7.0) + 3.0) - 0.5) * 22.0), 4.0) * exp(-d * 3.0) * 7.0;
    return fil + exp(-d * 8.0) * 0.5;
  }
#endif
  // A star: a blinding core, its corona, a faint mottling.
  return exp(-d * d * 160.0) * 30.0 + exp(-d * 11.0) * 2.2 * (0.8 + 0.4 * fbm(q * 14.0));
}

/* What is seen through the front glass, from where the ray enters (in the
   pack's own frame) to where it leaves at the back. */
vec3 throughJar(vec3 lo, vec3 ld, vec3 worldRo, vec3 worldRd) {
  float tEnd = exitT(lo, ld);
  vec3 back = lo + ld * tEnd;
  // At the back: the back of the label (plain paper), or the studio through the far glass.
  vec3 behind;
  if (back.y > JAR_LO && back.y < JAR_HI && length(back.xz) > IR - 0.01) {
    behind = PAPER * PAPER * 0.55 + 0.05;
  } else {
    behind = backdrop(worldRo, worldRd) * 0.9;
  }
  vec3 col = behind;
#if CONTENT == 1 || CONTENT == 2
  // March to the contents' top, or through them.
  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 120; i++) {
    vec3 q = lo + ld * t;
    float d = q.y - surfaceY(q.xz);
    if (d < 0.0005) { hit = true; break; }
    t += max(d * 0.5, 0.002);
    if (t > tEnd) break;
  }
  if (hit || lo.y < TOP_Y) {
    vec3 q = lo + ld * t;
#if CONTENT == 1
    // Water: what is behind, absorbed along the path through it, and the sea's own colour scattered back.
    float tIn = t;
    float L = max(0.0, tEnd - tIn);
    vec3 sigma = -log(max(CCOL, vec3(0.02))) * 3.2;
    vec3 trans = exp(-sigma * L);
    vec3 body = behind * trans + CCOL * 0.55 * (1.0 - trans);
    if (hit && lo.y >= TOP_Y) {
      // Seen from above: the surface reflects the room.
      vec2 e = vec2(0.002, 0.0);
      vec3 sn = normalize(vec3(surfaceY(q.xz - e.xy) - surfaceY(q.xz + e.xy), 2.0 * e.x, surfaceY(q.xz - e.yx) - surfaceY(q.xz + e.yx)));
      float fr = 0.02 + 0.98 * pow(1.0 - max(dot(sn, -ld), 0.0), 5.0);
      vec3 r = reflect(ld, sn); r.xz = rot(TURN) * r.xz;
      body = mix(body, room(r) * 0.8, fr);
    }
    col = body;
#else
    // Sand or snow: grains in the light, darker where they press against the glass.
    vec3 g = CCOL * (0.82 + 0.28 * noise(q * 260.0)) * (0.9 + 0.2 * noise(q * 40.0));
    vec2 e = vec2(0.003, 0.0);
    vec3 sn = lo.y >= TOP_Y && hit ? normalize(vec3(surfaceY(q.xz - e.xy) - surfaceY(q.xz + e.xy), 2.0 * e.x, surfaceY(q.xz - e.yx) - surfaceY(q.xz + e.yx))) : -normalize(vec3(ld.x, 0.0, ld.z));
    vec3 wn = sn; wn.xz = rot(TURN) * wn.xz;
    vec3 wk = KEY;
    float lit = 0.35 + 0.75 * max(dot(wn, wk), 0.0);
    col = g * lit * (lo.y < TOP_Y ? 0.78 : 1.0);
#endif
  }
#elif CONTENT == 3
  if (CCOL.b > CCOL.r) {
    // A bolt: a forked line of light, as near as the ray passes to it.
    float best = 1e9, e = 0.0;
    vec3 prev = vec3(-0.04, HB * 0.95, 0.02);
    for (int i = 1; i <= 9; i++) {
      float f = float(i) / 9.0;
      vec3 cur = vec3(0.04 * sin(float(i) * 1.3) + (hash(vec3(float(i), 1.0, 2.0)) - 0.5) * 0.11, HB * (0.95 - 0.42 * f), (hash(vec3(float(i), 3.0, 1.0)) - 0.5) * 0.1);
      best = min(best, raySeg(lo, ld, prev, cur));
      // A fork off the middle of the bolt.
      if (i == 4) {
        vec3 mid = cur + vec3(0.07, -0.07, 0.02), tip = cur + vec3(0.15, -0.16, 0.04);
        best = min(best, min(raySeg(lo, ld, cur, mid), raySeg(lo, ld, mid + vec3(0.0, 0.0, 0.0), tip)) * 1.5);
      }
      prev = cur;
    }
    e += 9.0 * exp(-best / 0.004) + 0.9 * exp(-best / 0.025);
    // The storm it lives in: dark cloud filling the glass, lit from within by the bolt.
    vec3 q0 = lo + ld * tEnd * 0.5;
    float cloud = 0.6 + 0.5 * fbm(q0 * 7.0);
    col = behind * 0.05 + vec3(0.03, 0.036, 0.055) * cloud + CCOL * e;
  } else {
    // Light: gathered along the ray through the jar.
    vec3 acc = vec3(0.0);
    const int N = 64;
    float dt = tEnd / float(N);
    for (int i = 0; i < N; i++) acc += glowAt(lo + ld * (float(i) + 0.5) * dt) * dt;
    col = behind * 0.4 + CCOL * acc * 2.4;
  }
#elif CONTENT == 4
  // Haze: fog fills the glass; a dark one is a swarm of specks.
  vec3 acc = vec3(0.0);
  float T = 1.0;
  const int N = 220;
  float dt = tEnd / float(N);
  bool swarm = dot(CCOL, vec3(0.333)) < 0.3;
  for (int i = 0; i < N; i++) {
    vec3 q = lo + ld * (float(i) + 0.5) * dt;
    float dens;
    vec3 c;
    if (swarm) {
      // One insect in some cells of a grid, each a small dark speck.
      vec3 cell = floor(q * 26.0);
      vec3 at = (cell + 0.2 + 0.6 * vec3(hash(cell), hash(cell + 3.1), hash(cell + 7.7))) / 26.0;
      float on = step(hash(cell + 11.0), 0.07) * step(FLOOR_Y + 0.05, q.y);
      dens = on * smoothstep(0.0055, 0.0028, length(q - at)) * 500.0;
      c = CCOL;
    } else {
      dens = 9.0 * smoothstep(0.38, 0.72, fbm(q * 6.0 + vec3(0.0, q.y * 2.0, 0.0))) * smoothstep(FLOOR_Y, FLOOR_Y + 0.1, q.y);
      c = CCOL * (0.75 + 0.35 * smoothstep(0.0, HB, q.y));
    }
    float a = 1.0 - exp(-dens * dt);
    acc += T * a * c;
    T *= 1.0 - a;
  }
  col = behind * T + acc;
#endif
  return col;
}
#endif

/* ---- the photograph ------------------------------------------------------ */

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = (gl_FragCoord.xy + u_jit) / u_res * 2.0 - 1.0;
  uv.x *= u_res.x / u_res.y;
  // A long lens from slightly above, as a shop shoots a pack.
  // Framed to the pack: its height, or its width turned toward us, whichever needs more room.
  // A carton shows its top as well as its front from up here, so it needs a little more headroom.
  float frame = max(H * (KIND == 1 ? 0.66 : 0.72), max(W, D) * 0.68);
  vec3 target = vec3(0.0, H * 0.52, 0.0);
  vec3 eye = target + normalize(vec3(0.0, 0.2, 1.0)) * (frame / 0.2);
  vec3 fw = normalize(target - eye), rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0))), up = cross(rt, fw);
  vec3 rd = normalize(fw + (uv.x * rt + uv.y * up) * 0.2);
  vec3 ro = eye;

  float t = 0.0; vec2 h = vec2(1.0, 0.0); bool hit = false;
  for (int i = 0; i < 260; i++) {
    h = pack(ro + rd * t);
    if (h.x < 0.0002) { hit = true; break; }
    t += h.x * 0.9;
    if (t > 8.0) break;
  }

  vec3 col;
  if (!hit) {
    col = backdrop(ro, rd);
  } else {
    vec3 p = ro + rd * t;
    vec3 n = packNormal(p);
    vec3 v = -rd;
    vec3 lp = local(p);
    float occl = occlusion(p, n);
    if (h.y > 1.5) {
      // Metal: the tin's rims and ends, a jar's lid.
      col = shade(p, n, v, metalAlb(), METAL == 1 ? 0.35 : 0.22, METAL == 2 ? 0.0 : 1.0, occl);
    } else {
#if KIND == 1
      vec3 ln = n; ln.xz = rot(-TURN) * ln.xz;
      bool onLabel = abs(ln.y) < 0.5 && lp.y > TIN_LO && lp.y < TIN_HI;
      col = onLabel ? printed(p, n, v, lp, occl) : shade(p, n, v, metalAlb(), 0.2, 1.0, occl);
#elif KIND == 2
      bool onLabel = lp.y > JAR_LO && lp.y < JAR_HI && length(lp.xz) > R - 0.03;
      if (onLabel) {
        col = printed(p, n, v, lp, occl);
      } else {
        // Glass: the room reflected, and what is inside seen through it.
        float nv = max(dot(n, v), 0.0);
        float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
        vec3 r = reflect(rd, n);
        vec3 env = r.y < 0.0 ? PAPER_SWEEP * 0.7 : room(r);
        vec3 ld = rd; ld.xz = rot(-TURN) * ld.xz;
        vec3 inside = throughJar(lp + ld * 0.025, ld, ro, rd);
        col = inside * vec3(0.94, 0.97, 0.96) * (1.0 - fr) + env * fr * 1.2;
      }
#else
      col = printed(p, n, v, lp, occl);
#endif
    }
  }
  // A touch of lens: the corners fall off a little.
  col *= 1.0 - 0.18 * dot(uv * 0.7, uv * 0.7);
  o = vec4(aces(col * 1.05), 1.0);
}

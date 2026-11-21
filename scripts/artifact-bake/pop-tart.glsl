/* April 5, 2011: Nyan Cat.
 *
 * The cat is a pastry with a cat's head on it, and its pastry body is a frosted
 * toaster tart: a flat rectangle of pale golden crust 9.6 x 5.3 cm, the rim
 * pressed with a fork's crimp, a pink frosting with a hand-wobbled edge, and
 * rainbow sprinkles in all seven colours. Unbranded. One corner has been bitten
 * away in a scalloped bite that shows the crust's pale crumb and the jam
 * between the two layers, with a few crumbs on the table beside it.
 * Units: 1 is 1 cm.
 */
#define BOUND vec3(5.9, 0.66, 3.5)
#define CENTRE vec3(0.0, 0.66, 0.0)
#define VIEW_YAW 0.40
#define VIEW_PITCH 0.62
#define FILL 0.8
#define EXPOSURE 1.1
#define COAT(id) (id == 3.0 ? 0.5 : 0.0)
#define SHEEN(id) (id == 2.0 ? 0.25 : 0.0)

const vec2 HALF = vec2(4.8, 2.65);   // the tart's half-size
const float RAD = 0.75;              // its corner radius
const float FROST = 0.55;            // how far the frosting stops short of the rim

float sdRR(vec2 q) { vec2 a = abs(q) - (HALF - RAD); return length(max(a, 0.0)) + min(max(a.x, a.y), 0.0) - RAD; }

float bite(vec3 p) {
  float b = length(p - vec3(4.45, 0.6, 2.5)) - 1.6;
  b = min(b, length(p - vec3(5.3, 0.55, 1.1)) - 1.0);
  b = min(b, length(p - vec3(3.0, 0.6, 3.2)) - 1.15);
  b = min(b, length(p - vec3(4.95, 0.6, 3.3)) - 1.1);
  b = min(b, length(p - vec3(3.9, 0.55, 3.5)) - 0.75);
  return b;
}

float ftop(vec2 q) { return 1.12 + 0.03 * (noise(q * 1.7) - 0.5) * 2.0; }

/* The nearest sprinkle of the four cells round the point: distance, colour id. */
vec2 sprinkles(vec3 p) {
  const float CS = 0.5;
  vec2 g = p.xz / CS;
  vec2 f = fract(g);
  vec2 base = floor(g) + vec2(f.x > 0.5 ? 0.0 : -1.0, f.y > 0.5 ? 0.0 : -1.0);
  float best = 1e3, bid = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 c = base + vec2(float(i & 1), float(i >> 1));
    float h = hash21(c + 3.7);
    if (h < 0.42) continue;
    vec2 j = hash22(c + 1.3) - 0.5;
    float a = hash21(c + 9.1) * PI;
    vec2 ctr = (c + 0.5) * CS + j * 0.12;
    vec2 dir = vec2(cos(a), sin(a)) * 0.13;
    float y = ftop(ctr) + 0.012;
    float d = sdCapsule(p, vec3(ctr - dir, y).xzy * vec3(1.0, 1.0, 1.0), vec3(ctr + dir, y).xzy, 0.05);
    if (d < best) { best = d; bid = hash21(c + 5.5); }
  }
  return vec2(best, bid);
}

vec2 map(vec3 p) {
  float d2 = sdRR(p.xz);
  float bulge = 0.07 * sin(clamp(p.y, 0.0, 1.05) * 3.0);
  float db = d2 - bulge;
  // The crimp: ridges pressed across the rim, along whichever edge is near.
  float s = (HALF.y - abs(p.z) < HALF.x - abs(p.x)) ? p.x : p.z;
  float m = 0.5 + 0.5 * sin(s * TAU / 0.34);
  float ytop = 1.0 - 0.1 * smoothstep(-FROST - 0.08, -FROST + 0.05, d2) * m;
  float body = smax(db, (p.y - ytop) * 0.55, 0.14);
  body = smax(body, -p.y, 0.16);
  // The bite.
  float bt = bite(p);
  body = smax(body, -bt, 0.03);
  vec2 d = vec2(body, 1.0);
  // Frosting.
  float wob = 0.09 * (noise(p.xz * 2.3) - 0.5) + 0.04 * (noise(p.xz * 7.0) - 0.5);
  float fr = smax(d2 + FROST + wob, (p.y - ftop(p.xz)) * 0.85, 0.07);
  fr = smax(fr, 0.96 - p.y, 0.02);
  fr = smax(fr, -bt, 0.03);
  d = U(d, vec2(fr, 2.0));
  // The jam between the layers, standing a hair proud of the cut crust.
  float fill = smax(smax(db + 0.4, abs(p.y - 0.5) - 0.22, 0.05), -(bt + 0.06), 0.06);
  d = U(d, vec2(fill, 3.0));
  // Sprinkles.
  if (p.y > 1.0 && p.y < 1.3 && d2 < -FROST - 0.14) {
    vec2 sp = sprinkles(p);
    float sd = max(sp.x, -bt);
    d = U(d, vec2(sd, 5.0));
  }
  // Crumbs on the table.
  vec2 rq = rot(0.6) * (p.xz - vec2(4.5, 3.0));
  float crumbs = sdRound(vec3(rq.x, p.y - 0.07, rq.y), vec3(0.12, 0.06, 0.08), 0.03);
  crumbs = min(crumbs, sdRound(p - vec3(5.4, 0.045, 2.1), vec3(0.09, 0.04, 0.07), 0.025));
  crumbs = min(crumbs, sdRound(p - vec3(3.7, 0.04, 3.05), vec3(0.07, 0.035, 0.06), 0.02));
  crumbs = min(crumbs, sdRound(p - vec3(5.15, 0.035, 3.0), vec3(0.06, 0.03, 0.05), 0.02));
  crumbs = min(crumbs, sdRound(p - vec3(4.0, 0.03, 3.4), vec3(0.05, 0.025, 0.04), 0.015));
  crumbs = min(crumbs, sdRound(p - vec3(5.7, 0.03, 1.5), vec3(0.05, 0.025, 0.04), 0.015));
  crumbs = min(crumbs, sdRound(p - vec3(4.6, 0.025, 3.55), vec3(0.04, 0.02, 0.035), 0.012));
  crumbs = min(crumbs, sdRound(p - vec3(5.0, 0.025, 3.45), vec3(0.035, 0.02, 0.03), 0.012));
  crumbs = min(crumbs, sdRound(p - vec3(3.3, 0.025, 3.35), vec3(0.04, 0.02, 0.03), 0.012));
  d = U(d, vec2(crumbs, 6.0));
  return d;
}

vec3 sprinkleColour(float h) {
  float k = floor(h * 7.0);
  return k < 1.0 ? hex(0xd8283a) : k < 2.0 ? hex(0xf2c230) : k < 3.0 ? hex(0x2fa84a) : k < 4.0 ? hex(0x2a6fd6) : k < 5.0 ? hex(0xee7a1e) : k < 6.0 ? hex(0xf3f0e8) : hex(0x7b3fb8);
}

Mat material(float id, vec3 p, vec3 n) {
  float d2 = sdRR(p.xz);
  float bt = bite(p);
  if (id == 5.0) {
    return mat(sprinkleColour(sprinkles(p).y), 0.32, 0.0);
  }
  if (id == 2.0) {
    // Frosting: strawberry pink, glittering with sugar, a little thin at the edge.
    float glit = smoothstep(0.82, 0.95, noise(p * 40.0));
    vec3 c = mix(hex(0xea6f9d), hex(0xf08cae), noise(p * 2.0));
    c = mix(c, hex(0xffe6ee), glit * 0.4);
    c = mix(c, hex(0xf6c6d4), smoothstep(-FROST - 0.15, -FROST + 0.05, d2) * 0.3);
    Mat m = mat(c * 0.85, 0.42 - 0.1 * glit, 0.0);
    m.sss = 0.2;
    return m;
  }
  if (id == 3.0) {
    // Jam: dark strawberry, wet.
    vec3 c = mix(hex(0x8c0f22), hex(0xb21f38), noise(p * 14.0));
    Mat m = mat(c, 0.22, 0.0);
    m.sss = 0.35;
    return m;
  }
  if (id == 6.0) {
    return mat(mix(hex(0xe2c48a), hex(0xc9a46a), noise(p * 30.0)), 0.9, 0.0);
  }
  // Pastry: the cut face is pale and flaky; the outside is golden, browner at the rim.
  if (bt < 0.08 && bt > -0.12) {
    float flake = noise(vec3(p.x * 6.0, p.y * 38.0, p.z * 6.0));
    vec3 c = mix(hex(0xe6cd9c), hex(0xd2b27a), flake);
    c = mix(c, hex(0xb98d55), smoothstep(0.5, 0.0, bt + 0.05) * 0.4 * noise(p * 20.0));
    return mat(c * 0.9, 0.85, 0.0);
  }
  float fl = noise(p * vec3(26.0, 9.0, 26.0));
  vec3 c = mix(hex(0xcfa263), hex(0xbb8648), fl);
  float rim = smoothstep(-0.5, 0.0, d2);
  float cs = (HALF.y - abs(p.z) < HALF.x - abs(p.x)) ? p.x : p.z;
  c = mix(c, hex(0x9a5f28), (0.5 + 0.5 * sin(cs * TAU / 0.34)) * 0.28 * rim);
  c = mix(c, hex(0xa86a2e), rim * 0.5 + 0.2 * smoothstep(0.5, 1.0, fbm(p * 5.0)));
  if (n.y < -0.3 || p.y < 0.25) c = mix(c, hex(0xe2c288), 0.5) * (0.9 + 0.15 * fl);
  return mat(c * 0.9, 0.82, 0.0);
}

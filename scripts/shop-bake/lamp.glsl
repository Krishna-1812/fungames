/* Product: the reading lamp (Fenwick & Oates, Dark Patterns).
 *
 * A task lamp of the plain, long-lived kind: a heavy round foot in black
 * powder coat, a brass stem, a brass knuckle with a knurled knob, a brass
 * arm reaching forward, and a black spun-steel cone of a shade, white
 * inside, angled down with the bulb just showing. Units: 1 is 10 cm.
 */
#define BOUND vec3(1.45, 2.3, 0.95)
#define CENTRE vec3(0.62, 2.3, 0.1)
#define VIEW_YAW 0.62
#define VIEW_PITCH 0.16
#define FILL 0.9
#define STEP 0.8
#define COAT(id) (id == 1.0 ? 0.35 : 0.0)

const vec3 KNUCKLE = vec3(0.0, 3.55, 0.0);
const vec3 TIP = vec3(1.45, 3.95, 0.45);
const vec3 AXIS = vec3(0.42, -0.86, 0.29);   // the shade's axis, normalised below

float rrect(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

vec2 map(vec3 p) {
  // The foot: a low, heavy disc with a rounded edge and a step on top.
  vec2 ry = vec2(length(p.xz), p.y);
  float foot = min(rrect(ry - vec2(0.0, 0.09), vec2(0.86, 0.09), 0.05), rrect(ry - vec2(0.0, 0.2), vec2(0.2, 0.04), 0.02));
  vec2 d = vec2(foot, 2.0);
  // Brass: the stem, the knuckle with its knob, the arm.
  float brass = sdCapsule(p, vec3(0.0, 0.18, 0.0), KNUCKLE, 0.065);
  brass = min(brass, sdSphere(p - KNUCKLE, 0.1));
  vec3 k = p - KNUCKLE - vec3(0.0, 0.0, -0.14);
  brass = min(brass, sdCyl(k.xzy, 0.07, 0.05) - 0.008);
  brass = min(brass, sdCapsule(p, KNUCKLE, TIP, 0.05));
  brass = min(brass, sdSphere(p - TIP, 0.075));
  d = U(d, vec2(brass, 1.0));
  // The shade: a cone shell opening along AXIS from just past the tip.
  vec3 ax = normalize(AXIS);
  vec3 a = TIP + ax * 0.06;
  // In the shade's own frame: h down the axis, r out from it; the shade is
  // a revolved line, its spun-steel wall 1.2 mm thick, and a short neck.
  float hh = dot(p - a, ax);
  vec2 rh = vec2(length(p - a - ax * hh), hh);
  vec2 A = vec2(0.2, 0.0), B = vec2(0.7, 0.95), ba = B - A, pa = rh - A;
  float kk = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float shade = length(pa - ba * kk) - 0.012;
  shade = min(shade, rrect(rh - vec2(0.0, 0.02), vec2(0.2, 0.03), 0.01));
  bool inside = ba.x * pa.y - ba.y * pa.x > 0.0 && hh > 0.05;
  d = U(d, vec2(shade, inside ? 3.0 : 2.0));
  // The bulb, sitting in the throat of the shade.
  d = U(d, vec2(sdSphere(p - (a + ax * 0.5), 0.2), 4.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Brushed brass, a little warmer and darker where hands have been.
    float br = noise(vec3(p.x * 4.0, p.y * 220.0, p.z * 4.0));
    return mat(mix(hex(0xb8925a), hex(0xd7b679), br * 0.6), 0.28 + 0.1 * br, 1.0);
  }
  if (id == 2.0) return mat(mix(hex(0x18191b), hex(0x222326), noise(p * 60.0)), 0.52, 0.0);
  if (id == 3.0) return mat(hex(0xe9e8e3), 0.7, 0.0);
  Mat m = mat(hex(0xf2f0ea), 0.08, 0.0);
  m.sss = 0.6;
  return m;
}

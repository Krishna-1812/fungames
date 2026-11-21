/* Lot: a mourning brooch containing a stranger's hair.
 *
 * A Victorian oval mourning brooch, c.1861, lying a little askew on a grey
 * velvet jeweller's pad: a gold rope-twist frame, a domed border of black
 * enamel gilded IN MEMORY across the top and with a spray of ivy and a
 * forget-me-not across the bottom, a beaded gold collet and, under the glass,
 * a flat plait of brown hair laid on milk-white opaline. The pin runs under
 * it and its point shows past the right-hand edge; a loop at the top lets it
 * hang as a pendant. Units: the brooch is about 1 across (4.7 cm).
 */
#define BOUND vec3(0.60, 0.05, 0.50)
#define CENTRE vec3(0.03, 0.04, 0.0)
#define VIEW_YAW 0.22
#define VIEW_PITCH 0.88
#define FILL 0.84
#define STEP 0.7
#define COAT(id) ((id) == 2.0 ? 0.9 : ((id) == 3.0 ? 1.0 : 0.0))
#define SHEEN(id) ((id) == 4.0 ? 1.0 : 0.0)

const vec2 E = vec2(0.47, 0.37);      // the rope's path
const float BASE = 0.007;            // where its back sits above the sweep
const float YAW = -0.21;             // turned on the pad
const float TILT = 0.035;            // and rocked onto its catch

/* The brooch's own frame: x across, z down the oval, y up from its back. */
vec3 toB(vec3 p) {
  vec3 q = p - vec3(0.03, BASE, 0.02);
  q.xz = rot(YAW) * q.xz;
  q.xy = rot(TILT) * q.xy;
  return q;
}
vec3 dirB(vec3 d) {
  d.xz = rot(YAW) * d.xz;
  d.xy = rot(TILT) * d.xy;
  return d;
}

/* An ellipse in 2D: close to the true distance near the curve. */
float sdEll(vec2 p, vec2 r) {
  float k0 = length(p / r), k1 = max(length(p / (r * r)), 1e-5);
  return k0 * (k0 - 1.0) / k1;
}
/* Arc-length angle round an ellipse, and back again: beads and the rope's
   twist keep an even pitch on the long sides and the short ones. */
float ecc(vec2 r) { return (r.x - r.y) / (r.x + r.y); }
float arcT(float th, float e) { return th - e * 0.5 * sin(2.0 * th); }
float arcInv(float t, float e) {
  float th = t;
  for (int i = 0; i < 3; i++) th = t + e * 0.5 * sin(2.0 * th);
  return th;
}
float eAngle(vec2 p, vec2 r) { return atan(p.y / r.y, p.x / r.x); }

float rope(vec3 q) {
  float s = sdEll(q.xz, E);
  vec2 cs = vec2(s, q.y - 0.038);
  float env = length(cs) - 0.027;
  if (env > 0.02) return env;
  float t = arcT(eAngle(q.xz, E), ecc(E));
  vec2 c = rot(t * 34.0) * vec2(0.0125, 0.0);
  return min(length(cs - c), length(cs + c)) - 0.0135;
}

float beads(vec3 q, out float idx) {
  vec2 r = E - 0.152;
  float e = ecc(r);
  const float N = 78.0;
  float t = arcT(eAngle(q.xz, r), e);
  float i0 = floor(t / TAU * N + 0.5);
  float d = 9.0;
  idx = i0;
  for (int k = -1; k <= 1; k++) {
    float th = arcInv((i0 + float(k)) / N * TAU, e);
    vec2 c = r * vec2(cos(th), sin(th));
    float dk = length(vec3(q.x - c.x, q.y - 0.057, q.z - c.y)) - 0.0108;
    if (dk < d) { d = dk; idx = i0 + float(k); }
  }
  return d;
}

float pad(vec3 p) {
  // A small cushion: flat enough under the brooch to hold it, falling away
  // to soft rounded edges and lower corners.
  float box = sdRound(p - vec3(0.0, 0.07, 0.0), vec3(0.67, 0.07, 0.55), 0.10);
  float rr = length(max(abs(p.xz) / vec2(0.67, 0.55) - 0.25, 0.0));
  float top = 0.124 - 0.11 * smoothstep(0.15, 0.8, rr);
  return smax(box, (p.y - top) * 0.8, 0.05);
}

float gilding(vec3 q, out float u);

vec2 map(vec3 p) {
  vec3 q = toB(p);
  vec2 r = vec2(1e9, 0.0);
  // Cheap early out: nothing of the brooch is far from its disc.
  float hull = max(sdEll(q.xz, E + vec2(0.1)), abs(q.y - 0.04) - 0.06);
  if (hull > 0.05) return vec2(hull, 1.0);

  // Gold: the back plate, the rope, the two bezels, the loop, hinge and catch.
  float g = max(sdEll(q.xz, E - 0.006), abs(q.y - 0.027) - 0.014);
  g = min(g, rope(q));
  float outerW = max(max(sdEll(q.xz, E - 0.020), -sdEll(q.xz, E - 0.034)), q.y - 0.063);
  float innerW = max(max(sdEll(q.xz, E - 0.160), -sdEll(q.xz, E - 0.171)), q.y - 0.066);
  g = min(g, min(outerW, innerW) - 0.0015);
  vec3 lp = q - vec3(0.0, 0.026, -(E.y + 0.052));
  g = min(g, sdTorus(lp, 0.030, 0.0085));
  g = min(g, sdRound(q - vec3(0.0, 0.026, -(E.y + 0.012)), vec3(0.016, 0.009, 0.02), 0.006));
  g = min(g, sdRound(vec3(abs(q.x) - 0.33, q.y - 0.008, q.z + 0.045), vec3(0.022, 0.008, 0.02), 0.005));
  r = U(r, vec2(g, 1.0));
  // The pin, from the hinge on the left to a point past the right edge.
  float pin = sdCone(q, vec3(-0.33, 0.007, -0.045), vec3(0.545, 0.0045, -0.07), 0.0052, 0.0012);
  r = U(r, vec2(pin, 5.0));
  float bi;
  r = U(r, vec2(beads(q, bi), 1.0));

  // The enamel border, domed across its width.
  float bo = sdEll(q.xz, E - 0.032), bin = sdEll(q.xz, E - 0.150);
  float u = clamp(-bo / 0.118, 0.0, 1.0);
  float top = 0.058 + 0.011 * 4.0 * u * (1.0 - u);
  float band = max(max(bo, -bin), q.y - top);
  // The gilding stands a hair proud of the enamel, so its edges catch the light.
  if (band < 0.006) { float gu; band = max(max(bo, -bin), q.y - top - 0.0016 * gilding(q, gu)); }
  r = U(r, vec2(band, 2.0));

  // The glass over the hair, a low dome.
  vec2 gr = E - 0.168;
  float k = length(q.xz / gr);
  float glass = max(sdEll(q.xz, gr), q.y - (0.050 + 0.026 * (1.0 - min(k * k * k * k, 1.0))));
  r = U(r, vec2(glass, 3.0));
  return r;
}

/* ---- the hair ----------------------------------------------------------- */

/* A flat three-strand plait seen from above, in its own frame: u along it,
   w across it (-1..1). Returns colour; a = how much is hair (0 = backing). */
vec3 plait(vec2 h, out float a) {
  const float W = 0.088, P = 0.046;
  vec2 dir = normalize(vec2(1.0, 0.52));
  // A gentle bend, so it was laid by hand.
  float u = dot(h, dir);
  float wv = dot(h, vec2(-dir.y, dir.x)) - 0.018 * sin(u * 7.0 + 0.6);
  float w = wv / W;
  float aw = abs(w);
  float side = w < 0.0 ? 0.0 : 1.0;
  // Each strand comes over from the edge to the middle at about 50 degrees.
  float s = (u + aw * W * 0.75) / P + side * 0.5;
  float id = floor(s) + side * 101.0;
  // Strands are not all the same thickness.
  float j = hash11(id * 3.7) - 0.5;
  float f = clamp((fract(s) - 0.5) * (1.0 + 0.35 * j) + 0.5 + 0.08 * j, 0.0, 1.0);
  // The plait's outline: straight sides, the strands rolling under at the
  // edges, a little wobble where one strand is fuller than the next.
  float edge = 1.0 + 0.06 * (hash11(id) - 0.5) + 0.05 * sin(u * 61.0);
  a = smoothstep(edge + 0.04, edge - 0.04, aw);
  // A rounded bundle: dark in the creases between strands and in the parting.
  float roundB = pow(max(sin(PI * f), 0.0), 0.7);
  float crease = smoothstep(0.0, 0.22, f) * smoothstep(1.0, 0.80, f);
  float part = smoothstep(0.0, 0.22, aw) * 0.85 + 0.15;
  float roll = smoothstep(edge, edge - 0.35, aw);
  // Individual hairs run the length of each strand: fine lines across the
  // strand's width (f), long along it. Two scales, and the odd stray colour.
  float along = aw * W;
  float x = f * P;
  float h1 = noise(vec2(x * 1400.0 + id * 7.3, along * 9.0 + id));
  float h2 = noise(vec2(x * 3100.0 + id * 3.1, along * 4.0));
  float hairs = 0.55 * h1 + 0.45 * h2;
  float tone = noise(vec2(x * 700.0 + id, 3.0));
  // The sheen: a band across each bundle where the hairs turn to the light,
  // broken up hair by hair; strands on the left lie towards the softbox.
  float f0 = mix(0.38, 0.6, side) + 0.08 * (noise(vec2(along * 50.0, id)) - 0.5);
  float shine = exp(-pow((f - f0) / 0.16, 2.0)) * mix(1.0, 0.55, side) * smoothstep(0.25, 0.75, h1);
  vec3 dark = hex(0x0e0906), mid = mix(hex(0x33241a), hex(0x4b3726), tone), lite = hex(0x806553);
  vec3 c = mix(dark, mid, roundB * crease * part * roll);
  c *= 0.6 + 0.75 * hairs;
  c = mix(c, lite, shine * crease * part * roll * 0.7);
  c *= 0.88 + 0.24 * hash11(id * 1.7);
  // Frizz at the edges: the outline is made of hairs, not cut.
  a *= smoothstep(0.2, 0.5, h2 + smoothstep(edge - 0.02, edge - 0.1, aw));
  return c;
}

/* A few loose hairs that would not lie down. */
float strays(vec2 h) {
  float ink = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 o = vec2(hash11(fi + 3.0) - 0.5, hash11(fi + 9.0) - 0.5) * vec2(0.30, 0.16);
    float ang = hash11(fi + 17.0) * TAU;
    vec2 d = vec2(cos(ang), sin(ang));
    vec2 l = h - o;
    float x = dot(l, d), y = dot(l, vec2(-d.y, d.x));
    float curve = y - (hash11(fi + 23.0) - 0.5) * 18.0 * x * x - 0.004 * sin(x * 140.0);
    float len = 0.04 + 0.06 * hash11(fi + 31.0);
    ink = max(ink, smoothstep(0.0007, 0.0002, abs(curve)) * step(abs(x), len) * (0.6 + 0.4 * hash11(fi)));
  }
  return ink;
}

vec3 compartment(vec3 q) {
  // Look through the glass, a little way down, the way the camera does.
  vec3 back = vec3(sin(VIEW_YAW) * cos(VIEW_PITCH), sin(VIEW_PITCH), cos(VIEW_YAW) * cos(VIEW_PITCH));
  vec3 vb = dirB(back);
  float depth = (q.y - 0.050) / 1.5;
  vec2 h = q.xz - vb.xz / vb.y * depth;
  vec2 gr = E - 0.171;
  float k = length(h / gr);
  // Milk glass behind, slightly cool, clouded.
  vec3 opal = mix(hex(0x4a4d51), hex(0x5f6266), fbm(vec3(h * 14.0, 2.0)));
  float a;
  vec3 hair = plait(h, a);
  // The plait stands proud of the backing: a soft shadow down and right of it.
  float sa;
  plait(h - vec2(0.006, 0.007), sa);
  opal *= 1.0 - 0.45 * sa * (1.0 - a);
  vec3 c = mix(opal, hair, a);
  c = mix(c, hex(0x3a2515), strays(h) * (1.0 - a) * 0.8);
  // The collet's shadow round the rim.
  c *= mix(0.35, 1.0, smoothstep(1.0, 0.84, k));
  return c;
}

/* ---- the gilding on the border ----------------------------------------- */

float gilding(vec3 q, out float u) {
  float bo = sdEll(q.xz, E - 0.032);
  u = clamp(-bo / 0.118, 0.0, 1.0);   // 0 at the outer edge, 1 at the inner
  float across = 1.0 - u;            // 0 inner .. 1 outer
  float t = arcT(eAngle(q.xz, E - 0.09), ecc(E - 0.09));
  const float SPAN = 2.55;
  float ink = 0.0;
  // IN MEMORY across the top (the far side, where t is near -pi/2).
  float tx = 0.5 + (t + PI * 0.5) / SPAN;
  if (tx > 0.0 && tx < 1.0 && q.z < 0.0) ink = max(ink, texture(u_tex, vec2(tx, 0.875 + across * 0.125)).r);
  // The ivy across the bottom, near the viewer.
  float bx = 0.5 + (t - PI * 0.5) / SPAN;
  if (bx > 0.0 && bx < 1.0 && q.z > 0.0) ink = max(ink, texture(u_tex, vec2(1.0 - bx, 0.71875 + across * 0.125)).r);
  // A fine gold line just inside each edge of the border.
  ink = max(ink, smoothstep(0.012, 0.004, abs(u - 0.075)));
  ink = max(ink, smoothstep(0.012, 0.004, abs(u - 0.925)));
  return ink;
}

Mat gold(vec3 q, vec3 n) {
  // Polished high spots, rubbed and darker in the recesses.
  float rub = fbm(q * 90.0);
  vec3 c = mix(hex(0xf2c07c), hex(0xc8925a), smoothstep(0.45, 0.8, rub) * 0.6);
  return mat(c, 0.17 + 0.12 * rub, 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 q = toB(p);
  if (id == 1.0 || id == 5.0) {
    Mat m = gold(q, n);
    if (id == 5.0) m.alb *= 0.9;
    return m;
  }
  if (id == 2.0) {
    float u;
    float ink = gilding(q, u);
    // Old enamel chips at the edges, showing the gold underneath.
    float chip = smoothstep(0.78, 0.82, noise(q.xz * 60.0)) * (smoothstep(0.12, 0.0, u) + smoothstep(0.88, 1.0, u));
    ink = max(ink, chip * 0.8);
    vec3 enamel = hex(0x060607) * (0.9 + 0.2 * noise(q.xz * 300.0));
    Mat g = gold(q, n);
    return mat(mix(enamel, g.alb * 0.92, ink), mix(0.12, 0.28, ink), ink);
  }
  if (id == 3.0) return mat(compartment(q), 0.55, 0.0);
  // Grey velvet: the pile catches the light in patches where it was brushed
  // one way and the other, and has fine speckle all over.
  float brush = fbm(vec3(p.xz * vec2(2.5, 4.0), 1.0));
  float crush = smoothstep(0.35, 0.75, fbm(vec3(p.xz * vec2(9.0, 4.0) + brush * 2.0, 5.0)));
  float pile = noise(p * 700.0) * 0.6 + noise(p * 1900.0) * 0.4;
  vec3 c = hex(0x2c3138) * (0.7 + 0.45 * brush) * (0.85 + 0.3 * crush) * (0.82 + 0.3 * pile);
  return mat(c, 1.0, 0.0);
}

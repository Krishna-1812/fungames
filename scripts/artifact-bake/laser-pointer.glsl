/* September 1995: the first eBay sale.
 *
 * Pierre Omidyar's AuctionWeb sold a broken laser pointer for $14.83, and the
 * buyer had read the listing and knew it was broken. This is the sort of
 * thing: a pen-style laser pointer in blue anodised aluminium, the thread of
 * its battery end showing where the cap has been taken off and set beside
 * it, a pocket clip, a worn push button, and a lens cracked across its face.
 * Two loose button cells lie by the cap. Unbranded, no engraving. Units: 1 is
 * 1 cm.
 */
#define BOUND vec3(6.3, 0.75, 7.8)
#define CENTRE vec3(0.35, 0.75, -0.65)
#define VIEW_YAW 0.40
#define VIEW_PITCH 0.58
#define FILL 0.84
#define EXPOSURE 1.15
#define COAT(id) (id == 7.0 ? 1.0 : id == 2.0 ? 0.3 : 0.0)

const vec3 UPV = vec3(0.0, 1.0, 0.0);
const vec3 C1 = vec3(-2.8, 0.8, -0.3);
const vec3 A1 = normalize(vec3(-0.29, 0.0, 0.956));
const vec3 S1 = normalize(cross(UPV, A1));
const vec3 O2 = vec3(4.3, 0.86, -1.6);                 // the cap's closed end
const vec3 A2 = normalize(vec3(-0.12, 0.0, 0.99));    // its open end is this way
const vec3 S2 = normalize(cross(UPV, A2));
const float RB = 0.8;      // the barrel's radius
const float LENS_S = 6.64; // where the lens lies, along the barrel

/* A cylinder along an axis: r about the line through o along d, from s0 to s1. */
float cylAx(vec3 p, vec3 o, vec3 d, float s0, float s1, float r, float bevel) {
  vec3 q = p - o;
  float s = dot(q, d);
  float rr = length(q - d * s);
  vec2 w = vec2(rr - (r - bevel), abs(s - 0.5 * (s0 + s1)) - (0.5 * (s1 - s0) - bevel));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - bevel;
}

/* The web of cracks on the lens: 1 on a crack. uv in cm from the lens centre. */
float cracks(vec2 uv) {
  vec2 im = vec2(0.14, 0.10);
  float r = length(uv - im);
  vec3 v = voronoi(uv * 3.4 + 3.0);
  float web = smoothstep(0.13, 0.03, v.y - v.x) * smoothstep(0.7, 0.2, r);
  // two long fractures through the impact
  vec2 d1 = normalize(vec2(0.86, 0.5)), d2 = normalize(vec2(-0.3, 0.95));
  float l1 = smoothstep(0.03, 0.01, abs(dot(uv - im, vec2(-d1.y, d1.x)) + 0.03 * sin(dot(uv - im, d1) * 9.0)));
  float l2 = smoothstep(0.026, 0.008, abs(dot(uv - im, vec2(-d2.y, d2.x)) + 0.025 * sin(dot(uv - im, d2) * 11.0))) * step(0.0, dot(uv - im, d2));
  return clamp(max(web, max(l1, l2)) , 0.0, 1.0);
}

vec2 map(vec3 p) {
  // ---- the pointer ----
  vec3 q = p - C1;
  float s = dot(q, A1);
  float zz = dot(q, S1);
  vec3 rv = q - A1 * s;
  float r = length(rv);

  float barrel = cylAx(p, C1, A1, -6.5, 5.3, RB, 0.09);
  // four grip grooves near the middle
  float gv = max(abs(mod(s - 0.1, 0.34) - 0.17) - 0.05, max(0.74 - r, abs(s - 1.0) - 0.95));
  barrel = smax(barrel, -gv, 0.015);
  // the head: a taper into a bezel
  float head = sdCone(p, C1 + A1 * 5.2, C1 + A1 * 6.3, 0.795, 0.7);
  head = smin(head, cylAx(p, C1, A1, 6.0, 6.75, 0.745, 0.07), 0.05);
  float barrelHead = smin(barrel, head, 0.06);
  // the aperture, a recess the lens sits in
  barrelHead = smax(barrelHead, -(max(r - 0.56, LENS_S - s)), 0.02);
  // the thread stub at the battery end, hollow, threaded
  float ang = atan(dot(rv, UPV), dot(rv, S1));
  float th = 0.028 * sin((s * 6.28318 / 0.12) + ang);
  float stub = max(r - 0.63 - th, max(-7.5 - s, s + 6.4));
  stub = max(stub, -(max(r - 0.47, -s - 5.0)));
  barrelHead = smin(barrelHead, stub, 0.03);
  // the bore of the barrel's open end
  barrelHead = smax(barrelHead, -(max(r - 0.47, -s - 5.2)), 0.02);
  vec2 d = vec2(barrelHead, 1.0);
  // the contact at the bottom of the bore
  d = U(d, vec2(cylAx(p, C1, A1, -5.4, -5.0, 0.38, 0.05), 3.0));
  // the clip band and the clip
  float band = cylAx(p, C1, A1, -5.2, -4.6, RB + 0.07, 0.05);
  float yl = 0.8 + 0.1 + 0.2 * smoothstep(-3.4, -0.4, s);
  vec3 cl = vec3(s + 2.7, q.y - yl, zz);
  float clip = sdRound(cl, vec3(2.35, 0.04, 0.3), 0.04);
  clip = smin(clip, sdBox(vec3(s + 4.9, q.y - 0.88, zz) , vec3(0.28, 0.1, 0.3)) - 0.02, 0.05);
  d = U(d, vec2(min(band, clip), 3.0));
  // the push button
  vec3 lb = vec3(s - 3.3, q.y, zz);
  float btn = sdCapsule(lb, vec3(0.0, 0.52, 0.0), vec3(0.0, 0.62, 0.0), 0.34);
  d = U(d, vec2(btn, 2.0));
  // the lens, with cracks pressed into it
  if (abs(s - LENS_S) < 0.3 && r < 0.7) {
    float cr = cracks(vec2(zz, q.y));
    float lens = cylAx(p, C1, A1, LENS_S - 0.2, LENS_S, 0.56, 0.0) + 0.012 * cr;
    d = U(d, vec2(lens, 7.0));
  } else {
    d = U(d, vec2(cylAx(p, C1, A1, LENS_S - 0.2, LENS_S, 0.56, 0.0), 7.0));
  }

  // ---- the cap ----
  vec3 q2 = p - O2;
  float s2 = dot(q2, A2);
  vec3 rv2 = q2 - A2 * s2;
  float r2 = length(rv2);
  float ang2 = atan(dot(rv2, UPV), dot(rv2, S2));
  float kn = 0.025 * smoothstep(0.0, 1.0, sin(ang2 * 34.0)) * step(0.35, s2);
  float capo = cylAx(p, O2, A2, 0.0, 2.4, 0.86, 0.12) - kn * 0.6;
  float bore = max(r2 - 0.645 - 0.026 * sin(s2 * 6.28318 / 0.12 + ang2), 0.45 - s2);
  capo = smax(capo, -bore, 0.02);
  d = U(d, vec2(capo, 4.0));

  // ---- two button cells ----
  vec3 c1 = p - vec3(3.0, 0.14, 4.0);
  float cell1 = sdCyl(c1, 0.58, 0.14) - 0.02;
  vec3 c2 = p - vec3(4.8, 0.14, 3.1);
  c2.xz = rot(0.7) * c2.xz;
  float cell2 = sdCyl(c2, 0.58, 0.14) - 0.02;
  d = U(d, vec2(min(cell1, cell2), 6.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 q = p - C1;
  float s = dot(q, A1);
  float zz = dot(q, S1);
  vec3 rv = q - A1 * s;
  float r = length(rv);
  float ang = atan(dot(rv, UPV), dot(rv, S1));
  if (id == 1.0) {
    // Blue anodised aluminium: scratches and bumps wear through to bare metal.
    vec3 blue = hex(0x1b3466);
    float sc = smoothstep(0.9, 0.985, noise(vec3(ang * 18.0, s * 2.2, 1.0)));
    float sc2 = smoothstep(0.93, 0.99, noise(vec3(ang * 40.0, s * 6.0, 5.0)));
    float rim = smoothstep(0.1, 0.0, min(abs(s - 5.3), min(abs(s + 6.5), abs(s - 6.75))));
    float rub = smoothstep(0.62, 0.9, fbm(vec3(s * 3.5, ang * 3.0, 2.0))) * smoothstep(-0.2, 1.0, sin(ang));
    float bare = clamp(sc * 0.5 + sc2 * 0.35 + rim * 0.8 + rub * 0.22, 0.0, 1.0);
    vec3 c = mix(blue, hex(0xbfc3c7), bare);
    // fingerprints, an oily haze
    float fp = smoothstep(0.55, 0.85, fbm(p * 4.0 + 9.0));
    c = mix(c, c * 1.25 + 0.02, fp * 0.2);
    float isHead = step(5.2, s);
    return mat(c, mix(0.34, 0.2, bare) + 0.1 * fp, mix(0.7, 1.0, bare));
  }
  if (id == 2.0) {
    // The button: black plastic worn shiny and grey in the middle.
    float wear = smoothstep(0.34, 0.0, length(vec2(s - 3.3, zz)));
    return mat(mix(hex(0x161618), hex(0x58595c), wear * 0.7), mix(0.4, 0.16, wear), 0.0);
  }
  if (id == 3.0) {
    // Plain steel: clip, band, the contact.
    float br = noise(vec3(ang * 40.0, s * 2.0, 0.0));
    return mat(mix(hex(0x9da1a6), hex(0xc6c9cd), br), 0.26 + 0.1 * br, 1.0);
  }
  if (id == 4.0) {
    // The cap: the same blue, rubbed at the rim; inside, bare machined metal.
    vec3 q2 = p - O2;
    float s2 = dot(q2, A2);
    vec3 rv2 = q2 - A2 * s2;
    float r2 = length(rv2);
    float ang2 = atan(dot(rv2, UPV), dot(rv2, S2));
    float inside = smoothstep(0.7, 0.66, r2) * step(0.4, s2);
    float rim = smoothstep(0.12, 0.0, abs(s2 - 2.4)) + smoothstep(0.14, 0.0, s2);
    float sc = smoothstep(0.9, 0.985, noise(vec3(ang2 * 18.0, s2 * 2.2, 3.0)));
    float rub = smoothstep(0.55, 0.85, fbm(vec3(s2 * 1.4, ang2 * 1.5, 8.0)));
    float bare = clamp(sc * 0.5 + rim * 0.7 + rub * 0.3 + inside, 0.0, 1.0);
    vec3 c = mix(hex(0x1b3466), hex(0xbfc3c7), bare);
    return mat(c, mix(0.34, 0.3, bare), mix(0.7, 1.0, bare));
  }
  if (id == 6.0) {
    // A button cell: stainless, a ring pressed into the face.
    vec3 c = hex(0xb7babf);
    return mat(c, 0.3 + 0.1 * noise(p * 60.0), 1.0);
  }
  // The lens: dark, glossy glass, cracks pale and rough.
  float cr = cracks(vec2(zz, q.y));
  vec3 c = mix(hex(0x05070b), hex(0xb0bcc6), cr);
  return mat(c, mix(0.06, 0.4, cr), 0.0);
}

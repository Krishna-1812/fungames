/* June 24, 1993: the first concert streamed live.
 *
 * Severe Tire Damage played Xerox PARC's lawn and the Mbone carried it to
 * whoever was listening. What stood in front of them, in everyone's mind, is
 * this: a dynamic vocal microphone, unbranded: a steel-mesh ball grille on a
 * matte black body, in a clip on a short weighted desk stand, its XLR lead
 * running out of the back and curling away across the table to the plug at
 * the other end. Mesh, black paint, chrome and rubber, a little worn where
 * hands hold it. Units: 1 is 1 cm.
 */
#define BOUND vec3(10.6, 10.4, 7.0)
#define CENTRE vec3(2.3, 10.4, 2.4)
#define VIEW_YAW 0.46
#define VIEW_PITCH 0.30
#define FILL 0.82
#define EXPOSURE 1.18
#define COAT(id) (id == 1.0 ? 0.2 : id == 4.0 ? 0.15 : 0.0)
#define SHEEN(id) (id == 1.0 ? 0.55 : id == 4.0 ? 0.5 : id == 5.0 ? 0.6 : 0.0)

const vec3 A = vec3(-0.79, 0.50, 0.36);           // the way the microphone points (unit enough)
const vec3 P0 = vec3(0.0, 12.2, 0.0);             // where the clip holds it
const vec3 PD = vec3(-0.97, 0.0, -0.25);          // the way the far plug lies
const vec3 PB = vec3(0.2, 1.2, 7.2);              // its boot's start

const vec3 CAB[45] = vec3[45](
  vec3(9.76, 6.10, -4.03), vec3(9.97, 5.95, -4.08), vec3(10.26, 5.75, -4.15), vec3(10.59, 5.50, -4.20),
  vec3(10.90, 5.20, -4.20), vec3(11.19, 4.86, -4.14), vec3(11.48, 4.46, -4.03), vec3(11.76, 4.04, -3.88),
  vec3(12.00, 3.60, -3.70), vec3(12.20, 3.13, -3.48), vec3(12.37, 2.64, -3.23), vec3(12.50, 2.14, -2.94),
  vec3(12.60, 1.70, -2.60), vec3(12.63, 1.29, -2.22), vec3(12.61, 0.90, -1.81), vec3(12.59, 0.57, -1.34),
  vec3(12.60, 0.34, -0.80), vec3(12.70, 0.30, -0.17), vec3(12.84, 0.30, 0.55), vec3(12.96, 0.30, 1.29),
  vec3(13.00, 0.32, 2.00), vec3(12.96, 0.32, 2.67), vec3(12.86, 0.32, 3.33), vec3(12.68, 0.32, 3.98),
  vec3(12.40, 0.32, 4.60), vec3(12.00, 0.32, 5.21), vec3(11.49, 0.32, 5.82), vec3(10.92, 0.32, 6.39),
  vec3(10.30, 0.32, 6.90), vec3(9.64, 0.32, 7.35), vec3(8.92, 0.32, 7.76), vec3(8.16, 0.32, 8.11),
  vec3(7.40, 0.32, 8.40), vec3(6.61, 0.32, 8.62), vec3(5.78, 0.32, 8.79), vec3(4.96, 0.32, 8.88),
  vec3(4.20, 0.32, 8.90), vec3(3.48, 0.30, 8.82), vec3(2.79, 0.30, 8.64), vec3(2.15, 0.30, 8.42),
  vec3(1.60, 0.32, 8.20), vec3(1.13, 0.50, 7.95), vec3(0.74, 0.76, 7.66), vec3(0.42, 1.02, 7.39),
  vec3(0.20, 1.20, 7.20));

/* A cylinder along an axis through o, direction d, from s0 to s1. */
float cylAx(vec3 p, vec3 o, vec3 d, float s0, float s1, float r, float bevel) {
  vec3 q = p - o;
  float s = dot(q, d);
  float rr = length(q - d * s);
  vec2 w = vec2(rr - (r - bevel), abs(s - 0.5 * (s0 + s1)) - (0.5 * (s1 - s0) - bevel));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - bevel;
}

/* The grille's mesh as a wire intensity (1 on a wire, 0 in a gap): diagonal wires
   about 2 mm apart, projected along each axis and blended by the normal. */
float meshAt(vec3 q, vec3 n) {
  float k = 5.0;
  vec3 w = pow(abs(n), vec3(6.0)); w /= w.x + w.y + w.z;
  vec2 a = q.yz * k, b = q.xz * k, c = q.xy * k;
  float mx = max(abs(fract(a.x + a.y) - 0.5), abs(fract(a.x - a.y) - 0.5));
  float my = max(abs(fract(b.x + b.y) - 0.5), abs(fract(b.x - b.y) - 0.5));
  float mz = max(abs(fract(c.x + c.y) - 0.5), abs(fract(c.x - c.y) - 0.5));
  float m = mx * w.x + my * w.y + mz * w.z;
  return 1.0 - smoothstep(0.30, 0.42, m);
}

vec2 map(vec3 p) {
  vec3 q = p - P0;
  float s = dot(q, A);
  vec3 rv = q - A * s;
  float r = length(rv);
  vec3 upP = normalize(vec3(0.0, 1.0, 0.0) - A * A.y);
  vec3 side = cross(A, upP);

  // The body: black, tapering to the back, a nickel ring where the ball meets it.
  float body = sdCone(p, P0 + A * 4.8, P0 - A * 7.0, 1.98, 1.52);
  body = min(body, cylAx(p, P0, A, -7.8, -7.0, 1.58, 0.14));
  vec2 d = vec2(body, 1.0);
  float ring = cylAx(p, P0, A, 4.25, 5.35, 2.22, 0.16);
  float ring2 = cylAx(p, P0, A, -0.2, 0.0, 1.66, 0.04);
  d = U(d, vec2(min(ring, ring2), 3.0));
  // The ball grille, a relief of mesh, with a seam round its equator.
  vec3 ctr = P0 + A * 7.0;
  float ball = length(p - ctr) - 2.58;
  d = U(d, vec2(ball * 0.8, 2.0));
  // The connector at the back: a nickel barrel with its latch, then the boot.
  float con = cylAx(p, P0, A, -10.6, -7.7, 1.3, 0.1);
  float latch = sdRound(vec3(dot(q, side), dot(q, upP) - 1.34, s + 9.0) , vec3(0.3, 0.14, 0.9), 0.07);
  d = U(d, vec2(min(con, latch), 3.0));
  float boot = sdCone(p, P0 - A * 10.5, P0 - A * 12.2, 1.05, 0.36);
  boot = smin(boot, cylAx(p, P0, A, -11.0, -10.4, 1.35, 0.1), 0.1);
  d = U(d, vec2(boot, 5.0));

  // The clip: a C of black plastic round the body, opening at the top, with a
  // little neck down to the stand's joint.
  float band = max(abs(r - 2.14) - 0.22, abs(s - 0.3) - 1.2);
  band = smax(band, -max(dot(rv, upP) - 0.9, abs(dot(rv, side)) - 1.15), 0.06);
  band = band - 0.05;
  vec3 J = vec3(0.0, 9.6, 0.0);
  float neck = sdCapsule(p, J + vec3(0.0, 0.5, 0.0), P0 - upP * 2.15 + A * 0.3, 0.78);
  band = smin(band, neck, 0.25);
  float knob = cylAx(p, J, vec3(0.0, 0.0, 1.0), 0.6, 1.9, 1.0, 0.12);
  float ang = atan(p.y - J.y, p.x - J.x);
  knob += 0.045 * smoothstep(0.0, 1.0, sin(ang * 14.0)) * smoothstep(1.7, 1.1, abs(p.z - 1.3) + 0.5);
  d = U(d, vec2(min(band, knob), 4.0));

  // The stand: a heavy round base, a chrome tube, the joint.
  float base = max(sdCyl(p - vec3(0.0, 0.8, 0.0), 6.4, 0.8) - 0.12, p.y - 1.55 - 0.18 * clamp(1.0 - length(p.xz) / 6.4, 0.0, 1.0));
  d = U(d, vec2(base * 0.9, 4.0));
  float foot = max(sdCyl(p - vec3(0.0, 0.17, 0.0), 6.52, 0.19) - 0.05, -p.y);
  d = U(d, vec2(foot, 6.0));
  float tube = sdCapsule(p, vec3(0.0, 1.0, 0.0), vec3(0.0, 9.5, 0.0), 0.82);
  float collar = cylAx(p, vec3(0.0, 1.5, 0.0), vec3(0.0, 1.0, 0.0), 0.0, 0.5, 1.5, 0.12);
  float joint = sdRound(p - J, vec3(1.25, 0.7, 0.95), 0.3);
  d = U(d, vec2(min(tube, collar), 3.0));
  d = U(d, vec2(joint, 4.0));

  // The lead: capsules along the curl, from the boot to the plug. Only worked
  // out near it.
  float cb = sdBox(p - vec3(6.8, 3.2, 2.4), vec3(7.2, 3.6, 7.4));
  if (cb < 0.6) {
    float c = 1e9;
    for (int i = 0; i < 44; i++) c = smin(c, sdCapsule(p, CAB[i], CAB[i + 1], 0.3), 0.02);
    d = U(d, vec2(c, 5.0));
  } else {
    d = U(d, vec2(cb - 0.1, 5.0));
  }

  // The plug lying on the table: a nickel barrel, hollow, with three pins.
  vec3 pq = p - PB;
  float u = dot(pq, PD);
  float pr = length(pq - PD * u);
  float pboot = sdCone(p, PB, PB + PD * 2.0, 0.34, 1.0);
  d = U(d, vec2(pboot, 5.0));
  float pbar = cylAx(p, PB, PD, 1.8, 5.5, 1.2, 0.08);
  pbar = max(pbar, -(max(pr - 1.02, 4.0 - u)));
  float pins = 1e9;
  vec3 lat = cross(PD, vec3(0.0, 1.0, 0.0));
  vec3 vv = pq - PD * u;
  for (int i = 0; i < 3; i++) {
    float an = 1.5708 + float(i) * 2.0944;
    vec3 pc = (cos(an) * lat + sin(an) * vec3(0.0, 1.0, 0.0)) * 0.5;
    pins = min(pins, max(length(vv - pc) - 0.11, max(u - 5.1, 3.7 - u)));
  }
  float insert = cylAx(p, PB, PD, 3.6, 4.1, 0.98, 0.04);
  d = U(d, vec2(min(pbar, pins), 3.0));
  d = U(d, vec2(insert, 1.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Matt black paint with a fine stipple, wearing through to dull metal at the ring and the grip.
    vec3 q = p - P0;
    float s = dot(q, A);
    float wear = smoothstep(0.55, 0.9, fbm(p * 14.0)) * smoothstep(-1.0, 2.5, s) * 0.16;
    vec3 c = mix(hex(0x1b1c1e), hex(0x55585b), wear);
    float stip = noise(p * 90.0);
    float fp = smoothstep(0.6, 0.85, fbm(p * 2.2 + 3.0)) * 0.05;
    c = mix(c, hex(0x707477), fp);
    return mat(c, 0.52 + 0.12 * stip - 0.1 * wear, 0.0);
  }
  if (id == 2.0) {
    // Woven steel: bright wire, dark gaps.
    vec3 q = p - (P0 + A * 7.0);
    float wire = meshAt(q, n);
    float dent = smoothstep(0.6, 0.85, fbm(q * 3.0)) * 0.12;
    vec3 c = mix(hex(0x1a1b1d), hex(0xc4c8cc), wire);
    c = mix(c, hex(0xe6e9ec), dent);
    return mat(c, mix(0.55, 0.28, wire), mix(0.4, 1.0, wire));
  }
  if (id == 3.0) {
    // Nickel and chrome: bright, a little brushed, fingerprinted.
    float br = noise(vec3(atan(p.z, p.x) * 60.0, p.y * 2.0, 0.0));
    float fp = smoothstep(0.55, 0.85, fbm(p * 3.0 + 7.0));
    vec3 c = mix(hex(0xb8bcc0), hex(0xdfe2e5), br);
    return mat(c, 0.2 + 0.12 * br + 0.2 * fp, 1.0);
  }
  if (id == 4.0) {
    // Black ABS and cast base: hammered, slightly dusty.
    float h = noise(p * 40.0);
    float edge = smoothstep(0.55, 0.85, fbm(p * 11.0));
    vec3 c = mix(hex(0x232426), hex(0x5a5d60), edge * 0.12);
    float dust = smoothstep(0.9, 0.97, noise(p * 90.0)) * 0.07;
    c = mix(c, hex(0x8d9094), dust);
    return mat(c, 0.55 + 0.18 * h, 0.0);
  }
  if (id == 5.0) {
    // Cable rubber: black, soft sheen, faint seam line along it.
    float ripple = noise(p * 6.0);
    return mat(hex(0x161718), 0.42 + 0.1 * ripple, 0.0);
  }
  // The rubber foot.
  return mat(hex(0x0f0f10), 0.8, 0.0);
}

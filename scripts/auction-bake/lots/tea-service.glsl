/* Lot: a tea service for eleven.
 *
 * English bone china printed under the glaze in cobalt with sprays of roses
 * and a diaper-and-scallop border, the rims lined in platinum. A catalogue
 * group: the teapot and its lid, the milk jug, the sugar basin, two cups on
 * their saucers, a stack of six tea plates, and in front one saucer on its
 * own, with no cup. Every piece is turned: a profile of quadratic curves
 * revolved about its axis, so the walls, rims and foot rings are one smooth
 * shell; handles and the spout are tubes swept along curves. The print is
 * in tea-service.svg. Units: 1 is 10 cm.
 */
#define BOUND vec3(2.5, 0.68, 2.15)
#define CENTRE vec3(0.05, 0.66, 0.0)
#define VIEW_YAW 0.30
#define VIEW_PITCH 0.50
#define FILL 0.88
#define STEP 0.8
#define COAT(id) 1.0

const float TH = 0.011;   // half the wall of a cup or plate

float dot2(vec2 v) { return dot(v, v); }

/* Distance to a quadratic Bezier, and where along it (Inigo Quilez). */
vec2 bez(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A, b = A - 2.0 * B + C, c = a * 2.0, d = A - pos;
  float kk = 1.0 / dot(b, b);
  float kx = kk * dot(a, b);
  float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
  float kz = kk * dot(d, a);
  float p = ky - kx * kx, p3 = p * p * p;
  float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
  float h = q * q + 4.0 * p3;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) / 2.0;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
    return vec2(sqrt(dot2(d + (c + b * t) * t)), t);
  }
  float z = sqrt(-p);
  float v = acos(q / (p * z * 2.0)) / 3.0;
  float m = cos(v), n = sin(v) * 1.732050808;
  vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
  float d1 = dot2(d + (c + b * t.x) * t.x), d2 = dot2(d + (c + b * t.y) * t.y);
  return d1 < d2 ? vec2(sqrt(d1), t.x) : vec2(sqrt(d2), t.y);
}

float rrect(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
/* A foot ring of half-width w at radius r, from the table to height h. */
float foot(vec2 ry, float r, float h, float w) { return rrect(ry - vec2(r, h * 0.5), vec2(w, h * 0.5), w * 0.9); }

/* ---- the pieces, each standing on y = 0 at its own origin ---------------- */

float cupBody(vec2 ry) {
  float d = bez(ry, vec2(0.0, 0.07), vec2(0.30, 0.065), vec2(0.38, 0.20)).x;
  d = min(d, bez(ry, vec2(0.38, 0.20), vec2(0.452, 0.3215), vec2(0.445, 0.50)).x);
  d = min(d, bez(ry, vec2(0.445, 0.50), vec2(0.4422, 0.5714), vec2(0.46, 0.62)).x);
  return min(d - TH, foot(ry, 0.205, 0.075, 0.017));
}
float cupHandle(vec3 q) {
  vec2 h = vec2(-q.x, q.y);
  float d = min(bez(h, vec2(0.43, 0.53), vec2(0.72, 0.63), vec2(0.67, 0.37)).x,
                bez(h, vec2(0.67, 0.37), vec2(0.645, 0.214), vec2(0.39, 0.19)).x);
  d = length(vec2(d, q.z * 0.8)) - 0.023;
  // Not into the cup: cut at the middle of the wall.
  float wall = length(q.xz) - mix(0.375, 0.445, clamp((q.y - 0.2) / 0.3, 0.0, 1.0));
  return max(d, -wall);
}
float cup(vec3 q) { return min(cupBody(vec2(length(q.xz), q.y)), cupHandle(q)); }

float saucer(vec3 q) {
  vec2 ry = vec2(length(q.xz), q.y);
  float d = bez(ry, vec2(0.0, 0.05), vec2(0.20, 0.05), vec2(0.30, 0.056)).x;
  d = min(d, bez(ry, vec2(0.30, 0.056), vec2(0.40, 0.062), vec2(0.55, 0.092)).x);
  d = min(d, bez(ry, vec2(0.55, 0.092), vec2(0.64, 0.110), vec2(0.72, 0.135)).x);
  return min(d - TH * 0.95, foot(ry, 0.36, 0.056, 0.016));
}

float plate(vec3 q) {
  vec2 ry = vec2(length(q.xz), q.y);
  float d = bez(ry, vec2(0.0, 0.04), vec2(0.40, 0.04), vec2(0.58, 0.045)).x;
  d = min(d, bez(ry, vec2(0.58, 0.045), vec2(0.67, 0.0475), vec2(0.74, 0.08)).x);
  d = min(d, bez(ry, vec2(0.74, 0.08), vec2(0.824, 0.119), vec2(0.95, 0.13)).x);
  return min(d - TH, foot(ry, 0.50, 0.046, 0.016));
}

float potBody(vec3 q) {
  vec2 ry = vec2(length(q.xz), q.y);
  float d = bez(ry, vec2(0.0, 0.06), vec2(0.35, 0.06), vec2(0.52, 0.10)).x;
  d = min(d, bez(ry, vec2(0.52, 0.10), vec2(0.74, 0.16), vec2(0.78, 0.42)).x);
  d = min(d, bez(ry, vec2(0.78, 0.42), vec2(0.816, 0.654), vec2(0.62, 0.86)).x);
  d = min(d, bez(ry, vec2(0.62, 0.86), vec2(0.522, 0.963), vec2(0.42, 0.98)).x);
  d = min(d, bez(ry, vec2(0.42, 0.98), vec2(0.3945, 0.984), vec2(0.39, 1.02)).x);
  d = min(d - 0.014, foot(ry, 0.50, 0.11, 0.02));
  // The spout, swept and tapered, hollow, cut off at a slant.
  vec2 h = vec2(q.x, q.y);
  vec2 a = bez(h, vec2(0.62, 0.30), vec2(1.0, 0.36), vec2(1.06, 0.62));
  vec2 b = bez(h, vec2(1.06, 0.62), vec2(1.108, 0.828), vec2(1.22, 0.92));
  float t = a.x < b.x ? a.y * 0.5 : 0.5 + b.y * 0.5;
  float rad = mix(0.13, 0.042, smoothstep(0.0, 1.0, t)) + 0.012 * smoothstep(0.92, 1.0, t);
  float tube = length(vec2(min(a.x, b.x), q.z)) - rad;
  float sp = max(tube, -(tube + 0.016));
  sp = max(sp, dot(h - vec2(1.21, 0.915), normalize(vec2(0.55, 0.84))));
  d = smin(d, sp, 0.035);
  // The handle: a loop, oval in section.
  vec2 g = vec2(-q.x, q.y);
  float hd = min(bez(g, vec2(0.66, 0.82), vec2(1.20, 0.94), vec2(1.13, 0.56)).x,
                 bez(g, vec2(1.13, 0.56), vec2(1.088, 0.308), vec2(0.70, 0.22)).x);
  hd = length(vec2(hd, q.z * 0.72)) - 0.043;
  return smin(d, hd, 0.03);
}
float potLid(vec3 q) {
  vec2 ry = vec2(length(q.xz), q.y);
  float d = bez(ry, vec2(0.0, 1.19), vec2(0.25, 1.19), vec2(0.36, 1.08)).x;
  d = min(d, bez(ry, vec2(0.36, 1.08), vec2(0.404, 1.036), vec2(0.43, 1.03)).x);
  d -= 0.012;
  // The knob: a bud on a short neck, a point on top.
  float k = sdEllipsoid(q - vec3(0.0, 1.29, 0.0), vec3(0.075, 0.068, 0.075));
  k = smin(k, sdSphere(q - vec3(0.0, 1.362, 0.0), 0.018), 0.02);
  return smin(d, k, 0.045);
}

float jug(vec3 q) {
  // The lip, on +x: the rim drawn out and up into a spout.
  float ang = atan(q.z, q.x);
  float w = pow(max(cos(ang), 0.0), 6.0);
  float rimZone = smoothstep(0.56, 0.82, q.y);
  vec2 ry = vec2(length(q.xz) - w * rimZone * 0.12, q.y - w * rimZone * 0.04);
  float d = bez(ry, vec2(0.0, 0.05), vec2(0.30, 0.05), vec2(0.40, 0.12)).x;
  d = min(d, bez(ry, vec2(0.40, 0.12), vec2(0.52, 0.204), vec2(0.50, 0.40)).x);
  d = min(d, bez(ry, vec2(0.50, 0.40), vec2(0.482, 0.576), vec2(0.40, 0.66)).x);
  d = min(d, bez(ry, vec2(0.40, 0.66), vec2(0.351, 0.71), vec2(0.40, 0.80)).x);
  d = min(d - TH, foot(vec2(length(q.xz), q.y), 0.29, 0.06, 0.017));
  vec2 g = vec2(-q.x, q.y);
  float hd = min(bez(g, vec2(0.40, 0.73), vec2(0.76, 0.80), vec2(0.68, 0.46)).x,
                 bez(g, vec2(0.68, 0.46), vec2(0.64, 0.30), vec2(0.44, 0.21)).x);
  hd = length(vec2(hd, q.z * 0.78)) - 0.028;
  float wall = length(q.xz) - mix(0.47, 0.40, clamp((q.y - 0.4) / 0.26, 0.0, 1.0));
  hd = max(hd, -wall);
  return smin(d, hd, 0.012);
}

float sugar(vec3 q) {
  vec2 ry = vec2(length(q.xz), q.y);
  float d = bez(ry, vec2(0.0, 0.09), vec2(0.32, 0.09), vec2(0.42, 0.16)).x;
  d = min(d, bez(ry, vec2(0.42, 0.16), vec2(0.55, 0.251), vec2(0.58, 0.42)).x);
  d = min(d, bez(ry, vec2(0.58, 0.42), vec2(0.595, 0.5045), vec2(0.625, 0.55)).x);
  return min(d - TH, foot(ry, 0.31, 0.095, 0.02));
}

/* ---- the arrangement -------------------------------------------------- */

const int N = 15;
/* Where each piece stands: x, z, the height it stands at, and its turn. */
vec4 place(int k) {
  if (k <= 1) return vec4(-0.62, -0.92, 0.0, 0.55);       // teapot, lid
  if (k == 2) return vec4(1.92, 0.42, 0.0, 2.45);         // milk jug
  if (k == 3) return vec4(-1.78, 0.12, 0.0, 0.0);         // sugar basin
  if (k == 4) return vec4(-0.62, 0.50, 0.0, 0.0);         // saucer A
  if (k == 5) return vec4(0.78, 0.40, 0.0, 0.0);          // saucer B
  if (k == 6) return vec4(0.06, 1.42, 0.0, 0.0);          // the saucer with no cup
  if (k == 7) return vec4(-0.62, 0.50, 0.0605, -0.35);    // cup A
  if (k == 8) return vec4(0.78, 0.40, 0.0605, 0.75);      // cup B
  return vec4(1.36, -1.02, float(k - 9) * 0.051, 0.0);    // the plates
}
vec3 local(vec3 p, int k) {
  vec4 pl = place(k);
  vec3 q = p - vec3(pl.x, pl.z, pl.y);
  q.xz = rot(pl.w) * q.xz;
  return q;
}
/* A rough cylinder round each piece, to skip the ones far away. */
vec2 hull(int k) {
  if (k == 0) return vec2(1.3, 1.1);
  if (k == 1) return vec2(0.46, 1.4);
  if (k == 2) return vec2(0.8, 0.85);
  if (k == 3) return vec2(0.66, 0.6);
  if (k <= 6) return vec2(0.75, 0.16);
  if (k <= 8) return vec2(0.72, 0.66);
  return vec2(0.98, 0.16);
}
float piece(vec3 q, int k) {
  if (k == 0) return potBody(q);
  if (k == 1) return potLid(q);
  if (k == 2) return jug(q);
  if (k == 3) return sugar(q);
  if (k <= 6) return saucer(q);
  if (k <= 8) return cup(q);
  return plate(q);
}

vec2 map(vec3 p) {
  vec2 r = vec2(9.0, 1.0);
  for (int k = 0; k < N; k++) {
    vec3 q = local(p, k);
    vec2 hb = hull(k);
    float bd = sdCyl(q - vec3(0.0, hb.y * 0.5, 0.0), hb.x, hb.y * 0.5 + 0.02);
    if (bd > 0.04) { r = U(r, vec2(bd, float(k + 1))); continue; }
    r = U(r, vec2(piece(q, k), float(k + 1)));
  }
  return r;
}

/* ---- the print and the glaze --------------------------------------------- */

float ink(vec2 uv) { return pow(texture(u_tex, uv).r, 1.6); }

/* The band, wrapped round a hollow piece: v 0 at the foot, 1 at the rim. */
float band(vec3 q, float reps, float v) {
  float u = atan(q.z, q.x) / TAU * reps;
  return ink(vec2(u, 0.505 + 0.49 * clamp(v, 0.0, 1.0)));
}
/* The flatware design, r in units of the piece's radius. */
float flat2(vec2 xz, float R) { return ink(vec2(0.25, 0.25) + vec2(xz.x, -xz.y) / R * 0.246); }
float bouquet(vec2 xz, float R) { return length(xz) > R ? 0.0 : ink(vec2(0.75, 0.25) + vec2(xz.x, -xz.y) / R * 0.12); }

Mat material(float id, vec3 p, vec3 n) {
  int k = int(id + 0.5) - 1;
  vec3 q = local(p, k);
  vec3 nl = n; nl.xz = rot(place(k).w) * nl.xz;
  float r = length(q.xz);
  vec3 radial = vec3(q.x, 0.0, q.z) / max(r, 1e-4);
  float outward = dot(nl, radial);
  float blue = 0.0, silver = 0.0;

  if (k == 7 || k == 8) {
    // A cup: the band outside, the border inside the rim, a bouquet in the bottom.
    bool handle = -q.x > 0.40 && abs(q.z) < 0.08 && r > 0.47 - 0.0;
    if (!handle) {
      if (outward > 0.0 && q.y > 0.09) blue = band(q, 3.0, (q.y - 0.10) / 0.52);
      else if (q.y > 0.3) blue = band(q, 3.0, 1.0 - (0.62 - q.y) / 0.52) * step(0.86, 1.0 - (0.62 - q.y) / 0.52);
      else if (nl.y > 0.5) blue = bouquet(q.xz, 0.2);
      silver = smoothstep(0.603, 0.612, q.y);
    }
  } else if (k >= 4) {
    // Flatware: the design on top, platinum at the edge.
    float R = k >= 9 ? 0.95 : 0.72;
    if (nl.y > 0.15) blue = flat2(q.xz, R);
    silver = smoothstep(R - 0.022, R - 0.012, r);
  } else if (k == 0) {
    if (outward > 0.2 && q.y > 0.11 && r > 0.45 && r < 0.84) blue = band(q, 4.0, (q.y - 0.12) / 0.86);
    silver = smoothstep(1.006, 1.016, q.y) * step(r, 0.43);
    // The spout's lip.
    silver = max(silver, smoothstep(-0.02, -0.008, dot(vec2(q.x, q.y) - vec2(1.21, 0.915), normalize(vec2(0.55, 0.84)))) * step(1.0, q.x));
  } else if (k == 1) {
    blue = band(q, 3.0, r / 0.43) * step(0.1, r);
    silver = smoothstep(0.405, 0.418, r) + smoothstep(1.34, 1.35, q.y);
  } else if (k == 2) {
    float lip = pow(max(cos(atan(q.z, q.x)), 0.0), 6.0) * smoothstep(0.56, 0.82, q.y);
    float y = q.y - lip * 0.04;
    bool handle = -q.x > 0.42 && abs(q.z) < 0.06;
    if (!handle) {
      if (outward > 0.0 && q.y > 0.07) blue = band(q, 2.0, (y - 0.08) / 0.72);
      else if (q.y > 0.5) blue = band(q, 2.0, 1.0 - (0.80 - y) / 0.72) * step(0.86, 1.0 - (0.80 - y) / 0.72);
      silver = smoothstep(0.782, 0.792, y);
    }
  } else {
    if (outward > 0.0 && q.y > 0.10) blue = band(q, 3.0, (q.y - 0.10) / 0.45);
    else if (q.y > 0.3) blue = band(q, 3.0, 1.0 - (0.55 - q.y) / 0.45) * step(0.86, 1.0 - (0.55 - q.y) / 0.45);
    else if (nl.y > 0.5) blue = bouquet(q.xz, 0.3);
    silver = smoothstep(0.532, 0.542, q.y);
  }

  // Bone china: a warm white, faintly uneven under the glaze.
  vec3 white = hex(0xf0ece2) * (0.97 + 0.03 * noise(p * 40.0));
  // Cobalt under the glaze: deep where the print is heavy, a little blurred.
  vec3 cobalt = mix(hex(0x2a4a9a), hex(0x142a6a), smoothstep(0.4, 1.0, blue));
  vec3 c = mix(white, cobalt, smoothstep(0.0, 0.85, blue) * 0.92);
  Mat m = mat(c, 0.32, 0.0);
  m.sss = 0.3;
  // Platinum, a little worn where lips have been.
  silver = clamp(silver, 0.0, 1.0) * (1.0 - 0.35 * smoothstep(0.55, 0.8, noise(p * 90.0)));
  if (silver > 0.0) {
    m.alb = mix(m.alb, hex(0xc9c9cb), silver);
    m.metal = silver;
    m.rough = mix(m.rough, 0.16, silver);
    m.sss *= 1.0 - silver;
  }
  return m;
}

/* August 11, 1994: the first secure online purchase, a compact disc.
 *
 * An audio CD in its jewel case, the case open on the table: a clear
 * polystyrene tray with a black inner tray and the hub that holds the disc,
 * the lid swung up on its hinge with its booklet showing. The disc has been
 * slid half out and rests on the case's wall and on the table. Its data side
 * is up: a polycarbonate hub ring clear as glass, the aluminium layer beyond
 * it throwing real first-, second- and third-order diffraction (the colour is
 * worked out from the groove direction at each point and the lights, so it
 * moves with the angle), a plain unrecorded band at the rim. The generic
 * printed label (compact-disc.svg) is on the underside; the booklet is the
 * other print. No maker's mark. Units: 1 is 1 cm.
 */
#define BOUND vec3(11.9, 7.6, 6.7)
#define CENTRE vec3(1.5, 7.6, 0.3)
#define VIEW_YAW 0.78
#define VIEW_PITCH 0.50
#define FILL 0.86
#define EXPOSURE 1.3
#define GLASS 1.0
#define GLASS_TINT vec3(0.95, 0.975, 0.965)
#define COAT(id) (id == 4.0 ? 0.35 : id == 5.0 ? 0.9 : 0.0)

const float LID_C = -0.2079, LID_S = 0.9781;   // the lid stands at 102 degrees
const vec3 HINGE = vec3(-7.1, 0.95, 0.0);
const float TA = 0.148;                         // the disc's slope: sin of 8.5 degrees
const float TC = 0.9890;
const vec3 DC = vec3(7.3, 0.98, 0.9);           // the disc's centre

vec3 lidLoc(vec3 p) {
  vec3 q = p - HINGE;
  return vec3(q.x * LID_C + q.y * LID_S, -q.x * LID_S + q.y * LID_C, q.z);
}
/* The disc's own frame: x down the slope, y the face's normal, z across. */
vec3 discLoc(vec3 p) {
  vec3 q = p - DC;
  return vec3(q.x * TC - q.y * TA, q.x * TA + q.y * TC, q.z);
}

float sdDisc(vec3 q) {
  float r = length(q.xz);
  vec2 d = vec2(max(r - 6.0, 0.75 - r), abs(q.y) - 0.06);
  d += 0.02;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - 0.02;
}

vec2 map(vec3 p) {
  // --- the base: clear, hollow, open on top
  float outer = sdRound(p - vec3(0.0, 0.45, 0.0), vec3(7.1, 0.45, 6.2), 0.2);
  float cav = sdRound(p - vec3(0.25, 1.05, 0.0), vec3(6.75, 0.92, 5.9), 0.06);
  float base = smax(outer, -cav, 0.04);
  // two hinge barrels at the spine corners
  base = min(base, sdCapsule(p, vec3(-7.0, 0.75, -5.9), vec3(-7.0, 0.75, -4.3), 0.2));
  base = min(base, sdCapsule(p, vec3(-7.0, 0.75, 4.3), vec3(-7.0, 0.75, 5.9), 0.2));
  // --- the lid
  vec3 l = lidLoc(p);
  float plate = sdRound(l - vec3(7.1, 0.16, 0.0), vec3(7.1, 0.16, 6.2), 0.15);
  float lip = max(sdRound(l - vec3(7.1, -0.28, 0.0), vec3(7.1, 0.3, 6.2), 0.06),
                  -sdBox(l - vec3(7.1, -0.28, 0.0), vec3(6.8, 0.5, 5.9)));
  float lid = smin(plate, lip, 0.04);
  vec2 d = vec2(min(base, lid), 1.0);
  // The thick walls catch the light as milky satin; the floor and the plate stay clear.
  if (base < lid) { if (p.y > 0.2) d.y = 5.0; } else if (l.y < 0.1) d.y = 5.0;
  // --- the booklet, held in the lid
  float book = sdBox(l - vec3(7.55, -0.045, 0.0), vec3(6.0, 0.04, 6.0)) - 0.004;
  d = U(d, vec2(book, 4.0));
  // --- the black tray, and the hub with its teeth
  float tray = sdRound(p - vec3(0.25, 0.24, 0.0), vec3(6.7, 0.11, 5.85), 0.04);
  float ring = abs(length(p.xz) - 6.27) - 0.13;
  tray = min(tray, max(ring, abs(p.y - 0.38) - 0.17));
  float r = length(p.xz);
  tray = smin(tray, sdCyl(p - vec3(0.0, 0.3, 0.0), 1.75, 0.3), 0.06);
  float a = atan(p.z, p.x);
  float hub = sdCyl(p - vec3(0.0, 0.72, 0.0), 0.7 + 0.045 * cos(a * 8.0) - 0.08 * smoothstep(0.88, 0.97, p.y), 0.32) - 0.02;
  tray = min(tray, hub);
  d = U(d, vec2(tray, 2.0));
  // --- the disc
  vec3 q = discLoc(p);
  float dd = sdDisc(q);
  float rd = length(q.xz);
  d = U(d, vec2(dd, rd < 1.62 ? 1.0 : 3.0));
  return d;
}

/* ---- a spectrum, for the diffraction ---- */
float gs(float l, float c, float w) { float x = (l - c) / w; return exp(-0.5 * x * x); }
vec3 wl(float l) {
  vec3 c = vec3(1.05 * gs(l, 600.0, 44.0) + 0.30 * gs(l, 445.0, 26.0), 1.0 * gs(l, 540.0, 40.0), 1.1 * gs(l, 458.0, 30.0));
  return c * smoothstep(380.0, 430.0, l) * smoothstep(740.0, 680.0, l);
}
/* First, second and third order from a grating of 1.6 micron pitch, the
   light and the eye along h in the plane of the grooves' normal. */
vec3 grating(float x) {
  vec3 c = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    float xx = abs(x) + (float(j) - 1.5) * 0.045;
    c += wl(1600.0 * xx) * 1.0 + wl(800.0 * xx) * 0.45 + wl(533.0 * xx) * 0.15;
  }
  return c * 0.25;
}

vec3 iaView() { return vec3(sin(VIEW_YAW) * cos(VIEW_PITCH), sin(VIEW_PITCH), cos(VIEW_YAW) * cos(VIEW_PITCH)); }
vec3 iaCam(vec3 c) {
  vec3 back = iaView(), f = -back;
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0))), u = cross(r, f);
  return normalize(c.x * r + c.y * u + c.z * back);
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 4.0) {
    // The booklet's front page, under the lid's clear plastic.
    vec3 l = lidLoc(p);
    vec2 uv = vec2((6.0 - l.z) / 12.0, (l.x - 1.55) / 12.0);
    uv = clamp(uv, 0.002, 0.998);
    vec3 c = pow(texture(u_tex, vec2(0.5 + 0.5 * uv.x, 0.5 + 0.5 * uv.y)).rgb, vec3(2.2));
    c = mix(c, vec3(0.55), smoothstep(0.78, 0.9, fbm(p * 6.0)) * 0.12);
    return mat(c * 0.82, 0.55, 0.0);
  }
  if (id == 2.0) {
    // Black polystyrene, with a little dust and a thumb's grease on the teeth.
    float dust = smoothstep(0.7, 0.9, fbm(p * 7.0)) * 0.12;
    Mat m = mat(mix(hex(0x0c0d0e), hex(0x303236), dust), 0.38 + 0.2 * noise(p * 14.0), 0.0);
    return m;
  }
  if (id == 5.0) {
    // The walls of the clear plastic: thick enough to show, milky where moulded.
    float m0 = 0.5 + 0.3 * noise(p * 5.0);
    Mat m = mat(vec3(0.24, 0.27, 0.28) * m0, 0.16 + 0.05 * noise(p * 12.0), 0.0);
    m.sss = 0.5;
    return m;
  }
  if (id == 1.0) {
    // The clear hub ring is the only part of id 1 that arrives here, as glass
    // does not use it; harmless defaults.
    return mat(vec3(0.5), 0.1, 0.0);
  }
  // The disc.
  vec3 q = discLoc(p);
  float r = length(q.xz);
  vec3 nd = vec3(TA, TC, 0.0);
  float side = dot(n, nd);
  if (side < -0.2) {
    // The label side: generic print over the lacquer, bare aluminium round it.
    vec2 uv = vec2(0.25 + 0.25 * q.x / 6.0, 0.75 - 0.25 * q.z / 6.0);
    vec3 c = pow(texture(u_tex, uv).rgb, vec3(2.2));
    float bare = smoothstep(0.1, 0.0, abs(c.r - 0.216) + abs(c.g - 0.216) + abs(c.b - 0.216) - 0.02);
    bare = r > 5.95 || r < 1.9 ? 1.0 : bare;
    return mat(mix(c * 0.8, hex(0xa8abad), bare), mix(0.4, 0.26, bare), bare);
  }
  if (side < 0.7) {
    // The rim, a thin band of polycarbonate and aluminium.
    return mat(hex(0xb5b8ba), 0.35, 1.0);
  }
  // The data side. Where the aluminium shows, work the grating.
  vec3 key = iaCam(vec3(-0.62, 0.66, 0.42));
  vec3 rim = iaCam(vec3(0.70, 0.42, -0.58));
  vec3 v = iaView();
  vec2 rv = normalize(q.xz + 1e-5);
  vec3 g = rv.x * vec3(TC, -TA, 0.0) + rv.y * vec3(0.0, 0.0, 1.0);
  vec3 col = grating(dot(key + v, g)) * 1.15 + grating(dot(rim + v, g)) * 0.75 + grating(dot(normalize(vec3(0.5, 0.9, 0.5)) + v, g)) * 0.3;
  float band = smoothstep(2.2, 2.6, r) * smoothstep(5.85, 5.55, r);
  // Smudges and a fine circular brushing from the pressing.
  float smudge = fbm(vec3(q.x * 1.6, q.z * 1.6, 1.0));
  float spin = noise(vec3(r * 90.0, 0.0, 0.0));
  float rough = 0.2 + 0.18 * smoothstep(0.5, 0.85, smudge) + 0.02 * spin;
  vec3 silver = hex(0xb9bcc0);
  Mat m = mat(silver * (0.85 + 0.15 * spin), rough, 1.0);
  m.alb = mix(m.alb, clamp(col * 1.1, 0.0, 1.5) * 0.9 + silver * 0.12, band * 0.9);
  m.emit = col * band * 0.07 * (1.0 - 0.4 * smoothstep(0.5, 0.85, smudge));
  // The stacking ring and the unrecorded edge are plain mirror.
  return m;
}

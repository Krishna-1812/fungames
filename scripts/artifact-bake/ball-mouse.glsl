/* October 27, 1994: the first banner ad.
 *
 * "Have you ever clicked your mouse right HERE?" asked a rectangle on
 * HotWired, and a good many people had a mouse and did. This is that mouse:
 * a two-button ball mouse of the mid-nineties in the beige plastic of the
 * decade, yellowed a shade where hands wore it, tipped on its side so the
 * underside shows: the twist-off ring and the rubber-coated ball behind it,
 * four scuffed PTFE feet, a label, and the cord leaving the front through its
 * strain relief to curl across the table to a PS/2 plug. Unbranded. Units: 1
 * is 1 cm.
 */
#define BOUND vec3(7.9, 1.8, 6.6)
#define CENTRE vec3(-1.85, 1.8, 0.15)
#define VIEW_YAW 0.25
#define VIEW_PITCH 0.5
#define FILL 0.76
#define EXPOSURE 1.05
#define COAT(id) (id == 1.0 ? 0.18 : id == 2.0 ? 0.3 : 0.0)
#define SHEEN(id) (id == 1.0 ? 0.3 : id == 4.0 ? 0.5 : 0.0)

const float PHI = 0.000;          // rolled onto its side
const float THT = 2.500;           // turned on the table
const float LIFT = 0.02;
const float cP = cos(PHI), sP = sin(PHI), cT = cos(THT), sT = sin(THT);
const mat3 RZ = mat3(cP, sP, 0.0, -sP, cP, 0.0, 0.0, 0.0, 1.0);
const mat3 RY = mat3(cT, 0.0, -sT, 0.0, 1.0, 0.0, sT, 0.0, cT);
const mat3 R = RY * RZ;
const vec3 T = vec3(0.0, LIFT, 0.0);
const vec3 BOOT = T + R * vec3(0.0, 1.0, -5.7);     // where the cord leaves the mouse
const vec3 BDIR = R * vec3(0.0, 0.0, -1.0);

/* The cord, as offsets from the boot: out, down to the table, round in a loose
   curl and in to a plug. */
const vec3 CORD[21] = vec3[21](
  vec3(0.00, 0.00, 0.00), vec3(-0.39, -0.10, 0.54), vec3(-0.84, -0.20, 1.12),
  vec3(-1.04, -0.13, 1.31), vec3(-1.24, -0.12, 1.41), vec3(-1.59, -0.46, 1.65),
  vec3(-2.10, -0.82, 1.85), vec3(-2.87, -0.83, 1.93), vec3(-3.74, -0.82, 1.88),
  vec3(-4.67, -0.82, 1.70), vec3(-5.47, -0.82, 1.31), vec3(-5.91, -0.82, 0.53),
  vec3(-6.02, -0.82, -0.36), vec3(-5.70, -0.82, -1.19), vec3(-5.10, -0.82, -1.83),
  vec3(-4.22, -0.82, -2.08), vec3(-3.37, -0.82, -1.98), vec3(-2.89, -0.83, -1.46),
  vec3(-2.68, -0.82, -0.74), vec3(-2.89, -0.65, 0.04), vec3(-3.20, -0.47, 0.67));











const vec3 PEND = BOOT + vec3(-3.20, -0.47, 0.67);
const vec3 PDIR = normalize(vec3(-0.432, 0.0, 0.902));

vec3 loc(vec3 p) { return transpose(R) * (p - T); }

float rbox2(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

float halfW(float z) { return mix(2.62, 3.2, smoothstep(-5.6, 1.5, z)); }

/* The mouse itself, in its own frame: x across, y up from the flat base, z
   rear (+) to front (-). */
float shell(vec3 q) {
  float zc = -0.1, hl = 5.7;
  float hw = halfW(q.z);
  vec2 d = abs(vec2(q.x, q.z - zc)) - vec2(hw - 2.1, hl - 2.1);
  float dxz = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 2.1;
  float tz = 1.95 + 1.55 * smoothstep(-5.6, 0.2, q.z) - 1.15 * smoothstep(1.4, 5.6, q.z);
  float top = tz * (1.0 - 0.2 * (q.x * q.x) / (hw * hw));
  float body = smax(dxz, (q.y - top) * 0.8, 1.1);
  body = smax(body, -q.y, 0.12);
  // The gap between buttons and body, the slot between the two buttons.
  float z0 = -0.7 + 0.18 * (q.x * q.x) / 8.0;
  float cut = max(abs(q.z - z0) - 0.04, (top - 0.55) - q.y);
  cut = min(cut, max(max(abs(q.x) - 0.035, abs(q.z + 3.15) - 2.5), (top - 0.55) - q.y));
  body = smax(body, -cut, 0.01);
  // The underside: a dish for the ball's ring, the hole through it.
  vec3 bq = q - vec3(0.0, 0.0, 0.7);
  body = smax(body, -(max(length(bq.xz) - 1.78, bq.y - 0.28)), 0.03);
  body = smax(body, -(max(length(bq.xz) - 0.9, bq.y - 1.3)), 0.03);
  // the parting line where the top shell meets the base
  body = smax(body, -max(abs(q.y - 0.62) - 0.022, dxz + 0.1), 0.008);
  return body;
}

vec2 map(vec3 p) {
  vec3 q = loc(p);
  vec2 d = vec2(shell(q), 1.0);
  // The ring and the ball.
  vec3 bq = q - vec3(0.0, 0.0, 0.7);
  float rr = length(bq.xz);
  float ring = max(max(rr - 1.74, 0.9 - rr), abs(bq.y - 0.07) - 0.1);
  // two shallow bayonet slots in the ring
  float slot = max(max(abs(abs(bq.x) - 1.38) - 0.17, abs(bq.z) - 0.1), -(bq.y - 0.03));
  ring = smax(ring, -slot, 0.015);
  d = U(d, vec2(ring - 0.01, 1.0));
  float ball = length(q - vec3(0.0, 0.8, 0.7)) - 1.1;
  d = U(d, vec2(ball, 2.0));
  // Four PTFE feet.
  vec2 fa = vec2(abs(q.x) - 2.15, 0.0);
  float fz = q.x > -99.0 ? (q.z > 0.0 ? 4.3 : -4.1) : 0.0;
  float fx = q.z > 0.0 ? 2.3 : 1.85;
  float foot = max(rbox2(vec2(abs(q.x) - fx, q.z - fz), vec2(0.55, 0.9), 0.3), abs(q.y + 0.01) - 0.075);
  d = U(d, vec2(foot, 3.0));
  // The strain relief.
  vec3 bl = q - vec3(0.0, 1.0, -5.55);
  float sr = sdCone(q, vec3(0.0, 1.0, -5.3), vec3(0.0, 1.0, -7.1), 0.62, 0.22);
  d = U(d, vec2(sr, 1.0));

  // The cord, a chain of capsules, only worked out near it.
  float cb = sdBox(p - vec3(BOOT.x - 2.8, 1.7, BOOT.z - 0.3), vec3(3.6, 2.0, 5.4));
  if (cb < 0.5) {
    float c = 1e9;
    for (int i = 0; i < CORD.length() - 1; i++) c = min(c, sdCapsule(p, BOOT + CORD[i], BOOT + CORD[i + 1], 0.2));
    d = U(d, vec2(c, 4.0));
  } else {
    d = U(d, vec2(cb - 0.1, 4.0));
  }
  // The plug on the end: a moulded boot, a nickel shell with its dark insert.
  vec3 pq = p - vec3(PEND.x, 0.0, PEND.z);
  float u = dot(pq.xz, PDIR.xz);
  float across = dot(pq.xz, vec2(-PDIR.z, PDIR.x));
  float pboot = sdRound(vec3(across, p.y - 0.56, u - 0.85), vec3(0.62, 0.55, 0.85), 0.2);
  d = U(d, vec2(pboot, 1.0));
  float shellP = max(length(vec2(across, p.y - 0.56)) - 0.52, max(u - 3.0, 1.6 - u));
  shellP = max(shellP, -max(length(vec2(across, p.y - 0.56)) - 0.4, u - 3.1));
  d = U(d, vec2(shellP, 5.0));
  float ins = max(length(vec2(across, p.y - 0.56)) - 0.4, abs(u - 2.1) - 0.1);
  d = U(d, vec2(ins, 6.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 q = loc(p);
  if (id == 2.0) {
    // The ball: rubber over steel, dull grey-green, a bright worn track.
    float track = smoothstep(0.35, 0.9, fbm(q * 2.5));
    return mat(mix(hex(0x5a5f5b), hex(0x8e938f), track * 0.6), 0.4 - 0.18 * track, 0.0);
  }
  if (id == 4.0) {
    // The cord: grey-beige PVC, a little dusty.
    float rip = noise(p * 5.0);
    return mat(mix(hex(0xb7ae95), hex(0x9f957c), rip * 0.6), 0.5, 0.0);
  }
  if (id == 5.0) return mat(hex(0xb5babe), 0.25, 1.0);
  if (id == 6.0) return mat(hex(0x0f0f10), 0.5, 0.0);
  if (id == 3.0) {
    // PTFE: scuffed off-white.
    float sc = noise(vec3(q.xz * 40.0, 1.0));
    float dirt = smoothstep(0.35, 0.8, fbm(q * 3.0)) ;
    vec3 c = mix(hex(0xe2e0d6), hex(0x9a978c), dirt * 0.35 + 0.15 * sc);
    return mat(c, 0.38 + 0.2 * sc, 0.0);
  }
  // Beige ABS.
  vec3 c = hex(0xc4b790);
  float yel = smoothstep(0.3, 0.8, fbm(q * 0.8 + 2.0));
  c = mix(c, hex(0xb89f66), yel * 0.5);
  // Where thumbs and fingers rest the surface has polished: lighter, glossier.
  float hand = smoothstep(2.4, 0.0, length(vec2(q.x, q.z + 3.0)));
  float rr0 = length(q.xz - vec2(0.0, 0.7));
  float crev = smoothstep(2.15, 1.75, rr0) * step(q.y, 0.5) * 0.35 + smoothstep(0.1, 0.0, abs(q.y - 0.62)) * 0.25;
  float grime = smoothstep(0.55, 0.9, fbm(q * 7.0)) * 0.12 + crev;
  float dust = smoothstep(0.93, 0.98, noise(q * 90.0)) * 0.08;
  float edge = smoothstep(0.7, 0.99, 1.0 - abs(dot(n, R * vec3(0.0, 1.0, 0.0)))) * smoothstep(0.55, 0.8, fbm(q * 5.0)) * 0.25;
  // seam lines and grooves are dirtier
  float slotNear = smoothstep(0.12, 0.0, min(abs(q.x), abs(q.z + 0.7))) * step(-6.0, q.z) * step(0.8, q.y);
  c = mix(c, hex(0x6d6450), grime + slotNear * 0.5);
  c = mix(c, hex(0xe6e0cc), dust + edge);
  float rough = 0.42 + 0.1 * noise(q * 50.0) - 0.2 * hand + 0.15 * grime;
  // The label on the underside: a pale rectangle with two dark bars.
  if (q.y < 0.05) {
    float lab = step(abs(q.x), 1.7) * step(abs(q.z - 3.8), 0.9);
    float lines = step(0.5, fract(q.z * 4.0)) * step(abs(q.z - 3.8), 0.7) * step(abs(q.x), 1.4);
    c = mix(c, mix(hex(0xe5e2d6), hex(0x403f3b), lines * 0.8), lab);
    rough = mix(rough, 0.6, lab);
    // The twist ring is a slightly darker moulding.
    float rr = length(q.xz - vec2(0.0, 0.7));
    c = mix(c, c * 0.8, smoothstep(1.8, 1.7, rr));
  }
  return mat(c, clamp(rough, 0.18, 0.8), 0.0);
}

/* 1998: the Hampster Dance.
 *
 * A GeoCities page of looping dancing hamsters, passed round by e-mail until
 * it had millions of visits, and every one of them came down a phone line.
 * This is what was on the other end: an external 56K data/fax modem in a dark
 * grey case, a slot of vents on top, a row of eight indicator lamps lit above
 * their two-letter labels (HS AA CD OH RD SD TR MR; AA is off, as it usually
 * was), and a grey phone cord that leaves the back and curls round the left
 * to a clear RJ11 plug lying on the desk. The front plate and its lettering
 * are modem.svg (20.4 x 3.2 cm; uv 0,0 bottom left). The lamps glow, and the
 * plastic round them glows a little. Unbranded. Units: 1 is 1 cm.
 */
#define BOUND vec3(12.8, 2.3, 9.7)
#define CENTRE vec3(1.35, 2.3, -1.3)
#define VIEW_YAW 0.46
#define VIEW_PITCH 0.38
#define FILL 0.8
#define EXPOSURE 1.1
#define COAT(id) (id == 1.0 ? 0.12 : id == 2.0 ? 0.1 : id == 5.0 ? 0.8 : 0.0)
#define SHEEN(id) (id == 1.0 ? 0.55 : id == 2.0 ? 0.4 : id == 4.0 ? 0.12 : 0.0)

const float BY = 2.35;          // the case's mid-height
const float HX = 11.0, HY = 2.1, HZ = 7.5;
const vec2 PLATE = vec2(10.2, 1.3);
const float PY = 2.75;
const float LED_Y = 3.2;
const float LED_X0 = -3.7, LED_DX = 1.75;

const vec3 CAB[28] = vec3[28](
  vec3(6.00, 1.70, -7.00), vec3(5.99, 1.73, -7.31), vec3(5.98, 1.76, -7.76),
  vec3(6.00, 1.70, -8.20), vec3(6.03, 1.49, -8.61), vec3(6.10, 1.19, -9.02),
  vec3(6.30, 0.90, -9.40), vec3(6.66, 0.63, -9.78), vec3(7.16, 0.38, -10.13),
  vec3(7.80, 0.20, -10.30), vec3(8.66, 0.15, -10.26), vec3(9.66, 0.17, -10.05),
  vec3(10.60, 0.20, -9.60), vec3(11.44, 0.20, -8.86), vec3(12.22, 0.20, -7.89),
  vec3(12.80, 0.20, -6.80), vec3(13.09, 0.20, -5.59), vec3(13.19, 0.20, -4.26),
  vec3(13.20, 0.20, -3.00), vec3(13.15, 0.20, -1.87), vec3(13.02, 0.20, -0.81),
  vec3(12.90, 0.20, 0.20), vec3(12.82, 0.20, 1.19), vec3(12.76, 0.20, 2.14),
  vec3(12.70, 0.20, 3.00), vec3(12.66, 0.20, 3.80), vec3(12.62, 0.20, 4.51),
  vec3(12.60, 0.20, 5.00));
const vec3 PE = vec3(12.6, 0.2, 5.0);     // the cord's end
const vec2 PD = vec2(-0.04, 0.999);         // the plug lies this way

float rbox2(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

vec2 map(vec3 p) {
  // The case.
  float body = sdRound(p - vec3(0.0, BY, 0.0), vec3(HX, HY, HZ), 0.4);
  // the parting line between the two halves
  float outline = body + 0.1;
  body = smax(body, -max(abs(p.y - 1.05) - 0.028, outline * -1.0 - 0.0 - 0.0), 0.006) ;
  // vents: a bank of slots in the top
  float vx = abs(mod(p.x + 9.6, 0.74) - 0.37) - 0.13;
  float vz = abs(p.z + 0.8) - 3.9;
  float vent = max(max(vx, vz), (BY + HY - 0.35) - p.y);
  vent = max(vent, abs(p.x + 5.2) - 4.5);
  body = smax(body, -vent, 0.02);
  // the front plate's shallow recess
  float rec = max(rbox2(p.xy - vec2(0.0, PY), PLATE, 0.3), (HZ - 0.05) - p.z);
  body = smax(body, -rec, 0.01);
  vec2 d = vec2(body, 1.0);
  // the plate itself, with a round window for each lamp
  float plate = max(rbox2(p.xy - vec2(0.0, PY), PLATE - 0.02, 0.28), abs(p.z - (HZ - 0.035)) - 0.02);
  float li = clamp(floor((p.x - LED_X0) / LED_DX + 0.5), 0.0, 7.0);
  vec2 lc = vec2(LED_X0 + li * LED_DX, LED_Y);
  plate = max(plate, -(length(p.xy - lc) - 0.36));
  d = U(d, vec2(plate, 2.0));
  // the lamps: little domes of lens
  float lamp = length(p - vec3(lc, HZ - 0.13)) - 0.3;
  d = U(d, vec2(lamp, 3.0));
  // feet
  vec3 fq = vec3(abs(p.x) - 9.2, p.y - 0.12, abs(p.z) - 5.7);
  float foot = sdCyl(fq, 0.8, 0.13) - 0.03;
  d = U(d, vec2(foot, 6.0));

  // The phone cord, near it only.
  float cb = sdBox(p - vec3(9.6, 1.1, -2.6), vec3(4.0, 1.6, 8.6));
  if (cb < 0.4) {
    float c = 1e9;
    for (int i = 0; i < 27; i++) c = min(c, sdCapsule(p, CAB[i], CAB[i + 1], 0.17));
    d = U(d, vec2(c, 4.0));
  } else {
    d = U(d, vec2(cb - 0.1, 4.0));
  }
  // The RJ11 plug: a clear body with its latch, a boot over the cord.
  vec2 q2 = p.xz - PE.xz;
  float u = dot(q2, PD);
  float w = dot(q2, vec2(-PD.y, PD.x));
  float plug = sdRound(vec3(w, p.y - 0.4, u - 1.3), vec3(0.5, 0.36, 0.95), 0.1);
  float latch = sdRound(vec3(w, p.y - 0.78 + 0.05 * (u - 1.0), u - 1.65), vec3(0.34, 0.06, 0.55), 0.04);
  float boot = sdCone(p, PE + vec3(0.0, 0.0, 0.0), PE + vec3(PD.x * 0.7, 0.18, PD.y * 0.7), 0.2, 0.48);
  d = U(d, vec2(min(plug, latch), 5.0));
  d = U(d, vec2(boot, 5.0));
  return d;
}

/* Which lamp, how bright, what colour. */
vec3 lampColour(float i) {
  vec3 red = vec3(1.0, 0.16, 0.08), amb = vec3(1.0, 0.5, 0.08), grn = vec3(0.2, 1.0, 0.25);
  float b = 1.0;
  vec3 c = red;
  if (i < 0.5) { c = red; b = 1.0; }
  else if (i < 1.5) { c = red; b = 0.05; }
  else if (i < 2.5) { c = red; b = 1.0; }
  else if (i < 3.5) { c = red; b = 1.0; }
  else if (i < 4.5) { c = amb; b = 0.7; }
  else if (i < 5.5) { c = amb; b = 1.0; }
  else if (i < 6.5) { c = grn; b = 1.0; }
  else { c = grn; b = 1.0; }
  return c * b;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Dark grey ABS, a grain in it, wearing lighter at corners, a little grime.
    vec3 c = hex(0x38393c);
    float top = smoothstep(0.7, 0.95, n.y);
    float edge = smoothstep(0.35, 0.8, fbm(p * 5.0)) * smoothstep(0.995, 0.85, max(max(abs(n.x), abs(n.y)), abs(n.z)));
    c = mix(c, hex(0x77797c), edge * 0.35);
    float dust = smoothstep(0.9, 0.97, noise(p * 80.0)) * 0.1 * (0.4 + 0.6 * top);
    float fp = smoothstep(0.6, 0.9, fbm(p * 1.9 + 4.0)) * 0.03 * top;
    c = mix(c, hex(0x8a8c8f), dust + fp);
    float seam = smoothstep(0.04, 0.0, abs(p.y - 1.05)) * (1.0 - top);
    c *= 1.0 - 0.4 * seam;
    float rough = 0.45 + 0.12 * noise(p * 40.0) + 0.15 * fp * 8.0;
    return mat(c, clamp(rough, 0.2, 0.8), 0.0);
  }
  if (id == 2.0) {
    // The front plate: printed, matt.
    vec2 uv = vec2((p.x + PLATE.x) / (2.0 * PLATE.x), (p.y - (PY - PLATE.y)) / (2.0 * PLATE.y));
    vec3 c = pow(texture(u_tex, uv).rgb, vec3(2.2));
    float li = clamp(floor((p.x - LED_X0) / LED_DX + 0.5), 0.0, 7.0);
    vec2 lc = vec2(LED_X0 + li * LED_DX, LED_Y);
    float dd = length(p.xy - lc);
    vec3 lamp = lampColour(li);
    float halo = exp(-dd * dd / 0.18) * 0.22;
    Mat m = mat(c * 0.85, 0.5, 0.0);
    m.emit = lamp * halo * smoothstep(0.34, 0.5, dd);
    float dust = smoothstep(0.9, 0.97, noise(p * 70.0)) * 0.1;
    m.alb = mix(m.alb, vec3(0.4), dust);
    return m;
  }
  if (id == 3.0) {
    // A lamp: translucent lens, lit from inside.
    float li = clamp(floor((p.x - LED_X0) / LED_DX + 0.5), 0.0, 7.0);
    vec3 lamp = lampColour(li);
    float centre = smoothstep(0.3, 0.0, length(p.xy - vec2(LED_X0 + li * LED_DX, LED_Y)));
    Mat m = mat(mix(lamp * 0.15 + 0.01, vec3(0.02), 0.5), 0.12, 0.0);
    m.emit = lamp * (0.9 + 2.0 * centre);
    return m;
  }
  if (id == 4.0) {
    // Phone cord: pale grey PVC, a little dusty.
    float rip = noise(p * 4.0);
    return mat(mix(hex(0x9a978d), hex(0x838076), rip * 0.5), 0.5, 0.0);
  }
  if (id == 5.0) {
    // The plug: clear polycarbonate, gold contacts on the tip, a cloudy boot.
    vec2 q2 = p.xz - PE.xz;
    float u = dot(q2, PD);
    float w = dot(q2, vec2(-PD.y, PD.x));
    float gold = smoothstep(0.06, 0.03, abs(fract(w * 5.0 + 0.5) - 0.5) * 0.2) * step(1.45, u) * step(abs(w), 0.3) * smoothstep(0.55, 0.65, n.y);
    vec3 c = mix(hex(0xd8dcdc), hex(0xd7a64a), gold);
    Mat m = mat(c, mix(0.15, 0.3, gold), gold);
    return m;
  }
  // Rubber feet.
  return mat(hex(0x101011), 0.8, 0.0);
}

/* January 15, 2001: the first Wikipedia edit.
 *
 * A thick fourteen-inch laptop of the year 2001, open: a charcoal
 * soft-touch case and a lid tilted back past the vertical, a wide bezel round
 * an XGA liquid-crystal screen, hinges at the back, a keyboard of dished keys
 * with a small nub of a pointing stick among them, a touchpad and two buttons
 * on the palm rest, three lamps under the screen. The screen shows a wiki
 * page called HomePage with the first edit on it (laptop.svg). Unbranded.
 * Units: 1 is 1 cm.
 */
#define BOUND vec3(16.2, 14.0, 16.0)
#define CENTRE vec3(0.0, 14.0, -4.0)
#define VIEW_YAW 0.5
#define VIEW_PITCH 0.3
#define FILL 0.82
#define COAT(id) (id == 6.0 ? 0.5 : 0.0)
#define SHEEN(id) (id == 1.0 ? 0.2 : 0.0)
#define EXPOSURE 1.25

const vec3 HINGE = vec3(0.0, 2.7, -11.2);
const float TILT = 0.262;      // the lid, 15 degrees past the vertical
const float SY0 = 2.6;         // the bottom bezel's height
const vec2 SH = vec2(13.9, 10.42);

float rr2(vec2 q, vec2 b, float r) { vec2 d = abs(q) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

/* The lid's own frame: x right, y up the lid, z out of the screen. */
vec3 lidPos(vec3 p) {
  vec3 q = p - HINGE;
  vec3 u = vec3(0.0, cos(TILT), -sin(TILT));
  vec3 nn = vec3(0.0, sin(TILT), cos(TILT));
  return vec3(q.x, dot(q, u), dot(q, nn));
}

vec2 map(vec3 p) {
  // The base: a thick slab, the deck's edge softened, the front edge shaved.
  float base = sdRound(p - vec3(0.0, 1.5, 0.0), vec3(15.5, 1.5, 12.0), 0.6);
  // The keyboard's well, the palm rest's touchpad well, the hinge strip.
  float well = sdBox(p - vec3(0.0, 3.0, -3.7), vec3(13.6, 0.35, 5.9)) - 0.1;
  base = smax(base, -well, 0.1);
  float pad = rr2(p.xz - vec2(0.0, 6.2), vec2(3.7, 2.6), 0.4);
  base = smax(base, -max(pad, abs(p.y - 3.0) - 0.08), 0.05);
  // Two long buttons under the pad.
  float bz = rr2(vec2(abs(p.x) - 2.0, p.z - 9.9), vec2(1.6, 0.7), 0.3);
  base = smax(base, -max(bz, abs(p.y - 3.0) - 0.15), 0.05);
  // Speaker slots left and right of the keys at the top deck.
  float sx = clamp(floor(abs(p.x) / 0.7 + 0.5) * 0.7, 0.0, 2.1);
  float spk = sdBox(vec3(abs(p.x) - 11.5 - sx * 0.0, p.y - 3.0, p.z + 10.4), vec3(1.4, 0.2, 0.25));
  base = smax(base, -spk, 0.03);
  vec2 d = vec2(base, 1.0);

  // The lid.
  vec3 l = lidPos(p);
  float lid = sdRound(vec3(l.x, l.y - 12.6, l.z + 1.0), vec3(15.5, 12.6, 1.0), 0.45);
  // The bezel's recess, and a latch notch at the top.
  float rec = max(rr2(vec2(l.x, l.y - SY0 - SH.y), SH + 0.35, 0.5), -0.55 - l.z);
  lid = smax(lid, -rec, 0.12);
  d = U(d, vec2(lid, 1.0));
  float panel = max(rr2(vec2(l.x, l.y - SY0 - SH.y), SH, 0.4), abs(l.z + 0.5) - 0.04);
  d = U(d, vec2(panel, 6.0));
  // Hinges: two barrels across the back.
  vec3 q = p - HINGE;
  float bar = sdCyl(vec3(q.y, abs(q.x) - 11.0, q.z), 1.25, 1.9) - 0.2;
  d = U(d, vec2(bar, 3.0));

  // Keys: five rows by fourteen, and a short row of function keys, each a
  // dished block with a small gap.
  vec2 kc = vec2(clamp(floor(p.x / 1.85 + 0.5), -6.0, 6.0), clamp(floor((p.z + 6.5) / 1.85 + 0.5), 0.0, 4.0));
  vec3 kp = vec3(p.x - kc.x * 1.85, p.y - 3.5, p.z - (kc.y * 1.85 - 6.5));
  float key = sdRound(kp, vec3(0.78, 0.38, 0.78), 0.22);
  // the dish in the top of the key
  key = smax(key, -(length(kp - vec3(0.0, 2.8, 0.0)) - 2.6), 0.1);
  // a wide space bar in place of the middle keys of the last row
  float space = sdRound(vec3(p.x, p.y - 3.5, p.z - 0.9 - 0.0) , vec3(5.4, 0.38, 0.78), 0.22);
  space = smax(space, -(length(vec3(p.x * 0.35, p.y - 6.3, p.z - 0.9)) - 2.8), 0.1);
  float lastRow = step(3.5, kc.y);
  float spaceZone = step(abs(p.x), 6.3);
  float keys = mix(key, max(key, 0.0) + 0.0, 0.0);
  keys = lastRow > 0.5 ? (spaceZone > 0.5 ? space : key) : key;
  // the row of function keys
  float fz = p.z + 9.0;
  vec3 fp = vec3(p.x - clamp(floor(p.x / 1.85 + 0.5), -6.0, 6.0) * 1.85, p.y - 3.4, fz);
  float fkey = sdRound(fp, vec3(0.78, 0.28, 0.45), 0.18);
  d = U(d, vec2(min(keys, fkey), 2.0));
  // The pointing stick, between G, H and B, and the pad's keys.
  float nub = sdCyl(p - vec3(0.0, 3.95, -2.3), 0.22, 0.55) - 0.05;
  d = U(d, vec2(nub, 4.0));
  // Three lamps in the bezel under the screen.
  vec3 lp = vec3(abs(l.x) - 0.0, l.y - 1.3, l.z);
  float lamp = sdBox(vec3(l.x - clamp(floor(l.x / 1.6 + 0.5), 4.0, 6.0) * 1.6, l.y - 1.3, l.z), vec3(0.3, 0.12, 0.1)) - 0.04;
  d = U(d, vec2(lamp, 5.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Charcoal plastic with a soft rubbery coat: near black, a little sandy
    // grain, brighter and smoother where palms have rested on the deck.
    float grain = noise(p * 60.0) * 0.5 + noise(p * 150.0) * 0.5;
    vec3 c = vec3(0.018, 0.019, 0.022) * (0.8 + 0.4 * grain);
    float rest = smoothstep(2.0, 6.0, p.z) * (1.0 - smoothstep(0.6, 1.0, abs(p.x) / 11.0)) * step(0.9, n.y);
    c = mix(c, vec3(0.035, 0.036, 0.04), rest * 0.7 * (0.6 + 0.4 * noise(p * 3.0)));
    float dirt = smoothstep(0.6, 0.9, fbm(p * 2.0)) * 0.012;
    c += dirt;
    // The bezel of the lid inside the recess: black.
    vec3 l = lidPos(p);
    float inRec = step(rr2(vec2(l.x, l.y - SY0 - SH.y), SH + 0.6, 0.6), 0.0) * step(l.z, -0.2) * step(0.1, l.z + 1.0);
    return mat(c, mix(0.46, 0.34, rest) + 0.08 * grain, 0.0);
  }
  if (id == 2.0) {
    // Keys: a slightly lighter grey, the legends a pale blur of marks.
    vec2 kc = vec2(floor(p.x / 1.85 + 0.5), floor((p.z + 6.5) / 1.85 + 0.5));
    vec2 f = vec2(p.x - kc.x * 1.85, p.z - (kc.y * 1.85 - 6.5));
    float leg = smoothstep(0.34, 0.22, length(f - vec2(0.0, -0.05)) + 0.2 * noise(vec2(kc) * 7.0 + f * 5.0)) * step(0.9, n.y);
    vec3 c = vec3(0.03, 0.031, 0.034) * (0.85 + 0.3 * noise(p * 55.0));
    c = mix(c, vec3(0.3, 0.31, 0.33), leg * 0.55 * (0.5 + noise(vec2(kc) * 3.1)));
    // Shine on the most-used keys.
    float use = smoothstep(0.55, 0.9, noise(vec2(kc) * 1.3));
    return mat(c, mix(0.55, 0.32, use * 0.6), 0.0);
  }
  if (id == 3.0) return mat(vec3(0.07, 0.07, 0.075), 0.35, 0.6);
  if (id == 4.0) return mat(vec3(0.10, 0.03, 0.035), 0.7, 0.0);
  if (id == 5.0) {
    Mat m = mat(vec3(0.02), 0.3, 0.0);
    float which = floor(p.x / 1.6 + 0.5);
    m.emit = (which == 4.0 ? vec3(0.1, 0.9, 0.2) : which == 5.0 ? vec3(1.0, 0.45, 0.05) : vec3(0.02)) * 1.1;
    return m;
  }
  // The LCD: the page, with the faint grid of its pixels and a glow that is
  // brighter at the middle than the corners.
  vec3 l = lidPos(p);
  vec2 uv = vec2((l.x + SH.x) / (2.0 * SH.x), (l.y - SY0) / (2.0 * SH.y));
  vec3 c = pow(texture(u_tex, uv).rgb, vec3(2.2));
  float px = 0.5 + 0.5 * cos(l.x * 223.0) * 0.5;
  float gridl = 0.95 + 0.05 * cos(l.x * 224.0) * cos(l.y * 224.0);
  vec2 e = abs(uv - 0.5) * 2.0;
  float vig = 1.0 - 0.14 * dot(e, e);
  Mat m = mat(vec3(0.02), 0.45, 0.0);
  m.emit = c * gridl * vig * 0.95;
  return m;
}

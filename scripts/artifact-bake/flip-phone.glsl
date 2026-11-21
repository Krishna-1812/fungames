/* March 21, 2006: the first tweet.
 *
 * The phone it was typed on, or one like it: a silver clamshell, opened
 * nearly flat and resting on its keypad half with the screen half tilted up
 * towards you on its hinge. A small colour screen with a text message on it
 * (flip-phone.svg, left half), under black glass; a silver keypad deck with
 * soft keys, a four-way ring with a centre key, call and end keys and twelve
 * black keys whose digits glow blue-white from behind (flip-phone.svg, right
 * half). Brushed anodised silver, a little rubbed. Unbranded. Units: 1 is
 * 1 cm.
 */
#define BOUND vec3(3.1, 2.5, 7.9)
#define CENTRE vec3(0.0, 2.5, -0.5)
#define VIEW_YAW 0.78
#define VIEW_PITCH 0.5
#define FILL 0.92
#define COAT(id) (id == 6.0 ? 1.0 : id == 2.0 ? 0.5 : 0.0)
#define EXPOSURE 1.15

const vec3 HINGE = vec3(0.0, 0.95, 0.0);
const float ALPHA = 0.38;    // the screen half, raised 22 degrees off the table

float rr2(vec2 q, vec2 b, float r) { vec2 d = abs(q) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

/* The upper half's frame: x right, s along it from the hinge, n out of the screen. */
vec3 upPos(vec3 p) {
  vec3 q = p - HINGE;
  vec3 d = vec3(0.0, sin(ALPHA), -cos(ALPHA));
  vec3 nn = vec3(0.0, cos(ALPHA), sin(ALPHA));
  return vec3(q.x, dot(q, d), dot(q, nn));
}

/* The four-way ring's and keys' layout on the deck. */
const vec2 DPAD = vec2(0.0, 2.1);

vec2 map(vec3 p) {
  // The keypad half.
  float low = sdRound(p - vec3(0.0, 0.72, 3.75), vec3(2.45, 0.72, 3.65), 0.55);
  // A shallow dished field in the deck where the keys sit.
  vec2 deck = vec2(0.0, 3.95);
  low = smax(low, -max(rr2(p.xz - vec2(0.0, 3.9), vec2(2.1, 3.15), 0.5), abs(p.y - 1.44) - 0.06), 0.04);
  vec2 d = vec2(low, 1.0);
  // The numeric keys: three by four, each a dished black cap.
  vec2 kc = vec2(clamp(floor(p.x / 1.45 + 0.5), -1.0, 1.0), clamp(floor((p.z - 3.95) / 0.95 + 0.5), 0.0, 3.0));
  vec3 kp = vec3(p.x - kc.x * 1.45, p.y - 1.55, p.z - (3.95 + kc.y * 0.95));
  float key = sdRound(kp, vec3(0.6, 0.13, 0.36), 0.13);
  // Soft keys and call/end keys, beside the ring.
  vec3 sp = vec3(abs(p.x) - 1.5, p.y - 1.55, p.z - 0.75);
  float soft = sdRound(sp, vec3(0.48, 0.1, 0.22), 0.1);
  vec3 cp = vec3(abs(p.x) - 1.75, p.y - 1.55, p.z - 2.6);
  float call = sdRound(cp, vec3(0.48, 0.1, 0.3), 0.1);
  key = min(key, min(soft, call));
  d = U(d, vec2(key, 2.0));
  // The ring and its centre key.
  float ring = max(abs(length(p.xz - DPAD) - 0.78) - 0.28, abs(p.y - 1.57) - 0.1) - 0.06;
  float mid = sdCyl(p - vec3(DPAD.x, 1.57, DPAD.y), 0.4, 0.1) - 0.06;
  d = U(d, vec2(ring, 3.0));
  d = U(d, vec2(mid, 2.0));

  // The screen half.
  vec3 u = upPos(p);
  float up = sdRound(vec3(u.x, u.z - 0.04, u.y - 3.9), vec3(2.45, 0.62, 3.65), 0.5);
  // The black glass over the inside face, set flush, and the opening for the screen.
  float face = max(rr2(vec2(u.x, u.y - 3.9), vec2(2.2, 3.3), 0.4), abs(u.z - 0.64) - 0.05);
  up = smax(up, -max(rr2(vec2(u.x, u.y - 3.9), vec2(2.2, 3.3), 0.45), u.z - 0.5), 0.02);
  d = U(d, vec2(up, 1.0));
  d = U(d, vec2(face, 6.0));
  // The hinge: a barrel across the back of the join, and the antenna stub.
  vec3 q = p - HINGE;
  float bar = sdCyl(vec3(q.y, q.x, q.z), 0.62, 1.7) - 0.05;
  bar = max(bar, abs(q.x) - 2.0);
  d = U(d, vec2(bar, 4.0));
  return d;
}

/* Uv into the atlas of the keypad legends for a point on the deck. */
vec2 deckUv(vec3 p) { return vec2((520.0 + (p.x + 2.45) * 100.0) / 1024.0, 1.0 - p.z * 100.0 / 1024.0); }

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0 || id == 4.0) {
    // Brushed, anodised silver: a cool grey with a fine grain along the
    // length, rubbed brighter at the corners and darker with grime in the seams.
    float brush = noise(vec3(p.x * 90.0, p.y * 4.0, p.z * 3.0));
    vec3 c = mix(hex(0x8d9298), hex(0xb4b8bd), brush * 0.7 + 0.3 * noise(p * 5.0));
    float rub = smoothstep(0.55, 0.9, fbm(p * 3.0)) * 0.25;
    c = mix(c, hex(0x5d6064), rub);
    // A scuff on the edge and a few hairline scratches.
    float scr = smoothstep(0.97, 1.0, noise(p * 40.0 + 2.0)) * 0.4;
    c += scr * 0.2;
    return mat(c, 0.3 + 0.08 * brush + 0.2 * rub, 0.6);
  }
  if (id == 3.0) {
    // The ring: polished silver.
    float brush = noise(vec3(p.x * 60.0, p.y * 3.0, p.z * 60.0));
    return mat(mix(hex(0xb8bcc1), hex(0xdadde0), brush), 0.32, 0.55);
  }
  if (id == 2.0) {
    // Black keys, their digits backlit through the legend picture.
    vec3 lg = pow(texture(u_tex, deckUv(p)).rgb, vec3(2.2));
    float top = step(0.7, n.y);
    Mat m = mat(vec3(0.014, 0.015, 0.018) * (0.8 + 0.4 * noise(p * 70.0)), 0.34, 0.0);
    m.emit = lg * vec3(0.8, 0.95, 1.2) * 1.3 * top;
    return m;
  }
  // The screen: the text message, with a faint pixel grid and a veil of
  // reflection from the room, under black glass with a few fingerprints.
  vec3 u = upPos(p);
  vec2 sp = vec2((u.x + 1.7) / 3.4, (6.4 - u.y) / 4.5);
  float inScr = step(abs(u.x), 1.7) * step(1.9, u.y) * step(u.y, 6.4);
  Mat m = mat(vec3(0.01, 0.011, 0.014), 0.2, 0.0);
  if (inScr > 0.5) {
    vec3 c = pow(texture(u_tex, vec2(sp.x * 480.0 / 1024.0, 1.0 - sp.y * 640.0 / 1024.0)).rgb, vec3(2.2));
    float gr = 0.93 + 0.07 * cos(u.x * 142.0 * 3.1416 * 2.0 * 0.5) * cos(u.y * 142.0 * 3.1416 * 2.0 * 0.5);
    m.emit = c * gr * 0.9;
  }
  // The speaker slot above the screen.
  float spk = smoothstep(0.1, 0.05, abs(u.x) - 0.5) * smoothstep(0.08, 0.04, abs(u.y - 6.95));
  m.emit += vec3(0.02) * spk;
  // Fingerprint smudges on the glass.
  m.rough = mix(0.2, 0.42, smoothstep(0.6, 0.85, fbm(p * 4.0)));
  return m;
}

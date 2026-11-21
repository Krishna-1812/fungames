/* March 15, 1985: the first .com domain, symbolics.com.
 *
 * The directory before the directory: a rotary desk card file, the wheel of
 * index cards you flicked round to find a name. Generic and unmarked: a low
 * smoked-plastic tray, two arched chrome end plates, a knob on each side that
 * turns the wheel, a hundred and twenty cards hung on a hub, a few of them
 * with tabs. The wheel is open at the top where one card leans towards you;
 * it is typed (rotary-file.svg) with the registration. Cards are cream stock
 * 10.2 x 5.7 cm, a little toned at the edges. Units: 1 is 1 cm.
 */
#define BOUND vec3(14.6, 9.9, 10.2)
#define CENTRE vec3(0.0, 9.9, 0.0)
#define VIEW_YAW 0.46
#define VIEW_PITCH 0.30
#define FILL 0.8
#define EXPOSURE 1.1
#define COAT(id) (id == 1.0 ? 0.6 : 0.0)

const float YC = 9.4;        // the hub's height
const float RIN = 3.5;       // where the cards start
const float CH = 5.7;        // card height (radial)
const float CW = 5.1;        // card half-width along the axis
const float DA = 0.0419;     // angle between cards, 2.4 degrees
const float A0 = 0.96;       // first card, 55 degrees round from the top
const int NC = 122;          // cards, the last of them the one we read
const float AREAD = A0 + 121.0 * DA;  // the read card, about 14 degrees back from the top

float cardDist(vec3 p, float a, float tab) {
  float s = (p.y - YC) * cos(a) + p.z * sin(a);
  float t = -(p.y - YC) * sin(a) + p.z * cos(a);
  float body = max(max(abs(p.x) - CW, abs(s - RIN - CH * 0.5) - CH * 0.5), abs(t) - 0.022);
  if (tab > 0.5) {
    float tb = max(max(abs(p.x - (tab - 2.0) * 2.4) - 1.3, abs(s - RIN - CH - 0.35) - 0.5), abs(t) - 0.022);
    body = min(body, tb);
  }
  return body;
}

float cardIndex(vec3 p) {
  float ang = atan(p.z, p.y - YC);
  float u = mod(ang - A0 + DA * 0.5, TAU);
  return clamp(floor(u / DA), 0.0, float(NC - 1));
}
float tabOf(float fi) { return (mod(fi, 11.0) < 0.5 && fi < float(NC) - 3.0) ? 1.0 + mod(fi / 11.0, 3.0) : 0.0; }

vec2 map(vec3 p) {
  vec3 q = p - vec3(0.0, YC, 0.0);
  float rr = length(q.yz);
  vec2 res;
  if (rr > RIN - 0.3 && rr < RIN + CH + 1.0) {
    // The cards: the one whose angle is nearest, and the two beside it.
    float fi = cardIndex(p);
    float best = 1e3, bi = fi;
    for (int k = -1; k <= 1; k++) {
      float i = fi + float(k);
      if (i < 0.0 || i > float(NC - 1)) continue;
      float dd = cardDist(p, A0 + i * DA, tabOf(i));
      if (dd < best) { best = dd; bi = i; }
    }
    res = vec2(best * 0.9, bi > float(NC) - 1.5 ? 6.0 : 5.0);
  } else {
    res = vec2(max(RIN - 0.3 - rr, rr - RIN - CH - 1.0) * 0.9 + 0.05, 5.0);
  }
  // The hub: a drum with a rim at each end, and the axle through it.
  vec3 ax = vec3(q.y, q.x, q.z);
  float drum = sdCyl(ax, RIN - 0.1, 5.4) - 0.05;
  float rim = sdCyl(vec3(q.y, abs(q.x) - 5.4, q.z), RIN + 0.15, 0.18);
  float axle = sdCyl(ax, 0.45, 12.4);
  res = U(res, vec2(min(min(drum, rim), axle), 3.0));
  // End plates: chrome, a D-shape rising from the tray.
  float plate = max(abs(abs(p.x) - 11.1) - 0.42, length(vec2(p.z, max(p.y - YC, 0.0))) - 6.4);
  plate = max(plate, 0.6 - p.y) - 0.05;
  res = U(res, vec2(plate * 0.9, 2.0));
  // Knobs: a stem through the plate and a fluted chrome knob outside.
  vec3 k = vec3(p.z, abs(p.x) - 13.1, p.y - YC);
  float flute = 0.05 * sin(atan(k.z, k.x) * 14.0) * smoothstep(0.9, 1.7, length(k.xz));
  float knob = max(length(k.xz) - 1.95 - flute, abs(k.y) - 0.85) - 0.12;
  float stem = sdCyl(vec3(k.x, k.y + 0.6, k.z), 0.4, 1.0);
  res = U(res, vec2(min(knob, stem) * 0.9, 2.0));
  // The tray: smoked plastic, with a slot for the wheel.
  float tray = sdRound(p - vec3(0.0, 1.4, 0.0), vec3(12.3, 1.4, 6.4), 0.5);
  tray = smax(tray, -sdBox(p - vec3(0.0, 3.3, 0.0), vec3(10.2, 1.6, 4.6)), 0.2);
  res = U(res, vec2(tray, 1.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Smoked plastic, nearly black, a hint of brown in the light.
    float wear = smoothstep(0.6, 0.85, fbm(p * 6.0)) * 0.06;
    return mat(mix(hex(0x1a1816), hex(0x3a3532), wear), 0.28 + 0.15 * noise(p * 30.0), 0.0);
  }
  if (id == 2.0) {
    float brush = noise(vec3(p.x * 60.0, p.y * 3.0, p.z * 3.0));
    return mat(mix(hex(0xa9aeb4), hex(0xc4c8cc), brush * 0.5), 0.26 + 0.12 * brush, 0.55);
  }
  if (id == 3.0) {
    return mat(hex(0x23252a), 0.4, 0.0);
  }
  // Cards. One in a few is toned, tabs coloured.
  float cid = cardIndex(p);
  float tone = hash11(cid * 1.7);
  vec3 c = mix(hex(0xd9d2b8), hex(0xcdc4a6), tone);
  if (id == 6.0) {
    // The typed card: its face is the picture, lit where it leans to us.
    float s = (p.y - YC) * cos(AREAD) + p.z * sin(AREAD);
    float t = -(p.y - YC) * sin(AREAD) + p.z * cos(AREAD);
    vec2 uv = vec2(p.x / (2.0 * CW) + 0.5, (s - RIN) / CH);
    if (t > 0.0 && uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) c = pow(texture(u_tex, uv).rgb, vec3(2.2));
    return mat(c * 0.9, 0.72, 0.0);
  }
  float tabbed = tabOf(cid) > 0.5 ? 1.0 : 0.0;
  float rr = length(vec2(p.y - YC, p.z));
  if (tabbed > 0.5 && rr > RIN + CH - 0.1) {
    float k = mod(cid / 11.0, 3.0);
    c = k < 1.0 ? hex(0x2e5d86) : k < 2.0 ? hex(0xa8452f) : hex(0x3f7a52);
  }
  c *= 0.9 + 0.1 * noise(p * 30.0);
  // Edges grimed where thumbs flick them.
  c *= 1.0 - 0.18 * smoothstep(RIN + CH - 0.6, RIN + CH, rr);
  return mat(c * 0.9, 0.8, 0.0);
}

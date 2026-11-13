/**
 * The view: one painted landscape that is assembled by the mix.
 *
 * A seaside village at the edge of a meadow, seen from the grass, the sun
 * setting over the sea in front of you. Everything in it belongs to a layer
 * and appears, or moves, because that layer is playing — and where the sound
 * has a physical model, the picture follows the model rather than doing its
 * own thing:
 *
 *   rain      streaks, splashes, wet ground, and a veil over the distance
 *   waves     crests rolling in and breaking when the audio breaks, peeling
 *             the same way the sound pans, foam washing up the sand
 *   wind      grass, the tree and the clouds move by the model's wind speed
 *   campfire  a fire on the beach, flickering with the audio's flicker
 *   café      the café's window lit and busy
 *   birds     on the wire, each bobbing while it sings
 *   crickets  fireflies in the meadow, and the night itself
 *   highway   headlights on the causeway exactly where the model's cars are —
 *             the one straight ahead is in the middle, as it is in the sound
 *   clock     the tower shows the real time, its hand on the real second
 *   thunder   storm cloud, and the bolt at the bearing the model struck it,
 *             the flash first — the sound follows by distance
 *   mower     on the lawn, where the model says, spraying cuttings
 *   modem     a lit screen in a window, flickering with the handshake
 *
 * The time of day comes from the mix as a whole: crickets and a fire pull it
 * towards night, birds and a mower towards morning. Light is worked out the
 * way it falls: with the sun low in front of you the land is backlit — dark,
 * with bright rims — and the air between you and anything far away is the
 * colour of the sky behind it, so distance fades into the sky it stands
 * against. Water reflects the sky, more so further out (Fresnel). Rendered
 * in linear light and tone-mapped like a photograph.
 *
 * World units: the ground is y = 0, the horizon y = 0.42, and the scene is
 * 2.4 wide, centred on x = 1.2. A narrow screen sees the middle of it and
 * more sky (see `world`).
 */
import { glsl } from '../gl'

export const SCENE_FRAG = glsl(`
uniform float u_motion;
uniform float u_tod;       // 0 night, 0.35 dusk, 1 full day
uniform float u_cloud;     // cover, 0..1
uniform float u_rain;      // 0..1
uniform float u_wet;       // ground wetness, lags the rain
uniform float u_wind;      // 0..1 from the wind model's speed
uniform float u_windDir;   // -1..1
uniform float u_flash;     // lightning brightness now
uniform vec4  u_bolt;      // x, seed, visible 0..1, far 0/1
uniform float u_waves;
uniform float u_wave[16];  // 4 waves × (seconds since crash, build, wash, peak)
uniform float u_peel[4];   // which way each wave peels, -1..1
uniform float u_fire;
uniform float u_flicker;
uniform float u_pop;       // seconds since the last pop
uniform float u_cafe;
uniform float u_birds;
uniform float u_bird[4];   // each 0..1, singing
uniform float u_crickets;
uniform float u_traffic;
uniform float u_cars[48];  // 16 × (x, lane, kind; kind < 0 means none)
uniform float u_clock;
uniform vec3  u_hands;     // hour, minute, second hand angles, radians clockwise from 12
uniform float u_mower;
uniform vec3  u_mowerP;    // x, y, facing × (1 running, 0.01 stopped)
uniform float u_modem;
uniform float u_screen;    // the modem's screen, 0..1

const float H = 0.42;
const float DECK = 0.381;
const vec2 FIRE = vec2(1.45, 0.105);

float T;      // animated time (frozen under reduced motion)
float PX;     // world units per pixel
float NIGHT;  // 1 at night
float DUSK;   // 1 at dusk
float DAY;    // 1 by day
float KEYF;   // how much of the key light reaches faces turned towards us
vec3 SUN;     // the key light: sun or moon
vec3 AMB;     // the sky's light on everything
vec3 HAZE;    // the air at this pixel's bearing
vec2 SUNP;
float WIND;

float sat(float x) { return clamp(x, 0.0, 1.0); }
/** Coverage of a shape from its signed distance (negative inside). */
float cover(float d) { return sat(0.5 - d / PX); }
float box(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

/** Gradient noise, smoother than the value noise for close-up texture. */
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 ga = hash22(i) * 2.0 - 1.0, gb = hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
  vec2 gc = hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, gd = hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
  float a = dot(ga, f), b = dot(gb, f - vec2(1.0, 0.0));
  float c = dot(gc, f - vec2(0.0, 1.0)), d = dot(gd, f - vec2(1.0, 1.0));
  return 0.5 + 0.75 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float gfbm(vec2 p, int oct) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    v += a * gnoise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}
float ridge1(float x, float k) { return gfbm(vec2(x, k), 4); }

/* ---- light ------------------------------------------------------------- */

void lighting() {
  float tod = u_tod;
  float up = smoothstep(0.08, 0.34, tod);
  NIGHT = 1.0 - up;
  DAY = smoothstep(0.34, 0.8, tod);
  DUSK = up * (1.0 - DAY);
  // The sun sets over the sea, in front and to the right.
  float elev = tod < 0.3 ? mix(-0.3, 0.02, tod / 0.3) : mix(0.02, 0.6, (tod - 0.3) / 0.7);
  SUNP = vec2(1.85, H + elev * 0.75);
  SUN = mix(mix(vec3(0.12, 0.15, 0.24) * 0.55, vec3(1.0, 0.5, 0.22) * 1.25, up), vec3(1.0, 0.95, 0.88) * 1.8, DAY);
  KEYF = mix(mix(0.55, 0.16, up), 0.85, DAY);
  AMB = mix(mix(vec3(0.007, 0.011, 0.026), vec3(0.05, 0.048, 0.085), up), vec3(0.26, 0.32, 0.44), DAY);
  float oc = u_cloud;
  SUN *= 1.0 - 0.8 * oc;
  AMB = mix(AMB, vec3(dot(AMB, vec3(0.33))) * 1.15, oc * 0.7);
  vec3 fl = vec3(0.65, 0.75, 1.0) * u_flash;
  AMB += fl * 0.5;
}

/** The sky right at the horizon, at bearing x: warm towards the sun. */
vec3 horizonAt(float x) {
  float near = exp(-pow((x - SUNP.x) * 1.15, 2.0));
  float up = 1.0 - NIGHT;
  vec3 n = vec3(0.02, 0.032, 0.065);
  vec3 d = mix(vec3(0.26, 0.17, 0.3), vec3(1.0, 0.44, 0.16), near);
  vec3 dy = mix(vec3(0.6, 0.73, 0.9), vec3(0.88, 0.86, 0.8), near * 0.5);
  vec3 c = mix(mix(n, d, up), dy, DAY);
  vec3 g = mix(vec3(0.018, 0.022, 0.032), vec3(0.42, 0.45, 0.5), max(DAY, 0.25 * DUSK));
  return mix(c, g, u_cloud * 0.8) + vec3(0.6, 0.7, 1.0) * u_flash * 0.25;
}

/** Albedo a, facing the key light by f, at aerial-perspective depth h. */
vec3 lit(vec3 a, float f, float h) {
  vec3 c = a * (AMB + SUN * f * KEYF);
  return mix(c, HAZE, sat(h * (1.0 + u_rain * 0.8)));
}

/* ---- sky ---------------------------------------------------------------- */

vec3 skyCol(vec2 p) {
  float h = sat((p.y - H) / 1.0);
  float up = 1.0 - NIGHT;
  vec3 hz = horizonAt(p.x);
  vec3 mid = mix(mix(vec3(0.006, 0.011, 0.03), vec3(0.14, 0.11, 0.26), up), vec3(0.24, 0.44, 0.8), DAY);
  vec3 zen = mix(mix(vec3(0.002, 0.004, 0.013), vec3(0.02, 0.035, 0.12), up), vec3(0.07, 0.2, 0.56), DAY);
  vec3 g = mix(vec3(0.01, 0.013, 0.02), vec3(0.34, 0.37, 0.42), max(DAY, 0.2 * DUSK));
  mid = mix(mid, g, u_cloud * 0.85);
  zen = mix(zen, g * 0.8, u_cloud * 0.85);
  vec3 c = mix(hz, mid, smoothstep(0.0, 0.2, h));
  c = mix(c, zen, smoothstep(0.12, 0.8, h));
  // The glow around the sun, wide and warm when it is low.
  vec2 d = (p - SUNP) * vec2(0.7, 1.3);
  c += SUN * (exp(-dot(d, d) * mix(4.0, 22.0, DAY)) * mix(0.5, 0.22, DAY) + exp(-dot(d, d) * 110.0) * 0.5) * (1.0 - smoothstep(0.2, 0.75, u_cloud));
  return c;
}

vec3 sky(vec2 p) {
  vec3 c = skyCol(p);
  float sv = NIGHT * (1.0 - u_cloud) * smoothstep(H + 0.04, H + 0.3, p.y);
  if (sv > 0.01) {
    vec2 g2 = p * 150.0;
    vec2 cell = floor(g2), f = fract(g2);
    vec2 o = hash22(cell);
    float b = hash21(cell + 7.3);
    float s = exp(-dot(f - o, f - o) * 1100.0) * step(0.86, b);
    float tw = 0.65 + 0.35 * sin(T * (2.0 + b * 4.0) + b * 40.0);
    vec3 sc = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), hash21(cell + 2.0));
    c += sc * s * tw * sv * (0.5 + 2.5 * (b - 0.86) / 0.14);
    // The Milky Way's faint band.
    float band = exp(-pow((p.y - H - 0.35 - (p.x - 1.2) * 0.25) * 4.0, 2.0));
    c += vec3(0.05, 0.055, 0.08) * band * gfbm(p * vec2(6.0, 9.0), 3) * sv;
  }
  float sd = length(p - SUNP);
  c += mix(vec3(1.0, 0.62, 0.32), vec3(1.0, 0.97, 0.92), DAY) * 7.0 * cover(sd - 0.021) * (1.0 - smoothstep(0.25, 0.65, u_cloud)) * (1.0 - NIGHT) * step(H, p.y);
  vec2 mp = vec2(0.86, 0.84);
  float md = length(p - mp);
  float moon = cover(md - 0.019) * (1.0 - 0.9 * cover(length(p - mp - vec2(0.008, 0.005)) - 0.018));
  c += vec3(0.86, 0.88, 0.95) * 1.8 * moon * NIGHT * (1.0 - u_cloud * 0.85);
  c += vec3(0.25, 0.3, 0.45) * exp(-md * md * 50.0) * 0.1 * NIGHT * (1.0 - u_cloud);
  return c;
}

float cloudAt(vec2 p, int oct) {
  float band = smoothstep(H + 0.04, H + 0.3, p.y);
  if (band <= 0.0) return 0.0;
  float sp = 0.006 + 0.05 * WIND;
  vec2 q = vec2(p.x * 1.5 - T * sp * (u_windDir >= 0.0 ? 1.0 : -1.0), p.y * 3.6) + vec2(0.0, 3.0);
  float thr = mix(0.7, 0.36, u_cloud);
  // The first octave alone, plus the most the rest could add.
  float n = 0.5 * gnoise(q);
  if (n + 0.5 < thr) return 0.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  vec2 r = rot * q * 2.03;
  float a = 0.25;
  for (int i = 1; i < 4; i++) {
    if (i >= oct) break;
    n += a * gnoise(r);
    r = rot * r * 2.03;
    a *= 0.5;
  }
  return smoothstep(thr, thr + 0.2, n) * band;
}

vec3 clouds(vec2 p, vec3 c) {
  float d = cloudAt(p, 4);
  if (d < 0.003) return c;
  float top = cloudAt(p + vec2(-0.012, 0.03), 2);
  float shade = sat(0.5 + (d - top) * 1.8);
  // Bellies near the horizon catch the low sun; tops catch the sky.
  float low = 1.0 - smoothstep(H, H + 0.5, p.y);
  vec3 under = horizonAt(p.x) * mix(0.35, 0.9, DUSK) * low;
  vec3 base = mix(vec3(0.01, 0.014, 0.024), vec3(0.42, 0.44, 0.48), max(DAY, 0.15 * DUSK));
  vec3 cc = base * (0.55 + 0.6 * shade) + under * (1.0 - shade * 0.6) + SUN * 0.25 * shade * (1.0 - DAY * 0.5);
  cc *= 1.0 - 0.5 * u_cloud * smoothstep(0.3, 1.0, d);
  float near = exp(-pow((p.x - u_bolt.x) * 2.2, 2.0));
  cc += vec3(0.75, 0.82, 1.0) * u_flash * (0.5 + 1.8 * near) * d;
  return mix(c, cc, sat(d * 1.1));
}

/** The bolt: a jagged channel from the cloud base to beyond the horizon. */
vec3 bolt(vec2 p, vec3 c) {
  if (u_bolt.z <= 0.001 || u_bolt.w > 0.5) return c;
  float top = H + 0.6, bot = H;
  if (p.y < bot || p.y > top) return c;
  float s = u_bolt.y;
  float y = (top - p.y) / (top - bot);
  float x = u_bolt.x + 0.09 * (gnoise(vec2(y * 4.0, s)) - 0.5) + 0.035 * (gnoise(vec2(y * 19.0, s + 3.0)) - 0.5) + 0.012 * (gnoise(vec2(y * 80.0, s + 7.0)) - 0.5);
  float d = abs(p.x - x);
  float core = exp(-d * d / (PX * PX * 1.3));
  float glow = exp(-d * 45.0) * 0.3;
  float y0 = 0.22 + 0.3 * hash11(s);
  if (y > y0) {
    float u = y - y0;
    float x0 = u_bolt.x + 0.09 * (gnoise(vec2(y0 * 4.0, s)) - 0.5) + 0.035 * (gnoise(vec2(y0 * 19.0, s + 3.0)) - 0.5);
    float bx = x0 + (hash11(s + 1.0) > 0.5 ? 1.0 : -1.0) * u * 0.22 + 0.02 * (gnoise(vec2(y * 31.0, s + 11.0)) - 0.5);
    float bd = abs(p.x - bx);
    core += exp(-bd * bd / (PX * PX * 0.8)) * (1.0 - smoothstep(0.0, 0.35, u)) * 0.55;
  }
  return c + vec3(0.82, 0.88, 1.0) * (core * 8.0 + glow) * u_bolt.z;
}

/* ---- land and water ------------------------------------------------------ */

float mountains(float x) { return mix(H + 0.015 + 0.15 * ridge1(x * 0.9 + 3.1, 1.7), H - 0.02, smoothstep(0.6, 1.4, x)); }
float hills(float x) { return mix(H + 0.004 + 0.03 + 0.07 * ridge1(x * 2.1, 4.2), H - 0.02, smoothstep(0.9, 1.22, x)); }
/** The water's near edge on the right. */
float beach(float x) { return 0.3 - (x - 1.05) * 0.085; }
/** Where the land in front of the road gives way to sea. */
float shore(float x) { return mix(H + 0.02, beach(x), smoothstep(0.95, 1.16, x)); }
/** The meadow's edge: rolling, and dropping away into dunes on the right. */
float meadow(float x) {
  float g = 0.218 + 0.028 * sin(x * 2.3 + 0.6) + 0.02 * (ridge1(x * 4.0, 9.0) - 0.5);
  g += 0.014 * exp(-pow((x - 1.0) / 0.05, 2.0));
  float fall = smoothstep(1.02, 1.3, x);
  return mix(g, -0.05, fall * fall * (3.0 - 2.0 * fall));
}

vec3 sea(vec2 p, vec3 c) {
  float b = shore(p.x);
  if (p.y > H || p.y < b - 0.004) return c;
  float depth = sat((p.y - b) / max(0.02, H - b));
  // Ripples run along the swell, so the reflection breaks up sideways.
  float rip = gnoise(vec2(p.x * 26.0, p.y * 300.0 - T * 0.7)) - 0.5;
  float my = H + (H - p.y) * 3.2 + rip * 0.05 * (1.0 - depth * 0.6);
  vec3 refl = skyCol(vec2(p.x + rip * 0.015, my));
  // Looking down into near water you see into it; far out it is all mirror.
  float fres = 0.18 + 0.82 * pow(depth, 1.5);
  vec3 body = mix(vec3(0.004, 0.014, 0.02), vec3(0.03, 0.13, 0.16), DAY) + AMB * 0.08;
  vec3 w = mix(body, refl * 0.82, fres);
  // The sun's road: glints where a ripple tilts towards it.
  float sunUp = smoothstep(H - 0.03, H + 0.02, SUNP.y);
  float roadW = exp(-pow((p.x - SUNP.x) / (0.03 + 0.18 * (1.0 - depth)), 2.0));
  float glint = smoothstep(0.62, 0.9, gnoise(vec2(p.x * 160.0, p.y * 900.0 - T * 2.0)));
  w += SUN * roadW * glint * 2.2 * (1.0 - u_cloud * 0.85) * sunUp;
  w += SUN * roadW * 0.15 * (1.0 - u_cloud * 0.8) * sunUp * depth;
  w += vec3(0.45, 0.5, 0.65) * exp(-pow((p.x - 0.86) * 8.0, 2.0)) * glint * NIGHT * (1.0 - u_cloud) * 0.9;
  // Rain pocks the surface.
  w += (AMB + 0.2 * HAZE) * u_rain * 1.2 * step(0.982, hash21(floor(vec2(p.x * 240.0, p.y * 800.0)) + floor(T * 11.0)));

  // Waves: each a crest rolling in, a break, a sheet of foam.
  float foam = 0.0, crest = 0.0, trough = 0.0;
  for (int k = 0; k < 4; k++) {
    float pk = u_wave[k * 4 + 3];
    if (pk <= 0.0) continue;
    float s = u_wave[k * 4], build = u_wave[k * 4 + 1], wash = u_wave[k * 4 + 2];
    // It breaks first at one end and peels along to the other.
    s -= (p.x - 1.75) * u_peel[k] * 0.7;
    if (s < 0.0) {
      float u = sat(-s / build);
      float yc = b + 0.005 + 0.075 * u;
      float d = p.y - yc;
      // Nearer, it is taller and steeper.
      float hgt = (0.004 + 0.006 * (1.0 - u)) * pk;
      crest += exp(-d * d / (hgt * hgt)) * (1.0 - u * 0.6) * pk;
      trough += exp(-pow((d + hgt * 1.5) / (hgt * 1.2), 2.0)) * (1.0 - u * 0.5) * pk;
      // White water along the lip, more of it as it steepens to break.
      float lip = exp(-pow((d - hgt * 0.6) / (hgt * 0.5), 2.0));
      foam += lip * smoothstep(0.55, 0.0, u) * smoothstep(0.3, 0.65, gnoise(vec2(p.x * 60.0 + s * 3.0, 4.0 + T * 0.4)));
    } else {
      float reach = 0.022 * pk * sin(3.14159 * sat(s / (wash * 1.4)));
      float edge = b - reach;
      if (p.y > b + 0.05 || p.y < b - 0.03) continue;
      float lace = gfbm(vec2(p.x * 60.0, p.y * 130.0 + s * 0.4), 3);
      float sheet = smoothstep(edge - 0.002, edge + 0.002, p.y) * smoothstep(b + 0.05 * exp(-s * 1.5), b, p.y);
      foam += sheet * smoothstep(0.35, 0.65, lace) * exp(-s / (wash * 1.6)) * pk;
      foam += exp(-pow((p.y - b) / 0.005, 2.0)) * exp(-s * 2.2) * pk * 1.6;
    }
  }
  vec3 fc = mix(vec3(0.42, 0.46, 0.55) * 0.1, vec3(0.9, 0.93, 0.95), DAY) + SUN * KEYF * 0.6 + AMB * 0.8 + vec3(0.6, 0.7, 0.9) * u_flash;
  w += (AMB * 1.4 + SUN * KEYF * 0.7 + HAZE * 0.2) * crest * 0.8 * u_waves;
  w *= 1.0 - 0.55 * sat(trough) * u_waves;
  w = mix(w, fc, sat(foam) * u_waves);
  return mix(c, w, cover(b - 0.002 - p.y) * step(p.y, H));
}

/** Everything in front of the road: fields, hedgerows, and the beach. */
vec3 land(vec2 p, vec3 c) {
  float top = mix(DECK - 0.002, beach(p.x) - 0.001, smoothstep(0.95, 1.16, p.x));
  if (p.y > top + 0.002) return c;
  float depth = sat((top - p.y) / 0.2);
  float sandness = smoothstep(1.0, 1.12, p.x);
  // Fields: a patchwork, divided by hedgerows that get closer together with distance.
  float rows = p.y * 34.0 + gnoise(vec2(p.x * 3.0, 1.0)) * 0.8;
  float ri = floor(rows);
  float cols = p.x * 5.5 + hash11(ri * 3.7) * 3.0 + gnoise(vec2(p.y * 40.0, ri)) * 0.3;
  float ci = floor(cols);
  float tone = hash21(vec2(ci, ri));
  vec3 crop = mix(vec3(0.07, 0.17, 0.05), vec3(0.15, 0.23, 0.07), tone);
  crop = mix(crop, vec3(0.26, 0.22, 0.1), step(0.8, tone));
  crop = mix(crop, vec3(0.12, 0.09, 0.06), step(0.93, tone));
  // Furrows, and the texture of whatever grows.
  crop *= 0.85 + 0.25 * gnoise(vec2(p.x * 40.0, p.y * 900.0)) + 0.1 * step(0.5, fract(p.x * 260.0 + ri)) * step(0.8, tone);
  float hx = abs(fract(cols) - 0.5) * 2.0;
  float hy = abs(fract(rows) - 0.5) * 2.0;
  float hedge = max(smoothstep(0.86, 0.97, hy), smoothstep(0.93, 0.99, hx));
  hedge *= 0.6 + 0.4 * gnoise(p * 300.0);
  vec3 fieldC = lit(mix(crop, vec3(0.025, 0.06, 0.025), sat(hedge)), 0.45 + 0.3 * tone, 0.2 * (1.0 - depth));
  // Sand: rippled by the wind, darker and shinier where the sea has wet it.
  float rip = gnoise(vec2(p.x * 40.0 + p.y * 20.0, p.y * 260.0));
  vec3 sandA = mix(vec3(0.4, 0.33, 0.24), vec3(0.48, 0.4, 0.3), rip);
  float wetSand = smoothstep(0.03, 0.0, beach(p.x) - p.y);
  sandA *= 1.0 - 0.45 * max(wetSand, u_wet * 0.7);
  vec3 sandC = lit(sandA, 0.6, 0.12 * (1.0 - depth));
  sandC += horizonAt(p.x) * 0.25 * max(wetSand, u_wet * 0.4) * (1.0 - depth * 0.6);
  vec3 col = mix(fieldC, sandC, sandness);
  // Firelight on the sand.
  float fd = length((p - FIRE) * vec2(1.0, 2.3));
  col += vec3(1.0, 0.42, 0.14) * (0.0006 / (fd * fd + 0.0012)) * u_fire * u_flicker * (0.4 + 1.6 * NIGHT) * mix(crop, sandA, sandness);
  return mix(c, col, cover(p.y - top));
}

vec3 town(vec2 p, vec3 c) {
  if (p.x < 0.3 || p.x > 1.08 || p.y > H + 0.24 || p.y < DECK) return c;
  float base = DECK + 0.004;
  float cw = 0.052;
  float i = floor((p.x - 0.3) / cw);
  float lx = fract((p.x - 0.3) / cw);
  float r = hash11(i * 13.1 + 2.0);
  float hgt = 0.032 + 0.06 * r;
  float half_ = 0.43 - 0.07 * hash11(i);
  float wall = box(vec2(lx * cw, p.y), vec2(0.5 * cw, base + hgt * 0.5), vec2(half_ * cw, hgt * 0.5));
  float roof = 1e3;
  if (r > 0.3) {
    float rh = 0.013 + 0.01 * hash11(i + 9.0);
    float yy = p.y - (base + hgt);
    roof = max(abs(lx - 0.5) * cw * rh / ((half_ + 0.03) * cw) + yy - rh, -yy);
  }
  float shape = min(wall, roof);
  float tower = box(p, vec2(0.66, base + 0.085), vec2(0.014, 0.085));
  float spire = max(abs(p.x - 0.66) * 3.0 + (p.y - (base + 0.215)), -(p.y - (base + 0.17)));
  shape = min(shape, min(tower, spire));
  float cafe = box(p, vec2(0.89, base + 0.032), vec2(0.045, 0.032));
  shape = min(shape, cafe);
  float house = box(p, vec2(0.47, base + 0.024), vec2(0.024, 0.024));
  float hroof = max(abs(p.x - 0.47) * 0.75 + (p.y - (base + 0.064)), -(p.y - (base + 0.048)));
  shape = min(shape, min(house, hroof));
  float cov = cover(shape);
  if (cov <= 0.0) return c;
  // Whitewash and pale render, terracotta and slate.
  vec3 wallA = mix(vec3(0.62, 0.6, 0.56), vec3(0.5, 0.56, 0.6), step(0.6, hash11(i + 3.0)));
  wallA = mix(wallA, vec3(0.62, 0.52, 0.46), step(0.85, hash11(i + 4.0)));
  vec3 roofA = mix(vec3(0.42, 0.2, 0.13), vec3(0.2, 0.22, 0.27), step(0.55, hash11(i + 5.0)));
  bool isRoof = roof < wall && roof < tower && roof < cafe && roof < house;
  vec3 a = isRoof || hroof < 0.0 ? roofA : wallA;
  if (spire < 0.0) a = vec3(0.16, 0.22, 0.25);
  // The sun-facing side of each building is lit; the haze takes some.
  float side = step(0.5, lx);
  vec3 col = lit(a, 0.35 + 0.65 * side, 0.32);
  // A rim of light on the sun side's edge.
  col += SUN * KEYF * 0.25 * smoothstep(0.42, 0.47, lx) * step(wall, 0.0) * (1.0 - DAY);
  // Windows, lit after dark — more of them later on.
  vec2 wq = vec2(lx * 6.0, (p.y - base) * 130.0);
  vec2 wi = floor(wq), wf = fract(wq);
  float win = step(0.3, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y) * step(wf.y, 0.8) * step(1.0, wi.x) * step(wi.x, 4.0) * step(wi.y, hgt * 130.0 - 1.5);
  float on = step(0.6 - 0.4 * (1.0 - DAY), hash21(wi + i * 7.0));
  vec3 warm = vec3(1.0, 0.64, 0.3);
  float plain = step(wall, 0.0) * (1.0 - step(tower, 0.0)) * (1.0 - step(cafe, 0.0)) * (1.0 - step(house, 0.0));
  col = mix(col, col * 0.4 + warm * (0.1 + 1.6 * (1.0 - DAY)) * on, win * plain * 0.9);
  if (cafe < 0.0) {
    float glass = step(abs(p.y - (base + 0.022)), 0.013) * step(0.18, fract((p.x - 0.845) * 36.0)) * step(abs(p.x - 0.89), 0.04);
    float busy = 0.25 + 0.75 * u_cafe;
    float people = smoothstep(0.42, 0.68, gnoise(vec2(p.x * 80.0 - T * 0.35, 1.0)));
    vec3 inside = warm * (0.35 + 2.6 * (1.0 - DAY)) * busy * (1.0 - 0.55 * people * u_cafe);
    col = mix(col, inside, glass * (0.35 + 0.65 * busy));
    float aw = step(abs(p.y - (base + 0.043)), 0.0045) * step(abs(p.x - 0.89), 0.05);
    col = mix(col, lit(vec3(0.1, 0.3, 0.34), 0.7, 0.28) * (0.8 + 0.3 * step(0.5, fract(p.x * 110.0))), aw);
  }
  if (house < 0.0) {
    float sw = box(p, vec2(0.474, base + 0.026), vec2(0.0075, 0.0065));
    col = mix(col, vec3(0.02, 0.03, 0.05) + vec3(0.3, 0.6, 1.0) * (0.04 + u_screen * 2.6) * u_modem, cover(sw));
    col += vec3(0.3, 0.6, 1.0) * u_screen * u_modem * exp(-length(p - vec2(0.474, base + 0.026)) * 120.0) * 0.4;
  }
  // The clock face: the real time.
  vec2 fcen = vec2(0.66, base + 0.132);
  float fd = length(p - fcen);
  if (fd < 0.014) {
    vec3 face = mix(vec3(0.86, 0.83, 0.75) * (AMB + SUN * KEYF + 0.05), vec3(1.0, 0.88, 0.62) * 1.5, (1.0 - DAY) * (0.25 + 0.75 * u_clock));
    col = mix(col, face, cover(fd - 0.012));
    vec2 q = p - fcen;
    for (int hh = 0; hh < 3; hh++) {
      float a2 = hh == 0 ? u_hands.x : hh == 1 ? u_hands.y : u_hands.z;
      float len = hh == 0 ? 0.0062 : hh == 1 ? 0.0095 : 0.0102;
      float wdt = hh == 2 ? 0.00045 : 0.0008;
      vec2 dir = vec2(sin(a2), cos(a2));
      float along = dot(q, dir);
      float across = abs(dot(q, vec2(dir.y, -dir.x)));
      float hand = max(across - wdt, max(-along - 0.001, along - len));
      vec3 hc = hh == 2 ? vec3(0.55, 0.08, 0.06) : vec3(0.04);
      col = mix(col, hc, cover(hand) * (hh == 2 ? u_clock : 1.0));
    }
  }
  return mix(c, col, cov);
}

/** The road in front of the town, carried on across the bay on a causeway. */
vec3 road(vec2 p, vec3 c) {
  if (p.y < shore(p.x) - 0.06 || p.y > DECK + 0.012) return c;
  float top = DECK + 0.004, bot = DECK - 0.006;
  float water = smoothstep(1.02, 1.12, p.x);
  float deck = max(p.y - top, bot - p.y);
  // Piers down into the water.
  float pier = box(vec2(fract(p.x / 0.045) * 0.045, p.y), vec2(0.0225, bot - 0.006), vec2(0.0018, 0.006));
  float shape = min(deck, pier * (water > 0.5 ? 1.0 : 1e3));
  vec3 asphalt = lit(vec3(0.09, 0.09, 0.1), 0.4, 0.26);
  asphalt = mix(asphalt, HAZE * 0.45, u_wet * 0.3);
  float rail = cover(abs(p.y - top + 0.0012) - 0.0006);
  vec3 col = mix(asphalt, lit(vec3(0.55), 0.6, 0.26), rail * 0.7);
  c = mix(c, col, cover(shape));
  // The vehicles, where the model has them, and their lights in the water.
  vec3 add = vec3(0.0);
  float bright = 0.3 + 2.4 * (1.0 - DAY) + 0.8 * u_rain;
  for (int i = 0; i < 16; i++) {
    float kind = u_cars[i * 3 + 2];
    if (kind < 0.0) continue;
    float x = u_cars[i * 3];
    if (abs(p.x - x) > 0.08) continue;
    float lane = u_cars[i * 3 + 1];
    float dir = lane < 0.5 ? 1.0 : -1.0;
    float y = lane < 0.5 ? DECK - 0.0035 : DECK + 0.0005;
    float len = kind > 0.5 ? 0.02 : 0.011;
    float body = box(p, vec2(x - dir * len * 0.5, y + 0.0024), vec2(len * 0.5, kind > 0.5 ? 0.0042 : 0.0024));
    vec3 paint = kind > 0.5 ? vec3(0.52, 0.54, 0.56) : mix(vec3(0.5, 0.08, 0.06), vec3(0.12, 0.22, 0.42), hash11(float(i) + 0.5));
    c = mix(c, lit(paint, 0.7, 0.22), cover(body) * u_traffic);
    vec2 hp = vec2(x, y + 0.0016), tp = vec2(x - dir * len, y + 0.0016);
    float hd = length((p - hp) * vec2(1.0, 1.7));
    float td = length((p - tp) * vec2(1.0, 1.7));
    add += vec3(1.0, 0.93, 0.78) * (exp(-hd * hd / (PX * PX * 4.0)) * 3.0 + exp(-hd * 130.0) * 0.22) * bright;
    add += vec3(1.0, 0.1, 0.05) * (exp(-td * td / (PX * PX * 3.0)) * 1.6 + exp(-td * 150.0) * 0.1) * bright;
    // Reflections, broken up by the ripples, over the water.
    if (water > 0.0 && p.y < bot) {
      float below = bot - p.y;
      float wig = (gnoise(vec2(p.y * 500.0, T * 1.5)) - 0.5) * 0.006;
      float rx = exp(-pow((p.x - x + wig) / (0.0025 + below * 0.03), 2.0));
      float ry = exp(-below * 30.0) * smoothstep(0.35, 0.65, gnoise(vec2(p.x * 200.0, p.y * 900.0 - T * 3.0)));
      add += vec3(1.0, 0.85, 0.65) * rx * ry * bright * 0.5 * water;
    }
  }
  return c + add * u_traffic;
}

vec3 lawn(vec2 p, vec3 c) {
  if (p.x < 0.54 || p.x > 1.06 || p.y > 0.345 || p.y < 0.27) return c;
  float hedgeTop = 0.335 + 0.005 * gnoise(vec2(p.x * 120.0, 2.0));
  float hedge = cover(max(p.y - hedgeTop, 0.322 - p.y)) * smoothstep(0.55, 0.58, p.x) * (1.0 - smoothstep(1.02, 1.05, p.x));
  c = mix(c, lit(vec3(0.04, 0.11, 0.04) * (0.7 + 0.6 * gnoise(p * 400.0)), 0.5, 0.2), hedge);
  float l = cover(max(p.y - 0.323, 0.281 - p.y)) * smoothstep(0.57, 0.6, p.x) * (1.0 - smoothstep(1.0, 1.03, p.x));
  float stripe = step(0.5, fract(p.x * 28.0));
  vec3 g = mix(vec3(0.1, 0.25, 0.07), vec3(0.16, 0.33, 0.09), stripe);
  c = mix(c, lit(g, 0.65, 0.16), l);
  if (u_mower < 0.01) return c;
  vec2 m = u_mowerP.xy;
  // Drawn half as big again as true scale, so it can be seen at all.
  p = m + (p - m) / 1.5;
  float face = u_mowerP.z >= 0.0 ? 1.0 : -1.0;
  float run = step(0.5, abs(u_mowerP.z));
  float body = box(p, m + vec2(0.0, 0.0045), vec2(0.0075, 0.0035));
  float wheel = min(length(p - m - vec2(-0.0055, 0.0012)) - 0.0018, length(p - m - vec2(0.0055, 0.0012)) - 0.0018);
  vec2 hb = m + vec2(-0.006 * face, 0.007), ht = m + vec2(-0.017 * face, 0.021);
  vec2 hv = ht - hb;
  float handle = length(p - hb - hv * sat(dot(p - hb, hv) / dot(hv, hv))) - 0.0006;
  vec2 pp = m + vec2(-0.025 * face, 0.0);
  float stride = run * sin(T * 6.0) * 0.0012;
  float legs = min(box(p, pp + vec2(stride, 0.005), vec2(0.0012, 0.005)), box(p, pp + vec2(-stride, 0.005), vec2(0.0012, 0.005)));
  float torso = box(p, pp + vec2(0.001 * face, 0.0175), vec2(0.0034, 0.0078));
  float head = length(p - pp - vec2(0.0015 * face, 0.0295)) - 0.0034;
  float person = min(min(legs, torso), head);
  float shape = min(min(body, wheel), min(handle, person));
  vec3 col = lit(vec3(0.6, 0.1, 0.07), 0.7, 0.14);
  if (person <= min(body, min(wheel, handle))) col = head < 0.0 ? lit(vec3(0.5, 0.36, 0.28), 0.6, 0.14) : lit(vec3(0.15, 0.2, 0.32), 0.6, 0.14);
  if (wheel < 0.0) col = vec3(0.01);
  c = mix(c, col, cover(shape) * u_mower);
  if (run > 0.0) {
    vec2 q = (p - m - vec2(0.009 * face, 0.002)) * vec2(face, 1.0);
    if (q.x > 0.0 && q.x < 0.03 && abs(q.y) < 0.02) {
      vec2 gq = floor(vec2(q.x * 900.0 - T * 50.0, q.y * 900.0));
      float spray = step(0.93, hash21(gq)) * exp(-q.x * 90.0) * step(abs(q.y), q.x * 0.6 + 0.002);
      c = mix(c, lit(vec3(0.22, 0.48, 0.12), 0.8, 0.12), spray * u_mower);
    }
  }
  return c;
}

vec3 ground(vec2 p, vec3 c) {
  float g = meadow(p.x);
  if (p.y > g + 0.002) return c;
  vec3 grassA = mix(vec3(0.05, 0.13, 0.035), vec3(0.1, 0.2, 0.05), gfbm(p * vec2(30.0, 60.0), 3));
  grassA *= 1.0 - 0.35 * u_wet;
  float dd = sat((g - p.y) / 0.22);
  // Nearer ground faces us more and the low sun less.
  vec3 col = lit(grassA, 0.6 - 0.35 * dd, 0.05 * (1.0 - dd));
  col += SUN * KEYF * 0.18 * exp(-(g - p.y) * 160.0) * (1.0 - DAY);
  float fd = length((p - FIRE) * vec2(1.0, 2.3));
  col += vec3(1.0, 0.42, 0.14) * (0.0006 / (fd * fd + 0.0012)) * u_fire * u_flicker * (0.4 + 1.6 * NIGHT) * grassA;
  if (u_rain > 0.01) {
    vec2 sg = vec2(p.x * 220.0, p.y * 700.0);
    vec2 cell = floor(sg);
    float tt = T * 9.0 + hash21(cell) * 10.0;
    float ph = fract(tt);
    float on = step(1.0 - u_rain * 0.25, hash21(cell + floor(tt)));
    float ring = exp(-pow((length(fract(sg) - 0.5) - ph * 0.45) * 12.0, 2.0)) * (1.0 - ph);
    col += (AMB * 1.5 + 0.1 * HAZE) * ring * on;
  }
  return mix(c, col, cover(p.y - g));
}

float duneTop(float x) { return mix(-0.03, 0.07 + 0.025 * sin(x * 4.0 + 0.8) + 0.01 * gnoise(vec2(x * 20.0, 5.0)), smoothstep(1.58, 1.85, x)); }

vec3 dune(vec2 p, vec3 c) {
  if (p.x < 1.5) return c;
  float top = duneTop(p.x);
  if (p.y > top + 0.06) return c;
  // Backlit sand: in its own shadow, with a bright lip along the crest.
  vec3 sandA = mix(vec3(0.42, 0.35, 0.26), vec3(0.52, 0.44, 0.33), gnoise(vec2(p.x * 50.0, p.y * 140.0)));
  sandA *= 1.0 - 0.4 * u_wet;
  vec3 col = lit(sandA, 0.25, 0.0);
  col += SUN * KEYF * 0.5 * exp(-(top - p.y) * 220.0) * (1.0 - DAY * 0.6);
  c = mix(c, col, cover(p.y - top));
  // Marram grass in tufts along the crest, bowing with the wind.
  float alpha = 0.0;
  vec3 gc = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float w = 0.0045 + fk * 0.0025;
    float cx = floor(p.x / w + fk * 0.5);
    float tuft = step(0.45, gnoise(vec2(cx * w * 18.0, fk * 3.0)));
    float r = hash11(cx * 2.3 + fk * 11.0);
    float hgt = (0.025 + 0.05 * r) * tuft * smoothstep(1.6, 1.8, p.x);
    float y = p.y - (top - 0.004);
    if (y < 0.0 || y > hgt || hgt <= 0.0) continue;
    float u = y / hgt;
    float lean = (r - 0.5) * 0.6 + (u_windDir * 0.5 + 0.3) * (0.2 + 1.2 * WIND) + (0.05 + 0.25 * WIND) * sin(T * (1.4 + 2.5 * WIND) + cx);
    float x = (cx + 0.5 - fk * 0.5) * w + lean * u * u * hgt;
    float d = abs(p.x - x) - w * 0.16 * (1.0 - u);
    float a = cover(d);
    vec3 bc = lit(mix(vec3(0.16, 0.18, 0.08), vec3(0.3, 0.28, 0.14), r) * (0.5 + 0.6 * u), 0.3 + 0.5 * u, 0.0);
    bc += SUN * KEYF * 0.6 * u * u * (1.0 - DAY);
    gc = mix(gc, bc, a);
    alpha = max(alpha, a);
  }
  return mix(c, gc, alpha);
}

vec3 fire(vec2 p, vec3 c) {
  vec2 q = p - FIRE;
  // The glow in the air around it reaches further than the fire itself.
  float gd = length(q - vec2(0.0, 0.02));
  c += vec3(1.0, 0.4, 0.12) * (0.00012 / (gd * gd + 0.0004)) * u_fire * u_flicker * (0.3 + NIGHT);
  if (abs(q.x) > 0.12 || q.y > 0.16 || q.y < -0.03) return c;
  float stones = 1e3;
  for (int i = 0; i < 8; i++) {
    float a = float(i) / 8.0 * 6.2831;
    vec2 sp = vec2(cos(a) * 0.024, sin(a) * 0.0065 - 0.001);
    stones = min(stones, length((q - sp) * vec2(1.0, 1.45)) - 0.0048 - 0.001 * hash11(float(i)));
  }
  vec3 stoneC = lit(vec3(0.32, 0.3, 0.28), 0.5, 0.0) + vec3(1.0, 0.4, 0.1) * u_fire * u_flicker * 0.3;
  c = mix(c, stoneC, cover(stones));
  vec2 l1 = q - vec2(0.0, 0.004);
  float log1 = box(vec2(l1.x * 0.95 + l1.y * 0.3, -l1.x * 0.3 + l1.y * 0.95), vec2(0.0), vec2(0.017, 0.0026)) - 0.001;
  float log2 = box(vec2(l1.x * 0.95 - l1.y * 0.3, l1.x * 0.3 + l1.y * 0.95), vec2(0.0), vec2(0.016, 0.0026)) - 0.001;
  vec3 ember = vec3(1.3, 0.32, 0.05) * u_fire * (0.4 + 0.6 * gnoise(vec2(p.x * 300.0, T * 2.0)));
  c = mix(c, lit(vec3(0.18, 0.11, 0.07), 0.5, 0.0) + ember, cover(min(log1, log2)));
  if (u_fire < 0.01) return c;
  vec2 fq = q / 0.065;
  float sway = (u_windDir * 0.18 + 0.08 * sin(T * 1.3)) * WIND * fq.y;
  float n = gfbm(vec2((fq.x - sway) * 3.0, fq.y * 2.2 - T * 3.4), 4);
  float env = (1.0 - fq.y) * 0.5 - abs(fq.x - sway * 0.6) * 1.55;
  float h = (env + (n - 0.5) * 0.85 * fq.y + 0.12) * u_flicker;
  float flame = smoothstep(0.0, 0.22, h) * step(-0.05, fq.y);
  vec3 fc = mix(vec3(0.9, 0.16, 0.02), vec3(1.0, 0.6, 0.16), smoothstep(0.1, 0.4, h));
  fc = mix(fc, vec3(1.0, 0.93, 0.72), smoothstep(0.35, 0.6, h));
  c += fc * flame * 2.8 * u_fire;
  // Smoke drifting off downwind, faint.
  float sm = abs(q.x) > 0.05 || q.y < 0.03 ? 0.0 : gfbm(vec2(q.x * 20.0 - T * 0.3 - u_windDir * q.y * 10.0, q.y * 12.0 - T * 0.8), 3);
  float smoke = smoothstep(0.5, 0.75, sm) * smoothstep(0.03, 0.08, q.y) * (1.0 - smoothstep(0.08, 0.16, q.y)) * exp(-pow((q.x - u_windDir * WIND * q.y * 0.8) * 25.0, 2.0));
  c = mix(c, HAZE * 0.6 + AMB, smoke * 0.18 * u_fire);
  if (u_pop < 2.5) {
    for (int i = 0; i < 10; i++) {
      float fi = float(i);
      vec2 v = vec2(hash11(fi * 3.1) - 0.5, 0.6 + hash11(fi * 7.7)) * vec2(0.05, 0.065);
      vec2 sp = vec2(0.0, 0.02) + v * u_pop + vec2(u_windDir * WIND * 0.03 * u_pop * u_pop, -0.004 * u_pop * u_pop);
      float sd = length(q - sp);
      float life = sat(1.0 - u_pop / (1.0 + hash11(fi) * 1.3));
      c += vec3(1.0, 0.55, 0.15) * exp(-sd * sd / (PX * PX * 1.6)) * life * 2.2 * u_fire;
    }
  }
  return c;
}

vec3 wire(vec2 p, vec3 c) {
  float x0 = 0.52, x1 = 1.3, y0 = 0.64, y1 = 0.61;
  if (p.x < x0 - 0.03 || p.x > x1 + 0.03 || p.y > 0.68) return c;
  vec3 dark = lit(vec3(0.1, 0.08, 0.06), 0.3, 0.0);
  float pole = min(box(p, vec2(x0, y0 * 0.5 + 0.1), vec2(0.003, y0 * 0.5 - 0.1)), box(p, vec2(x1, y1 * 0.5 + 0.1), vec2(0.003, y1 * 0.5 - 0.1)));
  pole = min(pole, min(box(p, vec2(x0, y0), vec2(0.018, 0.0017)), box(p, vec2(x1, y1), vec2(0.018, 0.0017))));
  c = mix(c, dark, cover(pole));
  float u = (p.x - x0) / (x1 - x0);
  if (u < 0.0 || u > 1.0) return c;
  float wy = mix(y0, y1, u) - 0.05 * 4.0 * u * (1.0 - u) + 0.003;
  c = mix(c, dark, cover(abs(p.y - wy) - PX * 0.5) * 0.9);
  if (u_birds < 0.01) return c;
  for (int i = 0; i < 4; i++) {
    float bu = 0.17 + 0.2 * float(i) + 0.03 * hash11(float(i) * 5.0);
    float bx = mix(x0, x1, bu);
    float by = mix(y0, y1, bu) - 0.05 * 4.0 * bu * (1.0 - bu) + 0.003;
    if (abs(p.x - bx) > 0.03) continue;
    float sing = u_bird[i];
    float f = i == 1 || i == 3 ? -1.0 : 1.0;
    vec2 q = (p - vec2(bx, by)) * vec2(f, 1.0) / 1.35;
    float bob = sing * (0.0012 + 0.0008 * sin(T * 30.0));
    float body = length((q - vec2(0.0, 0.0068)) * vec2(1.0, 1.22)) - 0.006;
    float head = length(q - vec2(0.0048, 0.013 + bob)) - 0.0033;
    float beak = box(q, vec2(0.009, 0.0132 + bob), vec2(0.0017, 0.0005 + sing * 0.0004));
    vec2 tq = q - vec2(-0.0078, 0.0045 - bob);
    float tail = box(vec2(tq.x * 0.9 - tq.y * 0.45, tq.x * 0.45 + tq.y * 0.9), vec2(0.0), vec2(0.0048, 0.0011));
    float shape = min(min(body, head), min(beak, tail));
    vec3 col = lit(mix(vec3(0.18, 0.12, 0.08), vec3(0.32, 0.22, 0.14), float(i) * 0.3), 0.55, 0.0);
    col += SUN * KEYF * 0.3 * smoothstep(0.002, -0.004, body) * step(0.002, q.x);
    c = mix(c, col, cover(shape) * u_birds);
  }
  return c;
}

vec3 tree(vec2 p, vec3 c) {
  if (p.x > 0.52 || p.y > 0.8 || p.x < 0.0 || p.y < 0.15) return c;
  vec2 b = vec2(0.26, meadow(0.26) - 0.012);
  float sway = (0.01 + 0.03 * WIND) * sin(T * (0.9 + 1.4 * WIND)) + u_windDir * WIND * 0.035;
  vec2 q = p - b;
  float hgt = max(q.y, 0.0);
  q.x -= sway * hgt * hgt * 4.0;
  float trunk = box(q, vec2(0.0, 0.17), vec2(0.009 + 0.007 * (1.0 - q.y / 0.34), 0.17));
  float limb1 = box(vec2(q.x * 0.9 - (q.y - 0.24) * 0.45, q.x * 0.45 + (q.y - 0.24) * 0.9), vec2(0.045, 0.0), vec2(0.05, 0.0045));
  float limb2 = box(vec2(q.x * 0.88 + (q.y - 0.28) * 0.47, -q.x * 0.47 + (q.y - 0.28) * 0.88), vec2(-0.04, 0.0), vec2(0.045, 0.004));
  float wood = min(trunk, min(limb1, limb2));
  // The crown: clumps of leaves, each lit from the sun's side and from above.
  float crown = 1e3;
  float shade = 0.0;
  float inner = 0.0;
  bool inCrown = abs(q.x) < 0.22 && q.y > 0.2 && q.y < 0.58;
  for (int i = 0; i < 40; i++) {
    if (!inCrown) break;
    float fi = float(i);
    vec2 h2 = hash22(vec2(fi, 4.2));
    // Clumps scattered through a broad crown, thinner at the sides.
    float ang = h2.x * 6.2831, rad = sqrt(h2.y);
    vec2 cc = vec2(0.0, 0.37) + vec2(cos(ang) * 0.15, sin(ang) * 0.085) * rad;
    float r = 0.022 + 0.022 * hash11(fi * 9.1) * (1.2 - rad * 0.5);
    // Each clump shivers on its own in the wind.
    cc += vec2(sin(T * (2.0 + 4.0 * WIND) + fi), cos(T * (1.7 + 3.0 * WIND) + fi * 1.3)) * 0.0012 * (0.3 + WIND);
    float d = length(q - cc) - r;
    if (d < crown) {
      crown = d;
      vec2 n = (q - cc) / r;
      shade = sat(0.4 + 0.35 * n.x + 0.45 * n.y) * (0.75 + 0.25 * h2.y);
      inner = rad;
    }
  }
  if (crown < 0.03) {
    float edge = gfbm(q * 90.0 + vec2(T * (0.5 + 2.5 * WIND), 0.0), 3);
    crown += (edge - 0.5) * 0.022;
    // Gaps where the sky shows through, mostly near the edge.
    crown += smoothstep(0.6, 0.72, gfbm(q * 55.0 + 9.0, 2)) * 0.012 * inner;
  }
  shade *= 0.55 + 0.45 * inner;
  float shape = min(wood, crown);
  float cov = cover(shape);
  if (cov <= 0.0) return c;
  vec3 col;
  if (crown < wood) {
    float leaf = gnoise(q * 300.0);
    vec3 a = mix(vec3(0.035, 0.09, 0.03), vec3(0.08, 0.17, 0.05), leaf);
    col = lit(a, 0.15 + 0.85 * shade, 0.0);
    // Light coming through the edge of the crown towards a low sun.
    col += SUN * KEYF * 0.25 * smoothstep(-0.006, 0.0, crown) * step(0.0, q.x) * (1.0 - DAY);
  } else col = lit(vec3(0.11, 0.075, 0.05), 0.3 + 0.4 * step(0.0, q.x), 0.0);
  return mix(c, col, cov);
}

/** Grass in front of everything, each blade bending in the wind. */
vec3 grass(vec2 p, vec3 c) {
  float g = meadow(p.x);
  if (p.y > g + 0.065 || p.y < g - 0.025 || p.x > 1.26) return c;
  float alpha = 0.0;
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float w = 0.0038 + fk * 0.002;
    float cx = floor(p.x / w + fk * 0.37);
    float r = hash11(cx * 1.7 + fk * 31.0);
    float hgt = (0.014 + 0.04 * r * r) * (1.0 - fk * 0.2) * (1.0 - 0.5 * smoothstep(1.05, 1.24, p.x));
    float y = p.y - (g - 0.006 - fk * 0.004);
    if (y < 0.0 || y > hgt) continue;
    float u = y / hgt;
    float bend = (u_windDir * 0.6 + 0.4) * WIND * 0.012 + (0.002 + 0.007 * WIND) * sin(T * (1.6 + 3.0 * WIND) + cx * 0.7 - p.x * 4.0);
    float x = (cx + 0.5 + (r - 0.5) * 0.6) * w - fk * 0.37 * w + bend * u * u * hgt / 0.03;
    float d = abs(p.x - x) - w * 0.24 * (1.0 - u);
    float a = cover(d);
    if (a <= 0.0) continue;
    vec3 gc = lit(mix(vec3(0.05, 0.15, 0.04), vec3(0.15, 0.26, 0.07), r) * (0.45 + 0.75 * u), 0.3 + 0.5 * u, 0.0);
    // Tips lit by a low sun behind them.
    gc += SUN * KEYF * 0.5 * u * u * (1.0 - DAY) * (0.5 + 0.5 * r);
    float gfd = length(p - FIRE);
    gc += vec3(1.0, 0.45, 0.15) * u_fire * u_flicker * (0.0002 / (gfd * gfd + 0.002)) * (0.4 + NIGHT);
    col = mix(col, gc, a);
    alpha = max(alpha, a);
  }
  return mix(c, col, alpha);
}

vec3 fireflies(vec2 p, vec3 c) {
  float v = u_crickets * (0.15 + 0.85 * NIGHT);
  if (v < 0.01 || p.y > 0.34 || p.x < 0.12 || p.x > 1.22) return c;
  for (int i = 0; i < 24; i++) {
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 3.7));
    vec2 fp = vec2(0.2 + 0.95 * h.x, 0.04 + 0.24 * h.y);
    fp += 0.02 * vec2(sin(T * 0.4 + fi * 2.1), cos(T * 0.33 + fi * 1.3));
    if (abs(p.x - fp.x) > 0.04) continue;
    float period = 2.5 + 3.0 * hash11(fi);
    float ph = fract(T / period + hash11(fi + 2.0));
    float blink = smoothstep(0.0, 0.08, ph) * smoothstep(0.35, 0.12, ph);
    float d = length(p - fp);
    c += vec3(0.7, 1.0, 0.3) * (exp(-d * d / (PX * PX * 2.6)) * 2.6 + exp(-d * 90.0) * 0.16) * blink * v;
  }
  return c;
}

vec3 rain(vec2 p, vec3 c) {
  if (u_rain < 0.01) return c;
  float tilt = (u_windDir * 0.6 + 0.15) * (0.15 + WIND * 0.6);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float sc = 1.0 + fk * 0.9;
    vec2 q = p * sc;
    q.x += q.y * tilt;
    q.y += T * (2.6 - fk * 0.5);
    vec2 cs = vec2(0.012, 0.11);
    vec2 cell = floor(q / cs);
    vec2 f = fract(q / cs);
    float r = hash21(cell + fk * 17.0);
    if (r > u_rain * (0.75 - fk * 0.15)) continue;
    float x = 0.2 + 0.6 * hash11(r * 91.0);
    float len = 0.35 + 0.4 * hash11(r * 37.0);
    float d = abs(f.x - x) * cs.x / sc;
    float a = cover(d - PX * 0.25) * smoothstep(0.0, 0.2, f.y) * smoothstep(len, len - 0.2, f.y) * step(f.y, len);
    c += (AMB * 2.0 + SUN * KEYF * 0.3 + HAZE * 0.35 + vec3(0.6, 0.7, 0.9) * u_flash) * a * (0.32 - fk * 0.08);
  }
  return c;
}

/** World position of a pixel, keeping the middle of the scene on narrow screens. */
vec2 world(vec2 uv) {
  float A = u_res.x / u_res.y;
  float V = max(A, 1.45);
  PX = V / u_res.x;
  return vec2(1.2 + (uv.x - 0.5) * V, uv.y * V / A);
}

void main() {
  T = u_time * u_motion;
  WIND = sat(u_wind);
  vec2 uv = vUv;
  vec2 p = world(uv);
  lighting();
  HAZE = horizonAt(p.x) * mix(0.6, 0.85, DAY);

  vec3 c = sky(p);
  c = clouds(p, c);
  c = bolt(p, c);
  float m = mountains(p.x);
  c = mix(c, lit(vec3(0.12, 0.15, 0.2), 0.35, 0.75), cover(p.y - m));
  float h = hills(p.x);
  vec3 hillA = mix(vec3(0.05, 0.11, 0.05), vec3(0.09, 0.15, 0.08), gfbm(p * vec2(20.0, 50.0), 3));
  c = mix(c, lit(hillA, 0.3 + 0.4 * sat(p.x - 0.4), 0.48), cover(p.y - h));
  c = sea(p, c);
  c = town(p, c);
  c = land(p, c);
  c = road(p, c);
  c = lawn(p, c);
  c = ground(p, c);
  c = fire(p, c);
  c = dune(p, c);
  c = wire(p, c);
  c = tree(p, c);
  c = grass(p, c);
  c = fireflies(p, c);
  c = rain(p, c);

  float expo = mix(mix(2.1, 1.25, smoothstep(0.05, 0.32, u_tod)), 1.0, DAY);
  c *= expo;
  vec2 v = uv - 0.5;
  c *= 1.0 - 0.3 * dot(v, v) * 2.0;
  c = aces(c);
  c = toSRGB(c);
  c = dither(c, uv * u_res);
  fragColor = vec4(c, 1.0);
}
`)

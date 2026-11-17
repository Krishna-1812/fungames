/**
 * The stage of Universe Forecast: the thing each event is, lit.
 *
 * The page works its dates and its geometry out of the orbits and used to
 * draw them flat: a yellow circle, a black circle, a blue ball. The geometry
 * is unchanged and comes in here as numbers. What this adds is the light.
 *
 *   solar    One camera, exposing for whatever light is left. With any real
 *            sliver of Sun showing, that is the Sun's own surface (darker and
 *            redder at the edge, a few spots) on a black sky, which is all a
 *            filter would let you see. As the last of it goes the exposure
 *            climbs five orders of magnitude and the things that were always
 *            there come up: beads of Sun in the valleys of the Moon's edge,
 *            the pink chromosphere and prominences, and the corona, falling
 *            off with distance the way it is measured to (Baumbach's fit).
 *   lunar    The Moon crossing the Earth's shadow. The penumbra is not a
 *            gradient somebody chose: at each place it is the fraction of the
 *            Sun's disc still showing past the Earth. Inside the umbra the
 *            only light is sunset bent round the Earth, red, and the eye
 *            only sees that once the lit part has gone, so the exposure
 *            follows the brightest part of the Moon.
 *   moon     The Moon on a night: the near side (lib/forecast-moon.ts), lit
 *            from where the Sun is, with craters casting shadows at the edge
 *            of the light and the dark part lit faintly by the Earth.
 *   season   The Earth at the instant of a solstice or equinox, on its real
 *            coastline, the Sun over the latitude and longitude it is over
 *            at that minute. Seen from over the sunset line, so the edge of
 *            night leans by exactly the Sun's declination.
 *   apsis    Half the Sun today against half the Sun in six months, on one
 *            scale. The step where the halves meet is the whole difference.
 *   shower   Meteors only: streaks from one point, longer the further from
 *            it they are, at the speed that shower's dust arrives at. The
 *            sky behind them is the page's, drawn from the star catalogue.
 *
 * What is invented is said in the README: the sunspots, the shape of the
 * corona's streamers, where the prominences are, the Moon's small craters,
 * the Earth's clouds and city lights.
 *
 * One program to a scene, not one for all six. Written as one it took a
 * browser over a minute to compile, with the page frozen for all of it: the
 * compiler on Windows unrolls every loop and copies every function into
 * every place it is called from, and the Moon alone was being copied into
 * four. Each scene on its own is a fraction of a second, and the page only
 * ever builds the one it is showing.
 */
import { glsl } from './gl'
import { MOON_GLSL } from './forecast-moon'
import { LIMB_GLSL, CORONA_GLSL, SHADOW_GLSL, GLINTS } from './forecast-light'

/** Which picture. */
export type StageScene = 'solar' | 'lunar' | 'moon' | 'season' | 'apsis' | 'shower'

/** How many meteors can be in flight at once, and how long each one's turn is (seconds). */
export const SHOWER_SLOTS = 16
export const SHOWER_TURN = 3.75

/* What every scene is told. Each uses the few it needs; the rest are dropped by the compiler. */
const HEAD = `
uniform sampler2D u_land;
uniform vec3  u_frame;   // the main body: centre x, centre y, radius, in window heights from the middle
uniform vec3  u_moon;    // solar: the Moon's centre from the Sun's and its size, in Sun radii
                         // lunar: its centre from the shadow's axis and its size, in Earth radii
uniform vec2  u_shadow;  // lunar: the umbra's radius and the penumbra's, in Earth radii
uniform vec3  u_sun;     // moon, season: which way the Sun is (x right, y up, z toward the eye)
uniform float u_spin;    // season: the longitude facing the eye, radians
uniform float u_k;       // solar: fraction of the Sun's face still showing. moon: fraction lit.
                         // apsis: the other Sun's size against this one
uniform vec4  u_rain;    // shower: the radiant (x, y), the chance a turn has a meteor, its speed 0..1
uniform float u_t;       // the stage's own clock, seconds
uniform float u_seed;    // a number for the day, so the invented parts differ from event to event
// Sums that are the same for every pixel of a frame, done once on the page (lib/forecast-light.ts):
uniform float u_open;    // solar: how much of the Sun's edge is clear of the Moon, 0..1
uniform float u_glint[${GLINTS * 3}];  // solar: where what is left of the Sun is showing, as x, y, how much
uniform float u_level;   // lunar: how bright the brightest part of the Moon is, against full sunlight

// A count the compiler cannot know. With a count it can see, the compiler on
// Windows writes a loop's body out once for every turn, and every function
// once for every call: a noise called thirty times is thirty copies, eighty
// milliseconds each to compile. So loops run to UPTO(n), and noise is asked
// for in batches: the places go in NP, one loop fills NV with the answers.
#define UPTO(n) ((n) + int(min(u_time, 0.0)))
const int NOISES = 16;
vec3 NP[NOISES];
float NV[NOISES];
void noises(int n) { for (int i = 0; i < UPTO(n); i++) NV[i] = noise3(NP[i]); }
// Two and three octaves of it: ask with a place, read back the sum.
void ask2(int i, vec3 p) { NP[i] = p; NP[i + 1] = p.yzx * 2.03 + vec3(37.1, 11.7, 5.3); }
void ask3(int i, vec3 p) { ask2(i, p); NP[i + 2] = p.zxy * 4.12 + vec3(19.3, 43.7, 7.9); }
float got2(int i) { return (0.5 * NV[i] + 0.25 * NV[i + 1]) / 0.75; }
float got3(int i) { return (0.5 * NV[i] + 0.25 * NV[i + 1] + 0.125 * NV[i + 2]) / 0.875; }

float starField(vec2 p, float density, float seed) {
  vec2 g = p * density;
  vec2 id = floor(g);
  vec2 h = hash22(id + seed);
  vec2 c = 0.12 + 0.76 * hash22(id.yx * 1.7 + seed + 31.0);
  float size = 0.035 + 0.05 * h.y;
  return smoothstep(size, 0.0, length(fract(g) - c)) * step(0.66, h.x) * pow(hash21(id * 2.3 + seed + 5.0), 3.0);
}
vec3 starsAt(vec2 p, float seed) {
  return vec3(0.86, 0.9, 1.0) * (starField(p, 20.0, seed) + 0.6 * starField(p * 1.8 + 5.0, 20.0, seed + 3.0));
}

// A place for a noise round a circle: the same at 0 and at a full turn.
vec3 onRing(float th, float freq, float seed) { return vec3(cos(th), sin(th), 0.0) * freq + seed; }

vec2 centre() { return (vUv - 0.5) * vec2(u_res.x / u_res.y, 1.0); }
void show(vec3 col) { fragColor = vec4(dither(toSRGB(col), vUv * u_res), 1.0); }
`

/* The Sun's face: q in Sun radii from its centre, brightness against the middle of the disc. */
const SUN = `
vec3 sunFace(vec2 q) {
  float r2 = dot(q, q);
  float mu = sqrt(max(1.0 - r2, 0.0));
  // Limb darkening, a little stronger in blue than in red: the edge is dimmer and warmer.
  vec3 limb = 1.0 - vec3(0.52, 0.66, 0.84) * (1.0 - mu);
  vec3 col = vec3(1.0, 0.82, 0.54) * limb;
  // On the ball, so the mottling and the spots foreshorten toward the edge.
  vec3 n = vec3(q, mu);
  ask3(0, n * 26.0 + u_seed); NP[3] = n * 60.0;
  noises(4);
  col *= 0.965 + 0.07 * got3(0);
  // A few spots in the two belts they keep to. Where is anybody's guess, so it is one.
  float ragged = NV[3] - 0.5;
  for (int i = 0; i < UPTO(4); i++) {
    float fi = float(i);
    float lat = (0.14 + 0.24 * hash11(u_seed + fi * 3.1)) * (hash11(u_seed + fi * 5.3) > 0.5 ? 1.0 : -1.0);
    float lon = (hash11(u_seed + fi * 7.7) - 0.5) * 2.2;
    vec3 c = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
    float size = 0.012 + 0.03 * hash11(u_seed + fi * 9.1);
    float d = length(n - c) + ragged * size * 0.7;
    col *= 1.0 - 0.80 * smoothstep(size * 0.55, size * 0.3, d);   // the umbra
    col *= 1.0 - 0.32 * smoothstep(size * 1.25, size * 0.8, d);   // the penumbra round it
  }
  return col;
}
`

const SOLAR = `

void main() {
  vec2 p = centre();
  float px = 1.0 / u_res.y;
  vec2 q = (p - u_frame.xy) / u_frame.z;
  float pxq = px / u_frame.z;
  float r = length(q);
  vec2 qm = q - u_moon.xy;
  float rm = moonLimb(atan(qm.y, qm.x), u_moon.z);
  float behindMoon = smoothstep(rm + pxq, rm - pxq, length(qm));

  // How much photosphere is left, and where, is worked out once a frame on
  // the page. Here, the light from each of those places spread in the eye
  // and in the air: a tight core and a wide skirt.
  float glare = 0.0;
  for (int i = 0; i < UPTO(${GLINTS}); i++) {
    vec2 d = q - vec2(u_glint[i * 3], u_glint[i * 3 + 1]);
    float dd = dot(d, d);
    glare += u_glint[i * 3 + 2] * (0.9 / (1.0 + dd / 0.0009) + 0.06 / (1.0 + dd / 0.02) + 0.0025 / (1.0 + dd / 0.4));
  }

  // Exposure: held for the photosphere while there is a real piece of it, then
  // opened as far as the corona needs.
  float x = min(1.0, u_open * 3.5);
  float E = 1.0 / (x * x + 2.6e-6);
  float night = clamp(log(E) / log(3.8e5), 0.0, 1.0);

  vec3 L = vec3(0.0);
  // The sky: daylight scaled by what is left of the Sun, and never quite nothing.
  float down = smoothstep(0.5, -0.5, p.y);
  vec3 skyTint = mix(vec3(0.045, 0.10, 0.36), vec3(0.42, 0.26, 0.22), down * down * down * 0.4);
  L += skyTint * 5e-6 * (u_k + 9e-4) * (0.7 + 0.9 * down * down);
  // Stars and a planet or two, only when it is dark enough.
  L += starsAt(p * 1.1, u_seed) * 3.5e-8;

  if (r > 1.0 - pxq * 2.0) {
    // The corona, shaped by the Sun's field: streamers at low latitudes, fine plumes at the poles.
    float th = atan(q.y, q.x);
    float h = r - 1.0;
    // 0 at the Sun's equator, 1 at its poles; which way that is up is the day's guess.
    float lat = abs(sin(th - 0.5 * sin(u_seed * 2.3)));
    // A few broad streamers, mostly at low latitudes, each reaching far out.
    float lean = th + 0.05 * h * sin(th * 3.0 + u_seed);
    NP[0] = onRing(th, 1.7, u_seed * 3.0);
    NP[1] = onRing(lean, 21.0, u_seed + 1.0); NP[2] = onRing(lean, 53.0, u_seed + 5.0); NP[3] = onRing(lean, 131.0, u_seed + 8.0);
    NP[4] = vec3(q * 90.0, u_seed);
    noises(5);
    float streamer = smoothstep(0.40, 0.74, NV[0]) * (1.0 - 0.65 * lat * lat);
    // Fine rays the whole way round, finest at the poles, leaning very slightly as they go.
    float fine = 0.50 * NV[1] + 0.32 * NV[2] + 0.18 * NV[3];
    float reach = mix(1.0, 0.42 + 2.7 * streamer, smoothstep(0.0, 1.1, h));
    float rays = mix(1.0, 0.30 + 1.5 * fine, smoothstep(0.01, 0.5, h) * (0.75 + 0.25 * lat));
    float cor = coronaFall(r) * reach * rays;
    L += vec3(0.93, 0.97, 1.0) * cor * (1.0 - behindMoon) * smoothstep(1.0 - pxq * 2.0, 1.0 + pxq, r);

    // The chromosphere: a thin red-pink skin, and the prominences standing on it.
    float skin = exp(-max(h, 0.0) / 0.006);
    float prom = 0.0;
    float wisp = 0.6 + 0.8 * NV[4];
    for (int i = 0; i < UPTO(5); i++) {
      float fi = float(i);
      float at = hash11(u_seed + 2.0 + fi * 4.3) * TAU;
      float da = atan(sin(th - at), cos(th - at));
      float tall = 0.022 + 0.06 * hash11(u_seed + fi * 6.1);
      float wide = 0.025 + 0.05 * hash11(u_seed + fi * 8.9);
      float up = h / tall;
      // An arch: brightest along a curve that leaves the edge and comes back.
      float arch = exp(-pow((abs(da) / wide - sqrt(max(1.0 - up, 0.0))) * 2.6, 2.0)) * step(0.0, up) * step(up, 1.0);
      float flame = exp(-pow(da / (wide * 0.6), 2.0)) * exp(-up * 2.2) * step(0.0, up);
      prom += arch + flame * 0.7;
    }
    L += vec3(1.0, 0.22, 0.36) * (skin * 2.4e-4 + prom * wisp * 4.5e-5) * (1.0 - behindMoon) * step(1.0, r);
  }

  // The Sun itself, where the Moon is not.
  float inSun = smoothstep(1.0 + pxq, 1.0 - pxq, r);
  if (inSun > 0.0) L = mix(L, sunFace(q) * 1.2, inSun * (1.0 - behindMoon));
  // The Moon's own face: black, but for a breath of earthlight at the very end.
  L = mix(L, vec3(0.5, 0.6, 0.8) * 1.8e-10, behindMoon);

  // Glare from whatever photosphere is showing, over everything.
  L += vec3(1.0, 0.97, 0.92) * glare * 0.055;

  // Bright scene: straight to the film. Dark scene: the eye's compression,
  // which is why the corona can be seen out to three or four radii at all.
  vec3 v = L * E;
  show(aces(mix(v, pow(v, vec3(0.60)) * 1.6, night)));
}
`

const LUNAR = `

void main() {
  vec2 p = centre();
  float px = 1.0 / u_res.y;
  vec2 q = (p - u_frame.xy) / u_frame.z;       // Earth radii from the axis
  float pxq = px / u_frame.z;
  float rho = length(q);
  vec2 dq = (q - u_moon.xy) / u_moon.z;
  float md = length(dq);

  // What the eye is adapted to: the brightest part of the Moon, mostly.
  float level = u_level;
  float E = 1.0 / (level + 2.0e-5);
  float night = clamp(log(E) / log(2.0e4), 0.0, 1.0);

  vec3 L = vec3(0.0);
  // The sky behind: stars, which the full Moon's glare hides and the eclipse lets out.
  L += starsAt(p, u_seed) * 2.4e-5;
  L += vec3(0.05, 0.07, 0.16) * 1.6e-7;
  // The Moon's glow in the air.
  L += mix(vec3(0.66, 0.76, 1.0), vec3(1.0, 0.45, 0.25), night) * level * (0.022 * exp(-max(md - 1.0, 0.0) * 3.2) + 0.004 * exp(-max(md - 1.0, 0.0) * 0.9));

  if (md < 1.0 + pxq * 2.0 / u_moon.z) {
    vec3 m = vec3(dq, sqrt(max(1.0 - md * md, 0.0)));
    vec4 ground = moonAt(m, vec3(0.0, 0.0, 1.0), 0.0);
    vec3 lit = ground.rgb * ground.a * 0.62 * shadowLight(rho);
    L = mix(L, lit, smoothstep(1.0 + pxq / u_moon.z, 1.0 - pxq / u_moon.z, md));
  }

  vec3 v = L * E * 0.9;
  vec3 col = aces(mix(v, pow(v, vec3(0.80)) * 0.40, night));

  // The one diagram on the picture: where the shadow's two edges are. A shadow
  // cannot be seen in empty space, so these are hairlines and nothing more.
  float th = atan(q.y, q.x);
  float dash = step(0.5, fract(th * 28.0 / TAU * 4.0));
  float ringU = smoothstep(pxq * 1.6, 0.0, abs(rho - u_shadow.x));
  float ringP = smoothstep(pxq * 1.6, 0.0, abs(rho - u_shadow.y)) * dash;
  col += vec3(0.62, 0.72, 1.0) * (ringU * 0.13 + ringP * 0.10) * smoothstep(1.0, 1.04, md);
  show(col);
}
`

const MOON_NIGHT = `
void main() {
  vec2 p = centre();
  float px = 1.0 / u_res.y;
  vec2 q = (p - u_frame.xy) / u_frame.z;
  float pxq = px / u_frame.z;
  float md = length(q);
  float thin = 1.0 - u_k;
  vec3 L = starsAt(p, u_seed) * (0.02 + 0.10 * thin * thin);
  // The glow round it, as much as there is Moon to make it.
  float lit = max(u_k, 0.02);
  L += vec3(0.62, 0.74, 1.0) * lit * (0.05 * exp(-max(md - 1.0, 0.0) * 5.0) + 0.012 * exp(-max(md - 1.0, 0.0) * 1.4));
  if (md < 1.0 + pxq * 2.0) {
    vec3 m = vec3(q, sqrt(max(1.0 - md * md, 0.0)));
    vec4 ground = moonAt(m, u_sun, 1.0);
    // Earthshine: the Earth in the Moon's sky is nearly full when the Moon is a sliver.
    vec3 earth = ground.rgb * vec3(0.50, 0.62, 0.92) * (0.0012 + 0.034 * thin * thin * thin * thin) * (0.55 + 0.45 * m.z);
    L = mix(L, ground.rgb * ground.a * 0.62 + earth, smoothstep(1.0 + pxq, 1.0 - pxq, md));
  }
  // A thin Moon is looked at with the eye wide open.
  show(aces(L * (1.0 + 0.9 * thin * thin)));
}
`

const SEASON = `
void main() {
  vec2 p = centre();
  float px = 1.0 / u_res.y;
  vec2 q = (p - u_frame.xy) / u_frame.z;
  float pxq = px / u_frame.z;
  float r2 = dot(q, q);
  float r = sqrt(r2);
  vec3 sun = normalize(u_sun);
  vec3 L = starsAt(p, 2.0) * 0.05;

  // The axis, standing out of both poles.
  float onAxis = smoothstep(pxq * 1.4, 0.0, abs(q.x)) * step(1.0, abs(q.y)) * step(abs(q.y), 1.24) * step(0.5, fract(abs(q.y) * 22.0));
  L += vec3(0.62, 0.72, 1.0) * onAxis * 0.35;

  if (r2 >= 1.0) {
    // The air, edge on: lit on the day side, a thread on the night side.
    vec3 n = normalize(vec3(q, 0.0));
    float day = smoothstep(-0.25, 0.35, dot(n, sun));
    L += vec3(0.28, 0.52, 1.0) * exp(-(r - 1.0) / 0.016) * (0.05 + 0.95 * day) * 0.9;
    show(aces(L));
    return;
  }

  vec3 n = vec3(q, sqrt(1.0 - r2));
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = u_spin + atan(n.x, n.z);
  vec2 uv = vec2(lon / TAU + 0.5, lat / PI + 0.5);
  // The same place on the turning ball, for anything painted on it.
  vec3 m = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
  float sdf = texture(u_land, uv).r;
  float land = smoothstep(0.492, 0.508, sdf);
  float a = abs(lat) * 57.2958;

  // Ground: forest, the two dry belts, cold steppe, ice.
  float dry = smoothstep(11.0, 22.0, a) * (1.0 - smoothstep(31.0, 41.0, a));
  // Weather is pushed about by a slower noise before it is asked for, so
  // there are two batches: everything that depends only on the place, then
  // the clouds.
  vec3 w = m * 4.2 + vec3(0.0, u_t * 0.003, 0.0);
  ask3(0, m * 7.0 + 2.0);            // patches of ground
  ask2(3, m * 30.0);                 // its grain
  ask2(5, w * 1.2 + 4.0); ask2(7, w * 1.2 + 9.0); ask2(9, w * 1.2 + 15.0);
  ask3(11, m * 6.0 + 8.0);           // where people are
  NP[14] = m * 210.0; NP[15] = m * 95.0 + 3.0;
  noises(16);
  float patchy = got3(0);
  vec3 ground = mix(vec3(0.030, 0.074, 0.028), vec3(0.30, 0.245, 0.16), clamp(dry * (0.35 + 1.1 * patchy), 0.0, 1.0));
  ground = mix(ground, vec3(0.16, 0.17, 0.11), smoothstep(48.0, 62.0, a) * 0.7);
  ground *= 0.8 + 0.4 * got2(3);
  float ice = max(smoothstep(63.0, 74.0, a + 8.0 * patchy) * land, smoothstep(72.0, 80.0, a + 6.0 * patchy));
  // Sea: deeper blue away from the shore.
  vec3 sea = mix(vec3(0.02, 0.10, 0.22), vec3(0.008, 0.035, 0.12), smoothstep(0.49, 0.38, sdf));
  vec3 albedo = mix(mix(sea, ground, land), vec3(0.86, 0.90, 0.94), ice);
  vec3 curl = vec3(got2(5), got2(7), got2(9)) - 0.5;
  float settled = smoothstep(0.54, 0.70, got3(11));
  float towns = pow(NV[14], 9.0) * 90.0 + pow(NV[15], 7.0) * 26.0;

  // Weather: bands that follow the latitudes, and swirls in the middle ones.
  ask3(0, w + 2.2 * curl); NP[3] = w * 8.4 + curl;
  ask3(4, m * 26.0 + curl * 3.0);
  noises(7);
  float swirl = got3(0) * 0.86 + 0.07 * NV[3];
  float belt = 0.50 + 0.07 * cos(lat * 6.0) - 0.09 * dry;
  float fineW = got3(4);
  float cloud = smoothstep(belt, belt + 0.17, swirl + 0.10 * (fineW - 0.5) * 2.0);
  cloud *= 0.78 + 0.22 * smoothstep(0.3, 0.7, fineW);

  float d = dot(n, sun);
  float day = smoothstep(-0.10, 0.22, d);
  // Sunlight goes red on the way through the long air at the edge of night.
  vec3 sunCol = mix(vec3(1.0, 0.40, 0.18), vec3(1.0, 0.97, 0.92), smoothstep(-0.04, 0.22, d));
  vec3 surf = albedo * (1.0 - cloud) + vec3(0.92) * cloud;
  vec3 col = surf * sunCol * max(d, 0.0) * 1.25 * day;
  // The Sun on the water.
  vec3 hlf = normalize(sun + vec3(0.0, 0.0, 1.0));
  col += vec3(1.0, 0.93, 0.80) * pow(max(dot(n, hlf), 0.0), 300.0) * (1.0 - land) * (1.0 - cloud) * 0.32 * day;
  // The air over it: bluer and paler toward the edge.
  float haze = pow(1.0 - n.z, 2.6);
  col = mix(col, vec3(0.30, 0.52, 1.0) * (0.25 + 0.85 * day), (0.04 + haze * 0.55) * (0.2 + 0.8 * day));
  // Night: the lights of the places people live, where the land is. Points,
  // gathered where a broader noise says people are.
  float nightSide = 1.0 - smoothstep(-0.16, -0.02, d);
  towns *= settled * land * (1.0 - ice) * (1.0 - dry * 0.7) * smoothstep(66.0, 52.0, a) * (1.0 - cloud * 0.8);
  col += vec3(1.0, 0.76, 0.46) * min(towns, 1.4) * nightSide * 0.36;
  col += albedo * vec3(0.10, 0.14, 0.26) * 0.02 * nightSide;

  // The lines the event is about, drawn on the ball: the equator, the two
  // tropics and the two polar circles.
  float dlat = fwidth(lat) + 1e-5;
  float deg = lat * 57.2958;
  float dashes = step(0.5, fract(lon * 36.0 / TAU));
  float lines = smoothstep(dlat * 85.0, 0.0, abs(deg)) * 0.55;
  lines += (smoothstep(dlat * 85.0, 0.0, abs(abs(deg) - 23.44)) + smoothstep(dlat * 85.0, 0.0, abs(abs(deg) - 66.56))) * dashes * 0.8;
  col += vec3(0.70, 0.80, 1.0) * lines * (0.10 + 0.16 * day) * smoothstep(0.0, 0.25, n.z);

  L = mix(L, col, smoothstep(1.0, 1.0 - pxq * 2.0, r));
  show(aces(L * 1.15));
}
`

const APSIS = `
void main() {
  vec2 p = centre();
  float px = 1.0 / u_res.y;
  vec2 q = (p - u_frame.xy) / u_frame.z;
  float pxq = px / u_frame.z;
  // Left of the seam, the Sun that day. Right of it, the Sun half a year on, on the same scale.
  float size = q.x < 0.0 ? 1.0 : u_k;
  vec2 s = q / size;
  float r = length(s);
  float inSun = smoothstep(1.0 + pxq / size, 1.0 - pxq / size, r);
  vec3 L = sunFace(s) * 1.2 * inSun;
  // A little light spilled past the edge, as any lens would.
  L += vec3(1.0, 0.80, 0.52) * exp(-max(r - 1.0, 0.0) / 0.035) * 0.16 * (1.0 - inSun);
  L += vec3(1.0, 0.74, 0.44) * exp(-max(r - 1.0, 0.0) / 0.5) * 0.018;
  // The seam.
  L *= smoothstep(pxq * 0.6, pxq * 2.2, abs(q.x));
  show(aces(L));
}
`

const TURN = SHOWER_TURN.toFixed(2)
const SHOWER = `
void main() {
  vec2 p = centre();
  float px = 1.0 / u_res.y;
  vec3 L = vec3(0.0);
  vec2 radiant = u_rain.xy;
  float aspect = u_res.x / u_res.y;
  float speed = mix(0.55, 1.25, u_rain.w);
  for (int i = 0; i < UPTO(${SHOWER_SLOTS}); i++) {
    float fi = float(i);
    float turn = (u_t + hash11(fi * 3.7 + 1.0) * ${TURN}) / ${TURN};
    float ph = fract(turn) * ${TURN};       // seconds into this turn
    // The loop is sixteen turns long and then the same again, so its ends join.
    float key = fi * 17.0 + mod(floor(turn), 16.0) * 3.1 + u_seed;
    float there = step(hash11(key), u_rain.z);
    // Somewhere in the sky, and a path straight away from the radiant.
    vec2 a = vec2((hash11(key + 1.0) - 0.5) * aspect, hash11(key + 2.0) * 0.86 - 0.36);
    vec2 dir = a - radiant;
    float far = length(dir);
    dir /= max(far, 1e-3);
    // Foreshortened: a point at the radiant, long a long way from it.
    float len = (0.05 + 0.26 * hash11(key + 3.0)) * min(far * 2.2, 1.0) + 0.012;
    float life = (0.32 + 0.5 * hash11(key + 4.0)) / speed;
    float tt = ph / life;
    float head = min(tt, 1.0);
    vec2 b = a + dir * len * head;
    // Distance from this pixel to the lit part of the path.
    vec2 pa = p - a;
    float along = clamp(dot(pa, dir), 0.0, len * head);
    float off = length(pa - dir * along);
    float back = (len * head - along) / max(len, 1e-3);      // 0 at the head
    float bright = pow(hash11(key + 5.0), 2.0) * 1.6 + 0.25;
    float width = px * (0.9 + 0.9 * bright);
    // The meteor itself: brightens as the air thickens, then goes out.
    float burn = smoothstep(0.0, 0.25, tt) * (1.0 - smoothstep(0.85, 1.0, tt));
    float trail = exp(-pow(off / width, 2.0)) * exp(-back * 5.5) * burn;
    float glow = exp(-length(p - b) / (px * 6.0)) * burn * 0.5;
    // The train it leaves: the whole path, fading for a second after.
    float train = exp(-pow(off / (width * 1.6), 2.0)) * (1.0 - smoothstep(0.9, 2.2, tt)) * step(1.0, tt) * 0.22 * bright;
    vec3 tint = mix(vec3(0.70, 1.0, 0.86), vec3(1.0, 0.95, 0.86), smoothstep(0.0, 0.5, back) * (0.4 + 0.6 * hash11(key + 6.0)));
    L += there * ((tint * trail + vec3(1.0) * glow) * bright + vec3(0.55, 1.0, 0.75) * train);
  }
  // The ground: a dark line of hills, and the paler air just above it.
  float hill = -0.405 + 0.018 * noise(vec2(p.x * 3.1, 2.0)) + 0.008 * noise(vec2(p.x * 11.0, 7.0)) + 0.004 * noise(vec2(p.x * 40.0, 3.0));
  float ground = smoothstep(hill + px, hill - px, p.y);
  L += vec3(0.20, 0.30, 0.42) * exp(-max(p.y - hill, 0.0) / 0.10) * 0.10;
  // Light over the page's own sky, which shows through; the ground hides both.
  fragColor = vec4(mix(min(L, vec3(1.0)), vec3(0.010, 0.014, 0.024), ground), ground);
}
`

/** The fragment shader for each scene. */
export const FORECAST_STAGE: Record<StageScene, string> = {
  solar: glsl(HEAD + SUN + LIMB_GLSL + CORONA_GLSL + SOLAR),
  lunar: glsl(HEAD + MOON_GLSL + SHADOW_GLSL + LUNAR),
  moon: glsl(HEAD + MOON_GLSL + MOON_NIGHT),
  season: glsl(HEAD + SEASON),
  apsis: glsl(HEAD + SUN + APSIS),
  shower: glsl(HEAD + SHOWER),
}

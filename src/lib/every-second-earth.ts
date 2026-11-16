/**
 * The Earth under Every Second, Somewhere.
 *
 * The page used to draw its events on flat grey countries. This is the same
 * map (plain latitude and longitude, so the real borders laid over it still
 * fit) as the planet looks at the instant on the page's clock: daylight where
 * the Sun is up, the edge of night where it really is for that date and
 * hour, and lights on the dark side where the forty countries' people are.
 * Run the clock at a day a minute and the night goes round once a minute.
 *
 * A birth or a death is a point of light that opens into a ring and fades:
 * mint for a birth, blue-violet for a death. The page hands over the last
 * few dozen, each with where and when.
 *
 * The coastline is the distance field Deep Time's globe reads
 * (public/deep-time/land.webp), which is in the same projection.
 */
import { glsl } from './gl'
import { EARTH_LAT } from './population-map'

export const EARTH_EVENTS = 40
export const EARTH_PLACES = 40

export const EVERY_SECOND_FRAG = glsl(`
#define EVENTS ${EARTH_EVENTS}
#define PLACES ${EARTH_PLACES}
#define LAT_S ${EARTH_LAT.south}.0
#define LAT_N ${EARTH_LAT.north}.0

uniform sampler2D u_land;
uniform vec2  u_sun;                 // where the Sun is overhead: longitude, latitude, radians
uniform float u_now;                 // the page's clock, seconds
uniform float u_drift;               // how far the weather has moved, in turns of the globe
uniform float u_events[EVENTS * 4];  // longitude, latitude (degrees), when, kind (1 birth, 2 death; 0 none)
uniform float u_places[PLACES * 3];  // longitude, latitude (degrees), how many people (0..1)

vec3 dirOf(float lon, float lat) { return vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)); }

void main() {
  float lonD = (vUv.x - 0.5) * 360.0;
  float latD = mix(LAT_S, LAT_N, vUv.y);
  float lon = radians(lonD), lat = radians(latD);
  vec2 deg = vec2(lonD, latD);
  // One degree is this many pixels: marks keep their size on the screen, not on the map.
  // On a phone the map is drawn taller than it is wide for its degrees, so the two are measured apart.
  vec2 pxPerDeg = u_res / vec2(360.0, LAT_N - LAT_S);

  float field = texture(u_land, vec2(vUv.x, latD / 180.0 + 0.5)).r;
  float land = smoothstep(0.492, 0.508, field);
  float coast = 1.0 - smoothstep(0.0, 0.035, abs(field - 0.5));

  vec3 n = dirOf(lon, lat);
  vec3 s = dirOf(u_sun.x, u_sun.y);
  float sunUp = dot(n, s);
  float day = smoothstep(-0.10, 0.10, sunUp);

  /* ---- the ground ---- */
  float a = abs(latD);
  float rough = fbm(deg * 0.22 + 7.0, 4);
  float fine = fbm(deg * 1.1 + 31.0, 3);
  float dry = smoothstep(11.0, 22.0, a) * (1.0 - smoothstep(30.0, 40.0, a)) * smoothstep(0.38, 0.62, rough);
  vec3 forest = mix(vec3(0.045, 0.16, 0.07), vec3(0.11, 0.24, 0.10), fine);
  vec3 sand = mix(vec3(0.46, 0.38, 0.24), vec3(0.58, 0.50, 0.34), fine);
  vec3 ground = mix(forest, sand, dry);
  ground = mix(ground, vec3(0.20, 0.25, 0.17), smoothstep(46.0, 60.0, latD));       // the northern forests and tundra
  ground = mix(ground, vec3(0.36, 0.34, 0.28), smoothstep(0.58, 0.8, rough) * 0.5);  // high, bare ground
  float ice = max(smoothstep(76.0, 83.0, latD + rough * 5.0), smoothstep(-62.0, -70.0, latD));
  ice = max(ice, land * smoothstep(70.0, 78.0, latD + rough * 8.0));
  ice = max(ice, land * smoothstep(58.0, 72.0, latD + rough * 16.0) * step(-75.0, lonD) * step(lonD, -15.0)); // Greenland

  /* ---- the sea ---- */
  float shelf = smoothstep(0.30, 0.50, field);
  vec3 sea = mix(vec3(0.010, 0.040, 0.13), vec3(0.020, 0.10, 0.25), shelf);
  sea += vec3(0.0, 0.03, 0.05) * smoothstep(0.44, 0.5, field);

  vec3 surface = mix(sea, ground, land);
  surface = mix(surface, vec3(0.88, 0.91, 0.96), ice);

  /* ---- weather ---- */
  vec2 w = vec2(deg.x + u_drift * 360.0, deg.y);
  float cl = fbm(vec2(w.x * 0.06, w.y * 0.085) + fbm(w * 0.02 + 3.0, 3) * 1.8, 5);
  float cloud = smoothstep(0.50, 0.72, cl) * (0.35 + 0.65 * smoothstep(8.0, 30.0, a)) * 0.78;

  vec3 lit = surface * (0.30 + 0.95 * max(sunUp, 0.0));
  lit = mix(lit, vec3(0.95, 0.97, 1.0) * (0.45 + 0.6 * max(sunUp, 0.0)), cloud);
  // Sunrise and sunset: a thin warm band along the edge of night.
  lit += vec3(0.30, 0.12, 0.05) * exp(-pow(sunUp / 0.06, 2.0)) * 0.35 * (0.12 + 0.88 * land);

  /* ---- the night ---- */
  vec3 night = surface * 0.045 + vec3(0.004, 0.007, 0.018);
  night += vec3(0.05, 0.09, 0.16) * coast * 0.10;
  night = mix(night, vec3(0.016, 0.022, 0.04), cloud * 0.5);
  // Lights where the people are: brightest round the forty countries the page follows, a scatter elsewhere.
  float people = 0.0;
  for (int k = 0; k < PLACES; k++) {
    vec3 pl = vec3(u_places[k * 3], u_places[k * 3 + 1], u_places[k * 3 + 2]);
    if (pl.z <= 0.0) continue;
    vec2 dd = deg - pl.xy;
    dd.x = (dd.x - 360.0 * floor(dd.x / 360.0 + 0.5)) * cos(lat);
    float spread = 3.0 + 9.0 * sqrt(pl.z);
    people += (0.35 + 0.65 * sqrt(pl.z)) * exp(-dot(dd, dd) / (spread * spread));
  }
  people = min(people, 1.0);
  float settled = (1.0 - smoothstep(52.0, 66.0, a)) * (1.0 - dry * 0.6) * (1.0 - ice);
  float grain = step(0.86 - 0.42 * people, hash21(floor(gl_FragCoord.xy / max(1.0, floor(u_dpr)))));
  float glow = fbm(deg * 0.9 + 60.0, 3);
  float lamps = land * settled * (people * (0.25 + 0.9 * grain) + 0.05 * grain * smoothstep(0.5, 0.7, glow));
  night += vec3(1.0, 0.80, 0.52) * lamps * (1.0 - cloud * 0.7) * 0.85;

  vec3 col = mix(night, lit, day);

  /* ---- births and deaths ---- */
  for (int k = 0; k < EVENTS; k++) {
    vec4 e = vec4(u_events[k * 4], u_events[k * 4 + 1], u_events[k * 4 + 2], u_events[k * 4 + 3]);
    if (e.w < 0.5) continue;
    float age = u_now - e.z;
    if (age < 0.0 || age > 1.6) continue;
    vec2 dd = deg - e.xy;
    dd.x -= 360.0 * floor(dd.x / 360.0 + 0.5);
    float dpx = length(dd * pxPerDeg) / u_dpr;   // distance in CSS pixels, so a ring is the same size on any screen
    float t = age / 1.6;
    float fade = (1.0 - t) * (1.0 - t);
    float size = clamp(u_res.x / u_dpr / 1100.0, 0.42, 1.0);
    float core = exp(-dpx * dpx / (9.0 * size)) * fade * 1.1;
    // All of it smaller on a small map, or three rings cover a continent on a phone.
    float radius = (4.0 + 30.0 * (1.0 - (1.0 - t) * (1.0 - t))) * size;
    float ring = exp(-pow((dpx - radius) / 1.6, 2.0)) * fade;
    float halo = exp(-dpx / (12.0 * size)) * fade * 0.22;
    vec3 tint = e.w < 1.5 ? vec3(0.31, 0.89, 0.76) : vec3(0.56, 0.60, 1.0);
    col += tint * (ring * 0.9 + halo) + mix(tint, vec3(1.0), 0.7) * core;
  }

  // The frame of the map falls away a little at its edges.
  vec2 edge = min(vUv, 1.0 - vUv);
  col *= 0.86 + 0.14 * smoothstep(0.0, 0.05, min(edge.x, edge.y * 2.0));

  col = toSRGB(clamp(col, 0.0, 1.0));
  col = dither(col, gl_FragCoord.xy);
  fragColor = vec4(col, 1.0);
}
`)

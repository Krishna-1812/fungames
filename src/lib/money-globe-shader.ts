/**
 * The globe Printing Money draws its strip of dollar bills on (the arithmetic,
 * the path and the camera, are lib/money-globe.ts). Its own file because the
 * shader helper cannot be read by the node checks, and the arithmetic must be.
 */
import { glsl } from './gl'

/* -------------------------------------------------------------------------- */
/* The shader                                                                   */
/* -------------------------------------------------------------------------- */

export const MONEY_GLOBE_FRAG = glsl(`
uniform sampler2D u_world;   // red: land; green: city lights
uniform vec3  u_cam;         // the view's middle (latitude, longitude, radians) and the globe's size
uniform vec3  u_sun;         // which way the Sun is, as a direction from the Earth's centre
uniform vec3  u_start;       // where the strip starts
uniform vec3  u_heading;     // which way it goes
uniform float u_s;           // how far it has gone, in radians of the Earth (past two pi: laps)
uniform float u_ready;       // 0 until the world's picture has loaded

#define UPTO(n) ((n) + int(min(u_time, 0.0)))

vec3 dirOf(float lat, float lon) { return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }

// Weather: large systems pushed about by a slower field, then fine detail, so
// a close view has edges and a far one has shapes. Invented, all of it.
float clouds(vec3 p, float detail) {
  vec3 q = p * 2.6 + vec3(0.0, 0.0, u_time * 0.003);
  vec3 warp = vec3(noise3(q * 0.9 + 4.0), noise3(q * 0.9 + 9.0), noise3(q * 0.9 + 15.0)) - 0.5;
  q += warp * 1.6;
  float v = 0.0, a = 0.5;
  for (int i = 0; i < UPTO(7); i++) {
    // Octaves finer than a pixel are left out: they would only shimmer.
    if (float(i) > detail) break;
    v += a * noise3(q);
    q = q.yzx * 2.11 + vec3(17.1, 3.7, 9.3);
    a *= 0.52;
  }
  return v;
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 q = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);
  float px = 2.0 / u_res.y;
  float lat0 = u_cam.x, lon0 = u_cam.y, scale = u_cam.z;
  vec3 F = dirOf(lat0, lon0);
  vec3 E = vec3(cos(lon0), 0.0, -sin(lon0));
  vec3 N = cross(F, E);
  vec2 g = q / scale;
  float r = length(g);
  float edge = px / scale;

  // Space: a few stars, and the air glowing round the limb on the day side.
  vec3 col = vec3(0.003, 0.005, 0.012);
  vec2 cell = floor(q * 140.0);
  float star = step(0.995, hash21(cell)) * smoothstep(0.5, 0.0, length(fract(q * 140.0) - 0.5));
  col += vec3(0.75, 0.82, 1.0) * star * (0.3 + 0.7 * hash21(cell + 3.1)) * 0.6;

  vec3 sun = normalize(u_sun);
  if (r > 1.0) {
    vec3 dirOut = normalize(g.x * E + g.y * N);
    float lit = smoothstep(-0.3, 0.4, dot(dirOut, sun));
    float h = r - 1.0;
    col += vec3(0.30, 0.55, 1.0) * exp(-h * scale / 0.022) * (0.08 + 0.9 * lit) * 0.9;
    fragColor = vec4(toSRGB(aces(col)), 1.0);
    return;
  }

  float z = sqrt(1.0 - r * r);
  vec3 P = g.x * E + g.y * N + z * F;
  float lat = asin(clamp(P.y, -1.0, 1.0));
  float lon = atan(P.x, P.z);
  vec4 map = texture(u_world, vec2(lon / TAU + 0.5, lat / PI + 0.5));
  float land = smoothstep(0.35, 0.65, map.r) * u_ready;
  float lights = map.g * u_ready;
  float a = abs(lat) * 57.2958;

  // The ground: forest, the dry belts, tundra, ice. A broad guess by latitude.
  float n1 = noise3(P * 9.0 + 2.0), n2 = noise3(P * 37.0 + 7.0);
  float dry = smoothstep(12.0, 22.0, a) * (1.0 - smoothstep(32.0, 42.0, a));
  vec3 ground = mix(vec3(0.05, 0.12, 0.05), vec3(0.42, 0.34, 0.22), clamp(dry * (0.4 + 1.1 * n1), 0.0, 1.0));
  ground = mix(ground, vec3(0.18, 0.18, 0.13), smoothstep(50.0, 64.0, a) * 0.7);
  ground *= 0.82 + 0.36 * n2;
  float ice = max(smoothstep(64.0, 74.0, a + 8.0 * n1) * land, smoothstep(72.0, 80.0, a + 5.0 * n1));
  vec3 sea = vec3(0.012, 0.06, 0.16);
  vec3 albedo = mix(mix(sea, ground, land), vec3(0.86, 0.90, 0.95), ice);
  // How many octaves the picture can hold at this size: about one more each time the globe doubles.
  float detail = 3.0 + log2(max(scale, 1.0)) * 1.4 + 1.0;
  float belt = 0.55 - 0.06 * cos(lat * 6.0) + 0.06 * dry;
  float cl = smoothstep(belt, belt + 0.12, clouds(P, detail));

  float d = dot(P, sun);
  float day = smoothstep(-0.08, 0.2, d);
  vec3 sunCol = mix(vec3(1.0, 0.45, 0.22), vec3(1.0, 0.97, 0.92), smoothstep(-0.04, 0.25, d));
  vec3 surf = mix(albedo, vec3(0.92), cl * 0.85);
  vec3 c = surf * sunCol * max(d, 0.0) * 1.3 * day;
  // The Sun on the water.
  vec3 hv = normalize(sun + F);
  c += vec3(1.0, 0.94, 0.82) * pow(max(dot(P, hv), 0.0), 220.0) * (1.0 - land) * (1.0 - cl) * 0.5 * day;
  // Air, thicker toward the edge of the disc.
  c = mix(c, vec3(0.30, 0.52, 1.0) * (0.15 + 0.85 * day), (0.05 + pow(1.0 - z, 2.4) * 0.6) * (0.25 + 0.75 * day));
  // Night: the cities.
  float night = 1.0 - smoothstep(-0.12, 0.02, d);
  c += vec3(1.0, 0.72, 0.40) * lights * night * (1.0 - cl * 0.75) * 1.1;
  c += albedo * vec3(0.04, 0.06, 0.12) * night * 0.4;

  /* ---- the strip ----
     Where a point is against the strip's line: how far off the line (the
     strip is drawn a few pixels wide, being 6.6 cm), and how far along it
     from the Capitol. Laps past the first cover the whole circle. */
  vec3 axis = normalize(cross(u_start, u_heading));
  float off = asin(clamp(dot(P, axis), -1.0, 1.0));
  float ang = atan(dot(P, u_heading), dot(P, u_start));
  if (ang < 0.0) ang += TAU;
  float laps = floor(u_s / TAU);
  float reach = u_s - laps * TAU;
  float on = laps > 0.0 ? 1.0 : step(ang, reach);
  float w = edge * 1.6;
  float line = exp(-pow(off / w, 2.0)) * on;
  float glow = exp(-abs(off) / (edge * 7.0)) * on * 0.35;
  // The paper of a dollar bill, lit by whatever lights the ground under it, and a little by itself so it shows at night.
  vec3 bill = vec3(0.80, 0.88, 0.72);
  c = mix(c, bill * (0.35 + 0.9 * day), clamp(line, 0.0, 1.0));
  c += vec3(0.55, 0.95, 0.65) * glow * (0.5 + 0.5 * night);
  // The end of it, still being laid.
  vec3 head = cos(u_s) * u_start + sin(u_s) * u_heading;
  float dh = acos(clamp(dot(P, head), -1.0, 1.0));
  c += vec3(0.85, 1.0, 0.9) * (exp(-pow(dh / (edge * 2.2), 2.0)) * 1.4 + exp(-dh / (edge * 14.0)) * 0.35);

  col = mix(col, c, smoothstep(1.0, 1.0 - edge * 1.5, r));
  fragColor = vec4(dither(toSRGB(aces(col * 1.1)), vUv * u_res), 1.0);
}
`)

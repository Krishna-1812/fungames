/**
 * The Earth in Progress's 24-hour dial.
 *
 * Seen from over the north pole, with the Sun fixed at the top of the dial:
 * so the lit half is the top half, the Earth turns anticlockwise beneath it
 * once a day, and wherever you are passes 12 at your noon and 24 at your
 * midnight. The edge of the night tilts through the year, which is the
 * seasons: in June the pole is in the light all day, in December it is not.
 *
 * The coastline is the real one, the same distance field Deep Time's globe
 * reads (public/deep-time/land.webp). The projection is equidistant from the
 * pole and stops at 60 degrees south, so Antarctica is the rim.
 */
import { glsl } from './gl'

export const EARTH_DISC_FRAG = glsl(`
uniform sampler2D u_land;
uniform vec2 u_sun;   // where the Sun is overhead: longitude east, latitude north, in radians
uniform float u_here; // longitude of the mark for "about where you are", radians; 9 for none


void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float aa = 2.5 / u_res.x;
  float disc = 1.0 - smoothstep(1.0 - aa * 2.0, 1.0, r);
  if (disc <= 0.0) { fragColor = vec4(0.0); return; }

  // Clockwise from the top, as the dial is read. East is anticlockwise from over the north pole.
  float cw = atan(p.x, p.y);
  float lat = PI * 0.5 - r * (150.0 * PI / 180.0);
  float lon = u_sun.x - cw;
  vec2 uv = vec2(fract(lon / (2.0 * PI) + 0.5), clamp(lat / PI + 0.5, 0.0, 1.0));
  float land = smoothstep(0.485, 0.515, texture(u_land, uv).r);

  vec3 n = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
  vec3 s = vec3(cos(u_sun.y) * cos(u_sun.x), cos(u_sun.y) * sin(u_sun.x), sin(u_sun.y));
  float day = smoothstep(-0.10, 0.12, dot(n, s));

  float latDeg = lat * 180.0 / PI;
  vec3 sea = mix(vec3(0.020, 0.085, 0.24), vec3(0.035, 0.16, 0.36), smoothstep(-60.0, 60.0, latDeg));
  float dry = smoothstep(12.0, 24.0, abs(latDeg)) * (1.0 - smoothstep(30.0, 42.0, abs(latDeg)));
  vec3 ground = mix(vec3(0.10, 0.27, 0.13), vec3(0.42, 0.36, 0.22), dry * 0.75);
  ground = mix(ground, vec3(0.16, 0.24, 0.16), smoothstep(48.0, 62.0, latDeg));
  float ice = max(smoothstep(66.0, 74.0, latDeg) * mix(0.75, 1.0, land), smoothstep(-58.0, -66.0, latDeg));
  vec3 col = mix(sea, ground, land);
  col = mix(col, vec3(0.86, 0.90, 0.96), ice);

  // Night keeps a little of itself, so the continents can still be found.
  vec3 night = col * 0.10 + vec3(0.004, 0.006, 0.02);
  col = mix(night, col * (0.55 + 0.6 * max(dot(n, s), 0.0)), day);

  // A soft limb, as if the disc were the top of a ball.
  col *= 1.0 - 0.45 * smoothstep(0.55, 1.0, r);

  // About where you are: a small bright mark that rides round with the Earth.
  if (u_here < 8.0) {
    float hcw = u_sun.x - u_here;
    vec2 hp = vec2(sin(hcw), cos(hcw)) * 0.5;
    float m = 1.0 - smoothstep(0.045, 0.045 + aa * 2.0, length(p - hp));
    float ring = m * smoothstep(0.022, 0.022 + aa * 2.0, length(p - hp));
    col = mix(col, vec3(1.0), ring);
  }

  col = toSRGB(clamp(col, 0.0, 1.0));
  fragColor = vec4(col * disc, disc);
}
`)

/**
 * How Fast Are You Moving?'s picture.
 *
 * The page used to put a small cartoon in a card above each speed. This is
 * one picture behind the whole page that pulls back a step for each speed,
 * because that is what the page is: the same you, seen from further and
 * further away, and moving in each view.
 *
 *   0  the ground      the Earth from low orbit, and a plate boundary on it.
 *                      Nothing moves, because at 2.3 cm a year nothing would.
 *   1  the day         the whole Earth, turning, on its real coastline
 *   2  the year        the Sun, the inner planets' paths, the Earth going round
 *   3  the drift       the Sun and its planets sliding through the nearby stars
 *   4  the galaxy      the Milky Way from above, turning, the Sun marked on it
 *   5  the fall        the Milky Way and Andromeda, closing
 *   6  the afterglow   the whole sky in microwaves, hotter on the side we are
 *                      heading toward, as it is measured to be
 *   7  the edge        galaxies leaving, faster the further off, reddening
 *
 * \`u_scene\` runs 0..7 with the scroll and the two nearest views cross-fade.
 * The small drawings stay in the page for anything without WebGL2.
 */
import { glsl } from './gl'

export const SPEED_SCENES = 8

export const SPEED_SCENES_FRAG = glsl(`
uniform sampler2D u_land;
uniform float u_scene;  // 0..7, which view, and how far into the next
uniform vec2  u_off;    // where the picture's middle is, from the window's, in window heights


float stars(vec2 p, float density, float seed) {
  vec2 g = p * density;
  vec2 id = floor(g);
  float h = hash21(id + seed);
  vec2 c = 0.2 + 0.6 * vec2(hash21(id + seed + 1.3), hash21(id + seed + 2.9));
  return smoothstep(0.06, 0.0, length(fract(g) - c)) * step(0.78, h) * (0.2 + 0.8 * hash21(id + seed + 5.0));
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// The Earth: a lit ball on the real coastline. Returns colour and how much of the pixel it covers.
vec4 globe(vec2 p, vec2 centre, float R, float spin, float tilt) {
  vec2 q = (p - centre) / R;
  float r2 = dot(q, q);
  float px = 1.5 / (R * u_res.y);
  if (r2 > 1.0 + 0.14) return vec4(0.0);
  vec3 sun = normalize(vec3(-0.62, 0.30, 0.72));
  // The air, seen edge on, just outside the ball.
  float rim = exp(-(sqrt(r2) - 1.0) / 0.035) * step(1.0, r2);
  if (r2 >= 1.0) return vec4(vec3(0.30, 0.56, 1.0) * rim * max(dot(normalize(vec3(q, 0.3)), sun) + 0.35, 0.0), rim * 0.9);
  vec3 n = vec3(q, sqrt(1.0 - r2));
  vec3 m = n;
  m.yz = rot(tilt) * m.yz;
  m.xz = rot(spin) * m.xz;
  float lat = asin(clamp(m.y, -1.0, 1.0));
  float lon = atan(m.x, m.z);
  vec2 uv = vec2(lon / TAU + 0.5, lat / 3.14159265 + 0.5);
  float land = smoothstep(0.49, 0.51, texture(u_land, uv).r);
  float a = abs(lat) * 57.2958;
  float dry = smoothstep(12.0, 23.0, a) * (1.0 - smoothstep(30.0, 40.0, a));
  vec3 ground = mix(vec3(0.06, 0.14, 0.07), vec3(0.40, 0.33, 0.22), dry * (0.4 + 0.6 * fbm(uv * vec2(60.0, 30.0), 3)));
  float ice = max(smoothstep(66.0, 76.0, a) * land, smoothstep(78.0, 84.0, a));
  vec3 sea = vec3(0.015, 0.07, 0.20);
  vec3 col = mix(mix(sea, ground, land), vec3(0.9), ice);
  float cloud = smoothstep(0.52, 0.74, fbm(uv * vec2(14.0, 9.0) + vec2(spin * 0.02, 0.0) + fbm(uv * 5.0, 3), 4));
  col = mix(col, vec3(0.95), cloud * 0.8);
  float d = dot(n, sun);
  float day = smoothstep(-0.12, 0.2, d);
  col = col * (0.03 + 1.05 * max(d, 0.0)) * day + col * 0.03;
  // The Sun on the water.
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-sun, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0) * (1.0 - land) * (1.0 - cloud) * 0.5 * day;
  col += vec3(0.20, 0.42, 0.95) * pow(1.0 - n.z, 3.0) * (0.25 + 0.75 * day) * 0.8;
  return vec4(col, 1.0 - smoothstep(1.0 - px * 2.0, 1.0, sqrt(r2)));
}

// A star seen as a disc, with the glow round it.
vec3 sunDisc(vec2 p, float R) {
  float r = length(p);
  float body = 1.0 - smoothstep(R * 0.96, R, r);
  float grain = 0.86 + 0.14 * fbm(p / R * 5.0 + u_time * 0.05, 3);
  vec3 c = vec3(1.0, 0.86, 0.55) * body * grain * 1.5;
  c += vec3(1.0, 0.72, 0.36) * exp(-(r - R) / (R * 0.9)) * step(R * 0.96, r) * 0.55;
  c += vec3(1.0, 0.80, 0.55) * exp(-r / (R * 5.0)) * 0.10;
  return c;
}

// A spiral galaxy, seen from above and then tipped. Brightness and a colour for it.
vec3 galaxy(vec2 p, float size, float turn, float tip, float arms) {
  vec2 q = rot(tip * 0.6) * p;
  q.y /= max(cos(tip), 0.15);
  q /= size;
  float r = length(q);
  if (r > 1.6) return vec3(0.0);
  float th = atan(q.y, q.x) + turn;
  float wind = th * arms - log(r + 0.03) * arms * 2.1;
  float arm = pow(0.5 + 0.5 * cos(wind), 2.2);
  float dust = fbm(q * 7.0 + turn * 0.3, 4);
  float disc = exp(-r * 3.1);
  float bulge = exp(-r * 13.0);
  float knots = pow(fbm(q * 22.0 + 3.0, 3), 3.0) * arm * 3.0;
  vec3 c = vec3(0.55, 0.66, 1.0) * disc * (0.25 + 1.5 * arm) * (0.55 + 0.9 * dust);
  c += vec3(0.75, 0.86, 1.0) * knots * disc * 2.0;
  c += vec3(1.0, 0.88, 0.70) * bulge * 2.4;
  // Dark lanes along the inside of each arm.
  c *= 1.0 - 0.45 * pow(0.5 + 0.5 * cos(wind + 1.1), 6.0) * smoothstep(0.05, 0.3, r);
  return c * smoothstep(1.6, 0.9, r);
}

float ring(vec2 p, float R, float w) { return exp(-pow((length(p) - R) / w, 2.0)); }

vec3 view(int id, vec2 p, float t) {
  float bg = stars(p, 26.0, 1.0) + stars(p * 1.7 + 4.0, 26.0, 9.0) * 0.6;
  vec3 col = vec3(0.004, 0.006, 0.014) + vec3(0.82, 0.88, 1.0) * bg * 0.75;

  if (id == 0) {
    // Low orbit: the Earth fills the foot of the window. A plate boundary, marked; nothing visibly moving.
    vec2 c = vec2(0.0, -1.52);
    vec4 g = globe(p, c, 1.36, 0.55, 0.42);
    col = mix(col, g.rgb, g.a);
    vec2 q = (p - c) / 1.36;
    if (dot(q, q) < 1.0) {
      float seam = abs(q.x + 0.06 * sin(q.y * 34.0) + 0.03 * sin(q.y * 81.0 + 1.0) - 0.04);
      float pulse = 0.6 + 0.4 * sin(t * 1.6);
      col += vec3(0.31, 0.89, 0.76) * (exp(-seam * 900.0) * 0.9 + exp(-seam * 120.0) * 0.18) * pulse * smoothstep(0.80, 0.96, q.y);
    }
  } else if (id == 1) {
    vec4 g = globe(p, vec2(0.0), 0.33, t * 0.16, 0.41);
    col = mix(col, g.rgb, g.a);
  } else if (id == 2) {
    // The inner system, tipped: the Earth's path and the Earth on it.
    vec2 q = vec2(p.x, p.y / 0.42);
    col += vec3(0.5, 0.6, 0.9) * (ring(q, 0.115, 0.0016) + ring(q, 0.215, 0.0016) + ring(q, 0.46, 0.0016)) * 0.16;
    col += vec3(0.31, 0.89, 0.76) * ring(q, 0.30, 0.0022) * 0.55;
    float a = t * 0.35;
    vec2 e = vec2(cos(a), sin(a)) * 0.30;
    // The way it has come, fading behind it.
    float ang = mod(a - atan(q.y, q.x), TAU);
    col += vec3(0.31, 0.89, 0.76) * ring(q, 0.30, 0.004) * exp(-ang * 1.6) * 0.9;
    vec2 ep = vec2(e.x, e.y * 0.42);
    float behind = step(e.y, 0.0);
    col += sunDisc(p, 0.052) * (1.0 - 0.0);
    float ed = length(p - ep);
    vec3 earth = vec3(0.25, 0.55, 1.0) * (1.0 - smoothstep(0.009, 0.012, ed)) * 1.4 + vec3(0.3, 0.6, 1.0) * exp(-ed / 0.02) * 0.35;
    col += earth * mix(1.0, 1.0 - smoothstep(0.05, 0.045, length(ep)), 1.0 - behind);
    for (int k = 0; k < 3; k++) {
      float R = k == 0 ? 0.115 : k == 1 ? 0.215 : 0.46;
      float w = t * (k == 0 ? 1.45 : k == 1 ? 0.57 : 0.186) + float(k) * 2.1;
      vec2 pp = vec2(cos(w), sin(w) * 0.42) * R;
      col += vec3(0.8, 0.78, 0.72) * (1.0 - smoothstep(0.004, 0.006, length(p - pp))) * 0.9;
    }
  } else if (id == 3) {
    // The Sun and its planets, going one way; the nearby stars, therefore, going the other.
    for (int k = 0; k < 3; k++) {
      float z = 1.0 + float(k) * 0.8;
      vec2 sp = vec2(p.x + t * 0.05 / z, p.y) * (9.0 + 5.0 * float(k));
      vec2 id2 = floor(sp);
      float h = hash21(id2 + 40.0 * float(k));
      vec2 f = fract(sp) - vec2(0.5, 0.2 + 0.6 * hash21(id2 + 3.0));
      float streak = exp(-pow(f.y * 34.0, 2.0)) * smoothstep(0.30, 0.0, abs(f.x)) * step(0.90, h);
      col += vec3(0.8, 0.88, 1.0) * streak * 0.42 / z;
    }
    vec2 q = vec2(p.x + 0.12, p.y / 0.34);
    col += vec3(0.5, 0.6, 0.9) * (ring(q, 0.07, 0.0016) + ring(q, 0.12, 0.0016) + ring(q, 0.19, 0.0016) + ring(q, 0.27, 0.0016)) * 0.22;
    col += sunDisc(p + vec2(0.12, 0.0), 0.034);
    // Where it is headed: near Vega.
    vec2 v = p - vec2(0.36, 0.11);
    col += vec3(0.75, 0.86, 1.0) * (exp(-length(v) / 0.008) * 1.6 + exp(-abs(v.x) / 0.002) * exp(-abs(v.y) / 0.03) * 0.5 + exp(-abs(v.y) / 0.002) * exp(-abs(v.x) / 0.03) * 0.5);
  } else if (id == 4) {
    col += galaxy(p, 0.40, -t * 0.03, 0.35, 2.0);
    // The Sun, a little over half way out, carried round with the rest.
    float a = -t * 0.03 + 2.2;
    vec2 s = rot(-0.35 * 0.6) * (vec2(cos(a), sin(a) * cos(0.35)) * 0.215);
    float d = length(p - s);
    col += vec3(0.31, 0.89, 0.76) * (ring(p - s, 0.018 + 0.006 * sin(t * 2.0), 0.0022) + (1.0 - smoothstep(0.003, 0.005, d)));
  } else if (id == 5) {
    // They close, and the picture starts again from far apart.
    float k = fract(t * 0.03);
    float gap = mix(0.36, 0.13, k * k * (3.0 - 2.0 * k));
    float fade = smoothstep(0.0, 0.06, k) * smoothstep(1.0, 0.92, k);
    col += galaxy(p - vec2(-gap, -gap * 0.42), 0.20, -t * 0.04, 0.5, 2.0) * fade;
    col += galaxy(rot(0.6) * (p - vec2(gap, gap * 0.42)), 0.30, t * 0.03, 1.12, 2.0) * 1.15 * fade;
  } else if (id == 6) {
    // The whole sky on an oval map, as these are always drawn.
    vec2 q = p / vec2(0.62, 0.31);
    float r2 = dot(q, q);
    if (r2 < 1.0) {
      float th = asin(clamp(q.y, -1.0, 1.0));
      float lam = 3.14159265 * q.x / max(cos(th), 0.05);
      float phi = asin(clamp((2.0 * th + sin(2.0 * th)) / 3.14159265, -1.0, 1.0));
      vec3 dir = vec3(cos(phi) * cos(lam), cos(phi) * sin(lam), sin(phi));
      // The sky is hotter by a part in a thousand toward where we are going, cooler behind: far more than its own mottle.
      float dipole = dot(dir, normalize(vec3(0.25, -0.86, 0.44)));
      float mottle = fbm3(dir * 9.0, 4) - 0.5;
      float v = clamp(0.5 + dipole * 0.42 + mottle * 0.34, 0.0, 1.0);
      vec3 cold = vec3(0.05, 0.16, 0.62), mid = vec3(0.78, 0.86, 0.90), hot = vec3(0.82, 0.16, 0.08);
      vec3 m = v < 0.5 ? mix(cold, mid, v * 2.0) : mix(mid, hot, v * 2.0 - 1.0);
      col = mix(col, m * (0.9 - 0.25 * r2), smoothstep(1.0, 0.985, r2));
    }
  } else {
    // Everything leaving, faster the further away it already is, and redder for it.
    float R = 0.44;
    for (int k = 0; k < 3; k++) {
      float grow = fract(t * 0.035 + float(k) / 3.0);
      float s = exp(grow * 2.2) / 9.0;
      vec2 gp = p / s * (6.0 + 2.0 * float(k));
      vec2 id2 = floor(gp);
      float h = hash21(id2 + 20.0 * float(k));
      vec2 c = 0.25 + 0.5 * vec2(hash21(id2 + 1.0), hash21(id2 + 2.0));
      vec2 f = (fract(gp) - c) * rot(h * 6.0);
      float dot1 = exp(-dot(f * vec2(1.0, 2.2), f * vec2(1.0, 2.2)) * 260.0) * step(0.5, h);
      float far = clamp(length(p) / R, 0.0, 1.0);
      vec3 tint = mix(vec3(0.75, 0.86, 1.0), vec3(1.0, 0.32, 0.18), far * far);
      col += tint * dot1 * (1.0 - smoothstep(0.92, 1.0, far)) * smoothstep(0.0, 0.1, grow) * smoothstep(1.0, 0.8, grow) * 1.4;
    }
    col += vec3(0.9, 0.3, 0.2) * ring(p, R, 0.004) * 0.5 + vec3(0.9, 0.3, 0.2) * ring(p, R, 0.03) * 0.10;
    col *= 1.0 - smoothstep(R, R * 1.08, length(p)) * 0.9;
    col += vec3(0.31, 0.89, 0.76) * (1.0 - smoothstep(0.004, 0.006, length(p)));
  }
  return col;
}

void main() {
  vec2 p = centred(vUv) - u_off;
  float t = u_time;
  float s = clamp(u_scene, 0.0, 7.0);
  int a = int(floor(s));
  // Most of the way between two, it is one or the other: the change happens in the middle third.
  float k = smoothstep(0.34, 0.66, fract(s));
  vec3 col = view(a, p, t);
  if (k > 0.001 && a < 7) col = mix(col, view(a + 1, p, t), k);

  col = aces(col * 1.05);
  col = toSRGB(col);
  col = dither(col, vUv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

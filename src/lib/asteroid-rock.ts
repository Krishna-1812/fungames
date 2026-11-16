/**
 * Asteroid Launcher's rock, as a solid.
 *
 * The builder used to show a shaded disc with spots on it. Asteroids are not
 * discs: nothing this small has the gravity to pull itself round. This one
 * is a lump, marched as a real surface: an uneven ellipsoid, dented by a
 * dozen craters, tumbling about a tilted axis under one hard Sun with no air
 * to soften the shadow, which is what gives a rock in space its look. The
 * craters cast shadows into themselves because the light is tested against
 * the same surface.
 *
 * What it is made of changes the surface and not only the colour:
 *
 *   0 comet ice     bright, glossy where it is clean, with dark dust lying on it
 *   1 porous rock   nearly black, matte, pitted all over
 *   2 dense rock    grey-brown stone
 *   3 iron          metal: scalloped with the thumbprints iron meteorites have
 *   4 solid gold    metal, and the colour gold is
 *
 * The SVG rock under it stays for anything without WebGL2.
 */
import { glsl } from './gl'

export const ROCK_KINDS = ['ice', 'porous', 'rock', 'iron', 'gold'] as const

export const ASTEROID_ROCK_FRAG = glsl(`
uniform float u_mat;   // which of the five, 0..4
uniform float u_spin;  // radians turned so far
uniform float u_size;  // 0..1 along the diameter slider

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// The rock's own frame: tilted, then turned.
vec3 turn(vec3 p) {
  p.xy = rot(0.42) * p.xy;
  p.xz = rot(u_spin) * p.xz;
  p.yz = rot(0.27 + u_spin * 0.31) * p.yz;
  return p;
}

float rockSdf(vec3 p) {
  vec3 q = turn(p);
  float R = mix(0.56, 0.78, u_size);
  // An ellipsoid, not a ball, with big slow lumps on it.
  float d = length(q * vec3(0.86, 1.08, 1.0)) - R;
  d += (fbm3(q * 1.5 / R + 4.0, 3) - 0.5) * 0.34 * R;
  // Craters: a bowl with a raised lip, wherever one of a dozen directions points.
  vec3 n = normalize(q);
  for (int k = 0; k < 12; k++) {
    vec3 c = normalize(hash33(vec3(float(k) * 7.3 + 1.0, 2.0, 5.0)) - 0.5);
    float size = 0.16 + 0.26 * hash31(vec3(float(k), 9.0, 3.0));
    float a = acos(clamp(dot(n, c), -1.0, 1.0)) / size;
    if (a < 1.6) {
      float bowl = -(1.0 - a * a) * step(a, 1.0) * 0.10;
      float lip = exp(-pow((a - 1.05) / 0.16, 2.0)) * 0.022;
      d -= (bowl + lip) * size * R * 2.2 * (u_mat > 2.5 ? 0.45 : 1.0);
    }
  }
  // What it is made of, in relief.
  if (u_mat < 0.5) d += (fbm3(q * 7.0, 2) - 0.5) * 0.018;                               // ice: smooth, a little frosted
  else if (u_mat < 1.5) d += (fbm3(q * 11.0, 3) - 0.5) * 0.05;                          // porous: pitted
  else if (u_mat < 2.5) d += (fbm3(q * 8.0, 3) - 0.5) * 0.03;                           // stone
  else d -= pow(noise3(q * 6.5 / R + 2.0), 2.0) * 0.045 * R;                            // metal: thumbprints
  return d * 0.72;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0025, 0.0);
  return normalize(vec3(
    rockSdf(p + e.xyy) - rockSdf(p - e.xyy),
    rockSdf(p + e.yxy) - rockSdf(p - e.yxy),
    rockSdf(p + e.yyx) - rockSdf(p - e.yyx)));
}

void main() {
  vec2 p = centred(vUv) * 1.85;
  vec3 ro = vec3(p, 3.0);
  vec3 rd = vec3(0.0, 0.0, -1.0);
  vec3 sun = normalize(vec3(-0.80, 0.46, 0.30));

  // Space: nearly black, a few stars.
  vec2 sg = vUv * u_res / (u_dpr * 19.0) + 0.37;
  vec2 sid = floor(sg);
  float sh = hash21(sid + 3.0);
  vec2 sc = 0.2 + 0.6 * vec2(hash21(sid + 1.1), hash21(sid + 2.2));
  vec3 col = vec3(0.003, 0.004, 0.009) + vec3(0.8, 0.86, 1.0) * smoothstep(0.05, 0.0, length(fract(sg) - sc)) * step(0.86, sh) * (0.15 + 0.85 * hash21(sid + 8.0));

  float t = 1.4;
  float hit = 0.0;
  for (int i = 0; i < 56; i++) {
    float d = rockSdf(ro + rd * t);
    if (d < 0.0015) { hit = 1.0; break; }
    t += d;
    if (t > 4.6) break;
  }

  if (hit > 0.5) {
    vec3 pos = ro + rd * t;
    vec3 n = normalAt(pos);
    vec3 q = turn(pos);

    // Is the Sun hidden from here by the rock itself?
    float lit = 1.0;
    float st = 0.03;
    for (int i = 0; i < 18; i++) {
      float d = rockSdf(pos + n * 0.006 + sun * st);
      lit = min(lit, clamp(d * 22.0 / st, 0.0, 1.0));
      st += clamp(d, 0.02, 0.12);
      if (lit < 0.02 || st > 1.6) break;
    }
    float diff = max(dot(n, sun), 0.0) * lit;
    // How buried the point is: creases are darker.
    float ao = clamp(rockSdf(pos + n * 0.08) / 0.08, 0.0, 1.0);
    vec3 hv = normalize(sun - rd);
    float nh = max(dot(n, hv), 0.0);
    float tone = fbm3(q * 3.0 + 9.0, 3);

    vec3 albedo; float gloss; float shine; vec3 tint;
    if (u_mat < 0.5) {            // comet ice
      float dust = smoothstep(0.50, 0.66, tone);
      albedo = mix(vec3(0.62, 0.72, 0.80), vec3(0.15, 0.14, 0.13), dust);
      gloss = mix(70.0, 8.0, dust); shine = mix(0.55, 0.03, dust); tint = vec3(1.0);
    } else if (u_mat < 1.5) {     // porous rock
      albedo = vec3(0.105, 0.095, 0.088) * (0.75 + 0.5 * tone); gloss = 6.0; shine = 0.02; tint = vec3(1.0);
    } else if (u_mat < 2.5) {     // dense rock
      albedo = mix(vec3(0.24, 0.21, 0.18), vec3(0.38, 0.34, 0.29), tone); gloss = 10.0; shine = 0.04; tint = vec3(1.0);
    } else if (u_mat < 3.5) {     // iron
      albedo = mix(vec3(0.07, 0.07, 0.08), vec3(0.14, 0.135, 0.14), tone); gloss = 40.0; shine = 0.9; tint = vec3(0.93, 0.94, 1.0);
    } else {                      // gold
      albedo = vec3(0.30, 0.20, 0.05) * (0.85 + 0.3 * tone); gloss = 55.0; shine = 1.0; tint = vec3(1.0, 0.78, 0.34);
    }

    vec3 c = albedo * (diff * 1.25 + 0.008);
    // Metal is mostly what it reflects: the Sun, widely, off every face turned its way.
    vec3 rf = reflect(rd, n);
    c += tint * (pow(max(dot(rf, sun), 0.0), 5.0) * 0.55 + 0.06 * max(rf.y, 0.0)) * shine * (0.25 + 0.75 * lit) * step(2.5, u_mat);
    // No air, so no sky to fill the shadows: only a little light back off the rock's own lit ground.
    c += albedo * vec3(0.05, 0.06, 0.08) * ao * (0.5 + 0.5 * dot(n, vec3(0.5, -0.3, 0.8)));
    c += tint * pow(nh, gloss) * shine * lit * 1.4;
    // Metal shows the dark it is surrounded by; a faint edge keeps the night side from vanishing.
    c += tint * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * (0.02 + 0.10 * shine) * (0.3 + 0.7 * lit);
    c *= 0.55 + 0.45 * ao;
    col = c;
  }

  col = aces(col * 1.15);
  col = toSRGB(col);
  col = dither(col, vUv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

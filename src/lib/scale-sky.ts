/**
 * Scale's environment and objects, drawn on the GPU.
 *
 * The page's scroll→metres mapping is untouched. This replaces two things:
 *
 * 1. **The background.** It was one CSS linear gradient interpolated between
 *    ten colour stops. Crossing forty-two orders of magnitude deserves better
 *    than a colour ramp, so the exponent now selects between four rendered
 *    regimes — a quantum field, a fluid, an atmosphere, and deep space — which
 *    cross-fade into each other. You are never told you have left the world of
 *    atoms; the picture just stops being one and starts being the other.
 *
 * 2. **The objects.** They were CSS circles with a radial-gradient highlight.
 *    Now each is a lit sphere with a surface, a terminator and a rim, shaded
 *    from one key light so the whole scroll agrees about where the light is.
 *
 * Everything is drawn in one fullscreen pass. At most a handful of objects are
 * ever on screen at once and they are all concentric at the stage centre, so
 * instancing would cost more than it saved — they go in as a small uniform
 * array and composite back to front.
 *
 * The DOM keeps the labels, the scroll container and the text alternative, so
 * nothing about the page's accessibility depends on WebGL. The original CSS
 * gradient stays behind the canvas for machines that cannot run this.
 */
import { glsl } from './gl'

/** Objects passed to the shader per frame. Four floats each. */
export const MAX_OBJECTS = 8

export const SCALE_FRAG = glsl(`
uniform float u_exp;      // log10 of the screen's width in metres
uniform vec2  u_centre;   // stage centre in 0..1 uv space
uniform float u_objN;
uniform float u_obj[${MAX_OBJECTS * 4}];    // radius (fraction of height), alpha, seed, spare
uniform float u_objCol[${MAX_OBJECTS * 3}];

/* ---------------------------------------------------------------- regimes */

/* Subatomic. Nothing down here has a surface, so this is deliberately not
   objects in a space — it is a field: ridged filaments and a standing
   interference pattern, which is closer to what the maths actually describes. */
vec3 quantum(vec2 p, float t) {
  float r = ridge(p * 2.1 + vec2(t * 0.04, -t * 0.03), 5);
  float rings = sin(length(p) * 22.0 - t * 0.7) * 0.5 + 0.5;
  vec3 c = vec3(0.055, 0.020, 0.115);
  c += vec3(0.42, 0.16, 0.78) * pow(r, 2.6);
  c += vec3(0.20, 0.09, 0.40) * rings * 0.09;
  return c;
}

/* Molecular and cellular. Warm, wet, crowded — domain-warped so it flows
   rather than sitting still. */
vec3 fluid(vec2 p, float t) {
  vec2 q = vec2(fbm(p * 1.3 + t * 0.04, 4), fbm(p * 1.3 - t * 0.035 + 4.1, 4));
  float f = fbm(p * 1.5 + q * 1.8, 5);
  vec3 c = mix(vec3(0.015, 0.055, 0.065), vec3(0.075, 0.28, 0.245), f);
  c += vec3(0.16, 0.42, 0.32) * pow(f, 3.2) * 0.55;
  return c;
}

/* Human scale: sky. A real Rayleigh-ish vertical ramp with a low sun, because
   this is the one band where people know exactly what it should look like. */
vec3 atmosphere(vec2 uv, vec2 p, float t) {
  float h = uv.y;
  // These are linear values, and linear 0.6 is sRGB 0.8 -- the first pass here
  // was bright enough to wash the whole band to near-white and leave the
  // objects with nothing to stand against. Deep zenith, restrained horizon.
  vec3 zenith = vec3(0.045, 0.135, 0.46);
  vec3 horizon = vec3(0.30, 0.44, 0.66);
  vec3 c = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.75));
  float sun = exp(-length(p - vec2(0.62, -0.28)) * 3.6);
  c += vec3(1.0, 0.84, 0.58) * sun * 0.30;
  // A little haze so the lower half is not a flat wash.
  c += vec3(0.85, 0.88, 0.92) * fbm(p * 0.9 + t * 0.01, 3) * 0.035 * (1.0 - h);
  return c;
}

/* Everything above about a hundred thousand kilometres. Same starfield idea as
   Orbit so the two pages feel like the same universe. */
vec3 cosmos(vec2 uv, vec2 p, float t) {
  float n1 = ridge(p * 1.15 + 7.0, 5);
  float n2 = fbm(p * 0.65 - 3.0, 4);
  vec3 c = vec3(0.115, 0.055, 0.215) * pow(n1, 2.3) * 0.9;
  c += vec3(0.04, 0.09, 0.22) * pow(n2, 2.6) * 0.7;

  for (int L = 0; L < 3; L++) {
    float scale = 80.0 * pow(2.15, float(L));
    vec2 g = uv * u_res / u_res.y * scale;
    vec2 cell = floor(g);
    vec2 f = fract(g);
    vec2 jitter = hash22(cell + float(L) * 41.0);
    float present = step(0.962 - float(L) * 0.007, hash21(cell + float(L) * 87.0));
    float dist = length(f - jitter);
    float mag = hash21(cell + float(L) * 17.0);
    vec3 tint = mix(vec3(1.0, 0.79, 0.63), vec3(0.73, 0.84, 1.0), mag);
    float core = present * pow(max(0.0, 1.0 - dist * (7.0 + float(L) * 3.0)), 7.0);
    c += tint * core * (0.45 + mag * 2.2) / (1.0 + float(L));
  }
  c += vec3(0.010, 0.012, 0.026);
  return c;
}

vec3 environment(vec2 uv, vec2 p, float e, float t) {
  // Overlapping windows rather than hard cuts: at any exponent up to two
  // regimes are alive, and the crossover is where the scroll feels like it is
  // passing through something.
  float wq = 1.0 - smoothstep(-11.0, -8.2, e);
  float wf = smoothstep(-11.0, -8.2, e) * (1.0 - smoothstep(-4.2, -1.6, e));
  float wa = smoothstep(-4.2, -1.6, e) * (1.0 - smoothstep(5.2, 7.6, e));
  float wc = smoothstep(5.2, 7.6, e);

  vec3 col = vec3(0.0);
  if (wq > 0.001) col += quantum(p, t) * wq;
  if (wf > 0.001) col += fluid(p, t) * wf;
  if (wa > 0.001) col += atmosphere(uv, p, t) * wa;
  if (wc > 0.001) col += cosmos(uv, p, t) * wc;
  return col;
}

/* ---------------------------------------------------------------- objects */

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  float t = u_time;

  vec3 col = environment(uv, p, u_exp, t);

  // Geometry arrives resolution-independent — a uv centre and a radius as a
  // fraction of height — so nothing here has to know about DPR or the
  // surface's render scale.
  vec2 px = uv * u_res;
  vec2 d = px - u_centre * u_res;
  float dist = length(d);

  // One key light, fixed in screen space, so every object across the whole
  // scroll is lit from the same direction and the sequence reads as one place.
  vec3 L = normalize(vec3(-0.42, 0.52, 0.74));

  int n = int(u_objN + 0.5);
  for (int i = 0; i < ${MAX_OBJECTS}; i++) {
    if (i >= n) break;
    float R = u_obj[i * 4] * u_res.y;
    float alpha = u_obj[i * 4 + 1];
    float seed = u_obj[i * 4 + 2];
    if (R <= 0.0 || alpha <= 0.001) continue;
    vec3 base = vec3(u_objCol[i * 3], u_objCol[i * 3 + 1], u_objCol[i * 3 + 2]);

    float r = dist / R;

    // Outer glow. Reaches well past the body and is what stops an object
    // popping into existence as a hard disc.
    float glow = exp(-r * 2.6) * 0.22;
    col += base * glow * alpha;

    if (r < 1.0) {
      vec3 nrm = vec3(d / R, sqrt(max(0.0, 1.0 - r * r)));
      // Sampled in the object's own frame so the texture belongs to the sphere
      // rather than sliding across it as the disc grows.
      vec3 sp = nrm + seed * 43.0;
      float tex = fbm3(sp * 2.4, 5);
      float fine = ridge3(sp * 6.5, 3);

      vec3 albedo = base * (0.62 + tex * 0.75);
      albedo = mix(albedo, albedo * 1.35, fine * 0.4);

      float ndl = dot(nrm, L);
      // Wrapped a little: a hard terminator on a small disc aliases badly.
      float diff = max(0.0, (ndl + 0.18) / 1.18);
      vec3 lit = albedo * (0.16 + diff * 1.05);

      // Specular, tightened on the bigger bodies where it reads as a surface
      // rather than as a stray dot.
      vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
      lit += vec3(1.0) * pow(max(dot(nrm, H), 0.0), 38.0) * 0.35;

      // Limb: the atmosphere-ish edge, brightest where it still faces the key.
      float rim = pow(1.0 - nrm.z, 3.2);
      lit += base * rim * (0.28 + max(ndl, 0.0) * 1.2);

      // One pixel of coverage, so the silhouette is not stair-stepped.
      float aa = fwidth(r) * 1.2;
      float cov = 1.0 - smoothstep(1.0 - aa, 1.0, r);
      col = mix(col, lit, cov * alpha);
    }
  }

  col = aces(col * 1.04);
  col = toSRGB(col);
  // Vignette then dither: the dark regimes band badly across a wide screen.
  col *= 1.0 - dot(p, p) * 0.06;
  col = dither(col, px);
  fragColor = vec4(col, 1.0);
}
`)

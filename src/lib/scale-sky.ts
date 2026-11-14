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
uniform float u_obj[${MAX_OBJECTS * 4}];    // radius (fraction of height), alpha, seed, kind
uniform float u_objCol[${MAX_OBJECTS * 3}];
uniform float u_objOff[${MAX_OBJECTS * 2}];   // centre, from the stage centre, in heights

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

float fbm(vec2 p) { return fbm(p, 4); }

vec3 cells(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = g + hash22(i + g) - f;
    float d = dot(o, o);
    if (d < d1) { d2 = d1; d1 = d; id = hash21(i + g + 3.7); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}

/* Points scattered through an object's own space, n cells to its radius, each
   drawn about a pixel and a half wide however far in you are — so a cluster
   stays a cluster of stars rather than turning into discs. 'keep' is the
   chance, 0..1, that a cell has a point at all; x is the light, y an id. */
vec2 points(vec2 q, float n, float R, float seed, float keep) {
  vec2 g = q * n, c = floor(g);
  float best = 0.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 cc = c + vec2(float(x), float(y));
    float h = hash21(cc + seed * 91.0);
    if (h > keep) continue;
    vec2 o = hash22(cc + seed * 17.0);
    float dpx = length(g - cc - o) / n * R;
    float b = exp(-dpx * dpx / 1.4) * (0.35 + 0.65 * fract(h * 57.0));
    if (b > best) { best = b; id = fract(h * 113.0); }
  }
  return vec2(best, id);
}

/* A smudge of light: a galaxy seen from too far away to be anything else. */
float smudge(vec2 q, vec2 at, vec2 size, float turn, float R) {
  vec2 d = q - at;
  float c = cos(turn), s = sin(turn);
  d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y) / max(size, vec2(2.3 / R));
  return exp(-dot(d, d) * 2.0);
}

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  float t = u_time;

  vec3 col = environment(uv, p, u_exp, t);

  // Geometry arrives resolution-independent — a uv centre and a radius as a
  // fraction of height — so nothing here has to know about DPR or the
  // surface's render scale.
  vec2 px = uv * u_res;
  vec2 d0 = px - u_centre * u_res;

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

    float kind = u_obj[i * 4 + 3];
    vec2 d = d0 - vec2(u_objOff[i * 2], u_objOff[i * 2 + 1]) * u_res.y;
    vec2 q = d / R;
    float r = length(q);
    // Once a thing is far wider than the window you are inside it.
    float inside = smoothstep(2.4, 0.9, R / min(u_res.x, u_res.y));

    /* ---- ring: an orbit, or how far away something is. The space inside
       is empty, which is the point; a body rides on it. */
    if (kind < 1.5) {
      float w = 1.3 / R;
      float band = exp(-pow((r - 1.0) / w, 2.0));
      float a = atan(q.y, q.x);
      // 1 is an orbit, whose body moves; 1.25 a distance, whose body is where
      // it is; 1.4 a bare length.
      float at = seed * TAU + t * 0.05 * step(kind, 1.1);
      float sweep = 0.5 + 0.5 * cos(a - at);
      col += base * band * (0.55 + 1.6 * pow(sweep, 6.0)) * alpha;
      vec2 body = vec2(cos(at), sin(at));
      float bd = length(q - body) * R;
      col += (base + 0.6) * (exp(-bd * bd / 5.0) * 1.6 + exp(-bd / 9.0) * 0.25) * alpha * step(kind, 1.3);
      continue;
    }

    /* ---- the Milky Way, from above: a bar, two great arms and two lesser,
       dust on their inner edges, and the pink of new stars along them. */
    if (kind < 2.5) {
      if (r < 1.5) {
        float a = atan(q.y, q.x);
        float ca = cos(0.5 + seed), sa = sin(0.5 + seed);
        vec2 b = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y);
        float bar = exp(-pow(b.x / 0.22, 2.0) - pow(b.y / 0.065, 2.0));
        float bulge = exp(-r * r * 60.0);
        float lr = log(max(r, 0.03));
        float ph = a - 0.5 - seed - lr * 4.4;
        float warp = fbm(q * 5.0 + seed * 9.0);
        float arm = pow(0.5 + 0.5 * cos(ph * 2.0 + warp * 1.4), 3.0) + 0.45 * pow(0.5 + 0.5 * cos(ph * 2.0 + PI + warp * 1.4), 5.0);
        arm *= smoothstep(0.14, 0.3, r);
        float dust = pow(0.5 + 0.5 * cos(ph * 2.0 + 0.9 + warp * 1.4), 6.0) * smoothstep(0.1, 0.3, r) * (0.5 + fbm(q * 18.0));
        float disc = exp(-r * 3.4) * smoothstep(1.25, 0.75, r + 0.15 * warp);
        vec3 c = mix(vec3(0.62, 0.72, 1.0), base, 0.35) * arm * disc * 4.2;
        c += vec3(1.0, 0.9, 0.72) * (bar * 1.5 + bulge * 3.0) + vec3(0.8, 0.82, 1.0) * disc * 0.5;
        c *= 1.0 - 0.6 * clamp(dust, 0.0, 1.0);
        vec2 st = points(q, 90.0, R, seed, 0.5 * clamp(disc * 3.0 + arm, 0.0, 1.0));
        c += vec3(0.85, 0.9, 1.0) * st.x * disc * 5.0;
        vec2 hii = points(q, 26.0, R, seed + 2.0, arm * 0.5);
        c += vec3(1.0, 0.35, 0.55) * hii.x * disc * 6.0;
        col += c * alpha * mix(0.25, 1.0, inside);
      }
      continue;
    }

    /* ---- a nebula: glowing gas. Hydrogen red on the outside, the teal of
       oxygen where the young stars at the heart are hottest, dust across it. */
    if (kind < 3.5) {
      if (r < 1.5) {
        float nR = min(R, min(u_res.x, u_res.y) * 0.6);
        vec3 sp = vec3(d / nR, 0.0) + seed * 37.0;
        vec3 wq = sp + 0.35 * vec3(fbm3(sp * 2.0, 3), fbm3(sp * 2.0 + 4.0, 3), 0.0);
        float dens = fbm3(wq * 2.4 + vec3(0.0, 0.0, t * 0.01), 5);
        float fil = ridge3(wq * 4.6 + seed * 11.0, 4);
        float body = (dens * 0.7 + fil * 0.55) * smoothstep(1.25, 0.1, r + 0.35 * (dens - 0.5));
        float lane = smoothstep(0.55, 0.8, ridge3(wq * 3.1 + 7.0, 4)) * 0.75;
        float heart = exp(-r * r * 9.0);
        vec3 gas = mix(vec3(0.95, 0.16, 0.34), vec3(0.35, 0.9, 0.85), clamp(heart * 1.4 + dens * 0.25, 0.0, 1.0));
        vec3 c = gas * pow(body, 2.0) * 3.4 * (1.0 - lane) + vec3(0.9, 0.95, 1.0) * heart * heart * 0.9 * inside;
        // the Trapezium, and the cluster round it
        for (int k = 0; k < 4; k++) {
          vec2 sp2 = (hash22(vec2(float(k), seed)) - 0.5) * 0.09;
          float sd = length(q - sp2) * R;
          c += vec3(0.8, 0.9, 1.0) * (exp(-sd * sd / 3.0) * 2.5 + exp(-sd / 7.0) * 0.3) * inside;
        }
        c += vec3(0.9, 0.92, 1.0) * points(q, 34.0, R, seed, 0.35 * smoothstep(1.2, 0.0, r)).x * 2.0;
        col += c * alpha;
      }
      continue;
    }

    /* ---- a wavelength: one whole wave, crest to crest across its width,
       travelling, over a bar that marks exactly how long it is. */
    if (kind < 4.5) {
      if (abs(q.x) < 1.15 && abs(q.y) < 0.6) {
        float y = 0.3 * sin(q.x * PI - t * 2.4 + seed * TAU);
        float dy = abs(q.y - y) * R / sqrt(1.0 + pow(0.3 * PI * cos(q.x * PI - t * 2.4 + seed * TAU), 2.0));
        float env = smoothstep(1.12, 0.94, abs(q.x));
        float line = exp(-dy * dy / 3.0) * 1.6 + exp(-dy / 10.0) * 0.35;
        // the field itself, faintly, under the curve
        float fill = step(min(0.0, y), q.y) * step(q.y, max(0.0, y)) * 0.16;
        col += (base * (line + fill) + vec3(1.0) * exp(-dy * dy / 1.2) * 0.5) * env * alpha;
        // the measure
        float ruler = exp(-pow((q.y + 0.46) * R, 2.0) / 1.2) * step(abs(q.x), 1.0);
        ruler += exp(-pow((abs(q.x) - 1.0) * R, 2.0) / 1.2) * step(abs(q.y + 0.46), 0.05);
        col += vec3(0.85) * ruler * 0.5 * alpha;
      }
      continue;
    }

    /* ---- an atom: not a ball and not an orbit. Each speck is somewhere the
       electron could be found, thickest at the middle and never quite
       stopping; the nucleus is far too small to see from here. */
    if (kind < 5.5) {
      if (r < 3.4) {
        float prob = exp(-2.0 * r);
        float tw = floor(t * 6.0);
        vec2 e1 = points(q, 46.0, R, seed + tw * 0.013, prob * 1.2);
        vec2 e2 = points(q, 21.0, R, seed + 5.0 + tw * 0.007, prob * 1.2);
        col += base * (prob * 0.55 + (e1.x + e2.x) * 1.9) * alpha * mix(0.4, 1.0, inside);
      }
      continue;
    }

    /* ---- a globular cluster: old stars, hundreds of thousands, thicker and
       thicker towards a middle where they cannot be told apart. */
    if (kind < 6.5) {
      if (r < 1.6) {
        float rho = pow(1.0 + pow(r / 0.16, 2.0), -1.35) * smoothstep(1.5, 0.9, r);
        vec3 c = vec3(1.0, 0.86, 0.66) * rho * 1.3 * inside;
        vec2 s1 = points(q, 38.0, R, seed, rho * 3.0 + 0.04);
        vec2 s2 = points(q, 97.0, R, seed + 3.0, rho * 2.2);
        vec2 s3 = points(q, 210.0, R, seed + 6.0, rho * 1.6);
        vec3 tint = mix(vec3(1.0, 0.72, 0.45), vec3(0.75, 0.85, 1.0), smoothstep(0.55, 0.95, s1.y));
        c += tint * s1.x * 2.6 + vec3(1.0, 0.88, 0.7) * (s2.x * 1.6 + s3.x * 1.1);
        col += c * alpha * smoothstep(1.55, 1.0, r);
      }
      continue;
    }

    /* ---- the Local Group: two big spirals — ours, at the origin, and
       Andromeda two and a half million light years off — a third beside it,
       and some fifty dwarfs gathered round the pair of them. */
    if (kind < 7.5) {
      if (r < 1.3) {
        vec3 c = vec3(0.0);
        vec2 m31 = vec2(0.40, 0.31);
        c += vec3(0.85, 0.88, 1.0) * smudge(q, m31, vec2(0.036, 0.012), 0.6, R) * 3.4;
        c += vec3(0.85, 0.9, 1.0) * smudge(q, vec2(0.0), vec2(0.016, 0.014), 0.0, R) * 2.4 * (1.0 - inside * 0.0) * smoothstep(40.0, 4.0, 0.016 * R);
        c += vec3(1.0, 0.9, 0.75) * smudge(q, m31, vec2(0.007), 0.0, R) * 2.0;
        c += vec3(0.75, 0.85, 1.0) * smudge(q, vec2(0.47, 0.27), vec2(0.011, 0.009), 0.3, R) * 1.6;     // Triangulum
        c += vec3(0.8, 0.86, 1.0) * smudge(q, vec2(0.022, -0.024), vec2(0.004), 0.0, R) * 1.4;           // the Magellanic Clouds
        c += vec3(0.8, 0.86, 1.0) * smudge(q, vec2(0.031, -0.031), vec2(0.0025), 0.0, R) * 1.1;
        for (int k = 0; k < 44; k++) {
          vec2 h = hash22(vec2(float(k) * 1.7, seed + 2.0));
          // most dwarfs belong to one of the two giants
          vec2 host = k % 2 == 0 ? vec2(0.0) : m31;
          float far = k % 7 == 0 ? 0.75 : 0.16;
          vec2 at = host + (h - 0.5) * far * (0.4 + 1.6 * fract(h.x * 13.0));
          c += vec3(0.9, 0.88, 0.85) * smudge(q, at, vec2(0.0016 + 0.002 * h.y), 0.0, R) * (0.7 + 0.9 * h.x);
        }
        // how far our own gravity holds against the expansion
        c += base * exp(-pow((r - 0.62) * R / 1.4, 2.0)) * 0.22 * step(0.5, fract(atan(q.y, q.x) * 14.0));
        col += c * alpha;
      }
      continue;
    }

    /* ---- Laniakea: not a thing but a watershed. Every galaxy in it is
       falling, along these lines, towards one place — the Great Attractor. */
    if (kind < 8.5) {
      if (r < 1.35) {
        vec2 sink = vec2(0.32, -0.18);
        vec2 v = q - sink;
        float lv = length(v);
        float wob = fbm(q * 2.2 + seed * 5.0);
        float stream = atan(v.y, v.x) + 1.3 * (wob - 0.5) + 0.5 * lv;
        float line = pow(0.5 + 0.5 * cos(stream * 17.0), 14.0) + 0.5 * pow(0.5 + 0.5 * cos(stream * 41.0 + 2.0), 22.0);
        float edge = smoothstep(1.05, 0.55, r + 0.45 * (wob - 0.5));
        float along = 0.35 + 0.65 * fbm(vec2(stream * 3.0, lv * 9.0 - t * 0.05));
        vec3 c = mix(base, vec3(1.0), smoothstep(0.5, 0.0, lv)) * line * along * edge * 1.1;
        c += vec3(1.0, 0.95, 0.9) * exp(-lv * lv * 90.0) * 0.9;
        float dens = clamp(line * 0.9 + 0.12, 0.0, 1.0) * edge;
        c += vec3(0.9, 0.93, 1.0) * (points(q, 60.0, R, seed, dens).x * 1.8 + points(q, 150.0, R, seed + 4.0, dens * 0.8).x * 1.2);
        col += c * alpha;
      }
      continue;
    }

    /* ---- everything we can see: galaxies strung along the walls of
       voids like soap film, out to a last surface — the glow from when the
       universe first became transparent — beyond which no light has had time
       to arrive. */
    if (kind < 9.5) {
      if (r < 1.12) {
        vec2 w = q + 0.11 * vec2(fbm(q * 5.0), fbm(q * 5.0 + 3.0));
        vec3 c1 = cells(w * 7.0 + seed * 31.0);
        vec3 c2 = cells(w * 17.0 + 0.6 * vec2(fbm(w * 9.0), fbm(w * 9.0 + 5.0)) + seed * 57.0);
        // filaments, uneven along their length, with a haze of the galaxies
        // that have not fallen onto one yet
        float lumpy = fbm(w * 11.0 + seed);
        float web = pow(smoothstep(0.22, 0.0, c1.y - c1.x), 1.6) * (0.35 + 1.1 * lumpy) + pow(smoothstep(0.26, 0.0, c2.y - c2.x), 1.8) * 0.4 * (0.3 + lumpy);
        web += 0.10 * lumpy;
        float knot = smoothstep(0.55, 0.9, lumpy) * web;
        float fade = smoothstep(1.0, 0.86, r);
        vec3 c = (mix(vec3(0.45, 0.4, 0.95), vec3(0.6, 0.85, 1.0), c1.z) * web * 0.75 + vec3(1.0, 0.95, 0.9) * knot * 1.5) * fade;
        c += vec3(0.9, 0.92, 1.0) * points(q, 130.0, R, seed, web * 0.8).x * 1.4 * fade;
        // the last scattering surface: hotter and cooler by a part in 100,000
        float shell = exp(-pow((r - 0.985) / 0.022, 2.0));
        float mott = fbm(vec2(atan(q.y, q.x) * 9.0, r * 40.0) + seed);
        c += mix(vec3(0.25, 0.45, 1.0), vec3(1.0, 0.5, 0.45), smoothstep(0.35, 0.65, mott)) * shell * 0.8;
        col += c * alpha;
      }
      continue;
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

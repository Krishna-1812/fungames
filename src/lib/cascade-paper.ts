/**
 * Rule Cascade's paper.
 *
 * This is the one page on the site where a spectacle would be actively wrong.
 * The joke is that you are filling in an ordinary signup form and it will not
 * let you leave; the moment the page looks like a light show, it stops being a
 * form and the joke dies with it. So this does the opposite of Overstimulated:
 * it stays quiet and gets *worse* so slowly that you should feel it before you
 * notice it.
 *
 * What actually happens as rules accumulate:
 *
 *   - the sheet picks up a crease for every rule unlocked, so the wear on the
 *     paper is a literal count of how long this has been going on
 *   - the light cools, from a warm desk lamp toward a grey afternoon
 *   - a vignette closes in, very slightly
 *   - the fibre coarsens, as though the sheet has been handled
 *
 * Every one of those is a couple of percent of luminance. None of it is
 * animated fast enough to notice while reading.
 *
 * ## Why there is no tonemap here
 *
 * Every other shader on the site ends with ACES, because every other shader has
 * emitters above 1.0. This one is a sheet of white paper. Running 0.91 through
 * ACES lands it at 0.78, which drags #f2f6f3 down to something visibly grey --
 * the tonemap would be solving a problem this page does not have and creating
 * one it otherwise would not. Linear light, gamma encode, done.
 */
import { glsl } from './gl'

export const PAPER_FRAG = glsl(`
uniform float u_tension;   // 0..1, rules unlocked over rules total
uniform float u_motion;    // 0 under prefers-reduced-motion

/* The page's own background, in linear. Everything here is a small deviation
   from this rather than a picture drawn over it. */
#define PAPER vec3(0.8912, 0.9246, 0.8995)

/* The floor the sheet is never allowed to go below, as a linear luminance.
   The sub-heading is #605d68 directly on this paper at 5.9:1; letting the
   vignette and the creases stack unchecked would quietly eat that margin, so
   instead of hoping they stay small they are clamped. */
#define MIN_LUM 0.82
#define LUMA vec3(0.2126, 0.7152, 0.0722)

/**
 * One fold. A crease is not a dark line -- it is a shadow with a highlight
 * beside it, which is the whole reason a folded sheet reads as three
 * dimensional rather than as a sheet with a line drawn on it.
 */
float crease(vec2 p, float seed, out float hi) {
  float ang = hash11(seed * 12.9) * PI;
  vec2 n = vec2(cos(ang), sin(ang));
  float off = (hash11(seed * 71.3 + 4.0) - 0.5) * 1.7;
  float x = dot(p, n) - off;
  /* Wide and soft. At a sixth of this width they were four-pixel hairlines,
     and the eye finds a hard straight edge far more readily than a broad
     gradient of the same amplitude -- the sheet looked scratched rather than
     folded. A real fold shades across a couple of centimetres. */
  hi = exp(-pow((x + 0.075) / 0.050, 2.0));
  return exp(-pow((x - 0.055) / 0.058, 2.0));
}

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  float t = u_time * u_motion;
  float T = clamp(u_tension, 0.0, 1.0);

  vec3 col = PAPER;

  /* ---- the light ---------------------------------------------------------
     A broad source up and to the left. It cools as the form drags on: a warm
     desk lamp at the start, a grey afternoon by rule twelve. */
  vec2 lp = p - vec2(-0.55, 0.62);
  float key = exp(-dot(lp, lp) * 0.55);
  vec3 warm = vec3(1.000, 0.982, 0.944);
  vec3 cool = vec3(0.944, 0.968, 1.000);
  col *= mix(vec3(1.0), mix(warm, cool, T), 0.055 + 0.030 * key);

  /* ---- the sheet ---------------------------------------------------------
     Two scales of unevenness: a very slow swell, so the paper is not perfectly
     flat, and fine fibre on top. The swell drifts at 0.02 -- about one cycle a
     minute -- which is under the threshold where it would pull your eye off
     the text. */
  float swell = fbm(p * 0.85 + vec2(t * 0.02, -t * 0.015), 4) - 0.5;
  col *= 1.0 + swell * (0.014 + 0.020 * T);

  // Paper fibre runs with the grain, so the noise is stretched along one axis.
  float fibre = noise(vec2(p.x * 210.0, p.y * 62.0)) - 0.5;
  col *= 1.0 + fibre * (0.008 + 0.011 * T);

  /* ---- the creases -------------------------------------------------------
     One per rule unlocked. Deterministic from the index, so a given rule always
     folds the sheet the same way and the wear reads as history rather than as
     noise that happens to be increasing. */
  float folds = T * 12.0;
  for (int i = 0; i < 12; i++) {
    float k = clamp(folds - float(i), 0.0, 1.0);
    if (k <= 0.001) break;
    float hi = 0.0;
    float sh = crease(p, float(i) + 1.0, hi);
    col *= 1.0 - sh * 0.017 * k;
    col *= 1.0 + hi * 0.011 * k;
  }

  /* ---- closing in -------------------------------------------------------- */
  float d = dot(p, p);
  col *= 1.0 - d * (0.012 + 0.048 * T);

  // The guarantee. Cheaper than reasoning about how four subtle layers compose
  // on a page whose text sits directly on them.
  float lum = dot(col, LUMA);
  if (lum < MIN_LUM) col *= MIN_LUM / max(lum, 1e-5);

  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

/**
 * Steady Hand's surface.
 *
 * The scoring is honest geometry and none of it is touched here. This is only
 * about what the game is played *on*, which was a flat #3a121d rectangle.
 *
 * A precision game has a particular constraint: the background must never
 * compete with the line. You are staring at a four-pixel stroke trying to see
 * whether it bends, so anything textured enough to be interesting is also
 * textured enough to hide the thing being judged. Everything here is therefore
 * very low frequency — a broad overhead light, a soft weave, and a vignette —
 * with one exception: a pool of warm light under each target, which is doing a
 * job rather than decorating. The dots stop being flat circles printed on a
 * flat page and become two lit points on a surface, which is what makes the
 * distance between them read as a distance.
 *
 * A dimmer glow follows the pen while a stroke is in progress, for the same
 * reason: it tells you the surface knows where you are.
 */
import { glsl } from './gl'

export const FELT_FRAG = glsl(`
uniform vec2  u_a;        // target A, in centred() space
uniform vec2  u_b;        // target B
uniform vec2  u_pen;      // where the stroke currently is
uniform float u_penOn;
uniform float u_locked;   // 1 once an attempt has been scored
uniform float u_motion;   // 0 under prefers-reduced-motion

/* The hint line is white at 0.8 opacity directly on this, so the surface is
   capped at a known relative luminance and its contrast computed against that
   rather than hoped for. */
#define MAX_LUM 0.10
#define LUMA vec3(0.2126, 0.7152, 0.0722)

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  float t = u_time * u_motion;

  /* ---- the table --------------------------------------------------------
     A deep maroon, lit from above and slightly left. The gradient is the only
     thing giving the surface a sense of being a surface. */
  vec3 col = mix(vec3(0.0290, 0.0060, 0.0110), vec3(0.0640, 0.0140, 0.0235), pow(uv.y, 0.85));
  vec2 lp = p - vec2(-0.25, 0.95);
  col += vec3(0.075, 0.022, 0.032) * exp(-dot(lp, lp) * 0.42);

  /* ---- weave ------------------------------------------------------------
     Two stretched noises crossing, which reads as cloth rather than as static.
     Kept under a percent: at anything more it starts to look like the texture
     of the stroke you are trying to judge. */
  float wx = noise(vec2(p.x * 150.0, p.y * 26.0)) - 0.5;
  float wy = noise(vec2(p.x * 26.0, p.y * 150.0)) - 0.5;
  col *= 1.0 + (wx + wy) * 0.030;
  // A very slow swell, so the surface is not perfectly flat.
  col *= 1.0 + (fbm(p * 0.7 + vec2(t * 0.014, 0.0), 3) - 0.5) * 0.055;

  /* ---- the targets ------------------------------------------------------
     Warm pools under A and B. These are the reason the two dots read as lit
     points on a table rather than as circles printed on a flat colour. */
  float da = length(p - u_a), db = length(p - u_b);
  // Breathes while you have not started, holds still once you have.
  float pulse = mix(0.86 + 0.14 * sin(t * 1.7), 1.0, u_locked);
  col += vec3(0.55, 0.28, 0.10) * exp(-da * da * 34.0) * 0.085 * pulse;
  col += vec3(0.55, 0.28, 0.10) * exp(-db * db * 34.0) * 0.085;

  /* ---- the pen ---------------------------------------------------------- */
  float dp = length(p - u_pen);
  col += vec3(0.42, 0.20, 0.10) * exp(-dp * dp * 26.0) * u_penOn * 0.075;

  /* ---- closing in ------------------------------------------------------- */
  col *= 1.0 - dot(p, p) * 0.115;

  col = aces(col);
  float lum = dot(col, LUMA);
  if (lum > MAX_LUM) col *= MAX_LUM / lum;

  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

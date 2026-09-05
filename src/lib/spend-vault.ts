/**
 * Spend It's balance strip.
 *
 * The bar had a 4px track that filled left to right as you spent, sitting
 * directly under a number that counted *down*. Two readouts of the same
 * quantity, moving in opposite directions. This drains instead, so the strip
 * and the number agree: what you are looking at is the money you still have.
 *
 * Making it a body of liquid rather than a filled rectangle is the point. The
 * game is about a quantity too large to picture — a hundred billion dollars is
 * a number, not an amount — and a level that visibly drops, sloshes when you
 * take from it and runs low is the nearest a bar gets to being a thing you are
 * emptying.
 *
 * No text sits on this, so unlike most of the shaders here it has no luminance
 * cap: the sticky bar's own background is what the balance figure is measured
 * against, and that is untouched.
 */
import { glsl } from './gl'

export const VAULT_FRAG = glsl(`
uniform float u_level;    // 0..1 of the budget still unspent
uniform float u_splash;   // decaying impulse from the most recent purchase
uniform float u_motion;   // 0 under prefers-reduced-motion

void main() {
  vec2 uv = vUv;
  float t = u_time * u_motion;

  /* The strip is far wider than it is tall, so centred() would squash
     everything. Work in uv and correct for the aspect only where it matters. */
  float x = uv.x;
  float y = uv.y;

  /* Authored in sRGB and converted, rather than guessed at in linear. And no
     ACES: this is a UI element with chosen colours and nothing above 1.0, and
     the tonemap was dragging the empty channel toward black on a light page. */
  vec3 emptyTop = toLinear(vec3(0.855, 0.898, 0.878));
  vec3 emptyBot = toLinear(vec3(0.792, 0.851, 0.827));
  vec3 col = mix(emptyBot, emptyTop, y);

  /* The surface. A vertical edge, softened and given a small wobble so it
     reads as a meniscus rather than as the end of a rectangle. The wobble
     settles as the splash decays. */
  float wob = (sin(y * 9.0 + t * 3.1) * 0.4 + sin(y * 21.0 - t * 4.7) * 0.2)
              * 0.006 * (0.25 + u_splash);
  float edge = u_level + wob;
  float body = smoothstep(edge + 0.004, edge - 0.004, x);

  /* The liquid. Green while there is plenty, amber then red as it runs out,
     which is the same signal the balance figure gives when it turns red. */
  vec3 deep = mix(toLinear(vec3(0.059, 0.239, 0.243)), toLinear(vec3(0.290, 0.729, 0.596)), y);
  vec3 low  = mix(toLinear(vec3(0.451, 0.153, 0.106)), toLinear(vec3(0.859, 0.502, 0.259)), y);
  /* A narrow crossover. Over a wide one the mix sits halfway between teal and
     red for most of the endgame, which is olive -- it read as murky rather than
     as a warning. */
  vec3 liquid = mix(low, deep, smoothstep(0.05, 0.13, u_level));

  // Highlights travelling through it, so a full tank is not a flat block.
  float shimmer = fbm(vec2(x * 9.0 - t * 0.35, y * 2.4), 3);
  liquid += toLinear(vec3(0.24, 0.42, 0.34)) * pow(shimmer, 2.6) * 0.7;
  // A bright line just under the surface, where light collects.
  liquid += toLinear(vec3(0.55, 0.88, 0.72)) * smoothstep(0.055, 0.0, abs(x - edge)) * 0.5;

  col = mix(col, liquid, body);

  /* The splash. A pulse that rides back from the surface into the body when
     money leaves, so a purchase is felt on the strip and not only on the
     number above it. */
  float wave = exp(-pow((edge - x) / (0.02 + 0.14 * (1.0 - u_splash)), 2.0));
  col += toLinear(vec3(0.45, 0.80, 0.62)) * wave * body * u_splash * 0.8;

  // A lip along the top edge so the strip reads as a channel cut into the bar.
  col *= 0.88 + 0.12 * smoothstep(0.0, 0.30, y);

  col = clamp(col, 0.0, 1.0);
  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

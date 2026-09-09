/**
 * Life in Weeks' backdrop.
 *
 * The page was a flat #101320 fill behind the card — accurate, but a page
 * whose whole subject is "everything else, and then your one small grid of
 * weeks" can afford to say so. This is a single still frame: a slow vignette
 * plus the same sparse, faint points the grid itself uses for its unlived
 * weeks, so the two surfaces read as one material rather than a graphic
 * dropped onto an unrelated background.
 *
 * `still: true` — the vignette and the stars never move. One thing here does:
 * a warm horizon at the foot of the screen that grows with `u_pct`, the same
 * fraction of ninety years the grid's own gradient runs on. It is the grid's
 * central claim — cool at birth, warm as the years go on — made ambient
 * rather than confined to 4,680 small squares. Before a date is entered
 * `u_pct` is 0 and the term is exactly zero: the page presumes nothing about
 * a life it has not been told the start of.
 */
import { glsl } from './gl'

export const WEEKS_FIELD_FRAG = glsl(`
uniform float u_pct; // 0..1 — weeks lived, over ninety years. 0 until a date is entered.

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  vec3 col = vec3(0.035, 0.041, 0.070);
  col *= 1.0 - dot(p, p) * 0.16;
  float g = fbm(p * 1.6 + 11.0, 4);
  col += vec3(0.03, 0.03, 0.05) * (g - 0.5);
  float star = step(0.9935, hash21(floor(uv * u_res / 3.0)));
  col += vec3(0.5, 0.58, 0.82) * star * 0.5;

  /* uv.y is 0 at the bottom of the viewport and 1 at the top (the grid's own
     shader takes the same convention and says so). The glow sits low and
     fades upward, so it reads as a horizon rather than a light dropped in the
     middle of the sky. */
  float horizon = smoothstep(0.55, 1.0, 1.0 - uv.y) * u_pct;
  col += vec3(0.62, 0.40, 0.16) * horizon * 0.20;

  col = aces(col * 1.02);
  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

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
 * `still: true` — this is the one surface on the page that never moves. The
 * grid's current-week pulse is the only thing here that should draw the eye.
 */
import { glsl } from './gl'

export const WEEKS_FIELD_FRAG = glsl(`
void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  vec3 col = vec3(0.035, 0.041, 0.070);
  col *= 1.0 - dot(p, p) * 0.16;
  float g = fbm(p * 1.6 + 11.0, 4);
  col += vec3(0.03, 0.03, 0.05) * (g - 0.5);
  float star = step(0.9935, hash21(floor(uv * u_res / 3.0)));
  col += vec3(0.5, 0.58, 0.82) * star * 0.5;
  col = aces(col * 1.02);
  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

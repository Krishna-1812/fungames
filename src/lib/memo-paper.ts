/**
 * From Memory's paper.
 *
 * This is a drawing game, and the surface you draw on was a flat fill with a
 * ruling underneath it that never showed: the CSS stacked an opaque
 * `linear-gradient(#fdf7fa 0 0)` on top of the repeating ruling, and in CSS the
 * first background layer paints last. The lines were there in the stylesheet
 * and had never once reached a screen.
 *
 * Rather than reorder two gradients, this is the paper itself — laid fibres,
 * ruling printed into them rather than sitting on top, and the faint darkening
 * a sheet picks up where it meets the edge of the pad. It never animates:
 * `still: true`, one frame on mount and one per resize. Paper does not move,
 * and a page whose entire subject is your own hand should not have anything
 * else twitching on it.
 *
 * No ACES here, for the same reason cascade-paper.ts has none: the tonemapper
 * exists to stop bright cores clipping, and applied to a sheet of paper it
 * takes 0.94 down to 0.80 and turns white into grey. Authored in sRGB and
 * clamped instead.
 */
import { glsl } from './gl'

/*
 * Floor for the paper's luminance.
 *
 * The ink is #2a1026, L = 0.0098. WCAG's 4.5:1 needs the sheet under it at
 * L >= 4.5 * (0.0098 + 0.05) - 0.05 = 0.219. The floor below is far above
 * that, which is the point: it means no amount of later fiddling with fibres
 * or shading can quietly make a drawing hard to see.
 */
const MIN_LUM = 0.80

export const PAPER_FRAG = glsl(`
#define MIN_LUM ${MIN_LUM}

void main() {
  vec2 uv = vUv;
  // Aspect-corrected, so the fibres do not stretch when the pad reflows.
  vec2 p = vec2(uv.x * (u_res.x / max(u_res.y, 1.0)), uv.y);

  // Authored as sRGB, because that is how anyone picks a paper colour.
  vec3 base = toLinear(vec3(0.992, 0.969, 0.980));

  /* Laid fibres. Two passes at right angles: paper is pressed from a slurry
     that is drained in one direction, so the grain is real and it is
     anisotropic. One isotropic noise field reads as dirt instead. */
  float fx = fbm(p * vec2(58.0, 340.0), 3);
  float fy = fbm(p * vec2(310.0, 51.0) + 21.0, 3);
  float fibre = (fx - 0.5) * 0.020 + (fy - 0.5) * 0.014;

  // Cloudy variation in the pulp, an order of magnitude broader than the
  // fibres, which is what keeps the grain from reading as a screen door.
  float pulp = (fbm(p * 3.1 + 7.0, 3) - 0.5) * 0.016;

  vec3 col = base * (1.0 + fibre + pulp);

  /* Ruling. Printed into the sheet: the line is multiplied by the fibre field,
     so it breaks up over the raised grain exactly the way a real ruled line
     does, instead of sitting on the surface as a perfect 1px rectangle. */
  float ry = fract(uv.y * 8.0 + 0.18);
  float line = smoothstep(0.030, 0.0, min(ry, 1.0 - ry));
  line *= 0.62 + 0.55 * fx;
  col = mix(col, toLinear(vec3(0.965, 0.906, 0.941)), line);

  // The sheet meeting the edge of the pad. Very slight, and only a darkening:
  // a highlight here would read as a glow rather than as a shadow.
  float edge = smoothstep(0.0, 0.035, uv.x) * smoothstep(1.0, 0.965, uv.x)
             * smoothstep(0.0, 0.050, uv.y) * smoothstep(1.0, 0.950, uv.y);
  col *= 0.955 + 0.045 * edge;

  // A floor rather than a clamp per channel, so the tint survives it.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= max(1.0, MIN_LUM / max(lum, 1e-5));

  col = clamp(col, 0.0, 1.0);
  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)


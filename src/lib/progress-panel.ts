/**
 * Progress's backdrop: the panel the instrument is bolted to.
 *
 * This replaces a core sample — strata getting older and slower as the page
 * went down. That was a good idea and it is not this one. Once the meters
 * became a machined dial, a page with a chronometer in the middle of a rock
 * face was making two arguments at once, and the rock's version of "deeper is
 * older" was the weaker of the two now that the rings say it directly.
 *
 * So the page is one object: a wall panel, an instrument screwed to it, and a
 * data plate under that. Scrolling travels down the panel rather than sliding
 * a fixed image around, and the single overhead lamp falls off as you go — by
 * the bottom of the page you are reading the Sun's row by whatever light is
 * left, which is the only bit of the old idea worth keeping.
 *
 * Deliberately very dark. Every pixel sits behind body text, so the output is
 * clamped to MAX_LUM rather than trusted to stay quiet on its own.
 */
import { glsl } from './gl'

/*
 * Relative luminance ceiling for anything this shader emits.
 *
 * The dimmest text on the page is #a08cbb at 12px, L = 0.298. WCAG needs 4.5:1
 * for that, so the brightest the ground under it may be is
 *   (0.298 + 0.05) / 4.5 - 0.05 = 0.0274
 *
 * The number below is lower, and not as a fudge. toSRGB() here is pow(1/2.2)
 * while WCAG decodes with the real sRGB curve, and the two do not agree at
 * this end: a cap of 0.026 measured back off the framebuffer as 0.031 and put
 * the contrast at 4.30:1. 0.021 reads back as 0.025, which is 4.63:1. Measured
 * on the actual framebuffer, not derived.
 *
 * A cap makes the contrast a fact about the shader rather than a hope about
 * the art: whatever colours get authored here later, it still holds.
 */
const MAX_LUM = 0.021

export const PANEL_FRAG = glsl(`
uniform float u_scroll;   // 0..1 through the document
uniform float u_motion;   // 0 under prefers-reduced-motion

#define MAX_LUM ${MAX_LUM}

void main() {
  vec2 uv = vUv;
  float t = u_time * u_motion;
  float asp = u_res.x / max(u_res.y, 1.0);

  // The viewport is a window onto a much taller panel.
  float y = (1.0 - uv.y) * 0.30 + u_scroll * 0.70;
  vec2 w = vec2(uv.x * asp, y * 2.6);

  /* Brushed steel. A wall panel is drawn across its width, so the marks run
     horizontally: fast variation in y, slow in x. Get this the other way round
     and it reads as woodgrain. */
  float brush = noise(vec2(w.x * 2.2, w.y * 520.0)) * 0.6
              + noise(vec2(w.x * 5.7 + 9.0, w.y * 1400.0)) * 0.4;
  float mottle = fbm(w * vec2(1.6, 1.2), 4);

  vec3 steel = vec3(0.30, 0.27, 0.40);
  vec3 col = steel * (0.0055 + 0.0165 * brush) * (0.72 + 0.50 * mottle);

  /* Panel joints. Two plates meet every 0.62 of a screen height: a dark gap
     with a lit lip on the upper side, because the light is above. */
  float jf = fract(w.y / 0.62);
  float jd = min(jf, 1.0 - jf) * 0.62;
  col *= 1.0 - 0.55 * smoothstep(0.006, 0.0, jd);
  col += vec3(0.50, 0.44, 0.66) * smoothstep(0.004, 0.0, abs(jd - 0.009)) * step(jf, 0.5) * 0.011;

  /* Rivets, on the joints. Domed, so each has a lit crown at the upper left
     and its own small shadow at the lower right. */
  vec2 rg = vec2(w.x / 0.21, w.y / 0.62);
  vec2 rc = (fract(rg) - 0.5) * vec2(0.21, 0.62);
  float rr = length(rc / vec2(1.0, 1.0)) / 0.020;
  if (rr < 1.6) {
    float dome = sqrt(max(0.0, 1.0 - rr * rr));
    vec3 N = normalize(vec3(rc / 0.020, max(dome, 0.001) * 1.5));
    vec3 L = normalize(vec3(-0.5, 0.62, 0.60));
    float sh = max(dot(N, L), 0.0);
    vec3 rivet = vec3(0.34, 0.31, 0.44) * (0.004 + 0.030 * pow(sh, 2.2));
    col = mix(col, rivet, smoothstep(1.06, 0.94, rr));
    // Contact shadow, offset opposite the light.
    col *= 1.0 - 0.45 * smoothstep(1.5, 1.0, length((rc + vec2(0.0035, -0.0035)) / 0.020))
                     * smoothstep(0.94, 1.10, rr);
  }

  /* The lamp. One source, above and slightly left, and everything on this page
     is only as visible as it makes it. The falloff is why the bottom of the
     list is harder to read than the top, which is the point. */
  vec2 lampP = vec2(0.42 * asp, -0.30);
  float ld = length(vec2(uv.x * asp, y * 2.6) - lampP);
  float lamp = 1.0 / (1.0 + ld * ld * 2.4);
  col *= 0.22 + 1.55 * lamp;

  /* Dust in the beam. Only near the lamp — a mote is only ever visible in the
     light, which is the entire reason a beam is a thing you can see. */
  vec2 g = vec2(uv.x * 22.0 * asp, uv.y * 26.0 + t * 0.16);
  vec2 gi = floor(g), gf = fract(g);
  vec2 o = hash22(gi);
  float mote = exp(-pow(length(gf - o) * 7.0, 2.0)) * step(o.x, 0.13);
  col += vec3(0.80, 0.70, 0.98) * mote * 0.075 * lamp * smoothstep(0.30, 1.0, uv.y);

  // The wall falls away at the sides.
  col *= 0.42 + 0.58 * smoothstep(0.0, 0.34, uv.x) * smoothstep(1.0, 0.66, uv.x);

  /* Added last, after every attenuation above, so it is a floor rather than
     something the vignettes can eat. The surface is opaque: without this the
     darkest corners would come out blacker than the page colour they are
     supposed to be part of. */
  col += vec3(0.00694, 0.00274, 0.01444);

  col = aces(col);

  /* The cap, applied after tonemapping so it constrains what actually reaches
     the screen. Scaling by luminance rather than clamping each channel keeps
     the hue: a per-channel clamp on a violet turns it grey at the top end. */
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= min(1.0, MAX_LUM / max(lum, 1e-5));

  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

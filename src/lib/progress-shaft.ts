/**
 * Progress's backdrop: a shaft cut down through time.
 *
 * The page is a list of thirteen units, ordered from the minute you are in to
 * the lifetime of the Sun, and the order is the whole argument — each row
 * contains every row above it. The page drew that as a flat colour, so the
 * ordering existed only in the reading.
 *
 * This is a core sample. Strata get older, darker and more compressed as they
 * go down, and each band drifts at a slower rate than the one above it, so the
 * top of the shaft is visibly moving and the bottom has not changed since you
 * opened the tab. Nothing here is decoration bolted on: it is the same claim
 * the list makes, made by the background.
 *
 * Deliberately very dark. Every pixel of this sits behind body text, so the
 * output is clamped to MAX_LUM (see the note there) rather than trusted to
 * stay quiet on its own.
 */
import { glsl } from './gl'

/*
 * Relative luminance ceiling for anything this shader emits.
 *
 * The dimmest text on the page is #a08cbb at 12px, L = 0.298. WCAG needs 4.5:1
 * for that, so the brightest the ground under it may be is
 *   (0.298 + 0.05) / 4.5 - 0.05 = 0.0274
 *
 * The number below is lower than that, and not as a fudge. toSRGB() here is
 * pow(1/2.2), while WCAG decodes with the real sRGB curve, and the two do not
 * agree down at this end: a cap of 0.026 measured back off the framebuffer as
 * 0.031 and put the contrast at 4.30:1. 0.021 reads back as 0.025, which is
 * 4.63:1. Measured on the actual framebuffer, not derived.
 *
 * A cap makes the contrast a fact about the shader rather than a hope about
 * the art: whatever colours get authored here later, it still holds.
 */
const MAX_LUM = 0.021

export const SHAFT_FRAG = glsl(`
uniform float u_scroll;   // 0..1 through the document
uniform float u_motion;   // 0 under prefers-reduced-motion

#define MAX_LUM ${MAX_LUM}

/** Depth of a band, 0 at the top of the page, 1 at the bottom. */
float bandDrift(float b) {
  // Each band is ~2.6x slower than the one above it. Thirteen rows of the list
  // span fifteen orders of magnitude of real rate; eight bands of 2.6x span
  // about three, which is as much as can be shown without half of them
  // becoming indistinguishable from stopped.
  return pow(0.62, b);
}

void main() {
  vec2 uv = vUv;
  float t = u_time * u_motion;

  // The viewport is a window onto a much taller shaft, so scrolling the page
  // moves the rock past rather than sliding a fixed image around.
  float y = (1.0 - uv.y) * 0.34 + u_scroll * 0.66;

  /* Bedding planes are not spirit levels. Straight horizontal seams across a
     page read as rules in the UI rather than as rock, so the band boundary is
     pushed around by a slow function of x before anything is cut from it. */
  float yb = y + (noise(vec2(uv.x * 1.7, 4.0)) - 0.5) * 0.011
               + (noise(vec2(uv.x * 5.1, 9.0)) - 0.5) * 0.004;

  const float BANDS = 8.0;
  float fb = yb * BANDS;
  float b = floor(fb);
  float inB = fract(fb);

  // Rock. Stretched hard in x so the grain reads as bedding rather than cloud.
  float drift = t * bandDrift(b) * 0.030;
  vec2 q = vec2(uv.x * 1.35 + drift + b * 4.7, y * 6.5);
  float rock = fbm(q * vec2(1.0, 3.4), 4);
  float veins = ridge(q * vec2(2.1, 5.0) + 11.0, 3);

  // Older is darker: the far end of this page is five billion years long.
  float age = 1.0 - y * 0.55;

  vec3 warm = vec3(0.62, 0.30, 0.95);
  vec3 cold = vec3(0.24, 0.16, 0.52);
  vec3 col = mix(cold, warm, rock) * (0.006 + 0.030 * rock) * age;
  col += vec3(0.55, 0.32, 0.80) * pow(veins, 3.0) * 0.026 * age;

  // The bedding planes. A thin bright seam at each boundary, which is what
  // makes a core sample read as layered rather than as noise.
  float seam = smoothstep(0.030, 0.0, min(inB, 1.0 - inB));
  col += vec3(0.70, 0.46, 0.92) * pow(seam, 1.6) * 0.040 * age;

  /* Dust, falling. Only near the top: it is the fast half of the page, and a
     mote drifting past the millennium would be claiming something untrue. */
  vec2 g = vec2(uv.x * 26.0, uv.y * 30.0 + t * 0.22);
  vec2 gi = floor(g), gf = fract(g);
  vec2 o = hash22(gi);
  float mote = exp(-pow(length(gf - o) * 7.0, 2.0)) * step(o.x, 0.14);
  col += vec3(0.80, 0.62, 0.98) * mote * 0.09 * smoothstep(0.55, 1.0, uv.y);

  // Walls. The shaft is narrower than the viewport on a wide screen, and the
  // list sits in the lit part of it.
  float wall = smoothstep(0.0, 0.30, uv.x) * smoothstep(1.0, 0.70, uv.x);
  col *= 0.35 + 0.65 * wall;
  // Mouth of the shaft, so the header does not sit on a hard edge.
  col *= smoothstep(0.0, 0.14, uv.y) * (0.55 + 0.45 * smoothstep(1.0, 0.80, uv.y));

  /* Added last, and after every attenuation above, so it is a floor rather
     than something the vignettes can eat. The surface is opaque: without this
     the darkest corners of the shader would come out blacker than the page
     colour they are supposed to be part of. */
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

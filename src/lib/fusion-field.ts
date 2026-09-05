/**
 * Fusion's board.
 *
 * The game is two things going in and one new thing coming out, and the board
 * they met on was a flat #16122e rectangle. Every bit of the drama lived in the
 * particle burst that fired *after* the merge had already happened — the moment
 * itself, which is the whole game, had no picture at all.
 *
 * So the board is a field now, and it does four jobs:
 *
 *   1. **Somewhere to be.** A slow drifting nebula with motes in it, which
 *      thickens as you discover more, so a board with sixty things on it feels
 *      like a fuller world than one with four.
 *   2. **Something in your hand.** A soft aura follows the piece being dragged.
 *   3. **Tension before the merge.** A filament joins the dragged piece to the
 *      nearest other one, strengthening as you close on it, with charge running
 *      along it. Keyed to proximity rather than to the hit test: the hit test
 *      only fires once two pieces already overlap, so a filament driven by it
 *      could never be longer than it was wide and drew a blob instead of a
 *      line. This way it tells you what you are about to land on while you can
 *      still change your mind.
 *   4. **The merge.** A shockwave and a flash at the point of fusion, gold for
 *      a first discovery and violet for something you already had.
 *
 * ## The luminance cap, and what is deliberately outside it
 *
 * The 'Drag one thing onto another' hint is white at 0.62 opacity directly on
 * this field, so the ambient layers are capped at a known relative luminance
 * and its contrast is computed against that rather than hoped for.
 *
 * The bond and the flash are added *after* the cap, on purpose. Both are
 * transient, both are small, and neither can exist while the hint does: the
 * hint is hidden on the first pointerdown, and a flash requires a completed
 * drag. Capping them too would have meant a fusion that barely registers in
 * order to protect a line of text that is no longer on screen.
 */
import { glsl } from './gl'

export const FIELD_FRAG = glsl(`
uniform vec2  u_drag;      // held piece, in centred() space
uniform float u_dragOn;
uniform vec2  u_bond;      // the piece it is over
uniform float u_bondOn;
uniform vec2  u_flash;     // where the last fusion happened
uniform float u_flashT;    // seconds since; large means none
uniform float u_flashNew;  // 1 if it was a first discovery
uniform float u_rich;      // 0..1, how much has been discovered
uniform float u_motion;    // 0 under prefers-reduced-motion

/* Ambient ceiling, as a WCAG relative luminance, applied after the tonemap.
   See the note at the top of this file for what sits outside it and why. */
#define MAX_AMBIENT 0.085
#define LUMA vec3(0.2126, 0.7152, 0.0722)

/** Distance to a segment, and how far along it we are. */
float segDist(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

/** Sparse points on a jittered lattice. Cheaper than any particle system. */
float motes(vec2 p, float t) {
  float acc = 0.0;
  for (int k = 0; k < 2; k++) {
    float sc = 5.0 + float(k) * 7.0;
    vec2 q = p * sc + vec2(t * (0.03 + 0.02 * float(k)), t * 0.015);
    vec2 i = floor(q), f = fract(q);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash22(i + g);
        // Only a fraction of cells carry a mote, or it reads as a grid.
        if (o.x > 0.34) continue;
        vec2 c = g + vec2(o.y, fract(o.x * 31.7));
        float d = length(f - c);
        float tw = 0.55 + 0.45 * sin(t * 1.6 + o.y * 40.0);
        acc += exp(-d * d * 190.0) * tw * (1.0 - float(k) * 0.45);
      }
    }
  }
  return acc;
}

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  float t = u_time * u_motion;

  /* ---- 1. the void ------------------------------------------------------- */
  vec3 col = mix(vec3(0.0130, 0.0096, 0.0345), vec3(0.0300, 0.0210, 0.0700), uv.y);

  /* ---- 2. the nebula -----------------------------------------------------
     Domain-warped, so it has flow rather than being cloud-shaped static. It
     thickens with what you have found: an empty board is nearly bare, a full
     one has weather in it. */
  vec2 w = vec2(fbm(p * 0.55 + vec2(t * 0.012, 0.0), 4),
                fbm(p * 0.55 + vec2(4.7, 1.9) - t * 0.010, 4));
  float neb = fbm(p * 0.75 + w * 1.8, 5);
  float amt = 0.030 + 0.075 * u_rich;
  col += mix(vec3(0.22, 0.09, 0.52), vec3(0.42, 0.16, 0.62), neb) * pow(neb, 2.2) * amt;

  /* ---- 3. motes ---------------------------------------------------------- */
  col += vec3(0.55, 0.48, 0.85) * motes(p, t) * (0.014 + 0.020 * u_rich);

  /* ---- 4. what is in your hand ------------------------------------------- */
  float dd = length(p - u_drag);
  col += vec3(0.34, 0.16, 0.62) * exp(-dd * dd * 11.0) * u_dragOn * 0.12;

  // Everything above is ambient: the hint text sits on it, so it is capped.
  col = aces(col);
  float lum = dot(col, LUMA);
  if (lum > MAX_AMBIENT) col *= MAX_AMBIENT / lum;

  /* ---- 5. the bond -------------------------------------------------------
     Strength comes from how close the two are, so the link forms on approach
     and goes taut on arrival. */
  if (u_bondOn > 0.001) {
    float h;
    float sd = segDist(p, u_drag, u_bond, h);
    // Thinner in the middle, so it reads as drawn taut between the two.
    float wdt = 0.030 - 0.012 * sin(h * PI);
    float core = exp(-pow(sd / wdt, 2.0));
    // Charge running from the held piece toward the target.
    float run = 0.5 + 0.5 * sin(h * 26.0 - t * 9.0);
    vec3 bc = mix(vec3(0.55, 0.22, 1.00), vec3(1.00, 0.78, 0.35), run * 0.55);
    col += bc * core * u_bondOn * (0.55 + 0.75 * run);
    // A wider, dimmer halo so the filament has somewhere to sit.
    col += vec3(0.35, 0.15, 0.70) * exp(-pow(sd / 0.11, 2.0)) * u_bondOn * 0.14;
  }

  /* ---- 6. the merge ------------------------------------------------------ */
  if (u_flashT < 1.1) {
    float age = max(u_flashT, 0.0);
    float fade = 1.0 - age / 1.1;
    float fd = length(p - u_flash);
    vec3 hot = mix(vec3(0.75, 0.35, 1.0), vec3(1.0, 0.80, 0.34), u_flashNew);

    // The core: bright, and gone in a quarter of a second.
    col += hot * exp(-fd * fd * 26.0) * exp(-age * 11.0) * 2.6;
    // The shockwave: expands and thins, which is what sells it as a release of
    // energy rather than as a circle being drawn.
    float r = age * 1.35;
    float ring = exp(-pow((fd - r) / (0.035 + age * 0.10), 2.0));
    col += hot * ring * fade * fade * 1.5;
  }

  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

/**
 * Overstimulated's environment.
 *
 * The game already escalates: notifications, popups, confetti, ghost cursors,
 * animals, a tilt. But every one of those is a foreground object, and they were
 * all floating on a flat near-black plane. The page got busier without ever
 * getting *louder*, and the joke is about volume.
 *
 * So the background is now a layered field driven by how much you own. It
 * starts at almost nothing — the page has to open calm or the escalation has no
 * baseline to escalate from — and then, one purchase at a time, it grows a
 * breathing bloom, a rotating vortex, rings that pump on the bassline, a
 * scanning band, a grid, chromatic fringing, grain, and a vignette that closes
 * in. By the end the room itself is shouting.
 *
 * Which makes "Make it stop" land: everything here falls to a dead flat plate
 * in about a second, and the silence is the payoff for the whole game.
 *
 * ## Photosensitivity
 *
 * A full-screen shader that strobes is a genuine seizure risk, so this one does
 * not. WCAG 2.3.1 allows at most three flashes per second; the bassline runs at
 * 260 ms, which is 3.85 Hz and over that line. The beat therefore drives
 * *rings* — bounded, moving, small in area — and never a full-field brightness
 * change. All whole-field variation comes from the breathing term at roughly
 * 0.3 Hz. Intensity is carried by density, motion and colour, which is both
 * safer and a better picture of what being overstimulated is actually like.
 */
import { glsl } from './gl'

export const OVER_FRAG = glsl(`
uniform float u_load;    // 0..1, fraction of the upgrades owned
uniform float u_beat;    // seconds since the last bassline beat
uniform float u_click;   // 0..1, decaying impulse from the big button
uniform float u_hue;     // radians of hue rotation once Colour is bought
uniform float u_calm;    // 0..1, how far into the ending we are
uniform vec2  u_focus;   // centre of the core column, in centred() space
uniform float u_motion;  // 0 under prefers-reduced-motion

/* The most a pixel of this background is ever allowed to reach, as a WCAG
   relative luminance. It is applied after the tonemap, so it is the number that
   goes straight into a contrast ratio: every label on the page can then be
   checked against a known worst case instead of against whatever the layers
   happened to sum to on the day. */
#define MAX_LUM 0.10
#define LUMA vec3(0.2126, 0.7152, 0.0722)

/* The plate, already tonemapped. The centre well mixes toward this. */
#define PLATE_OUT vec3(0.00099, 0.0000043, 0.00369)

/** Rodrigues rotation about the grey axis: a real hue rotate, not a channel swap. */
vec3 hueRot(vec3 c, float a) {
  const vec3 k = vec3(0.57735027);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

/**
 * One expanding ring. Bounded in area and always moving, so a train of these
 * at four a second is nothing like a four-hertz flash.
 */
float ring(float d, float age) {
  if (age < 0.0 || age > 1.15) return 0.0;
  float r = age * 0.80;
  float w = 0.030 + age * 0.055;
  float x = (d - r) / w;
  return exp(-x * x) * (1.0 - age / 1.15);
}

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  /* Every moving term in here is derived from t, so zeroing it freezes the
     whole field in one place. Under reduced motion the escalation still has to
     happen -- it is what the game is about, not decoration -- it just has to
     happen as a series of still images rather than as a rotating vortex. */
  float t = u_time * u_motion;
  /* Everything radial is centred on the core column, not on the viewport.
     They are not the same place: below 760px the shop moves to the bottom and
     the score sits in the upper half, so a viewport-centred vortex put its calm
     middle a long way below the text it was supposed to be protecting. */
  vec2 q = p - u_focus;
  float d = length(q);
  float a = atan(q.y, q.x);

  // Everything below is gated on this, and it only ever reaches 1.0 when there
  // is genuinely nothing left to buy.
  float L = clamp(u_load, 0.0, 1.0) * (1.0 - u_calm);

  /* ---- 1. the plate ------------------------------------------------------
     What the page looked like before any of this: a very dark violet. At zero
     upgrades this is the only layer that runs, and it is deliberately close to
     the flat colour it replaces. */
  /* These are linear, and they land after ACES and the gamma encode, so they
     are nothing like the hex they produce. Solved against the tail of this
     shader so the bottom is exactly the #0b0114 the page used to be: authoring
     them by eye as if they were sRGB rendered the resting page at rgb(32,12,44),
     three times too bright, and the game has to open quiet. */
  vec3 col = mix(vec3(0.00361, 0.00002, 0.00986), vec3(0.01223, 0.00112, 0.02630), uv.y);

  /* ---- 2. the bloom ------------------------------------------------------
     A slow breath behind the button. 0.3 Hz: this is the only layer allowed to
     move the whole field's brightness, and it is far below the flash limit. */
  float breath = 0.5 + 0.5 * sin(t * 1.9);
  float bloom = exp(-d * d * 2.2) * (0.55 + 0.45 * breath);
  col += vec3(0.34, 0.07, 0.42) * bloom * (0.012 + 0.34 * L);

  /* ---- 3. the vortex -----------------------------------------------------
     Rays turning around the middle. The count climbs with the load, so it goes
     from a gentle rotation to something that genuinely hurts to look at, and
     the r^1.6 term keeps the centre clear where the score sits. */
  if (L > 0.16) {
    float k = smoothstep(0.16, 0.62, L);
    float arms = 5.0 + 24.0 * k;
    float spin = t * (0.22 + 0.85 * k);
    float v = sin(a * arms + spin + sin(d * 5.0 - t * 1.2) * 1.4) * 0.5 + 0.5;
    v = pow(v, 2.4) * smoothstep(0.10, 0.95, pow(d, 1.6));
    col += mix(vec3(0.22, 0.05, 0.40), vec3(0.62, 0.10, 0.34), k) * v * k * 0.20;
  }

  /* ---- 4. the beat -------------------------------------------------------
     Three rings in flight at once, spaced by the interval the bassline runs at,
     so the train is continuous rather than one ring popping in and out. */
  if (L > 0.20) {
    float k = smoothstep(0.20, 0.55, L);
    float r = ring(d, u_beat) + ring(d, u_beat + 0.26) + ring(d, u_beat + 0.52);
    col += vec3(0.50, 0.20, 0.70) * r * k * 0.20;
  }

  /* ---- 5. the scan -------------------------------------------------------
     A band sweeping down the page, the way a screen you have been staring at
     too long starts to seem to do. */
  if (L > 0.42) {
    float k = smoothstep(0.42, 0.80, L);
    float y = fract(uv.y * 0.5 - t * 0.10);
    float band = exp(-pow((y - 0.5) / 0.10, 2.0));
    col += vec3(0.16, 0.30, 0.42) * band * k * 0.18;
    // Fine scanlines on top, only once it is already loud.
    col += vec3(0.05, 0.02, 0.08) * sin(uv.y * u_res.y * 0.55) * k * 0.22;
  }

  /* ---- 6. the grid -------------------------------------------------------
     Perspective floor lines. The last structural layer, and the one that
     finally makes the page feel like it has a bottom falling out of it. */
  if (L > 0.60) {
    float k = smoothstep(0.60, 0.95, L);
    vec2 g = vec2(p.x / max(0.06, abs(p.y)), 1.0 / max(0.06, abs(p.y)) - t * 0.5);
    vec2 f = abs(fract(g * 1.4) - 0.5);
    /* Faded toward the horizon, not away from it. The 1/y term makes the lines
       converge without limit as p.y approaches zero, so full strength there was
       aliasing into shimmer at exactly the densest point. */
    float line = (1.0 - smoothstep(0.0, 0.06, min(f.x, f.y))) * smoothstep(0.10, 0.42, abs(p.y));
    col += vec3(0.42, 0.10, 0.52) * line * k * 0.22;
  }

  /* ---- 7. the click ------------------------------------------------------
     Deliberately small. A player can click ten times a second, and a bright
     impulse under the button at ten hertz is precisely the thing the note at the
     top of this file rules out. It reads as the button having weight, not as a
     flash. */
  col += vec3(0.55, 0.30, 0.16) * exp(-d * 4.4) * u_click * 0.07;

  /* ---- 8. fringing, grain, vignette -------------------------------------- */

  // Cheap chromatic split: push the channels apart radially rather than
  // resampling the field three times.
  float fringe = smoothstep(0.55, 1.0, L) * 0.16;
  col.r *= 1.0 + fringe * d;
  col.b *= 1.0 + fringe * (1.0 - d) * 1.4;

  col = hueRot(col, u_hue);

  // Grain arrives late and gets coarse, which reads as a signal degrading.
  float grain = hash21(uv * u_res + floor(t * 24.0) * 37.0) - 0.5;
  // 0.012 was worth sixteen 8-bit steps against a plate this dark, which buried
  // the resting page in static. One step at rest, coarse only once it is loud.
  col += grain * (0.0009 + 0.030 * smoothstep(0.45, 1.0, L));

  // The walls closing in. Bounded so the corners never go fully black, which
  // would swallow the shop's edge.
  col *= 1.0 - dot(p, p) * (0.10 + 0.30 * L);

  // The ending. Everything above is already multiplied out by u_calm; this is
  // the flat plate it lands on.
  col = mix(col, vec3(0.00310, 0.00002, 0.00840), u_calm);

  col = aces(col);

  // The ceiling, in the same space the contrast ratios are computed in.
  float lum = dot(col, LUMA);
  if (lum > MAX_LUM) col *= MAX_LUM / lum;

  /* The centre stays readable, and this now runs after the tonemap and the
     cap so what it guarantees is a luminance rather than a pre-tonemap number
     that means nothing on its own. The score, its label and the line under it
     all sit in here; the joke only works if the thing you are staring at stays
     perfectly legible while everything around it falls apart. */
  float well = smoothstep(0.12, 0.78, d);
  col = mix(col * 0.20 + PLATE_OUT * 0.80, col, well);

  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

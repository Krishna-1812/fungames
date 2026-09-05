/**
 * Ambient Mix's field.
 *
 * The page's whole pitch is that nothing on it is a recording — every layer is
 * synthesised live in the audio graph. The only visual it had was four bars per
 * card bouncing on a fixed CSS keyframe, staggered by animation-delay. They
 * looked like a level meter and were not one: they moved identically whether
 * the layer was rain or thunder, and identically whether the volume was at
 * full or at one percent. On a page that makes a point of being genuine, the
 * one piece of feedback was theatre.
 *
 * This is driven by an AnalyserNode on the master bus, so the ridges are the
 * actual spectrum of whatever you have mixed. Bass on the left, treble on the
 * right, three layers at different amplitudes so it reads as a landscape
 * rather than as a bar chart.
 *
 * It has a resting state on purpose. In silence the ridges settle to a low
 * slow swell instead of a flat line, because a dead rectangle above the
 * controls would look broken rather than quiet.
 */
import { glsl } from './gl'

export const MIX_FRAG = glsl(`
uniform float u_spec[32];   // smoothed FFT magnitudes, 0..1, bass to treble
uniform float u_level;      // overall loudness, 0..1
uniform float u_live;       // 0 until the sound is switched on
uniform float u_motion;     // 0 under prefers-reduced-motion

/** Linear sample across the bins. Dynamic indexing of a uniform array is
    allowed in GLSL ES 3.00, which is what makes this possible at all. */
float spec(float x) {
  float f = clamp(x, 0.0, 1.0) * 31.0;
  int i = int(floor(f));
  int j = min(i + 1, 31);
  return mix(u_spec[i], u_spec[j], f - float(i));
}

vec3 tintOf(int k) {
  if (k == 0) return vec3(0.10, 0.36, 0.66);
  if (k == 1) return vec3(0.13, 0.58, 0.52);
  return vec3(0.40, 0.26, 0.64);
}

/**
 * One ridge.
 *
 * The raw FFT is spiky, and a spiky silhouette reads as a bar chart. Three
 * neighbouring samples blurred together give something with a shape to it.
 */
float ridgeAt(float x, float t, float k) {
  float s = spec(x) * 0.5 + spec(x + 0.045) * 0.25 + spec(x - 0.045) * 0.25;
  float breathe = 0.5 + 0.5 * sin(t * 0.45 + x * 4.6 + k * 2.3);
  return 0.085 + 0.055 * breathe + s * (0.62 - k * 0.13) * u_live;
}

void main() {
  vec2 uv = vUv;
  float t = u_time * u_motion;

  // The page's own colour, so the band sits in it rather than on it.
  vec3 col = mix(vec3(0.0130, 0.0290, 0.0470), vec3(0.0225, 0.0450, 0.0700), uv.y);

  for (int k = 0; k < 3; k++) {
    float kk = float(k);
    /* No horizontal scroll: the x axis IS the frequency axis, so sliding it
       would make the picture stop meaning anything. The layers are separated
       by amplitude and by the phase of their swell instead. */
    float h = ridgeAt(uv.x, t, kk) * (1.0 - kk * 0.16) + kk * 0.045;
    float body = smoothstep(h + 0.015, h - 0.015, uv.y);
    float glow = exp(-pow((uv.y - h) / 0.085, 2.0));
    vec3 c = tintOf(k);
    col += c * body * (0.14 + 0.30 * u_level) * (1.0 - kk * 0.22);
    col += c * glow * (0.09 + 0.42 * u_level);
  }

  /* Sparkle on the top end. Driven by the treble bins, so a hiss-heavy mix
     glitters and a mix of thunder and waves does not. */
  float treble = (spec(0.70) + spec(0.84) + spec(0.96)) / 3.0;
  vec2 g = vec2(uv.x * 46.0, uv.y * 14.0 - t * 0.35);
  vec2 gi = floor(g), gf = fract(g);
  vec2 o = hash22(gi);
  float d = length(gf - o);
  float mote = exp(-d * d * 60.0) * step(o.x, 0.30);
  col += vec3(0.55, 0.78, 0.95) * mote * treble * u_live * 0.85;

  // Edges pulled down so the band reads as part of the page, not a pasted box.
  col *= smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x);

  col = aces(col);
  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

/**
 * Deep Time's sky.
 *
 * The page's scroll→years mapping and its lane layout are untouched. This
 * replaces the background, which was a CSS gradient between two colours per
 * act.
 *
 * A gradient can only say "this bit is a different colour from that bit". The
 * Earth actually looked like several very different planets over 4.54 billion
 * years, and the changes were not gradual — they were the events the page is
 * already listing. So the background is now five rendered worlds keyed to the
 * year on screen:
 *
 *   molten       4.54–4.0 Ga   a magma surface, cracked and glowing
 *   archean      4.0–2.4 Ga    orange methane haze over a dark ocean
 *   proterozoic  2.4–0.54 Ga   oxygen: banded iron, green sea, ice
 *   phanerozoic  541–2.6 Ma    land, plants, a sun that finally shows
 *   modern       2.6 Ma–now    the sky you would recognise
 *
 * They cross-fade against log(years), which is the axis the page's acts are
 * built on, so each transition lands near the event that caused it: the
 * Great Oxidation genuinely turns the sea green under you.
 *
 * The CSS gradient stays behind this for anything without WebGL2.
 */
import { glsl } from './gl'

export const TIME_FRAG = glsl(`
uniform float u_L;   // log10 of years before present, 9.657 at the start, 0 today

/* Hadean. A crust that has not finished forming: dark plates with molten
   cracks between them, which is what ridged noise is naturally good at. */
vec3 molten(vec2 uv, vec2 p, float t) {
  float crack = ridge(p * 1.7 + vec2(t * 0.02, 0.0), 5);
  float plate = fbm(p * 2.4 - t * 0.01, 4);
  vec3 rock = mix(vec3(0.035, 0.020, 0.022), vec3(0.10, 0.06, 0.055), plate);
  // Emissive, so it survives the tonemap as light rather than as paint.
  float heat = pow(crack, 3.4);
  vec3 c = rock + vec3(2.6, 0.75, 0.12) * heat * 1.5;
  c += vec3(1.0, 0.35, 0.08) * pow(crack, 8.0) * 2.5;
  // The sky above a magma ocean is lit by it.
  c += vec3(0.35, 0.10, 0.04) * pow(1.0 - uv.y, 2.2);
  return c;
}

/* Archean. Thick methane haze, no free oxygen, a young dim sun. */
vec3 archean(vec2 uv, vec2 p, float t) {
  vec2 q = vec2(fbm(p * 1.1 + t * 0.03, 4), fbm(p * 1.1 - t * 0.025 + 3.7, 4));
  float haze = fbm(p * 1.3 + q * 1.6, 5);
  vec3 c = mix(vec3(0.20, 0.10, 0.045), vec3(0.55, 0.30, 0.11), haze);
  c = mix(c, vec3(0.06, 0.05, 0.07), smoothstep(0.42, 0.0, uv.y));  // dark sea below
  c += vec3(0.9, 0.55, 0.22) * exp(-length(p - vec2(-0.5, 0.35)) * 2.6) * 0.35;
  return c;
}

/* Proterozoic. Oxygen arrives: iron precipitates out of the sea in bands, the
   water clears to green, and the whole planet freezes over twice. */
vec3 proterozoic(vec2 uv, vec2 p, float t, float L) {
  float bands = sin(uv.y * 46.0 + fbm(p * 2.0, 3) * 5.0) * 0.5 + 0.5;
  vec3 sea = mix(vec3(0.02, 0.10, 0.11), vec3(0.06, 0.30, 0.26), fbm(p * 1.4 + t * 0.02, 4));
  sea += vec3(0.22, 0.09, 0.03) * pow(bands, 3.0) * smoothstep(0.55, 0.0, uv.y) * 0.7;
  vec3 sky = mix(vec3(0.10, 0.20, 0.26), vec3(0.30, 0.44, 0.46), uv.y);
  vec3 c = mix(sea, sky, smoothstep(0.34, 0.62, uv.y));

  // Snowball Earth, at 720 Ma. Narrow enough that you scroll through it.
  float snow = exp(-pow((L - 8.857) / 0.075, 2.0));
  vec3 ice = mix(vec3(0.62, 0.72, 0.80), vec3(0.86, 0.92, 0.97), fbm(p * 3.0, 4));
  return mix(c, ice, snow * 0.9);
}

/* Phanerozoic. Land, plants, weather, and a sun that is finally visible. */
vec3 phanerozoic(vec2 uv, vec2 p, float t) {
  vec3 sky = mix(vec3(0.30, 0.42, 0.60), vec3(0.07, 0.20, 0.46), pow(clamp(uv.y, 0.0, 1.0), 0.8));
  float cloud = fbm(vec2(p.x * 1.3 + t * 0.02, p.y * 3.0), 5);
  sky = mix(sky, vec3(0.62, 0.64, 0.66), smoothstep(0.55, 0.95, cloud) * 0.45);
  // Canopy along the bottom edge.
  float canopy = fbm(vec2(p.x * 3.2, p.y * 2.0) + 9.0, 5);
  vec3 land = mix(vec3(0.03, 0.10, 0.035), vec3(0.09, 0.26, 0.07), canopy);
  vec3 c = mix(land, sky, smoothstep(0.10, 0.34, uv.y));
  c += vec3(1.0, 0.82, 0.55) * exp(-length(p - vec2(0.7, 0.5)) * 3.4) * 0.35;
  return c;
}

/* The present. Deliberately the plainest of the five — after four billion
   years of catastrophe, an ordinary afternoon is the point. */
vec3 modern(vec2 uv, vec2 p, float t) {
  vec3 c = mix(vec3(0.42, 0.56, 0.76), vec3(0.06, 0.20, 0.52), pow(clamp(uv.y, 0.0, 1.0), 0.8));
  float cloud = fbm(vec2(p.x * 1.1 + t * 0.015, p.y * 2.6) + 4.0, 5);
  c = mix(c, vec3(0.86, 0.88, 0.92), smoothstep(0.52, 0.92, cloud) * 0.6);
  c += vec3(1.0, 0.88, 0.66) * exp(-length(p - vec2(0.55, 0.62)) * 3.0) * 0.30;
  return c;
}

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  float t = u_time;
  float L = u_L;

  // Windows on log(years). Wide enough to overlap, so no transition is a cut.
  float wMolten = smoothstep(9.54, 9.63, L);
  float wArch   = smoothstep(9.30, 9.52, L) * (1.0 - wMolten);
  float wProt   = smoothstep(8.30, 9.28, L) * (1.0 - smoothstep(9.30, 9.52, L));
  float wPhan   = smoothstep(6.30, 8.28, L) * (1.0 - smoothstep(8.30, 9.28, L));
  float wMod    = 1.0 - smoothstep(6.30, 8.28, L);

  vec3 col = vec3(0.0);
  if (wMolten > 0.001) col += molten(uv, p, t) * wMolten;
  if (wArch   > 0.001) col += archean(uv, p, t) * wArch;
  if (wProt   > 0.001) col += proterozoic(uv, p, t, L) * wProt;
  if (wPhan   > 0.001) col += phanerozoic(uv, p, t) * wPhan;
  if (wMod    > 0.001) col += modern(uv, p, t) * wMod;

  col = aces(col * 1.02);
  col = toSRGB(col);
  // Cards sit on top of this, so the edges are pulled down to keep their
  // contrast margin rather than for looks.
  col *= 1.0 - dot(p, p) * 0.10;
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)

/* July 18, 1992: the first photograph on the Web.
 *
 * A 6 x 4 inch glossy colour print of the kind a lab hands back across a
 * counter: resin-coated paper, white border, lying face up on its back and
 * curling a little, as photographic paper does, up at the ends and one pair of
 * corners more than the other. The picture (photo-print.svg) is four invented
 * performers, soft and out of focus, in front of a painted stage backdrop.
 * A thumbprint on the gloss, a few specks of dust. Units: 1 is 1 cm.
 */
#define BOUND vec3(7.8, 0.4, 5.3)
#define CENTRE vec3(0.0, 0.4, 0.0)
#define VIEW_YAW 0.30
#define VIEW_PITCH 0.62
#define FILL 0.68
#define EXPOSURE 1.05
#define COAT(id) 1.0

const vec2 HALF = vec2(7.62, 5.08);

float hgt(vec2 q) {
  vec2 s = clamp(q / HALF, -1.0, 1.0);
  return 0.02 + 0.40 * s.x * s.x + 0.10 * s.y * s.y + 0.15 * s.x * s.y;
}

vec2 map(vec3 p) {
  float dy = (p.y - hgt(p.xz)) * 0.8;
  vec2 q2 = abs(p.xz) - (HALF - 0.12);
  float dr = length(max(q2, 0.0)) + min(max(q2.x, q2.y), 0.0) - 0.12;
  vec2 w = vec2(dr, abs(dy) - 0.0125);
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  return vec2(d, 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  vec2 uv = vec2(p.x / (2.0 * HALF.x) + 0.5, 0.5 - p.z / (2.0 * HALF.y));
  vec3 c = pow(texture(u_tex, clamp(uv, 0.0, 1.0)).rgb, vec3(2.2));
  float rough = 0.05;
  // The thumbprint: ridges in ellipses, oil on the gloss that scatters it.
  vec2 d = p.xz - vec2(2.9, 1.5);
  d = mat2(0.9, 0.44, -0.44, 0.9) * d;
  float e = length(d / vec2(0.95, 1.3));
  float ridge = 0.5 + 0.5 * sin(e * 46.0 + 4.0 * noise(p.xz * 3.0) + d.y * 3.0);
  float mask = smoothstep(1.0, 0.55, e) * (0.35 + 0.65 * noise(p.xz * 5.0 + 3.0));
  rough += 0.28 * mask * (0.35 + 0.65 * ridge);
  c *= 1.0 - 0.08 * mask * ridge;
  // A second, fainter smudge, and dust.
  vec2 d2 = p.xz - vec2(-4.8, -2.6);
  float sm = smoothstep(1.4, 0.2, length(d2 * vec2(1.0, 1.6))) * noise(p.xz * 4.0);
  rough += 0.1 * sm;
  float dust = smoothstep(0.95, 0.985, noise(p.xz * 22.0));
  c = mix(c, vec3(0.7), dust * 0.3);
  rough += dust * 0.2;
  return mat(c * 0.9, rough, 0.0);
}

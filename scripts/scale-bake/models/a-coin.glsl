/* A coin, 24.5 mm across: cupronickel, a raised rim, a reeded edge, and a
   design that belongs to no country — a sun over a line of hills. */
#define VIEW_PITCH 0.32
#define VIEW_YAW -0.0

float relief(vec2 q) {
  float r = length(q), a = atan(q.y, q.x);
  float h = 0.0;
  // The sun: a disc and twelve rays.
  vec2 s = q - vec2(0.0, 0.07);
  float sr = length(s), sa = atan(s.y, s.x);
  h = max(h, smoothstep(0.115, 0.10, sr) * (0.75 + 0.25 * sqrt(max(0.0, 1.0 - sr * sr / 0.0132))));
  float ray = abs(fract(sa / TAU * 12.0 + 0.5) - 0.5);
  h = max(h, smoothstep(0.16, 0.06, ray) * smoothstep(0.125, 0.145, sr) * smoothstep(0.29, 0.20, sr) * 0.6 * step(-0.02, s.y));
  // Hills, in two ridges, cutting the sun off.
  float hill1 = -0.07 + 0.045 * sin(q.x * 9.0 + 0.6) + 0.02 * sin(q.x * 21.0);
  float hill2 = -0.15 + 0.035 * sin(q.x * 7.0 + 2.4);
  float land = max(smoothstep(0.006, -0.006, q.y - hill1) * 0.55, smoothstep(0.006, -0.006, q.y - hill2) * 0.85);
  h = mix(h, land, step(q.y, max(hill1, hill2) + 0.006));
  h *= smoothstep(0.375, 0.36, r);
  // A ring of beads inside the rim.
  float bead = length(vec2((fract(a / TAU * 72.0) - 0.5) * TAU * r / 72.0, r - 0.405));
  h = max(h, smoothstep(0.012, 0.004, bead) * 0.7);
  return h;
}

vec2 map(vec3 p) {
  float r = length(p.xy), a = atan(p.y, p.x);
  float reed = 0.0018 * (0.5 + 0.5 * cos(a * 150.0));
  float body = max(r - (0.5 - reed), abs(p.z) - 0.034);
  // The field sits below the rim; the design stands up out of the field.
  float rim = smoothstep(0.435, 0.452, r);
  float face = 0.034 - 0.0075 * (1.0 - rim) + 0.011 * relief(p.xy) * (1.0 - rim);
  float d = max(body, abs(p.z) - face);
  // Round the corner of the rim a little so it catches a highlight.
  d = max(d, length(vec2(max(r - 0.488, 0.0), max(abs(p.z) - 0.026, 0.0))) - 0.0125);
  return vec2(d * 0.7, 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  float h = relief(p.xy);
  float wear = smoothstep(0.2, 0.9, h);
  // Fine circular brushing on the field, random scratches over everything.
  float scratch = noise(vec3(p.xy * 9.0, 3.0) * vec3(40.0, 3.0, 1.0)) * 0.5 + noise(vec3(p.yx * 70.0, 1.0)) * 0.5;
  vec3 alb = mix(vec3(0.78, 0.76, 0.71), vec3(0.93, 0.92, 0.88), wear);
  // Tarnish gathers where a thumb does not reach.
  float grime = (1.0 - wear) * smoothstep(0.35, 0.75, fbm(p * 14.0));
  alb *= 1.0 - 0.22 * grime;
  Mat m = mat(alb, mix(0.36, 0.2, wear) + scratch * 0.1 + grime * 0.15, 1.0);
  return m;
}

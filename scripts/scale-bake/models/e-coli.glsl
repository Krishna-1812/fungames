/* E. coli, two micrometres long: a rod with a wrinkled outer membrane and a
   coat of pili. */
#define STEP 0.6
#define VIEW_PITCH 0.12

vec2 map(vec3 p) {
  // A slight banana bend; rods are rarely straight.
  p.y += 0.035 * (p.x * p.x * 4.0 - 0.25);
  float body = sdCapsule(p, vec3(-0.365, 0.0, 0.0), vec3(0.365, 0.0, 0.0), 0.108);
  float wr = fbm(p * vec3(26.0, 40.0, 40.0)) - 0.5;
  body -= 0.008 * wr + 0.004 * sin(p.x * 60.0 + 3.0 * wr);
  // Where it is about to divide, it pinches.
  body += 0.012 * exp(-p.x * p.x * 500.0);
  vec2 res = vec2(body, 1.0);
  // Pili: short bristles on a grid wrapped round the rod.
  float a = atan(p.z, p.y);
  float rad = length(p.yz);
  vec2 cell = vec2(p.x * 34.0 + 3.0 * sin(a * 3.0), a * 6.0);
  vec2 id = floor(cell);
  vec2 f = fract(cell) - 0.5 - (hash22(id) - 0.5) * 0.8;
  float len = 0.012 + 0.045 * hash21(id + 5.0) * hash21(id + 9.0);
  // Each one leans its own way.
  f += (hash22(id + 2.0) - 0.5) * max(rad - 0.108, 0.0) * vec2(60.0, 18.0);
  float hair = length(vec2(f.x / 34.0, f.y * rad / 6.0)) - 0.0017;
  hair = max(hair, rad - 0.108 - len);
  hair = max(hair, abs(p.x) - 0.37);
  res = U(res, vec2(max(hair, -(rad - 0.09)), 2.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id > 1.5) { Mat m = mat(hex(0x9fb383), 0.6, 0.0); m.sss = 0.9; return m; }
  float f = fbm(p * vec3(18.0, 30.0, 30.0));
  vec3 alb = mix(hex(0x6f8f4e), hex(0xa9bf78), f);
  Mat m = mat(alb, 0.42, 0.0); m.sss = 0.8;
  return m;
}

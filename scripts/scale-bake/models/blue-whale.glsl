/* A blue whale, thirty metres long: a long tapering body, a broad flat head,
   throat pleats running back to the navel, a dorsal fin that is almost
   nothing, and flukes with a notch. Mottled, because they are. */
#define STEP 0.7
#define VIEW_YAW 0.26
#define VIEW_PITCH 0.2

vec2 map(vec3 p) {
  // The whole animal, turned a touch so the length still fills the frame.
  p.x *= 0.965;
  vec3 q = vec3(p.x, p.y, abs(p.z));
  // body: fattest a third of the way back
  float body = sdEllipsoid(p - vec3(-0.115, -0.004, 0.0), vec3(0.345, 0.070, 0.066));
  // head: wide, flat on top, with a ridge down the middle to the blowholes
  float head = sdEllipsoid(p - vec3(-0.335, 0.004, 0.0), vec3(0.150, 0.040, 0.060));
  head = smin(head, sdEllipsoid(p - vec3(-0.30, 0.036, 0.0), vec3(0.10, 0.012, 0.012)), 0.02);
  // lower jaw, deeper than the upper and bowed
  float jaw = sdEllipsoid(p - vec3(-0.30, -0.026, 0.0), vec3(0.175, 0.045, 0.062));
  body = smin(smin(body, head, 0.05), jaw, 0.03);
  // tail stock: deep and narrow
  float stock = sdCone(vec3(p.x, p.y, p.z * 1.7), vec3(0.12, 0.0, 0.0), vec3(0.455, 0.006, 0.0), 0.050, 0.011);
  body = smin(body, stock, 0.06);
  // pleats on the throat and chest
  float ang = atan(p.z, -p.y);
  float pleat = sin(ang * 46.0) * smoothstep(1.35, 0.9, abs(ang)) * smoothstep(0.03, -0.1, p.x) * smoothstep(-0.47, -0.40, p.x);
  body += 0.0016 * pleat;
  // flukes, swept back, with a notch
  vec3 f = q - vec3(0.458, 0.008, 0.0);
  f.xz = rot(0.55) * f.xz;
  float fluke = sdEllipsoid(f - vec3(0.0, 0.0, 0.058), vec3(0.030, 0.0055, 0.066));
  body = smin(body, fluke, 0.016);
  // dorsal fin
  vec3 d = p - vec3(0.262, 0.046, 0.0);
  d.xy = rot(-0.7) * d.xy;
  body = smin(body, sdEllipsoid(d, vec3(0.022, 0.009, 0.004)), 0.012);
  // flippers: long and narrow, held out and back
  vec3 l = q - vec3(-0.150, -0.040, 0.066);
  l.xz = rot(-0.5) * l.xz; l.yz = rot(0.5) * l.yz;
  body = smin(body, sdEllipsoid(l - vec3(0.0, 0.0, 0.036), vec3(0.021, 0.005, 0.046)), 0.012);
  vec2 res = vec2(body, 1.0);
  res = U(res, vec2(sdSphere(q - vec3(-0.262, -0.008, 0.0615), 0.0042), 2.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id > 1.5) return mat(vec3(0.01), 0.1, 0.0);
  float mott = fbm(p * vec3(26.0, 40.0, 40.0));
  vec3 v = voronoi(p * vec3(34.0, 60.0, 60.0));
  vec3 alb = mix(hex(0x34526b), hex(0x5d7d95), smoothstep(0.3, 0.7, mott));
  alb = mix(alb, hex(0x8fa6b6), smoothstep(0.14, 0.05, v.x) * 0.35);
  // paler underneath
  alb = mix(alb, hex(0x8fa3ae), smoothstep(0.0, -0.06, p.y) * 0.5);
  // the mouth line
  float mouth = abs(p.y + 0.004 + 0.035 * smoothstep(-0.2, -0.47, p.x) - 0.03 * smoothstep(-0.26, -0.18, p.x));
  alb *= 1.0 - 0.6 * smoothstep(0.003, 0.0008, mouth) * step(p.x, -0.2);
  Mat m = mat(alb, 0.3, 0.0);
  m.sss = 0.2;
  return m;
}

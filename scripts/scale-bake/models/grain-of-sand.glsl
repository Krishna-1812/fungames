/* A grain of quartz sand, half a millimetre across: sub-angular — it was a
   crystal once and has been rolled since — frosted, chipped, and letting some
   of the light through. */
#define STEP 0.6
#define VIEW_YAW 0.4
#define VIEW_PITCH 0.25

vec2 map(vec3 p) {
  p.y /= 0.86;
  // Planes at random bearings, cut into a ball, then the corners knocked off.
  float d = length(p) - 0.47;
  for (int i = 0; i < 11; i++) {
    vec3 nrm = normalize(hash33(vec3(float(i) * 3.7, 1.3, 9.1)) * 2.0 - 1.0);
    float off = 0.30 + 0.13 * hash11(float(i) * 7.3);
    d = smax(d, dot(p, nrm) - off, 0.028);
  }
  d += 0.012 * (fbm(p * 9.0) - 0.5);
  // Percussion pits from a life of hitting other grains.
  vec3 v = voronoi(p * 13.0);
  d += 0.012 * smoothstep(0.25, 0.0, v.x) * step(0.7, v.z);
  return vec2(d * 0.86, 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  float f = fbm(p * 7.0);
  // Iron staining in the hollows is what makes beach sand tan.
  vec3 alb = mix(hex(0xe2dccf), hex(0xb89a72), smoothstep(0.42, 0.75, f));
  float frost = fbm(p * 60.0);
  Mat m = mat(alb, 0.16 + 0.42 * frost * frost, 0.0);
  m.sss = 0.9;
  return m;
}

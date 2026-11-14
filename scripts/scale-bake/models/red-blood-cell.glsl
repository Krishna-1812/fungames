/* A red blood cell, 8 micrometres across: the biconcave disc, leaned back so
   the dimple shows. */
#define STEP 0.8
#define TILT 0.92

vec3 pose(vec3 p) { p.yz = rot(TILT) * p.yz; return p; }

vec2 map(vec3 p) {
  p = pose(p);
  // Nothing alive is a solid of revolution; it sags a little.
  p.z += 0.012 * sin(p.x * 5.0 + 1.0) + 0.010 * sin(p.y * 4.0);
  // A fat rim and a thin floor, blended: within a few percent of Evans and
  // Fung's measured profile (2.5 micrometres at the rim, 1 at the centre) and
  // a far better-behaved thing to march a ray into.
  float r = length(p.xy);
  float rim = length(vec2(r - 0.366, p.z * 1.04)) - 0.128;
  float floor_ = max(abs(p.z) - 0.045, r - 0.37);
  float d = smin(rim, floor_, 0.13);
  d -= 0.0012 * fbm(p * 30.0);
  return vec2(d, 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  p = pose(p);
  float rho = length(p.xy) / 0.5;
  // Thinner in the middle, so more light comes through and it reads paler.
  vec3 alb = mix(vec3(0.72, 0.07, 0.06), vec3(0.50, 0.02, 0.03), smoothstep(0.1, 0.8, rho));
  alb *= 0.9 + 0.2 * fbm(p * 16.0);
  Mat m = mat(alb, 0.38, 0.0);
  m.sss = 1.0;
  return m;
}

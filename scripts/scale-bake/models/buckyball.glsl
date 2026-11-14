/* Buckminsterfullerene, a nanometre across: sixty carbon atoms at the corners
   of a truncated icosahedron — twelve pentagons and twenty hexagons, a
   football — each bonded to three neighbours. */
#define STEP 0.9
#define VIEW_YAW 0.2
#define VIEW_PITCH 0.25

#include "buckyball.glsl"

const float RC = 0.415;       // the cage; the rest of the nanometre is electron cloud

vec2 map(vec3 p) {
  // Far from the shell there is nothing to find.
  float shell = abs(length(p) - RC) - 0.075;
  if (shell > 0.05) return vec2(shell, 1.0);
  vec3 d = normalize(p);
  // the two nearest carbons: the atom, and the bond this point is beside
  float b1 = -2.0, b2 = -2.0; vec3 v1 = vec3(0.0), v2 = vec3(0.0);
  for (int i = 0; i < 60; i++) {
    float c = dot(d, C60[i]);
    if (c > b1) { b2 = b1; v2 = v1; b1 = c; v1 = C60[i]; } else if (c > b2) { b2 = c; v2 = C60[i]; }
  }
  vec2 res = vec2(sdSphere(p - v1 * RC, 0.062), 1.0);
  if (distance(v1, v2) < BOND * 1.12) res = U(res, vec2(sdCapsule(p, v1 * RC, v2 * RC, 0.024), 2.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id > 1.5) return mat(hex(0x8d95a3), 0.3, 0.6);
  return mat(hex(0x2b2e36), 0.25, 0.0);
}

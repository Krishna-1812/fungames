/* A water molecule, 280 picometres across at its van der Waals surface: one
   oxygen and two hydrogens, 96 picometres from it and 104.5 degrees apart.
   Red and white because that is how chemists have always coloured them. */
#define STEP 0.9
#define VIEW_YAW 0.25

vec2 map(vec3 p) {
  vec2 res = vec2(sdSphere(p - vec3(0.0, 0.034, 0.0), 0.388), 1.0);
  res = U(res, vec2(sdSphere(p - vec3(-0.194, -0.116, 0.0), 0.306), 2.0));
  res = U(res, vec2(sdSphere(p - vec3(0.194, -0.116, 0.0), 0.306), 2.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  Mat m = mat(id < 1.5 ? hex(0xc9302c) : hex(0xe9e9e6), 0.22, 0.0);
  m.sss = 0.3;
  return m;
}

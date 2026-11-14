/* A carbon-12 nucleus, five femtometres across: six protons and six neutrons,
   packed as close as twelve things pack. */
#define STEP 0.9
#define VIEW_YAW 0.3
#define VIEW_PITCH 0.2

const float G = 1.6180339887;

vec3 vert(int i) {
  // the twelve corners of an icosahedron
  float a = (i & 1) == 0 ? 1.0 : -1.0, b = (i & 2) == 0 ? G : -G;
  int k = i / 4;
  vec3 v = k == 0 ? vec3(0.0, a, b) : k == 1 ? vec3(a, b, 0.0) : vec3(b, 0.0, a);
  return normalize(v);
}

vec2 map(vec3 p) {
  vec2 res = vec2(1.0, 0.0);
  for (int i = 0; i < 12; i++) {
    vec3 c = vert(i) * (0.295 + 0.012 * hash11(float(i)));
    // protons and neutrons alternate round the cluster
    float kind = ((i + i / 4) & 1) == 0 ? 1.0 : 2.0;
    res = U(res, vec2(sdSphere(p - c, 0.192), kind));
  }
  res = U(res, vec2(sdSphere(p, 0.2), 2.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 c = id < 1.5 ? hex(0xc8454e) : hex(0x5d7f9f);
  Mat m = mat(c * (0.9 + 0.2 * fbm(p * 14.0)), 0.3, 0.0);
  m.sss = 0.7;
  m.emit = c * 0.05;
  return m;
}

/* A proton, 1.7 femtometres across. Nothing down here has a surface, so this
   is a diagram that has been lit: three quarks — two up, one down, one of
   each colour charge so the whole is neutral — joined by the gluon field that
   is most of the proton's mass, inside the region they are confined to. */
#define STEP 0.8
#define FOG
#define SHADOW 0.4

const vec3 Q0 = vec3(0.0, 0.205, 0.03);
const vec3 Q1 = vec3(-0.185, -0.115, 0.0);
const vec3 Q2 = vec3(0.185, -0.115, -0.03);

float tube(vec3 p, vec3 a, vec3 b) {
  // a flux tube: fat in the middle, twisted
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  vec3 c = a + ba * h + 0.02 * sin(h * 19.0) * normalize(cross(ba, vec3(0.2, 0.3, 1.0)));
  return length(p - c) - (0.026 + 0.012 * sin(h * PI));
}

vec2 map(vec3 p) {
  vec2 res = vec2(sdSphere(p - Q0, 0.105), 1.0);
  res = U(res, vec2(sdSphere(p - Q1, 0.105), 2.0));
  res = U(res, vec2(sdSphere(p - Q2, 0.105), 3.0));
  float t = min(min(tube(p, Q0, Q1), tube(p, Q1, Q2)), tube(p, Q2, Q0));
  res = U(res, vec2(t, 4.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id > 3.5) { Mat m = mat(vec3(0.9, 0.85, 0.95), 0.4, 0.0); m.emit = vec3(0.5, 0.42, 0.62); m.sss = 1.0; return m; }
  vec3 c = id < 1.5 ? hex(0xd9433f) : id < 2.5 ? hex(0x3f9b55) : hex(0x3f66d0);
  Mat m = mat(c, 0.22, 0.0);
  m.emit = c * 0.28;
  m.sss = 0.8;
  return m;
}

/* The bag: where the quarks may be. Densest in the middle, gone by the edge. */
vec4 fog(vec3 ro, vec3 rd, float tmax) {
  float t0 = 2.4, t1 = min(tmax, 3.6), dt = (t1 - t0) / 28.0;
  float a = 0.0;
  for (int i = 0; i < 28; i++) {
    vec3 p = ro + rd * (t0 + (float(i) + 0.5) * dt);
    float r = length(p) / 0.5;
    a += pow(max(0.0, 1.0 - r * r), 1.6) * (0.8 + 0.4 * fbm(p * 9.0)) * dt;
  }
  a = 1.0 - exp(-a * 1.5);
  return vec4(vec3(0.95, 0.42, 0.62) * a, a);
}

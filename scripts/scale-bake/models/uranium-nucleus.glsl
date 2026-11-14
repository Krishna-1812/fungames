/* A uranium-238 nucleus, fifteen femtometres long: 92 protons and 146
   neutrons, and not a ball — it is stretched, about a quarter longer than it
   is wide, which is part of why it comes apart. */
#define STEP 0.8
#define VIEW_YAW 0.3
#define VIEW_PITCH 0.15

const float RS = 0.046;                       // one nucleon
const vec3 SHAPE = vec3(0.5, 0.385, 0.385);

vec2 map(vec3 p) {
  const float s = 0.086;
  // the packing has no reason to line up with the camera
  p.xy = rot(0.5) * p.xy; p.yz = rot(0.4) * p.yz;
  vec3 i0 = floor(p / s);
  float far = length(p / 0.5);
  if (far > 1.3) return vec2((far - 1.0) * 0.25, 0.0);
  // an empty neighbourhood is not an empty nucleus: step on, a little
  vec2 res = vec2(s * 0.5, 0.0);
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 c = i0 + vec3(float(x), float(y), float(z));
    vec3 h = hash33(c);
    vec3 q = (c + 0.5 + (h - 0.5) * 0.34) * s;
    vec3 w = q; w.yz = rot(-0.4) * w.yz; w.xy = rot(-0.5) * w.xy;
    if (length(w / (SHAPE - RS)) > 1.0) continue;
    // 92 in 238 are protons
    res = U(res, vec2(sdSphere(p - q, RS), hash31(c + 11.0) < 0.387 ? 1.0 : 2.0));
  }
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 c = id < 1.5 ? hex(0xc8454e) : hex(0x5d7f9f);
  Mat m = mat(c, 0.3, 0.0);
  m.sss = 0.7;
  m.emit = c * 0.05;
  return m;
}

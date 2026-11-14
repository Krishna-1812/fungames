/* A human hair, 70 micrometres across: a length of the shaft, cut at the top
   to show the cortex and the medulla, the cuticle lying in overlapping scales
   that point towards the tip. */
#define STEP 0.5
#define VIEW_PITCH 0.42

const float R = 0.158;

float scales(vec3 p, out float edge) {
  float a = atan(p.z, p.x);
  // Each scale edge is a ragged line round the shaft; about six to a width.
  float rag = 0.9 * fbm(vec2(a * 2.2, p.y * 3.0)) + 0.25 * sin(a * 3.0 + p.y * 7.0);
  float s = p.y * 19.0 + rag * 2.2;
  float f = fract(s);
  edge = f;
  // A shingle: flush at its root, proud at its free edge, then a step down.
  return 0.0065 * f * f - 0.003 * smoothstep(0.92, 1.0, f);
}

vec2 map(vec3 p) {
  float rad = length(p.xz);
  float e;
  float d = rad - R - scales(p, e);
  // Cut ends: a clean one at the top, a ragged break at the bottom.
  float top = p.y - 0.455 - 0.01 * fbm(p.xz * 30.0);
  float bot = -p.y - 0.47 - 0.02 * fbm(p.xz * 14.0 + 4.0);
  vec2 res = vec2(max(d, max(top, bot)) * 0.8, 1.0);
  if (top > -0.004 && d < 0.0) res.y = rad < 0.03 ? 3.0 : 2.0;
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id > 2.5) return mat(hex(0x2a1a12), 0.9, 0.0);
  if (id > 1.5) {
    // The cortex: bundled fibres seen end on.
    float fib = voronoi(p.xz * 90.0).x;
    Mat m = mat(mix(hex(0x6b4a33), hex(0x9a7250), fib), 0.7, 0.0); m.sss = 0.5; return m;
  }
  float e; scales(p, e);
  vec3 alb = mix(hex(0x21140d), hex(0x4a2f1f), fbm(p * vec3(30.0, 4.0, 30.0)));
  alb *= 0.75 + 0.35 * e;
  Mat m = mat(alb, 0.22 + 0.2 * (1.0 - e), 0.0);
  m.sss = 0.35;
  return m;
}

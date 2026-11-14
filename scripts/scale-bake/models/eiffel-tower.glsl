/* The Eiffel Tower, 330 metres: four latticed legs on a 125 metre square,
   curving in to meet above the second platform — a curve chosen so the wind
   is carried straight down the legs — three platforms, four arches that hold
   nothing up, and a mast. Painted its own brown. */
#define STEP 0.5
#define VIEW_YAW 0.14
#define VIEW_PITCH 0.03

float halfWidth(float t) { return 0.168 * exp(-3.9 * t) + 0.0125 * (1.0 - t); }
float tri(float v) { return abs(fract(v + 0.5) - 0.5); }

vec2 map(vec3 p) {
  float t = clamp(p.y + 0.5, 0.0, 1.0);
  float w = halfWidth(t);
  vec2 a = abs(p.xz);
  float shell, corner;
  const float T2 = 0.35;                       // the second platform
  if (t < T2) {
    // four legs, each a square tube leaning in
    float lw = mix(0.066, 0.030, t / T2);
    vec2 l = a - (w - lw * 0.5);
    shell = abs(max(abs(l.x), abs(l.y)) - lw * 0.5 + 0.0025) - 0.0025;
    corner = max(lw * 0.5 - 0.006 - abs(l.x), lw * 0.5 - 0.006 - abs(l.y));
  } else {
    shell = abs(max(a.x, a.y) - w + 0.002) - 0.002;
    corner = max(w - 0.0035 - a.x, w - 0.0035 - a.y);
  }
  // the lattice: two sets of diagonals and the horizontals between panels
  float k = mix(34.0, 60.0, smoothstep(0.3, 0.9, t));
  float s = p.x + p.z;
  float bars = min(min(tri((p.y + s) * k), tri((p.y - s) * k)), tri(p.y * k * 0.5) * 1.6) - 0.085;
  float d = max(shell, min(bars / (k * 1.6), corner));
  d = max(d, p.y - 0.336);
  d = max(d, -0.5 - p.y);
  vec2 res = vec2(d, 1.0);

  // platforms
  float p1 = sdBox(p - vec3(0.0, -0.5 + 0.176, 0.0), vec3(halfWidth(0.176) + 0.010, 0.0085, halfWidth(0.176) + 0.010));
  float p2 = sdBox(p - vec3(0.0, -0.5 + 0.352, 0.0), vec3(halfWidth(0.352) + 0.008, 0.0065, halfWidth(0.352) + 0.008));
  float p3 = sdBox(p - vec3(0.0, 0.338, 0.0), vec3(0.0135, 0.007, 0.0135));
  float cab = sdBox(p - vec3(0.0, 0.356, 0.0), vec3(0.008, 0.012, 0.008));
  cab = min(cab, sdCone(p, vec3(0.0, 0.366, 0.0), vec3(0.0, 0.392, 0.0), 0.007, 0.003));
  res = U(res, vec2(min(min(p1, p2), min(p3, cab)), 2.0));
  // the mast
  res = U(res, vec2(sdCone(p, vec3(0.0, 0.39, 0.0), vec3(0.0, 0.499, 0.0), 0.0022, 0.0006), 2.0));

  // the arches under the first platform, one on each face
  const float RA = 0.112;
  vec2 f = vec2(min(a.x, a.y), max(a.x, a.y));      // along the face, out to the face
  float ring = abs(length(vec2(f.x, (p.y + 0.488) * 1.02)) - RA) - 0.0042;
  float face = abs(f.y - halfWidth(clamp(p.y + 0.5, 0.0, 0.17)) + 0.004) - 0.0035;
  float arch = max(max(ring, face), -0.488 - p.y);
  res = U(res, vec2(arch, 1.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  // "Eiffel Tower brown", in three shades, darkest at the bottom.
  vec3 alb = mix(hex(0x4d3d30), hex(0x76614d), smoothstep(-0.5, 0.4, p.y));
  alb *= 0.9 + 0.2 * noise(p * 300.0);
  if (id > 1.5) alb *= 0.8;
  return mat(alb, 0.55, 0.25);
}

/* An ant, five millimetres long, side on: head, a waist of one node, a
   gaster in bands, elbowed antennae, and six legs that all leave from the
   thorax. */
#define STEP 0.75
#define VIEW_YAW 0.22
#define VIEW_PITCH 0.1

float leg(vec3 p, vec3 hip, vec3 knee, vec3 ankle, vec3 toe) {
  float d = sdCone(p, hip, knee, 0.011, 0.008);
  d = smin(d, sdCone(p, knee, ankle, 0.0075, 0.005), 0.006);
  d = smin(d, sdCone(p, ankle, toe, 0.0045, 0.003), 0.004);
  return d;
}

vec2 map(vec3 p) {
  // Mirror across the body: three legs and one antenna each side.
  vec3 q = vec3(p.x, p.y, abs(p.z));
  // head
  float head = sdEllipsoid(q - vec3(-0.34, 0.030, 0.0), vec3(0.088, 0.072, 0.07));
  // mandibles
  head = smin(head, sdCone(q, vec3(-0.41, 0.0, 0.03), vec3(-0.462, -0.022, 0.006), 0.014, 0.004), 0.012);
  // eye
  float eye = sdSphere(q - vec3(-0.345, 0.052, 0.058), 0.017);
  // thorax: three fused lumps, highest at the front
  float th = sdEllipsoid(q - vec3(-0.19, 0.036, 0.0), vec3(0.085, 0.058, 0.05));
  th = smin(th, sdEllipsoid(q - vec3(-0.095, 0.022, 0.0), vec3(0.07, 0.046, 0.042)), 0.03);
  th = smin(th, sdEllipsoid(q - vec3(-0.02, 0.012, 0.0), vec3(0.05, 0.04, 0.036)), 0.025);
  float neck = sdCapsule(q, vec3(-0.27, 0.03, 0.0), vec3(-0.24, 0.032, 0.0), 0.022);
  // petiole: the node on the waist
  float pet = sdEllipsoid(q - vec3(0.055, 0.02, 0.0), vec3(0.022, 0.034, 0.02));
  pet = smin(pet, sdCapsule(q, vec3(0.02, 0.0, 0.0), vec3(0.10, 0.0, 0.0), 0.011), 0.012);
  // gaster, in overlapping bands
  vec3 g = q - vec3(0.27, 0.012, 0.0);
  float gas = sdEllipsoid(g, vec3(0.18, 0.105, 0.10));
  float band = fract((g.x + 0.02 * g.y) * 9.5 + 0.2);
  gas -= 0.0045 * band * band * smoothstep(0.2, 0.0, abs(g.x) - 0.12);
  float body = min(min(head, smin(th, neck, 0.012)), min(pet, gas));

  // legs: hips under the thorax, knees up and out, feet on the ground
  float legs = leg(q, vec3(-0.19, 0.0, 0.03), vec3(-0.25, 0.035, 0.11), vec3(-0.32, -0.085, 0.14), vec3(-0.37, -0.145, 0.15));
  legs = min(legs, leg(q, vec3(-0.10, -0.005, 0.03), vec3(-0.085, 0.055, 0.13), vec3(-0.06, -0.085, 0.18), vec3(-0.03, -0.145, 0.20)));
  legs = min(legs, leg(q, vec3(-0.03, -0.008, 0.028), vec3(0.06, 0.06, 0.11), vec3(0.17, -0.07, 0.15), vec3(0.25, -0.145, 0.165)));
  // antennae: a long scape, an elbow, then the whip
  float ant = sdCone(q, vec3(-0.40, 0.055, 0.035), vec3(-0.385, 0.135, 0.085), 0.006, 0.005);
  ant = smin(ant, sdCone(q, vec3(-0.385, 0.135, 0.085), vec3(-0.475, 0.085, 0.10), 0.005, 0.0065), 0.004);

  vec2 res = vec2(smin(body, legs, 0.012), 1.0);
  res = U(res, vec2(ant, 1.0));
  res = U(res, vec2(eye, 2.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id > 1.5) return mat(vec3(0.01), 0.12, 0.0);
  // Chitin: nearly black, red-brown where it thins at the joints and legs.
  float thin = smoothstep(-0.02, -0.12, p.y) + smoothstep(0.05, 0.0, abs(p.x - 0.06));
  vec3 alb = mix(hex(0x1c0d08), hex(0x5a2412), clamp(thin * 0.8 + 0.25 * fbm(p * 30.0), 0.0, 1.0));
  // A gaster is polished; a thorax is finely pitted.
  float pit = voronoi(p * 160.0).x;
  float gloss = smoothstep(0.08, 0.14, p.x);
  Mat m = mat(alb, mix(0.36 + 0.2 * pit, 0.2, gloss), 0.0);
  m.sss = 0.25;
  return m;
}

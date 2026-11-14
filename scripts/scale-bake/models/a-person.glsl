/* A person, 1.7 metres tall, standing: a shop-window figure rather than a
   portrait — nobody in particular, at the proportions everybody is. Seven and
   a half heads tall, arms that reach mid-thigh. */
#define STEP 0.8
#define VIEW_YAW 0.38
#define VIEW_PITCH 0.05

vec2 map(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);

  // head
  float head = sdEllipsoid(p - vec3(0.0, 0.437, 0.004), vec3(0.050, 0.064, 0.059));
  head = smin(head, sdEllipsoid(p - vec3(0.0, 0.403, 0.016), vec3(0.038, 0.040, 0.044)), 0.025);
  head = smin(head, sdSphere(p - vec3(0.0, 0.424, 0.060), 0.010), 0.014);
  head = smin(head, sdEllipsoid(q - vec3(0.050, 0.428, 0.002), vec3(0.007, 0.015, 0.010)), 0.006);
  // eye sockets and a mouth line, just enough that it has a face
  head += 0.004 * smoothstep(0.016, 0.0, length((q - vec3(0.019, 0.437, 0.052)).xy * vec2(1.0, 1.8))) * step(0.0, p.z);
  float neck = sdCapsule(p, vec3(0.0, 0.352, -0.006), vec3(0.0, 0.392, 0.0), 0.027);
  float hair = sdEllipsoid(p - vec3(0.0, 0.453, -0.010), vec3(0.055, 0.056, 0.064));
  hair = max(hair, p.z - 0.036 - (p.y - 0.455) * 1.1);
  hair -= 0.003 * fbm(p * vec3(60.0, 20.0, 60.0));

  // torso
  float chest = sdEllipsoid(p - vec3(0.0, 0.250, 0.0), vec3(0.090, 0.098, 0.056));
  float sh = sdCapsule(q, vec3(0.0, 0.322, -0.002), vec3(0.097, 0.314, -0.002), 0.036);
  float belly = sdEllipsoid(p - vec3(0.0, 0.125, 0.004), vec3(0.076, 0.095, 0.052));
  float torso = smin(smin(chest, sh, 0.03), belly, 0.05);
  float hips = sdEllipsoid(p - vec3(0.0, 0.022, -0.002), vec3(0.084, 0.072, 0.056));

  // arm, a little bent, hand by the thigh
  float upper = sdCone(q, vec3(0.110, 0.305, -0.004), vec3(0.132, 0.150, -0.012), 0.033, 0.026);
  float fore = sdCone(q, vec3(0.132, 0.150, -0.012), vec3(0.138, 0.010, 0.016), 0.024, 0.017);
  float hand = sdEllipsoid(q - vec3(0.140, -0.038, 0.024), vec3(0.012, 0.040, 0.021));
  hand = smin(hand, sdCapsule(q, vec3(0.134, -0.03, 0.04), vec3(0.134, -0.058, 0.046), 0.008), 0.008);

  // leg
  float thigh = sdCone(q, vec3(0.047, 0.005, 0.0), vec3(0.052, -0.236, 0.004), 0.053, 0.037);
  float shin = sdCone(q, vec3(0.052, -0.236, 0.004), vec3(0.050, -0.452, -0.006), 0.037, 0.026);
  float shoe = sdRound(q - vec3(0.052, -0.476, 0.020), vec3(0.027, 0.020, 0.062), 0.017);
  shoe = max(shoe, -(p.y + 0.4995));

  float shirt = smin(torso, upper, 0.02) - 0.005;
  // cloth hangs: a hem, and folds where it is not stretched over anything
  shirt = max(shirt, -(p.y - 0.062 - 0.006 * sin(p.x * 60.0)));
  shirt -= 0.0035 * fbm(p * vec3(26.0, 9.0, 26.0)) * smoothstep(0.30, 0.10, p.y);
  float trousers = smin(hips, smin(thigh, shin, 0.02), 0.035) - 0.003;
  trousers -= 0.004 * fbm(p * vec3(30.0, 7.0, 30.0) + 5.0);
  float skin = min(smin(head, neck, 0.016), smin(fore, hand, 0.012));

  vec2 res = vec2(skin, 1.0);
  res = U(res, vec2(hair, 2.0));
  res = U(res, vec2(shirt, 3.0));
  res = U(res, vec2(trousers, 4.0));
  res = U(res, vec2(shoe, 5.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id < 1.5) { Mat m = mat(hex(0xb5805c) * (0.92 + 0.16 * fbm(p * 40.0)), 0.5, 0.0); m.sss = 0.9; return m; }
  if (id < 2.5) return mat(hex(0x17110d), 0.45, 0.0);
  if (id < 3.5) {
    // jersey knit
    float weave = 0.9 + 0.1 * noise(p * vec3(700.0, 700.0, 700.0));
    return mat(hex(0x2c6f86) * weave, 0.88, 0.0);
  }
  if (id < 4.5) return mat(hex(0x22283a) * (0.85 + 0.3 * noise(p * vec3(300.0, 900.0, 300.0))), 0.8, 0.0);
  // trainers: white uppers, a darker sole
  float sole = step(p.y, -0.485);
  return mat(mix(hex(0xe6e6e2), hex(0x3a3f47), sole), 0.6, 0.0);
}

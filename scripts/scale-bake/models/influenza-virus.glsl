/* An influenza virion, 90 nanometres across: a lipid envelope crowded with two
   kinds of spike — haemagglutinin, a club, and about one in five of them
   neuraminidase, a mushroom on a thin stalk. */
#define STEP 0.55
const float R = 0.355;

vec2 map(vec3 p) {
  float l = length(p);
  vec3 dir = p / max(l, 1e-4);
  float env = l - R - 0.012 * (fbm(dir * 7.0) - 0.5);
  vec2 res = vec2(env, 1.0);
  if (l > R - 0.03 && l < 0.53) {
    vec4 s = scatter(dir, 4.6);
    vec3 a = s.xyz;
    if (s.w > 0.8) {
      // neuraminidase: stalk and a square head of four
      float d = sdCapsule(p, a * R, a * (R + 0.085), 0.0065);
      vec3 hp = p - a * (R + 0.105);
      vec3 u = normalize(cross(a, vec3(0.3, 0.9, 0.1))), w = cross(a, u);
      vec3 lp = vec3(dot(hp, u), dot(hp, w), dot(hp, a));
      lp.xy = abs(lp.xy) - 0.012;
      d = smin(d, sdSphere(lp, 0.0155), 0.01);
      res = U(res, vec2(d, 3.0));
    } else {
      // haemagglutinin: a stalk swelling to a three-lobed head
      float d = sdCone(p, a * R, a * (R + 0.075), 0.011, 0.008);
      d = smin(d, sdEllipsoid(p - a * (R + 0.105), vec3(0.021) + abs(a) * 0.012), 0.02);
      res = U(res, vec2(d, 2.0));
    }
  }
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 dir = normalize(p);
  if (id < 1.5) {
    vec3 alb = mix(hex(0x8b86a8), hex(0x5c5a7e), fbm(dir * 9.0));
    Mat m = mat(alb, 0.55, 0.0); m.sss = 0.5; return m;
  }
  float tip = smoothstep(0.37, 0.47, length(p));
  if (id < 2.5) { Mat m = mat(mix(hex(0x2c5f8f), hex(0x5aa2d6), tip), 0.4, 0.0); m.sss = 0.4; return m; }
  Mat m = mat(mix(hex(0x7a2350), hex(0xd0457f), tip), 0.4, 0.0); m.sss = 0.4; return m;
}

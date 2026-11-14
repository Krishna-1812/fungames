/* A football pitch, 105 metres by 68, from straight above: mown in stripes,
   marked to the Laws of the Game, worn in the goalmouths, with a goal at each
   end. */
#define STEP 0.9
#define SHADOW 1.0

const float M = 1.0 / 105.0;   // one metre

vec2 map(vec3 p) {
  float turf = sdBox(p + vec3(0.0, 0.0, 0.006), vec3(0.5, 0.324, 0.006));
  // each blade is nothing at this size, but the nap is
  turf -= 0.0004 * noise(p.xy * 900.0);
  vec2 res = vec2(turf, 1.0);
  // goals: posts, bar, and a frame behind for the net
  vec3 g = vec3(abs(p.x) - 0.5, abs(p.y), p.z);
  float post = sdCapsule(g, vec3(0.0, 3.66 * M, 0.0), vec3(0.0, 3.66 * M, 2.44 * M), 0.0011);
  post = min(post, sdCapsule(vec3(g.x, p.y, g.z), vec3(0.0, -3.66 * M, 2.44 * M), vec3(0.0, 3.66 * M, 2.44 * M), 0.0011));
  post = min(post, sdCapsule(g, vec3(0.0, 3.66 * M, 2.44 * M), vec3(2.0 * M, 3.66 * M, 0.0), 0.0007));
  post = min(post, sdCapsule(vec3(g.x, p.y, g.z), vec3(2.0 * M, -3.66 * M, 0.0), vec3(2.0 * M, 3.66 * M, 0.0), 0.0007));
  res = U(res, vec2(post, 2.0));
  return res;
}

float line(float d) { return smoothstep(0.075, 0.045, abs(d)); }

Mat material(float id, vec3 p, vec3 n) {
  if (id > 1.5) return mat(vec3(0.9), 0.4, 0.0);
  vec2 P = p.xy * 105.0;                 // metres from the centre spot
  vec2 a = abs(P);
  // mowing: bands five and a half metres wide, the nap laid alternate ways
  float band = step(0.5, fract(P.x / 11.0 + 0.25));
  vec3 grass = mix(hex(0x2f6a2c), hex(0x3f8236), band);
  grass *= 0.86 + 0.28 * fbm(P * 0.35) ;
  grass *= 0.92 + 0.16 * noise(P * 6.0);
  // wear: the goalmouths and the centre
  float wear = exp(-dot((a - vec2(48.5, 0.0)) / vec2(4.5, 6.0), (a - vec2(48.5, 0.0)) / vec2(4.5, 6.0))) + 0.5 * exp(-dot(P, P) / 30.0);
  grass = mix(grass, hex(0x4f5e2e), clamp(wear * (0.4 + fbm(P * 0.9)), 0.0, 0.6));

  float l = 0.0;
  // boundary and halfway
  l = max(l, line(max(a.x - 52.44, a.y - 33.94)) * step(a.x, 52.5) * step(a.y, 34.0));
  l = max(l, line(P.x));
  // centre circle and spot
  l = max(l, line(length(P) - 9.15));
  l = max(l, smoothstep(0.22, 0.14, length(P)));
  // penalty area, goal area, spot, and the arc outside the area
  vec2 e = vec2(52.5 - a.x, a.y);        // distance in from the goal line
  l = max(l, line(max(e.x - 16.5, e.y - 20.16)) * step(e.x, 16.56) * step(e.y, 20.22));
  l = max(l, line(max(e.x - 5.5, e.y - 9.16)) * step(e.x, 5.56) * step(e.y, 9.22));
  l = max(l, smoothstep(0.22, 0.14, length(e - vec2(11.0, 0.0))));
  l = max(l, line(length(e - vec2(11.0, 0.0)) - 9.15) * step(16.5, e.x));
  // corner arcs
  l = max(l, line(length(vec2(52.5, 34.0) - a) - 1.0));
  l *= step(a.x, 52.56) * step(a.y, 34.06);

  // paint on grass is not solid; it thins where the grass is long
  vec3 alb = mix(grass, vec3(0.86), l * (0.75 + 0.25 * noise(P * 9.0)));
  return mat(alb, 0.92, 0.0);
}
